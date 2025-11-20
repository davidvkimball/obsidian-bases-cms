/**
 * Bases CMS View
 * Based on Dynamic Views grid implementation
 */

import { BasesView, BasesEntry, QueryController, TFile } from 'obsidian';
import type BasesCMSPlugin from '../main';
import { transformBasesEntries } from '../shared/data-transform';
import { readCMSSettings, getCMSViewOptions } from '../shared/settings-schema';
import { getFirstBasesPropertyValue, getAllBasesImagePropertyValues } from '../utils/property';
import { loadSnippetsForEntries, loadImagesForEntriesSync, loadEmbedImagesForEntries } from '../shared/content-loader';
import { SharedCardRenderer } from './shared-renderer';
import { BATCH_SIZE, GAP_SIZE } from '../shared/constants';
import { BulkToolbar } from '../components/bulk-toolbar';

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
	private displayedCount: number = 50;
	private isLoading: boolean = false;
	private scrollListener: (() => void) | null = null;
	private scrollThrottleTimeout: number | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private propertyObservers: ResizeObserver[] = [];
	private cardRenderer: SharedCardRenderer;
	private bulkToolbar: BulkToolbar | null = null;
	private isRefreshingWithSelection: boolean = false;
	private currentBaseIdentifier: string | null = null;

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
		this.containerEl.style.overflowY = 'auto';
		this.containerEl.style.overflowX = 'hidden';
		this.containerEl.style.height = '100%';
		
		// Set initial batch size based on device (matches Dynamic Views)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const isMobile = (this.app as any).isMobile;
		this.displayedCount = isMobile ? 25 : BATCH_SIZE;

		// Intercept new note button clicks
		this.setupNewNoteInterceptor();
		
		// Listen for view switches to clear selection when switching away
		this.setupViewSwitchListener();
	}
	
	/**
	 * Setup listener to ensure toolbar hides when selection becomes empty
	 * Uses MutationObserver to watch for card removal (view switches)
	 */
	private setupViewSwitchListener(): void {
		let mutationObserver: MutationObserver | null = null;
		
		const startObserving = () => {
			if (mutationObserver) return; // Already observing
			
			mutationObserver = new MutationObserver((mutations) => {
				// Only check if we have selection
				if (this.selectedFiles.size === 0) {
					return;
				}
				
				// Check if any cards were removed
				for (const mutation of mutations) {
					if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
						// Cards were removed - check if our selected cards are gone
						let foundSelectedCard = false;
						for (const path of this.selectedFiles) {
							const card = this.containerEl.querySelector(`[data-path="${path}"]`);
							if (card) {
								foundSelectedCard = true;
								break;
							}
						}
						
						// Also check if container has any cards at all
						const allCards = this.containerEl.querySelectorAll('.card[data-path]');
						
						if (!foundSelectedCard || allCards.length === 0) {
							this.selectedFiles.clear();
							this.updateSelectionUI();
							break;
						}
					}
				}
			});
			
			// Observe the container for child removals
			if (this.containerEl) {
				mutationObserver.observe(this.containerEl, {
					childList: true,
					subtree: true
				});
			}
		};
		
		const stopObserving = () => {
			if (mutationObserver) {
				mutationObserver.disconnect();
				mutationObserver = null;
				
				// When observer stops, it means selection is empty or view switched
				// Force clear selection and hide toolbar
				if (this.selectedFiles.size > 0) {
					this.selectedFiles.clear();
				}
				this.updateSelectionUI();
				
				// Force hide toolbar immediately
				if (this.bulkToolbar) {
					this.bulkToolbar.hide();
				}
				const toolbarEl = this.containerEl.querySelector('.bases-cms-bulk-toolbar');
				if (toolbarEl) {
					(toolbarEl as HTMLElement).style.display = 'none';
					(toolbarEl as HTMLElement).style.opacity = '0';
				}
			}
		};
		
		// Get base identifier - try multiple methods
		const getBaseIdentifier = (): string | null => {
			try {
				// Try to get base name from config
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const config = this.config as any;
				if (config?.getName) {
					return config.getName();
				}
				if (config?.name) {
					return String(config.name);
				}
				// Try to access controller through parent class
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = this as any;
				if (view.controller) {
					const controller = view.controller;
					if (controller?.getBaseName) {
						return controller.getBaseName();
					}
					if (controller?.baseName) {
						return String(controller.baseName);
					}
				}
				// Try to get from data
				if (this.data) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const data = this.data as any;
					if (data.baseName) {
						return String(data.baseName);
					}
				}
			} catch (e) {
				// Ignore errors
			}
			return null;
		};
		
		// Also check periodically as backup (slower, 500ms)
		let backupInterval: number | null = null;
		const backupCheck = () => {
			if (this.selectedFiles.size === 0) {
				if (backupInterval !== null) {
					window.clearInterval(backupInterval);
					backupInterval = null;
				}
				return;
			}
			
			// Check if base identifier changed
			const currentBaseId = getBaseIdentifier();
			if (this.currentBaseIdentifier !== null && currentBaseId !== null && 
				this.currentBaseIdentifier !== currentBaseId) {
				this.selectedFiles.clear();
				this.updateSelectionUI();
				stopObserving();
				if (backupInterval !== null) {
					window.clearInterval(backupInterval);
					backupInterval = null;
				}
				return;
			}
			
			// Check if container has cards
			const allCards = this.containerEl.querySelectorAll('.card[data-path]');
			if (allCards.length === 0) {
				this.selectedFiles.clear();
				this.updateSelectionUI();
			}
		};
		
		// Start observing when selection is made
		const originalHandleSelectionChange = this.handleSelectionChange.bind(this);
		this.handleSelectionChange = (path: string, selected: boolean) => {
			originalHandleSelectionChange(path, selected);
			
			// Start observing if we have selection, stop if we don't
			if (this.selectedFiles.size > 0) {
				// Store current base identifier when selection starts
				if (this.currentBaseIdentifier === null) {
					this.currentBaseIdentifier = getBaseIdentifier();
				}
				startObserving();
				// Also start backup interval
				if (backupInterval === null) {
					backupInterval = window.setInterval(backupCheck, 500);
				}
			} else {
				// Clear base identifier when selection is empty
				this.currentBaseIdentifier = null;
				// Selection became empty - stop observing and force hide toolbar
				stopObserving();
				if (backupInterval !== null) {
					window.clearInterval(backupInterval);
					backupInterval = null;
				}
				// Force hide toolbar
				if (this.bulkToolbar) {
					this.bulkToolbar.hide();
				}
				const toolbarEl = this.containerEl.querySelector('.bases-cms-bulk-toolbar');
				if (toolbarEl) {
					(toolbarEl as HTMLElement).style.display = 'none';
					(toolbarEl as HTMLElement).style.opacity = '0';
				}
			}
		};
		
		// Register cleanup
		this.register(() => {
			stopObserving();
			if (backupInterval !== null) {
				window.clearInterval(backupInterval);
			}
		});
	}
	

	/**
	 * Setup interceptor for new note button
	 */
	private setupNewNoteInterceptor(): void {
		const handleNewButtonClick = async (e: MouseEvent) => {
			// Check if this is the new button - must be very specific to avoid interfering with other clicks
			const target = e.target as HTMLElement;
			const buttonEl = target.closest('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
			
			if (!buttonEl) {
				return; // Not the new button, let event continue normally
			}
			
			// Don't interfere with clicks inside the bulk toolbar or other CMS elements
			if (target.closest('.bases-cms-bulk-toolbar, .bases-cms-container .card')) {
				return; // Let these clicks work normally
			}
			
			console.log('[CMS View] New button clicked!', buttonEl);
			
			// Check if this view is active - find the workspace leaf containing our container
			const workspaceLeaf = this.app.workspace.getLeavesOfType(CMS_VIEW_TYPE).find(leaf => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const view = leaf.view as any;
				return view && view.containerEl === this.containerEl;
			});
			
			// Check if this leaf is the active one
			const activeLeaf = this.app.workspace.activeLeaf;
			const isActive = workspaceLeaf && activeLeaf && workspaceLeaf === activeLeaf;
			
			if (!isActive) {
				console.log('[CMS View] Not our active view, skipping. Active leaf:', activeLeaf, 'Our leaf:', workspaceLeaf);
				return; // Not our view, let event continue normally
			}
			
			const settings = readCMSSettings(
				this.config,
				this.plugin.settings
			);

			console.log('[CMS View] Settings:', {
				customizeNewButton: settings.customizeNewButton,
				newNoteLocation: settings.newNoteLocation
			});

			if (settings.customizeNewButton) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				
				const locationInput = settings.newNoteLocation?.trim() || '';
				
				// If location is empty, use Obsidian's default new note location
				if (locationInput === '') {
					console.log('[CMS View] Using Obsidian default new note location');
					// Use Obsidian's default new note creation behavior
					// Access Obsidian's vault config directly
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const vaultConfig = (this.app.vault as any).config;
					const newFileLocation = vaultConfig?.newFileLocation || 'folder';
					const newFileFolderPath = vaultConfig?.newFileFolderPath || '';
					
					console.log('[CMS View] Obsidian config:', { newFileLocation, newFileFolderPath });
					
					let filePath = 'Untitled.md';
					
					// Handle Obsidian's new file location settings
					if (newFileLocation === 'folder' && newFileFolderPath) {
						// Create in specified folder
						filePath = `${newFileFolderPath}/Untitled.md`;
					} else if (newFileLocation === 'current') {
						// Create in current file's folder
						const activeFile = this.app.workspace.getActiveFile();
						if (activeFile && activeFile.parent) {
							filePath = `${activeFile.parent.path}/Untitled.md`;
						}
						// If no active file, fall through to vault root
					} else if (newFileLocation === 'root') {
						// Create in vault root (already set)
						filePath = 'Untitled.md';
					}
					// For 'folder' without path or any other value, default to vault root
					
					console.log('[CMS View] Creating file at:', filePath);
					const file = await this.app.vault.create(filePath, '');
					await this.app.workspace.openLinkText(file.path, '', false);
					return;
				}
				
				// If location is "/" or just slashes, use vault root
				if (locationInput === '/' || locationInput.replace(/\//g, '') === '') {
					console.log('[CMS View] Creating note in vault root');
					try {
						// Explicitly create in vault root (no folder path)
						const newFile = await this.app.vault.create('Untitled.md', '');
						await this.app.workspace.openLinkText(newFile.path, '', false);
					} catch (error) {
						console.error('[CMS View] Error creating new note:', error);
					}
					return;
				}
				
				// Otherwise, use the specified folder
				console.log('[CMS View] Intercepting and creating note in:', locationInput);
				
				try {
					const folderPath = locationInput.replace(/^\/+|\/+$/g, '');
					console.log('[CMS View] Folder path:', folderPath);
					
					let folder = this.app.vault.getAbstractFileByPath(folderPath);
					
					if (!folder || !('children' in folder)) {
						console.log('[CMS View] Folder does not exist, creating:', folderPath);
						await this.app.vault.createFolder(folderPath);
						folder = this.app.vault.getAbstractFileByPath(folderPath);
					}
					
					if (folder && 'children' in folder) {
						const newFile = await this.app.vault.create(`${folderPath}/Untitled.md`, '');
						console.log('[CMS View] Created new file:', newFile.path);
						await this.app.workspace.openLinkText(newFile.path, '', false);
					} else {
						console.error('[CMS View] Failed to create or access folder:', folderPath);
					}
				} catch (error) {
					console.error('[CMS View] Error creating new note:', error);
				}
			} else {
				console.log('[CMS View] Custom new button not enabled');
				// Don't prevent default if setting is not enabled
			}
		};

		// Intercept clicks on the new button - use capture phase to catch before Bases
		const interceptNewButton = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const buttonEl = target.closest('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
			
			if (!buttonEl) {
				return; // Not the new button
			}
			
			// Don't interfere with clicks inside the bulk toolbar or other CMS elements
			if (target.closest('.bases-cms-bulk-toolbar, .bases-cms-container .card')) {
				return; // Let these clicks work normally
			}
			
			// Check if this view is active - check if the button is within our view's container
			// or if the active leaf contains our container
			const activeLeaf = this.app.workspace.activeLeaf;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const activeView = activeLeaf?.view as any;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const activeLeafContainer = (activeLeaf as any)?.containerEl;
			const isOurView = activeView && (
				activeView.containerEl === this.containerEl ||
				activeView === this ||
				(buttonEl.closest('.workspace-leaf') === activeLeafContainer)
			);
			
			if (!isOurView) {
				return; // Not our view
			}
			
			const settings = readCMSSettings(
				this.config,
				this.plugin.settings
			);

			if (settings.customizeNewButton) {
				// Always prevent default to stop the preview popup - do this FIRST
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				
				// Handle the note creation asynchronously
				void (async () => {
					const locationInput = settings.newNoteLocation?.trim() || '';
					
					// If location is empty, use Obsidian's default new note location
					if (locationInput === '') {
						// Use Obsidian's default new note creation behavior
						// Access Obsidian's vault config directly
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const vaultConfig = (this.app.vault as any).config;
						const newFileLocation = vaultConfig?.newFileLocation || 'folder';
						const newFileFolderPath = vaultConfig?.newFileFolderPath || '';
						
						console.log('[CMS View] Obsidian config:', { newFileLocation, newFileFolderPath });
						
						let filePath = 'Untitled.md';
						
						// Handle Obsidian's new file location settings
						if (newFileLocation === 'folder' && newFileFolderPath) {
							// Create in specified folder
							filePath = `${newFileFolderPath}/Untitled.md`;
						} else if (newFileLocation === 'current') {
							// Create in current file's folder
							const activeFile = this.app.workspace.getActiveFile();
							if (activeFile && activeFile.parent) {
								filePath = `${activeFile.parent.path}/Untitled.md`;
							}
							// If no active file, fall through to vault root
						} else if (newFileLocation === 'root') {
							// Create in vault root (already set)
							filePath = 'Untitled.md';
						}
						// For 'folder' without path or any other value, default to vault root
						
						console.log('[CMS View] Creating file at:', filePath);
						const file = await this.app.vault.create(filePath, '');
						await this.app.workspace.openLinkText(file.path, '', false);
						return;
					}
					
					// If location is "/" or just slashes, use vault root
					if (locationInput === '/' || locationInput.replace(/\//g, '') === '') {
						// Explicitly create in vault root (no folder path)
						const newFile = await this.app.vault.create('Untitled.md', '');
						await this.app.workspace.openLinkText(newFile.path, '', false);
						return;
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
					}
				})();
			}
		};

		// Add event listener to document with capture phase to intercept before Bases
		document.addEventListener('click', interceptNewButton as EventListener, true);
		
		// Also try to intercept on the button directly when it appears
		const observer = new MutationObserver(() => {
			const buttons = document.querySelectorAll('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
			buttons.forEach((buttonEl) => {
				if (!(buttonEl as any).__cmsIntercepted) {
					(buttonEl as any).__cmsIntercepted = true;
					buttonEl.addEventListener('click', interceptNewButton as EventListener, true);
				}
			});
		});

		observer.observe(document.body, { childList: true, subtree: true });
		
		// Check immediately
		const buttons = document.querySelectorAll('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
		buttons.forEach((buttonEl) => {
			if (!(buttonEl as any).__cmsIntercepted) {
				(buttonEl as any).__cmsIntercepted = true;
				buttonEl.addEventListener('click', interceptNewButton as EventListener, true);
			}
		});
		
		// Register cleanup
		this.register(() => {
			document.removeEventListener('click', interceptNewButton as EventListener, true);
			observer.disconnect();
		});
	}

	onDataUpdated(): void {
		// Check if we're still the active view in the active leaf
		// If onDataUpdated is called but we're not the active view, we've been switched away
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const activeLeaf = this.app.workspace.activeLeaf;
		if (activeLeaf && this.selectedFiles.size > 0) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const activeView = activeLeaf.view as any;
			// If active view is not this instance, we've been switched away
			if (activeView && activeView !== this) {
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const activeViewContainer = activeView.containerEl;
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

			// Update card renderer with config (now available)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(this.cardRenderer as any).basesConfig = this.config;

			// Read settings from Bases config
			const settings = readCMSSettings(
				this.config,
				this.plugin.settings
			);

			// Calculate grid columns
			const containerWidth = this.containerEl.clientWidth;
			const cardMinWidth = settings.cardSize; // Card size from settings
			const minColumns = 1;
			const gap = GAP_SIZE;
			const cols = Math.max(minColumns, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
			const cardWidth = (containerWidth - (gap * (cols - 1))) / cols;

			// Set CSS variables for grid layout
			this.containerEl.style.setProperty('--card-min-width', `${cardWidth}px`);
			this.containerEl.style.setProperty('--grid-columns', String(cols));
			this.containerEl.style.setProperty('--dynamic-views-image-aspect-ratio', String(settings.imageAspectRatio));

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

			// Load images synchronously for ALL entries (not just visible) for instant rendering
			// This ensures images are ready when switching views or scrolling
			if (settings.imageFormat !== 'none') {
				// Process ALL entries, not just visible ones
				const allImageEntries = allEntries
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

				// For visible entries, generate thumbnails immediately (blocking for instant display)
				// For rest, generate in background
				const visibleImageEntries = allImageEntries.filter(e => 
					visibleEntries.some(ve => ve.file.path === e.path)
				);
				const backgroundImageEntries = allImageEntries.filter(e => 
					!visibleEntries.some(ve => ve.file.path === e.path)
				);
				
				// Generate thumbnails for visible entries first (this will populate cache)
				if (visibleImageEntries.length > 0) {
					await loadImagesForEntriesSync(
						visibleImageEntries,
						settings.fallbackToEmbeds,
						this.app,
						this.images,
						this.hasImageAvailable,
						settings.thumbnailCacheSize,
						settings.cardSize,
						settings.imageFormat
					);
				}
				
				// Generate thumbnails for background entries (non-blocking)
				if (backgroundImageEntries.length > 0) {
					void loadImagesForEntriesSync(
						backgroundImageEntries,
						settings.fallbackToEmbeds,
						this.app,
						this.images,
						this.hasImageAvailable,
						settings.thumbnailCacheSize,
						settings.cardSize,
						settings.imageFormat
					);
				}

				// Load embed images in background for entries without property images
				if (settings.fallbackToEmbeds) {
					const embedEntries = allImageEntries.filter(e => !(e.path in this.images) && !this.hasImageAvailable[e.path]);
					if (embedEntries.length > 0) {
						// Don't await - let it run in background
						void loadEmbedImagesForEntries(embedEntries, this.app, this.images, this.hasImageAvailable).then(() => {
							// Update cards that got embed images
							embedEntries.forEach(entry => {
								if (entry.path in this.images) {
									const cardEl = this.containerEl.querySelector(`.card[data-path="${entry.path}"]`);
									if (cardEl) {
										const imageUrl = this.images[entry.path];
										const url = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
										if (url) {
											// Check if image element exists
											let imgEl = cardEl.querySelector('img');
											if (!imgEl) {
												// No image element - need to create it (replace placeholder)
												const placeholder = cardEl.querySelector('.card-cover-placeholder, .card-thumbnail-placeholder');
												if (placeholder) {
													// Preserve badge if it exists on placeholder
													const existingBadge = placeholder.querySelector('.card-status-badge');
													
													const imageClassName = placeholder.classList.contains('card-cover-placeholder') ? 'card-cover' : 'card-thumbnail';
													const imageEl = placeholder.parentElement?.createDiv(imageClassName);
													if (imageEl) {
														const imageEmbedContainer = imageEl.createDiv('image-embed');
														imgEl = imageEmbedContainer.createEl('img', {
															attr: { 
																src: url, 
																alt: '',
																decoding: 'async'
															}
														});
														imageEmbedContainer.style.setProperty('--cover-image-url', `url("${url}")`);
														
														// Move badge from placeholder to new image element if it exists
														if (existingBadge) {
															imageEl.appendChild(existingBadge);
														}
														
														placeholder.remove();
													}
												}
											} else if (imgEl.src !== url) {
												// Image element exists, just update src
												imgEl.src = url;
												// Update CSS variable for cover images
												const imageEmbedContainer = imgEl.parentElement;
												if (imageEmbedContainer && imageEmbedContainer.classList.contains('image-embed')) {
													imageEmbedContainer.style.setProperty('--cover-image-url', `url("${url}")`);
												}
											}
										}
									}
								}
							});
						});
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
					snippetEntries.forEach(entry => {
						if (entry.path in this.snippets && this.snippets[entry.path]) {
							const cardEl = this.containerEl.querySelector(`[data-path="${entry.path}"]`);
							if (cardEl) {
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const textPreviewEl = (cardEl as any).__textPreviewEl;
								// Update if element exists and is empty (no text content or only whitespace)
								if (textPreviewEl && (!textPreviewEl.textContent || textPreviewEl.textContent.trim().length === 0)) {
									textPreviewEl.setText(this.snippets[entry.path]);
								}
							}
						}
					});
				});
			}

			// Preserve toolbar element if we're refreshing with selection
			let preservedToolbarEl: HTMLElement | null = null;
			if (this.isRefreshingWithSelection && this.bulkToolbar) {
				const toolbarEl = this.containerEl.querySelector('.bases-cms-bulk-toolbar');
				if (toolbarEl) {
					preservedToolbarEl = toolbarEl as HTMLElement;
					// Remove it from DOM temporarily but keep the reference
					preservedToolbarEl.remove();
				}
			}
			
			// Clear and re-render
			this.containerEl.empty();

			// Disconnect old property observers before re-rendering
			this.propertyObservers.forEach(obs => obs.disconnect());
			this.propertyObservers = [];

			// Create cards feed container
			const feedEl = this.containerEl.createDiv('bases-cms-grid');

			// Render groups with headers
			let displayedSoFar = 0;
			const imageElements: Array<{ img: HTMLImageElement; src: string }> = [];
			
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
					const imgData = this.renderCard(groupEl, card, entry, displayedSoFar + i, settings);
					if (imgData) {
						imageElements.push(imgData);
					}
				}

				displayedSoFar += entriesToDisplay;
			}
			
			// Batch set all image src attributes at once to trigger parallel loading
			if (imageElements.length > 0) {
				requestAnimationFrame(() => {
					for (const { img, src } of imageElements) {
						img.src = src;
					}
				});
			}

			// Restore scroll position after rendering
			if (savedScrollTop > 0) {
				this.containerEl.scrollTop = savedScrollTop;
			}

			// Setup infinite scroll
			this.setupInfiniteScroll(allEntries.length);

			// Setup ResizeObserver for dynamic grid updates
			if (!this.resizeObserver) {
				this.resizeObserver = new ResizeObserver(() => {
					const containerWidth = this.containerEl.clientWidth;
					const currentSettings = readCMSSettings(
						this.config,
						this.plugin.settings
					);
					const cardMinWidth = currentSettings.cardSize;
					const minColumns = 1;
					const gap = GAP_SIZE;
					const cols = Math.max(minColumns, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
					const cardWidth = (containerWidth - (gap * (cols - 1))) / cols;

					this.containerEl.style.setProperty('--card-min-width', `${cardWidth}px`);
					this.containerEl.style.setProperty('--grid-columns', String(cols));
					this.containerEl.style.setProperty('--dynamic-views-image-aspect-ratio', String(currentSettings.imageAspectRatio));
				});
				this.resizeObserver.observe(this.containerEl);
			}

			// Restore toolbar at the bottom if it was preserved
			if (preservedToolbarEl && this.bulkToolbar) {
				this.containerEl.appendChild(preservedToolbarEl);
				// Update the BulkToolbar's reference to the element
				(this.bulkToolbar as any).toolbarEl = preservedToolbarEl;
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
			this.isLoading = false;
		})();
	}

	private renderCard(
		container: HTMLElement,
		card: any,
		entry: BasesEntry,
		index: number,
		settings: any
	): { img: HTMLImageElement; src: string } | null {
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
			}
		);
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


	private setupInfiniteScroll(totalEntries: number): void {
		// Clean up existing listener
		if (this.scrollListener) {
			this.containerEl.removeEventListener('scroll', this.scrollListener);
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const isMobile = (this.app as any).isMobile;
			const viewportMultiplier = isMobile ? 1 : 2;
			const threshold = clientHeight * viewportMultiplier;

			// Check if should load more
			if (distanceFromBottom < threshold && this.displayedCount < totalEntries) {
				this.isLoading = true;
				const batchSize = 50;
				this.displayedCount = Math.min(this.displayedCount + batchSize, totalEntries);
				this.onDataUpdated();
			}

			// Start throttle cooldown
			this.scrollThrottleTimeout = window.setTimeout(() => {
				this.scrollThrottleTimeout = null;
			}, 100);
		};

		// Attach listener
		this.containerEl.addEventListener('scroll', this.scrollListener);

		// Register cleanup
		this.register(() => {
			if (this.scrollListener) {
				this.containerEl.removeEventListener('scroll', this.scrollListener);
			}
			if (this.scrollThrottleTimeout !== null) {
				window.clearTimeout(this.scrollThrottleTimeout);
			}
		});
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
				if (toolbarEl) {
					(toolbarEl as HTMLElement).style.display = 'none';
					(toolbarEl as HTMLElement).style.opacity = '0';
				}
			}
		}
	}

	private async handlePropertyToggle(path: string, property: string, value: unknown): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return;

			// Strip "note." prefix if present (Bases uses "note.property" but frontmatter uses just "property")
			const cleanProperty = property.startsWith('note.') ? property.substring(5) : property;

			// Read settings to check if this is the draft property
			const settings = readCMSSettings(
				this.config,
				this.plugin.settings
			);

			// Check if this is the draft status property
			const isDraftProperty = settings.showDraftStatus && cleanProperty === 'draft';
			let shouldRefresh = false;

			if (isDraftProperty) {
				// Check if using filename prefix mode
				if (settings.draftStatusUseFilenamePrefix) {
					// Always use filename-based detection when this setting is enabled
					const fileName = file.basename; // basename excludes extension
					const startsWithUnderscore = fileName.startsWith('_');
					const currentPath = file.path;
					const pathParts = currentPath.split('/');
					
					// Toggle based on desired state: if value is true (draft), ensure underscore; if false (published), remove it
					if (value === true) {
						// Toggling to draft - add underscore if not present
						if (!startsWithUnderscore) {
							const newName = `_${fileName}${file.extension ? `.${file.extension}` : ''}`;
							pathParts[pathParts.length - 1] = newName;
							const newPath = pathParts.join('/');
							await this.app.fileManager.renameFile(file, newPath);
							shouldRefresh = true;
						}
					} else {
						// Toggling to published - remove underscore if present
						if (startsWithUnderscore) {
							const newName = fileName.substring(1) + (file.extension ? `.${file.extension}` : '');
							pathParts[pathParts.length - 1] = newName;
							const newPath = pathParts.join('/');
							await this.app.fileManager.renameFile(file, newPath);
							shouldRefresh = true;
						}
					}
				} else {
					// Use property-based detection (frontmatter)
					const cleanConfigProperty = settings.draftStatusProperty && settings.draftStatusProperty.trim()
						? (settings.draftStatusProperty.startsWith('note.') 
							? settings.draftStatusProperty.substring(5) 
							: settings.draftStatusProperty)
						: 'draft';
					
					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[cleanConfigProperty] = value;
					});
					shouldRefresh = true;
				}
			} else {
				// Normal property toggle - update frontmatter
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					frontmatter[cleanProperty] = value;
				});
				shouldRefresh = true;
			}

			// Only refresh if we actually made a change
			if (shouldRefresh) {
				// Wait for metadata cache to update, then refresh view
				requestAnimationFrame(() => {
					setTimeout(() => {
						try {
							this.onDataUpdated();
						} catch (error) {
							console.error('Error refreshing view after property toggle:', error);
						}
					}, 100);
				});
			}
		} catch (error) {
			console.error('Error toggling property:', error);
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const toolbarInstance = (toolbar as any).__bulkToolbarInstance;
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
						setTimeout(() => {
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
							setTimeout(() => {
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
				if (toolbarEl) {
					(toolbarEl as HTMLElement).style.display = 'none';
					(toolbarEl as HTMLElement).style.opacity = '0';
				}
			}
		}
	}

	onClose(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
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
		if (this.plugin && typeof (this.plugin as any).removeView === 'function') {
			(this.plugin as any).removeView(this);
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
