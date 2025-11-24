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
		private basesConfig?: { get?: (key: string) => unknown },
		private basesController?: { getPropertyDisplayName?: (name: string) => string }
	) {}

	/**
	 * Renders property fields for a card
	 */
	renderProperties(
		cardEl: HTMLElement,
		card: CardData,
		entry: BasesEntry,
		settings: CMSSettings,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>
	): void {
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

		// Resolve property values
		const values = effectiveProps.map(prop =>
			prop ? resolveBasesProperty(prop, entry, card, settings) : null
		);

		// Check if any row has content
		const row1HasContent = effectiveProps[0] !== '' || effectiveProps[1] !== '';
		const row2HasContent = effectiveProps[2] !== '' || effectiveProps[3] !== '';

		if (!row1HasContent && !row2HasContent) return;

		const metaEl = cardEl.createDiv('card-properties properties-4field');

		// Row 1
		if (row1HasContent) {
			const row1El = metaEl.createDiv('property-row property-row-1');
			if (settings.propertyLayout12SideBySide) {
				row1El.addClass('property-row-side-by-side');
			}
			const field1El = row1El.createDiv('property-field property-field-1');
			if (effectiveProps[0]) this.renderPropertyContent(field1El, effectiveProps[0], values[0], card, entry, settings, onPropertyToggle);
			const field2El = row1El.createDiv('property-field property-field-2');
			if (effectiveProps[1]) this.renderPropertyContent(field2El, effectiveProps[1], values[1], card, entry, settings, onPropertyToggle);
		}

		// Row 2
		if (row2HasContent) {
			const row2El = metaEl.createDiv('property-row property-row-2');
			if (settings.propertyLayout34SideBySide) {
				row2El.addClass('property-row-side-by-side');
			}
			const field3El = row2El.createDiv('property-field property-field-3');
			if (effectiveProps[2]) this.renderPropertyContent(field3El, effectiveProps[2], values[2], card, entry, settings, onPropertyToggle);
			const field4El = row2El.createDiv('property-field property-field-4');
			if (effectiveProps[3]) this.renderPropertyContent(field4El, effectiveProps[3], values[3], card, entry, settings, onPropertyToggle);
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
			if ((propertyName === 'file.path' || propertyName === 'path' || propertyName === 'file path') && card.folderPath.length === 0) {
				return;
			}
		}

		// Get property label from Bases if available
		const propertyLabel = getPropertyLabel(propertyName, this.app, this.basesConfig, this.basesController);
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
		} else if ((propertyName === 'file.path' || propertyName === 'path' || propertyName === 'file path') && card.path.length > 0) {
			const pathWrapper = metaContent.createDiv('path-wrapper');
			const segments = card.path.split('/').filter(f => f);
			segments.forEach((segment, idx) => {
				const span = pathWrapper.createSpan();
				const isLastSegment = idx === segments.length - 1;
				const segmentClass = isLastSegment ? 'path-segment filename-segment' : 'path-segment file-path-segment';
				const segmentEl = span.createSpan({ cls: segmentClass, text: segment });
				segmentEl.addEventListener('click', (e) => {
					e.stopPropagation();
					if (isLastSegment) {
						const file = this.app.vault.getAbstractFileByPath(card.path);
						if (file instanceof TFile) {
							void this.app.workspace.getLeaf(false).openFile(file);
						}
					}
				});
				if (idx < segments.length - 1) {
					span.createSpan({ cls: 'path-separator', text: '/' });
				}
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
				
				// Strip "note." prefix for display
				const displayName = propertyName.startsWith('note.') ? propertyName.substring(5) : propertyName;
				metaContent.createSpan({ text: displayName });
				
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
				// Generic property - wrap in div for proper scrolling
				const textWrapper = metaContent.createDiv('text-wrapper');
				textWrapper.appendText(resolvedValue);
			}
		}

		// Remove metaContent wrapper if it ended up empty
		if (!metaContent.textContent || metaContent.textContent.trim().length === 0) {
			metaContent.remove();
		}
	}
}

