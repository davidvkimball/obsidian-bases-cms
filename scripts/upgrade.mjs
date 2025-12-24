#!/usr/bin/env node

/**
 * Comprehensive project upgrade script
 * 
 * This script upgrades an existing plugin to match the template standards:
 * 1. Detects and converts npm projects to pnpm (if needed)
 * 2. Upgrades package.json (adds type: module, fixes scripts, standardizes versions, etc.)
 * 3. Upgrades lint-wrapper.mjs (flexible pnpm/npx detection)
 * 
 * Usage:
 *   pnpm run upgrade [project-directory]
 *   or
 *   node scripts/upgrade.mjs [project-directory]
 * 
 * If no directory is provided, uses current directory.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import process from 'process';

// Standard versions from template (devDependencies only)
const STANDARD_VERSIONS = {
	"@eslint/js": "^9.30.1",
	"@eslint/json": "^0.14.0",
	"@types/node": "^16.11.6",
	"@typescript-eslint/eslint-plugin": "^8.33.1",
	"@typescript-eslint/parser": "^8.33.1",
	"esbuild": "0.25.5",
	"eslint": "^9.39.1",
	"eslint-plugin-obsidianmd": "0.1.9",
	"globals": "14.0.0",
	"tslib": "2.4.0",
	"typescript": "5.8.3",
	"typescript-eslint": "8.35.1",
	"jiti": "2.6.1"
};

const packageManagerVersion = 'pnpm@10.20.0';
const preinstallScript = 'node scripts/npm-proxy.mjs';

const FLEXIBLE_LINT_WRAPPER = `#!/usr/bin/env node

/**
 * ESLint wrapper that adds helpful success messages
 */

import { spawn, execSync } from 'child_process';
import process from 'process';

