// main/main.js
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
// Correct the require statement to use the 'nut-js' package
const { mouse, keyboard, screen, Button, Key, Point } = require("@nut-tree-fork/nut-js");

// Simple Logger utility for file logging
class Logger {
  constructor() {
    this.logFile = path.join(app.getPath('userData'), 'vibe-remote-desktop.log');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB max log size

    // Clean log file if it's too large
    this.cleanLogFile();
  }

  cleanLogFile() {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxLogSize) {
          // Keep only the last 1MB of logs
          const content = fs.readFileSync(this.logFile, 'utf8');
          const lines = content.split('\n');
          const recentLines = lines.slice(-1000); // Keep last 1000 lines
          fs.writeFileSync(this.logFile, recentLines.join('\n'));
        }
      }
    } catch (error) {
      console.error('Failed to clean log file:', error);
    }
  }

  formatMessage(level, emoji, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${emoji} ${message}`;
  }

  write(level, emoji, message) {
    const formattedMessage = this.formatMessage(level, emoji, message);

    // Write to file
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
    }

    // Also write to console
    console.log(formattedMessage);
  }

  info(emoji, message) { this.write('INFO', emoji, message); }
  error(emoji, message) { this.write('ERROR', emoji, message); }
  warn(emoji, message) { this.write('WARN', emoji, message); }
  debug(emoji, message) { this.write('DEBUG', emoji, message); }
}

// Initialize logger
const logger = new Logger();

logger.info("🔧", "Initializing nut-js modules...");
logger.info("🖱️", `Mouse module: ${typeof mouse}`);
logger.info("⌨️", `Keyboard module: ${typeof keyboard}`);
logger.info("📺", `Screen module: ${typeof screen}`);
logger.info("🔘", `Button module: ${typeof Button}`);
logger.info("🔑", `Key module: ${typeof Key}`);
logger.info("📍", `Point module: ${typeof Point}`);

let mainWindow;

// --- nut.js Key Mapping Helper ---
// This maps web event.key values to nut.js Key enum values
function getNutKey(key) {
    const keyMap = {
        "Enter": Key.Enter, "Backspace": Key.Backspace, "Tab": Key.Tab,
        "Escape": Key.Escape, "ArrowUp": Key.Up, "ArrowDown": Key.Down,
        "ArrowLeft": Key.Left, "ArrowRight": Key.Right, "Home": Key.Home,
        "End": Key.End, "PageUp": Key.PageUp, "PageDown": Key.PageDown,
        "Insert": Key.Insert, "Delete": Key.Delete, "F1": Key.F1, "F2": Key.F2,
        "F3": Key.F3, "F4": Key.F4, "F5": Key.F5, "F6": Key.F6, "F7": Key.F7,
        "F8": Key.F8, "F9": Key.F9, "F10": Key.F10, "F11": Key.F11, "F12": Key.F12,
        "Control": Key.LeftControl, "Alt": Key.LeftAlt, "Shift": Key.LeftShift,
        "Meta": Key.LeftSuper, // Command key on macOS, Windows key on Windows
        " ": Key.Space,
    };
    if (keyMap[key]) {
        return keyMap[key];
    }
    // For single characters, nut.js can typically take the character itself
    if (key.length === 1) {
        return key;
    }
    console.warn(`Unmapped key: '${key}'. Attempting to pass directly.`);
    return key; // Fallback
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      // sandbox must be false for nut-js to control the OS
      sandbox: false, 
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

// IPC: Test handler to verify IPC communication
ipcMain.on('test-ipc', (event, data) => {
  logger.info("🧪", `Test IPC received: ${JSON.stringify(data)}`);
  event.reply('test-ipc-reply', { success: true, timestamp: Date.now() });
});

// IPC: Get log file path
ipcMain.handle('get-log-file-path', () => {
  logger.info("📄", "Log file path requested");
  return logger.logFile;
});

// IPC: Read log file content
ipcMain.handle('read-log-file', async () => {
  try {
    logger.info("📄", "Log file content requested");
    if (fs.existsSync(logger.logFile)) {
      const content = fs.readFileSync(logger.logFile, 'utf8');
      return { success: true, content };
    } else {
      return { success: false, error: 'Log file does not exist' };
    }
  } catch (error) {
    logger.error("❌", `Failed to read log file: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// IPC: getScreenSources for desktopCapturer
ipcMain.handle('getScreenSources', async () => {
  return await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });
});

// WebSocket functionality moved to React frontend

