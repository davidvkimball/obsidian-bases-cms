/**
 * Data transformation utilities
 * Converts Bases entries into normalized CardData format
 */

import type { BasesEntry } from 'obsidian';
import { getFirstBasesPropertyValue } from '../utils/property';
import { getListSeparator } from '../utils/style-settings';

/**
 * Remove duplication from a string (e.g., "valuevalue" -> "value")
 * Handles multiple repetitions - finds the shortest repeating pattern
 */
function removeDuplication(str: string): string {
	if (str.length === 0) return str;
	
	// Find the shortest repeating pattern by checking all possible prefix lengths
	// Start from 1 and go up to half the string length
	for (let len = 1; len <= Math.floor(str.length / 2); len++) {
		const prefix = str.substring(0, len);
		
		// Check if string is exactly made of repetitions of this prefix
		const repeatCount = Math.floor(str.length / len);
		if (repeatCount < 2) continue; // Need at least 2 repetitions
		
		let isCompleteDuplication = true;
		
		// Verify all full segments match the prefix
		for (let i = 1; i < repeatCount; i++) {
			const segment = str.substring(i * len, (i + 1) * len);
			if (segment !== prefix) {
				isCompleteDuplication = false;
				break;
			}
		}
		
		// If there's a remainder, check if it matches the start of the prefix
		const remainder = str.length % len;
		if (remainder > 0) {
			const lastSegment = str.substring(repeatCount * len);
			if (lastSegment !== prefix.substring(0, remainder)) {
				isCompleteDuplication = false;
			}
		}
		
		if (isCompleteDuplication) {
				return prefix;
		}
	}
	
	return str;
}

export interface CardData {
	path: string;
	name: string;
	title: string;
	tags: string[];
	yamlTags: string[];
	ctime: number;
	mtime: number;
	folderPath: string;
	snippet?: string;
	imageUrl?: string | string[];
	hasImageAvailable?: boolean;
	displayTags?: string[];
	propertyName1?: string;
	propertyName2?: string;
	propertyName3?: string;
	propertyName4?: string;
	propertyName5?: string;
	propertyName6?: string;
	propertyName7?: string;
	propertyName8?: string;
	propertyName9?: string;
	propertyName10?: string;
	propertyName11?: string;
	propertyName12?: string;
	propertyName13?: string;
	propertyName14?: string;
	property1?: string | null;
	property2?: string | null;
	property3?: string | null;
	property4?: string | null;
	property5?: string | null;
	property6?: string | null;
	property7?: string | null;
	property8?: string | null;
	property9?: string | null;
	property10?: string | null;
	property11?: string | null;
	property12?: string | null;
	property13?: string | null;
	property14?: string | null;
}

export interface CMSSettings {
	titleProperty: string;
	descriptionProperty: string;
	imageProperty: string;
	showTitle: boolean;
	showDate: boolean;
	dateProperty: string;
	dateIncludeTime: boolean;
	showTextPreview: boolean;
	fallbackToContent: boolean;
	truncatePreviewProperty: boolean;
	fallbackToEmbeds: boolean | 'always' | 'if-empty' | 'never';
	propertyDisplay1: string;
	propertyDisplay2: string;
	propertyDisplay3: string;
	propertyDisplay4: string;
	propertyDisplay5: string;
	propertyDisplay6: string;
	propertyDisplay7: string;
	propertyDisplay8: string;
	propertyDisplay9: string;
	propertyDisplay10: string;
	propertyDisplay11: string;
	propertyDisplay12: string;
	propertyDisplay13: string;
	propertyDisplay14: string;
	propertyLayout12SideBySide: boolean;
	propertyLayout34SideBySide: boolean;
	propertyLayout56SideBySide: boolean;
	propertyLayout78SideBySide: boolean;
	propertyLayout910SideBySide: boolean;
	propertyLayout1112SideBySide: boolean;
	propertyLayout1314SideBySide: boolean;
	propertyGroup1Position: 'top' | 'bottom';
	propertyGroup2Position: 'top' | 'bottom';
	propertyGroup3Position: 'top' | 'bottom';
	propertyGroup4Position: 'top' | 'bottom';
	propertyGroup5Position: 'top' | 'bottom';
	propertyGroup6Position: 'top' | 'bottom';
	propertyGroup7Position: 'top' | 'bottom';
	imageFormat: 'none' | 'thumbnail' | 'cover';
	imagePosition: 'left' | 'right' | 'top' | 'bottom';
	propertyLabels: 'hide' | 'inline' | 'above';
	showDraftStatus: boolean;
	draftStatusProperty: string;
	draftStatusReverse: boolean;
	draftStatusUseFilenamePrefix: boolean;
	showTags: boolean;
	tagsProperty: string;
	maxTagsToShow: number;
	customizeNewButton: boolean;
	newNoteLocation: string;
	hideQuickEditIcon: boolean;
	cardSize: number;
	imageAspectRatio: number;
}

