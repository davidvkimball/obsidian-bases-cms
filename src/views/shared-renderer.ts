/**
 * Shared Card Renderer for CMS Views
 * Based on Dynamic Views but with CMS-specific features
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
import { getFileFrontmatter } from '../utils/frontmatter-helper';

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
		onSelect: (path: string, selected: boolean, shiftKey?: boolean) => void,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>,
		toolbarActions?: { handleDelete: () => Promise<void> }
	): void {
		// Create card element
		const cardEl = container.createDiv('card bases-cms-card');

		// CRITICAL: Force immediate layout reflow to prevent Folder Notes plugin interference
		// Inline styles trigger layout calculation before Folder Notes' MutationObserver processes the element
		setCssProps(cardEl, {
			display: 'block',
			position: 'relative'
		});

		if (settings.imageFormat === 'cover') {
			cardEl.classList.add('image-format-cover');
		} else if (settings.imageFormat === 'thumbnail') {
			cardEl.classList.add('image-format-thumbnail');
			// Add position class for thumbnail
			cardEl.classList.add(`thumbnail-${settings.imagePosition}`);
		}
		cardEl.setAttribute('data-path', card.path);
		cardEl.setAttribute('data-href', card.path);
		cardEl.addClass('bases-cms-cursor-pointer');

		// Selection checkbox
		const checkboxEl = cardEl.createDiv('bases-cms-select-checkbox');
		const checkbox = checkboxEl.createEl('input', { type: 'checkbox', cls: 'selection-checkbox' });
		checkbox.checked = isSelected;

		// Handle click on the checkbox container (the expanded hit area)
		checkboxEl.addEventListener('click', (e) => {
			e.stopPropagation();
			e.stopImmediatePropagation();

			// Toggle checkbox state (if click wasn't directly on the checkbox itself)
			if (e.target !== checkbox) {
				checkbox.checked = !checkbox.checked;
			}

			onSelect(card.path, checkbox.checked, e.shiftKey);
		});

		// Draft status badge (positioned absolutely, aligned with checkbox)
		if (settings.showDraftStatus) {
			renderDraftStatusBadge(cardEl, entry, card.path, settings, onPropertyToggle, this.app, this.mdxFrontmatterCache);
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

			// Shift+Click: Toggle selection instead of opening
			if (e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();

				// Toggle selection
				const newSelectedState = !checkbox.checked;
				onSelect(card.path, newSelectedState, true);
				return;
			}

			const newLeaf = e.metaKey || e.ctrlKey;
			void this.app.workspace.openLinkText(card.path, '', newLeaf);
		});

		// Handle right-click to show context menu
		// Use Obsidian's standard file-menu event subscription pattern
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

				// Check current selection state dynamically by checking the checkbox
				const currentlySelected = checkbox.checked;

				// Add Select/Unselect item
				if (currentlySelected) {
					menu.addItem((item) => {
						item.setTitle('Unselect');
						item.setIcon('square');
						item.onClick(() => {
							onSelect(card.path, false, false);
						});
					});
				} else {
					menu.addItem((item) => {
						item.setTitle('Select');
						item.setIcon('copy-check');
						item.onClick(() => {
							onSelect(card.path, true, false);
						});
					});
				}

				menu.addSeparator();

				// Trigger file-menu event - this allows other plugins to add their items
				this.app.workspace.trigger('file-menu', menu, file, 'bases');

				// Add Delete at the bottom (after all file-menu subscriptions have run)
				// Always show Delete option - toolbarActions should always be provided
				menu.addSeparator();
				menu.addItem((item) => {
					item.setTitle('Delete');
					item.setIcon('trash-2');
					item.onClick(async () => {
						// Delete directly without selecting
						if (toolbarActions) {
							await toolbarActions.handleDelete();
						}
					});
				});

				menu.showAtMouseEvent(e);

				// Style Delete menu item as destructive (red/warning color)
				setTimeout(() => {
					const menuEl = document.querySelector('.menu');
					if (!menuEl) return;

					const menuItems = Array.from(menuEl.querySelectorAll('.menu-item'));
					const deleteItem = menuItems.find(item => {
						const title = item.textContent?.trim();
						return title === 'Delete';
					});

					if (deleteItem) {
						deleteItem.addClass('is-danger');
						// Style the icon and text with error color
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

		// Quick edit icon - attach to titleEl
		setupQuickEditIcon(this.app, this.plugin, titleEl, cardEl, card.path, settings);

		// Date (below title)
		if (settings.showDate && settings.dateProperty) {
			// Try synchronous Bases API first (works for .md files)
			let dateValue = entry.getValue(settings.dateProperty as `note.${string}` | `formula.${string}` | `file.${string}`) as { date?: Date; data?: unknown; icon?: string } | null;

			// Check if we actually have a valid date value
			// For MDX files, Bases API might return {icon: 'lucide-file-question'} which is truthy but has no date
			const hasValidDate = dateValue && (
				('date' in dateValue && dateValue.date instanceof Date) ||
				('data' in dateValue && dateValue.data != null)
			);

			// For MDX files, fallback to manual frontmatter parsing if no valid date
			if (!hasValidDate) {
				const file = this.app.vault.getAbstractFileByPath(entry.file.path);

				if (file instanceof TFile && file.extension === 'mdx') {
					// Load date asynchronously for MDX files
					void (async () => {
						const frontmatter = await getFileFrontmatter(this.app, file);

						if (frontmatter) {
							// Strip "note." prefix if present
							const cleanProp = settings.dateProperty.startsWith('note.')
								? settings.dateProperty.substring(5)
								: settings.dateProperty;

							const frontmatterValue = frontmatter[cleanProp];

							if (frontmatterValue != null) {
								// Parse date from frontmatter value
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

								// Always try to render the date, even if cardEl might not be connected yet
								// The date element will be created/updated when the card is rendered
								if (date) {
									// Use requestAnimationFrame to ensure DOM is ready
									requestAnimationFrame(() => {
										if (cardEl.isConnected) {
											// Format date based on settings
											let dateString: string;
											if (settings.dateIncludeTime) {
												// Format date and time separately, then combine (respects user's system locale)
												// Use options to exclude seconds and match user's expected format
												const datePart = date.toLocaleDateString();
												const timePart = date.toLocaleTimeString(undefined, {
													hour: 'numeric',
													minute: '2-digit',
													hour12: true
												});
												dateString = `${datePart}, ${timePart}`;
											} else {
												// When time is not included, use date-only format (respects user's system locale)
												dateString = date.toLocaleDateString();
											}

											// Find or create date element
											let dateEl = cardEl.querySelector('.card-date');
											if (!dateEl) {
												// Find the title element to insert date after it
												const titleEl = cardEl.querySelector('.card-title');
												if (titleEl && titleEl.parentElement) {
													dateEl = titleEl.parentElement.createDiv('card-date');
													// Insert after title
													titleEl.parentElement.insertBefore(dateEl, titleEl.nextSibling);
												} else {
													dateEl = cardEl.createDiv('card-date');
												}
											}
											dateEl.setText(dateString);
										}
									});
								}
							}
						}
					})();
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
					// Format date based on settings
					let dateString: string;
					if (settings.dateIncludeTime) {
						// Format date and time separately, then combine (respects user's system locale)
						// Use options to exclude seconds and match user's expected format
						const datePart = date.toLocaleDateString();
						const timePart = date.toLocaleTimeString(undefined, {
							hour: 'numeric',
							minute: '2-digit',
							hour12: true
						});
						dateString = `${datePart}, ${timePart}`;
					} else {
						// When time is not included, use date-only format (respects user's system locale)
						dateString = date.toLocaleDateString();
					}

					const dateEl = cardEl.createDiv('card-date');
					dateEl.appendText(dateString);
				}
			}
		}

		// Top property groups (rendered before content)
		this.propertyRenderer.renderProperties(cardEl, card, entry, settings, onPropertyToggle, 'top');

		// Content container - always create if showTextPreview is enabled, or if there are other content elements
		// For thumbnail and cover formats, always create container
		if (settings.showTextPreview ||
			(settings.showTags && card.displayTags && card.displayTags.length > 0) ||
			(settings.imageFormat === 'thumbnail') ||
			(settings.imageFormat === 'cover') ||
			(settings.imageFormat !== 'none' && (card.imageUrl || card.hasImageAvailable))) {
			const contentContainer = cardEl.createDiv('card-content');

			// For thumbnail format, create thumbnail FIRST (before text-wrapper) for proper positioning
			if (settings.imageFormat === 'thumbnail' && card.imageUrl) {
				const rawUrls = Array.isArray(card.imageUrl) ? card.imageUrl : [card.imageUrl];
				const imageUrls = rawUrls.filter(url => url && typeof url === 'string' && url.trim().length > 0);

				if (imageUrls.length > 0) {
					const imageEl = contentContainer.createDiv('card-thumbnail');
					const imageEmbedContainer = imageEl.createDiv('image-embed');
					const originalUrl = imageUrls[0];

					// Convert GIF to static if setting is enabled
					void (async () => {
						const finalUrl = await convertGifToStatic(originalUrl, this.plugin.settings.forceStaticGifImages);
						imageEmbedContainer.style.backgroundImage = `url("${finalUrl}")`;
					})();

					// Set initial background image (will be updated if GIF conversion is needed)
					imageEmbedContainer.style.backgroundImage = `url("${originalUrl}")`;
					setCssProps(imageEmbedContainer, {
						backgroundSize: 'cover',
						backgroundPosition: 'center center',
						backgroundRepeat: 'no-repeat'
					});
				}
			}

			// For thumbnail format, handle positioning
			if (settings.imageFormat === 'thumbnail') {
				// Create text wrapper
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
					const tagStyle = getTagStyle();
					if (tagStyle !== 'plain') {
						tagsContainer.addClass(`tag-style-${tagStyle}`);
					}

					const maxTags = settings.maxTagsToShow;
					const tagsToShow = card.displayTags.slice(0, maxTags);
					const remainingCount = card.displayTags.length - maxTags;

					tagsToShow.forEach(tag => {
						const tagEl = tagsContainer.createSpan('card-tag');
						tagEl.appendText(showTagHashPrefix() ? `#${tag}` : tag);
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
					const tagStyle = getTagStyle();
					if (tagStyle !== 'plain') {
						tagsContainer.addClass(`tag-style-${tagStyle}`);
					}

					const maxTags = settings.maxTagsToShow;
					const tagsToShow = card.displayTags.slice(0, maxTags);
					const remainingCount = card.displayTags.length - maxTags;

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

			// Cover image
			if (settings.imageFormat === 'cover') {
				if (card.imageUrl) {
					const rawUrls = Array.isArray(card.imageUrl) ? card.imageUrl : [card.imageUrl];
					const imageUrls = rawUrls.filter(url => url && typeof url === 'string' && url.trim().length > 0);

					if (imageUrls.length > 0) {
						const imageEl = contentContainer.createDiv('card-cover');
						const imageEmbedContainer = imageEl.createDiv('image-embed');
						const originalUrl = imageUrls[0];

						// Convert GIF to static if setting is enabled
						void (async () => {
							const finalUrl = await convertGifToStatic(originalUrl, this.plugin.settings.forceStaticGifImages);
							imageEmbedContainer.style.backgroundImage = `url("${finalUrl}")`;
						})();

						// Set initial background image (will be updated if GIF conversion is needed)
						imageEmbedContainer.style.backgroundImage = `url("${originalUrl}")`;
						setCssProps(imageEmbedContainer, {
							backgroundSize: 'cover',
							backgroundPosition: 'center center',
							backgroundRepeat: 'no-repeat'
						});


						// Bottom properties - MUST be called before returning (for images)
						this.propertyRenderer.renderProperties(cardEl, card, entry, settings, onPropertyToggle, 'bottom');

						// Images are set via background-image, no return value needed
						return;
					}
				}

				// For cover format, render placeholder if image is expected but not loaded yet, or always
				if (card.hasImageAvailable && !card.imageUrl) {
					const placeholderEl = contentContainer.createDiv('card-cover-placeholder');
				} else if (!card.imageUrl) {
					// No image and not expected - create placeholder anyway for cover format
					const placeholderEl = contentContainer.createDiv('card-cover-placeholder');
				}
			}
		}


		// Bottom properties (for cards without images)
		this.propertyRenderer.renderProperties(cardEl, card, entry, settings, onPropertyToggle, 'bottom');

		return; // No image for this card
	}
}

