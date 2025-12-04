/**
 * Property Renderer
 * Handles rendering property fields and content for cards
 */

import { App, BasesEntry, TFile } from 'obsidian';
import type { CardData, CMSSettings } from '../shared/data-transform';
import { resolveBasesProperty } from '../shared/data-transform';
import { getPropertyLabel, getFirstBasesPropertyValue } from './property';

export class PropertyRenderer {
	constructor(
		private app: App,
		private getBasesConfig?: () => { get?: (key: string) => unknown } | undefined,
		private getBasesController?: () => { getPropertyDisplayName?: (name: string) => string } | undefined
	) {}

	/**
	 * Renders property fields for a card
	 * @param position - 'top' to render only top-positioned groups, 'bottom' to render only bottom-positioned groups, undefined to render all
	 */
	renderProperties(
		cardEl: HTMLElement,
		card: CardData,
		entry: BasesEntry,
		settings: CMSSettings,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>,
		position?: 'top' | 'bottom'
	): void {
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

		// Resolve property values
		const values = effectiveProps.map(prop =>
			prop ? resolveBasesProperty(prop, entry, card, settings) : null
		);

		// Define property groups
		const propertyGroups = [
			{
				props: [effectiveProps[0], effectiveProps[1]],
				values: [values[0], values[1]],
				sideBySide: settings.propertyLayout12SideBySide,
				position: settings.propertyGroup1Position
			},
			{
				props: [effectiveProps[2], effectiveProps[3]],
				values: [values[2], values[3]],
				sideBySide: settings.propertyLayout34SideBySide,
				position: settings.propertyGroup2Position
			},
			{
				props: [effectiveProps[4], effectiveProps[5]],
				values: [values[4], values[5]],
				sideBySide: settings.propertyLayout56SideBySide,
				position: settings.propertyGroup3Position
			},
			{
				props: [effectiveProps[6], effectiveProps[7]],
				values: [values[6], values[7]],
				sideBySide: settings.propertyLayout78SideBySide,
				position: settings.propertyGroup4Position
			},
			{
				props: [effectiveProps[8], effectiveProps[9]],
				values: [values[8], values[9]],
				sideBySide: settings.propertyLayout910SideBySide,
				position: settings.propertyGroup5Position
			},
			{
				props: [effectiveProps[10], effectiveProps[11]],
				values: [values[10], values[11]],
				sideBySide: settings.propertyLayout1112SideBySide,
				position: settings.propertyGroup6Position
			},
			{
				props: [effectiveProps[12], effectiveProps[13]],
				values: [values[12], values[13]],
				sideBySide: settings.propertyLayout1314SideBySide,
				position: settings.propertyGroup7Position
			}
		];

		// Separate groups by position
		const topGroups: typeof propertyGroups = [];
		const bottomGroups: typeof propertyGroups = [];

		propertyGroups.forEach((group, index) => {
			const hasContent = group.props[0] !== '' || group.props[1] !== '';
			if (hasContent) {
				if (group.position === 'top') {
					topGroups.push(group);
				} else {
					bottomGroups.push(group);
				}
			}
		});

		// Render top groups (only if position is 'top' or undefined)
		if ((position === 'top' || position === undefined) && topGroups.length > 0) {
			const topMetaEl = cardEl.createDiv('card-properties properties-top');
			topGroups.forEach((group, groupIndex) => {
				const rowEl = topMetaEl.createDiv(`property-row property-row-group-${groupIndex + 1}`);
				if (group.sideBySide) {
					rowEl.addClass('property-row-side-by-side');
				}
				const field1El = rowEl.createDiv('property-field property-field-1');
				if (group.props[0]) this.renderPropertyContent(field1El, group.props[0], group.values[0], card, entry, settings, onPropertyToggle);
				const field2El = rowEl.createDiv('property-field property-field-2');
				if (group.props[1]) this.renderPropertyContent(field2El, group.props[1], group.values[1], card, entry, settings, onPropertyToggle);
			});
		}

		// Render bottom groups (only if position is 'bottom' or undefined)
		if ((position === 'bottom' || position === undefined) && bottomGroups.length > 0) {
			const bottomMetaEl = cardEl.createDiv('card-properties properties-bottom');
			bottomGroups.forEach((group, groupIndex) => {
				const rowEl = bottomMetaEl.createDiv(`property-row property-row-group-${groupIndex + 1}`);
				if (group.sideBySide) {
					rowEl.addClass('property-row-side-by-side');
				}
				const field1El = rowEl.createDiv('property-field property-field-1');
				if (group.props[0]) this.renderPropertyContent(field1El, group.props[0], group.values[0], card, entry, settings, onPropertyToggle);
				const field2El = rowEl.createDiv('property-field property-field-2');
				if (group.props[1]) this.renderPropertyContent(field2El, group.props[1], group.values[1], card, entry, settings, onPropertyToggle);
			});
		}
	}

