/**
 * Bases CMS View
 */

import { BasesView, BasesEntry, QueryController, TFile } from 'obsidian';
import { setCssProps } from '../utils/css-props';
import type BasesCMSPlugin from '../main';
import { transformBasesEntries, type CardData, type CMSSettings } from '../shared/data-transform';
import { readCMSSettings } from '../shared/settings-schema';
import { getFirstBasesPropertyValue, getAllBasesImagePropertyValues } from '../utils/property';
import { loadSnippetsForEntries, loadImagesForEntries } from '../shared/content-loader';
import { SharedCardRenderer } from './shared-renderer';
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
	private propertyToggleHandler: PropertyToggleHandler | null = null;
	private scrollLayoutManager: ScrollLayoutManager;
	private viewSwitchListener: ViewSwitchListener | null = null;
	private settingsPollInterval: number | null = null;
	private lastSettings: Partial<CMSSettings> | null = null;

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
		
		// Initialize managers with error handling
		try {
		this.propertyToggleHandler = new PropertyToggleHandler(
			this.app,
			this.config as { get: (key: string) => unknown },
			this.plugin.settings,
			() => this.onDataUpdated()
		);
		} catch {
			this.propertyToggleHandler = null;
		}

		try {
			// Check if config is available, otherwise use a safe fallback
			const configToUse = (this.config && typeof (this.config as { get?: (key: string) => unknown }).get === 'function')
				? (this.config as { get: (key: string) => unknown })
				: { get: () => undefined };
			
			this.scrollLayoutManager = new ScrollLayoutManager(
				this.containerEl,
				this.app,
				configToUse,
				this.plugin.settings,
				() => this.onDataUpdated(),
				(cleanup) => this.register(cleanup)
			);
		} catch {
			// Create a minimal fallback with a dummy config
			const dummyConfig = { get: () => undefined };
			this.scrollLayoutManager = new ScrollLayoutManager(
				this.containerEl,
				this.app,
				dummyConfig,
				this.plugin.settings,
				() => this.onDataUpdated(),
				(cleanup) => this.register(cleanup)
			);
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
		} catch {
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
						setCssProps(loadingEl, {
							padding: '20px',
							textAlign: 'center'
						});
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

			// Update config reference in scroll layout manager if it's now available
			if (this.config && typeof (this.config as { get?: (key: string) => unknown }).get === 'function') {
				try {
					this.scrollLayoutManager.updateConfig(this.config as { get: (key: string) => unknown });
				} catch {
					// Ignore - config update is optional
				}
			}

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

			// Load snippets and images ONLY for displayed entries
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
				} catch {
					// Failed to setup interceptor - continue anyway
					(this.containerEl as unknown as { __cmsInterceptorSetup?: boolean }).__cmsInterceptorSetup = true;
				}
			}

			// Update card renderer with config (now available)
			(this.cardRenderer as unknown as { basesConfig?: { get?: (key: string) => unknown } }).basesConfig = this.config;

			// Clear and re-render after content is loaded
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
					try {
						this.renderCard(groupEl, card, entry, displayedSoFar + i, settings);
						totalCardsRendered++;
					} catch {
						// Continue rendering other cards even if one fails
					}
				}

				displayedSoFar += entriesToDisplay;
			}
			
			// CRITICAL: If no cards were rendered, show error instead of blank screen
			if (totalCardsRendered === 0 && allEntries.length > 0) {
				throw new Error('No cards were rendered despite having entries. Check card rendering logic.');
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
			
			// Setup settings polling to detect changes and refresh view
			this.setupSettingsPolling(settings);

			// Update selection UI
			this.updateSelectionUI();

				// Clear loading flag after async work completes
				this.scrollLayoutManager.setIsLoading(false);
			} catch {
				// Ensure loading flag is cleared even on error
				try {
					this.scrollLayoutManager.setIsLoading(false);
				} catch {
					// Ignore cleanup errors
				}
				
				// If container is empty due to error, show error message
				if (this.containerEl && this.containerEl.isConnected) {
					this.containerEl.empty();
					const errorEl = this.containerEl.createDiv('bases-cms-error');
					errorEl.setText('Error loading view. Check console for details.');
					setCssProps(errorEl, {
						padding: '20px',
						textAlign: 'center',
						color: 'var(--text-error)',
						margin: '20px'
					});
				}
			}
		})();
	}

	/**
	 * Setup polling to detect settings changes and refresh view
	 */
	private setupSettingsPolling(initialSettings: CMSSettings): void {
		// Only set up once
		if (this.settingsPollInterval !== null) {
			return;
		}

		// Store initial settings for comparison
		this.lastSettings = {
			descriptionProperty: initialSettings.descriptionProperty,
			showTextPreview: initialSettings.showTextPreview,
			fallbackToContent: initialSettings.fallbackToContent,
			truncatePreviewProperty: initialSettings.truncatePreviewProperty,
			imageProperty: initialSettings.imageProperty,
			imageFormat: initialSettings.imageFormat,
			fallbackToEmbeds: initialSettings.fallbackToEmbeds,
			propertyDisplay1: initialSettings.propertyDisplay1,
			propertyDisplay2: initialSettings.propertyDisplay2,
			propertyDisplay3: initialSettings.propertyDisplay3,
			propertyDisplay4: initialSettings.propertyDisplay4,
			propertyDisplay5: initialSettings.propertyDisplay5,
			propertyDisplay6: initialSettings.propertyDisplay6,
			propertyDisplay7: initialSettings.propertyDisplay7,
			propertyDisplay8: initialSettings.propertyDisplay8,
			propertyDisplay9: initialSettings.propertyDisplay9,
			propertyDisplay10: initialSettings.propertyDisplay10,
			propertyDisplay11: initialSettings.propertyDisplay11,
			propertyDisplay12: initialSettings.propertyDisplay12,
			propertyDisplay13: initialSettings.propertyDisplay13,
			propertyDisplay14: initialSettings.propertyDisplay14,
		};

		// Poll every 100ms to check for settings changes
		this.settingsPollInterval = window.setInterval(() => {
			if (!this.config || typeof this.config.get !== 'function') {
				return; // Config not ready yet
			}

			const currentSettings = readCMSSettings(
				this.config,
				this.plugin.settings
			);

			// Skip if lastSettings is not initialized yet
			if (!this.lastSettings) {
				return;
			}

			// Check if any relevant settings have changed
			const settingsChanged = 
				this.lastSettings.descriptionProperty !== currentSettings.descriptionProperty ||
				this.lastSettings.showTextPreview !== currentSettings.showTextPreview ||
				this.lastSettings.fallbackToContent !== currentSettings.fallbackToContent ||
				this.lastSettings.truncatePreviewProperty !== currentSettings.truncatePreviewProperty ||
				this.lastSettings.imageProperty !== currentSettings.imageProperty ||
				this.lastSettings.imageFormat !== currentSettings.imageFormat ||
				this.lastSettings.fallbackToEmbeds !== currentSettings.fallbackToEmbeds ||
				this.lastSettings.propertyDisplay1 !== currentSettings.propertyDisplay1 ||
				this.lastSettings.propertyDisplay2 !== currentSettings.propertyDisplay2 ||
				this.lastSettings.propertyDisplay3 !== currentSettings.propertyDisplay3 ||
				this.lastSettings.propertyDisplay4 !== currentSettings.propertyDisplay4 ||
				this.lastSettings.propertyDisplay5 !== currentSettings.propertyDisplay5 ||
				this.lastSettings.propertyDisplay6 !== currentSettings.propertyDisplay6 ||
				this.lastSettings.propertyDisplay7 !== currentSettings.propertyDisplay7 ||
				this.lastSettings.propertyDisplay8 !== currentSettings.propertyDisplay8 ||
				this.lastSettings.propertyDisplay9 !== currentSettings.propertyDisplay9 ||
				this.lastSettings.propertyDisplay10 !== currentSettings.propertyDisplay10 ||
				this.lastSettings.propertyDisplay11 !== currentSettings.propertyDisplay11 ||
				this.lastSettings.propertyDisplay12 !== currentSettings.propertyDisplay12 ||
				this.lastSettings.propertyDisplay13 !== currentSettings.propertyDisplay13 ||
				this.lastSettings.propertyDisplay14 !== currentSettings.propertyDisplay14;

			if (settingsChanged) {
				// Clear caches when relevant settings change
				if (this.lastSettings.descriptionProperty !== currentSettings.descriptionProperty ||
					this.lastSettings.showTextPreview !== currentSettings.showTextPreview ||
					this.lastSettings.fallbackToContent !== currentSettings.fallbackToContent ||
					this.lastSettings.truncatePreviewProperty !== currentSettings.truncatePreviewProperty) {
					// Clear snippet cache when text preview settings change
					this.snippets = {};
				}

				if (this.lastSettings.imageProperty !== currentSettings.imageProperty ||
					this.lastSettings.imageFormat !== currentSettings.imageFormat ||
					this.lastSettings.fallbackToEmbeds !== currentSettings.fallbackToEmbeds) {
					// Clear image cache when image settings change
					this.images = {};
					this.hasImageAvailable = {};
				}

				// Update last settings
				this.lastSettings = {
					descriptionProperty: currentSettings.descriptionProperty,
					showTextPreview: currentSettings.showTextPreview,
					fallbackToContent: currentSettings.fallbackToContent,
					truncatePreviewProperty: currentSettings.truncatePreviewProperty,
					imageProperty: currentSettings.imageProperty,
					imageFormat: currentSettings.imageFormat,
					fallbackToEmbeds: currentSettings.fallbackToEmbeds,
					propertyDisplay1: currentSettings.propertyDisplay1,
					propertyDisplay2: currentSettings.propertyDisplay2,
					propertyDisplay3: currentSettings.propertyDisplay3,
					propertyDisplay4: currentSettings.propertyDisplay4,
					propertyDisplay5: currentSettings.propertyDisplay5,
					propertyDisplay6: currentSettings.propertyDisplay6,
					propertyDisplay7: currentSettings.propertyDisplay7,
					propertyDisplay8: currentSettings.propertyDisplay8,
					propertyDisplay9: currentSettings.propertyDisplay9,
					propertyDisplay10: currentSettings.propertyDisplay10,
					propertyDisplay11: currentSettings.propertyDisplay11,
					propertyDisplay12: currentSettings.propertyDisplay12,
					propertyDisplay13: currentSettings.propertyDisplay13,
					propertyDisplay14: currentSettings.propertyDisplay14,
				};

				// Trigger view refresh
				this.onDataUpdated();
			}
		}, 100);

		// Register cleanup
		this.register(() => {
			if (this.settingsPollInterval !== null) {
				window.clearInterval(this.settingsPollInterval);
				this.settingsPollInterval = null;
			}
		});
	}

	private async loadContentForEntries(
		entries: BasesEntry[],
		settings: CMSSettings
	): Promise<void> {
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
					this.snippets,
					settings.truncatePreviewProperty
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
					settings.fallbackToEmbeds,
					this.app,
					this.images,
					this.hasImageAvailable
				);
			}
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
		setCssProps(imageEmbedContainer, {
				backgroundSize: 'cover',
				backgroundPosition: 'center center',
				backgroundRepeat: 'no-repeat'
			});
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
		this.scrollLayoutManager.cleanup();
		if (this.viewSwitchListener) {
		this.viewSwitchListener.cleanup();
		}
		if (this.settingsPollInterval !== null) {
			window.clearInterval(this.settingsPollInterval);
			this.settingsPollInterval = null;
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
			} catch {
				// Error creating new note - silently fail
			}
		}
		
		// Default behavior - let Bases handle it
		return false;
	}
}
