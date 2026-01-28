import { RequestStorage } from "../storage.js";

export async function listCommand(args: string[]) {
    const storage = new RequestStorage('./requests.db');

    const statusFilter = args.find(a => a === '--status')
        ? parseInt(args[args.indexOf('--status') + 1])
        : undefined;
    const methodFilter = args.find(a => a === '--method')
        ? args[args.indexOf('--method') + 1]
        : undefined;

    let requests = storage.getAllRequests(100);

    if (statusFilter) {
        requests = requests.filter(r => r.response?.statusCode === statusFilter);
    }

    if (methodFilter) {
        requests = requests.filter(r => r.method === methodFilter)
    }

    if (requests.length === 0) {
        console.log('No requests found.');
        storage.close();
        return;
    }
    console.log(`\nFound ${requests.length} requests(s):\n`);

    requests.forEach(req => {
        const statusColor = req.response?.statusCode && req.response.statusCode < 300 ? '\x1b[32m' :
            req.response?.statusCode && req.response.statusCode < 400 ? '\x1b[33m' : '\x1b[31m';
        const reset = '\x1b[0m';
        const status = req.response ? `${statusColor}[${req.response.statusCode}]${reset}` : '[no response]';

        console.log(`  ${req.id.slice(0, 8)} | ${req.method.padEnd(6)} | ${req.path.padEnd(30)} | ${status} | ${req.timestamp.toLocaleString()}`);
    });

    console.log('')
    storage.close();
}