const args = process.argv.slice(2);
const hasFix = args.includes('--fix');

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
			? '\\n✓ Linting complete! All issues fixed automatically.\\n'
			: '\\n✓ Linting passed! No issues found.\\n';
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
`;

function detectNpmProject(projectDir) {
	const packageJsonPath = join(projectDir, 'package.json');
	const packageLockPath = join(projectDir, 'package-lock.json');
	
	if (!existsSync(packageJsonPath)) {
		return { isNpm: false, reason: 'No package.json found' };
	}
	
	try {
		const content = readFileSync(packageJsonPath, 'utf8');
		const packageJson = JSON.parse(content);
		
		// Check if already using pnpm
		if (packageJson.packageManager && packageJson.packageManager.includes('pnpm')) {
			return { isNpm: false, reason: 'Already using pnpm' };
		}
		
		// Check for package-lock.json (strong indicator of npm)
		const hasPackageLock = existsSync(packageLockPath);
		
		// Determine if this is an npm project
		const isNpm = hasPackageLock || 
		              !packageJson.packageManager || 
		              packageJson.packageManager.includes('npm');
		
		return {
			isNpm,
			hasPackageLock,
			packageJson
		};
	} catch (error) {
		return { isNpm: false, reason: `Error reading package.json: ${error.message}` };
	}
}

function upgradeProject(projectDir) {
	const absDir = resolve(projectDir);
	const packageJsonPath = join(absDir, 'package.json');
	const lintWrapperPath = join(absDir, 'scripts', 'lint-wrapper.mjs');
	
	console.log(`\n🚀 Upgrading project: ${absDir}\n`);
	
	if (!existsSync(packageJsonPath)) {
		console.error(`❌ Error: package.json not found at ${packageJsonPath}`);
		process.exit(1);
	}
	
	try {
		// Step 1: Detect and convert npm to pnpm if needed
		console.log('Step 1: Checking package manager...\n');
		const detection = detectNpmProject(absDir);
		
		if (detection.isNpm) {
			console.log('📦 Detected npm-based project. Converting to pnpm...\n');
		} else {
			console.log('✓ Project is already configured for pnpm.\n');
		}
		
		// Step 2: Upgrade package.json
		console.log('Step 2: Upgrading package.json...\n');
		const content = readFileSync(packageJsonPath, 'utf8');
		const packageJson = detection.packageJson || JSON.parse(content);
		
		let updated = false;
		const changes = [];
		
		// Add "type": "module" if missing
		if (!packageJson.type) {
			packageJson.type = 'module';
			updated = true;
			changes.push('✓ Added "type": "module"');
		}
		
		// Ensure scripts object exists
		if (!packageJson.scripts) {
			packageJson.scripts = {};
			updated = true;
		}
		
		// Add/update preinstall script
		if (!packageJson.scripts.preinstall || packageJson.scripts.preinstall !== preinstallScript) {
			const scripts = { preinstall: preinstallScript, ...packageJson.scripts };
			packageJson.scripts = scripts;
			updated = true;
			changes.push('✓ Added/updated preinstall script');
		}
		
		// Fix build script - add TypeScript check if missing
		if (packageJson.scripts.build) {
			const buildScript = packageJson.scripts.build;
			if (!buildScript.includes('tsc -noEmit') && buildScript.includes('esbuild.config.mjs')) {
				if (buildScript.match(/^node esbuild\.config\.mjs/)) {
					packageJson.scripts.build = `tsc -noEmit -skipLibCheck && ${buildScript}`;
					updated = true;
					changes.push('✓ Fixed build script (added TypeScript check)');
				}
			}
		}
		
		// Add version script if missing (but only if version-bump.mjs exists)
		if (!packageJson.scripts.version) {
			const versionBumpPath = join(absDir, 'version-bump.mjs');
			if (existsSync(versionBumpPath)) {
				packageJson.scripts.version = 'node version-bump.mjs && git add manifest.json versions.json';
				updated = true;
				changes.push('✓ Added version script');
			}
		}
		
		// Remove keywords field
		if ('keywords' in packageJson) {
			delete packageJson.keywords;
			updated = true;
			changes.push('✓ Removed keywords field');
		}
		
		// Standardize devDependency versions
		if (!packageJson.devDependencies) {
			packageJson.devDependencies = {};
			updated = true;
		}
		
		let depsUpdated = false;
		for (const [dep, version] of Object.entries(STANDARD_VERSIONS)) {
			if (packageJson.devDependencies[dep]) {
				const currentVersion = packageJson.devDependencies[dep];
				if (currentVersion !== version) {
					packageJson.devDependencies[dep] = version;
					depsUpdated = true;
				}
			}
		}
		
		if (depsUpdated) {
			updated = true;
			changes.push('✓ Standardized devDependency versions');
		}
		
		// Ensure packageManager field exists and is correct
		if (!packageJson.packageManager || packageJson.packageManager !== packageManagerVersion) {
			packageJson.packageManager = packageManagerVersion;
			updated = true;
			if (!packageJson.packageManager) {
				changes.push('✓ Added packageManager field');
			}
		}
		
		// Reorder fields: move packageManager to end
		const orderedJson = {};
		const fieldOrder = [
			'name', 'version', 'description', 'main', 'type',
			'scripts', 'author', 'license',
			'devDependencies', 'dependencies',
			'packageManager'
		];
		
		for (const field of fieldOrder) {
			if (packageJson[field] !== undefined) {
				orderedJson[field] = packageJson[field];
			}
		}
		
		for (const [key, value] of Object.entries(packageJson)) {
			if (!(key in orderedJson)) {
				orderedJson[key] = value;
			}
		}
		
		// Write updated package.json
		if (updated) {
			const newContent = JSON.stringify(orderedJson, null, '\t') + '\n';
			writeFileSync(packageJsonPath, newContent, 'utf8');
			
			if (changes.length > 0) {
				console.log('✅ package.json upgraded!\n');
				changes.forEach(change => console.log(`   ${change}`));
			}
		} else {
			console.log('✓ package.json already up to date.\n');
		}
		
		// Step 3: Upgrade lint-wrapper.mjs
		console.log('\nStep 3: Upgrading lint-wrapper.mjs...\n');
		if (existsSync(lintWrapperPath)) {
			const currentContent = readFileSync(lintWrapperPath, 'utf8');
			
			if (currentContent.includes('usePnpm') && currentContent.includes('execSync')) {
				console.log('✓ lint-wrapper.mjs already uses flexible detection.\n');
			} else {
				writeFileSync(lintWrapperPath, FLEXIBLE_LINT_WRAPPER, 'utf8');
				console.log('✅ lint-wrapper.mjs upgraded!');
				console.log('   Now uses flexible pnpm/npx detection (no npm warnings)\n');
			}
		} else {
			console.log('ℹ️  lint-wrapper.mjs not found (skipping)\n');
		}
		
		// Final summary
		if (detection.hasPackageLock) {
			console.log('⚠️  Note: package-lock.json detected');
			console.log('   Consider removing it: rm package-lock.json\n');
		}
		
		console.log('✅ Upgrade complete!\n');
		console.log('💡 Next steps:');
		console.log('   1. Review the changes');
		console.log('   2. Run: pnpm install (to update dependencies)');
		console.log('   3. Run: pnpm build (to verify build works)');
		console.log('   4. Run: pnpm lint (to verify linting works)');
		console.log('');
		
	} catch (error) {
		console.error(`❌ Error: ${error.message}`);
		process.exit(1);
	}
}

// Get project directory from command line or use current directory
const projectDir = process.argv[2] || process.cwd();

upgradeProject(projectDir);

