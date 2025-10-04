import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

// This component is now defined inside SessionManagement.jsx to resolve the import error.
function ScreenSourcePicker({ onSourceSelected }) {
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSources() {
      try {
        if (window.api && window.api.getScreenSources) {
          const availableSources = await window.api.getScreenSources();
          console.log("Available Sources:", availableSources); // Debugging line
          setSources(availableSources);
        } else {
          setError("Electron API not available. Are you running in Electron with preload script?");
        }
      } catch (err) {
        console.error("Failed to get screen sources:", err);
        setError("Failed to retrieve screen sources. Please check permissions.");
      }
    }
    fetchSources();
  }, []);

  const handleSelectSource = async (source) => {
    setSelectedSource(source);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            minWidth: 1280,
            maxWidth: 1280,
            minHeight: 720,
            maxHeight: 720
          }
        }
      });
      onSourceSelected(stream);
    } catch (err) {
      console.error("Error getting user media:", err);
      setError("Could not get media stream from selected source. Check permissions.");
    }
  };

  if (error) {
    return (
      <div className="text-red-500 text-center p-4 bg-red-900 rounded-lg shadow-lg animate-fade-in">
        <p className="text-xl font-bold mb-2">Error:</p>
        <p>{error}</p>
        <p className="text-sm mt-4">Ensure you have granted screen recording permissions for this app.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl animate-scale-in">
      <h2 className="text-2xl font-bold mb-6 text-center text-white">Select a Screen or Window to Share</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-96 overflow-y-auto custom-scrollbar">
        {sources.map(source => (
          <div
            key={source.id}
            className={`cursor-pointer bg-gray-700 rounded-lg p-4 flex flex-col items-center transition-all duration-300 ease-in-out
              ${selectedSource && selectedSource.id === source.id ? 'border-4 border-blue-500 shadow-lg transform scale-105' : 'border-2 border-transparent hover:border-blue-400 hover:shadow-md'}`}
            onClick={() => handleSelectSource(source)}
          >
            <img
              src={source.thumbnail.toDataURL()}
              alt={source.name}
              className="w-full h-32 object-cover rounded-md mb-3 border border-gray-600"
            />
            <span className="text-white text-center text-sm font-medium">{source.name}</span>
          </div>
        ))}
      </div>
      {sources.length === 0 && !error && (
        <p className="text-center text-gray-400 mt-8 text-lg animate-fade-in">
          No screen or window sources found. Please ensure permissions are granted.
        </p>
      )}
    </div>
  );
}


