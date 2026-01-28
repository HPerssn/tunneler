import chokidar, { FSWatcher } from 'chokidar';
import { RequestReplayer } from './replay.js';
import { CapturedRequest } from './tunnel.js';

export class FileWatcher {
    private watcher: FSWatcher | null = null;
    private replayer: RequestReplayer;
    private requests: CapturedRequest[];
    private dir: string;
    private isReplaying: boolean = false;
    private debounceTimeout: NodeJS.Timeout | null = null;

    constructor(dir: string, replayer: RequestReplayer, requests: CapturedRequest[]) {
        this.dir = dir;
        this.replayer = replayer;
        this.requests = requests;
    }

    async start() {
        this.watcher = chokidar.watch(this.dir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 100
            }
        });

        this.watcher
            .on('change', (path: string) => {
                console.log(`\nFile changed: ${path}`);
                this.scheduleReplay();
            })
            .on('error', (error) => {
                console.error(`Watcher error: ${error}`);
            });
    }

    private scheduleReplay() {
        // Debounce rapid file changes
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }

        this.debounceTimeout = setTimeout(() => {
            this.replayAll();
        }, 300);
    }

    private async replayAll() {
        if (this.isReplaying) return;

        this.isReplaying = true;

        console.log(`Replaying ${this.requests.length} request(s)...\n`);

        const results: Array<{
            request: CapturedRequest;
            success: boolean;
            statusCode?: number;
            changed?: boolean;
        }> = [];

        for (const request of this.requests) {
            try {
                const result = await this.replayer.replay(request);

                const originalStatus = request.response?.statusCode;
                const changed = originalStatus !== result.statusCode;
                const success = result.statusCode < 400;

                results.push({
                    request,
                    success,
                    statusCode: result.statusCode,
                    changed
                });

            } catch (error) {
                results.push({
                    request,
                    success: false
                });
            }
        }

        this.printResults(results);
        this.isReplaying = false;
    }

    private printResults(results: Array<{
        request: CapturedRequest;
        success: boolean;
        statusCode?: number;
        changed?: boolean;
    }>) {
        console.log('─'.repeat(80));

        results.forEach(({ request, success, statusCode, changed }) => {
            const statusIcon = success ? '✓' : '✗';
            const statusColor = success ? '\x1b[32m' : '\x1b[31m';
            const reset = '\x1b[0m';
            const changeIcon = changed ? '📍' : '  ';

            const originalStatus = request.response?.statusCode || '---';
            const newStatus = statusCode || '---';

            console.log(
                `${changeIcon} ${statusColor}${statusIcon}${reset} ` +
                `${request.method.padEnd(6)} ${request.path.padEnd(35)} ` +
                `${originalStatus} → ${newStatus}`
            );
        });

        console.log('─'.repeat(80));

        const passCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        const changedCount = results.filter(r => r.changed).length;

        console.log(`\n${passCount} passed | ${failCount} failed | ${changedCount} changed\n`);
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
        }
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
    }
}
