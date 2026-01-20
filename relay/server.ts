import express, { Response, Request } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import crypto from 'crypto';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const tunnels = new Map<string, WebSocket>();

const pendingRequests = new Map<string, {
    res: express.Response;
    timeout: NodeJS.Timeout;
}>();

wss.on('connection', (ws: WebSocket) => {
    let tunnelId: string = '';
    console.log('New WebSocket connection');

    ws.on('message', (data: Buffer) => {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === 'register') {
                tunnelId = message.tunnelId || crypto.randomBytes(8).toString('hex');
                tunnels.set(tunnelId, ws);

                const publicUrl = `http://localhost:${PORT}/${tunnelId}`;

                ws.send(JSON.stringify({
                    type: 'registered',
                    tunnelId,
                    publicUrl
                }));

                console.log(`✓ Client registered: ${tunnelId}`);
                console.log(`  Public URL: ${publicUrl}`);
            }

            if (message.type === 'response') {
                const pending = pendingRequests.get(message.requestId);

                if (pending) {
                    clearTimeout(pending.timeout);
                    pendingRequests.delete(message.requestId);

                    if (!pending.res.headersSent) {
                        pending.res.status(message.statusCode || 200);

                        if (message.headers) {
                            Object.entries(message.headers).forEach(([key, value]) => {
                                pending.res.setHeader(key, value as string);
                            });
                        }

                        const body = message.body
                            ? Buffer.from(message.body, 'base64')
                            : '';

                        pending.res.send(body);
                        console.log(`✓ Response sent for request ${message.requestId.slice(0, 8)}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        if (tunnelId) {
            tunnels.delete(tunnelId);
            console.log(`✗ Client disconnected: ${tunnelId}`);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

app.use(express.raw({ type: '*/*', limit: '10mb' }));

app.get('/', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        activeTunnels: tunnels.size,
        pendingRequests: pendingRequests.size
    });
});

app.all('/:tunnelId/*', async (req: Request, res: Response) => {
    const { tunnelId } = req.params;
    const path = '/' + (req.params[0] || '');

    console.log(`→ Incoming ${req.method} ${path} for tunnel ${tunnelId}`);

    const tunnel = tunnels.get(tunnelId);

    if (!tunnel || tunnel.readyState !== WebSocket.OPEN) {
        console.log(`✗ Tunnel not connected: ${tunnelId}`);
        return res.status(502).json({ error: 'Tunnel not connected' });
    }

    const requestId = crypto.randomBytes(16).toString('hex');

    const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        if (!res.headersSent) {
            console.log(`✗ Tunnel timeout for request ${requestId.slice(0, 8)}`);
            res.status(504).json({ error: 'Tunnel timeout' });
        }
    }, 30000);

    pendingRequests.set(requestId, { res, timeout });

    try {
        tunnel.send(JSON.stringify({
            type: 'request',
            requestId,
            method: req.method,
            path,
            headers: req.headers,
            body: req.body ? req.body.toString('base64') : null,
            query: req.query
        }));

        console.log(`→ Forwarded to client: ${requestId.slice(0, 8)}`);
    } catch (error) {
        console.error('Error forwarding request:', error);
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        res.status(502).json({ error: 'Failed to forward request' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   ReplayTunnel Relay Server Running    ║
╚════════════════════════════════════════╝

Port: ${PORT}
WebSocket: ws://localhost:${PORT}
Health: http://localhost:${PORT}/

Waiting for clients to connect...
  `);
});
