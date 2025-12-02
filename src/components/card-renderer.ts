/**
 * Card Renderer Component
 * Handles rendering of individual cards in the CMS view
 */

import { App, BasesEntry, TFile } from 'obsidian';
import { CardData } from '../types';
import { getAllBasesImagePropertyValues } from '../utils/property';
import { convertGifToStatic } from '../utils/image';
import type BasesCMSPlugin from '../main';

export class CardRenderer {
	constructor(
		private app: App,
		private cardLayout: 'top-cover' | 'square'
	) {}

	/**
	 * Transform BasesEntry to CardData
	 */
	transformEntryToCard(entry: BasesEntry, imageProperty: string = 'image,imageOG,cover,thumbnail'): CardData {
		const entryFile = this.app.vault.getAbstractFileByPath(entry.file.path);
		const metadata = entryFile instanceof TFile ? this.app.metadataCache.getFileCache(entryFile) : null;
		const frontmatter = metadata?.frontmatter || {};
		
		// Extract tags
		const yamlTags: string[] = Array.isArray(frontmatter.tags) 
			? frontmatter.tags 
			: frontmatter.tags 
				? [frontmatter.tags] 
				: [];
		
		const bodyTags = metadata?.tags?.map(t => t.tag.substring(1)) || [];
		const allTags = [...new Set([...yamlTags, ...bodyTags])];

		// Extract title
		const title = frontmatter.title as string || 
			entry.file.name.replace(/\.md$/, '');

		// Extract properties
		const properties: Record<string, unknown> = {};
		if (frontmatter) {
			for (const [key, value] of Object.entries(frontmatter)) {
				if (key !== 'tags' && key !== 'title') {
					properties[key] = value;
				}
			}
		}

		const stat = entryFile instanceof TFile ? entryFile.stat : null;

		// Get image property values from configured property
		const imagePropertyValues = getAllBasesImagePropertyValues(entry, imageProperty);
		const imageUrl = imagePropertyValues.length > 0 ? (imagePropertyValues.length === 1 ? imagePropertyValues[0] : imagePropertyValues) : undefined;

		return {
			path: entry.file.path,
			name: entry.file.name,
			title: title,
			tags: allTags,
			yamlTags: yamlTags,
			ctime: stat?.ctime || 0,
			mtime: stat?.mtime || 0,
			folderPath: entryFile?.parent?.path || '',
			properties: properties,
			imageUrl: imageUrl,
			hasImageAvailable: imagePropertyValues.length > 0,
		};
	}

	/**
	 * Render a card element
	 */
	renderCard(
		container: HTMLElement,
		card: CardData,
		entry: BasesEntry,
		isSelected: boolean,
		onSelect: (path: string, selected: boolean) => void,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void
	): HTMLElement {
		const cardEl = container.createDiv('bases-cms-card');
		cardEl.setAttribute('data-path', card.path);
		
		if (isSelected) {
			cardEl.addClass('selected');
		}

		// Add layout class
		cardEl.addClass(this.cardLayout);

		// Selection checkbox
		const checkboxEl = cardEl.createDiv('bases-cms-select-checkbox');
		const checkbox = checkboxEl.createEl('input', { type: 'checkbox' });
		checkbox.checked = isSelected;
		checkbox.addEventListener('change', (e) => {
			e.stopPropagation();
			onSelect(card.path, checkbox.checked);
		});

		// Long press (tap and hold) for mobile selection
		// Works on the ENTIRE card area (cover, thumbnail, and no-image formats)
		// Only excludes interactive elements like checkboxes and property checkboxes
		let longPressTimer: number | null = null;
		let touchStartTime = 0;
		let touchStartX = 0;
		let touchStartY = 0;
		let hasLongPressed = false;
		let shouldPreventClick = false;

		const handleTouchStart = (e: TouchEvent) => {
			const target = e.target as HTMLElement;
			// Don't handle long press on excluded interactive elements only
			// Everything else on the card (title, content, image, tags, etc.) will trigger selection
			if (
				checkboxEl.contains(target) ||
				target.tagName === 'INPUT' ||
				target.closest('input') ||
				target.closest('.bases-cms-property')
			) {
				return;
			}

			touchStartTime = Date.now();
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
			hasLongPressed = false;
			shouldPreventClick = false;

			// Start long press timer (500ms)
			longPressTimer = window.setTimeout(() => {
				hasLongPressed = true;
				shouldPreventClick = true;
				// Toggle selection based on current checkbox state
				onSelect(card.path, !checkbox.checked);
				// Provide haptic feedback if available
				if (navigator.vibrate) {
					navigator.vibrate(50);
				}
			}, 500);
		};

		const handleTouchMove = (e: TouchEvent) => {
			// Cancel long press if user moves finger too much
			if (longPressTimer && e.touches[0]) {
				const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
				const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
				// If moved more than 10px, cancel
				if (deltaX > 10 || deltaY > 10) {
					if (longPressTimer) {
						clearTimeout(longPressTimer);
						longPressTimer = null;
					}
				}
			}
		};

		const handleTouchEnd = (e: TouchEvent) => {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}

			// If it was a long press, prevent the click handler
			if (hasLongPressed) {
				shouldPreventClick = true;
			}
		};

		cardEl.addEventListener('touchstart', handleTouchStart, { passive: true });
		cardEl.addEventListener('touchmove', handleTouchMove, { passive: true });
		cardEl.addEventListener('touchend', handleTouchEnd, { passive: true });

