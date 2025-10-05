import React from 'react';
import { Link } from 'react-router-dom';

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
  remoteVideoRef
}) {
  // Debug logging for client view
  console.log("🎯 ClientView Render:", {
    sessionCode,
    joinCode,
    hasRemoteStream: !!remoteStream,
    isControlling,
    remoteVideoRef: !!remoteVideoRef.current
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
            className={`w-full h-auto rounded-md mb-6 border-2 bg-black ${
              isControlling ? 'cursor-none border-blue-500' : 'border-gray-600'
            }`}
            style={{
              maxHeight: '500px',
              objectFit: 'contain'
            }}
          />
        </div>
      ) : (
        <div className="w-full h-96 bg-gray-700 rounded-md mb-6 border border-gray-600 flex items-center justify-center">
          <div className="text-center text-gray-400 text-lg animate-fade-in">
            <div className="loading loading-spinner loading-lg mx-auto mb-4"></div>
            <p>Waiting for host to share screen...</p>
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
