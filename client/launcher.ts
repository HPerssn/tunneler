#!/usr/bin/env tsx

import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as readline from 'readline';

const COLORS = {
    relay: '\x1b[36m',
    tunnel: '\x1b[33m',
    server: '\x1b[32m',
    reset: '\x1b[0m'
};

class SimpleLauncher {
    private processes: ChildProcess[] = [];
    private cacheFile = process.cwd() + '/.replaytunnel.cache';

    async start() {
        console.log('Starting ReplayTunnel...\n');

        const serverCmd = await this.detectServerCommand();

        this.startRelay();
        await this.wait(1000);

        this.startServer(serverCmd);
        await this.wait(1000);

        this.startTunnel();

        console.log('\nAll services running. Press Ctrl+C to stop.\n');

        process.on('SIGINT', () => this.cleanup());
        await new Promise(() => { });
    }

    private async detectServerCommand(): Promise<string> {
        if (existsSync(this.cacheFile)) {
            const cached = readFileSync(this.cacheFile, 'utf-8').trim();
            if (cached) {
                console.log(`Using cached command: ${cached}\n`);
                return cached;
            }
        }

        const cmd = await this.ask('Command to start your server: ');
        this.saveCache(cmd);
        return cmd;
    }

    private saveCache(cmd: string) {
        writeFileSync(this.cacheFile, cmd);
    }

    private startRelay() {
        const proc = spawn('tsx', ['../relay/server.ts'], {
            stdio: 'pipe',
            detached: true,
            env: { ...process.env, PORT: '3000' }
        });

        this.processes.push(proc);
        proc.stdout?.on('data', d => console.log(`${COLORS.relay}[RELAY]${COLORS.reset} ${d.toString().trim()}`));
        proc.stderr?.on('data', d => console.error(`${COLORS.relay}[RELAY]${COLORS.reset} ${d.toString().trim()}`));
    }

    private startServer(command: string) {
        const [cmd, ...args] = command.split(' ');
        const proc = spawn(cmd, args, {
            stdio: 'pipe',
            detached: true,
            shell: true,
            cwd: process.cwd()
        });

        this.processes.push(proc);
        proc.stdout?.on('data', d => console.log(`${COLORS.server}[SERVER]${COLORS.reset} ${d.toString().trim()}`));
        proc.stderr?.on('data', d => console.log(`${COLORS.server}[SERVER]${COLORS.reset} ${d.toString().trim()}`));
    }

    private startTunnel() {
        const proc = spawn('npm', ['run', 'dev'], {
            stdio: 'pipe',
            detached: true,
            shell: true
        });

        this.processes.push(proc);
        proc.stdout?.on('data', d => console.log(`${COLORS.tunnel}[TUNNEL]${COLORS.reset} ${d.toString().trim()}`));
        proc.stderr?.on('data', d => console.error(`${COLORS.tunnel}[TUNNEL]${COLORS.reset} ${d.toString().trim()}`));
    }

    private cleanup() {
        console.log('\n\nShutting down...');
        this.processes.forEach(p => {
            try { process.kill(-p.pid!, 'SIGTERM'); } catch (e) { }
        });
        setTimeout(() => process.exit(0), 1000);
    }

    private ask(question: string): Promise<string> {
        return new Promise(resolve => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            process.stdout.write(question);

            rl.on('line', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }

    private wait(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

new SimpleLauncher().start();
