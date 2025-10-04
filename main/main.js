// main/main.js
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let mainWindow;
let wsClient; // WebSocket client instance

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  // Initialize WebSocket client
  wsClient = new WebSocket('ws://localhost:8080');

  wsClient.onopen = () => {
    console.log('WebSocket client connected from main process');
  };

  wsClient.onmessage = (event) => {
    // Forward messages from WebSocket server to renderer process
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('ws-message-from-main', event.data);
    }
  };

  wsClient.onclose = () => {
    console.log('WebSocket client disconnected from main process');
  };

  wsClient.onerror = (error) => {
    console.error('WebSocket client error from main process:', error);
  };
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: getAppVersion demo
ipcMain.handle('getAppVersion', () => {
  return app.getVersion();
});

// IPC: getScreenSources for desktopCapturer
ipcMain.handle('getScreenSources', async () => {
  return await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 1920, height: 1080 } // Increased thumbnail size for better quality
  });
});

// IPC: Send message from renderer to WebSocket server via main process
ipcMain.on('ws-message-to-main', (event, message) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(message);
  }
});
