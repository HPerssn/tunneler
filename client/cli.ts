import { listCommand } from './commands/list.js';
import { showCommand } from './commands/show.js';
import { replayCommand } from './commands/replay.js';
import { watchCommand } from './commands/watch.js';
import { statsCommand } from './commands/stats.js';
import { clearCommand } from './commands/clear.js';
import { showHelp } from './commands/help.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
    if (!command) {
        showHelp();
        process.exit(0);
    }

    switch (command) {
        case 'list':
            await listCommand(args.slice(1));
            break;
        case 'show':
            await showCommand(args.slice(1));
            break;
        case 'replay':
            await replayCommand(args.slice(1));
            break;
        case 'watch':
            await watchCommand(args.slice(1));
            break;
        case 'stats':
            await statsCommand(args.slice(1));
            break;
        case 'clear':
            await clearCommand(args.slice(1));
        default:
            console.error(`Unkown command: ${command}`);
            showHelp();
            process.exit(1);
    }
}

main().catch(err => {
    console.error('error:', err);
    process.exit(1);
});
