import { spawn, ChildProcess } from 'child_process';
import fetch from 'node-fetch';
import { RequestStorage } from './storage.js';
import { createServer } from 'http';

class MinimalTests {
    private processes: ChildProcess[] = [];
    private httpServer: any = null;
    private tunnelUrl = '';
    private passed = 0;
    private failed = 0;

    async run() {
        console.log('🧪 ReplayTunnel Tests\n');

        try {
            await this.killPort(3000);
            await this.killPort(8080);
            await this.setup();
            await this.tests();
            this.results();
            process.exit(this.failed > 0 ? 1 : 0);
        } catch (error: any) {
            console.error('x', error.message);
            process.exit(1);
        } finally {
            this.cleanup();
        }
    }

    private async setup() {
        // Start relay
        const relay = spawn('tsx', ['../relay/server.ts'], {
            stdio: 'pipe',
            detached: true,
            env: { ...process.env, PORT: '3000' }
        });
        this.processes.push(relay);
        await this.waitFor(relay.stdout!, 'Waiting for clients');

        // Start test server
        this.httpServer = createServer((req, res) => {
            if (req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Hello World');
            } else if (req.url === '/error') {
                res.writeHead(500);
                res.end('Error');
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        await new Promise(resolve => this.httpServer.listen(8080, resolve));

        // Start tunnel
        const tunnel = spawn('npm', ['run', 'dev'], { stdio: 'pipe', shell: true, detached: true, });
        this.processes.push(tunnel);
        const output = await this.waitFor(tunnel.stdout!, 'Public URL:');
        this.tunnelUrl = output.match(/http:\/\/[^\s]+/)?.[0] || '';

        await this.wait(1000);
    }

    private async killPort(port: number): Promise<void> {
        return new Promise((resolve) => {
            const proc = spawn('lsof', ['-t', `-i:${port}`]);
            let output = '';
            proc.stdout?.on('data', d => output += d.toString());
            proc.on('exit', () => {
                const pids = output.trim().split('\n').filter(Boolean);
                pids.forEach(pid => {
                    try { process.kill(parseInt(pid), 'SIGTERM'); } catch (e) { }
                });
                resolve();
            });
        });
    }

    private async tests() {
        // Test 1: Capture request
        console.log('Test: Capture request...');
        const res1 = await fetch(this.tunnelUrl);
        const body1 = await res1.text();
        if (res1.status === 200 && body1 === 'Hello World') {
            this.pass();
        } else {
            this.fail('Wrong response');
        }

        await this.wait(500);

        // Test 2: Storage
        console.log('Test: Storage...');
        const storage = new RequestStorage('./requests.db');
        const requests = storage.getAllRequests(1);
        if (requests.length > 0 && requests[0].response?.statusCode === 200) {
            this.pass();
        } else {
            this.fail('Not stored');
        }
        const testId = requests[0]?.id.substring(0, 8);
        storage.close();

        // Test 3: Replay
        console.log('Test: Replay...');
        const replayOutput = await this.cli(['replay', testId]);
        if (replayOutput.includes('Replay complete') && replayOutput.includes('Same')) {
            this.pass();
        } else {
            this.fail('Replay mismatch');
        }

        // Test 4: Error capture
        console.log('Test: Error capture...');
        const res2 = await fetch(`${this.tunnelUrl}/error`);
        if (res2.status === 500) {
            this.pass();
        } else {
            this.fail('Error not captured');
        }

        await this.wait(500);

        // Test 5: Stats
        console.log('Test: Stats...');
        const statsOutput = await this.cli(['stats']);
        if (statsOutput.includes('Total') && statsOutput.includes('GET')) {
            this.pass();
        } else {
            this.fail('Stats broken');
        }
    }

    private async cli(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn('npm', ['run', 'cli', ...args], {
                stdio: 'pipe',
                shell: true
            });

            let output = '';
            proc.stdout?.on('data', d => output += d.toString());
            proc.on('exit', code => code === 0 ? resolve(output) : reject(new Error('CLI failed')));
            setTimeout(() => reject(new Error('Timeout')), 10000);
        });
    }

    private pass() {
        this.passed++;
        console.log('  ✅\n');
    }

    private fail(reason: string) {
        this.failed++;
        console.log(`  x ${reason}\n`);
    }

    private results() {
        console.log('─'.repeat(40));
        console.log(`${this.passed} passed, ${this.failed} failed`);
        console.log('─'.repeat(40) + '\n');
    }

    private cleanup() {
        this.processes.forEach(p => {
            try {
                process.kill(-p.pid!, 'SIGTERM');
            } catch (e) { }
        });
        this.httpServer?.close();
    }

    private waitFor(stream: NodeJS.ReadableStream, text: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let data = '';
            const onData = (chunk: Buffer) => {
                data += chunk.toString();
                if (data.includes(text)) {
                    stream.off('data', onData);
                    resolve(data);
                }
            };
            stream.on('data', onData);
            setTimeout(() => reject(new Error(`Timeout waiting for: ${text}`)), 10000);
        });
    }

    private wait(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

new MinimalTests().run();
