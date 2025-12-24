#!/usr/bin/env node

/**
 * Switch project from npm to pnpm
 * 
 * This script automatically converts an npm-based project to use pnpm:
 * - Detects npm-based projects (package-lock.json, no packageManager field, etc.)
 * - Updates package.json to use pnpm
 * - Adds preinstall script for flexible npm/pnpm support
 * - Optionally removes npm-specific files (package-lock.json, .npmrc)
 * - Preserves all existing scripts and configuration
 * 
 * Usage:
 *   node scripts/switch-to-pnpm.mjs [project-directory]
 * 
 * If no directory is provided, uses current directory.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import process from 'process';

const packageManagerVersion = 'pnpm@10.20.0';
const preinstallScript = 'node scripts/npm-proxy.mjs';

function detectNpmProject(projectDir) {
  const packageJsonPath = join(projectDir, 'package.json');
  const packageLockPath = join(projectDir, 'package-lock.json');
  const npmrcPath = join(projectDir, '.npmrc');
  
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
    
    // Check if preinstall script already points to npm-proxy
    const hasPnpmPreinstall = packageJson.scripts?.preinstall === preinstallScript;
    
    // Determine if this is an npm project
    const isNpm = hasPackageLock || 
                  !packageJson.packageManager || 
                  packageJson.packageManager.includes('npm');
    
    return {
      isNpm,
      hasPackageLock,
      hasNpmrc: existsSync(npmrcPath),
      hasPnpmPreinstall,
      packageJson
    };
  } catch (error) {
    return { isNpm: false, reason: `Error reading package.json: ${error.message}` };
  }
}

function readNpmrc(npmrcPath) {
  if (!existsSync(npmrcPath)) {
    return null;
  }
  
  try {
    return readFileSync(npmrcPath, 'utf8');
  } catch (error) {
    return null;
  }
}

function shouldRemoveNpmrc(content) {
  if (!content) return false;
  
  // Only remove if it only contains npm-specific settings
  // Common npm-specific settings that pnpm doesn't need:
  const npmOnlySettings = [
    'legacy-peer-deps=true',
    'legacy-peer-deps=false',
    'package-lock=true',
    'package-lock=false'
  ];
  
  const lines = content.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  
  // If all non-comment lines are npm-only settings, it's safe to remove
  return lines.length > 0 && lines.every(line => 
    npmOnlySettings.some(setting => line.includes(setting))
  );
}

function switchToPnpm(projectDir) {
  const absDir = resolve(projectDir);
  const packageJsonPath = join(absDir, 'package.json');
  const packageLockPath = join(absDir, 'package-lock.json');
  const npmrcPath = join(absDir, '.npmrc');
  
  console.log(`\n🔍 Detecting project type: ${absDir}\n`);
  
  const detection = detectNpmProject(absDir);
  
  if (!detection.isNpm) {
    if (detection.reason) {
      console.log(`ℹ️  ${detection.reason}\n`);
    } else {
      console.log('✓ Project is already configured for pnpm.\n');
    }
    return;
  }
  
  console.log('📦 Detected npm-based project. Converting to pnpm...\n');
  
  try {
    const packageJson = detection.packageJson;
    let updated = false;
    const changes = [];
    
    // Add/update packageManager field
    if (!packageJson.packageManager || !packageJson.packageManager.includes('pnpm')) {
      const oldValue = packageJson.packageManager || 'none';
      packageJson.packageManager = packageManagerVersion;
      updated = true;
      changes.push(`✓ Set packageManager: ${packageManagerVersion}`);
    }
    
    // Ensure scripts object exists
    if (!packageJson.scripts) {
      packageJson.scripts = {};
      updated = true;
    }
    
    // Add/update preinstall script
    if (!packageJson.scripts.preinstall || packageJson.scripts.preinstall !== preinstallScript) {
      const oldValue = packageJson.scripts.preinstall || 'none';
      // Insert preinstall as the first script
      const scripts = { preinstall: preinstallScript, ...packageJson.scripts };
      packageJson.scripts = scripts;
      updated = true;
      changes.push(`✓ Added preinstall script (flexible npm/pnpm support)`);
    }
    
    // Write updated package.json
    if (updated) {
      const newContent = JSON.stringify(packageJson, null, '\t');
      writeFileSync(packageJsonPath, newContent + '\n', 'utf8');
      changes.forEach(change => console.log(`   ${change}`));
    }
    
    // Handle package-lock.json
    if (detection.hasPackageLock) {
      console.log(`\n⚠️  Found package-lock.json`);
      console.log(`   This file is npm-specific and should be removed.`);
      console.log(`   pnpm will create pnpm-lock.yaml on first install.`);
      console.log(`   \n   To remove it, run:`);
      console.log(`   rm package-lock.json`);
    }
    
    // Handle .npmrc
    if (detection.hasNpmrc) {
      const npmrcContent = readNpmrc(npmrcPath);
      if (shouldRemoveNpmrc(npmrcContent)) {
        console.log(`\n⚠️  Found .npmrc with npm-specific settings`);
        console.log(`   These settings are not needed for pnpm.`);
        console.log(`   \n   To remove it, run:`);
        console.log(`   rm .npmrc`);
      } else {
        console.log(`\nℹ️  Found .npmrc`);
        console.log(`   Review this file - it may contain settings needed for pnpm too.`);
      }
    }
    
    console.log('\n✅ Conversion complete!\n');
    console.log('💡 Next steps:');
    console.log('   1. Remove old lock file: rm package-lock.json (if you want)');
    console.log('   2. Install dependencies: pnpm install');
    console.log('      (or npm install - it will proxy to pnpm if available)');
    console.log('   3. Verify: pnpm build');
    console.log('');
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Get project directory from command line or use current directory
const projectDir = process.argv[2] || process.cwd();

switchToPnpm(projectDir);

