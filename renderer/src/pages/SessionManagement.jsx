import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useRemoteControl } from '../hooks/useRemoteControl';
import { useWebSocket } from '../hooks/useWebSocket';
import SessionControls from '../components/session/SessionControls';
import HostView from '../components/session/HostView';
import ClientView from '../components/session/ClientView';
import ConnectionStatus from '../components/common/ConnectionStatus';
import FullScreenLoading from '../components/common/FullScreenLoading';


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

  // Loading state for client joining process
  const [isClientJoining, setIsClientJoining] = useState(false);
  const [loadingStage, setLoadingStage] = useState('connecting');

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
    isConnecting,
    connectingPeers,
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
      handleSignalingMessage(message);
    });

    return unsubscribe;
  }, [subscribe, handleSignalingMessage]);

  // Test IPC communication on mount
  

  // Session actions
  const createSession = () => {
    setIsHost(true);
    setJoinCode('');
    sendWsMessage({ type: 'create-session' });
  };

  const joinSession = () => {
    if (joinCode) {
      setJoinCodei(joinCode);
      setIsClientJoining(true);
      setLoadingStage('connecting');
      setIsHost(false);
      sendWsMessage({ type: 'join-session', sessionId: joinCode });
      console.log('🔄 [DEBUG] Joining session:', joinCode);
    }
  };

  const approveClient = async (clientId, sessionId) => {
    console.log('🔄 [DEBUG] Approving client:', clientId);

    sendWsMessage({ type: 'approve-client', clientId, sessionId });

    if (mediaStream) {
      try {
        console.log('📤 [DEBUG] Creating WebRTC offer for client:', clientId);
        await createOffer(sessionId, clientId, mediaStream);
        console.log('✅ [DEBUG] WebRTC offer sent successfully to client:', clientId);
      } catch (error) {
        console.error('❌ [DEBUG] Failed to create/send offer:', error);
        alert("Please select a screen to share before approving clients.");
      }
    } else {
      console.error('❌ [DEBUG] No mediaStream available when approving client');
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
    console.log('🔄 [DEBUG] Resetting session');

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    resetConnections();

    setIsHost(false);
    setJoinCode('');
    setSessionCode('');
    setMediaStream(null);
    setIsControlling(false);
    setIsClientJoining(false);
    setLoadingStage('connecting');

    console.log('✅ [DEBUG] Session reset complete');
  };

  const handleSourceSelected = (stream) => {
    setMediaStream(stream);
  };



  // Update session code when WebRTC hook indicates session is ready
  useEffect(() => {


    if (isSessionReady && webrtcSessionCode && !sessionCode) {
      setSessionCode(webrtcSessionCode);
    }
  }, [isSessionReady, webrtcSessionCode]);

  // Manage loading stages for client joining process
  useEffect(() => {
    if (!isClientJoining) return;

    console.log('🔄 [DEBUG] Loading stage check:', {
      isSessionReady,
      hasRemoteStream: !!remoteStream,
      currentLoadingStage: loadingStage,
      connectingPeers: connectingPeers.length
    });

    // Determine loading stage based on WebRTC connection states
    if (!isSessionReady) {
      if (loadingStage === 'connecting') {
        setLoadingStage('joining');
      }
    } else if (isSessionReady && !remoteStream) {
      if (loadingStage === 'joining' || loadingStage === 'connecting') {
        setLoadingStage('webrtc');
      }
    } else if (isSessionReady && remoteStream) {
      if (loadingStage !== 'ready') {
        console.log('✅ [DEBUG] Connection ready - moving to ready stage');
        setLoadingStage('ready');
        // Auto-hide loading after 2 seconds when ready
        setTimeout(() => {
          console.log('⏰ [DEBUG] Auto-hiding loading after ready stage');
          setIsClientJoining(false);
        }, 2000);
      }
    }

    // Also check if connection is established via connectingPeers
    if (connectingPeers.length === 0 && isSessionReady && loadingStage !== 'ready') {
      console.log('✅ [DEBUG] No connecting peers and session ready - moving to ready');
      setLoadingStage('ready');
      setTimeout(() => {
        setIsClientJoining(false);
      }, 2000);
    }
  }, [isClientJoining, isSessionReady, remoteStream, loadingStage, connectingPeers]);

  // Handle loading close
  const handleLoadingClose = () => {
    setIsClientJoining(false);
    setLoadingStage('connecting');
  };

  // Set up video elements when streams change
  useEffect(() => {
    if (localVideoRef.current && mediaStream) {
      localVideoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('🎥 Setting remote video srcObject:', {
        streamId: remoteStream.id,
        active: remoteStream.active,
        tracks: remoteStream.getTracks().length,
        videoTracks: remoteStream.getVideoTracks().length
      });

      // Only set srcObject if it's different to avoid interrupting playback
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        console.log('✅ Remote video srcObject set successfully');

        // Attempt to play the video once the stream is attached
        remoteVideoRef.current.play().catch(error => {
          console.error('❌ Video autoplay failed:', error);
          // Autoplay was prevented. This is common. The user might need to interact with the page first.
          // The `muted` prop on the video element should prevent this in most cases.
        });
      }
    }
  }, [remoteStream]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white p-4 overflow-y-auto relative">
      {/* Full Screen Loading for Client Joining */}
      <FullScreenLoading
        isVisible={isClientJoining}
        stage={loadingStage}
        onClose={handleLoadingClose}
      />

      {/* Connection Status - Top Right */}
      <div className="absolute top-4 right-4">
        <ConnectionStatus />
      </div>

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
              isConnecting={isConnecting}
              connectingPeers={connectingPeers}
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
              isConnecting={isConnecting}
              connectingPeers={connectingPeers}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default SessionManagement;
