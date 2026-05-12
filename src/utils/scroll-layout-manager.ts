/**
 * Scroll and Layout Manager
 * Handles infinite scroll, virtual scrolling, and responsive grid layout
 */

import { App } from 'obsidian';
import type { CMSSettings } from '../shared/data-transform';
import { readCMSSettings } from '../shared/settings-schema';
import type { BasesCMSSettings } from '../types';

interface BasesConfig {
	get(key: string): unknown;
}

export interface VirtualScrollRange {
	startIndex: number;
	endIndex: number;
	topPadding: number;
	bottomPadding: number;
}

export class ScrollLayoutManager {
	private scrollListener: (() => void) | null = null;
	private scrollThrottleTimeout: number | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private windowResizeHandler: (() => void) | null = null;
	private isLoading: boolean = false;
	private displayedCount: number = 50;
	private totalEntries: number = 0;
	private config: BasesConfig;
	private configPollInterval: number | null = null;
	private lastCardSize: number | null = null;
	private lastImageAspectRatio: number | null = null;
	private lastDescriptionMaxLines: number | null = null;

	// Virtual scrolling state
	private virtualScrollEnabled: boolean = false;
	private estimatedCardHeight: number = 300; // Default estimate, updated on render
	private cardsPerRow: number = 3; // Default, updated based on container width
	private lastScrollTop: number = 0;
	private virtualScrollCallback: ((range: VirtualScrollRange) => void) | null = null;

	constructor(
		private containerEl: HTMLElement,
		private app: App,
		config: BasesConfig,
		private pluginSettings: BasesCMSSettings,
		private onLoadMore: () => void,
		private registerCleanup: (cleanup: () => void) => void
	) {
		this.config = config;
		const isMobile = (this.app as { isMobile?: boolean }).isMobile ?? false;
		this.displayedCount = isMobile ? 25 : 50;
	}

	/**
	 * Update the config reference (useful when config becomes available after construction)
	 */
	updateConfig(config: BasesConfig): void {
		this.config = config;
	}

	setDisplayedCount(count: number): void {
		this.displayedCount = count;
	}

	/**
	 * Reset displayed count and scroll position
	 */
	resetScroll(): void {
		const isMobile = (this.app as { isMobile?: boolean }).isMobile ?? false;
		this.displayedCount = isMobile ? 25 : 50;
		this.containerEl.scrollTop = 0;
	}

	getDisplayedCount(): number {
		return this.displayedCount;
	}

	setIsLoading(loading: boolean): void {
		this.isLoading = loading;
	}

	setupInfiniteScroll(totalEntries: number): void {
		this.totalEntries = totalEntries;
		
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
			const isMobile = (this.app as { isMobile?: boolean }).isMobile ?? false;
			const viewportMultiplier = isMobile ? 1 : 2;
			const threshold = clientHeight * viewportMultiplier;

			// Check if should load more
			if (distanceFromBottom < threshold && this.displayedCount < totalEntries) {
				this.isLoading = true;
				const batchSize = 50;
				this.displayedCount = Math.min(this.displayedCount + batchSize, totalEntries);
				// Call onLoadMore which will trigger onDataUpdated
				// onDataUpdated will then call setupInfiniteScroll again with updated count
				this.onLoadMore();
			}

			// Start throttle cooldown
			this.scrollThrottleTimeout = activeWindow.setTimeout(() => {
				this.scrollThrottleTimeout = null;
			}, 100);
		};

		// Attach listener
		this.containerEl.addEventListener('scroll', this.scrollListener);

