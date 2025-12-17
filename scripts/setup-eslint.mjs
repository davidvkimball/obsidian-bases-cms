#!/usr/bin/env node

/**
 * Setup ESLint for Obsidian Plugin
 * 
 * This script:
 * - Updates package.json with ESLint devDependencies and scripts
 * - Ensures TypeScript version is >=4.8.4 (required for ESLint compatibility)
 * - Generates .eslintrc configuration file
 * - Generates .npmrc configuration file
 * 
 * Usage: node scripts/setup-eslint.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ESLINT_DEPS = {
  "@eslint/json": "^0.14.0",
  "@typescript-eslint/eslint-plugin": "^8.50.0",
  "@typescript-eslint/parser": "^8.50.0",
  "eslint": "^8.57.1",
  "eslint-plugin-obsidianmd": "^0.1.9",
  "typescript-eslint": "^8.50.0"
};

const ESLINT_SCRIPTS = {
  "lint": "eslint . --ext .ts",
  "lint:fix": "eslint . --ext .ts --fix"
};

const MIN_TYPESCRIPT_VERSION = "^4.8.4";

const ESLINTRC_CONFIG = {
  "root": true,
  "parser": "@typescript-eslint/parser",
  "env": { "node": true },
  "plugins": [
    "@typescript-eslint",
    "obsidianmd"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
    "@typescript-eslint/ban-ts-comment": "off",
    "no-prototype-builtins": "off",
    "@typescript-eslint/no-empty-function": "off"
  }
};

const NPMRC_CONTENT = "legacy-peer-deps=true\n";

function parseVersion(versionString) {
  // Remove ^, ~, >=, etc. and extract major.minor.patch
  const clean = versionString.replace(/^[\^~>=<]/, '');
  const parts = clean.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

function compareVersions(v1, v2) {
  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);
  
  if (parsed1.major !== parsed2.major) {
    return parsed1.major - parsed2.major;
  }
  if (parsed1.minor !== parsed2.minor) {
    return parsed1.minor - parsed2.minor;
  }
  return parsed1.patch - parsed2.patch;
}

function isVersionCompatible(currentVersion, minVersion) {
  const current = parseVersion(currentVersion);
  const min = parseVersion(minVersion);
  
  if (current.major > min.major) return true;
  if (current.major < min.major) return false;
  if (current.minor > min.minor) return true;
  if (current.minor < min.minor) return false;
  return current.patch >= min.patch;
}

function setupESLint() {
  // Get the directory where this script is located
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  // Resolve project root (one level up from scripts folder)
  const projectRoot = join(scriptDir, '..');
  const packageJsonPath = join(projectRoot, 'package.json');
  const eslintrcPath = join(projectRoot, '.eslintrc');
  const npmrcPath = join(projectRoot, '.npmrc');
  
  try {
    // Read package.json
    const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    let updated = false;
    
    // Check and update TypeScript version
    if (!packageJson.devDependencies) {
      packageJson.devDependencies = {};
      updated = true;
    }
    
    const currentTsVersion = packageJson.devDependencies.typescript || packageJson.dependencies?.typescript;
    if (currentTsVersion && !isVersionCompatible(currentTsVersion, MIN_TYPESCRIPT_VERSION)) {
      console.log(`⚠ TypeScript version ${currentTsVersion} is not compatible with ESLint (requires >=4.8.4)`);
      console.log(`✓ Updating TypeScript to ${MIN_TYPESCRIPT_VERSION}`);
      packageJson.devDependencies.typescript = MIN_TYPESCRIPT_VERSION;
      updated = true;
    } else if (!currentTsVersion) {
      console.log(`✓ Adding TypeScript ${MIN_TYPESCRIPT_VERSION}`);
      packageJson.devDependencies.typescript = MIN_TYPESCRIPT_VERSION;
      updated = true;
    }
    
    // Add or update ESLint devDependencies
    for (const [dep, version] of Object.entries(ESLINT_DEPS)) {
      if (!packageJson.devDependencies[dep] || packageJson.devDependencies[dep] !== version) {
        packageJson.devDependencies[dep] = version;
        updated = true;
        console.log(`✓ Added/updated devDependency: ${dep}@${version}`);
      }
    }
    
    // Add or update scripts
    if (!packageJson.scripts) {
      packageJson.scripts = {};
      updated = true;
    }
    
    for (const [script, command] of Object.entries(ESLINT_SCRIPTS)) {
      if (!packageJson.scripts[script] || packageJson.scripts[script] !== command) {
        packageJson.scripts[script] = command;
        updated = true;
        console.log(`✓ Added/updated script: ${script}`);
      }
    }
    
    // Generate .eslintrc file
    let eslintrcUpdated = false;
    if (!existsSync(eslintrcPath)) {
      writeFileSync(eslintrcPath, JSON.stringify(ESLINTRC_CONFIG, null, 2) + '\n', 'utf8');
      console.log('✓ Created .eslintrc configuration file');
      eslintrcUpdated = true;
    } else {
      // Update existing file to ensure it has the correct config
      const existingContent = readFileSync(eslintrcPath, 'utf8');
      const newContent = JSON.stringify(ESLINTRC_CONFIG, null, 2) + '\n';
      if (existingContent.trim() !== newContent.trim()) {
        writeFileSync(eslintrcPath, newContent, 'utf8');
        console.log('✓ Updated .eslintrc configuration file');
        eslintrcUpdated = true;
      }
    }
    
    // Generate .npmrc file
    let npmrcUpdated = false;
    if (!existsSync(npmrcPath)) {
      writeFileSync(npmrcPath, NPMRC_CONTENT, 'utf8');
      console.log('✓ Created .npmrc configuration file');
      npmrcUpdated = true;
    } else {
      const existingContent = readFileSync(npmrcPath, 'utf8');
      if (existingContent !== NPMRC_CONTENT) {
        writeFileSync(npmrcPath, NPMRC_CONTENT, 'utf8');
        console.log('✓ Updated .npmrc configuration file');
        npmrcUpdated = true;
      }
    }
    
    if (updated) {
      // Write back to package.json with proper formatting
      const updatedContent = JSON.stringify(packageJson, null, '\t') + '\n';
      writeFileSync(packageJsonPath, updatedContent, 'utf8');
      console.log('\n✓ package.json updated successfully!');
    }
    
    if (updated || eslintrcUpdated || npmrcUpdated) {
      console.log('\n✓ ESLint setup complete!');
      console.log('\nNext steps:');
      console.log('  1. Run: npm install');
      console.log('  2. Run: npm run lint');
    } else {
      console.log('✓ Everything is already set up correctly!');
      console.log('  Run: npm run lint');
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Error: package.json not found in project root');
      process.exit(1);
    } else if (error instanceof SyntaxError) {
      console.error('❌ Error: package.json is not valid JSON');
      console.error(error.message);
      process.exit(1);
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

setupESLint();

