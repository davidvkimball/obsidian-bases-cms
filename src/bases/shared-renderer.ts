/**
 * Shared Card Renderer for CMS Views
 */

import { App, BasesEntry, TFile, Menu } from 'obsidian';
import { setCssProps } from '../utils/css-props';
import type BasesCMSPlugin from '../main';
import type { CardData } from '../shared/data-transform';
import type { CMSSettings } from '../shared/data-transform';
import { renderDraftStatusBadge } from '../utils/draft-status-badge';
import { setupQuickEditIcon } from '../utils/quick-edit-icon';
import { PropertyRenderer } from '../utils/property-renderer';
import { convertGifToStatic } from '../utils/image';
import { getTagStyle, showTagHashPrefix } from '../utils/style-settings';
// import { setupImageLoadHandler } from '../shared/image-loader'; // Removed - not used

export class SharedCardRenderer {
	protected basesConfig?: { get?: (key: string) => unknown };
	protected basesController?: { getPropertyDisplayName?: (name: string) => string };
	private propertyRenderer: PropertyRenderer;
	protected mdxFrontmatterCache?: Record<string, Record<string, unknown> | null>;
	
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
	 * Set MDX frontmatter cache for synchronous access during rendering
	 */
	setMdxFrontmatterCache(cache: Record<string, Record<string, unknown> | null>): void {
		this.mdxFrontmatterCache = cache;
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
		onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>,
		toolbarActions?: { handleDelete: () => Promise<void> }
	): void {
		// Parse imageFormat to extract format and position (like Dynamic Views)
		const imageFormat = settings.imageFormat;
		let format: 'none' | 'thumbnail' | 'cover' = 'none';
		let position: 'left' | 'right' | 'top' | 'bottom' = 'right';

		if (imageFormat === 'cover') {
			format = 'cover';
			position = settings.imagePosition || 'right';
		} else if (imageFormat === 'thumbnail') {
			format = 'thumbnail';
			position = settings.imagePosition || 'right';
		}

		// Create card element
		const cardEl = container.createDiv('card bases-cms-card');
		
		// Add format class
		if (format === 'cover') {
			cardEl.classList.add('image-format-cover');
			cardEl.classList.add(`card-cover-${position}`);
		} else if (format === 'thumbnail') {
			cardEl.classList.add('image-format-thumbnail');
			cardEl.classList.add(`card-thumbnail-${position}`);
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
		checkbox.addEventListener('click', (e) => {
			e.stopPropagation();
			e.stopImmediatePropagation();
		});

		// Draft status badge for non-cover formats (positioned absolutely, aligned with checkbox)
		if (settings.showDraftStatus && format !== 'cover') {
			renderDraftStatusBadge(cardEl, entry, card.path, settings, onPropertyToggle, this.app);
		}

		// Handle card click to open file
		cardEl.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			const quickEditIcon = target.closest('.bases-cms-quick-edit-icon');
			if (quickEditIcon) {
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

			const file = this.app.vault.getAbstractFileByPath(card.path);
			if (file && file instanceof TFile) {
				e.stopPropagation();
				
				const menu = new Menu();
				const currentlySelected = checkbox.checked;
				
				if (currentlySelected) {
					menu.addItem((item) => {
						item.setTitle('Unselect');
						item.setIcon('square');
						item.onClick(() => onSelect(card.path, false));
					});
				} else {
					menu.addItem((item) => {
						item.setTitle('Select');
						item.setIcon('copy-check');
						item.onClick(() => onSelect(card.path, true));
					});
				}
				
				menu.addSeparator();
				this.app.workspace.trigger('file-menu', menu, file, 'bases');
				menu.addSeparator();
				menu.addItem((item) => {
					item.setTitle('Delete');
					item.setIcon('trash-2');
					item.onClick(async () => {
						if (toolbarActions) {
							await toolbarActions.handleDelete();
						}
					});
				});
				
				menu.showAtMouseEvent(e);
				
				setTimeout(() => {
					const menuEl = document.querySelector('.menu');
					if (!menuEl) return;
					const menuItems = Array.from(menuEl.querySelectorAll('.menu-item'));
					const deleteItem = menuItems.find(item => item.textContent?.trim() === 'Delete');
					if (deleteItem) {
						deleteItem.addClass('is-danger');
						const icon = deleteItem.querySelector('svg');
						if (icon) {
							setCssProps(icon, {
								color: 'var(--text-error)',
								stroke: 'var(--text-error)'
							});
						}
						const title = deleteItem.querySelector('.menu-item-title');
					if (title) {
						setCssProps(title as HTMLElement, {
								color: 'var(--text-error)'
							});
						}
					}
				}, 0);
			}
		});

		// Title - always render (defaults to file name if no title property is set)
		const titleEl = cardEl.createDiv('card-title');
		titleEl.appendText(card.title);
		
		// Quick edit icon
		setupQuickEditIcon(this.app, this.plugin, titleEl, cardEl, card.path, settings);

		// Date
		if (settings.showDate && settings.dateProperty) {
			// Try synchronous Bases API first (works for .md files)
			let dateValue = entry.getValue(settings.dateProperty as `note.${string}` | `formula.${string}` | `file.${string}`) as { date?: Date; data?: unknown; icon?: string } | null;
			
			// Check if we actually have a valid date value
			// For MDX files, Bases API might return {icon: 'lucide-file-question'} which is truthy but has no date
			const hasValidDate = dateValue && (
				('date' in dateValue && dateValue.date instanceof Date) ||
				('data' in dateValue && dateValue.data != null)
			);
			
			// For MDX files, use cached frontmatter synchronously if available
			if (!hasValidDate) {
				const file = this.app.vault.getAbstractFileByPath(entry.file.path);
				
				if (file instanceof TFile && file.extension === 'mdx' && this.mdxFrontmatterCache) {
					const frontmatter = this.mdxFrontmatterCache[entry.file.path];
					
					if (frontmatter) {
						// Strip "note." prefix if present
						const cleanProp = settings.dateProperty.startsWith('note.') 
							? settings.dateProperty.substring(5) 
							: settings.dateProperty;
						
						const frontmatterValue = frontmatter[cleanProp];
						
						if (frontmatterValue != null) {
							// Parse date from frontmatter value synchronously
							let date: Date | null = null;
							
							// Handle Date objects (including those from YAML parsing)
							if (frontmatterValue instanceof Date) {
								date = frontmatterValue;
							} 
							// Handle date-like objects (YAML parsers sometimes return custom Date objects)
							else if (frontmatterValue && typeof frontmatterValue === 'object' && 'getTime' in frontmatterValue) {
								const dateLike = frontmatterValue as { getTime: () => number };
								try {
									const timestamp = dateLike.getTime();
									if (typeof timestamp === 'number' && !isNaN(timestamp)) {
										date = new Date(timestamp);
									}
								} catch {
									// Fall through to string/number handling
								}
							}
							// Handle strings - especially ISO date strings like "2025-12-29"
							if (!date && typeof frontmatterValue === 'string') {
								const dateStr = frontmatterValue.trim();
								// Try parsing as ISO date (YYYY-MM-DD) - this is what Obsidian uses
								// Add time component to avoid timezone issues: "2025-12-29" -> "2025-12-29T00:00:00"
								const isoDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
								const parsedDate = new Date(isoDateStr);
								if (!isNaN(parsedDate.getTime())) {
									date = parsedDate;
								} else {
									// Fallback to direct Date constructor
									const fallbackDate = new Date(dateStr);
									if (!isNaN(fallbackDate.getTime())) {
										date = fallbackDate;
									}
								}
							}
							// Handle numbers (timestamps)
							if (!date && typeof frontmatterValue === 'number') {
								const parsedDate = new Date(frontmatterValue);
								if (!isNaN(parsedDate.getTime())) {
									date = parsedDate;
								}
							}
							
							// Render date synchronously (no async/requestAnimationFrame needed)
							if (date) {
								let dateString: string;
								if (settings.dateIncludeTime) {
									const datePart = date.toLocaleDateString();
									const timePart = date.toLocaleTimeString(undefined, { 
										hour: 'numeric', 
										minute: '2-digit', 
										hour12: true 
									});
									dateString = `${datePart}, ${timePart}`;
								} else {
									dateString = date.toLocaleDateString();
								}
								
								const dateEl = cardEl.createDiv('card-date');
								dateEl.appendText(dateString);
							}
						}
					}
				}
			}
			
			if (hasValidDate && dateValue) {
				const dateObj = dateValue as { date?: Date; data?: unknown } | null;
				let date: Date | null = null;
				
				if (dateObj && 'date' in dateObj && dateObj.date instanceof Date) {
					date = dateObj.date;
				} else if (dateObj && 'data' in dateObj && dateObj.data) {
					const data = dateObj.data;
					if (data instanceof Date) {
						date = data;
					} else if (typeof data === 'string' || typeof data === 'number') {
						const parsedDate = new Date(data);
						if (!isNaN(parsedDate.getTime())) {
							date = parsedDate;
						}
					}
				}
				
				if (date) {
					let dateString: string;
					if (settings.dateIncludeTime) {
						const datePart = date.toLocaleDateString();
						const timePart = date.toLocaleTimeString(undefined, { 
							hour: 'numeric', 
							minute: '2-digit', 
							hour12: true 
						});
						dateString = `${datePart}, ${timePart}`;
					} else {
						dateString = date.toLocaleDateString();
					}
					
					const dateEl = cardEl.createDiv('card-date');
					dateEl.appendText(dateString);
				}
			}
		}

		// Top property groups
		this.propertyRenderer.renderProperties(cardEl, card, entry, settings, onPropertyToggle, 'top');

		// Prepare image URLs
		const rawUrls = card.imageUrl
			? Array.isArray(card.imageUrl)
				? card.imageUrl
				: [card.imageUrl]
			: [];
		const imageUrls = Array.from(
			new Set(
				rawUrls.filter(
					(url) => url && typeof url === 'string' && url.trim().length > 0,
				),
			),
		);
		const hasImage = format !== 'none' && imageUrls.length > 0;
		const hasImageAvailable = format !== 'none' && card.hasImageAvailable;

		// ALL COVERS: wrapped in card-cover-wrapper for flexbox positioning (FIRST, before content)
		if (format === 'cover') {
			const coverWrapper = cardEl.createDiv(
				hasImage
					? 'card-cover-wrapper'
					: 'card-cover-wrapper card-cover-wrapper-placeholder',
			);

			if (hasImage) {
				const imageEl = coverWrapper.createDiv('card-cover');
				this.renderImage(imageEl, imageUrls, format, position, settings, cardEl);
				
				// Draft status badge (top-left, clickable to toggle)
				if (settings.showDraftStatus) {
					renderDraftStatusBadge(imageEl, entry, card.path, settings, onPropertyToggle, this.app, this.mdxFrontmatterCache);
				}
			} else {
				coverWrapper.createDiv('card-cover-placeholder');
				// Draft status badge on placeholder
				if (settings.showDraftStatus) {
					renderDraftStatusBadge(coverWrapper, entry, card.path, settings, onPropertyToggle, this.app, this.mdxFrontmatterCache);
				}
			}

			// Set CSS custom properties for side cover dimensions
			if (format === 'cover' && (position === 'left' || position === 'right')) {
				const aspectRatio = typeof settings.imageAspectRatio === 'string'
					? parseFloat(settings.imageAspectRatio)
					: settings.imageAspectRatio || 1.0;
				const wrapperRatio = aspectRatio / (aspectRatio + 1);
				const elementSpacing = 8;

				cardEl.style.setProperty('--bases-cms-wrapper-ratio', wrapperRatio.toString());

				const updateWrapperDimensions = () => {
					const cardWidth = cardEl.offsetWidth;
					const targetWidth = Math.floor(wrapperRatio * cardWidth);
					const paddingValue = targetWidth + elementSpacing;

					cardEl.style.setProperty('--bases-cms-side-cover-width', `${targetWidth}px`);
					cardEl.style.setProperty('--bases-cms-side-cover-content-padding', `${paddingValue}px`);

					return { cardWidth, targetWidth, paddingValue };
				};

				requestAnimationFrame(() => {
					updateWrapperDimensions();
					const resizeObserver = new ResizeObserver((entries) => {
						for (const entry of entries) {
							const target = entry.target as HTMLElement;
							const newCardWidth = target.offsetWidth;
							if (newCardWidth === 0) continue;

							const newTargetWidth = Math.floor(wrapperRatio * newCardWidth);
							const newPaddingValue = newTargetWidth + elementSpacing;

							cardEl.style.setProperty('--bases-cms-side-cover-width', `${newTargetWidth}px`);
							cardEl.style.setProperty('--bases-cms-side-cover-content-padding', `${newPaddingValue}px`);
						}
					});
					resizeObserver.observe(cardEl);
					this.propertyObservers.push(resizeObserver);
				});
			}
		}

		// Thumbnail-top: direct child of card
		if (format === 'thumbnail' && position === 'top' && (hasImage || hasImageAvailable)) {
			if (hasImage) {
				const imageEl = cardEl.createDiv('card-thumbnail');
				this.renderImage(imageEl, imageUrls, format, position, settings, cardEl);
			} else {
				cardEl.createDiv('card-thumbnail-placeholder');
			}
		}

		// Determine if card-content will have children
		const hasTextPreview = settings.showTextPreview && card.snippet;
		const hasThumbnailInContent = format === 'thumbnail' && (position === 'left' || position === 'right') && (hasImage || hasImageAvailable);
		const hasTags = settings.showTags && card.displayTags && card.displayTags.length > 0;

		// Only create card-content if it will have children
		if (hasTextPreview || hasThumbnailInContent || hasTags) {
			const contentContainer = cardEl.createDiv('card-content');

			if (hasTextPreview) {
				contentContainer.createDiv({
					cls: 'card-text-preview',
					text: card.snippet || '',
				});
			}

			if (hasThumbnailInContent && format === 'thumbnail') {
				if (hasImage) {
					const imageEl = contentContainer.createDiv('card-thumbnail');
					this.renderImage(imageEl, imageUrls, format, position, settings, cardEl);
				} else {
					contentContainer.createDiv('card-thumbnail-placeholder');
				}
			}

			// Tags
			if (hasTags) {
				const tagsContainer = contentContainer.createDiv('card-tags');
				const tagStyle = getTagStyle();
				if (tagStyle !== 'plain') {
					tagsContainer.addClass(`tag-style-${tagStyle}`);
				}
				
				const maxTags = settings.maxTagsToShow;
				const tagsToShow = card.displayTags!.slice(0, maxTags);
				const remainingCount = card.displayTags!.length - maxTags;
				
				tagsToShow.forEach(tag => {
					const tagEl = tagsContainer.createSpan('card-tag');
					tagEl.appendText(showTagHashPrefix() ? `#${tag}` : tag);
				});
				
				if (remainingCount > 0) {
					const moreEl = tagsContainer.createSpan('card-tag-more');
					moreEl.appendText(`+${remainingCount} more`);
				}
			}
		}

		// Thumbnail-bottom: direct child of card
		if (format === 'thumbnail' && position === 'bottom' && (hasImage || hasImageAvailable)) {
			if (hasImage) {
				const imageEl = cardEl.createDiv('card-thumbnail');
				this.renderImage(imageEl, imageUrls, format, position, settings, cardEl);
			} else {
				cardEl.createDiv('card-thumbnail-placeholder');
			}
		}

		// Bottom properties
		this.propertyRenderer.renderProperties(cardEl, card, entry, settings, onPropertyToggle, 'bottom');
	}

