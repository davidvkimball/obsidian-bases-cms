/**
 * Shared Card Renderer for CMS Views
 * Based on Dynamic Views but with CMS-specific features
 */

import { App, BasesEntry, TFile, Menu } from 'obsidian';
import type BasesCMSPlugin from '../main';
import type { CardData } from '../shared/data-transform';
import type { CMSSettings } from '../shared/data-transform';
import { resolveBasesProperty } from '../shared/data-transform';
import { getPropertyLabel, getFirstBasesPropertyValue } from '../utils/property';
import { renderDraftStatusBadge } from '../utils/draft-status-badge';
import { setupQuickEditIcon } from '../utils/quick-edit-icon';

export class SharedCardRenderer {
	protected basesConfig?: { get?: (key: string) => unknown };
	protected basesController?: { getPropertyDisplayName?: (name: string) => string };
	
	constructor(
		protected app: App,
		protected plugin: BasesCMSPlugin,
		protected propertyObservers: ResizeObserver[],
		protected updateLayoutRef: { current: (() => void) | null },
		basesConfig?: { get?: (key: string) => unknown },
		basesController?: unknown
	) {
		this.basesConfig = basesConfig;
		this.basesController = basesController as { getPropertyDisplayName?: (name: string) => string };
	}

	/**
	 * Renders a complete card with CMS features
	 */
	renderCard(
		container: HTMLElement,
		card: CardData,
		entry: BasesEntry,
		settings: CMSSettings,
		hoverParent: unknown,
		isSelected: boolean,
		onSelect: (path: string, selected: boolean) => void,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>
	): { img: HTMLImageElement; src: string } | null {
		// Create card element
		const cardEl = container.createDiv('card bases-cms-card');
		if (settings.imageFormat === 'cover') {
			cardEl.classList.add('image-format-cover');
		} else if (settings.imageFormat === 'thumbnail') {
			cardEl.classList.add('image-format-thumbnail');
		}
		cardEl.setAttribute('data-path', card.path);
		cardEl.setAttribute('data-href', card.path);
		cardEl.addClass('bases-cms-cursor-pointer');

		// Selection checkbox
		const checkboxEl = cardEl.createDiv('bases-cms-select-checkbox');
		const checkbox = checkboxEl.createEl('input', { type: 'checkbox', cls: 'selection-checkbox' });
		checkbox.checked = isSelected;
		checkbox.addEventListener('change', (e) => {
			e.stopPropagation();
			e.stopImmediatePropagation();
			onSelect(card.path, checkbox.checked);
		});
		// Also handle click on checkbox to ensure it works
		checkbox.addEventListener('click', (e) => {
			e.stopPropagation();
			e.stopImmediatePropagation();
		});

		// Draft status badge for non-cover formats (positioned absolutely, aligned with checkbox)
		if (settings.showDraftStatus && settings.imageFormat !== 'cover') {
			renderDraftStatusBadge(cardEl, entry, card.path, settings, onPropertyToggle);
		}

		// Handle card click to open file (but not when clicking checkbox or property checkboxes)
		cardEl.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			// Check if click is on quick edit icon or any of its children (like SVG)
			const quickEditIcon = target.closest('.bases-cms-quick-edit-icon');
			if (quickEditIcon) {
				// Explicitly prevent card click when icon is clicked
				e.stopPropagation();
				e.stopImmediatePropagation();
				e.preventDefault();
				return;
			}
			if (
				checkboxEl.contains(target) ||
				target.tagName === 'INPUT' ||
				target.closest('input') ||
				target.closest('.bases-cms-property') ||
				target.closest('.card-status-badge')
			) {
				return;
			}
			const newLeaf = e.metaKey || e.ctrlKey;
			void this.app.workspace.openLinkText(card.path, '', newLeaf);
		});

		// Handle right-click to show context menu
		cardEl.addEventListener('contextmenu', (e) => {
			const target = e.target as HTMLElement;
			// Don't show context menu for checkboxes, property checkboxes, status badges, or quick edit icon
			if (
				checkboxEl.contains(target) ||
				target.tagName === 'INPUT' ||
				target.closest('input') ||
				target.closest('.bases-cms-property') ||
				target.closest('.card-status-badge') ||
				target.closest('.bases-cms-quick-edit-icon')
			) {
				return;
			}

			// Get the file
			const file = this.app.vault.getAbstractFileByPath(card.path);
			if (file && file instanceof TFile) {
				// Prevent the card click handler from firing
				e.stopPropagation();
				// Don't prevent default - Obsidian's menu system needs default behavior
				
				const menu = new Menu();
				// Trigger file-menu with 'bases' source only (same as native Bases cards view)
				// This includes both Bases-specific options and standard file options
				this.app.workspace.trigger('file-menu', menu, file, 'bases');
				menu.showAtMouseEvent(e);
			}
		});

		// Title
		if (settings.showTitle) {
			const titleEl = cardEl.createDiv('card-title');
			titleEl.appendText(card.title);
			
			// Quick edit icon
			setupQuickEditIcon(this.app, this.plugin, titleEl, cardEl, card.path, settings);
		}

		// Date (below title)
		if (settings.showDate && settings.dateProperty) {
			const dateValue = getFirstBasesPropertyValue(entry, settings.dateProperty);
			if (dateValue) {
				const dateObj = dateValue as { date?: Date; data?: unknown } | null;
				let dateString = '';
				if (dateObj && 'date' in dateObj && dateObj.date instanceof Date) {
					dateString = dateObj.date.toLocaleDateString();
				} else if (dateObj && 'data' in dateObj && dateObj.data) {
					const data = dateObj.data;
					if (data instanceof Date) {
						dateString = data.toLocaleDateString();
					} else if (typeof data === 'string' || typeof data === 'number') {
						const date = new Date(data);
						if (!isNaN(date.getTime())) {
							dateString = date.toLocaleDateString();
						} else {
							dateString = String(data);
						}
					}
				}
				if (dateString) {
					const dateEl = cardEl.createDiv('card-date');
					dateEl.appendText(dateString);
				}
			}
		}

		// Content container
		if (settings.showTextPreview ||
			(settings.showTags && card.displayTags && card.displayTags.length > 0) ||
			(settings.imageFormat !== 'none' && (card.imageUrl || card.hasImageAvailable)) ||
			(settings.imageFormat === 'cover')) {
			const contentContainer = cardEl.createDiv('card-content');

			// For thumbnail format, create a wrapper for text + tags
			if (settings.imageFormat === 'thumbnail') {
				const textWrapper = contentContainer.createDiv('card-text-wrapper');
				
				// Text preview - always create if showTextPreview is enabled, even if snippet isn't loaded yet
				if (settings.showTextPreview) {
					const textPreviewEl = textWrapper.createDiv('card-text-preview');
					if (card.snippet) {
						textPreviewEl.setText(card.snippet);
					}
					// Store reference to update later when snippet loads
					(cardEl as { __textPreviewEl?: HTMLElement; __cardPath?: string }).__textPreviewEl = textPreviewEl;
					(cardEl as { __textPreviewEl?: HTMLElement; __cardPath?: string }).__cardPath = card.path;
				}

				// Tags as pills (under text preview)
				if (settings.showTags && card.displayTags && card.displayTags.length > 0) {
					const tagsContainer = textWrapper.createDiv('card-tags');
					const maxTags = settings.maxTagsToShow;
					const tagsToShow = card.displayTags.slice(0, maxTags);
					const remainingCount = card.displayTags.length - maxTags;
					
					tagsToShow.forEach(tag => {
						const tagEl = tagsContainer.createSpan('card-tag');
						tagEl.appendText(tag);
					});
					
					if (remainingCount > 0) {
						const moreEl = tagsContainer.createSpan('card-tag-more');
						moreEl.appendText(`+${remainingCount} more`);
					}
				}
			} else {
				// For cover/no-image format, stack vertically
				// Text preview - always create if showTextPreview is enabled, even if snippet isn't loaded yet
				if (settings.showTextPreview) {
					const textPreviewEl = contentContainer.createDiv('card-text-preview');
					if (card.snippet) {
						textPreviewEl.setText(card.snippet);
					}
					// Store reference to update later when snippet loads
					(cardEl as { __textPreviewEl?: HTMLElement; __cardPath?: string }).__textPreviewEl = textPreviewEl;
					(cardEl as { __textPreviewEl?: HTMLElement; __cardPath?: string }).__cardPath = card.path;
				}

				// Tags as pills (under text preview)
				if (settings.showTags && card.displayTags && card.displayTags.length > 0) {
					const tagsContainer = contentContainer.createDiv('card-tags');
					const maxTags = settings.maxTagsToShow;
					const tagsToShow = card.displayTags.slice(0, maxTags);
					const remainingCount = card.displayTags.length - maxTags;
					
					tagsToShow.forEach(tag => {
						const tagEl = tagsContainer.createSpan('card-tag');
						tagEl.appendText(tag);
					});
					
					if (remainingCount > 0) {
						const moreEl = tagsContainer.createSpan('card-tag-more');
						moreEl.appendText(`+${remainingCount} more`);
					}
				}
			}

			// Thumbnail or cover
			if (settings.imageFormat !== 'none' && card.imageUrl) {
				const rawUrls = Array.isArray(card.imageUrl) ? card.imageUrl : [card.imageUrl];
				const imageUrls = rawUrls.filter(url => url && typeof url === 'string' && url.trim().length > 0);

				const imageClassName = settings.imageFormat === 'cover' ? 'card-cover' : 'card-thumbnail';
				const imageEl = contentContainer.createDiv(imageClassName);

				if (imageUrls.length > 0) {
					const imageEmbedContainer = imageEl.createDiv('image-embed');
					// Create img element WITHOUT src first (will be set in batch)
					const imgEl = imageEmbedContainer.createEl('img', {
						attr: { 
							alt: '',
							decoding: 'async',
							sizes: settings.imageFormat === 'cover' ? '100vw' : '80px'
						}
					});
					// Set CSS variable for letterbox blur background
					imageEmbedContainer.style.setProperty('--cover-image-url', `url("${imageUrls[0]}")`);
					
					// Draft status badge (top-left, clickable to toggle)
					// For cover images, place badge on the cover AFTER image-embed is created
					if (settings.showDraftStatus && settings.imageFormat === 'cover') {
						renderDraftStatusBadge(imageEl, entry, card.path, settings, onPropertyToggle);
					}
					
					// Properties - MUST be called before returning
					this.renderProperties(cardEl, card, entry, settings, onPropertyToggle);
					
					
					// Return image element and src for batch loading
					return { img: imgEl, src: imageUrls[0] };
				}
			} else if (settings.imageFormat === 'cover') {
				// For cover format, render placeholder and add badge if needed
				const placeholderEl = contentContainer.createDiv('card-cover-placeholder');
				
				// Draft status badge on placeholder (top-left, clickable to toggle)
				renderDraftStatusBadge(placeholderEl, entry, card.path, settings, onPropertyToggle);
			}
			// For thumbnail format, don't render placeholder when no image - just skip it
		}


		// Properties
		this.renderProperties(cardEl, card, entry, settings, onPropertyToggle);
		
		return null; // No image for this card
	}

	/**
	 * Renders property fields for a card
	 */
	private renderProperties(
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
				// Render as checkbox
				const checkbox = metaContent.createEl('input', { type: 'checkbox', cls: 'checkbox-input' });
				checkbox.checked = entryValue && 'data' in entryValue ? Boolean(entryValue.data) : false;
				
				// Strip "note." prefix for display
				const displayName = propertyName.startsWith('note.') ? propertyName.substring(5) : propertyName;
				metaContent.createSpan({ cls: 'checkbox-label', text: displayName });
				
				checkbox.addEventListener('click', (e) => {
					e.stopPropagation();
				});
				
				checkbox.addEventListener('change', (e) => {
					e.stopPropagation();
					void (async () => {
						try {
							// Strip "note." prefix before toggling
							const cleanProperty = propertyName.startsWith('note.') ? propertyName.substring(5) : propertyName;
							await onPropertyToggle(card.path, cleanProperty, checkbox.checked);
						} catch (error) {
							console.error('Error toggling property:', error);
							checkbox.checked = !checkbox.checked;
						}
					})();
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

