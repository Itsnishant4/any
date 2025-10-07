import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ConnectionStatus from '../components/common/ConnectionStatus';

function Settings() {
  const [allowRemoteInput, setAllowRemoteInput] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-teal-900 to-cyan-800 text-white p-4 relative">
      {/* Connection Status - Top Right */}
      <div className="absolute top-4 right-4">
        <ConnectionStatus />
      </div>

      <h1 className="text-4xl font-extrabold mb-8 animate-fade-in">Settings</h1>

      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-xl animate-scale-in">
        <div className="mb-6 flex items-center justify-between">
          <label htmlFor="remoteInput" className="text-lg">Allow Remote Input</label>
          <input
            type="checkbox"
            id="remoteInput"
            checked={allowRemoteInput}
            onChange={() => setAllowRemoteInput(!allowRemoteInput)}
            className="toggle toggle-lg toggle-primary"
          />
        </div>

        <div className="mb-8 flex items-center justify-between">
          <label htmlFor="autoApprove" className="text-lg">Auto-Approve Sessions</label>
          <input
            type="checkbox"
            id="autoApprove"
            checked={autoApprove}
            onChange={() => setAutoApprove(!autoApprove)}
            className="toggle toggle-lg toggle-primary"
          />
        </div>

        <div className="flex justify-center">
          <Link
            to="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Settings;
