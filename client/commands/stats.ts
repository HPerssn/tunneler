import { RequestStorage } from '../storage.js';

export async function statsCommand(args: string[]) {
    const storage = new RequestStorage('./requests.db');
    const stats = storage.getStats();

    console.log(`
╔════════════════════════════════════════╗
║           Request Stats                ║
╚════════════════════════════════════════╝

Total requests: ${stats.total}

By method:
${Object.entries(stats.byMethod).map(([method, count]) => `  ${method.padEnd(8)}: ${count}`).join('\n')}

By status:
${Object.entries(stats.byStatus).map(([status, count]) => `  ${status.padEnd(8)}: ${count}`).join('\n')}
`);

    storage.close();
}