	/**
	 * Renders image (cover or thumbnail) with actual <img> element
	 */
	private renderImage(
		imageEl: HTMLElement,
		imageUrls: string[],
		format: 'thumbnail' | 'cover',
		position: 'left' | 'right' | 'top' | 'bottom',
		settings: CMSSettings,
		cardEl: HTMLElement
	): void {
		const imageEmbedContainer = imageEl.createDiv('image-embed');
		
		// Get the first image URL
		const originalUrl = imageUrls[0];
		
		// Create actual <img> element (like Dynamic Views)
		const imgEl = imageEmbedContainer.createEl('img', {
			attr: { src: originalUrl, alt: '' }
		});
		
		// Set CSS variable for letterbox blur background
		imageEmbedContainer.style.setProperty('--cover-image-url', `url("${originalUrl}")`);
		
		// Convert GIF to static if setting is enabled (update src after load)
		if (this.plugin.settings.forceStaticGifImages) {
			void (async () => {
				const finalUrl = await convertGifToStatic(originalUrl, true);
				if (finalUrl !== originalUrl) {
					imgEl.src = finalUrl;
				}
			})();
		}
		
		// Handle image load for color extraction and layout updates
		// Removed setupImageLoadHandler - not used
		// if (cardEl) {
		// 	setupImageLoadHandler(
		// 		imgEl,
		// 		imageEmbedContainer,
		// 		cardEl,
		// 		this.updateLayoutRef.current || undefined
		// 	);
		// }
	}
}