	/**
	 * Renders individual property content
	 */
	private renderPropertyContent(
		container: HTMLElement,
		propertyName: string,
		resolvedValue: string | null,
		card: CardData,
		entry: BasesEntry,
		settings: CMSSettings,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>
	): void {
		if (propertyName === '') return;

		// If no value and labels are hidden, render nothing
		if (!resolvedValue && settings.propertyLabels === 'hide') {
			return;
		}

		// Early return for empty special properties when labels are hidden
		if (settings.propertyLabels === 'hide') {
			if ((propertyName === 'tags' || propertyName === 'note.tags') && card.yamlTags.length === 0) {
				return;
			}
			if ((propertyName === 'file.tags' || propertyName === 'file tags') && card.tags.length === 0) {
				return;
			}
		}

		// Get property label from Bases if available
		const basesConfig = this.getBasesConfig ? this.getBasesConfig() : undefined;
		const basesController = this.getBasesController ? this.getBasesController() : undefined;
		const propertyLabel = getPropertyLabel(propertyName, this.app, basesConfig, basesController);
		// Check if we got a custom display name (different from property name)
		const isCustomLabel = propertyLabel.toLowerCase() !== propertyName.toLowerCase();

		// Render label if property labels are enabled
		if (settings.propertyLabels === 'above') {
			const labelEl = container.createDiv('property-label');
			if (isCustomLabel) {
				labelEl.addClass('property-label-custom');
			}
			labelEl.textContent = propertyLabel;
		}

		// Universal wrapper for all content types
		const metaContent = container.createDiv('property-content');

		// Add inline label if enabled (inside metaContent)
		if (settings.propertyLabels === 'inline') {
			const labelSpan = metaContent.createSpan('property-label-inline');
			labelSpan.textContent = propertyLabel + ': ';
		}

		// If no value but labels are enabled, show placeholder
		if (!resolvedValue) {
			metaContent.appendText('…');
			return;
		}

		// Handle timestamp properties
		const isKnownTimestampProperty = propertyName === 'file.mtime' || propertyName === 'file.ctime' ||
			propertyName === 'modified time' || propertyName === 'created time';

		if (isKnownTimestampProperty) {
			const timestampWrapper = metaContent.createSpan();
			timestampWrapper.appendText(resolvedValue);
		} else if ((propertyName === 'tags' || propertyName === 'note.tags') && card.yamlTags.length > 0) {
			// YAML tags only
			const tagsWrapper = metaContent.createDiv('tags-wrapper');
			card.yamlTags.forEach(tag => {
				const tagEl = tagsWrapper.createEl('a', {
					cls: 'tag',
					text: tag,
					href: '#'
				});
				tagEl.addEventListener('click', (e) => {
					e.preventDefault();
					const searchPlugin = (this.app as { internalPlugins?: { plugins?: Record<string, { instance?: { openGlobalSearch?: (query: string) => void } }> } }).internalPlugins?.plugins?.["global-search"];
					if (searchPlugin?.instance?.openGlobalSearch) {
						searchPlugin.instance.openGlobalSearch("tag:" + tag);
					}
				});
			});
		} else if ((propertyName === 'file.tags' || propertyName === 'file tags') && card.tags.length > 0) {
			// tags in YAML + note body
			const tagsWrapper = metaContent.createDiv('tags-wrapper');
			card.tags.forEach(tag => {
				const tagEl = tagsWrapper.createEl('a', {
					cls: 'tag',
					text: tag,
					href: '#'
				});
				tagEl.addEventListener('click', (e) => {
					e.preventDefault();
					const searchPlugin = (this.app as { internalPlugins?: { plugins?: Record<string, { instance?: { openGlobalSearch?: (query: string) => void } }> } }).internalPlugins?.plugins?.["global-search"];
					if (searchPlugin?.instance?.openGlobalSearch) {
						searchPlugin.instance.openGlobalSearch("tag:" + tag);
					}
				});
			});
		} else {
			// Check if this is a checkbox property
			const metadataCache = this.app.metadataCache as unknown as Record<string, unknown>;
			const propertyInfos = (typeof metadataCache.getAllPropertyInfos === 'function' 
				? metadataCache.getAllPropertyInfos() 
				: {}) as Record<string, { widget?: string }>;
			const propInfo = propertyInfos[propertyName.toLowerCase()];
			
			// Try to get value from entry to check if it's boolean
			const entryValue = entry.getValue(propertyName as `note.${string}` | `formula.${string}` | `file.${string}`) as { data?: unknown } | null;
			const isCheckbox = propInfo?.widget === 'checkbox' || 
				(entryValue && 'data' in entryValue && typeof entryValue.data === 'boolean');

			if (isCheckbox && onPropertyToggle) {
				// Render as native Obsidian checkbox - simple input checkbox
				const checkbox = metaContent.createEl('input', { type: 'checkbox' });
				checkbox.checked = entryValue && 'data' in entryValue ? Boolean(entryValue.data) : false;
				
				// Use the property label (which uses getDisplayName) instead of raw property name
				metaContent.createSpan({ text: propertyLabel });
				
				checkbox.addEventListener('change', async (e) => {
					e.stopPropagation();
					const checked = checkbox.checked;
					try {
						// Strip "note." prefix before toggling
						const cleanProperty = propertyName.startsWith('note.') ? propertyName.substring(5) : propertyName;
						await onPropertyToggle(card.path, cleanProperty, checked);
					} catch (error) {
						console.error('Error toggling property:', error);
						checkbox.checked = !checked;
					}
				});
				checkbox.addEventListener('click', (e) => {
					e.stopPropagation();
				});
			} else {
				// Generic property - parse and render links
				const textWrapper = metaContent.createDiv('text-wrapper');
				this.renderPropertyValueWithLinks(textWrapper, resolvedValue, card.path, propertyName);
			}
		}

		// Remove metaContent wrapper if it ended up empty
		if (!metaContent.textContent || metaContent.textContent.trim().length === 0) {
			metaContent.remove();
		}
	}

