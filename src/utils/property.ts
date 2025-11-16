/**
 * Property utility functions
 * Ported from Dynamic Views
 */

import type { BasesEntry } from 'obsidian';

/**
 * Get first non-empty property value from comma-separated list (Bases)
 */
export function getFirstBasesPropertyValue(entry: BasesEntry, propertyString: string): unknown {
	if (!propertyString || !propertyString.trim()) return null;

	const properties = propertyString.split(',').map(p => p.trim()).filter(p => p);

	for (const prop of properties) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
		const value = entry.getValue(prop as any);

		// Check if property exists and has a value
		const valueObj = value as { date?: Date; data?: unknown } | null;
		const propertyExists = valueObj && (
			('date' in valueObj && valueObj.date instanceof Date) ||
			('data' in valueObj)
		);

		if (propertyExists) {
			return value;
		}
	}

	return null;
}

/**
 * Get first image value from property (Bases)
 * Only accepts text and list property types containing image paths/URLs
 * Returns first image path/URL found, or empty array if none
 */
export function getAllBasesImagePropertyValues(entry: BasesEntry, propertyString: string): string[] {
	if (!propertyString || !propertyString.trim()) return [];

	// Use first property only (not comma-separated)
	const prop = propertyString.split(',')[0].trim();
	if (!prop) return [];

	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
	const value = entry.getValue(prop as any) as { data?: unknown; date?: Date } | null;

	// Skip if property doesn't exist or is not text/list type
	if (!value || !('data' in value)) return [];

	// Handle the value
	const data = value.data;
	const images: string[] = [];

	if (Array.isArray(data)) {
		// List property - get first value
		for (const item of data) {
			if (typeof item === 'string' || typeof item === 'number') {
				const str = String(item);
				if (str && str.trim()) {
					images.push(str);
					break; // Only take first one
				}
			}
		}
	} else if (data != null && data !== '') {
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
		return tags ? String(tags) : null;
	}

	if (propertyName === 'tags' || propertyName === 'note.tags') {
		const tags = card.properties.tags;
		if (Array.isArray(tags)) {
			return tags.join(', ');
		}
		return tags ? String(tags) : null;
	}

	// Get value from BasesEntry
	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
		const value = entry.getValue(propertyName as any) as { data?: unknown; date?: Date } | null;
		
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
				return String(data);
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
			return String(propValue);
		}
		return null;
	}
}

/**
 * Convert property name to readable label
 */
export function getPropertyLabel(propertyName: string): string {
	if (!propertyName || propertyName === '') return '';

	const labelMap: Record<string, string> = {
		'file.path': 'file path',
		'path': 'file path',
		'file path': 'file path',
		'file.ctime': 'created time',
		'created time': 'created time',
		'file.mtime': 'modified time',
		'modified time': 'modified time',
		'file.tags': 'file tags',
		'file tags': 'file tags',
		'tags': 'tags',
		'note.tags': 'tags',
		'file.folder': 'folder',
		'folder': 'folder'
	};

	const mappedLabel = labelMap[propertyName.toLowerCase()];
	if (mappedLabel) return mappedLabel;

	return propertyName;
}

