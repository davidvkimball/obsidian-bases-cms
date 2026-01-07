/**
 * MDX Frontmatter Utilities
 * Manual frontmatter parsing and modification for MDX files
 * Obsidian's metadataCache and processFrontMatter only work for .md files
 */

import { App, TFile, parseYaml, stringifyYaml } from 'obsidian';

/**
 * Check if a file is an MDX file
 */
export function isMdxFile(file: TFile): boolean {
	return file.extension === 'mdx';
}

/**
 * Parse frontmatter from raw file content
 * Returns the frontmatter object and the body content separately
 */
export function parseMdxFrontmatter(
	content: string
): { frontmatter: Record<string, unknown>; body: string } | null {
	const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
	const match = content.match(frontmatterRegex);

	if (!match) {
		// No frontmatter found
		return {
			frontmatter: {},
			body: content,
		};
	}

	const frontmatterText = match[1];
	const bodyContent = content.slice(match[0].length);

	try {
		const parsed = parseYaml(frontmatterText) as Record<string, unknown> | null | undefined;
		const frontmatter = parsed && typeof parsed === 'object' ? parsed : {};
		return {
			frontmatter,
			body: bodyContent,
		};
	} catch (e) {
		console.error('Error parsing MDX properties:', e);
		// Return empty frontmatter but preserve body
		return {
			frontmatter: {},
			body: bodyContent,
		};
	}
}

/**
 * Read and parse frontmatter from an MDX file
 */
export async function readMdxFrontmatter(
	app: App,
	file: TFile
): Promise<Record<string, unknown> | null> {
	if (!isMdxFile(file)) {
		return null;
	}

	try {
		const content = await app.vault.read(file);
		const parsed = parseMdxFrontmatter(content);
		return parsed ? parsed.frontmatter : null;
	} catch (e) {
		console.error(`Error reading MDX properties from ${file.path}:`, e);
		return null;
	}
}

/**
 * Write updated frontmatter to an MDX file
 */
export async function writeMdxFrontmatter(
	app: App,
	file: TFile,
	frontmatter: Record<string, unknown>
): Promise<void> {
	if (!isMdxFile(file)) {
		throw new Error(`File ${file.path} is not an MDX file`);
	}

	try {
		const content = await app.vault.read(file);
		const parsed = parseMdxFrontmatter(content);

		if (!parsed) {
			throw new Error('Failed to parse existing frontmatter');
		}

		// Stringify the updated frontmatter
		const newFrontmatterText = stringifyYaml(frontmatter).trim();

		// Reconstruct file content
		const newContent = `---\n${newFrontmatterText}\n---\n${parsed.body}`;

		// Write back to file
		await app.vault.modify(file, newContent);
	} catch (e) {
		console.error(`Error writing MDX properties to ${file.path}:`, e);
		throw e;
	}
}

/**
 * Process frontmatter for an MDX file (similar API to processFrontMatter)
 * The callback receives the frontmatter object and can modify it
 */
export async function processMdxFrontMatter(
	app: App,
	file: TFile,
	callback: (frontmatter: Record<string, unknown>) => void
): Promise<void> {
	if (!isMdxFile(file)) {
		throw new Error(`File ${file.path} is not an MDX file`);
	}

	try {
		const content = await app.vault.read(file);
		const parsed = parseMdxFrontmatter(content);

		if (!parsed) {
			throw new Error('Failed to parse existing frontmatter');
		}

		// Create a copy of the frontmatter for the callback to modify
		const frontmatter = { ...parsed.frontmatter };

		// Call the callback to modify frontmatter
		callback(frontmatter);

		// Stringify the updated frontmatter
		const newFrontmatterText = stringifyYaml(frontmatter).trim();

		// Reconstruct file content
		const newContent = `---\n${newFrontmatterText}\n---\n${parsed.body}`;

		// Write back to file
		await app.vault.modify(file, newContent);
	} catch (e) {
		console.error(`Error processing MDX properties for ${file.path}:`, e);
		throw e;
	}
}
