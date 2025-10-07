# Vibe Remote Desktop

A secure remote desktop application built with Electron, React, and WebRTC.

## Features

- **Host-Client Architecture**: Create sessions as a host or join existing sessions as a client
- **Real-time Screen Sharing**: WebRTC-based screen sharing with low latency
- **Remote Control**: Full remote control capabilities using nut-js
- **Session Management**: Secure session codes for easy connection
- **Cross-platform**: Windows and macOS support

## Project Structure

```
vibe/
├── main/                 # Electron main process
│   └── main.js          # Main application logic and IPC handlers
├── preload/             # Electron preload scripts
│   └── preload.js       # Secure context bridge
├── renderer/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── pages/       # Application pages
│   │   └── utils/       # Utility functions
│   └── dist/           # Built frontend assets
├── backend-server/      # WebSocket signaling server
│   └── server.js       # Session management server
└── package.json        # Project configuration and scripts
```

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or pnpm

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development servers:**
   ```bash
   npm run dev
   ```

   This will start:
   - React development server on `http://localhost:5173`
   - Electron application in development mode

3. **Backend server:**
   The WebSocket signaling server runs on port 8080 and is used for session management.

## Building

### Build for current platform:
```bash
npm run build
```

### Build for Windows:
```bash
npm run build:win
```

### Build for macOS:
```bash
npm run build:mac
```

### Build for all platforms:
```bash
npm run build:all
```

## Architecture

### Components

- **WebSocket Server**: Manages session creation, client approval, and signaling
- **WebRTC**: Handles peer-to-peer video streaming and data channels
- **Electron Main**: Coordinates screen capture, remote input, and window management
- **React Frontend**: Provides user interface for session management
- **nut-js**: Enables remote control functionality (mouse, keyboard, screen)

### Session Flow

1. **Host creates session** → WebSocket server generates session code
2. **Client joins session** → Requests approval from host
3. **Host approves client** → WebRTC peer connection established
4. **Screen sharing begins** → Host streams screen to client
5. **Remote control active** → Client can control host machine

## Configuration

The application uses the following default ports:
- **Frontend**: 5173 (development)
- **WebSocket Server**: 8080
- **WebRTC**: Dynamic peer-to-peer connections

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**: Check if port 8080 is available
2. **Screen sharing not working**: Ensure proper permissions for screen capture
3. **Remote control not responding**: Verify nut-js installation and permissions

### Logs

Application logs are saved to the user data directory for debugging.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - see LICENSE file for details.
