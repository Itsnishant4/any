const WebSocket = require('ws');

// Increase the maxPayload size to handle large WebRTC offers
const wss = new WebSocket.Server({ port: 8080, maxPayload: 1024 * 1024 }); // 1 MB limit

const sessions = new Map(); // Map to store active sessions: sessionId -> { hostWs, pendingClients: Map<clientId, clientWs>, approvedClients: Map<clientId, clientWs> }

wss.on('connection', ws => {
  console.log('WebSocket client connected');

  ws.on('message', message => {
    // --- THIS IS THE CRITICAL FIX ---
    // Wrap all message processing in a try...catch block to prevent crashes
    try {
      const data = JSON.parse(message);

      switch (data.type) {
      case 'create-session':
        {
          const sessionId = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4-digit code
          sessions.set(sessionId, { hostWs: ws, pendingClients: new Map(), approvedClients: new Map() });
          ws.send(JSON.stringify({ type: 'session-created', sessionId }));
          console.log(`Session ${sessionId} created by host`);
        }
        break;
      case 'join-session':
        {
          const { sessionId } = data;
          const session = sessions.get(sessionId);
          if (session) {
            const clientId = Math.random().toString(36).substring(2, 9);
            session.pendingClients.set(clientId, ws);
            ws.clientId = clientId; // Store clientId on the WebSocket object for easy lookup
            session.hostWs.send(JSON.stringify({ type: 'client-request-join', clientId, sessionId }));
            console.log(`Client ${clientId} requested to join session ${sessionId}`);
          } else {
            ws.send(JSON.stringify({ type: 'session-not-found' }));
          }
        }
        break;
      case 'approve-client':
        {
          const { sessionId, clientId } = data;
          const session = sessions.get(sessionId);
          if (session && session.hostWs === ws && session.pendingClients.has(clientId)) {
            const clientWs = session.pendingClients.get(clientId);
            session.pendingClients.delete(clientId);
            session.approvedClients.set(clientId, clientWs);
            clientWs.send(JSON.stringify({ type: 'session-joined', sessionId, clientId }));
            session.hostWs.send(JSON.stringify({ type: 'peer-approved', clientId }));
            console.log(`Host approved client ${clientId} for session ${sessionId}`);
          }
        }
        break;
      case 'reject-client':
        {
          const { sessionId, clientId } = data;
          const session = sessions.get(sessionId);
          if (session && session.hostWs === ws && session.pendingClients.has(clientId)) {
            const clientWs = session.pendingClients.get(clientId);
            session.pendingClients.delete(clientId);
            clientWs.send(JSON.stringify({ type: 'session-rejected', sessionId }));
            console.log(`Host rejected client ${clientId} for session ${sessionId}`);
          }
        }
        break;

      case 'client-connected':
        {
          // This case handles the final confirmation from the client
          // and forwards it to the host.
          const session = sessions.get(data.sessionId);
          if (session && ws.clientId && session.approvedClients.has(ws.clientId) && session.hostWs) {
              console.log(`[SIGNALING] Client ${ws.clientId} confirmed connection. Notifying host.`);
              session.hostWs.send(JSON.stringify({
                  type: 'client-connected',
                  senderId: ws.clientId,
                  status: data.status
              }));
          }
        }
        break;
      case 'offer':
      case 'answer':
      case 'candidate':
        {
          // --- ADD LOGGING HERE ---
          console.log(`[SIGNALING] Received signal: ${data.type} for target: ${data.targetId}`);

          const { sessionId, targetId, signal } = data;
          const session = sessions.get(sessionId);
          if (session) {
            const senderId = ws.clientId || 'host';
            if (session.hostWs === ws && session.approvedClients.has(targetId)) {

              // --- ADD LOGGING HERE ---
              console.log(`[SIGNALING] Host is sending ${data.type} to client ${targetId}. Forwarding...`);

              session.approvedClients.get(targetId).send(JSON.stringify({ type: data.type, senderId: 'host', signal }));

            } else if (ws.clientId && session.approvedClients.has(ws.clientId) && session.hostWs) {

              // --- ADD LOGGING HERE ---
              console.log(`[SIGNALING] Client ${ws.clientId} is sending ${data.type} to host. Forwarding...`);

              session.hostWs.send(JSON.stringify({ type: data.type, senderId: ws.clientId, signal }));
            } else {

              // --- ADD LOGGING HERE ---
              console.log(`[SIGNALING] FAILED to forward ${data.type}. Conditions not met.`);
              console.log(`           - Is Host: ${session.hostWs === ws}`);
              console.log(`           - Target in Approved List: ${session.approvedClients.has(targetId)}`);
              console.log(`           - Approved clients:`, Array.from(session.approvedClients.keys()));
            }
          } else {
            // --- ADD LOGGING HERE ---
            console.log(`[SIGNALING] FAILED to forward ${data.type}. Session ${sessionId} not found.`);
          }
        }
        break;
      }
    } catch (error) {
        // If JSON.parse fails, this will catch the error and prevent a crash
        console.error('[ERROR] Failed to parse message or process data:', error);
        console.error('       Raw message:', message.toString()); // Log the raw message for debugging
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    sessions.forEach((session, sessionId) => {
      if (session.hostWs === ws) {
        console.log(`Host for session ${sessionId} disconnected. Closing session.`);
        session.pendingClients.forEach(clientWs => clientWs.send(JSON.stringify({ type: 'host-disconnected' })));
        session.approvedClients.forEach(clientWs => clientWs.send(JSON.stringify({ type: 'host-disconnected' })));
        sessions.delete(sessionId);
      } else {
        // Check if it's a pending client
        session.pendingClients.forEach((clientWs, clientId) => {
          if (clientWs === ws) {
            console.log(`Pending client ${clientId} disconnected from session ${sessionId}`);
            session.pendingClients.delete(clientId);
            if(session.hostWs && session.hostWs.readyState === WebSocket.OPEN) {
                session.hostWs.send(JSON.stringify({ type: 'client-disconnected', clientId }));
            }
          }
        });
        // Check if it's an approved client
        session.approvedClients.forEach((clientWs, clientId) => {
          if (clientWs === ws) {
            console.log(`Approved client ${clientId} disconnected from session ${sessionId}`);
            session.approvedClients.delete(clientId);
            if(session.hostWs && session.hostWs.readyState === WebSocket.OPEN) {
                session.hostWs.send(JSON.stringify({ type: 'peer-disconnected', clientId }));
            }
          }
        });
      }
    });
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });
});

console.log('WebSocket server started on port 8080');
