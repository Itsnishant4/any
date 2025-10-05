import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 🛰️ WebSocket Context Provider for universal connection management
 * - Manages a single WebSocket connection shared across all pages
 * - Handles connection, auto-reconnect, and clean teardown
 * - Provides connection state and methods to all child components
 */
import React, { createContext, useContext } from 'react';

// WebSocket Context
const WebSocketContext = createContext(null);

// WebSocket Provider Component
export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const messageHandlers = useRef(new Set());

  /**
   * 🔌 Connect to WebSocket server
   * @param {string} serverUrl - WebSocket server URL (default: deployed Render URL)
   */
  const connect = useCallback((serverUrl = 'ws://localhost:8080') => {
    try {
      console.log('🌐 Connecting to WebSocket:', serverUrl);

      // Cleanup existing connection if any
      if (wsRef.current) {
        console.log('🔄 Closing previous WebSocket connection...');
        wsRef.current.close();
      }

      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setIsConnected(true);

        // Clear reconnection timer if running
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message);

          // Store for debug/UI
          setMessages((prev) => [...prev, message]);

          // ✅ Forward to all registered handlers
          messageHandlers.current.forEach(handler => {
            if (typeof handler === 'function') {
              handler(message);
            }
          });
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error, event.data);
        }
      };

      ws.onclose = (event) => {
        console.warn('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Auto-reconnect for abnormal closures (1006 = connection lost)
        if (event.code === 1006 || event.code === 1001) {
          console.log('⏳ Attempting to reconnect in 3 seconds...');
          reconnectTimer.current = setTimeout(() => connect(serverUrl), 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('❌ Failed to establish WebSocket connection:', error);
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      wsRef.current.send(messageStr);
      console.log('📤 Sent WebSocket message:', message);
      return true;
    } else {
      console.warn('⚠️ WebSocket not connected. Message not sent:', message);
      return false;
    }
  }, []);

  /**
   * 📝 Subscribe to WebSocket messages
   * @param {Function} handler - Message handler function
   * @returns {Function} - Unsubscribe function
   */
  const subscribe = useCallback((handler) => {
    messageHandlers.current.add(handler);
    return () => {
      messageHandlers.current.delete(handler);
    };
  }, []);

  /**
   * 🧹 Disconnect manually
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log('🔌 Manually closing WebSocket connection...');
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  /**
   * 🧠 Clean up on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Initialize connection on mount
  useEffect(() => {
    console.log("🌐 Initializing universal WebSocket connection...");
    connect('wss://any-fvzm.onrender.com');
  }, [connect]);

  const value = {
    isConnected,
    messages,
    sendMessage,
    subscribe,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * 🪝 Hook to use WebSocket context
 * @param {Function} onMessage - Optional message handler (will be added to subscribers)
 * @returns {Object} - { isConnected, messages, sendMessage, subscribe, disconnect }
 */
export function useWebSocket(onMessage = null) {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }

  // Subscribe to messages if handler provided
  useEffect(() => {
    if (onMessage && typeof onMessage === 'function') {
      const unsubscribe = context.subscribe(onMessage);
      return unsubscribe;
    }
  }, [onMessage, context.subscribe]);

  return {
    isConnected: context.isConnected,
    messages: context.messages,
    sendMessage: context.sendMessage,
    subscribe: context.subscribe,
    disconnect: context.disconnect,
  };
}
