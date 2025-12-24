#!/usr/bin/env node

/**
 * Helper script to update .agents/sync-status.json with current date
 * 
 * Usage:
 *   node scripts/update-sync-status.mjs [description]
 * 
 * Examples:
 *   node scripts/update-sync-status.mjs "Full sync of all repos"
 *   node scripts/update-sync-status.mjs "Updated project-overview.md from sample plugin"
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, '..');
const syncStatusPath = join(projectRoot, '.agents', 'sync-status.json');

// Get current date in YYYY-MM-DD format
const today = new Date().toISOString().split('T')[0];

// Get optional description from command line
const description = process.argv[2] || 'Sync update';

try {
  // Read current sync-status.json
  const content = readFileSync(syncStatusPath, 'utf8');
  const syncStatus = JSON.parse(content);
  
  // Update lastFullSync date
  syncStatus.lastFullSync = today;
  
  // Update lastSyncSource if description provided
  if (description && description !== 'Sync update') {
    syncStatus.lastSyncSource = description;
  }
  
  // Write back with proper formatting
  const updatedContent = JSON.stringify(syncStatus, null, 2) + '\n';
  writeFileSync(syncStatusPath, updatedContent, 'utf8');
  
  console.log(`✓ Updated .agents/sync-status.json`);
  console.log(`  - lastFullSync: ${today}`);
  if (description && description !== 'Sync update') {
    console.log(`  - lastSyncSource: ${description}`);
  }
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`❌ Error: ${syncStatusPath} not found`);
    process.exit(1);
  } else if (error instanceof SyntaxError) {
    console.error(`❌ Error: ${syncStatusPath} is not valid JSON`);
    console.error(error.message);
    process.exit(1);
  } else {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