/**
 * Transform Bases entry into CardData
 */
export function basesEntryToCardData(
	entry: BasesEntry,
	settings: CMSSettings,
	sortMethod: string,
	isShuffled: boolean,
	snippet?: string,
	imageUrl?: string | string[],
	hasImageAvailable?: boolean
): CardData {
	const fileName = entry.file.basename || entry.file.name;

	// Get title from property or fallback to filename
	const titleValue = getFirstBasesPropertyValue(entry, settings.titleProperty) as { data?: unknown } | null;
	const titleData = titleValue?.data;
	const title = (titleData != null && titleData !== '' && (typeof titleData === 'string' || typeof titleData === 'number'))
		? String(titleData)
		: fileName;

	// Get folder path
	const path = entry.file.path;
	const folderPath = path.split('/').slice(0, -1).join('/');

	// Get YAML tags only
	const yamlTagsValue = entry.getValue('note.tags') as { data?: unknown } | null;
	let yamlTags: string[] = [];

	if (yamlTagsValue && yamlTagsValue.data != null) {
		const tagData = yamlTagsValue.data;
		const rawTags = Array.isArray(tagData)
			? tagData.map((t: unknown) => {
				if (t && typeof t === 'object' && 'data' in t) {
					return String((t as { data: unknown }).data);
				}
				return (typeof t === 'string' || typeof t === 'number') ? String(t) : '';
			}).filter(t => t)
			: (typeof tagData === 'string' || typeof tagData === 'number') ? [String(tagData)] : [];
		yamlTags = rawTags.map(tag => tag.replace(/^#/, ''));
	}

	// Get tags in YAML + note body
	const allTagsValue = entry.getValue('file.tags') as { data?: unknown } | null;
	let tags: string[] = [];

	if (allTagsValue && allTagsValue.data != null) {
		const tagData = allTagsValue.data;
		const rawTags = Array.isArray(tagData)
			? tagData.map((t: unknown) => {
				if (t && typeof t === 'object' && t !== null && 'data' in t) {
					return String((t as { data: unknown }).data);
				}
				return (typeof t === 'string' || typeof t === 'number') ? String(t) : '';
			}).filter((t): t is string => typeof t === 'string' && t.length > 0)
			: (typeof tagData === 'string' || typeof tagData === 'number') ? [String(tagData)] : [];
		tags = rawTags.map(tag => tag.replace(/^#/, ''));
	}

	// Get timestamps
	const ctime = entry.file.stat.ctime;
	const mtime = entry.file.stat.mtime;

	// Get tags from specified property if enabled
	let displayTags: string[] = [];
	if (settings.showTags && settings.tagsProperty) {
		const tagsValue = getFirstBasesPropertyValue(entry, settings.tagsProperty) as { data?: unknown } | null;
		if (tagsValue && tagsValue.data != null) {
			const tagData = tagsValue.data;
			if (Array.isArray(tagData)) {
				displayTags = tagData.map((t: unknown) => {
					if (t && typeof t === 'object' && 'data' in t) {
						return String((t as { data: unknown }).data);
					}
					return (typeof t === 'string' || typeof t === 'number') ? String(t) : '';
				}).filter((t): t is string => typeof t === 'string' && t.length > 0);
			} else if (typeof tagData === 'string' || typeof tagData === 'number') {
				displayTags = [String(tagData)];
			}
		}
	}

	// Create base card data
	const cardData: CardData = {
		path,
		name: fileName,
		title,
		tags,
		yamlTags,
		ctime,
		mtime,
		folderPath,
		snippet,
		imageUrl,
		hasImageAvailable: hasImageAvailable || false,
		displayTags: displayTags.length > 0 ? displayTags : undefined
	};

	// Resolve properties
	const props = [
		settings.propertyDisplay1,
		settings.propertyDisplay2,
		settings.propertyDisplay3,
		settings.propertyDisplay4,
		settings.propertyDisplay5,
		settings.propertyDisplay6,
		settings.propertyDisplay7,
		settings.propertyDisplay8,
		settings.propertyDisplay9,
		settings.propertyDisplay10,
		settings.propertyDisplay11,
		settings.propertyDisplay12,
		settings.propertyDisplay13,
		settings.propertyDisplay14
	];

	// Detect duplicates
	const seen = new Set<string>();
	const effectiveProps = props.map(prop => {
		if (!prop || prop === '') return '';
		if (seen.has(prop)) return '';
		seen.add(prop);
		return prop;
	});

	// Store property names
	cardData.propertyName1 = effectiveProps[0] || undefined;
	cardData.propertyName2 = effectiveProps[1] || undefined;
	cardData.propertyName3 = effectiveProps[2] || undefined;
	cardData.propertyName4 = effectiveProps[3] || undefined;
	cardData.propertyName5 = effectiveProps[4] || undefined;
	cardData.propertyName6 = effectiveProps[5] || undefined;
	cardData.propertyName7 = effectiveProps[6] || undefined;
	cardData.propertyName8 = effectiveProps[7] || undefined;
	cardData.propertyName9 = effectiveProps[8] || undefined;
	cardData.propertyName10 = effectiveProps[9] || undefined;
	cardData.propertyName11 = effectiveProps[10] || undefined;
	cardData.propertyName12 = effectiveProps[11] || undefined;
	cardData.propertyName13 = effectiveProps[12] || undefined;
	cardData.propertyName14 = effectiveProps[13] || undefined;

	// Resolve property values
	cardData.property1 = effectiveProps[0] ? resolveBasesProperty(effectiveProps[0], entry, cardData, settings) : null;
	cardData.property2 = effectiveProps[1] ? resolveBasesProperty(effectiveProps[1], entry, cardData, settings) : null;
	cardData.property3 = effectiveProps[2] ? resolveBasesProperty(effectiveProps[2], entry, cardData, settings) : null;
	cardData.property4 = effectiveProps[3] ? resolveBasesProperty(effectiveProps[3], entry, cardData, settings) : null;
	cardData.property5 = effectiveProps[4] ? resolveBasesProperty(effectiveProps[4], entry, cardData, settings) : null;
	cardData.property6 = effectiveProps[5] ? resolveBasesProperty(effectiveProps[5], entry, cardData, settings) : null;
	cardData.property7 = effectiveProps[6] ? resolveBasesProperty(effectiveProps[6], entry, cardData, settings) : null;
	cardData.property8 = effectiveProps[7] ? resolveBasesProperty(effectiveProps[7], entry, cardData, settings) : null;
	cardData.property9 = effectiveProps[8] ? resolveBasesProperty(effectiveProps[8], entry, cardData, settings) : null;
	cardData.property10 = effectiveProps[9] ? resolveBasesProperty(effectiveProps[9], entry, cardData, settings) : null;
	cardData.property11 = effectiveProps[10] ? resolveBasesProperty(effectiveProps[10], entry, cardData, settings) : null;
	cardData.property12 = effectiveProps[11] ? resolveBasesProperty(effectiveProps[11], entry, cardData, settings) : null;
	cardData.property13 = effectiveProps[12] ? resolveBasesProperty(effectiveProps[12], entry, cardData, settings) : null;
	cardData.property14 = effectiveProps[13] ? resolveBasesProperty(effectiveProps[13], entry, cardData, settings) : null;

	return cardData;
}

/**
 * Batch transform Bases entries to CardData array
 */
export function transformBasesEntries(
	entries: BasesEntry[],
	settings: CMSSettings,
	sortMethod: string,
	isShuffled: boolean,
	snippets: Record<string, string>,
	images: Record<string, string | string[]>,
	hasImageAvailable: Record<string, boolean>
): CardData[] {
	return entries.map(entry => basesEntryToCardData(
		entry,
		settings,
		sortMethod,
		isShuffled,
		snippets[entry.file.path],
		images[entry.file.path],
		hasImageAvailable[entry.file.path]
	));
}

/**
 * Resolve property value for Bases entry
 */
export function resolveBasesProperty(
	propertyName: string,
	entry: BasesEntry,
	cardData: CardData,
	settings: CMSSettings
): string | null {
	if (!propertyName || propertyName === '') {
		return null;
	}

	// Handle special properties
	if (propertyName === 'file.path' || propertyName === 'file path') {
		return cardData.folderPath || null;
	}

	if (propertyName === 'tags' || propertyName === 'note.tags') {
		return cardData.yamlTags.length > 0 ? 'tags' : null;
	}

	if (propertyName === 'file.tags' || propertyName === 'file tags') {
		return cardData.tags.length > 0 ? 'tags' : null;
	}

	if (propertyName === 'file.ctime' || propertyName === 'created time') {
		return new Date(cardData.ctime).toLocaleDateString();
	}

	if (propertyName === 'file.mtime' || propertyName === 'modified time') {
		return new Date(cardData.mtime).toLocaleDateString();
	}

	// Generic property: read from frontmatter
	const value = getFirstBasesPropertyValue(entry, propertyName);
	if (!value) return null;

	// Type guard for value
	const valueObj = value as { date?: Date; data?: unknown } | null;
	if (!valueObj) return null;

	// Check if it's a date/datetime value
	if ('date' in valueObj && valueObj.date instanceof Date) {
		return valueObj.date.toLocaleDateString();
	}

	// For non-date properties, extract .data
	const data = valueObj.data;
	
	// IMPORTANT: Return "" for empty (property exists but is empty), null for missing (property doesn't exist)
	// This matches Dynamic Views behavior for hide missing/empty properties
	if (data == null) {
		return null; // Property doesn't exist
	}
	
	if (data === '') {
		return ""; // Property exists but is empty
	}

	// Handle arrays (e.g., aliases, lists)
	// Check if data is already a string that might be duplicated
	if (typeof data === 'string') {
		const trimmed = data.trim();
		if (trimmed.length === 0) {
			return ""; // Empty string
		}
		// Remove duplication if present (handles cases where Bases returns duplicated strings)
		return removeDuplication(trimmed);
	}
	
	if (Array.isArray(data)) {
		if (data.length === 0) {
			return ""; // Empty array
		}
		// Convert array items to strings and join, removing duplicates
		const uniqueItems = new Set<string>();
		const result: string[] = [];
		
		for (const item of data) {
			let str: string;
			if (item && typeof item === 'object' && 'data' in item) {
				const itemData = (item as { data: unknown }).data;
				// Handle nested data structures - if data itself is an object with data, extract recursively
				if (itemData && typeof itemData === 'object' && !Array.isArray(itemData) && 'data' in itemData) {
					str = String((itemData as { data: unknown }).data);
				} else {
					str = String(itemData);
				}
			} else if (item && typeof item === 'object' && item !== null) {
				// If item is an object but doesn't have 'data', try to extract value directly
				// This handles cases where Bases might return {value: "..."} or similar
				str = String(item);
			} else {
				str = String(item);
			}
			
			// Remove duplication BEFORE checking uniqueness (handles cases where Bases returns duplicated strings)
			const trimmed = str.trim();
			if (trimmed && trimmed !== '') {
				const deduplicated = removeDuplication(trimmed);
				if (deduplicated && deduplicated !== '' && !uniqueItems.has(deduplicated)) {
					uniqueItems.add(deduplicated);
					result.push(deduplicated);
				}
			}
		}
		
		if (result.length > 0) {
			return result.join(getListSeparator());
		}
		return null;
	}

	// Convert to string
	if (typeof data === 'string') {
		let str = data.trim();
		if (str.length === 0) {
			return null;
		}
		
		// Remove any duplication
		return removeDuplication(str);
	}
	
	if (typeof data === 'number' || typeof data === 'boolean') {
		return String(data);
	}

	return null;
}

