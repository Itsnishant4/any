import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for WebRTC peer connection management
 * Handles all WebRTC-related logic including connection setup, signaling, and cleanup
 */
export function useWebRTC(isHost = false, sessionId = null, joinCode = null, sendMessage = null) {
  const [peers, setPeers] = useState([]);
  const [pendingClients, setPendingClients] = useState([]);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [currentSessionCode, setCurrentSessionCode] = useState('');
  const [signalingQueue, setSignalingQueue] = useState([]);
  const [pendingIceCandidates, setPendingIceCandidates] = useState({});

  const peerConnectionsRef = useRef({});
  const dataChannelsRef = useRef({});

  // WebRTC Configuration
  const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  // Process queued signaling messages once session is ready
  const processSignalingQueue = useCallback(async () => {
    if (!isSessionReady || signalingQueue.length === 0) return;

    console.log('🔄 [DEBUG] Processing signaling queue:', signalingQueue.length, 'messages');
    const messages = [...signalingQueue];
    setSignalingQueue([]);

    for (const message of messages) {
      await handleSignalingMessage(message);
    }
  }, [isSessionReady, signalingQueue]);

  // Main signaling message handler
  const handleSignalingMessage = useCallback(async (message) => {
    console.log('📨 [DEBUG] Handling signaling message:', message);

    // Handle both raw message strings and parsed objects
    let data;
    if (typeof message === 'string') {
      data = JSON.parse(message);
    } else if (message.data) {
      // Handle WebSocket event format
      data = JSON.parse(message.data);
    } else {
      // Assume it's already a parsed object
      data = message;
    }

    console.log('📊 [DEBUG] Parsed message data:', data);
    const pc = isHost ? peerConnectionsRef.current[data.senderId] : peerConnectionsRef.current['host'];

    switch (data.type) {
      case 'session-created':
        console.log('✅ [DEBUG] Session created:', data.sessionId);
        console.log('🔄 [DEBUG] Setting currentSessionCode to:', data.sessionId);
        setCurrentSessionCode(data.sessionId);
        setIsSessionReady(true);
        console.log('✅ [DEBUG] Session ready state set to true');
        break;

      case 'session-joined':
        console.log(`🔗 [DEBUG] Joined session ${data.sessionId} as client ${data.clientId}`);
        await createPeerConnection(data.sessionId, 'host');
        setIsSessionReady(true);
        break;

      case 'client-request-join':
        console.log('👥 [DEBUG] Client request to join:', data.clientId);
        setPendingClients(prev => [...prev, { id: data.clientId, sessionId: data.sessionId }]);
        break;

      case 'peer-approved':
        console.log('✅ [DEBUG] Peer approved:', data.clientId);
        setPeers(prev => [...prev, { id: data.clientId, name: `Peer ${data.clientId}`, status: 'Connecting' }]);
        setPendingClients(prev => prev.filter(client => client.id !== data.clientId));
        break;

      case 'session-rejected':
        alert('Your request to join the session was rejected by the host.');
        resetConnections();
        break;

      case 'offer':
        if (pc) {
          await handleOffer(pc, data);
        }
        break;

      case 'answer':
        if (pc) {
          await handleAnswer(pc, data);
        }
        break;

      case 'candidate':
        await handleIceCandidate(pc, data, isHost);
        break;

      case 'host-disconnected':
        alert('Host disconnected. Session ended.');
        resetConnections();
        break;

      case 'peer-disconnected':
        removePeer(data.clientId);
        break;

      case 'client-disconnected':
        setPendingClients(prev => prev.filter(client => client.id !== data.clientId));
        break;

      case 'session-not-found':
        alert('Session not found. Please check the code.');
        break;
    }
  }, [isHost, joinCode, pendingIceCandidates, isSessionReady]);

  // Handle WebRTC offer
  const handleOffer = async (pc, data) => {
    try {
      console.log('🔄 [DEBUG] Setting remote description (offer)');
      await pc.setRemoteDescription(new RTCSessionDescription(data.signal));

      // Process pending ICE candidates
      const candidates = pendingIceCandidates['host'] || [];
      if (candidates.length > 0) {
        console.log('🧊 [DEBUG] Processing pending ICE candidates for host:', candidates.length);
        for (const candidate of candidates) {
          await pc.addIceCandidate(candidate);
        }
        setPendingIceCandidates(prev => ({...prev, host: []}));
      }

      console.log('✅ [DEBUG] Remote description set, creating answer');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('📤 [DEBUG] Sending answer to host');
      if (sendMessage) {
        sendMessage({
          type: 'answer',
          sessionId: joinCode,
          targetId: data.senderId,
          signal: pc.localDescription
        });
      } else {
        console.warn('⚠️ [DEBUG] No sendMessage function provided');
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error handling offer:', error);
    }
  };

  // Handle WebRTC answer
  const handleAnswer = async (pc, data) => {
    try {
      console.log('🔄 [DEBUG] Setting remote description (answer)');
      await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
      console.log('✅ [DEBUG] Answer remote description set for client:', data.senderId);
    } catch (error) {
      console.error('❌ [DEBUG] Error setting answer:', error);
    }
  };

  // Handle ICE candidates
  const handleIceCandidate = async (pc, data, isHost) => {
    console.log('🧊 [DEBUG] Received ICE candidate from:', data.senderId);
    const targetId = isHost ? data.senderId : 'host';

    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.signal));
        console.log('✅ [DEBUG] ICE candidate added for:', targetId);
      } catch (error) {
        console.error('❌ [DEBUG] Error adding ICE candidate:', error);
      }
    } else {
      console.log('⏳ [DEBUG] Queuing ICE candidate, remote description not set for:', targetId);
      setPendingIceCandidates(prev => ({
        ...prev,
        [targetId]: [...(prev[targetId] || []), new RTCIceCandidate(data.signal)]
      }));
    }
  };

  // Create peer connection
  const createPeerConnection = async (sessionId, targetId) => {
    console.log(`🔗 [DEBUG] Creating peer connection for target: ${targetId}`);

    // Close existing connection if any
    if (peerConnectionsRef.current[targetId]) {
      peerConnectionsRef.current[targetId].close();
    }

    const pc = new RTCPeerConnection(configuration);

    // Set up data channel for remote control
    if (isHost) {
      const channel = pc.createDataChannel('input-channel');
      setupDataChannel(channel, targetId);
      dataChannelsRef.current[targetId] = channel;
    } else {
      pc.ondatachannel = (event) => {
        dataChannelsRef.current['host'] = event.channel;
        setupDataChannel(event.channel, 'host');
      };
    }

    // Set up event handlers
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 [DEBUG] Local ICE candidate generated for ${targetId}`);
        if (sendMessage) {
          sendMessage({
            type: 'candidate',
            sessionId,
            targetId,
            signal: event.candidate
          });
        } else {
          console.warn('⚠️ [DEBUG] No sendMessage function provided for ICE candidate');
        }
      }
    };

    pc.ontrack = (event) => {
      console.log('🎥 [DEBUG] Remote stream received');
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔄 [DEBUG] Connection state for ${targetId} changed:`, pc.connectionState);
      if (pc.connectionState === 'connected' && isHost) {
        setPeers(prev => prev.map(p =>
          p.id === targetId ? {...p, status: 'Connected'} : p
        ));
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (isHost) {
          removePeer(targetId);
        } else {
          resetConnections();
          alert("Connection to host lost.");
        }
      }
    };

    peerConnectionsRef.current[targetId] = pc;
    return pc;
  };

  // Set up data channel for remote control
  const setupDataChannel = (channel, targetId) => {
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'cursor-position') {
          // Handle cursor position updates (for host to show client cursors)
          console.log('Cursor position:', message);
        } else {
          // Handle remote input events
          console.log("Sending input event to main process:", message);
          window.api.sendInputEvent(message);
        }
      } catch (e) {
        console.error("Failed to parse data channel message:", e);
      }
    };
  };

  // Remove a peer connection
  const removePeer = (clientId) => {
    console.log(`🚫 [DEBUG] Removing peer: ${clientId}`);
    setPeers(prev => prev.filter(peer => peer.id !== clientId));

    if (peerConnectionsRef.current[clientId]) {
      peerConnectionsRef.current[clientId].close();
      delete peerConnectionsRef.current[clientId];
    }

    if (dataChannelsRef.current[clientId]) {
      delete dataChannelsRef.current[clientId];
    }
  };

  // Reset all connections
  const resetConnections = () => {
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    dataChannelsRef.current = {};

    setPeers([]);
    setPendingClients([]);
    setRemoteStream(null);
    setIsSessionReady(false);
    setCurrentSessionCode('');
    setSignalingQueue([]);
    setPendingIceCandidates({});
  };

  // Create offer for new peer (host only)
  const createOffer = async (sessionId, clientId, mediaStream) => {
    if (!mediaStream) {
      throw new Error("No media stream available");
    }

    const pc = await createPeerConnection(sessionId, clientId);

    // Add media tracks
    mediaStream.getTracks().forEach(track => pc.addTrack(track, mediaStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log(`📤 [DEBUG] Sending offer to client: ${clientId}`);
    if (sendMessage) {
      sendMessage({
        type: 'offer',
        sessionId,
        targetId: clientId,
        signal: pc.localDescription
      });
    } else {
      console.warn('⚠️ [DEBUG] No sendMessage function provided for offer');
    }

    return pc;
  };

  // Set up WebSocket message listener
  useEffect(() => {
    const wsListener = (message) => {
      console.log('📨 [DEBUG] WebRTC received WebSocket message:', message);

      // Message is already parsed from WebSocket context
      // Queue messages if session isn't ready
      if (!isSessionReady && !['session-created', 'session-joined'].includes(message.type)) {
        console.log('⏳ [DEBUG] Queuing signaling message until session is ready:', message.type);
        setSignalingQueue(prev => [...prev, message]);
        return;
      }

      handleSignalingMessage(message);
    };

    console.log('🔗 [DEBUG] Setting up WebSocket message listener for WebRTC');

    return () => {
      // WebSocket context handles its own cleanup
    };
  }, [handleSignalingMessage, isSessionReady]);

  // Debug logging for session code changes
  useEffect(() => {
    console.log('🔄 [DEBUG] WebRTC Session Code Updated:', currentSessionCode);
  }, [currentSessionCode]);

  // Process signaling queue when session becomes ready
  useEffect(() => {
    processSignalingQueue();
  }, [signalingQueue, isSessionReady, processSignalingQueue]);

  return {
    // State
    peers,
    pendingClients,
    remoteStream,
    isSessionReady,
    sessionCode: currentSessionCode,

    // Actions
    createOffer,
    removePeer,
    resetConnections,
    handleSignalingMessage,

    // Refs (for advanced usage)
    peerConnectionsRef,
    dataChannelsRef
  };
}
