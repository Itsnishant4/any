// preload/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAppVersion: async () => {
    return await ipcRenderer.invoke('getAppVersion');
  },
  getScreenSources: async () => {
    return await ipcRenderer.invoke('getScreenSources');
  },
  sendWsMessage: (message) => ipcRenderer.send('ws-message-to-main', message),
  onWsMessage: (callback) => ipcRenderer.on('ws-message-from-main', (event, message) => callback(message)),
  removeWsMessageListener: (callback) => ipcRenderer.removeListener('ws-message-from-main', callback)
});
