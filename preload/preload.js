// preload/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAppVersion: async () => {
    return await ipcRenderer.invoke('getAppVersion');
  },
  getScreenSources: async () => {
    return await ipcRenderer.invoke('getScreenSources');
  },
  sendWsMessage: (message) => {
   
    ipcRenderer.send('ws-message-to-main', message)},
  onWsMessage: (callback) => ipcRenderer.on('ws-message-from-main', (event, message) => callback(message)),
  removeWsMessageListener: (callback) => ipcRenderer.removeListener('ws-message-from-main', callback),

  // Expose a method to send input events to the main process
  sendInputEvent: (event) => {
    ipcRenderer.send('handle-input-event', event);
  },

  // Test IPC communication
  testIPC: (data) => {
    console.log("📨 Preload sending test IPC:", data);
    ipcRenderer.send('test-ipc', data);
  },

  // Listen for test IPC replies
  onTestIPCReply: (callback) => ipcRenderer.on('test-ipc-reply', (event, data) => callback(data)),

  // Get log file path
  getLogFilePath: async () => {
    return await ipcRenderer.invoke('get-log-file-path');
  },

  // Read log file content
  readLogFile: async () => {
    return await ipcRenderer.invoke('read-log-file');
  }
});