// Configuration for ICE servers
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function SessionManagement() {
  // --- State Management ---
  const [isHost, setIsHost] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [peers, setPeers] = useState([]);
  const [pendingClients, setPendingClients] = useState([]);
  const [mediaStream, setMediaStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  // --- Refs for managing connections and state without re-renders ---
  const peerConnectionsRef = useRef({}); // Manages multiple peer connections for the host
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const mediaStreamRef = useRef(null); // Ref to access the latest mediaStream

  // --- UI-related state (functionality changed but UI preserved) ---
  const [performanceStats, setPerformanceStats] = useState({
    fps: 'N/A',
    avgFrameTime: 'N/A',
    method: 'WebRTC Media',
  });
  const [frameRate, setFrameRate] = useState(60);
  const [streamQuality, setStreamQuality] = useState(0.7);
  const [isSharing, setIsSharing] = useState(false); // Represents "sharing" state

  // --- Signaling and Connection State ---
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [signalingQueue, setSignalingQueue] = useState([]);
  const [pendingIceCandidates, setPendingIceCandidates] = useState({}); // Per-client candidate queue

  // Update mediaStream ref whenever state changes
  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  // --- Signaling Logic ---

  // Process queued messages once the session is ready
  const processSignalingQueue = useCallback(async () => {
    if (!isSessionReady || signalingQueue.length === 0) return;
    console.log('🔄 [DEBUG] Processing signaling queue:', signalingQueue.length, 'messages');
    const messages = [...signalingQueue];
    setSignalingQueue([]);
    for (const message of messages) {
      await handleSignalingMessage(message);
    }
  }, [isSessionReady, signalingQueue]);

  // Main handler for all incoming WebSocket messages
  const handleSignalingMessage = useCallback(async (message) => {
    const data = JSON.parse(message);
    console.log('🔄 [DEBUG] Processing signaling message:', data);
    
    // Get the correct peer connection based on the sender
    const pc = isHost ? peerConnectionsRef.current[data.senderId] : peerConnectionsRef.current['host'];

    switch (data.type) {
      case 'session-created':
        console.log('✅ [DEBUG] Session created:', data.sessionId);
        setSessionCode(data.sessionId);
        setIsSessionReady(true);
        break;

      case 'session-joined':
        console.log(`🔗 [DEBUG] Joined session ${data.sessionId} as client ${data.clientId}`);
        // Client creates its single peer connection to the host
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
        // Host will now create an offer for this client
        break;

      case 'session-rejected':
        alert('Your request to join the session was rejected by the host.');
        resetSession();
        break;

      case 'offer': // Client receives offer from Host
        console.log('📨 [DEBUG] Received offer from host:', data.senderId);
        if (pc) {
          try {
            console.log('🔄 [DEBUG] Setting remote description (offer)');
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            
            // Process any pending ICE candidates for the host
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
            window.api.sendWsMessage(JSON.stringify({ type: 'answer', sessionId: joinCode, targetId: data.senderId, signal: pc.localDescription }));
          } catch (error) {
            console.error('❌ [DEBUG] Error handling offer:', error);
          }
        } else {
          console.error('❌ [DEBUG] No peer connection for offer');
        }
        break;

      case 'answer': // Host receives answer from Client
        console.log('📨 [DEBUG] Received answer from:', data.senderId);
        if (pc) {
          try {
            console.log('🔄 [DEBUG] Setting remote description (answer)');
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            console.log('✅ [DEBUG] Answer remote description set for client:', data.senderId);
          } catch (error) {
            console.error('❌ [DEBUG] Error setting answer:', error);
          }
        } else {
          console.error('❌ [DEBUG] No peer connection found for answer from client:', data.senderId);
        }
        break;

      case 'candidate':
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
        break;

      case 'host-disconnected':
        alert('Host disconnected. Session ended.');
        resetSession();
        break;

      case 'peer-disconnected':
        setPeers(prev => prev.filter(peer => peer.id !== data.clientId));
        if (isHost && peerConnectionsRef.current[data.clientId]) {
            peerConnectionsRef.current[data.clientId].close();
            delete peerConnectionsRef.current[data.clientId];
        }
        break;
      case 'client-disconnected': 
        setPendingClients(prev => prev.filter(client => client.id !== data.clientId));
        break;
      case 'session-not-found':
        alert('Session not found. Please check the code.');
        break;
    }
  }, [isHost, joinCode, pendingIceCandidates, isSessionReady]);

  // Sets up IPC listeners for WebSocket messages
  useEffect(() => {
    const ipcListener = (message) => {
        const data = JSON.parse(message);
        // Queue messages if session isn't ready, except for session creation/joining which makes it ready
        if (!isSessionReady && !['session-created', 'session-joined'].includes(data.type)) {
            console.log('⏳ [DEBUG] Queuing signaling message until session is ready:', data.type);
            setSignalingQueue(prev => [...prev, message]);
            return;
        }
        handleSignalingMessage(message);
    };

    if (window.api) {
        window.api.onWsMessage(ipcListener);
    }
    return () => {
        if (window.api) {
            window.api.removeWsMessageListener(ipcListener);
        }
    };
  }, [handleSignalingMessage, isSessionReady]);
  
  // Process queue whenever it's updated and session is ready
  useEffect(() => {
    processSignalingQueue();
  }, [signalingQueue, isSessionReady, processSignalingQueue]);

  // --- Peer Connection Management ---

  // Creates a peer connection for a specific target (client ID for host, 'host' for client)
  const createPeerConnection = async (sessionId, targetId) => {
    console.log(`🔗 [DEBUG] Creating peer connection for target: ${targetId}`);
    
    // Close existing connection if any
    if (peerConnectionsRef.current[targetId]) {
      peerConnectionsRef.current[targetId].close();
    }

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 [DEBUG] Local ICE candidate generated for ${targetId}:`, event.candidate);
        window.api.sendWsMessage(JSON.stringify({ type: 'candidate', sessionId, targetId, signal: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      console.log('🎥 [DEBUG] REMOTE STREAM RECEIVED!');
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        console.log('✅ [DEBUG] Remote stream set in state');
      } else {
        console.warn('⚠️ [DEBUG] Ontrack event received but no stream found.');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔄 [DEBUG] Connection state for ${targetId} changed:`, pc.connectionState);
      if (pc.connectionState === 'connected' && isHost) {
        setPeers(prev => prev.map(p => p.id === targetId ? {...p, status: 'Connected'} : p));
        setIsSharing(true); // Indicate that sharing is active
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (isHost) {
          revokePeer(targetId);
        } else {
          resetSession();
          alert("Connection to host lost.");
        }
      }
    };
    
    // If we are the host and have a stream, add its tracks for the new peer.
    if (isHost && mediaStreamRef.current) {
      console.log(`➕ [DEBUG] Adding media tracks for client: ${targetId}`);
      mediaStreamRef.current.getTracks().forEach(track => pc.addTrack(track, mediaStreamRef.current));
    }
    
    peerConnectionsRef.current[targetId] = pc;
    return pc;
  };

  // --- Session Actions ---

  const createSession = () => {
    setIsHost(true);
    window.api.sendWsMessage(JSON.stringify({ type: 'create-session' }));
  };

  const joinSession = () => {
    if (joinCode) {
      setIsHost(false);
      window.api.sendWsMessage(JSON.stringify({ type: 'join-session', sessionId: joinCode }));
    }
  };

  const approveClient = async (clientId, sessionId) => {
    window.api.sendWsMessage(JSON.stringify({ type: 'approve-client', clientId, sessionId }));
    
    // Now, as the host, create a peer connection and send an offer
    if (mediaStreamRef.current) {
        const pc = await createPeerConnection(sessionId, clientId);
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log(`📤 [DEBUG] Sending offer to client: ${clientId}`);
            window.api.sendWsMessage(JSON.stringify({ type: 'offer', sessionId, targetId: clientId, signal: pc.localDescription }));
        } catch (error) {
            console.error(`❌ [DEBUG] Error creating offer for ${clientId}:`, error);
        }
    } else {
        alert("Please select a screen to share before approving clients.");
    }
  };

  const rejectClient = (clientId, sessionId) => {
    window.api.sendWsMessage(JSON.stringify({ type: 'reject-client', clientId, sessionId }));
    setPendingClients(prev => prev.filter(c => c.id !== clientId));
  };
  
  const revokePeer = (clientId) => {
    console.log(`🚫 [DEBUG] Revoking peer: ${clientId}`);
    setPeers(prev => prev.filter(peer => peer.id !== clientId));
    
    if (peerConnectionsRef.current[clientId]) {
      peerConnectionsRef.current[clientId].close();
      delete peerConnectionsRef.current[clientId];
    }
    
    if (isHost && sessionCode) {
      window.api.sendWsMessage(JSON.stringify({
        type: 'peer-disconnected',
        clientId,
        sessionId: sessionCode
      }));
    }
    if (Object.keys(peerConnectionsRef.current).length === 0) {
        setIsSharing(false); // No more clients, so not sharing
    }
  };

  const resetSession = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    
    setIsHost(false);
    setSessionCode('');
    setJoinCode('');
    setPeers([]);
    setPendingClients([]);
    setMediaStream(null);
    setRemoteStream(null);
    setIsSessionReady(false);
    setSignalingQueue([]);
    setPendingIceCandidates({});
    setIsSharing(false);
  };
  
  // --- Media and UI Effects ---

  const handleSourceSelected = (stream) => {
    console.log('🎥 [DEBUG] Screen source selected');
    setMediaStream(stream);
    // This implementation assumes the stream is selected before clients connect.
    // Changing the stream mid-session would require re-negotiating with all connected peers.
  };

  // Effect to attach local media stream to the video element
  useEffect(() => {
    if (localVideoRef.current && mediaStream) {
      console.log('📺 [DEBUG] Setting local video srcObject');
      localVideoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  // Effect to attach remote media stream to the video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('📺 [DEBUG] Setting remote video srcObject');
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);


  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white p-4">
      <h1 className="text-4xl font-extrabold mb-8 animate-fade-in">Session Management</h1>
      
      {!sessionCode && !joinCode ? (
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md animate-scale-in">
          <h2 className="text-2xl font-bold mb-6 text-center">Start or Join a Session</h2>
          <div className="flex flex-col space-y-4">
            <button
              onClick={createSession}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
            >
              Start New Session (Host)
            </button>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Enter Session Code"
                className="flex-grow px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button
                onClick={joinSession}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
              >
                Join Session
              </button>
            </div>
          </div>
          <Link
            to="/"
            className="mt-8 block text-center text-gray-400 hover:text-blue-400 transition-colors duration-300"
          >
            Back to Home
          </Link>
        </div>
      ) : (
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl animate-scale-in">
          {isHost ? (
            <>
              <h2 className="text-2xl font-bold mb-4 text-center">Your Session Code</h2>
              <div className="bg-gray-700 p-4 rounded-md text-center text-3xl font-mono tracking-wider mb-8 animate-pulse-fade">
                {sessionCode}
              </div>

              {pendingClients.length > 0 && (
                <div className="mb-8 p-6 bg-yellow-900 bg-opacity-30 rounded-lg shadow-inner animate-fade-in">
                  <h3 className="text-xl font-bold mb-4 text-center text-yellow-300">Pending Join Requests</h3>
                  <ul className="space-y-3">
                    {pendingClients.map(client => (
                      <li key={client.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                        <span className="text-lg text-gray-200">Client {client.id} wants to join.</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => approveClient(client.id, client.sessionId)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white font-semibold text-sm transition-colors duration-300"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectClient(client.id, client.sessionId)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold text-sm transition-colors duration-300"
                          >
                            Reject
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!mediaStream ? (
                <ScreenSourcePicker onSourceSelected={handleSourceSelected} />
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-4 text-center">Your Shared Screen</h2>
                  <video ref={localVideoRef} autoPlay muted className="w-full h-auto rounded-md mb-6 border border-gray-600"></video>

                  <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 text-center">Streaming Quality Controls</h3>
                     <p className="text-center text-sm text-gray-400 mb-4">WebRTC automatically optimizes stream quality and frame rate.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-6 opacity-50 cursor-not-allowed">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">Quality:</label>
                        <select
                          value={streamQuality}
                          disabled
                          readOnly
                          className="px-2 py-1 rounded bg-gray-600 text-white text-sm"
                        >
                          <option value={0.9}>High (90%)</option>
                          <option value={0.7}>Medium (70%)</option>
                          <option value={0.5}>Low (50%)</option>
                          <option value={0.3}>Very Low (30%)</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">Frame Rate:</label>
                        <select
                          value={frameRate}
                          disabled
                          readOnly
                          className="px-2 py-1 rounded bg-gray-600 text-white text-sm"
                        >
                          <option value={120}>120 FPS (Ultra Smooth)</option>
                          <option value={90}>90 FPS (Super Smooth)</option>
                          <option value={60}>60 FPS (Very Smooth)</option>
                          <option value={30}>30 FPS (Smooth)</option>
                          <option value={15}>15 FPS (Balanced)</option>
                        </select>
                      </div>
                      <div className="text-sm text-gray-300">
                        Status: {isSharing ? '🟢 Sharing' : '🔴 Not Sharing'}
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-gray-600 rounded-lg">
                      <h4 className="text-sm font-semibold mb-2 text-center">Performance Stats</h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-semibold text-green-400">{performanceStats.fps}</div>
                          <div className="text-gray-400">FPS</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-blue-400">{performanceStats.avgFrameTime}</div>
                          <div className="text-gray-400">Avg Frame Time</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-orange-400">{performanceStats.method}</div>
                          <div className="text-gray-400">Method</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold mb-4 text-center">Connected Peers</h2>
                  <ul className="space-y-4 mb-8">
                    {peers.map(peer => (
                      <li key={peer.id} className="flex items-center justify-between bg-gray-700 p-4 rounded-md shadow-md animate-slide-in-left">
                        <span className="text-lg">{peer.name} <span className={`text-sm ${peer.status === 'Connected' ? 'text-green-400' : 'text-yellow-400'}`}>({peer.status})</span></span>
                        <button
                          onClick={() => revokePeer(peer.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold transition-colors duration-300"
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => {
                        if (mediaStream) {
                          mediaStream.getTracks().forEach(track => track.stop());
                          setMediaStream(null);
                          setIsSharing(false);
                          // This stops sharing for everyone.
                          Object.keys(peerConnectionsRef.current).forEach(revokePeer);
                        }
                      }}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
                    >
                      Stop Sharing
                    </button>
                    <Link
                      to="/"
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
                      onClick={resetSession}
                    >
                      Back to Home
                    </Link>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-4 text-center">Joined Session: {joinCode || sessionCode}</h2>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold">Remote Screen</h2>
              </div>
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto rounded-md mb-6 border border-gray-600 bg-black"
                   style={{
                    maxHeight: '600px',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <div className="w-full h-96 bg-gray-700 rounded-md mb-6 border border-gray-600 flex items-center justify-center">
                  <div className="text-center text-gray-400 text-lg animate-fade-in">
                    {/* Assuming you have a CSS spinner class */}
                    <span className="loading loading-spinner loading-lg"></span>
                    <p>Waiting for host to share screen...</p>
                  </div>
                </div>
              )}

              <div className="flex justify-center mt-8">
                <Link
                  to="/"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
                  onClick={resetSession}
                >
                  Leave Session
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SessionManagement;

