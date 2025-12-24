#!/usr/bin/env node

/**
 * npm proxy script for backwards compatibility and flexibility
 * 
 * This script detects when npm is being used and:
 * - If pnpm is available: proxies to pnpm (preferred)
 * - If pnpm is not available: allows npm to proceed (fallback)
 * 
 * It runs as a preinstall hook to catch npm install commands.
 * 
 * IMPORTANT: This script must exit immediately if pnpm is running
 * to prevent infinite loops.
 */

import { spawn, execSync } from 'child_process';
import process from 'process';

// Check if pnpm is running (not npm)
// pnpm sets npm_config_user_agent with "pnpm" in it
const userAgent = process.env.npm_config_user_agent || '';
const isPnpm = userAgent.includes('pnpm');

if (isPnpm) {
  // pnpm is running - exit immediately to let pnpm proceed
  // This prevents infinite loops when pnpm runs the preinstall hook
  process.exit(0);
}

// Check if npm is being used
const isNpm = userAgent.includes('npm') && !userAgent.includes('pnpm');

if (isNpm) {
  // Check if pnpm is available
  let pnpmAvailable = false;
  try {
    // Try to check if pnpm command exists
    execSync('pnpm --version', { stdio: 'ignore', shell: true });
    pnpmAvailable = true;
  } catch (error) {
    // pnpm not found - will fall back to npm
    pnpmAvailable = false;
  }
  
  if (pnpmAvailable) {
    // pnpm is available - proxy to it
    console.log('\n⚠️  npm detected. This project prefers pnpm.');
    console.log('   Proxying to pnpm install...\n');
    console.log('   💡 Tip: Use "pnpm install" directly to avoid this message.\n');
    
    // Run pnpm install instead
    const pnpm = spawn('pnpm', ['install'], {
      stdio: 'inherit',
      shell: true,
      // Clear npm-specific env vars to prevent recursion
      env: {
        ...process.env,
        npm_config_user_agent: 'pnpm', // Set this so if pnpm runs preinstall, it exits immediately
      }
    });
    
    pnpm.on('close', (code) => {
      if (code !== 0) {
        console.error('\n❌ pnpm install failed.');
        process.exit(1);
      }
      // Exit successfully - pnpm install completed
      process.exit(0);
    });
    
    pnpm.on('error', (error) => {
      // This shouldn't happen since we checked, but handle it gracefully
      console.error('\n❌ Error running pnpm. Falling back to npm...\n');
      // Exit with code 0 to let npm proceed
      process.exit(0);
    });
  } else {
    // pnpm not available - allow npm to proceed
    console.log('\n⚠️  npm detected. pnpm is not installed.');
    console.log('   Proceeding with npm install (fallback mode).\n');
    console.log('   💡 For better performance, install pnpm:');
    console.log('      npm install -g pnpm');
    console.log('      or');
    console.log('      corepack enable\n');
    // Exit with code 0 to let npm proceed
    process.exit(0);
  }
} else {
  // Unknown package manager or no user agent - let it proceed
  process.exit(0);
}

