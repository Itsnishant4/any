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
  const [isConnecting, setIsConnecting] = useState(false);
  const [latency, setLatency] = useState(null);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const messageHandlers = useRef(new Set());
  const pingInterval = useRef(null);
  const lastPongTime = useRef(null);

  /**
   * 📡 Start latency monitoring with ping/pong
   */
  const startLatencyMonitoring = useCallback(() => {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
    }

    pingInterval.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        lastPongTime.current = Date.now();
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 5000); // Ping every 5 seconds

    // Listen for pong responses
    const pongHandler = (message) => {
      if (message.type === 'pong' && lastPongTime.current) {
        const latencyMs = Date.now() - lastPongTime.current;
        setLatency(latencyMs);
      }
    };

    messageHandlers.current.add(pongHandler);

    return () => {
      messageHandlers.current.delete(pongHandler);
    };
  }, []);

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

      setIsConnecting(true);
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setIsConnected(true);
        setIsConnecting(false);

        // Clear reconnection timer if running
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }

        // Start latency monitoring
        startLatencyMonitoring();
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
    // --- START: NEW ENHANCED VERSION ---
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ WebSocket not connected. Message not sent:', message);
        return false;
      }

      console.log('📤 [sendMessage] Attempting to send message:', message);

      let messageStr;
      try {
        messageStr = JSON.stringify(message);
        console.log(`✅ [sendMessage] JSON.stringify successful. Payload size: ${messageStr.length} chars.`);
      } catch (stringifyError) {
        console.error('❌ [sendMessage] CRITICAL: Failed to JSON.stringify the message object.', stringifyError);
        console.error('   [sendMessage] The problematic message object was:', message);
        return false;
      }

      wsRef.current.send(messageStr);
      console.log('✅ [sendMessage] ws.send() command executed.');

      return true;

    } catch (sendError) {
      console.error('❌ [sendMessage] CRITICAL: An unexpected error occurred during the send process.', sendError);
      console.error('   [sendMessage] The problematic message object was:', message);
      return false;
    }
    // --- END: NEW ENHANCED VERSION ---
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
    setIsConnecting(false);
    setLatency(null);
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
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
    connect('ws://localhost:8080');
  }, [connect]);

  const value = {
    isConnected,
    isConnecting,
    latency,
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
    isConnecting: context.isConnecting,
    latency: context.latency,
    messages: context.messages,
    sendMessage: context.sendMessage,
    subscribe: context.subscribe,
    disconnect: context.disconnect,
  };
}
