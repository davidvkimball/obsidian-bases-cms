/**
 * Property utility functions
 * Ported from Dynamic Views
 * Updated to support MDX files via manual frontmatter parsing
 */

import type { App, BasesEntry } from 'obsidian';
import { TFile } from 'obsidian';
import { getFileFrontmatter } from './frontmatter-helper';

/**
 * Get first non-empty property value from comma-separated list (Bases)
 * Supports MDX files via manual frontmatter parsing when Bases API fails
 */
export async function getFirstBasesPropertyValue(
	entry: BasesEntry, 
	propertyString: string,
	app?: App
): Promise<unknown> {
	if (!propertyString || !propertyString.trim()) return null;

	const properties = propertyString.split(',').map(p => p.trim()).filter(p => p);

	for (const prop of properties) {
		const value = entry.getValue(prop as `note.${string}` | `formula.${string}` | `file.${string}`);

		// Check if property exists and has a value
		const valueObj = value as { date?: Date; data?: unknown } | null;
		const propertyExists = valueObj && (
			('date' in valueObj && valueObj.date instanceof Date) ||
			('data' in valueObj && valueObj.data != null)
		);

		if (propertyExists) {
			return value;
		}

		// For MDX files, fallback to manual frontmatter parsing if Bases API returned null
		if (!propertyExists && app) {
			const file = app.vault.getAbstractFileByPath(entry.file.path);
			if (file instanceof TFile && file.extension === 'mdx') {
				const frontmatter = await getFileFrontmatter(app, file);
				if (frontmatter) {
					// Strip "note." prefix if present
					const cleanProp = prop.startsWith('note.') ? prop.substring(5) : prop;
					const frontmatterValue = frontmatter[cleanProp];
					
					if (frontmatterValue != null) {
						// Return in Bases API format: { data: value }
						return { data: frontmatterValue };
					}
				}
			}
		}
	}

	return null;
}

/**
 * Get first image value from property (Bases)
 * Only accepts text and list property types containing image paths/URLs
 * Returns first image path/URL found, or empty array if none
 * Supports MDX files via manual frontmatter parsing when Bases API fails
 */
export async function getAllBasesImagePropertyValues(
	entry: BasesEntry, 
	propertyString: string,
	app?: App
): Promise<string[]> {
	if (!propertyString || !propertyString.trim()) return [];

	// Use first property only (not comma-separated)
	const prop = propertyString.split(',')[0].trim();
	if (!prop) return [];

	const value = entry.getValue(prop as `note.${string}` | `formula.${string}` | `file.${string}`) as { data?: unknown; date?: Date } | null;

	let data: unknown = null;

	// If Bases API returned a value, use it
	if (value && 'data' in value) {
		data = value.data;
	} else if (app) {
		// For MDX files, fallback to manual frontmatter parsing
		const file = app.vault.getAbstractFileByPath(entry.file.path);
		if (file instanceof TFile && file.extension === 'mdx') {
			const frontmatter = await getFileFrontmatter(app, file);
			if (frontmatter) {
				// Strip "note." prefix if present
				const cleanProp = prop.startsWith('note.') ? prop.substring(5) : prop;
				data = frontmatter[cleanProp];
			}
		}
	}

	// Skip if property doesn't exist
	if (data == null) return [];

	const images: string[] = [];

	if (Array.isArray(data)) {
		// List property - get all values
		for (const item of data) {
			if (typeof item === 'string' || typeof item === 'number') {
				const str = String(item);
				if (str && str.trim()) {
					images.push(str);
				}
			}
		}
	} else if (data !== '') {
		// Text property - single value
		if (typeof data === 'string' || typeof data === 'number') {
			const str = String(data);
			if (str.trim()) {
				images.push(str);
			}
		}
	}

	return images;
}

/**
 * Resolve a Bases property value to a string
 */
