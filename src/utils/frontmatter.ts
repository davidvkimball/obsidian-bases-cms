/**
 * Frontmatter manipulation utilities
 * Ported from Multi-Properties plugin
 */

import { App, TFile } from 'obsidian';

export interface NewPropData {
	type: string;
	data: string | string[] | null;
	overwrite: boolean;
	delimiter: string;
}

/**
 * Add properties from a Map to a note.
 */
export async function addProperties(
	app: App,
	file: TFile,
	props: Map<string, NewPropData>,
	overwrite: boolean
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		for (const [key, value] of props) {
			// Tags should always be a List, even if there is just one tag.
			if (
				key === 'tags' &&
				!frontmatter.hasOwnProperty('tags') &&
				!Array.isArray(value.data)
			) {
				frontmatter[key] = [value.data];
				continue;
			}

			if (!frontmatter[key] || overwrite) {
				frontmatter[key] = value.data;
				continue;
			}

			// Compare types to see if they can be appended.
			const type1 = value.type;
			const existingValue = frontmatter[key];
			const type2 = Array.isArray(existingValue) ? 'list' : typeof existingValue === 'number' ? 'number' : typeof existingValue === 'boolean' ? 'checkbox' : 'text';

			if (canBeAppended(type1, type2)) {
				if (frontmatter[key] === value.data) continue; // Leave identical values alone.
				if (!value.data) continue; // Do not merge empty values.

				const arr = mergeIntoArrays(frontmatter[key], value.data);
				frontmatter[key] = arr;
				continue;
			} else {
				frontmatter[key] = value.data;
				continue;
			}
		}
	});
}

/**
 * Remove properties from a note.
 */
export async function removeProperties(app: App, file: TFile, props: string[]): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		for (const prop of props) {
			frontmatter[prop] = undefined; // "Hacky" workaround, commented code will work in later version."
		}
	});
}

/**
 * Check if two types can be appended to each other.
 */
function canBeAppended(str1: string, str2: string): boolean {
	const arr = ['number', 'date', 'datetime', 'checkbox']; // These values should not be appended.
	if (arr.includes(str1) || arr.includes(str2)) return false;
	return true;
}

/**
 * Convert strings and arrays into single array.
 */
function mergeIntoArrays(...args: (string | string[])[]): string[] {
	const arrays = args.map((arg) => (Array.isArray(arg) ? arg : [arg]));

	// Flatten the array
	const flattened = arrays.flat();

	// Remove duplicates using Set and spread it into an array
	const unique = [...new Set(flattened)];

	return unique;
}

