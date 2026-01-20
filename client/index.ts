import { TunnelClient } from './tunnel.js';

const relayUrl = process.env.RELAY_URL || 'ws://localhost:3000';
const localPort = parseInt(process.env.LOCAL_PORT || '8080');

const tunnel = new TunnelClient({
    relayUrl,
    localPort,
    onRequest: (req) => {
        console.log(`[CAPTURED] ${req.method} ${req.path} -> ${req.response?.statusCode}`);
    }
});

tunnel.connect()
    .then(() => {
        console.log('\nTunnel is running. Press Ctrl+C to exit.\n');
    })
    .catch(err => {
        console.error('Failed to connect:', err);
        process.exit(1);
    });

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    tunnel.disconnect();
    process.exit(0);
});
