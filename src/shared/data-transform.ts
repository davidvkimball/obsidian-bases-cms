/**
 * Data transformation utilities
 * Converts Bases entries into normalized CardData format
 */

import type { BasesEntry } from 'obsidian';
import { getFirstBasesPropertyValue } from '../utils/property';

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
	property1?: string | null;
	property2?: string | null;
	property3?: string | null;
	property4?: string | null;
}

export interface CMSSettings {
	titleProperty: string;
	descriptionProperty: string;
	imageProperty: string;
	showTitle: boolean;
	showDate: boolean;
	dateProperty: string;
	showTextPreview: boolean;
	fallbackToContent: boolean;
	fallbackToEmbeds: boolean;
	propertyDisplay1: string;
	propertyDisplay2: string;
	propertyDisplay3: string;
	propertyDisplay4: string;
	propertyLayout12SideBySide: boolean;
	propertyLayout34SideBySide: boolean;
	imageFormat: 'none' | 'thumbnail' | 'cover';
	propertyLabels: 'hide' | 'inline' | 'above';
	showDraftStatus: boolean;
	draftStatusProperty: string;
	draftStatusReverse: boolean;
	showTags: boolean;
	tagsProperty: string;
	maxTagsToShow: number;
	customizeNewButton: boolean;
	newNoteLocation: string;
	thumbnailCacheSize: 'minimal' | 'small' | 'balanced' | 'large' | 'unlimited';
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
		settings.propertyDisplay4
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

	// Resolve property values
	cardData.property1 = effectiveProps[0] ? resolveBasesProperty(effectiveProps[0], entry, cardData, settings) : null;
	cardData.property2 = effectiveProps[1] ? resolveBasesProperty(effectiveProps[1], entry, cardData, settings) : null;
	cardData.property3 = effectiveProps[2] ? resolveBasesProperty(effectiveProps[2], entry, cardData, settings) : null;
	cardData.property4 = effectiveProps[3] ? resolveBasesProperty(effectiveProps[3], entry, cardData, settings) : null;

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
	if (data == null || data === '') {
		return null;
	}

	// Handle arrays (e.g., aliases, lists)
	if (Array.isArray(data)) {
		if (data.length === 0) {
			return null;
		}
		// Convert array items to strings and join
		return data.map(item => {
			if (item && typeof item === 'object' && 'data' in item) {
				return String((item as { data: unknown }).data);
			}
			return String(item);
		}).filter(item => item && item.trim() !== '').join(', ');
	}

	// Convert to string
	if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
		return String(data);
	}

	return null;
}

