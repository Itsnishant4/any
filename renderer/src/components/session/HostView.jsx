import React from 'react';
import { Link } from 'react-router-dom';
import ScreenSourcePicker from '../ScreenSourcePicker';
import { useWebSocket } from '../../hooks/useWebSocket';


/**
 * HostView component handles the host's session interface
 * Shows session code, pending clients, screen sharing, and connected peers
 */
function HostView({
  sessionCode,
  pendingClients,
  peers,
  mediaStream,
  peersWithControl,
  clientCursors,
  onApproveClient,
  onRejectClient,
  onRevokePeer,
  onToggleControl,
  onStopSharing,
  onResetSession,
  onSourceSelected,
  localVideoRef,
  isConnecting: webrtcConnecting,
  connectingPeers
}) {
  const { isConnected, isConnecting, latency } = useWebSocket();

  // All logging is disabled after approval, so this won't show
  

  return (
    <>
      <h2 className="text-2xl font-bold mb-4 text-center">Your Session Code</h2>
      <div className="bg-gray-700 p-4 rounded-md text-center text-3xl font-mono tracking-wider mb-8 animate-pulse-fade">
        {sessionCode}
      </div>

      {/* Connection Status Alert */}
      {(!isConnected || isConnecting) && (
        <div className={`mb-6 p-4 rounded-lg ${
          isConnecting ? 'bg-yellow-900 bg-opacity-30 border border-yellow-600' :
          'bg-red-900 bg-opacity-30 border border-red-600'
        }`}>
          <div className="flex items-center justify-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`} />
            <span className={`text-sm ${
              isConnecting ? 'text-yellow-300' : 'text-red-300'
            }`}>
              {isConnecting ? 'Connecting to server...' : 'Connection lost - attempting to reconnect...'}
            </span>
            {latency && isConnected && (
              <span className="text-green-400 text-sm">
                • {latency}ms
              </span>
            )}
          </div>
        </div>
      )}

      {pendingClients.length > 0 && (
        <div className="mb-8 p-6 bg-yellow-900 bg-opacity-30 rounded-lg shadow-inner animate-fade-in">
          <h3 className="text-xl font-bold mb-4 text-center text-yellow-300">Pending Join Requests</h3>
          {!mediaStream && pendingClients.length > 0 && (
            <div className="mb-4 p-3 bg-blue-900 bg-opacity-50 rounded-md border border-blue-600">
              <p className="text-blue-200 text-sm text-center">
                💡 <strong>Tip:</strong> Please select a screen to share (below) before approving clients
              </p>
            </div>
          )}
          <ul className="space-y-3">
            {pendingClients.map(client => (
              <li key={client.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <span className="text-lg text-gray-200">
                  Client {client.id.substring(0, 8)}... wants to join.
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => onApproveClient(client.id, client.sessionId)}
                    disabled={!mediaStream}
                    className={`px-4 py-2 rounded-md text-white font-semibold text-sm transition-colors duration-300 ${
                      mediaStream
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-500 cursor-not-allowed'
                    }`}
                    title={!mediaStream ? 'Please select a screen to share before approving clients' : 'Approve client'}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onRejectClient(client.id, client.sessionId)}
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
        <ScreenSourcePicker onSourceSelected={onSourceSelected} />
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4 text-center">Your Shared Screen</h2>

          {/* Screen Sharing with Client Cursors Overlay */}
          <div className="relative mb-6">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              className="w-full h-auto rounded-md border border-gray-600 relative"
              style={{
                maxHeight: '500px',
                objectFit: 'contain'
              }}
            />

            {/* Client Cursors Overlay */}
            {Object.entries(clientCursors).map(([clientId, cursor]) => {
              const peer = peers.find(p => p.id === clientId);
              if (!peer) return null;
              return (
                <div
                  key={clientId}
                  className="absolute z-50 pointer-events-none animate-fade-in"
                  style={{
                    left: `${cursor.x * 100}%`,
                    top: `${cursor.y * 100}%`,
                    transform: 'translate(-2px, -2px)',
                  }}
                >
                  {/* Custom Cursor Design */}
                  <div className="relative">
                    {/* Cursor pointer */}
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="drop-shadow-lg animate-cursor-pulse"
                    >
                      <path
                        d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                        fill="#FF6B35"
                        stroke="#FFFFFF"
                        strokeWidth="1"
                      />
                    </svg>

                    {/* Name Label */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-900 bg-opacity-90 text-white text-sm rounded-md whitespace-nowrap border border-gray-600 shadow-lg backdrop-blur-sm animate-name-label-float">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="font-medium">{peer.name}</span>
                      </div>
                      {/* Arrow pointing to cursor */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-gray-900"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="text-2xl font-bold mb-4 text-center">Connected Peers</h2>
          <ul className="space-y-4 mb-8">
            {peers.map(peer => (
              <li key={peer.id} className="flex items-center justify-between bg-gray-700 p-4 rounded-md shadow-md animate-slide-in-left">
                <span className="text-lg">
                  {peer.name}
                  <span className={`text-sm ml-2 ${peer.status === 'Connected' ? 'text-green-400' : 'text-yellow-400'}`}>
                    ({peer.status})
                  </span>
                </span>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <span className="mr-3 text-sm font-medium">
                      {peersWithControl.has(peer.id) ? 'Control Granted' : 'Grant Control'}
                    </span>
                    <input
                      type="checkbox"
                      checked={peersWithControl.has(peer.id)}
                      onChange={() => onToggleControl(peer.id)}
                      className="toggle toggle-primary"
                    />
                  </label>
                  <button
                    onClick={() => onRevokePeer(peer.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold transition-colors duration-300"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-center space-x-4">
            <button
              onClick={onStopSharing}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
            >
              Stop Sharing
            </button>
            <Link
              to="/"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
              onClick={onResetSession}
            >
              End Session
            </Link>
          </div>
        </>
      )}
    </>
  );
}

export default HostView;
