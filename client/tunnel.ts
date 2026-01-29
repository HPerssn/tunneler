import WebSocket from 'ws';
import fetch from 'node-fetch';

interface TunnelConfig {
    relayUrl: string;
    localPort: number;
    tunnelId?: string;
    onRequest?: (request: CapturedRequest) => void;
}

export interface CapturedRequest {
    id: string;
    timestamp: Date;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string | null;
    query: Record<string, any>;
    response?: {
        statusCode: number;
        headers: Record<string, string>;
        body: string;
    };
}

interface IncomingRequest {
    type: 'request';
    requestId: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string | null;
    query: Record<string, any>;
}

export class TunnelClient {
    private ws: WebSocket | null = null;
    private config: TunnelConfig;
    private publicUrl: string = '';
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(config: TunnelConfig) {
        this.config = config;
    }

    async connect(): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log(`Connecting to relay: ${this.config.relayUrl}`);
            this.ws = new WebSocket(this.config.relayUrl);

            this.ws.on('open', () => {
                console.log('✓ Connected to relay server');

                this.ws?.send(JSON.stringify({
                    type: 'register',
                    tunnelId: this.config.tunnelId
                }));
            });

            this.ws.on('message', async (data: Buffer) => {
                const message = JSON.parse(data.toString());

                if (message.type === 'registered') {
                    this.publicUrl = message.publicUrl;
                    console.log(`✓ Tunnel registered!`);
                    console.log(`  Tunnel ID: ${message.tunnelId}`);
                    console.log(`  Public URL: ${this.publicUrl}`);
                    console.log(`  Forwarding to: http://localhost:${this.config.localPort}`);
                    console.log('');
                    resolve(this.publicUrl);
                }

                if (message.type === 'request') {
                    await this.handleRequest(message);
                }
            });

            this.ws.on('error', (error) => {
                console.error('✗ WebSocket error:', error.message);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('✗ Disconnected from relay server');
                this.attemptReconnect();
            });
        });
    }

    private async handleRequest(request: IncomingRequest) {
        const startTime = Date.now();
        console.log(`→ ${request.method} ${request.path}`);

        const capturedRequest: CapturedRequest = {
            id: request.requestId,
            timestamp: new Date(),
            method: request.method,
            path: request.path,
            headers: request.headers,
            body: request.body,
            query: request.query
        };

        try {
            const url = `http://localhost:${this.config.localPort}${request.path}`;

            const body = request.body
                ? Buffer.from(request.body, 'base64')
                : undefined;

            const response = await fetch(url, {
                method: request.method,
                headers: this.cleanHeaders(request.headers),
                body: request.method !== 'GET' && request.method !== 'HEAD' ? body : undefined
            });

            const responseBody = await response.arrayBuffer();
            const responseBodyBase64 = Buffer.from(responseBody).toString('base64')
            const duration = Date.now() - startTime;

            capturedRequest.response = {
                statusCode: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBodyBase64
            };

            if (this.config.onRequest) {
                this.config.onRequest(capturedRequest);
            }

            this.ws?.send(JSON.stringify({
                type: 'response',
                requestId: request.requestId,
                statusCode: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBodyBase64
            }));

            console.log(`← ${response.status} (${duration}ms)`);

        } catch (error: any) {
            console.error(`✗ Error forwarding request:`, error.message);

            this.ws?.send(JSON.stringify({
                type: 'response',
                requestId: request.requestId,
                statusCode: 502,
                headers: { 'content-type': 'text/plain' },
                body: Buffer.from(`Error: ${error.message}`).toString('base64')
            }));
        }
    }

    private cleanHeaders(headers: Record<string, string>): Record<string, string> {
        const cleaned = { ...headers };
        delete cleaned.host;
        delete cleaned['content-length'];
        delete cleaned.connection;
        return cleaned;
    }

    private attemptReconnect() {
        if (this.reconnectTimeout) return;

        console.log('Attempting to reconnect in 5 seconds...');
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect().catch(() => {
                // Will attempt again if it fails
            });
        }, 5000);
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.ws?.close();
    }

    getPublicUrl(): string {
        return this.publicUrl;
    }
}
