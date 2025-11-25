/**
 * Shared Card Renderer for CMS Views
 * Based on Dynamic Views but with CMS-specific features
 */

import { App, BasesEntry, TFile, Menu } from 'obsidian';
import type BasesCMSPlugin from '../main';
import type { CardData } from '../shared/data-transform';
import type { CMSSettings } from '../shared/data-transform';
import { getFirstBasesPropertyValue } from '../utils/property';
import { renderDraftStatusBadge } from '../utils/draft-status-badge';
import { setupQuickEditIcon } from '../utils/quick-edit-icon';
import { PropertyRenderer } from '../utils/property-renderer';

export class SharedCardRenderer {
	protected basesConfig?: { get?: (key: string) => unknown };
	protected basesController?: { getPropertyDisplayName?: (name: string) => string };
	private propertyRenderer: PropertyRenderer;
	
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
		this.propertyRenderer = new PropertyRenderer(
			this.app,
			() => this.basesConfig, // Pass a getter function so it always gets the latest config
			() => this.basesController // Pass a getter function so it always gets the latest controller
		);
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
	): void {
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
					// Use background-image instead of img tag for smoother scaling
					// Set background image directly on the container
					imageEmbedContainer.style.backgroundImage = `url("${imageUrls[0]}")`;
					imageEmbedContainer.style.backgroundSize = 'cover';
					imageEmbedContainer.style.backgroundPosition = 'center center';
					imageEmbedContainer.style.backgroundRepeat = 'no-repeat';
					
					// Draft status badge (top-left, clickable to toggle)
					// For cover images, place badge on the cover AFTER image-embed is created
					if (settings.showDraftStatus && settings.imageFormat === 'cover') {
						renderDraftStatusBadge(imageEl, entry, card.path, settings, onPropertyToggle);
					}
					
					// Properties - MUST be called before returning
					this.propertyRenderer.renderProperties(cardEl, card, entry, settings, onPropertyToggle);
					
					// Images are set via background-image, no return value needed
					return;
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
		this.propertyRenderer.renderProperties(cardEl, card, entry, settings, onPropertyToggle);
		
		return; // No image for this card
	}
}

