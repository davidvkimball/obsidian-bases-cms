#!/usr/bin/env node

/**
 * Check for attempts to disable non-disablable rules
 * The Obsidian bot prevents disabling these rules:
 * - obsidianmd/no-static-styles-assignment
 * - @typescript-eslint/no-explicit-any
 * - obsidianmd/ui/sentence-case
 * 
 * These rules cannot be disabled - the underlying issue must be fixed instead.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, sep } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Rules that cannot be disabled (Obsidian bot requirement)
const DISALLOWED_RULES = [
	'obsidianmd/no-static-styles-assignment',
	'@typescript-eslint/no-explicit-any',
	'obsidianmd/ui/sentence-case'
];

let hasErrors = false;
const errors = [];

// Recursively find all TypeScript files
function findTsFiles(dir, fileList = []) {
	if (!existsSync(dir)) {
		return fileList;
	}

	try {
		const files = readdirSync(dir);
		for (const file of files) {
			const filePath = join(dir, file);
			try {
				const stat = statSync(filePath);
				if (stat.isDirectory() && file !== 'node_modules' && file !== '.ref' && !file.startsWith('.')) {
					findTsFiles(filePath, fileList);
				} else if (file.endsWith('.ts')) {
					fileList.push(filePath);
				}
			} catch (err) {
				// Skip files we can't read (permissions, etc.)
				continue;
			}
		}
	} catch (err) {
		// Skip directories we can't read
		return fileList;
	}
	return fileList;
}

// Find src directory (standard location)
const srcDir = join(projectRoot, 'src');
const files = existsSync(srcDir) ? findTsFiles(srcDir) : [];

if (files.length === 0) {
	// No TypeScript files found - that's okay, just exit
	process.exit(0);
}

for (const filePath of files) {
	try {
		const content = readFileSync(filePath, 'utf-8');
		const lines = content.split('\n');
		
		// Normalize path for display (handle both Windows and Unix paths)
		const relativePath = filePath
			.replace(projectRoot + sep, '')
			.replace(projectRoot + '/', '')
			.replace(/\\/g, '/'); // Normalize to forward slashes for display

		// Check each line for eslint-disable comments
		lines.forEach((line, index) => {
			if (line.includes('eslint-disable')) {
				// Check if any disallowed rules are being disabled
				for (const rule of DISALLOWED_RULES) {
					// Match the rule name (could be in a comma-separated list)
					const rulePattern = new RegExp(`(?:^|[, ])${rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[, ]|$)`);
					if (rulePattern.test(line)) {
						errors.push({
							file: relativePath,
							line: index + 1,
							content: line.trim(),
							rule: rule
						});
						hasErrors = true;
					}
				}
			}
		});
	} catch (err) {
		// Skip files we can't read
		continue;
	}
}

if (hasErrors) {
	console.error('\n❌ Found attempts to disable non-disablable rules:\n');
	errors.forEach(({ file, line, content, rule }) => {
		console.error(`  ${file}:${line}`);
		console.error(`    ${content}`);
		console.error(`    Rule "${rule}" cannot be disabled - fix the underlying issue instead\n`);
	});
	console.error('The Obsidian bot prevents disabling these rules:');
	DISALLOWED_RULES.forEach(rule => {
		console.error(`  - ${rule}`);
	});
	console.error('\nSee .agent/skills/obsidian-ref/references/obsidian-bot-requirements.md for how to fix these issues.\n');
	process.exit(1);
} else {
	// Only print success if we actually checked files
	if (files.length > 0) {
		console.log('✓ No attempts to disable non-disablable rules');
	}
	process.exit(0);
}