	/**
	 * Renders property value with clickable links
	 * Detects wikilinks [[...]], markdown links [...](...), and URLs
	 * For image properties, also makes file paths clickable (like Obsidian does)
	 */
	private renderPropertyValueWithLinks(container: HTMLElement, value: string | null, sourcePath: string, propertyName?: string): void {
		if (!value) {
			container.appendText('…');
			return;
		}

		const trimmedValue = value.trim();
		
		// Check if entire value is a URL (http/https) - make it clickable
		if ((trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) && !trimmedValue.includes(' ')) {
			const linkEl = container.createEl('a', {
				cls: 'external-link',
				href: trimmedValue
			});
			linkEl.textContent = trimmedValue;
			linkEl.setAttr('target', '_blank');
			linkEl.setAttr('rel', 'noopener');
			linkEl.addEventListener('click', (e) => {
				e.stopPropagation();
			});
			return;
		}
		
		// For image properties, make file paths clickable (like Obsidian does in property editor)
		const isImageProperty = propertyName && (
			propertyName.toLowerCase().includes('image') || 
			propertyName.toLowerCase() === 'cover' ||
			propertyName.toLowerCase() === 'thumbnail'
		);
		
		if (isImageProperty && !trimmedValue.includes(' ') && 
			!trimmedValue.startsWith('http://') && 
			!trimmedValue.startsWith('https://') &&
			(trimmedValue.includes('/') || trimmedValue.includes('\\') || 
			 trimmedValue.match(/\.(png|jpg|jpeg|gif|svg|webp|mp4|mov|avi)$/i))) {
			// Make it clickable as an internal link (like Obsidian does for image properties)
			const linkEl = container.createEl('a', {
				cls: 'internal-link',
				href: trimmedValue
			});
			linkEl.textContent = trimmedValue;
			linkEl.addEventListener('click', (e) => {
				e.stopPropagation();
				e.preventDefault();
				const newLeaf = (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey;
				void this.app.workspace.openLinkText(trimmedValue, sourcePath, newLeaf);
			});
			return;
		}
		
		// Parse for wikilinks [[...]] and markdown links [...](...)
		const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
		const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
		
		const matches: Array<{ index: number; type: 'wikilink' | 'markdown'; match: RegExpMatchArray }> = [];
		
		// Find wikilinks
		for (const m of value.matchAll(wikilinkRegex)) {
			if (m.index !== undefined) {
				matches.push({ index: m.index, type: 'wikilink', match: m });
			}
		}
		
		// Find markdown links
		for (const m of value.matchAll(markdownLinkRegex)) {
			if (m.index !== undefined) {
				matches.push({ index: m.index, type: 'markdown', match: m });
			}
		}
		
		// Sort by index
		matches.sort((a, b) => a.index - b.index);
		
		let lastIndex = 0;
		
		// Render text and links
		for (const { index, type, match } of matches) {
			// Add text before the link
			if (index > lastIndex) {
				container.appendText(value.substring(lastIndex, index));
			}
			
			if (type === 'wikilink') {
				const linkContent = match[1];
				const parts = linkContent.split('|');
				const linkPath = parts[0].trim();
				const displayText = parts.length > 1 ? parts[1].trim() : linkPath;
				
				const linkEl = container.createEl('a', {
					cls: 'internal-link',
					href: linkPath
				});
				linkEl.textContent = displayText;
				
				linkEl.addEventListener('click', (e) => {
					e.stopPropagation();
					e.preventDefault();
					const newLeaf = (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey;
					void this.app.workspace.openLinkText(linkPath, sourcePath, newLeaf);
				});
			} else if (type === 'markdown') {
				const linkText = match[1];
				const linkUrl = match[2];
				
				if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
					// External link
					const linkEl = container.createEl('a', {
						cls: 'external-link',
						href: linkUrl
					});
					linkEl.textContent = linkText;
					linkEl.setAttr('target', '_blank');
					linkEl.setAttr('rel', 'noopener');
					linkEl.addEventListener('click', (e) => {
						e.stopPropagation();
					});
				} else {
					// Internal link (file path or wikilink in markdown format)
					const linkEl = container.createEl('a', {
						cls: 'internal-link',
						href: linkUrl
					});
					linkEl.textContent = linkText;
					
					linkEl.addEventListener('click', (e) => {
						e.stopPropagation();
						e.preventDefault();
						const newLeaf = (e as MouseEvent).metaKey || (e as MouseEvent).ctrlKey;
						void this.app.workspace.openLinkText(linkUrl, sourcePath, newLeaf);
					});
				}
			}
			
			lastIndex = index + match[0].length;
		}
		
		// Add remaining text
		if (lastIndex < value.length) {
			container.appendText(value.substring(lastIndex));
		} else if (matches.length === 0) {
			// No links found, just add the text as plain text
			container.appendText(value);
		}
	}
}

