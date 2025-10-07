import React from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import FullScreenLoading from '../common/FullScreenLoading';

/**
 * ClientView component handles the client's session interface
 * Shows remote screen, control status, and session management
 */
function ClientView({
  sessionCode,
  joinCode,
  remoteStream,
  isControlling,
  onToggleControl,
  onResetSession,
  remoteVideoRef,
  isConnecting: webrtcConnecting,
  connectingPeers
}) {
  const { isConnected, isConnecting, latency } = useWebSocket();

  // Debug logging for client view
  console.log("🎯 ClientView Render:", {
    sessionCode,
    joinCode,
    hasRemoteStream: !!remoteStream,
    isControlling,
    remoteVideoRef: !!remoteVideoRef.current,
    isConnected,
    isConnecting,
    latency
  });

  return (
    <>
      <h2 className="text-2xl font-bold mb-4 text-center">
        Joined Session: {joinCode || sessionCode}
      </h2>

      {isControlling && (
        <div className="w-full p-2 mb-4 text-center bg-blue-600 rounded-md animate-pulse">
          You are controlling the host's screen.
        </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Remote Screen</h2>
      </div>

      {remoteStream ? (
        <div className="relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            controls={false}
            className={`w-full h-auto rounded-md mb-6 border-2 ${
              isControlling ? 'cursor-none border-blue-500' : 'border-gray-600'
            }`}
            style={{
              maxHeight: '500px',
              objectFit: 'contain',
              backgroundColor: 'black'
            }}
            onLoadedMetadata={(e) => {
              console.log('🎥 Video metadata loaded:', {
                videoWidth: e.target.videoWidth,
                videoHeight: e.target.videoHeight,
                readyState: e.target.readyState
              });

              // Ensure all video tracks are enabled
              if (remoteStream) {
                remoteStream.getVideoTracks().forEach(track => {
                  track.enabled = true;
                  console.log('🎥 Video track enabled:', track.label, track.enabled, track.readyState);
                });
              }

              // Force play with better error handling
              e.target.play().then(() => {
                console.log('✅ Video started playing successfully');
              }).catch(err => {
                console.error('❌ Error playing video:', err);
                // Try again after a short delay
                setTimeout(() => {
                  e.target.play().catch(err2 => console.error('❌ Retry play failed:', err2));
                }, 1000);
              });
            }}
            onCanPlay={() => {
              console.log('🎥 Video can play');
            }}
          />
          {/* Debug info overlay */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
            Stream: {remoteStream.id ? 'Active' : 'Inactive'} |
            Tracks: {remoteStream.getTracks().length} |
            Video: {remoteStream.getVideoTracks().length}
          </div>
        </div>
      ) : (
        <div className="w-full h-96 bg-gray-700 rounded-md mb-6 border border-gray-600 flex items-center justify-center">
          <div className="text-center text-gray-400 text-lg animate-fade-in">
            <div className="loading loading-spinner loading-lg mx-auto mb-4"></div>
            <p className="mb-2">
              {webrtcConnecting ? 'Establishing connection with host...' :
               isConnecting ? 'Connecting to server...' :
               !isConnected ? 'Server connection lost. Reconnecting...' :
               'Waiting for host to share screen...'}
            </p>
            {latency && isConnected && (
              <p className="text-sm text-gray-500">
                Latency: {latency}ms
              </p>
            )}
            {!isConnected && (
              <p className="text-sm text-yellow-400 mt-2">
                Please check your internet connection
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center items-center mt-4 space-x-4">
        <button
          onClick={() => onToggleControl(!isControlling)}
          className={`px-6 py-3 font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out ${
            isControlling
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isControlling ? 'Stop Controlling' : 'Request Control'}
        </button>
        <Link
          to="/"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
          onClick={onResetSession}
        >
          Leave Session
        </Link>
      </div>
    </>
  );
}

export default ClientView;
