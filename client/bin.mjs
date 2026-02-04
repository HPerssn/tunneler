#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];

// No command = interactive launcher
if (!command || command === 'start') {
    const launcher = spawn('npx', ['tsx', join(__dirname, 'launcher.ts')], {
        stdio: 'inherit',
        cwd: __dirname,
        shell: true
    });

    launcher.on('exit', (code) => process.exit(code || 0));
}
// Direct command = run CLI command
else {
    const cli = spawn('npx', ['tsx', join(__dirname, 'cli.ts'), ...args], {
        stdio: 'inherit',
        cwd: __dirname,
        shell: true
    });

    cli.on('exit', (code) => process.exit(code || 0));
}
