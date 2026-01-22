#!/usr/bin/env node

/**
 * Check for eslint-disable comments without descriptions
 * This mimics the Obsidian bot's check for undescribed directives
 * 
 * All eslint-disable comments must include descriptions using -- syntax:
 * // eslint-disable-next-line rule-name -- reason for disabling
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, sep } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Pattern to check if a disable comment has a description
// Matches: -- followed by any text
const hasDescriptionPattern = /--\s+.+/;

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
				// Check if it has a description (-- followed by text)
				if (!hasDescriptionPattern.test(line)) {
					// Check if description is on previous line
					const prevLine = index > 0 ? lines[index - 1] : '';
					const hasDescriptionOnPrevLine = prevLine.trim().startsWith('//') && 
						(hasDescriptionPattern.test(prevLine) || 
						 prevLine.includes('reason:') || 
						 prevLine.toLowerCase().includes('reason'));

					if (!hasDescriptionOnPrevLine) {
						errors.push({
							file: relativePath,
							line: index + 1,
							content: line.trim()
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
	console.error('\n❌ Found eslint-disable comments without descriptions:\n');
	errors.forEach(({ file, line, content }) => {
		console.error(`  ${file}:${line}`);
		console.error(`    ${content}\n`);
	});
	console.error('All eslint-disable comments must include descriptions using -- syntax');
	console.error('Example: // eslint-disable-next-line rule-name -- reason for disabling\n');
	process.exit(1);
} else {
	console.log('✓ All eslint-disable comments have descriptions');
	process.exit(0);
}
