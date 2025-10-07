import React from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';

/**
 * SessionControls component handles the initial session creation and joining UI
 */
function SessionControls({ onCreateSession, onJoinSession, joinCode, setJoinCode }) {
  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md animate-scale-in">
      <h2 className="text-2xl font-bold mb-6 text-center">Start or Join a Session</h2>
      <div className="flex flex-col space-y-4">
        <button
          onClick={onCreateSession}
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
            onClick={onJoinSession}
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
  );
}

export default SessionControls;
