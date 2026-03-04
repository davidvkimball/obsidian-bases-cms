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
import { getFileFrontmatter } from '../utils/frontmatter-helper';
import { isEmbeddedView } from '../utils/embedded-view-detector';

export const CMS_VIEW_TYPE = 'cms';

export class BasesCMSView extends BasesView {
	readonly type = CMS_VIEW_TYPE;
	private containerEl: HTMLElement;
	private plugin: BasesCMSPlugin;
	public selectedFiles: Set<string> = new Set();
	private snippets: Record<string, string> = {};
	private images: Record<string, string | string[]> = {};
	private hasImageAvailable: Record<string, boolean> = {};
	private mdxFrontmatterCache: Record<string, Record<string, unknown> | null> = {};
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
	private lastUpdateId: number = 0;
	private lastBaseId: string | null = null;
	private hasAutoSwitched: boolean = false;
	private basesController: QueryController;
	public readonly isEmbedded: boolean;
	private lastClickedPath: string | null = null;
	private lastVisiblePaths: string[] = [];

	constructor(controller: QueryController, parentContainerEl: HTMLElement, plugin: BasesCMSPlugin) {
		super(controller);
		this.basesController = controller;
		// We create a wrapper div inside the parent container to prevent our 
		// `.empty()` calls from destroying UI elements added by the core Bases plugin
		this.containerEl = parentContainerEl.createDiv('bases-cms-wrapper');
		this.containerEl.style.height = '100%';
		this.containerEl.style.width = '100%';

		this.plugin = plugin;

		// Initialize selection from plugin storage if it exists
		// We use a stable reference for selectedFiles so managers don't lose track of it
		const baseId = this.getBaseIdentifier();
		if (baseId) {
			const savedSelection = this.plugin.selections.get(baseId);
			if (savedSelection && savedSelection !== this.selectedFiles) {
				// Initial sync from plugin's existing selection for this base
				savedSelection.forEach(item => this.selectedFiles.add(item));
				// Ensure they both point to the SAME Set instance for future updates
				this.plugin.selections.set(baseId, this.selectedFiles);
			} else if (!savedSelection) {
				// First time this base is seen, register our Set instance
				this.plugin.selections.set(baseId, this.selectedFiles);
			}
		}

		// Detect if this view is embedded in a markdown note
		this.isEmbedded = isEmbeddedView(parentContainerEl);

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

	/**
	 * Sort entries by property using consistent logic for both MD and MDX files
	 */
	private async sortEntriesByProperty(entries: BasesEntry[], propertyName: string, direction: 'asc' | 'desc'): Promise<BasesEntry[]> {
		if (!propertyName || propertyName === '') {
			return entries;
		}

		// Handle special file properties
		if (propertyName === 'file.ctime' || propertyName === 'file.mtime') {
			const isCtime = propertyName === 'file.ctime';
			return [...entries].sort((a, b) => {
				const aTime = isCtime ? a.file.stat.ctime : a.file.stat.mtime;
				const bTime = isCtime ? b.file.stat.ctime : b.file.stat.mtime;
				const comparison = aTime - bTime;
				return direction === 'desc' ? -comparison : comparison;
			});
		}

		// For other properties, use async property resolution
		const entriesWithValues = await Promise.all(
			entries.map(async (entry) => {
				const value = await getFirstBasesPropertyValue(entry, propertyName, this.app);
				return { entry, value };
			})
		);

		return entriesWithValues
			.sort((a, b) => {
				const aVal = a.value;
				const bVal = b.value;

				// Handle null/undefined values (sort to end)
				if (aVal == null && bVal == null) return 0;
				if (aVal == null) return 1; // null sorts after
				if (bVal == null) return -1; // null sorts after

				// Parse dates for both entries using the same logic as the renderer
				const aDate = this.parseDateValue(aVal);
				const bDate = this.parseDateValue(bVal);

				// If both are valid dates, compare them
				if (aDate && bDate) {
					const comparison = aDate.getTime() - bDate.getTime();
					return direction === 'desc' ? -comparison : comparison;
				}

				// If only one is a date, dates sort first
				if (aDate && !bDate) {
					return direction === 'desc' ? -1 : 1; // dates sort before non-dates
				}
				if (!aDate && bDate) {
					return direction === 'desc' ? 1 : -1; // dates sort before non-dates
				}

				// Neither is a date, fall back to string comparison
				const aStr = this.valueToString(aVal);
				const bStr = this.valueToString(bVal);
				const comparison = aStr.localeCompare(bStr);
				return direction === 'desc' ? -comparison : comparison;
			})
			.map(item => item.entry);
	}

	/**
	 * Parse a date value using the same logic as the shared renderer
	 */
	private parseDateValue(value: unknown): Date | null {
		if (!value) return null;

		// Handle Bases API date objects
		if (typeof value === 'object' && 'date' in value && value.date instanceof Date) {
			return value.date;
		}

		// Extract data from Bases API format
		let data: unknown = value;
		if (typeof value === 'object' && 'data' in value) {
			data = (value as { data: unknown }).data;
		}

		if (!data) return null;

		// Handle Date objects (including those from YAML parsing)
		if (data instanceof Date) {
			return data;
		}

		// Handle date-like objects (YAML parsers sometimes return custom Date objects)
		if (data && typeof data === 'object' && 'getTime' in data) {
			const dateLike = data as { getTime: () => number };
			try {
				const timestamp = dateLike.getTime();
				if (typeof timestamp === 'number' && !isNaN(timestamp)) {
					return new Date(timestamp);
				}
			} catch {
				// Fall through to string/number handling
			}
		}

		// Handle strings - especially ISO date strings like "2025-12-29"
		if (typeof data === 'string') {
			const dateStr = data.trim();
			// Try parsing as ISO date (YYYY-MM-DD) - this is what Obsidian uses
			// Add time component to avoid timezone issues: "2025-12-29" -> "2025-12-29T00:00:00"
			const isoDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`;
			const parsedDate = new Date(isoDateStr);
			if (!isNaN(parsedDate.getTime())) {
				return parsedDate;
			} else {
				// Fallback to direct Date constructor for other formats like "9/6/2025"
				const fallbackDate = new Date(dateStr);
				if (!isNaN(fallbackDate.getTime())) {
					return fallbackDate;
				}
			}
		}

		// Handle numbers (timestamps)
		if (typeof data === 'number') {
			const parsedDate = new Date(data);
			if (!isNaN(parsedDate.getTime())) {
				return parsedDate;
			}
		}

		return null;
	}

	/**
	 * Convert a value to string for comparison
	 */
	private valueToString(value: unknown): string {
		if (!value) return '';

		// Extract data from Bases API format
		let data: unknown = value;
		if (typeof value === 'object' && 'data' in value) {
			data = (value as { data: unknown }).data;
		}

		if (typeof data === 'string') {
			return data;
		} else if (typeof data === 'number' || typeof data === 'boolean') {
			return String(data);
		} else {
			return '';
		}
	}

	/**
	 * Continue processing data after sorting is complete
	 */
	private async continueDataProcessing(
		processedGroups: Array<{ group: { hasKey: () => boolean; key?: unknown; entries: BasesEntry[] }; entries: BasesEntry[] }>,
		settings: CMSSettings,
		totalEntriesCount: number,
		savedScrollTop: number,
		updateId: number
	): Promise<void> {
		const isStillValid = () => updateId === this.lastUpdateId;

		// Flatten all entries for virtual scrolling
		const allFlatEntries: BasesEntry[] = [];
		for (const processedGroup of processedGroups) {
			allFlatEntries.push(...processedGroup.entries);
		}

		// Check if virtual scrolling should be enabled
		const useVirtualScroll = this.scrollLayoutManager.shouldEnableVirtualScroll(totalEntriesCount);

		// Calculate which entries to display
		let visibleEntries: BasesEntry[];
		let startIndex = 0;
		let virtualRange: { startIndex: number; endIndex: number; topPadding: number; bottomPadding: number } | null = null;

		if (useVirtualScroll) {
			// Use virtual scrolling - only load visible entries
			virtualRange = this.scrollLayoutManager.calculateVisibleRange(totalEntriesCount);
			startIndex = virtualRange.startIndex;
			visibleEntries = allFlatEntries.slice(virtualRange.startIndex, virtualRange.endIndex + 1);
		} else {
			// Use infinite scroll - load up to displayedCount
			const remainingCount = this.scrollLayoutManager.getDisplayedCount();
			visibleEntries = allFlatEntries.slice(0, remainingCount);
		}

		// Load snippets and images ONLY for displayed entries
		await this.loadContentForEntries(visibleEntries, settings);

		if (!isStillValid()) return;

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

		if (!isStillValid()) return;

		// Update card renderer with config (now available)
		(this.cardRenderer as unknown as { basesConfig?: { get?: (key: string) => unknown } }).basesConfig = this.config;

		// Update card renderer with MDX frontmatter cache for synchronous rendering
		if (this.cardRenderer && typeof (this.cardRenderer as { setMdxFrontmatterCache?: (cache: Record<string, Record<string, unknown> | null>) => void }).setMdxFrontmatterCache === 'function') {
			(this.cardRenderer as { setMdxFrontmatterCache: (cache: Record<string, Record<string, unknown> | null>) => void }).setMdxFrontmatterCache(this.mdxFrontmatterCache);
		}

		// Clear and re-render after content is loaded
		this.containerEl.empty();

		// Clear MDX frontmatter cache when re-rendering
		this.mdxFrontmatterCache = {};

		// Disconnect old property observers before re-rendering
		this.propertyObservers.forEach(obs => obs.disconnect());
		this.propertyObservers = [];

		// Inner scroll content (padding for selection ring; scrollbar stays at view edge)
		const scrollContentEl = this.containerEl.createDiv('bases-cms-scroll-content');
		const feedEl = scrollContentEl.createDiv('bases-cms-grid');

		// For virtual scrolling, add top spacer
		if (useVirtualScroll && virtualRange && virtualRange.topPadding > 0) {
			const topSpacer = feedEl.createDiv('bases-cms-virtual-spacer');
			topSpacer.style.height = `${virtualRange.topPadding}px`;
			setCssProps(topSpacer, { gridColumn: '1 / -1' });
		}

		// Render cards
		let totalCardsRendered = 0;

		// Transform entries to cards
		const cards = await transformBasesEntries(
			visibleEntries,
			settings,
			'', // sortMethod not used in transformBasesEntries
			false,
			this.snippets,
			this.images,
			this.hasImageAvailable,
			this.app,
			this.mdxFrontmatterCache
		);

		if (!isStillValid()) return;

		// If using groups (not virtual scroll), render with group headers
		if (!useVirtualScroll && processedGroups.some(g => g.group.hasKey())) {
			let displayedSoFar = 0;
			let cardIndex = 0;

			for (const processedGroup of processedGroups) {
				if (displayedSoFar >= this.scrollLayoutManager.getDisplayedCount()) break;

				const entriesToDisplay = Math.min(processedGroup.entries.length, this.scrollLayoutManager.getDisplayedCount() - displayedSoFar);
				if (entriesToDisplay === 0) continue;

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
				for (let i = 0; i < entriesToDisplay && cardIndex < cards.length; i++) {
					const card = cards[cardIndex];
					const entry = visibleEntries[cardIndex];
					try {
						this.renderCard(groupEl, card, entry, displayedSoFar + i, settings);
						totalCardsRendered++;
					} catch {
						// Continue rendering other cards even if one fails
					}
					cardIndex++;
				}

				displayedSoFar += entriesToDisplay;
			}
		} else {
			// Render flat list (virtual scroll or no groups)
			for (let i = 0; i < cards.length; i++) {
				const card = cards[i];
				const entry = visibleEntries[i];
				try {
					this.renderCard(feedEl, card, entry, startIndex + i, settings);
					totalCardsRendered++;
				} catch {
					// Continue rendering other cards even if one fails
				}
			}
		}

		// For virtual scrolling, add bottom spacer
		if (useVirtualScroll && virtualRange && virtualRange.bottomPadding > 0) {
			const bottomSpacer = feedEl.createDiv('bases-cms-virtual-spacer');
			bottomSpacer.style.height = `${virtualRange.bottomPadding}px`;
			setCssProps(bottomSpacer, { gridColumn: '1 / -1' });
		}

		if (!isStillValid()) return;

		// CRITICAL: If no cards were rendered, show error instead of blank screen
		if (totalCardsRendered === 0 && totalEntriesCount > 0) {
			throw new Error('No cards were rendered despite having entries. Check card rendering logic.');
		}

		// Update card metrics for virtual scrolling
		if (totalCardsRendered > 0) {
			const firstCard = feedEl.querySelector('.bases-cms-card') as HTMLElement;
			if (firstCard) {
				// Measure actual card height after render
				requestAnimationFrame(() => {
					const cardHeight = firstCard.offsetHeight;
					const containerWidth = this.containerEl.clientWidth;
					const cardMinWidth = settings.cardSize || 280;
					const gap = 16;
					const cardsPerRow = Math.max(1, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
					this.scrollLayoutManager.updateCardMetrics(cardHeight, cardsPerRow);
				});
			}
		}

		// Restore scroll position after rendering
		if (savedScrollTop > 0) {
			this.containerEl.scrollTop = savedScrollTop;
		}

		// Setup scrolling (virtual or infinite) and resize observer
		if (useVirtualScroll) {
			// Store context for virtual scroll handler
			const cachedAllEntries = allFlatEntries;
			const cachedSettings = settings;
			const cachedUpdateId = updateId;

			this.scrollLayoutManager.setupVirtualScroll(totalEntriesCount, (range) => {
				// Re-render when scroll range changes significantly
				if (cachedUpdateId === this.lastUpdateId) {
					void this.renderVirtualRange(cachedAllEntries, cachedSettings, range, feedEl);
				}
			});
		} else {
			this.scrollLayoutManager.setupInfiniteScroll(totalEntriesCount);
		}
		this.scrollLayoutManager.setupResizeObserver();

		// Setup settings polling to detect changes and refresh view
		this.setupSettingsPolling(settings);

		// Update selection UI
		this.updateSelectionUI();

		// Clear loading flag after async work completes
		this.scrollLayoutManager.setIsLoading(false);
	}

	/**
	 * Render cards for a specific virtual scroll range
	 */
	private async renderVirtualRange(
		allEntries: BasesEntry[],
		settings: CMSSettings,
		range: { startIndex: number; endIndex: number; topPadding: number; bottomPadding: number },
		feedEl: HTMLElement
	): Promise<void> {
		const visibleEntries = allEntries.slice(range.startIndex, range.endIndex + 1);

		// Load content for newly visible entries
		await this.loadContentForEntries(visibleEntries, settings);

		// Clear and re-render
		feedEl.empty();

		// Add top spacer
		if (range.topPadding > 0) {
			const topSpacer = feedEl.createDiv('bases-cms-virtual-spacer');
			topSpacer.style.height = `${range.topPadding}px`;
			setCssProps(topSpacer, { gridColumn: '1 / -1' });
		}

		// Transform and render cards
		const cards = await transformBasesEntries(
			visibleEntries,
			settings,
			'',
			false,
			this.snippets,
			this.images,
			this.hasImageAvailable,
			this.app,
			this.mdxFrontmatterCache
		);

		for (let i = 0; i < cards.length; i++) {
			const card = cards[i];
			const entry = visibleEntries[i];
			try {
				this.renderCard(feedEl, card, entry, range.startIndex + i, settings);
			} catch {
				// Continue rendering other cards
			}
		}

		// Add bottom spacer
		if (range.bottomPadding > 0) {
			const bottomSpacer = feedEl.createDiv('bases-cms-virtual-spacer');
			bottomSpacer.style.height = `${range.bottomPadding}px`;
			setCssProps(bottomSpacer, { gridColumn: '1 / -1' });
		}

		// Update selection UI
		this.updateSelectionUI();
	}

	onDataUpdated(): void {
		const updateId = ++this.lastUpdateId;

		void (async () => {
			try {
				// Guard: check if this update is still valid
				const isStillValid = () => updateId === this.lastUpdateId;

				// Guard: wait for data to be ready - NEVER return early and leave blank screen
				if (!this.data) {
					// Show loading state instead of blank screen
					let loadingEl = this.containerEl.querySelector('.bases-cms-loading') as HTMLElement;
					if (!loadingEl && this.containerEl.children.length === 0) {
						loadingEl = this.containerEl.createDiv('bases-cms-loading');
						loadingEl.setText('Loading...');
						setCssProps(loadingEl, {
							padding: '20px',
							textAlign: 'center'
						});
					}
					// Retry after a short delay
					setTimeout(() => {
						if (isStillValid() && this.data) {
							this.onDataUpdated();
						}
					}, 100);
					return;
				}

				if (!isStillValid()) return;

				// Sync with default view if defined and not already active
				const data = this.data as unknown as { defaultView?: string };
				const topLevelDefaultView = data?.defaultView;

				const config = this.config as unknown as { getName?: () => string; name?: string };
				const currentViewName = typeof config.getName === 'function'
					? config.getName()
					: config.name;

				if (topLevelDefaultView && currentViewName !== topLevelDefaultView) {
					// Only do this once on initial load to avoid loop
					if (!this.hasAutoSwitched) {
						this.hasAutoSwitched = true;

						// Logic to trigger a view switch via the core Bases plugin controller
						const controller = this.basesController as unknown as {
							selectView?: (view: string) => void;
							setView?: (view: string) => void;
							switchView?: (view: string) => void;
						};

						// Diagnostic log to help troubleshoot if it still doesn't work
						console.debug('Bases CMS: Default view sync triggered', {
							target: topLevelDefaultView,
							current: currentViewName
						});

						if (typeof controller.selectView === 'function') {
							controller.selectView(topLevelDefaultView);
							return; // Exit early as the view will be replaced
						} else if (typeof controller.setView === 'function') {
							controller.setView(topLevelDefaultView);
							return;
						} else if (typeof controller.switchView === 'function') {
							controller.switchView(topLevelDefaultView);
							return;
						}
					}
				}

				// Check if the base configuration has changed
				const currentBaseId = this.getBaseIdentifier();
				if (this.lastBaseId !== currentBaseId) {
					this.lastBaseId = currentBaseId;

					// Sync selection from plugin when base changes or is first detected
					if (currentBaseId) {
						const savedSelection = this.plugin.selections.get(currentBaseId);
						if (savedSelection && savedSelection !== this.selectedFiles) {
							// Sync contents to our local (manager-linked) Set
							this.selectedFiles.clear();
							savedSelection.forEach(item => this.selectedFiles.add(item));
							// Ensure they share the reference going forward
							this.plugin.selections.set(currentBaseId, this.selectedFiles);
						} else if (!savedSelection) {
							this.plugin.selections.set(currentBaseId, this.selectedFiles);
						}
					}

					// Reset scroll and displayed count when switching bases
					this.scrollLayoutManager.resetScroll();
					// Clear caches that are specific to a base
					this.snippets = {};
					this.images = {};
					this.hasImageAvailable = {};
					this.mdxFrontmatterCache = {};
				}

				// Ensure we have valid data structures
				if (!this.data.groupedData || !this.data.data) {
					setTimeout(() => {
						if (isStillValid() && this.data && this.data.groupedData && this.data.data) {
							this.onDataUpdated();
						}
					}, 100);
					return;
				}

				if (!isStillValid()) return;

				const groupedData = this.data.groupedData;
				const allEntries = this.data.data;

				// Read settings from Bases config
				const settings = readCMSSettings(
					this.config,
					this.plugin.settings
				);

				if (!isStillValid()) return;

				// Store flat list of paths for selection and range selection
				const allFlatEntries = Array.isArray(this.data.data) ? this.data.data : [];
				this.lastVisiblePaths = allFlatEntries.map(e => e.file?.path).filter(Boolean);

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

				// Get sort configs (used for custom sorting)
				const sortConfigs = this.config.getSort();

				// Process groups and apply custom sorting for properties
				let processedGroups: Array<{ group: { hasKey: () => boolean; key?: unknown; entries: BasesEntry[] }; entries: BasesEntry[] }> = groupedData.map(group => ({
					group: group as { hasKey: () => boolean; key?: unknown; entries: BasesEntry[] },
					entries: [...group.entries]
				}));

				// Apply custom sorting if sorting by a property (not just file time)
				if (sortConfigs && sortConfigs.length > 0) {
					const firstSort = sortConfigs[0];
					const property = firstSort.property;
					const direction = firstSort.direction.toLowerCase() as 'asc' | 'desc';

					// Only apply custom sorting for properties (not file.ctime/file.mtime which are handled by Bases)
					if (property && !property.includes('ctime') && !property.includes('mtime')) {
						// Use IIFE to handle async sorting
						void (async () => {
							try {
								// Flatten all entries from all groups
								const allEntries: BasesEntry[] = [];
								for (const processedGroup of processedGroups) {
									allEntries.push(...processedGroup.entries);
								}

								// Sort all entries by the property
								const sortedEntries = await this.sortEntriesByProperty(allEntries, property, direction);

								// Re-group entries (put all in a single group since we're overriding Bases' grouping)
								const sortedProcessedGroups: Array<{ group: { hasKey: () => boolean; key?: unknown; entries: BasesEntry[] }; entries: BasesEntry[] }> = [{
									group: {
										hasKey: () => false,
										key: null,
										entries: sortedEntries
									},
									entries: sortedEntries
								}];

								// Continue processing with sorted groups
								await this.continueDataProcessing(sortedProcessedGroups, settings, allEntries.length, savedScrollTop, updateId);
							} catch (error) {
								console.error('Bases CMS: Error during custom sorting:', error);
								// Fall back to original processing
								await this.continueDataProcessing(processedGroups, settings, allEntries.length, savedScrollTop, updateId);
							}
						})();
						return; // Exit early, processing will continue in the async callback
					}
				}

				// Continue with the rest of processing
				await this.continueDataProcessing(processedGroups, settings, allEntries.length, savedScrollTop, updateId);
			} catch (error) {
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
				console.error('Bases CMS: Error in onDataUpdated:', error);
			}
		})();
	}

	/**
	 * Get a unique identifier for the current base configuration
	 */
	private getBaseIdentifier(): string | null {
		try {
			// Check controller first (available earliest in constructor)
			const controller = this.basesController as unknown as { getBaseName?: () => string; baseName?: string };
			if (controller) {
				if (typeof controller.getBaseName === 'function') return controller.getBaseName();
				if (controller.baseName) return controller.baseName;
			}

			if (this.config && typeof (this.config as unknown as { getName?: () => string }).getName === 'function') {
				return (this.config as unknown as { getName: () => string }).getName();
			}
			if (this.config && (this.config as unknown as { name?: string }).name) {
				return String((this.config as unknown as { name: string }).name);
			}
			if (this.data && (this.data as unknown as { baseName?: string }).baseName) {
				return String((this.data as unknown as { baseName: string }).baseName);
			}
		} catch {
			// Ignore errors
		}
		return null;
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
			propertyDisplayMaxLength: initialSettings.propertyDisplayMaxLength,
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
				this.lastSettings.propertyDisplay14 !== currentSettings.propertyDisplay14 ||
				this.lastSettings.propertyDisplayMaxLength !== currentSettings.propertyDisplayMaxLength;

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
					propertyDisplayMaxLength: currentSettings.propertyDisplayMaxLength,
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

	/**
	 * Preload MDX frontmatter for all visible entries to prevent flashing
	 * This ensures all MDX data is available synchronously during card transformation
	 */
	private async preloadMdxFrontmatter(entries: BasesEntry[]): Promise<void> {
		// Filter to only MDX files that aren't already cached
		const mdxEntries = entries.filter(entry => {
			const file = this.app.vault.getAbstractFileByPath(entry.file.path);
			return file instanceof TFile && file.extension === 'mdx' && !(entry.file.path in this.mdxFrontmatterCache);
		});

		if (mdxEntries.length === 0) {
			return;
		}

		// Load all MDX frontmatter in parallel
		await Promise.all(
			mdxEntries.map(async (entry) => {
				const file = this.app.vault.getAbstractFileByPath(entry.file.path);
				if (file instanceof TFile) {
					try {
						const frontmatter = await getFileFrontmatter(this.app, file);
						this.mdxFrontmatterCache[entry.file.path] = frontmatter;
					} catch (error) {
						console.error(`Bases CMS: Error preloading properties for ${entry.file.path}:`, error);
						this.mdxFrontmatterCache[entry.file.path] = null;
					}
				}
			})
		);
	}

	private async loadContentForEntries(
		entries: BasesEntry[],
		settings: CMSSettings
	): Promise<void> {
		// Load snippets for text preview
		if (settings.showTextPreview) {
			const snippetEntriesPromises = entries
				.filter(entry => !(entry.file.path in this.snippets))
				.map(async entry => {
					const file = this.app.vault.getAbstractFileByPath(entry.file.path);
					if (!(file instanceof TFile)) return null;
					const descValue = await getFirstBasesPropertyValue(entry, settings.descriptionProperty, this.app) as { data?: unknown } | null;
					return {
						path: entry.file.path,
						file,
						descriptionData: descValue?.data
					};
				});
			const snippetEntries = (await Promise.all(snippetEntriesPromises))
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
			const imageEntriesPromises = entries
				.filter(entry => !(entry.file.path in this.images))
				.map(async entry => {
					const file = this.app.vault.getAbstractFileByPath(entry.file.path);
					if (!(file instanceof TFile)) return null;
					const imagePropertyValues = await getAllBasesImagePropertyValues(entry, settings.imageProperty, this.app);
					return {
						path: entry.file.path,
						file,
						imagePropertyValues: imagePropertyValues as unknown[]
					};
				});
			const imageEntries = (await Promise.all(imageEntriesPromises))
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
			(path: string, selected: boolean, shiftKey?: boolean) => {
				this.handleSelectionChange(path, selected, shiftKey);
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



	private handleSelectionChange(path: string, selected: boolean, shiftKey?: boolean): void {
		if (shiftKey && this.lastClickedPath && this.lastClickedPath !== path) {
			// Implement range selection
			const start = this.lastVisiblePaths.indexOf(this.lastClickedPath);
			const end = this.lastVisiblePaths.indexOf(path);

			if (start !== -1 && end !== -1) {
				const min = Math.min(start, end);
				const max = Math.max(start, end);
				const pathsToToggle = this.lastVisiblePaths.slice(min, max + 1);

				pathsToToggle.forEach(p => {
					if (selected) {
						this.selectedFiles.add(p);
					} else {
						this.selectedFiles.delete(p);
					}
				});
			}
		} else {
			if (selected) {
				this.selectedFiles.add(path);
			} else {
				this.selectedFiles.delete(path);
			}
		}

		this.lastClickedPath = path;

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

	public selectAll(): void {
		this.lastVisiblePaths.forEach(path => {
			this.selectedFiles.add(path);
		});
		this.updateSelectionUI();
	}

	public deselectAll(): void {
		// Update visual state of currently selected cards before clearing the set
		const cards = this.containerEl.querySelectorAll('.bases-cms-card.selected');
		cards.forEach((cardEl) => {
			cardEl.removeClass('selected');
			const checkbox = cardEl.querySelector('input[type="checkbox"].selection-checkbox') as HTMLInputElement;
			if (checkbox) {
				checkbox.checked = false;
			}
		});

		this.selectedFiles.clear();
		this.lastClickedPath = null;
		this.updateSelectionUI();
	}

	/**
	 * Update checkbox and class for a specific card in the DOM
	 */
	private updateCardCheckboxState(path: string, selected: boolean): void {
		const cardEl = this.containerEl.querySelector(`.bases-cms-card[data-path="${path}"]`);
		if (cardEl instanceof HTMLElement) {
			if (selected) {
				cardEl.addClass('selected');
			} else {
				cardEl.removeClass('selected');
			}
			const checkbox = cardEl.querySelector('input[type="checkbox"].selection-checkbox') as HTMLInputElement;
			if (checkbox) {
				checkbox.checked = selected;
			}
		}
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

	async onClose(): Promise<void> {
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

		// REMOVED: this.selectedFiles.clear(); 
		// We want to persist selection in the plugin across view lifecycle

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