export function resolveBasesProperty(
	propertyName: string,
	entry: BasesEntry,
	card: { path: string; properties: Record<string, unknown> }
): string | null {
	if (!propertyName || propertyName === '') return null;

	// Handle special properties
	if (propertyName === 'file.path' || propertyName === 'path' || propertyName === 'file path') {
		return card.path;
	}

	if (propertyName === 'file.tags' || propertyName === 'file tags') {
		// Return tags as comma-separated string
		const tags = card.properties.tags;
		if (Array.isArray(tags)) {
			return tags.join(', ');
		}
		if (tags && typeof tags === 'object' && tags !== null && !Array.isArray(tags)) {
			return JSON.stringify(tags);
		}
		if (tags !== null && tags !== undefined && (typeof tags === 'string' || typeof tags === 'number' || typeof tags === 'boolean')) {
			return String(tags);
		}
		return null;
	}

	if (propertyName === 'tags' || propertyName === 'note.tags') {
		const tags = card.properties.tags;
		if (Array.isArray(tags)) {
			return tags.join(', ');
		}
		if (tags && typeof tags === 'object' && tags !== null && !Array.isArray(tags)) {
			return JSON.stringify(tags);
		}
		if (tags !== null && tags !== undefined && (typeof tags === 'string' || typeof tags === 'number' || typeof tags === 'boolean')) {
			return String(tags);
		}
		return null;
	}

	// Get value from BasesEntry
	try {
		const value = entry.getValue(propertyName as `note.${string}` | `formula.${string}` | `file.${string}`) as { data?: unknown; date?: Date } | null;
		
		if (!value) return null;

		// Handle date values
		if ('date' in value && value.date instanceof Date) {
			return value.date.toLocaleDateString();
		}

		// Handle data values
		if ('data' in value) {
			const data = value.data;
			if (Array.isArray(data)) {
				return data.map(String).join(', ');
			}
		if (data != null && data !== '') {
			if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
				return JSON.stringify(data);
			}
			if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
				return String(data);
			}
			return JSON.stringify(data);
		}
		}

		return null;
	} catch {
		// Fallback to card properties
		const propValue = card.properties[propertyName];
		if (propValue !== undefined && propValue !== null) {
			if (Array.isArray(propValue)) {
				return propValue.map(String).join(', ');
			}
			if (typeof propValue === 'boolean') {
				return propValue ? 'Yes' : 'No';
			}
			if (typeof propValue === 'object' && propValue !== null) {
				return JSON.stringify(propValue);
			}
			if (typeof propValue === 'string' || typeof propValue === 'number' || typeof propValue === 'boolean') {
				return String(propValue);
			}
			return JSON.stringify(propValue);
		}
		return null;
	}
}

/**
 * Convert property name to readable label
 * Uses Bases config.getDisplayName() method (same as Dynamic Views)
 * 
 * @param propertyName - The property name (e.g., "formula.Slug")
 * @param app - Obsidian app instance (unused, kept for compatibility)
 * @param basesConfig - Bases config object that has getDisplayName method
 * @param basesController - Optional Bases controller (unused, kept for compatibility)
 */
export function getPropertyLabel(
	propertyName: string, 
	app?: App, 
	basesConfig?: { get?: (key: string) => unknown },
	basesController?: { getPropertyDisplayName?: (name: string) => string }
): string {
	if (!propertyName || propertyName === '') return '';

	// Use Bases config.getDisplayName() method (same as Dynamic Views)
	if (basesConfig) {
		const configWithDisplayName = basesConfig as { getDisplayName?: (name: string) => string };
		if (typeof configWithDisplayName.getDisplayName === 'function') {
			try {
				const displayName = configWithDisplayName.getDisplayName(propertyName);
				if (displayName && typeof displayName === 'string' && displayName.trim() !== '') {
					return displayName;
				}
			} catch {
				// Fall through to return property name
			}
		}
	}

	// Fallback: return property name as-is (same as Dynamic Views)
	return propertyName;
}


