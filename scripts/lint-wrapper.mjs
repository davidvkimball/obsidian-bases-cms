#!/usr/bin/env node

/**
 * ESLint wrapper that adds helpful success messages
 * Also checks for undescribed eslint-disable comments (mimics Obsidian bot)
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const hasFix = args.includes('--fix');

// First, check for undescribed eslint-disable comments (mimics Obsidian bot)
try {
	execSync('node scripts/check-disable-comments.mjs', { 
		stdio: 'inherit', 
		shell: true,
		cwd: join(__dirname, '..')
	});
} catch (error) {
	// Script will have already printed the error
	process.exit(1);
}

// Check for attempts to disable non-disablable rules (mimics Obsidian bot)
try {
	execSync('node scripts/check-disallowed-disables.mjs', { 
		stdio: 'inherit', 
		shell: true,
		cwd: join(__dirname, '..')
	});
} catch (error) {
	// Script will have already printed the error
	process.exit(1);
}

// Detect which package manager to use
// Check if pnpm is available, otherwise fall back to npx
let usePnpm = false;
try {
	execSync('pnpm --version', { stdio: 'ignore', shell: true });
	usePnpm = true;
} catch (error) {
	usePnpm = false;
}

// Run ESLint with --max-warnings 0 to fail on warnings too
// This ensures we only show success when there are truly no issues
const eslintArgs = ['eslint', '.', '--max-warnings', '0', ...args];
const command = usePnpm ? 'pnpm' : 'npx';
const commandArgs = usePnpm ? ['exec', ...eslintArgs] : eslintArgs;

const eslint = spawn(command, commandArgs, {
	stdio: 'inherit',
	shell: true
});

eslint.on('close', (code) => {
	// Only show success message if exit code is exactly 0 (no errors or warnings)
	if (code === 0) {
		const message = hasFix 
			? '\n✓ Linting complete! All issues fixed automatically.\n'
			: '\n✓ Linting passed! No issues found.\n';
		console.log(message);
		process.exit(0);
	} else {
		// ESLint already printed errors/warnings, exit with the code
		// Don't show any success message
		process.exit(code || 1);
	}
});

eslint.on('error', (error) => {
	console.error('Error running ESLint:', error);
	process.exit(1);
});
