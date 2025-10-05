import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useRemoteControl } from '../hooks/useRemoteControl';
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

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Use custom hooks for WebRTC and remote control functionality
  const {
    peers,
    pendingClients,
    remoteStream,
    isSessionReady,
    sessionCode,
    createOffer,
    removePeer,
    resetConnections,
    peerConnectionsRef,
    dataChannelsRef
  } = useWebRTC(isHost, '', joinCode);

  const {
    clientCursors,
    peersWithControl,
    handleToggleControl
  } = useRemoteControl(isHost, remoteVideoRef, dataChannelsRef, isControlling);

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
  useEffect(() => {
    console.log("🧪 Testing IPC communication...");

    // Set up test reply listener
    const testReplyHandler = (data) => {
      console.log("✅ IPC Test successful! Reply received:", data);
    };

    window.api.onTestIPCReply(testReplyHandler);

    // Send test message
    window.api.testIPC({ test: "ipc-communication", timestamp: Date.now() });

    // Clean up after 5 seconds
    setTimeout(() => {
      window.api.removeWsMessageListener?.(testReplyHandler);
    }, 5000);
  }, []);

  // Session actions
  const createSession = () => {
    setIsHost(true);
    setJoinCode('');
    window.api.sendWsMessage(JSON.stringify({ type: 'create-session' }));
  };

  const joinSession = () => {
    if (joinCode) {
      setIsHost(false);
      setJoinCodei(joinCode)
      window.api.sendWsMessage(JSON.stringify({ type: 'join-session', sessionId: joinCode }));
    }
  };

  const approveClient = async (clientId, sessionId) => {
    window.api.sendWsMessage(JSON.stringify({ type: 'approve-client', clientId, sessionId }));

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
    window.api.sendWsMessage(JSON.stringify({ type: 'reject-client', clientId, sessionId }));
  };

  const revokePeer = (clientId) => {
    removePeer(clientId);

    if (isHost && sessionCode) {
      window.api.sendWsMessage(JSON.stringify({
        type: 'peer-disconnected',
        clientId,
        sessionId: sessionCode
      }));
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
    setMediaStream(null);
    setIsControlling(false);
  };

  const handleSourceSelected = (stream) => {
    setMediaStream(stream);
  };

  // Update session code when WebRTC hook indicates session is ready
  useEffect(() => {
    if (isSessionReady && !sessionCode) {
      // The session code will be set by the WebRTC hook's signaling message handler
      // This effect is here to handle any additional setup if needed
    }
  }, [isSessionReady, sessionCode]);

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

      {!sessionCode && !joinCodei ? (
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
              sessionCode={sessionCode}
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
              sessionCode={sessionCode}
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
