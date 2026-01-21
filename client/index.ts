import { TunnelClient } from './tunnel.js';
import { RequestStorage } from './storage.js';

const relayUrl = process.env.RELAY_URL || 'ws://localhost:3000';
const localPort = parseInt(process.env.LOCAL_PORT || '8080');

const storage = new RequestStorage('./requests.db');

console.log('Request stats:', storage.getStats());
console.log('')

const tunnel = new TunnelClient({
    relayUrl,
    localPort,
    onRequest: (req) => {
        storage.saveRequest(req);
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
    console.log('\n\n Final stats:', storage.getStats())
    console.log('\nShutting down...');
    storage.close()
    tunnel.disconnect();
    process.exit(0);
});
