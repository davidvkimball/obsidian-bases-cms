/**
 * Bases CMS View
 * Based on Dynamic Views grid implementation
 */

import { BasesView, BasesEntry, QueryController, TFile } from 'obsidian';
import type BasesCMSPlugin from '../main';
import { transformBasesEntries, type CardData, type CMSSettings } from '../shared/data-transform';
import { readCMSSettings } from '../shared/settings-schema';
import { getFirstBasesPropertyValue, getAllBasesImagePropertyValues } from '../utils/property';
import { loadSnippetsForEntries, loadImagesForEntries } from '../shared/content-loader';
import { SharedCardRenderer } from './shared-renderer';
import { BATCH_SIZE } from '../shared/constants';
import { BulkToolbar } from '../components/bulk-toolbar';
import { setupNewNoteInterceptor } from '../utils/new-note-interceptor';
import { PropertyToggleHandler } from '../utils/property-toggle-handler';
import { ViewSwitchListener } from '../utils/view-switch-listener';
import { convertGifToStatic } from '../utils/image';
import { getMinGridColumns, getCardSpacing } from '../utils/style-settings';

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
	private propertyToggleHandler: PropertyToggleHandler | null = null;
	private viewSwitchListener: ViewSwitchListener | null = null;
	
	// Simple infinite scroll properties (like Dynamic Views)
	private displayedCount: number = 50;
	private isLoading: boolean = false;
	private scrollListener: (() => void) | null = null;
	private scrollThrottleTimeout: number | null = null;
	private resizeObserver: ResizeObserver | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: BasesCMSPlugin) {
		super(controller);
		this.containerEl = containerEl;
		this.plugin = plugin;
		
		// Set initial batch size based on device
		const isMobile = (this.app as { isMobile?: boolean }).isMobile ?? false;
		this.displayedCount = isMobile ? 25 : BATCH_SIZE;
		
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

		// Initialize managers with error handling
		try {
			this.propertyToggleHandler = new PropertyToggleHandler(
				this.app,
				this.config as { get: (key: string) => unknown },
				this.plugin.settings,
				() => this.onDataUpdated()
			);
		} catch (error) {
			console.error('Bases CMS: Failed to initialize PropertyToggleHandler:', error);
			this.propertyToggleHandler = null;
		}

		try {
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
		} catch (error) {
			console.error('Bases CMS: Failed to initialize ViewSwitchListener:', error);
			this.viewSwitchListener = null;
		}

		// Setup view switch listener - wraps handleSelectionChange
		if (this.viewSwitchListener) {
			const originalHandleSelectionChange = this.handleSelectionChange.bind(this);
			this.handleSelectionChange = this.viewSwitchListener.setup(originalHandleSelectionChange);
		}
	}
	

	onDataUpdated(): void {
		void (async () => {
			try {
				// Guard: wait for data to be ready - NEVER return early and leave blank screen
				if (!this.data) {
					// Show loading state instead of blank screen
					if (this.containerEl.children.length === 0) {
						const loadingEl = this.containerEl.createDiv('bases-cms-loading');
						loadingEl.setText('Loading...');
						loadingEl.style.padding = '20px';
						loadingEl.style.textAlign = 'center';
					}
					// Retry after a short delay
					setTimeout(() => {
						if (this.data) {
							this.onDataUpdated();
						}
					}, 100);
					return;
				}

				// Ensure we have valid data structures
				if (!this.data.groupedData || !this.data.data) {
					console.warn('Bases CMS: Data structure incomplete, waiting...');
					setTimeout(() => {
						if (this.data && this.data.groupedData && this.data.data) {
							this.onDataUpdated();
						}
					}, 100);
					return;
				}

				const groupedData = this.data.groupedData;
				const allEntries = this.data.data;

				// Read settings from Bases config
				const settings = readCMSSettings(
					this.config,
					this.plugin.settings
				);

				// Calculate grid columns (like Dynamic Views)
				const containerWidth = this.containerEl.clientWidth;
				const cardSize = settings.cardSize;
				const minColumns = getMinGridColumns();
				const gap = getCardSpacing();
				const cols = Math.max(
					minColumns,
					Math.floor((containerWidth + gap) / (cardSize + gap)),
				);

				// Set CSS variables for grid layout
				this.containerEl.style.setProperty("--grid-columns", String(cols));
				this.containerEl.style.setProperty(
					"--dynamic-views-image-aspect-ratio",
					String(settings.imageAspectRatio),
				);

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
				let remainingCount = this.displayedCount;

				for (const processedGroup of processedGroups) {
					if (remainingCount <= 0) break;
					const entriesToTake = Math.min(processedGroup.entries.length, remainingCount);
					visibleEntries.push(...processedGroup.entries.slice(0, entriesToTake));
					remainingCount -= entriesToTake;
				}

				// Load snippets and images ONLY for displayed entries (EXACTLY like dynamic-views)
				await this.loadContentForEntries(visibleEntries, settings);

				// Set up interceptor once config is available (only on first call)
				if (this.config && !(this.containerEl as unknown as { __cmsInterceptorSetup?: boolean }).__cmsInterceptorSetup) {
					try {
						(this.containerEl as unknown as { __cmsInterceptorSetup?: boolean }).__cmsInterceptorSetup = true;
						const containerWithConfig = this.containerEl as unknown as { 
							__cmsConfig?: { get: (key: string) => unknown };
							__cmsView?: BasesCMSView;
						};
						containerWithConfig.__cmsConfig = this.config;
						containerWithConfig.__cmsView = this;
						setupNewNoteInterceptor(
							this.app,
							this.containerEl,
							this.config,
							this.plugin.settings,
							(cleanup) => this.register(cleanup)
						);
					} catch (error) {
						console.warn('Bases CMS: Failed to setup new note interceptor:', error);
						(this.containerEl as unknown as { __cmsInterceptorSetup?: boolean }).__cmsInterceptorSetup = true;
					}
				}

				// Update card renderer with config (now available)
				(this.cardRenderer as unknown as { basesConfig?: { get?: (key: string) => unknown } }).basesConfig = this.config;

				// Clear and re-render (EXACTLY like dynamic-views - after content is loaded)
				// CRITICAL: Only clear if we have entries to render, otherwise we get blank screen
				if (allEntries.length === 0 && groupedData.length === 0) {
					// No data - show empty state instead of blank screen
					this.containerEl.empty();
					const emptyEl = this.containerEl.createDiv('bases-cms-empty');
					emptyEl.setText('No entries found');
					emptyEl.style.padding = '20px';
					emptyEl.style.textAlign = 'center';
					this.isLoading = false;
					return;
				}

				// We have data - clear and render
				this.containerEl.empty();

				// Disconnect old property observers before re-rendering
				this.propertyObservers.forEach(obs => obs.disconnect());
				this.propertyObservers = [];

				// Create cards feed container
				const feedEl = this.containerEl.createDiv('bases-cms-grid');

				// Render groups with headers
				let displayedSoFar = 0;
				let totalCardsRendered = 0;
				
				for (const processedGroup of processedGroups) {
					if (displayedSoFar >= this.displayedCount) break;

					const entriesToDisplay = Math.min(processedGroup.entries.length, this.displayedCount - displayedSoFar);
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
						try {
							this.renderCard(groupEl, card, entry, displayedSoFar + i, settings);
							totalCardsRendered++;
						} catch (error) {
							console.error(`Bases CMS: Error rendering card ${i} for ${entry.file.path}:`, error);
							// Continue rendering other cards even if one fails
						}
					}

					displayedSoFar += entriesToDisplay;
				}

				// CRITICAL: If no cards were rendered, show error instead of blank screen
				if (totalCardsRendered === 0 && allEntries.length > 0) {
					console.error('Bases CMS: No cards rendered despite having entries!');
					this.containerEl.empty();
					const errorEl = this.containerEl.createDiv('bases-cms-error');
					errorEl.setText('Error rendering cards. Check console for details.');
					errorEl.style.padding = '20px';
					errorEl.style.textAlign = 'center';
					errorEl.style.color = 'var(--text-error)';
					this.isLoading = false;
					return;
				}

				// Restore scroll position after rendering
				if (savedScrollTop > 0) {
					this.containerEl.scrollTop = savedScrollTop;
				}

				// Setup infinite scroll (like Dynamic Views)
				this.setupInfiniteScroll(allEntries.length);

				// Setup ResizeObserver for dynamic grid updates (like Dynamic Views)
				if (!this.resizeObserver) {
					this.resizeObserver = new ResizeObserver(() => {
						const containerWidth = this.containerEl.clientWidth;
						const cardSize = settings.cardSize;
						const minColumns = getMinGridColumns();
						const gap = getCardSpacing();
						const cols = Math.max(
							minColumns,
							Math.floor((containerWidth + gap) / (cardSize + gap)),
						);
						this.containerEl.style.setProperty("--grid-columns", String(cols));
					});
					this.resizeObserver.observe(this.containerEl);
					this.register(() => {
						if (this.resizeObserver) {
							this.resizeObserver.disconnect();
						}
					});
				}

				// Update selection UI
				this.updateSelectionUI();

				// Clear loading flag after async work completes
				this.isLoading = false;
			} catch (error) {
				console.error('Bases CMS: Error in onDataUpdated:', error);
				console.error('Bases CMS: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
				
				// Ensure loading flag is cleared even on error
				this.isLoading = false;
				
				// CRITICAL: ALWAYS show something - never leave blank screen
				if (this.containerEl && this.containerEl.isConnected) {
					// Check if container is empty or only has loading message
					const isEmpty = this.containerEl.children.length === 0 || 
						(this.containerEl.children.length === 1 && 
						 this.containerEl.querySelector('.bases-cms-loading'));
					
					if (isEmpty) {
						this.containerEl.empty();
						const errorEl = this.containerEl.createDiv('bases-cms-error');
						errorEl.setText('Error loading view. Check console for details.');
						errorEl.style.padding = '20px';
						errorEl.style.textAlign = 'center';
						errorEl.style.color = 'var(--text-error)';
						errorEl.style.margin = '20px';
					}
					// If container has content, don't clear it - just log the error
				}
			}
		})();
	}

	private setupInfiniteScroll(totalEntries: number): void {
		// Clean up existing listener
		if (this.scrollListener) {
			this.containerEl.removeEventListener("scroll", this.scrollListener);
			this.scrollListener = null;
		}

		// Skip if all items already displayed
		if (this.displayedCount >= totalEntries) {
			return;
		}

		// Create scroll handler with throttling
		this.scrollListener = () => {
			// Throttle: skip if cooldown active
			if (this.scrollThrottleTimeout !== null) {
				return;
			}

			// Skip if already loading
			if (this.isLoading) {
				return;
			}

			// Calculate distance from bottom
			const scrollTop = this.containerEl.scrollTop;
			const scrollHeight = this.containerEl.scrollHeight;
			const clientHeight = this.containerEl.clientHeight;
			const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

			// Dynamic threshold based on viewport and device
			const isMobile = (this.app as { isMobile?: boolean }).isMobile ?? false;
			const viewportMultiplier = isMobile ? 1 : 2;
			const threshold = clientHeight * viewportMultiplier;

			// Check if should load more
			if (
				distanceFromBottom < threshold &&
				this.displayedCount < totalEntries
			) {
				this.isLoading = true;

				// Dynamic batch size: 50 items
				const batchSize = 50;
				this.displayedCount = Math.min(
					this.displayedCount + batchSize,
					totalEntries,
				);

				// Re-render (this will call setupInfiniteScroll again)
				this.onDataUpdated();
			}

			// Start throttle cooldown
			this.scrollThrottleTimeout = window.setTimeout(() => {
				this.scrollThrottleTimeout = null;
			}, 100);
		};

		// Attach listener
		this.containerEl.addEventListener("scroll", this.scrollListener);

		// Register cleanup
		this.register(() => {
			if (this.scrollListener) {
				this.containerEl.removeEventListener("scroll", this.scrollListener);
			}
			if (this.scrollThrottleTimeout !== null) {
				window.clearTimeout(this.scrollThrottleTimeout);
			}
		});
	}

	private async loadContentForEntries(
		entries: BasesEntry[],
		settings: CMSSettings
	): Promise<void> {
		try {
			// Load snippets for text preview
			if (settings.showTextPreview) {
				const snippetEntries = entries
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

				if (snippetEntries.length > 0) {
					await loadSnippetsForEntries(
						snippetEntries,
						settings.fallbackToContent,
						false,
						this.app,
						this.snippets
					);
				}
			}

			// Load images for thumbnails
			if (settings.imageFormat !== 'none') {
				const imageEntries = entries
					.filter(entry => !(entry.file.path in this.images))
					.map(entry => {
						const file = this.app.vault.getAbstractFileByPath(entry.file.path);
						if (!(file instanceof TFile)) return null;
						const imagePropertyValues = getAllBasesImagePropertyValues(entry, settings.imageProperty);
						return {
							path: entry.file.path,
							file,
							imagePropertyValues: imagePropertyValues as unknown[]
						};
					})
					.filter((e): e is NonNullable<typeof e> => e !== null);

				if (imageEntries.length > 0) {
					await loadImagesForEntries(
						imageEntries,
						settings.fallbackToEmbeds === false ? 'never' : (settings.fallbackToEmbeds === true ? 'always' : settings.fallbackToEmbeds),
						this.app,
						this.images,
						this.hasImageAvailable
					);
				}
			}
		} catch (error) {
			console.error('Bases CMS: Error in loadContentForEntries:', error);
			throw error; // Re-throw to be caught by outer handler
		}
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
		const cardEl = this.containerEl.querySelector(`.card[data-path="${path}"]`) as HTMLElement;
		if (!cardEl) return;

		const url = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
		if (!url) return;

		// Check if image-embed container exists
		let imageEmbedContainer = cardEl.querySelector('.image-embed') as HTMLElement;
		if (!imageEmbedContainer) {
			// No image container - need to create it
			const placeholder = cardEl.querySelector('.card-cover-placeholder, .card-thumbnail-placeholder');
			const isThumbnail = cardEl.classList.contains('image-format-thumbnail');
			const isCover = cardEl.classList.contains('image-format-cover');
			
			if (placeholder) {
				// Replace placeholder
				const existingBadge = placeholder.querySelector('.card-status-badge');
				const imageClassName = placeholder.classList.contains('card-cover-placeholder') ? 'card-cover' : 'card-thumbnail';
				const imageEl = placeholder.parentElement?.createDiv(imageClassName);
				if (imageEl) {
					imageEmbedContainer = imageEl.createDiv('image-embed');
					if (existingBadge) {
						imageEl.appendChild(existingBadge);
					}
					placeholder.remove();
				}
			} else if (isThumbnail) {
				// For thumbnails, create element directly in contentContainer (no placeholders)
				const contentContainer = cardEl.querySelector('.card-content') as HTMLElement;
				if (contentContainer) {
					// Insert thumbnail BEFORE text-wrapper for proper positioning
					const textWrapper = contentContainer.querySelector('.card-text-wrapper');
					const imageEl = textWrapper
						? contentContainer.insertBefore(contentContainer.createDiv('card-thumbnail'), textWrapper)
						: contentContainer.createDiv('card-thumbnail');
					imageEmbedContainer = imageEl.createDiv('image-embed');
				}
			} else if (isCover) {
				// For cover, create in contentContainer
				const contentContainer = cardEl.querySelector('.card-content') as HTMLElement;
				if (contentContainer) {
					const imageEl = contentContainer.createDiv('card-cover');
					imageEmbedContainer = imageEl.createDiv('image-embed');
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
		if (this.propertyToggleHandler) {
			await this.propertyToggleHandler.handlePropertyToggle(path, property, value);
		}
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
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
		if (this.viewSwitchListener) {
			this.viewSwitchListener.cleanup();
		}
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
		const pluginWithMethod = this.plugin as unknown as { removeView?: (view: BasesCMSView) => void };
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

		if (settings.customizeNewButton) {
			try {
				const locationInput = settings.newNoteLocation?.trim() || '';
				
				// If location is empty, use Obsidian's default new note location
				if (locationInput === '') {
					// Use Obsidian's default new note creation behavior
					const vaultConfig = (this.app.vault as { config?: { newFileLocation?: string; newFileFolderPath?: string } }).config;
					const newFileLocation = vaultConfig?.newFileLocation || 'folder';
					const newFileFolderPath = vaultConfig?.newFileFolderPath || '';
					
					let filePath = 'Untitled.md';
					
					// Handle Obsidian's new file location settings
					if (newFileLocation === 'folder' && newFileFolderPath) {
						filePath = `${newFileFolderPath}/Untitled.md`;
					} else if (newFileLocation === 'current') {
						const activeFile = this.app.workspace.getActiveFile();
						if (activeFile && activeFile.parent) {
							filePath = `${activeFile.parent.path}/Untitled.md`;
						}
					} else if (newFileLocation === 'root') {
						filePath = 'Untitled.md';
					}
					
					const file = await this.app.vault.create(filePath, '');
					await this.app.workspace.openLinkText(file.path, '', false);
					return true;
				}
				
				// If location is "/" or just slashes, use vault root
				if (locationInput === '/' || locationInput.replace(/\//g, '') === '') {
					const newFile = await this.app.vault.create('Untitled.md', '');
					await this.app.workspace.openLinkText(newFile.path, '', false);
					return true;
				}
				
				// Otherwise, use the specified folder
				const folderPath = locationInput.replace(/^\/+|\/+$/g, '');
				
				let folder = this.app.vault.getAbstractFileByPath(folderPath);
				
				if (!folder || !('children' in folder)) {
					await this.app.vault.createFolder(folderPath);
					folder = this.app.vault.getAbstractFileByPath(folderPath);
				}
				
				if (folder && 'children' in folder) {
					const newFile = await this.app.vault.create(`${folderPath}/Untitled.md`, '');
					await this.app.workspace.openLinkText(newFile.path, '', false);
					return true;
				}
			} catch (error) {
				console.error('[CMS View] Error creating new note:', error);
			}
		}
		
		// Default behavior - let Bases handle it
		return false;
	}
}