		// Register cleanup
		this.registerCleanup(() => {
			if (this.scrollListener) {
				this.containerEl.removeEventListener('scroll', this.scrollListener);
			}
			if (this.scrollThrottleTimeout !== null) {
				window.clearTimeout(this.scrollThrottleTimeout);
			}
		});
	}

	setupResizeObserver(): void {
		// Only set up once - but now we just need to set the card min width
		// CSS Grid's auto-fill will handle column snapping automatically
		if (this.resizeObserver) {
			return; // Already set up
		}

		// Create the update function - just set card min width, CSS Grid handles the rest
		const updateGrid = () => {
			// Guard: ensure config exists and has get method before using it
			if (!this.config || typeof this.config.get !== 'function') {
				return; // Config not ready yet, skip update
			}

			const currentSettings = readCMSSettings(
				this.config,
				this.pluginSettings
			);
			const cardMinWidth = currentSettings.cardSize;
			const imageAspectRatio = currentSettings.imageAspectRatio;

			// Set CSS variables on container - CSS Grid auto-fill handles column snapping
			this.containerEl.style.setProperty('--card-min-width', `${cardMinWidth}px`);
			this.containerEl.style.setProperty('--bases-cms-image-aspect-ratio', String(imageAspectRatio));
			const descriptionMaxLines = currentSettings.descriptionMaxLines ?? 5;
			this.containerEl.style.setProperty('--bases-cms-text-preview-lines', String(descriptionMaxLines));
			
			// Track last values for polling
			this.lastCardSize = cardMinWidth;
			this.lastImageAspectRatio = imageAspectRatio;
			this.lastDescriptionMaxLines = descriptionMaxLines;
		};

		// Set up ResizeObserver to call updateGrid when container resizes
		this.resizeObserver = new ResizeObserver(updateGrid);
		this.resizeObserver.observe(this.containerEl);
		
		// Call updateGrid immediately to set initial values
		updateGrid();
		
		// Set up polling to detect config changes (for real-time updates when card size changes)
		// Poll every 100ms to check if cardSize or imageAspectRatio has changed
		this.configPollInterval = window.setInterval(() => {
			if (!this.config || typeof this.config.get !== 'function') {
				return; // Config not ready yet, skip check
			}

			const currentSettings = readCMSSettings(
				this.config,
				this.pluginSettings
			);
			const currentCardSize = currentSettings.cardSize;
			const currentImageAspectRatio = currentSettings.imageAspectRatio;
			const currentDescriptionMaxLines = currentSettings.descriptionMaxLines ?? 5;

			// Check if cardSize, imageAspectRatio, or descriptionMaxLines has changed
			if (this.lastCardSize !== currentCardSize || this.lastImageAspectRatio !== currentImageAspectRatio || this.lastDescriptionMaxLines !== currentDescriptionMaxLines) {
				// Update grid layout immediately when settings change
				this.containerEl.style.setProperty('--card-min-width', `${currentCardSize}px`);
				this.containerEl.style.setProperty('--bases-cms-image-aspect-ratio', String(currentImageAspectRatio));
				this.containerEl.style.setProperty('--bases-cms-text-preview-lines', String(currentDescriptionMaxLines));
				
				// Update tracked values
				this.lastCardSize = currentCardSize;
				this.lastImageAspectRatio = currentImageAspectRatio;
				this.lastDescriptionMaxLines = currentDescriptionMaxLines;
			}
		}, 100);
		
		// Register cleanup for polling interval
		this.registerCleanup(() => {
			if (this.configPollInterval !== null) {
				window.clearInterval(this.configPollInterval);
				this.configPollInterval = null;
			}
		});
	}

	updateGridLayout(settings: CMSSettings): void {
		// Just set the card min width - CSS Grid auto-fill handles column snapping automatically
		this.containerEl.style.setProperty('--card-min-width', `${settings.cardSize}px`);
		this.containerEl.style.setProperty('--bases-cms-image-aspect-ratio', String(settings.imageAspectRatio));
		
		// Update tracked values to prevent unnecessary polling triggers
		this.lastCardSize = settings.cardSize;
		this.lastImageAspectRatio = settings.imageAspectRatio;
	}

	cleanup(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		if (this.windowResizeHandler) {
			window.removeEventListener('resize', this.windowResizeHandler);
			this.windowResizeHandler = null;
		}
		if (this.scrollListener) {
			this.containerEl.removeEventListener('scroll', this.scrollListener);
			this.scrollListener = null;
		}
		if (this.scrollThrottleTimeout !== null) {
			window.clearTimeout(this.scrollThrottleTimeout);
			this.scrollThrottleTimeout = null;
		}
		if (this.configPollInterval !== null) {
			window.clearInterval(this.configPollInterval);
			this.configPollInterval = null;
		}
		this.virtualScrollCallback = null;
	}

	/**
	 * Check if virtual scrolling should be enabled based on total entries and settings
	 */
	shouldEnableVirtualScroll(totalEntries: number): boolean {
		const threshold = this.pluginSettings.virtualScrollThreshold;
		return totalEntries > threshold;
	}

	/**
	 * Get whether virtual scrolling is currently enabled
	 */
	isVirtualScrollEnabled(): boolean {
		return this.virtualScrollEnabled;
	}

	/**
	 * Update estimated card height based on actual rendered cards
	 */
	updateCardMetrics(cardHeight: number, cardsPerRow: number): void {
		if (cardHeight > 0) {
			this.estimatedCardHeight = cardHeight;
		}
		if (cardsPerRow > 0) {
			this.cardsPerRow = cardsPerRow;
		}
	}

	/**
	 * Calculate cards per row based on container width and card min width
	 */
	private calculateCardsPerRow(): number {
		const containerWidth = this.containerEl.clientWidth;
		const cardMinWidth = this.lastCardSize || 280;
		const gap = 16; // CSS grid gap
		return Math.max(1, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
	}

	/**
	 * Calculate which cards should be visible in the viewport
	 */
	calculateVisibleRange(totalEntries: number): VirtualScrollRange {
		const scrollTop = this.containerEl.scrollTop;
		const viewportHeight = this.containerEl.clientHeight;
		const buffer = this.pluginSettings.virtualScrollBuffer;

		// Update cards per row based on current container
		this.cardsPerRow = this.calculateCardsPerRow();

		// Calculate row height (card height + gap)
		const rowHeight = this.estimatedCardHeight + 16; // 16px gap

		// Calculate total rows
		const totalRows = Math.ceil(totalEntries / this.cardsPerRow);

		// Calculate which rows are visible
		const firstVisibleRow = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
		const lastVisibleRow = Math.min(
			totalRows - 1,
			Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer
		);

		// Convert rows to card indices
		const startIndex = firstVisibleRow * this.cardsPerRow;
		const endIndex = Math.min(totalEntries - 1, (lastVisibleRow + 1) * this.cardsPerRow - 1);

		// Calculate padding for scroll position
		const topPadding = firstVisibleRow * rowHeight;
		const bottomPadding = Math.max(0, (totalRows - lastVisibleRow - 1) * rowHeight);

		return {
			startIndex,
			endIndex,
			topPadding,
			bottomPadding
		};
	}

	/**
	 * Setup virtual scrolling for large card sets
	 */
	setupVirtualScroll(
		totalEntries: number,
		onRangeChange: (range: VirtualScrollRange) => void
	): VirtualScrollRange | null {
		this.totalEntries = totalEntries;
		this.virtualScrollCallback = onRangeChange;

		// Check if we should enable virtual scrolling
		if (!this.shouldEnableVirtualScroll(totalEntries)) {
			this.virtualScrollEnabled = false;
			return null;
		}

		this.virtualScrollEnabled = true;

		// Clean up existing listener
		if (this.scrollListener) {
			this.containerEl.removeEventListener('scroll', this.scrollListener);
			this.scrollListener = null;
		}

		// Create virtual scroll handler
		this.scrollListener = () => {
			// Throttle scroll events
			if (this.scrollThrottleTimeout !== null) {
				return;
			}

			const currentScrollTop = this.containerEl.scrollTop;

			// Only update if scroll position changed significantly (at least 50px)
			if (Math.abs(currentScrollTop - this.lastScrollTop) < 50) {
				return;
			}

			this.lastScrollTop = currentScrollTop;

			// Calculate new visible range
			const range = this.calculateVisibleRange(this.totalEntries);

			// Notify callback
			if (this.virtualScrollCallback) {
				this.virtualScrollCallback(range);
			}

			// Throttle
			this.scrollThrottleTimeout = activeWindow.setTimeout(() => {
				this.scrollThrottleTimeout = null;
			}, 16); // ~60fps
		};

		this.containerEl.addEventListener('scroll', this.scrollListener, { passive: true });

		// Register cleanup
		this.registerCleanup(() => {
			if (this.scrollListener) {
				this.containerEl.removeEventListener('scroll', this.scrollListener);
				this.scrollListener = null;
			}
		});

		// Return initial visible range
		return this.calculateVisibleRange(totalEntries);
	}

	/**
	 * Get total scroll height for virtual scrolling
	 */
	getVirtualScrollHeight(totalEntries: number): number {
		const totalRows = Math.ceil(totalEntries / this.cardsPerRow);
		const rowHeight = this.estimatedCardHeight + 16;
		return totalRows * rowHeight;
	}
}


