import fetch from 'node-fetch';
import { CapturedRequest } from './tunnel.js';

export class RequestReplayer {
    private localPort: number;

    constructor(localPort: number) {
        this.localPort = localPort;
    }

    async replay(request: CapturedRequest): Promise<{
        statusCode: number;
        headers: Record<string, string>;
        body: string;
    }> {
        const url = `http://localhost:${this.localPort}${request.path}`;

        console.log(`\nReplaying: ${request.method} ${request.path}`);

        const body = request.body
            ? Buffer.from(request.body, 'base64')
            : undefined;

        try {
            const response = await fetch(url, {
                method: request.method,
                headers: this.cleanHeaders(request.headers),
                body: request.method !== 'GET' && request.method !== 'HEAD' ? body : undefined
            });

            const responseBody = Buffer.from(await response.arrayBuffer());

            const result = {
                statusCode: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseBody.toString('base64')
            };

            console.log(`✓ Replay complete: ${response.status}`);

            // Show comparison if we have original response
            if (request.response) {
                const statusMatch = request.response.statusCode === result.statusCode;
                const bodyMatch = request.response.body === result.body;

                console.log(`  Status: ${request.response.statusCode} -> ${result.statusCode} ${statusMatch ? '✓' : '✗'}`);
                console.log(`  Body: ${bodyMatch ? 'Same ✓' : 'Different ✗'}`);
            }

            return result;
        } catch (error: any) {
            console.error(`✗ Replay failed: ${error.message}`);
            throw error;
        }
    }

    private cleanHeaders(headers: Record<string, string>): Record<string, string> {
        const cleaned = { ...headers };
        delete cleaned.host;
        delete cleaned['content-length'];
        delete cleaned.connection;
        return cleaned;
    }
}
