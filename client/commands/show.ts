import { RequestStorage } from "../storage.js";
import { CapturedRequest } from "../tunnel.js";

export async function showCommand(args: string[]) {
    const id = args[0];

    if (!id) {
        console.error('Error: request id required');
        console.log('Usage: npm run cli show <request-id>');
        process.exit(1);
    }

    const storage = new RequestStorage('./requests.db');
    let request: CapturedRequest | null;

    try {
        request = storage.getRequestByPrefix(id);
    } catch (err: any) {
        console.error(err.message);
        storage.close();
        process.exit(1)
    }

    if (!request) {
        console.error(`Request ${id} not found`);
        storage.close();
        process.exit(1);
    }
    console.log(`
╔════════════════════════════════════════╗
║           Request Details              ║
╚════════════════════════════════════════╝

ID:        ${request.id}
Method:    ${request.method}
Path:      ${request.path}
Timestamp: ${request.timestamp.toLocaleString()}

Headers:
${Object.entries(request.headers).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

${request.body ? `Body:\n${Buffer.from(request.body, 'base64').toString().slice(0, 500)}` : 'No body'}

${request.response ? `
Response:
  Status: ${request.response.statusCode}
  Body size: ${Buffer.from(request.response.body, 'base64').length} bytes
` : 'No response captured'}
`);

    storage.close();
}
