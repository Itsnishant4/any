import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      <h1 className="text-5xl font-extrabold mb-8 animate-fade-in">Vibe Remote Desktop</h1>
      <p className="text-lg text-gray-300 mb-12 text-center max-w-md animate-fade-in animation-delay-200">
        Securely connect and manage your remote sessions with ease.
      </p>
      <div className="flex space-x-6">
        <Link
          to="/session-management"
          className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out animate-slide-up"
        >
          Start Session
        </Link>
        <Link
          to="/session-management"
          className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out animate-slide-up animation-delay-100"
        >
          Join Session
        </Link>
      </div>
      <Link
        to="/settings"
        className="mt-12 text-gray-400 hover:text-blue-400 transition-colors duration-300 animate-fade-in animation-delay-400"
      >
        Settings
      </Link>
    </div>
  );
}

export default Home;