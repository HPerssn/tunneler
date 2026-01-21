# ReplayTunnel

Custom HTTP tunnel with request capture and replay. Expose localhost to the internet and save all requests for later replay.

## Quick Start

### 1. Start Relay Server
```bash
cd relay
npm install
npm run dev
```

### 2. Start Local Server (what you're testing)
```bash
python3 -m http.server 8080
# or any server on port 8080
```

### 3. Start Tunnel Client
```bash
cd client
npm install
npm run dev
```

### 4. Test It
```bash
# Use the public URL from step 3
curl http://localhost:3000/{TUNNEL_ID}/
```

## Project Structure

```
relay-tunnel/
├── relay/          # Relay server (deploy to VPS)
│   └── server.ts
└── client/         # Local client (run on your machine)
    └── tunnel.ts
```

## How It Works

```
Internet → Relay Server (VPS) → WebSocket → Local Client → localhost:8080
```

## Roadmap

- [x] Custom tunnel
- [x] Request/response forwarding
- [x] SQLite storage (capture all requests)
- [ ] TUI interface
- [ ] Request replay
- [ ] Export as curl

## Environment Variables

**Relay:**
- `PORT` - Server port (default: 3000)

**Client:**
- `RELAY_URL` - Relay WebSocket URL (default: ws://localhost:3000)
- `LOCAL_PORT` - Local server port (default: 8080)
