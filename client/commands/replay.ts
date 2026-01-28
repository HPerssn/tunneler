import { RequestStorage } from "../storage.js";
import { RequestReplayer } from '../replay.js';
import { CapturedRequest } from "../tunnel.js";

export async function replayCommand(args: string[]) {
    const id = args[0];

    if (!id) {
        console.error('Error: request-id required');
        console.log('Usage: npm run cli replay <request-id>');
        process.exit(1);
    }

    const storage = new RequestStorage('./requests.db');
    let request: CapturedRequest | null;

    try {
        request = storage.getRequestByPrefix(id);
    } catch (err: any) {
        console.error(err.message);
        storage.close();
        process.exit(1);
    }

    if (!request) {
        console.error(`Request ${id} not found`);
        storage.close();
        process.exit();
    }

    const localPort = parseInt(process.env.LOCAL_port || '8080');
    const replayer = new RequestReplayer(localPort);

    console.log(`\nReplaying: ${request.method} ${request.path}`);

    try {
        const result = await replayer.replay(request);

        if (request.response) {
            const statusMatch = request.response.statusCode === result.statusCode;
            const bodyMatch = request.response.body === result.body;

            console.log(`nComparison:`);
            console.log(`  Original: ${request.response.statusCode} | New: ${result.statusCode} ${statusMatch ? '✓' : '✗'}`);
            console.log(`  Body:     ${bodyMatch ? 'Same ✓' : 'Different ✗'}`);
        }
        storage.close();
    } catch (error: any) {
        console.error(`Replay failed: ${error.message}`);
        storage.close();
        process.exit(1);
    }
}
