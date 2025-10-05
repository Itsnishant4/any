
import React from "react";
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import SessionManagement from './pages/SessionManagement.jsx';
import Settings from './pages/Settings.jsx';
import { WebSocketProvider } from './hooks/useWebSocket.jsx';

function App() {
  return (
    <WebSocketProvider>
      <div className="h-screen w-screen">
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/session-management" element={<SessionManagement />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Router>
      </div>
    </WebSocketProvider>
  );
}

export default App;