		// Card cover/thumbnail (if image available)
		if (card.imageUrl) {
			const imageUrls = Array.isArray(card.imageUrl) ? card.imageUrl : [card.imageUrl];
			if (imageUrls.length > 0 && imageUrls[0]) {
				const imageContainer = cardEl.createDiv(this.cardLayout === 'top-cover' ? 'bases-cms-card-cover' : 'bases-cms-card-thumbnail');
				const img = imageContainer.createEl('img');
				
				// Resolve image path to resource URL
				const imagePath = imageUrls[0];
				
				// Try to resolve as internal file path
				let imageFile = this.app.vault.getAbstractFileByPath(imagePath);
				
				// If not found, try resolving relative to card's folder
				if (!imageFile && card.folderPath) {
					const relativePath = `${card.folderPath}/${imagePath}`;
					imageFile = this.app.vault.getAbstractFileByPath(relativePath);
				}
				
				// If still not found, try with metadata cache link resolution
				if (!imageFile) {
					const cardFile = this.app.vault.getAbstractFileByPath(card.path);
					if (cardFile instanceof TFile) {
						const resolved = this.app.metadataCache.getFirstLinkpathDest(imagePath, card.path);
						if (resolved instanceof TFile) {
							imageFile = resolved;
						}
					}
				}
				
				if (imageFile instanceof TFile) {
					img.src = this.app.vault.getResourcePath(imageFile);
				} else if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
					// External URL
					img.src = imagePath;
				} else {
					// Fallback: try as-is (might be a data URL or other format)
					img.src = imagePath;
				}
				
				img.alt = card.title;
			}
		}

		// Title
		const titleEl = cardEl.createDiv('bases-cms-card-title');
		titleEl.setText(card.title);

		// Properties
		const propsEl = cardEl.createDiv('bases-cms-card-properties');
		this.renderProperties(propsEl, card, entry, onPropertyToggle);

		// Click handler to open file - but NOT when clicking checkboxes or property checkboxes
		cardEl.addEventListener('click', (e) => {
			// Prevent click if it was triggered by a long press
			if (shouldPreventClick) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				shouldPreventClick = false;
				return;
			}

			const target = e.target as HTMLElement;
			
			// Don't open file when clicking:
			// - Selection checkbox
			// - Property checkboxes
			// - Any input elements
			if (
				checkboxEl.contains(target) ||
				target.tagName === 'INPUT' ||
				target.closest('input') ||
				target.closest('.bases-cms-property')
			) {
				return;
			}
			
			const file = this.app.vault.getAbstractFileByPath(card.path);
			if (file instanceof TFile) {
				void this.app.workspace.openLinkText(card.path, '', false);
			}
		});

		return cardEl;
	}

	/**
	 * Render properties on a card
	 */
	private renderProperties(
		container: HTMLElement,
		card: CardData,
		entry: BasesEntry,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>
	): void {
		// Render ALL properties from card.properties
		let hasProperties = false;

		// Get property type info to determine if it's a checkbox
		const metadataCache = this.app.metadataCache as unknown as Record<string, unknown>;
		const propertyInfos = (typeof metadataCache.getAllPropertyInfos === 'function' 
			? metadataCache.getAllPropertyInfos() 
			: {}) || {};

		for (const [propertyName, propertyValue] of Object.entries(card.properties)) {
			// Skip special properties that are handled separately
			if (propertyName === 'tags' || propertyName === 'title' || propertyName === 'image' || propertyName === 'imageOG' || propertyName === 'cover' || propertyName === 'thumbnail') {
				continue;
			}

			hasProperties = true;
			const propEl = container.createDiv('bases-cms-property');
			
			// Check if this is a checkbox property
			const propInfo = propertyInfos[propertyName.toLowerCase()];
			const isCheckbox = propInfo?.widget === 'checkbox' || typeof propertyValue === 'boolean';

			if (isCheckbox) {
				// Render as native Obsidian checkbox - simple input checkbox
				const checkbox = propEl.createEl('input', { type: 'checkbox' });
				checkbox.checked = Boolean(propertyValue);
				propEl.createSpan({ text: propertyName });
				
				if (onPropertyToggle) {
					checkbox.addEventListener('change', async (e) => {
						e.stopPropagation();
						const checked = checkbox.checked;
						try {
							await onPropertyToggle(card.path, propertyName, checked);
						} catch (error) {
							console.error('Error toggling property:', error);
							// Revert checkbox state on error
							checkbox.checked = !checked;
						}
					});
					checkbox.addEventListener('click', (e) => {
						e.stopPropagation();
					});
				}
			} else {
				// Render as text
				const label = propEl.createSpan('bases-cms-property-label');
				label.setText(`${propertyName}: `);
				
				const value = propEl.createSpan('bases-cms-property-value');
				if (Array.isArray(propertyValue)) {
					value.setText(propertyValue.join(', '));
				} else if (propertyValue !== null && propertyValue !== undefined) {
					if (typeof propertyValue === 'object' && propertyValue !== null && !Array.isArray(propertyValue)) {
						value.setText(JSON.stringify(propertyValue));
					} else if (typeof propertyValue === 'string' || typeof propertyValue === 'number' || typeof propertyValue === 'boolean') {
						value.setText(String(propertyValue));
					} else {
						value.setText(JSON.stringify(propertyValue));
					}
				} else {
					value.setText('…');
				}
			}
		}

		// Also render tags if present
		if (card.yamlTags.length > 0) {
			hasProperties = true;
			const tagsEl = container.createDiv('bases-cms-property');
			tagsEl.createSpan({ text: 'Tags: ' });
			card.yamlTags.forEach(tag => {
				const tagEl = tagsEl.createSpan('bases-cms-tag');
				tagEl.setText(`#${tag}`);
			});
		}

		if (!hasProperties) {
			container.addClass('bases-cms-properties-hidden');
		}
	}
}

