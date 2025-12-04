/**
 * Bases CMS View
 * Based on Dynamic Views grid implementation
 */

import { BasesView, BasesEntry, QueryController, TFile } from 'obsidian';
import type BasesCMSPlugin from '../main';
import { transformBasesEntries, type CardData, type CMSSettings } from '../shared/data-transform';
import { readCMSSettings } from '../shared/settings-schema';
import { getFirstBasesPropertyValue, getAllBasesImagePropertyValues } from '../utils/property';
import { loadSnippetsForEntries, loadImagesForEntries, loadEmbedImagesForEntries } from '../shared/content-loader';
import { SharedCardRenderer } from './shared-renderer';
import { BATCH_SIZE } from '../shared/constants';
import { BulkToolbar } from '../components/bulk-toolbar';
import { setupNewNoteInterceptor } from '../utils/new-note-interceptor';
import { PropertyToggleHandler } from '../utils/property-toggle-handler';
import { ScrollLayoutManager } from '../utils/scroll-layout-manager';
import { ViewSwitchListener } from '../utils/view-switch-listener';
import { convertGifToStatic } from '../utils/image';

export const CMS_VIEW_TYPE = 'bases-cms';

export class BasesCMSView extends BasesView {
	readonly type = CMS_VIEW_TYPE;
	private containerEl: HTMLElement;
	private plugin: BasesCMSPlugin;
	private selectedFiles: Set<string> = new Set();
	private snippets: Record<string, string> = {};
	private images: Record<string, string | string[]> = {};
	private hasImageAvailable: Record<string, boolean> = {};
	private updateLayoutRef: { current: (() => void) | null } = { current: null };
	private propertyObservers: ResizeObserver[] = [];
	private cardRenderer: SharedCardRenderer;
	private bulkToolbar: BulkToolbar | null = null;
	private isRefreshingWithSelection: boolean = false;
	private propertyToggleHandler: PropertyToggleHandler;
	private scrollLayoutManager: ScrollLayoutManager;
	private viewSwitchListener: ViewSwitchListener;

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: BasesCMSPlugin) {
		super(controller);
		this.containerEl = containerEl;
		this.plugin = plugin;
		
		// Initialize shared card renderer (config will be set later in onDataUpdated)
		this.cardRenderer = new SharedCardRenderer(
			this.app,
			this.plugin,
			this.propertyObservers,
			this.updateLayoutRef,
			undefined, // Config not available in constructor
			controller
		);
		
		// Add CMS container classes
		this.containerEl.addClass('bases-cms');
		this.containerEl.addClass('bases-cms-container');
		
		// Initialize managers
		this.propertyToggleHandler = new PropertyToggleHandler(
			this.app,
			this.config as { get: (key: string) => unknown },
			this.plugin.settings,
			() => this.onDataUpdated()
		);

		this.scrollLayoutManager = new ScrollLayoutManager(
			this.containerEl,
			this.app,
			this.config as { get: (key: string) => unknown },
			this.plugin.settings,
			() => this.onDataUpdated(),
			(cleanup) => this.register(cleanup)
		);

		this.viewSwitchListener = new ViewSwitchListener(
			this.containerEl,
			this.plugin,
			this.config as { getName?: () => string; name?: string },
			(this as unknown as { controller?: { getBaseName?: () => string; baseName?: string } }).controller,
			this.data as { baseName?: string } | undefined,
			this.selectedFiles,
			() => this.updateSelectionUI(),
			(cleanup) => this.register(cleanup)
		);

		// Intercept new note button clicks
		setupNewNoteInterceptor(
			this.app,
			this.containerEl,
			this.config,
			this.plugin.settings,
			(cleanup) => this.register(cleanup)
		);

		
		// Setup view switch listener - wraps handleSelectionChange
		const originalHandleSelectionChange = this.handleSelectionChange.bind(this);
		this.handleSelectionChange = this.viewSwitchListener.setup(originalHandleSelectionChange);
	}
	

	onDataUpdated(): void {
		// Check if we're still the active view
		// If onDataUpdated is called but we're not the active view, we've been switched away
		// Use activeLeaf for compatibility (deprecated but necessary here since BasesCMSView doesn't extend View)
		const activeLeaf = (this.app.workspace as unknown as { activeLeaf?: { view?: unknown } }).activeLeaf;
		const activeView = activeLeaf?.view as BasesCMSView | undefined;
		if (activeView && this.selectedFiles.size > 0) {
			// If active view is not this instance, we've been switched away
			if (activeView !== this) {
				// Check if our container is still visible - if hidden, definitely switched away
				const isVisible = this.containerEl && 
					this.containerEl.isConnected && 
					this.containerEl.offsetParent !== null;
				
				if (!isVisible) {
					this.selectedFiles.clear();
					this.updateSelectionUI();
					return;
				}
				
				// Container is visible but we're not the active view
				// Check if our container is in the active view's container
				const activeViewContainer = (activeView as unknown as { containerEl?: HTMLElement }).containerEl;
				if (!activeViewContainer || !activeViewContainer.contains(this.containerEl)) {
					// Our container is not in the active view - we've been switched away
					this.selectedFiles.clear();
					this.updateSelectionUI();
					return;
				}
			}
		}
		
		// Check if container is still visible - if not, clear selection (same as "Clear" button)
		const isVisible = this.containerEl && 
			this.containerEl.isConnected && 
			this.containerEl.offsetParent !== null;
		
		if (!isVisible && this.selectedFiles.size > 0) {
			this.selectedFiles.clear();
			this.updateSelectionUI();
			return; // Don't continue with data update if we're not visible
		}
		
		void (async () => {
			const groupedData = this.data.groupedData;
			const allEntries = this.data.data;

			// Read settings from Bases config
			const settings = readCMSSettings(
				this.config,
				this.plugin.settings
			);
			
			// If fallback to embeds is disabled, clear any cached embed images
			// This ensures embed images don't persist when setting is turned off
			const shouldFallback = settings.fallbackToEmbeds === true || settings.fallbackToEmbeds === 'always' || 
				(settings.fallbackToEmbeds === 'if-empty' && !settings.imageProperty);
			if (!shouldFallback) {
				// Clear all cached images to force re-evaluation
				// This is necessary because we can't distinguish embed vs property images in cache
				this.images = {};
				this.hasImageAvailable = {};
			}

			// Update card renderer with config (now available)
			(this.cardRenderer as unknown as { basesConfig?: { get?: (key: string) => unknown } }).basesConfig = this.config;

			// Update grid layout using scroll layout manager
			this.scrollLayoutManager.updateGridLayout(settings);

			// Save scroll position before re-rendering
			const savedScrollTop = this.containerEl.scrollTop;

			// Get sort method
			const sortMethod = this.getSortMethod();

			// Process groups
			const processedGroups = groupedData.map(group => ({
				group,
				entries: [...group.entries]
			}));

			// Collect visible entries across all groups (up to displayedCount)
			const visibleEntries: BasesEntry[] = [];
			let remainingCount = this.scrollLayoutManager.getDisplayedCount();

			for (const processedGroup of processedGroups) {
				if (remainingCount <= 0) break;
				const entriesToTake = Math.min(processedGroup.entries.length, remainingCount);
				visibleEntries.push(...processedGroup.entries.slice(0, entriesToTake));
				remainingCount -= entriesToTake;
			}

			// PERFORMANCE OPTIMIZATION: Render cards immediately, load images asynchronously
			// This eliminates blocking delays when opening new tabs
			// Prepare image loading data but don't await it before rendering
			const imageLoadingPromises: Array<Promise<void>> = [];
			
			if (settings.imageFormat !== 'none') {
				// Process visible entries first for priority loading
				const visibleImageEntries = visibleEntries
					.filter(entry => !(entry.file.path in this.images))
					.map(entry => {
						const file = this.app.vault.getAbstractFileByPath(entry.file.path);
						if (!(file instanceof TFile)) return null;
						const imagePropertyValues = getAllBasesImagePropertyValues(entry, settings.imageProperty);
						return {
							path: entry.file.path,
							file,
							imagePropertyValues: imagePropertyValues
						};
					})
					.filter((e): e is NonNullable<typeof e> => e !== null);

				// Process background entries (non-visible) for later loading
				const backgroundImageEntries = allEntries
					.filter(entry => 
						!(entry.file.path in this.images) && 
						!visibleEntries.some(ve => ve.file.path === entry.file.path)
					)
					.map(entry => {
						const file = this.app.vault.getAbstractFileByPath(entry.file.path);
						if (!(file instanceof TFile)) return null;
						const imagePropertyValues = getAllBasesImagePropertyValues(entry, settings.imageProperty);
						return {
							path: entry.file.path,
							file,
							imagePropertyValues: imagePropertyValues
						};
					})
					.filter((e): e is NonNullable<typeof e> => e !== null);
				
				// Start loading images for visible entries (high priority, but don't await)
				if (visibleImageEntries.length > 0) {
					imageLoadingPromises.push(
						loadImagesForEntries(
							visibleImageEntries,
							settings.fallbackToEmbeds,
							this.app,
							this.images,
							this.hasImageAvailable
						).then(() => {
							// Update visible cards when images load
							requestAnimationFrame(() => {
								visibleImageEntries.forEach(entry => {
									if (entry.path in this.images) {
										this.updateCardImage(entry.path, this.images[entry.path]);
									}
								});
							});
						})
					);
				}
				
				// Start loading images for background entries (low priority, non-blocking)
				if (backgroundImageEntries.length > 0) {
					imageLoadingPromises.push(
						loadImagesForEntries(
							backgroundImageEntries,
							settings.fallbackToEmbeds,
							this.app,
							this.images,
							this.hasImageAvailable
						)
					);
				}

				// Load embed images in background ONLY for entries without property images
				// CRITICAL: Only load embeds if NO property values exist at all
				const shouldFallback = settings.fallbackToEmbeds === true || settings.fallbackToEmbeds === 'always' || 
					(settings.fallbackToEmbeds === 'if-empty' && !settings.imageProperty);
				if (shouldFallback) {
					const allImageEntries = [...visibleImageEntries, ...backgroundImageEntries];
					const embedEntries = allImageEntries.filter(e => {
						// Only include entries that:
						// 1. Don't have images in cache
						// 2. Don't have hasImageAvailable set (meaning no property values were attempted)
						// 3. Have NO property values (check the actual property values)
						const hasPropertyValues = e.imagePropertyValues && Array.isArray(e.imagePropertyValues) && e.imagePropertyValues.length > 0;
						return !(e.path in this.images) && !this.hasImageAvailable[e.path] && !hasPropertyValues;
					});
					if (embedEntries.length > 0) {
						imageLoadingPromises.push(
							loadEmbedImagesForEntries(embedEntries, this.app, this.images, this.hasImageAvailable).then(() => {
								// Update cards that got embed images
								requestAnimationFrame(() => {
									embedEntries.forEach(entry => {
										if (entry.path in this.images) {
											this.updateCardImage(entry.path, this.images[entry.path]);
										}
									});
								});
							})
						);
					}
				}
			}

			// Load snippets in background (non-blocking)
			if (settings.showTextPreview) {
				const snippetEntries = visibleEntries
					.filter(entry => !(entry.file.path in this.snippets))
					.map(entry => {
						const file = this.app.vault.getAbstractFileByPath(entry.file.path);
						if (!(file instanceof TFile)) return null;
						const descValue = getFirstBasesPropertyValue(entry, settings.descriptionProperty) as { data?: unknown } | null;
						return {
							path: entry.file.path,
							file,
							descriptionData: descValue?.data
						};
					})
					.filter((e): e is { path: string; file: TFile; descriptionData: unknown } => e !== null);

				// Don't await - load snippets in background
				// After snippets load, update the text preview elements
				void loadSnippetsForEntries(
					snippetEntries,
					settings.fallbackToContent,
					false,
					this.app,
					this.snippets
				).then(() => {
					// Update text preview elements for cards that now have snippets
					requestAnimationFrame(() => {
						snippetEntries.forEach(entry => {
							if (entry.path in this.snippets && this.snippets[entry.path]) {
								const cardEl = this.containerEl.querySelector(`[data-path="${entry.path}"]`);
								if (cardEl) {
									const textPreviewEl = (cardEl as { __textPreviewEl?: HTMLElement }).__textPreviewEl;
									// Update if element exists and is empty (no text content or only whitespace)
									if (textPreviewEl && (!textPreviewEl.textContent || textPreviewEl.textContent.trim().length === 0)) {
										textPreviewEl.setText(this.snippets[entry.path]);
									}
								}
							}
						});
					});
				});
			}

			// Preserve toolbar element if we're refreshing with selection
			let preservedToolbarEl: HTMLElement | null = null;
			if (this.isRefreshingWithSelection && this.bulkToolbar) {
				const toolbarEl = this.containerEl.querySelector('.bases-cms-bulk-toolbar');
				if (toolbarEl instanceof HTMLElement) {
					preservedToolbarEl = toolbarEl;
					// Remove it from DOM temporarily but keep the reference
					preservedToolbarEl.remove();
				}
			}
			
			// PERFORMANCE: Render immediately without waiting for images
			// Images will be loaded asynchronously and cards updated when ready
			// Clear and re-render
			this.containerEl.empty();

			// Disconnect old property observers before re-rendering
			this.propertyObservers.forEach(obs => obs.disconnect());
			this.propertyObservers = [];

			// Create cards feed container
			const feedEl = this.containerEl.createDiv('bases-cms-grid');

			// Render groups with headers
			let displayedSoFar = 0;
			// Images are now handled via background-image, no need to collect img elements
			
			for (const processedGroup of processedGroups) {
				if (displayedSoFar >= this.scrollLayoutManager.getDisplayedCount()) break;

				const entriesToDisplay = Math.min(processedGroup.entries.length, this.scrollLayoutManager.getDisplayedCount() - displayedSoFar);
				if (entriesToDisplay === 0) continue;

				const groupEntries = processedGroup.entries.slice(0, entriesToDisplay);

				// Create group container
				const groupEl = feedEl.createDiv('bases-cms-group');

				// Render group header if key exists
				if (processedGroup.group.hasKey()) {
					const headerEl = groupEl.createDiv('bases-cms-group-heading');
					const valueEl = headerEl.createDiv('bases-cms-group-value');
					const keyValue = processedGroup.group.key?.toString() || '';
					valueEl.setText(keyValue);
				}

				// Render cards in this group
				const cards = transformBasesEntries(
					groupEntries,
					settings,
					sortMethod,
					false,
					this.snippets,
					this.images,
					this.hasImageAvailable
				);

				for (let i = 0; i < cards.length; i++) {
					const card = cards[i];
					const entry = groupEntries[i];
					this.renderCard(groupEl, card, entry, displayedSoFar + i, settings);
				}

				displayedSoFar += entriesToDisplay;
			}
			
			// Images are now set via background-image in renderCard, so no batch loading needed
			// Images will be updated by updateCardImage when they load

			// Restore scroll position after rendering
			if (savedScrollTop > 0) {
				this.containerEl.scrollTop = savedScrollTop;
			}

			// Setup infinite scroll and resize observer
			this.scrollLayoutManager.setupInfiniteScroll(allEntries.length);
			this.scrollLayoutManager.setupResizeObserver();

			// Restore toolbar at the bottom if it was preserved
			if (preservedToolbarEl && this.bulkToolbar) {
				this.containerEl.appendChild(preservedToolbarEl);
				// Update the BulkToolbar's reference to the element
				(this.bulkToolbar as unknown as { toolbarEl?: HTMLElement }).toolbarEl = preservedToolbarEl;
			}
			
			// Update selection UI - but don't hide toolbar if we're refreshing with selection
			if (!this.isRefreshingWithSelection) {
				this.updateSelectionUI();
			} else {
				// Just update card states, don't touch toolbar visibility
				const cards = this.containerEl.querySelectorAll('.card');
				cards.forEach((cardEl) => {
					const path = cardEl.getAttribute('data-path');
					const checkbox = cardEl.querySelector('input[type="checkbox"].selection-checkbox') as HTMLInputElement;
					if (path) {
						const isSelected = this.selectedFiles.has(path);
						if (isSelected) {
							cardEl.addClass('selected');
						} else {
							cardEl.removeClass('selected');
						}
						if (checkbox) {
							checkbox.checked = isSelected;
						}
					}
				});
				
				// Ensure toolbar is visible if it was preserved
				if (preservedToolbarEl && this.bulkToolbar) {
					this.bulkToolbar.show();
					this.bulkToolbar.updateCount(this.selectedFiles.size);
				}
			}

			// Clear loading flag after async work completes
			this.scrollLayoutManager.setIsLoading(false);
		})();
	}

	/**
	 * Direct delete handler for context menu - deletes a single file without selection
	 */
	private getDirectDeleteHandler(filePath: string): () => Promise<void> {
		return async () => {
			const { prepareDeletionPreview, executeSmartDeletion } = await import('../utils/smart-deletion');
			const { DeletionPreviewModal } = await import('../components/deletion-preview');
			
			if (this.plugin.settings.confirmDeletions) {
				const preview = await prepareDeletionPreview(
					this.app,
					[filePath],
					this.plugin.settings
				);

				const modal = new DeletionPreviewModal(
					this.app,
					preview,
					() => {
						// Refresh view after deletion
						this.onDataUpdated();
					}
				);
				modal.open();
			} else {
				// Direct deletion without confirmation
				const preview = await prepareDeletionPreview(
					this.app,
					[filePath],
					this.plugin.settings
				);
				await executeSmartDeletion(this.app, preview);
				// Refresh view after deletion
				this.onDataUpdated();
			}
		};
	}

	private renderCard(
		container: HTMLElement,
		card: CardData,
		entry: BasesEntry,
		index: number,
		settings: CMSSettings
	): void {
		const isSelected = this.selectedFiles.has(card.path);
		return this.cardRenderer.renderCard(
			container,
			card,
			entry,
			settings,
			this,
			isSelected,
			(path: string, selected: boolean) => {
				this.handleSelectionChange(path, selected);
			},
			(path: string, property: string, value: unknown) => {
				void this.handlePropertyToggle(path, property, value);
			},
			{ handleDelete: this.getDirectDeleteHandler(card.path) }
		);
	}

	/**
	 * Update card image when it becomes available
	 * Called asynchronously after images load
	 */
	private updateCardImage(path: string, imageUrl: string | string[]): void {
		const cardEl = this.containerEl.querySelector(`.card[data-path="${path}"]`);
		if (!cardEl) return;

		const url = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
		if (!url) return;

		// Check if image-embed container exists
		let imageEmbedContainer = cardEl.querySelector('.image-embed') as HTMLElement;
		if (!imageEmbedContainer) {
			// No image container - need to create it (replace placeholder)
			const placeholder = cardEl.querySelector('.card-cover-placeholder, .card-thumbnail-placeholder');
			if (placeholder) {
				// Preserve badge if it exists on placeholder
				const existingBadge = placeholder.querySelector('.card-status-badge');
				
				const imageClassName = placeholder.classList.contains('card-cover-placeholder') ? 'card-cover' : 'card-thumbnail';
				const imageEl = placeholder.parentElement?.createDiv(imageClassName);
				if (imageEl) {
					imageEmbedContainer = imageEl.createDiv('image-embed');
					
					// Move badge from placeholder to new image element if it exists
					if (existingBadge) {
						imageEl.appendChild(existingBadge);
					}
					
					placeholder.remove();
				}
			}
		}
		
		// Update background-image on the container
		if (imageEmbedContainer) {
			// Convert GIF to static if setting is enabled
			void (async () => {
				const finalUrl = await convertGifToStatic(url, this.plugin.settings.forceStaticGifImages);
				imageEmbedContainer.style.backgroundImage = `url("${finalUrl}")`;
			})();
			
			// Set initial background image (will be updated if GIF conversion is needed)
			imageEmbedContainer.style.backgroundImage = `url("${url}")`;
			imageEmbedContainer.style.backgroundSize = 'cover';
			imageEmbedContainer.style.backgroundPosition = 'center center';
			imageEmbedContainer.style.backgroundRepeat = 'no-repeat';
		}
	}

	private getSortMethod(): string {
		const sortConfigs = this.config.getSort();
		if (sortConfigs && sortConfigs.length > 0) {
			const firstSort = sortConfigs[0];
			const property = firstSort.property;
			const direction = firstSort.direction.toLowerCase();
			if (property.includes('ctime')) {
				return `ctime-${direction}`;
			}
			if (property.includes('mtime')) {
				return `mtime-${direction}`;
			}
		}
		return 'mtime-desc';
	}



	private handleSelectionChange(path: string, selected: boolean): void {
		if (selected) {
			this.selectedFiles.add(path);
		} else {
			this.selectedFiles.delete(path);
		}
		
		// Always update UI when selection changes - this will hide toolbar if selection is empty
		this.updateSelectionUI();
		
		// Force hide toolbar immediately if selection is empty
		// Do this after updateSelectionUI to ensure it takes precedence
		if (this.selectedFiles.size === 0) {
			if (this.bulkToolbar) {
				// Force immediate hide without waiting for transitions
				this.bulkToolbar.hide();
				// Also directly hide the element as a backup
				const toolbarEl = this.containerEl.querySelector('.bases-cms-bulk-toolbar');
				if (toolbarEl instanceof HTMLElement) {
					toolbarEl.removeClass('bases-cms-bulk-toolbar-visible');
					toolbarEl.addClass('bases-cms-bulk-toolbar-hidden');
				}
			}
		}
	}

	private async handlePropertyToggle(path: string, property: string, value: unknown): Promise<void> {
		await this.propertyToggleHandler.handlePropertyToggle(path, property, value);
	}

	private selectAll(): void {
		const cards = this.containerEl.querySelectorAll('.bases-cms-card');
		cards.forEach((cardEl) => {
			const path = cardEl.getAttribute('data-path');
			if (path) {
				this.selectedFiles.add(path);
			}
		});
		this.updateSelectionUI();
	}

	private deselectAll(): void {
		this.selectedFiles.clear();
		this.updateSelectionUI();
	}

	/**
	 * Refresh the toolbar when settings change
	 * Called from settings tab when toolbar button visibility settings are updated
	 */
	refreshToolbar(): void {
		if (this.bulkToolbar) {
			const currentCount = this.selectedFiles.size;
			this.bulkToolbar.recreate();
			// Update count after recreation
			if (currentCount > 0) {
				this.bulkToolbar.updateCount(currentCount);
			}
		}
	}

	private updateSelectionUI(): void {
		// Update card visual states
		const cards = this.containerEl.querySelectorAll('.card');
		cards.forEach((cardEl) => {
			const path = cardEl.getAttribute('data-path');
			const checkbox = cardEl.querySelector('input[type="checkbox"].selection-checkbox') as HTMLInputElement;
			if (path) {
				const isSelected = this.selectedFiles.has(path);
				if (isSelected) {
					cardEl.addClass('selected');
				} else {
					cardEl.removeClass('selected');
				}
				if (checkbox) {
					checkbox.checked = isSelected;
				}
			}
		});

		// Show/hide bulk toolbar - hide when selection is empty
		// Don't hide if we're in the middle of a refresh that will restore selection
		if (this.selectedFiles.size > 0) {
			// Check if toolbar element already exists in DOM (from previous view switch)
			// Remove any orphaned toolbar elements that might be left over
			const orphanedToolbars = document.querySelectorAll('.bases-cms-bulk-toolbar');
			orphanedToolbars.forEach(toolbar => {
				// Only remove if it's not our current toolbar
				const toolbarInstance = (toolbar as unknown as { __bulkToolbarInstance?: BulkToolbar }).__bulkToolbarInstance;
				if (!toolbarInstance || toolbarInstance !== this.bulkToolbar) {
					toolbar.remove();
				}
			});
			
			// If toolbar doesn't exist, create it
			if (!this.bulkToolbar) {
				const settings = readCMSSettings(
					this.config,
					this.plugin.settings
				);
				this.bulkToolbar = new BulkToolbar(
					this.app,
					this.plugin,
					this.containerEl,
					() => Array.from(this.selectedFiles),
					() => {
						this.selectedFiles.clear();
						this.updateSelectionUI();
					},
					() => {
						// Refresh view but preserve selection
						const selectedPaths = Array.from(this.selectedFiles);
						
						// Set flag to prevent toolbar from being hidden during refresh
						this.isRefreshingWithSelection = true;
						
						// Keep toolbar visible during refresh - critical to prevent it from disappearing
						if (this.bulkToolbar && selectedPaths.length > 0) {
							this.bulkToolbar.show();
						}
						
						// Refresh the view
						this.onDataUpdated();
						
						// Restore selection after refresh completes
						// Use multiple timeouts to ensure it works even if the first one is too early
						window.setTimeout(() => {
							// Restore selection
							selectedPaths.forEach(path => {
								if (this.app.vault.getAbstractFileByPath(path)) {
									this.selectedFiles.add(path);
								}
							});
							
							// Clear the flag and update UI
							this.isRefreshingWithSelection = false;
							this.updateSelectionUI();
							
							// Ensure toolbar is visible and updated
							if (this.selectedFiles.size > 0 && this.bulkToolbar) {
								this.bulkToolbar.show();
								this.bulkToolbar.updateCount(this.selectedFiles.size);
							}
							
							// Double-check after a bit more time
							window.setTimeout(() => {
								if (this.selectedFiles.size > 0 && this.bulkToolbar) {
									this.bulkToolbar.show();
									this.bulkToolbar.updateCount(this.selectedFiles.size);
								}
							}, 100);
						}, 250);
					},
					() => {
						// Select all callback
						this.selectAll();
					},
					settings
				);
			} else {
				// Update settings if toolbar already exists
				const settings = readCMSSettings(
					this.config,
					this.plugin.settings
				);
				this.bulkToolbar.updateSettings(settings);
			}
			this.bulkToolbar.updateCount(this.selectedFiles.size);
			this.bulkToolbar.show();
		} else {
			// Selection is empty - force hide toolbar immediately
			if (this.bulkToolbar && !this.isRefreshingWithSelection) {
				this.bulkToolbar.hide();
				// Force immediate hide as backup
				const toolbarEl = this.containerEl.querySelector('.bases-cms-bulk-toolbar');
				if (toolbarEl instanceof HTMLElement) {
					toolbarEl.removeClass('bases-cms-bulk-toolbar-visible');
					toolbarEl.addClass('bases-cms-bulk-toolbar-hidden');
				}
			}
		}
	}

	onClose(): void {
		this.scrollLayoutManager.cleanup();
		this.viewSwitchListener.cleanup();
		this.propertyObservers.forEach(obs => obs.disconnect());
		this.propertyObservers = [];
		if (this.bulkToolbar) {
			this.bulkToolbar.destroy();
		}
		// Clean up selection and toolbar when view closes
		this.selectedFiles.clear();
		const orphanedToolbars = document.querySelectorAll('.bases-cms-bulk-toolbar');
		orphanedToolbars.forEach(toolbar => toolbar.remove());
		
		// Remove from plugin tracking
		const pluginWithMethod = this.plugin as { removeView?: (view: BasesCMSView) => void };
		if (pluginWithMethod && typeof pluginWithMethod.removeView === 'function') {
			pluginWithMethod.removeView(this);
		}
	}

	/**
	 * Override new note creation to use custom location if configured
	 */
	async onNew(): Promise<boolean> {
		const settings = readCMSSettings(
			this.config,
			this.plugin.settings
		);

		if (settings.customizeNewButton && settings.newNoteLocation && settings.newNoteLocation.trim() !== '') {
			try {
				// Create new note in the specified location
				const folderPath = settings.newNoteLocation.trim().replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
				
				let folder = this.app.vault.getAbstractFileByPath(folderPath);
				
				if (!folder || !('children' in folder)) {
					// Folder doesn't exist, create it first
					await this.app.vault.createFolder(folderPath);
					folder = this.app.vault.getAbstractFileByPath(folderPath);
				}
				
				if (folder && 'children' in folder) {
					// Folder exists, create note there
					const newFile = await this.app.vault.create(`${folderPath}/Untitled.md`, '');
					await this.app.workspace.openLinkText(newFile.path, '', false);
					return true; // Indicate we handled it
				}
			} catch (error) {
				console.error('[CMS View] Error creating new note:', error);
			}
		}
		
		// Default behavior - let Bases handle it
		return false; // Let Bases handle it
	}
}
