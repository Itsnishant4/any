import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useRemoteControl } from '../hooks/useRemoteControl';
import { useWebSocket } from '../hooks/useWebSocket.jsx';
import SessionControls from '../components/session/SessionControls';
import HostView from '../components/session/HostView';
import ClientView from '../components/session/ClientView';

/**
 * Refactored SessionManagement component using hooks and sub-components
 * Much cleaner and more maintainable than the original monolithic version
 */
function SessionManagement() {
  // Session state
  const [isHost, setIsHost] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinCodei, setJoinCodei] = useState('');
  const [mediaStream, setMediaStream] = useState(null);
  const [isControlling, setIsControlling] = useState(false);
  const [sessionCode, setSessionCode] = useState('');

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // WebSocket connection for signaling server (now provided by WebSocketProvider)
  const {
    sendMessage: sendWsMessage,
    subscribe,
  } = useWebSocket();

  // Use custom hooks for WebRTC and remote control functionality
  const {
    peers,
    pendingClients,
    remoteStream,
    isSessionReady,
    sessionCode: webrtcSessionCode,
    createOffer,
    removePeer,
    resetConnections,
    handleSignalingMessage,
    peerConnectionsRef,
    dataChannelsRef
  } = useWebRTC(isHost, '', joinCode, sendWsMessage);


  const {
    clientCursors,
    peersWithControl,
    handleToggleControl
  } = useRemoteControl(isHost, remoteVideoRef, dataChannelsRef, isControlling);

  // Set up WebSocket message forwarding to WebRTC hook
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      console.log('📨 [DEBUG] SessionManagement received WebSocket message:', message);
      handleSignalingMessage(message);
    });

    return unsubscribe;
  }, [subscribe, handleSignalingMessage]);

  // Debug logging for control flow
  useEffect(() => {
    console.log("🔄 Session State Update:", {
      isHost,
      isControlling,
      sessionCode,
      joinCodei,
      peersCount: peers.length,
      peersWithControlCount: peersWithControl.size,
      clientCursorsCount: Object.keys(clientCursors).length
    });
  }, [isHost, isControlling, sessionCode, joinCodei, peers, peersWithControl, clientCursors]);

  // Test IPC communication on mount
  

  // Session actions
  const createSession = () => {
    setIsHost(true);
    setJoinCode('');
    sendWsMessage({ type: 'create-session' });
  };

  const joinSession = () => {
    if (joinCode) {
      setIsHost(false);
      setJoinCodei(joinCode)
      sendWsMessage({ type: 'join-session', sessionId: joinCode });
    }
  };

  const approveClient = async (clientId, sessionId) => {
    sendWsMessage({ type: 'approve-client', clientId, sessionId });

    if (mediaStream) {
      try {
        await createOffer(sessionId, clientId, mediaStream);
      } catch (error) {
        console.error(`Error creating offer for ${clientId}:`, error);
        alert("Please select a screen to share before approving clients.");
      }
    } else {
      alert("Please select a screen to share before approving clients.");
    }
  };

  const rejectClient = (clientId, sessionId) => {
    sendWsMessage({ type: 'reject-client', clientId, sessionId });
  };

  const revokePeer = (clientId) => {
    removePeer(clientId);

    if (isHost && sessionCode) {
      sendWsMessage({
        type: 'peer-disconnected',
        clientId,
        sessionId: sessionCode
      });
    }
  };

  const stopSharing = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);

      // Stop sharing for all connected peers
      Object.keys(peerConnectionsRef.current).forEach(revokePeer);
    }
  };

  const resetSession = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    resetConnections();

    setIsHost(false);
    setJoinCode('');
    setJoinCodei('');
    setSessionCode('');
    setMediaStream(null);
    setIsControlling(false);
  };

  const handleSourceSelected = (stream) => {
    setMediaStream(stream);
  };

  // Accept offer as client and send response via WebSocket
  const acceptOfferAsClient = async (offerData) => {
    if (isHost) {
      console.warn('⚠️ [DEBUG] Cannot accept offer as client when in host mode');
      return;
    }

    try {
      console.log('🔄 [DEBUG] Client accepting offer:', offerData);

      // Get the peer connection for the host
      const pc = peerConnectionsRef.current['host'];
      if (!pc) {
        console.error('❌ [DEBUG] No peer connection available for host');
        return;
      }

      // Set remote description (accept the offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offerData.signal));
      console.log('✅ [DEBUG] Remote description set successfully');

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('✅ [DEBUG] Answer created and set as local description');

      // Send answer back to host via WebSocket
      const answerMessage = {
        type: 'answer',
        sessionId: joinCode,
        targetId: offerData.senderId,
        signal: pc.localDescription
      };

      sendWsMessage(answerMessage);
      console.log('📤 [DEBUG] Answer sent to host:', answerMessage);

    } catch (error) {
      console.error('❌ [DEBUG] Error accepting offer as client:', error);
    }
  };

  // Expose acceptOfferAsClient function for use in child components
  const clientActions = {
    acceptOfferAsClient
  };

  // Update session code when WebRTC hook indicates session is ready
  useEffect(() => {
    console.log('🔄 [DEBUG] Sync Effect Triggered:', {
      isSessionReady,
      webrtcSessionCode,
      currentSessionCode: sessionCode
    });

    if (isSessionReady && webrtcSessionCode && !sessionCode) {
      console.log('✅ [DEBUG] Setting session code:', webrtcSessionCode);
      setSessionCode(webrtcSessionCode);
    }
  }, [isSessionReady, webrtcSessionCode]); // Removed sessionCode to prevent infinite loop

  // Set up video elements when streams change
  useEffect(() => {
    if (localVideoRef.current && mediaStream) {
      localVideoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white p-4 overflow-y-auto">
      <h1 className="text-4xl font-extrabold my-8 animate-fade-in">Session Management</h1>

      {(!webrtcSessionCode && !joinCodei) ? (
        <SessionControls
          onCreateSession={createSession}
          onJoinSession={joinSession}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
        />
      ) : (
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-4xl animate-scale-in">
          {isHost ? (
            <HostView
              sessionCode={webrtcSessionCode}
              pendingClients={pendingClients}
              peers={peers}
              mediaStream={mediaStream}
              peersWithControl={peersWithControl}
              clientCursors={clientCursors}
              onApproveClient={approveClient}
              onRejectClient={rejectClient}
              onRevokePeer={revokePeer}
              onToggleControl={handleToggleControl}
              onStopSharing={stopSharing}
              onResetSession={resetSession}
              onSourceSelected={handleSourceSelected}
              localVideoRef={localVideoRef}
            />
          ) : (
            <ClientView
              sessionCode={webrtcSessionCode}
              joinCode={joinCode}
              remoteStream={remoteStream}
              isControlling={isControlling}
              onToggleControl={setIsControlling}
              onResetSession={resetSession}
              remoteVideoRef={remoteVideoRef}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default SessionManagement;
