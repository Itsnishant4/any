import React from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

/**
 * ConnectionStatus component displays WebSocket connection state and latency
 */
function ConnectionStatus() {
  const { isConnected, isConnecting, latency } = useWebSocket();

  const getStatusColor = () => {
    if (isConnecting) return 'text-yellow-400';
    if (isConnected) return 'text-green-400';
    return 'text-red-400';
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    return 'Disconnected';
  };

  const getLatencyColor = () => {
    if (!latency) return 'text-gray-400';
    if (latency < 50) return 'text-green-400';
    if (latency < 100) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="flex items-center space-x-4 text-sm">
      {/* Connection Status */}
      <div className="flex items-center space-x-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnecting ? 'bg-yellow-400 animate-pulse' :
            isConnected ? 'bg-green-400' : 'bg-red-400'
          }`}
        />
        <span className={getStatusColor()}>
          {getStatusText()}
        </span>
      </div>

      {/* Latency Display */}
      {isConnected && latency && (
        <div className="flex items-center space-x-1">
          <span className="text-gray-300">•</span>
          <span className={getLatencyColor()}>
            {latency}ms
          </span>
        </div>
      )}

      {/* Loading Spinner for Connecting State */}
      {isConnecting && (
        <div className="loading loading-spinner loading-sm"></div>
      )}
    </div>
  );
}

export default ConnectionStatus;
