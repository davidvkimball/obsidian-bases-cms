/**
 * Unified Frontmatter Helper
 * Provides a unified interface for reading and modifying frontmatter
 * Works for both .md files (using Obsidian's cache) and .mdx files (manual parsing)
 */

import { App, TFile } from 'obsidian';
import {
	isMdxFile,
	readMdxFrontmatter,
	processMdxFrontMatter,
} from './mdx-frontmatter';

/**
 * Get frontmatter from a file (works for both .md and .mdx)
 * For .md files, uses Obsidian's metadata cache (fast)
 * For .mdx files, uses manual parsing
 */
export async function getFileFrontmatter(
	app: App,
	file: TFile
): Promise<Record<string, unknown> | null> {
	if (isMdxFile(file)) {
		// MDX files: use manual parsing
		return await readMdxFrontmatter(app, file);
	} else {
		// .md files: use Obsidian's metadata cache
		const metadata = app.metadataCache.getFileCache(file);
		return metadata?.frontmatter || null;
	}
}

/**
 * Process frontmatter for a file (works for both .md and .mdx)
 * Similar API to app.fileManager.processFrontMatter but works for MDX files too
 */
export async function processFileFrontMatter(
	app: App,
	file: TFile,
	callback: (frontmatter: Record<string, unknown>) => void
): Promise<void> {
	if (isMdxFile(file)) {
		// MDX files: use manual processing
		await processMdxFrontMatter(app, file, callback);
	} else {
		// .md files: use Obsidian's built-in method
		await app.fileManager.processFrontMatter(file, callback);
	}
}

/**
 * Check if a file is an MDX file
 */
export function isMdxFileHelper(file: TFile): boolean {
	return isMdxFile(file);
}
