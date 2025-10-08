import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for WebRTC peer connection management
 * Handles all WebRTC-related logic including connection setup, signaling, and cleanup
 */
export function useWebRTC(isHost = false, joinCode = null, sendMessage = null) {
  //=======================DECLARATIONS================
  const [peers, setPeers] = useState([]);
  const [pendingClients, setPendingClients] = useState([]);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [currentSessionCode, setCurrentSessionCode] = useState('');
  const [signalingQueue, setSignalingQueue] = useState([]);
  const [pendingIceCandidates, setPendingIceCandidates] = useState({});
  const [connectingPeers, setConnectingPeers] = useState(new Set());
  const [isConnecting, setIsConnecting] = useState(false);
  const peerConnectionsRef = useRef({});
  const dataChannelsRef = useRef({});
  //============================================

  //=======================WEBRTC CONFIGURATION================
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'stun:stun.nextcloud.com:443' }
    ]
  };
  //============================================

  //=======================SIGNALING QUEUE PROCESSOR================
  const processSignalingQueue = useCallback(async () => {
    if (!isSessionReady || signalingQueue.length === 0) return;

    const messages = [...signalingQueue];
    setSignalingQueue([]);

    for (const message of messages) {
      await handleSignalingMessage(message);
    }
  }, [isSessionReady, signalingQueue]);
  //============================================

  //=======================MESSAGE PARSER================
  const parseMessage = useCallback((message) => {
    if (typeof message === 'string') {
      return JSON.parse(message);
    } else if (message.data) {
      return JSON.parse(message.data);
    }
    return message;
  }, []);
  //============================================

  //=======================SIGNALING MESSAGE HANDLER================
  const handleSignalingMessage = useCallback(async (message) => {
    try {
      const data = parseMessage(message);
      const pc = isHost ? peerConnectionsRef.current[data.senderId] : peerConnectionsRef.current['host'];

      switch (data.type) {
        case 'session-created':
          setCurrentSessionCode(data.sessionId);
          setIsSessionReady(true);
          break;

        case 'session-joined':
          await createPeerConnection(data.sessionId, 'host');
          setIsSessionReady(true); // Move this line to AFTER the peer connection is created.
          break;

        case 'client-request-join':
          setPendingClients(prev => [...prev, { id: data.clientId, sessionId: data.sessionId }]);
          break;

        case 'peer-approved':
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

        case 'client-connected':
          console.log('✅ [DEBUG] Client connection confirmed');
          // Update peer status to connected when client confirms connection
          if (isHost && data.senderId) {
            setPeers(prev => prev.map(p =>
              p.id === data.senderId ? {...p, status: 'Connected'} : p
            ));
          }
          break;
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error handling signaling message:', error);
    }
  }, [isHost, joinCode, parseMessage]);
  //============================================

  //=======================WEBRTC OFFER HANDLER================
  const handleOffer = useCallback(async (pc, data) => {
    try {
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

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (sendMessage) {
        sendMessage({
          type: 'answer',
          sessionId: joinCode,
          targetId: data.senderId,
          signal: pc.localDescription
        });
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error handling WebRTC offer:', error);
    }
  }, [sendMessage, joinCode, pendingIceCandidates]);
  //============================================

  //=======================WEBRTC ANSWER HANDLER================
  const handleAnswer = useCallback(async (pc, data) => {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
      console.log('✅ [DEBUG] Answer remote description set');
    } catch (error) {
      console.error('❌ [DEBUG] Error setting answer:', error);
    }
  }, []);
  //============================================

  //=======================ICE CANDIDATE HANDLER================
  const handleIceCandidate = useCallback(async (pc, data, isHost) => {
    try {
      console.log('🧊 [DEBUG] Received ICE candidate from:', data.senderId);
      const targetId = isHost ? data.senderId : 'host';

      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(data.signal));
        console.log('✅ [DEBUG] ICE candidate added for:', targetId);
      } else {
        console.log('⏳ [DEBUG] Queuing ICE candidate, remote description not set for:', targetId);
        setPendingIceCandidates(prev => ({
          ...prev,
          [targetId]: [...(prev[targetId] || []), new RTCIceCandidate(data.signal)]
        }));
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error handling ICE candidate:', error);
    }
  }, []);
  //============================================

  //=======================PEER CONNECTION CREATOR================
  const createPeerConnection = async (sessionId, targetId) => {
     
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
        if (sendMessage) {
          console.log(`🧊 [DEBUG] Sending ICE candidate to ${targetId}`);
          sendMessage({
            type: 'candidate',
            sessionId,
            targetId,
            signal: event.candidate
          });
        } else {
          console.warn('⚠️ [DEBUG] No sendMessage function provided for ICE candidate - this is normal for client during initial connection');
        }
      }
    };

    pc.ontrack = (event) => {
      console.log('🎥 [DEBUG] Remote track received:', event.track.kind);
      if (remoteStream) {
        // If stream already exists, add the track to it
        remoteStream.addTrack(event.track);
      } else {
        // If stream doesn't exist, create a new one with the incoming tracks
        const newStream = new MediaStream();
        newStream.addTrack(event.track);
        setRemoteStream(newStream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔄 [DEBUG] Connection state for ${targetId} changed:`, pc.connectionState);

      // Update connecting state
      if (pc.connectionState === 'connecting') {
        setConnectingPeers(prev => new Set([...prev, targetId]));
        setIsConnecting(true);
      } else if (pc.connectionState === 'connected') {
        console.log(`✅ [DEBUG] 🎉 PEER CONNECTION ESTABLISHED for ${targetId}!`);
        setConnectingPeers(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetId);
          // Update overall connecting state
          if (newSet.size === 0) {
            setIsConnecting(false);
          }
          return newSet;
        });

        // Update peer status for both host and client
        if (isHost) {
          setPeers(prev => prev.map(p =>
            p.id === targetId ? {...p, status: 'Connected'} : p
          ));
        } else {
          // Notify host that client connection is established
          if (sendMessage) {
            console.log('✅ [DEBUG] Client connection established, notifying host');
            sendMessage({
              type: 'client-connected',
              sessionId: joinCode,
              targetId: 'host',
              status: 'connected'
            });
          }
        }
      } else if (pc.connectionState === 'failed') {
        console.error(`❌ [DEBUG] Connection failed for ${targetId}`);
        setConnectingPeers(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetId);
          return newSet;
        });
        if (isHost) {
          removePeer(targetId);
        } else {
          resetConnections();
          alert("Connection to host failed. Please try again.");
        }
        // Update overall connecting state
        setConnectingPeers(prev => {
          const newSet = new Set(prev);
          if (newSet.size === 0) {
            setIsConnecting(false);
          }
          return newSet;
        });
      } else if (pc.connectionState === 'disconnected') {
        console.warn(`⚠️ [DEBUG] Connection disconnected for ${targetId}`);
        setConnectingPeers(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetId);
          return newSet;
        });
        if (isHost) {
          removePeer(targetId);
        } else {
          resetConnections();
          alert("Connection to host lost.");
        }
        // Update overall connecting state
        setConnectingPeers(prev => {
          const newSet = new Set(prev);
          if (newSet.size === 0) {
            setIsConnecting(false);
          }
          return newSet;
        });
      }
    };

    peerConnectionsRef.current[targetId] = pc;
    return pc;
  };
  //============================================

  //=======================DATA CHANNEL SETUP================
  const setupDataChannel = (channel, targetId) => {
    // REMOVE THE ENTIRE onmessage IMPLEMENTATION FROM HERE
    // The useRemoteControl hook will handle this exclusively.
    channel.onopen = () => {
      console.log(`✅ Data channel for ${targetId} is open.`);
    };
    channel.onclose = () => {
      console.log(`🔌 Data channel for ${targetId} is closed.`);
    };
    // channel.onmessage is now set in useRemoteControl.js
  };
  //============================================

  //=======================PEER REMOVAL================
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
  //============================================

  //=======================CONNECTION RESET================
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
  //============================================

  //=======================OFFER CREATOR================
  const createOffer = useCallback(async (sessionId, clientId, mediaStream) => {
    if (!mediaStream) {
      throw new Error("No media stream available");
    }

    try {
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
      }

      return pc;
    } catch (error) {
      console.error('❌ [DEBUG] Error creating offer:', error);
      throw error;
    }
  }, [sendMessage]);
  //============================================

  //=======================WEBSOCKET MESSAGE LISTENER================
  useEffect(() => {
    const handleWebSocketMessage = (message) => {
      // Queue messages if session isn't ready
      if (!isSessionReady && !['session-created', 'session-joined'].includes(message.type)) {
        console.log('⏳ [DEBUG] Queuing signaling message until session is ready:', message.type);
        setSignalingQueue(prev => [...prev, message]);
        return;
      }

      handleSignalingMessage(message);
    };

    // WebSocket message handling is done through the WebSocket context
    // This effect is for any additional setup if needed

    return () => {
      // Cleanup if needed
    };
  }, [handleSignalingMessage, isSessionReady]);
  //============================================

  //=======================SIGNALING QUEUE EFFECT================
  useEffect(() => {
    if (isSessionReady && signalingQueue.length > 0) {
      processSignalingQueue();
    }
  }, [signalingQueue, isSessionReady, processSignalingQueue]);

  //=======================CONNECTION TIMEOUT================
  useEffect(() => {
    if (!isHost && isConnecting && connectingPeers.length > 0) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ [DEBUG] Connection timeout - resetting connections');
        resetConnections();
        alert('Connection timeout. Please try joining the session again.');
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeout);
    }
  }, [isConnecting, connectingPeers.length, isHost]);
  //============================================

  //=======================RETURN OBJECT================
  return {
    // State
    peers,
    pendingClients,
    remoteStream,
    isSessionReady,
    sessionCode: currentSessionCode,
    isConnecting,
    connectingPeers: Array.from(connectingPeers),

    // Actions
    createOffer,
    removePeer,
    resetConnections,
    handleSignalingMessage,

    // Refs (for advanced usage)
    peerConnectionsRef,
    dataChannelsRef
  };
  //============================================
}