// IPC: Handle remote input events using nut.js
ipcMain.on('handle-input-event', async (event, inputEvent) => {
    logger.info("🎯", "IPC handler called for input event");
    logger.debug("🎯", `Event object: ${JSON.stringify(event)}`);
    logger.debug("🎯", `Input event data: ${JSON.stringify(inputEvent)}`);

    try {
        logger.info("🔄", `Received remote input event: ${inputEvent.type}`);

        // Check if nut-js is available
        if (!mouse || !keyboard || !screen) {
            logger.error("❌", "nut-js modules not available");
            logger.error("❌", `Available modules: ${JSON.stringify({ mouse: !!mouse, keyboard: !!keyboard, screen: !!screen })}`);
            return;
        }

        // Get screen size using Electron's screen module instead of nut-js
        const electronScreen = require('electron').screen;
        const primaryDisplay = electronScreen.getPrimaryDisplay();
        const screenSize = primaryDisplay.workAreaSize;
        logger.info("📺", `Screen size: ${screenSize.width}x${screenSize.height}`);

        keyboard.config.autoDelayMs = 0; // For faster key presses

        // Validate coordinates
        if (inputEvent.x < 0 || inputEvent.x > 1 || inputEvent.y < 0 || inputEvent.y > 1) {
            logger.warn('⚠️', `Received out-of-bounds mouse coordinates: ${inputEvent.x}, ${inputEvent.y}`);
            return;
        }

        const scaledX = Math.round(inputEvent.x * screenSize.width);
        const scaledY = Math.round(inputEvent.y * screenSize.height);
        logger.info("🖱️", `Scaled coordinates: (${scaledX}, ${scaledY})`);

        switch(inputEvent.type) {
            case 'mousemove':
                logger.info("🖱️", `Moving mouse to: (${scaledX}, ${scaledY})`);
                try {
                    // Try direct positioning first
                    await mouse.setPosition(new Point(scaledX, scaledY));
                    logger.info("✅", "Mouse moved successfully with setPosition");
                } catch (moveError) {
                    logger.error("❌", `setPosition failed: ${moveError.message}`);
                    try {
                        // Fallback to move method
                        await mouse.move([new Point(scaledX, scaledY)]);
                        logger.info("✅", "Mouse moved successfully with move method");
                    } catch (moveError2) {
                        logger.error("❌", `move method also failed: ${moveError2.message}`);
                        // Final fallback: try relative movement
                        try {
                            const currentPos = await mouse.getPosition();
                            const deltaX = scaledX - currentPos.x;
                            const deltaY = scaledY - currentPos.y;
                            await mouse.move([new Point(deltaX, deltaY)]);
                            logger.info("✅", "Mouse moved relatively successfully");
                        } catch (relativeError) {
                            logger.error("❌", `All mouse movement methods failed: ${relativeError.message}`);
                        }
                    }
                }
                break;
            case 'mousedown':
                const buttonDown = inputEvent.button === 'left' ? Button.LEFT : inputEvent.button === 'middle' ? Button.MIDDLE : Button.RIGHT;
                logger.info("🖱️", `Pressing button: ${inputEvent.button}`);
                try {
                    await mouse.pressButton(buttonDown);
                    logger.info("✅", "Button pressed successfully");
                } catch (btnError) {
                    logger.error("❌", `Button press failed: ${btnError.message}`);
                }
                break;
            case 'mouseup':
                const buttonUp = inputEvent.button === 'left' ? Button.LEFT : inputEvent.button === 'middle' ? Button.MIDDLE : Button.RIGHT;
                logger.info("🖱️", `Releasing button: ${inputEvent.button}`);
                try {
                    await mouse.releaseButton(buttonUp);
                    logger.info("✅", "Button released successfully");
                } catch (btnError) {
                    logger.error("❌", `Button release failed: ${btnError.message}`);
                }
                break;
            case 'keydown':
                const keyToPress = getNutKey(inputEvent.key);
                logger.info("⌨️", `Pressing key: ${inputEvent.key} -> ${keyToPress}`);
                if (keyToPress) {
                    try {
                        await keyboard.pressKey(keyToPress);
                        logger.info("✅", "Key pressed successfully");
                    } catch (keyError) {
                        logger.error("❌", `Key press failed: ${keyError.message}`);
                    }
                } else {
                    logger.warn("⚠️", `Could not map key: ${inputEvent.key}`);
                }
                break;
            case 'keyup':
                const keyToRelease = getNutKey(inputEvent.key);
                logger.info("⌨️", `Releasing key: ${inputEvent.key} -> ${keyToRelease}`);
                if (keyToRelease) {
                    try {
                        await keyboard.releaseKey(keyToRelease);
                        logger.info("✅", "Key released successfully");
                    } catch (keyError) {
                        logger.error("❌", `Key release failed: ${keyError.message}`);
                    }
                } else {
                    logger.warn("⚠️", `Could not map key: ${inputEvent.key}`);
                }
                break;
            case 'scroll':
                logger.info("🖱️", `Scrolling: ${inputEvent.deltaY}`);
                if (typeof inputEvent.deltaY === 'number') {
                    try {
                        if (inputEvent.deltaY > 0) {
                            await mouse.scrollDown(5);
                            logger.info("✅", "Scrolled down successfully");
                        } else {
                            await mouse.scrollUp(5);
                            logger.info("✅", "Scrolled up successfully");
                        }
                    } catch (scrollError) {
                        logger.error("❌", `Scroll failed: ${scrollError.message}`);
                    }
                }
                break;
            default:
                logger.warn("⚠️", `Unknown input event type: ${inputEvent.type}`);
        }
    } catch (e) {
        logger.error("❌", `Error executing remote input via nut.js: ${e.message}`);
        logger.error("❌", `Stack trace: ${e.stack}`);
    }
});
