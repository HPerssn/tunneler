import { RequestStorage } from "../storage.js";
import { RequestReplayer } from "../replay.js";
import { FileWatcher } from "../watch.js";

export async function watchCommand(args: string[]) {
    const idOrFlag = args[0];
    const dir = args.find(a => a === '--dir')
        ? args[args.indexOf('--dir') + 1]
        : './src';

    const storage = new RequestStorage('./requests.db');
    const localPort = parseInt(process.env.LOCAL_PORT || '8080');
    const replayer = new RequestReplayer(localPort);

    let requestsToWatch;

    if (idOrFlag === '--failed') {
        const allRequests = storage.getAllRequests(100);
        requestsToWatch = allRequests.filter(r =>
            r.response && r.response.statusCode >= 400
        );

        if (requestsToWatch.length === 0) {
            console.log('No failed requests found.');
            storage.close();
            process.exit(0);
        }

        console.log(`\nWatching ${requestsToWatch.length} failed requests(s):`);
        requestsToWatch.forEach(r => {
            console.log(`  ${r.id.slice(0, 8)} | ${r.method} ${r.path} [${r.response?.statusCode}]`);
        });
    } else {
        if (!idOrFlag) {
            console.error('Error: request-id or --failed flag required');
            console.log('Usage: npm run cli watch <request-id>');
            console.log('   or: npm run cli watch --failed');
            storage.close();
            process.exit(1);
        }
        const request = storage.getRequestByPrefix(idOrFlag);
        if (!request) {
            console.error(`Request ${idOrFlag} not found`);
            storage.close();
            process.exit(1);
        }

        requestsToWatch = [request];
        console.log(`\nWatching: ${request.method} ${request.path}`);
    }

    console.log(`Watching directory: ${dir}`);
    console.log('Waiting for file changes... (Ctrl+C to exit)\n');

    const watcher = new FileWatcher(dir, replayer, requestsToWatch);

    await watcher.start();

    // Keep process alive
    process.on('SIGINT', () => {
        console.log('\nStopping watcher...');
        watcher.stop();
        storage.close();
        process.exit(0);
    });
}
