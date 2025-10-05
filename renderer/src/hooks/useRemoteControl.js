import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for remote control functionality
 * Handles mouse, keyboard, and scroll events for remote desktop control
 */
export function useRemoteControl(isHost, remoteVideoRef, dataChannelsRef, isControlling) {
  const [clientCursors, setClientCursors] = useState({});
  const [peersWithControl, setPeersWithControl] = useState(new Set());

  // Handle remote control toggle for a peer
  const handleToggleControl = useCallback((peerId) => {
    setPeersWithControl(prev => {
      const newSet = new Set(prev);
      if (newSet.has(peerId)) {
        newSet.delete(peerId);
      } else {
        newSet.add(peerId);
      }
      return newSet;
    });
  }, []);

  // Handle input events (mouse, keyboard, scroll)
  const handleInputEvent = useCallback((event) => {
    const channel = dataChannelsRef.current['host'];
    if (!isControlling || !channel || channel.readyState !== 'open') return;

    const videoRect = remoteVideoRef.current?.getBoundingClientRect();
    if (!videoRect) return;

    const normalizedX = (event.clientX - videoRect.left) / videoRect.width;
    const normalizedY = (event.clientY - videoRect.top) / videoRect.height;

    let payload;

    switch(event.type) {
      case 'mousemove':
        payload = { type: 'mousemove', x: normalizedX, y: normalizedY };
        break;
      case 'mousedown':
        payload = {
          type: 'mousedown',
          x: normalizedX,
          y: normalizedY,
          button: event.button === 0 ? 'left' : event.button === 1 ? 'middle' : 'right'
        };
        break;
      case 'mouseup':
        payload = {
          type: 'mouseup',
          x: normalizedX,
          y: normalizedY,
          button: event.button === 0 ? 'left' : event.button === 1 ? 'middle' : 'right'
        };
        break;
      case 'keydown':
        event.preventDefault();
        payload = { type: 'keydown', key: event.key };
        break;
      case 'keyup':
        event.preventDefault();
        payload = { type: 'keyup', key: event.key };
        break;
      case 'wheel':
        event.preventDefault();
        payload = { type: 'scroll', deltaY: event.deltaY };
        break;
      default:
        return;
    }

    channel.send(JSON.stringify(payload));
  }, [isControlling, remoteVideoRef, dataChannelsRef]);

  // Send cursor position (client to host)
  const sendCursorPosition = useCallback((event) => {
    const channel = dataChannelsRef.current['host'];
    if (!channel || channel.readyState !== 'open' || isHost) return;

    const videoRect = remoteVideoRef.current?.getBoundingClientRect();
    if (!videoRect) return;

    // Ensure cursor position is within video bounds
    const rect = videoRect;
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

    const normalizedX = x / rect.width;
    const normalizedY = y / rect.height;

    const payload = {
      type: 'cursor-position',
      x: normalizedX,
      y: normalizedY,
      timestamp: Date.now()
    };
    channel.send(JSON.stringify(payload));
  }, [isHost, remoteVideoRef, dataChannelsRef]);

  // Set up cursor position tracking for clients
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!isHost && videoEl) {
      videoEl.addEventListener('mousemove', sendCursorPosition);
      return () => {
        videoEl.removeEventListener('mousemove', sendCursorPosition);
      };
    }
  }, [isHost, remoteVideoRef, sendCursorPosition]);

  // Set up input event listeners when controlling
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (isControlling && videoEl) {
      videoEl.addEventListener('mousemove', handleInputEvent);
      videoEl.addEventListener('mousedown', handleInputEvent);
      videoEl.addEventListener('mouseup', handleInputEvent);
      window.addEventListener('keydown', handleInputEvent);
      window.addEventListener('keyup', handleInputEvent);
      videoEl.addEventListener('wheel', handleInputEvent);
      videoEl.addEventListener('contextmenu', (e) => e.preventDefault());

      return () => {
        videoEl.removeEventListener('mousemove', handleInputEvent);
        videoEl.removeEventListener('mousedown', handleInputEvent);
        videoEl.removeEventListener('mouseup', handleInputEvent);
        window.removeEventListener('keydown', handleInputEvent);
        window.removeEventListener('keyup', handleInputEvent);
        videoEl.removeEventListener('wheel', handleInputEvent);
        videoEl.removeEventListener('contextmenu', (e) => e.preventDefault());
      };
    }
  }, [isControlling, remoteVideoRef, handleInputEvent]);

  // Handle data channel messages for cursor positions and input events
  useEffect(() => {
    Object.entries(dataChannelsRef.current).forEach(([peerId, channel]) => {
      if (channel && channel.readyState === 'open') {
        channel.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === 'cursor-position') {
              // Only hosts should track client cursors
              if (isHost) {
                setClientCursors(prev => ({
                  ...prev,
                  [peerId]: { x: message.x, y: message.y, timestamp: message.timestamp }
                }));
              }
            } else if (message.type && isHost && peersWithControl.has(peerId)) {
              // Host receives input events from controlling clients and executes them
              console.log("🎮 Host received input event from client:", peerId, message);
              try {
                window.api.sendInputEvent(message);
                console.log("✅ Input event sent to main process successfully");
              } catch (error) {
                console.error("❌ Failed to send input event to main process:", error);
              }
            }
          } catch (e) {
            console.error("Failed to parse data channel message:", e);
          }
        };
      }
    });
  }, [isHost, peersWithControl, dataChannelsRef]);

  return {
    // State
    clientCursors,
    peersWithControl,

    // Actions
    handleToggleControl,

    // Event handlers
    handleInputEvent,
    sendCursorPosition
  };
}
