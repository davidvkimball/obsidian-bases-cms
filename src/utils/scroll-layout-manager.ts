/**
 * Scroll and Layout Manager
 * Handles infinite scroll and responsive grid layout
 */

import { App } from 'obsidian';
import { GAP_SIZE } from '../shared/constants';
import type { CMSSettings } from '../shared/data-transform';
import { readCMSSettings } from '../shared/settings-schema';
import type { BasesCMSSettings } from '../types';

interface BasesConfig {
	get(key: string): unknown;
}

export class ScrollLayoutManager {
	private scrollListener: (() => void) | null = null;
	private scrollThrottleTimeout: number | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private isLoading: boolean = false;
	private displayedCount: number = 50;
	private totalEntries: number = 0;

	constructor(
		private containerEl: HTMLElement,
		private app: App,
		private config: BasesConfig,
		private pluginSettings: BasesCMSSettings,
		private onLoadMore: () => void,
		private registerCleanup: (cleanup: () => void) => void
	) {
		const isMobile = (this.app as { isMobile?: boolean }).isMobile ?? false;
		this.displayedCount = isMobile ? 25 : 50;
	}

	setDisplayedCount(count: number): void {
		this.displayedCount = count;
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
			this.scrollThrottleTimeout = window.setTimeout(() => {
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
		if (this.resizeObserver) {
			return; // Already set up
		}

		this.resizeObserver = new ResizeObserver(() => {
			const containerWidth = this.containerEl.clientWidth;
			const currentSettings = readCMSSettings(
				this.config,
				this.pluginSettings
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

	updateGridLayout(settings: CMSSettings): void {
		const containerWidth = this.containerEl.clientWidth;
		const cardMinWidth = settings.cardSize;
		const minColumns = 1;
		const gap = GAP_SIZE;
		const cols = Math.max(minColumns, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
		const cardWidth = (containerWidth - (gap * (cols - 1))) / cols;

		this.containerEl.style.setProperty('--card-min-width', `${cardWidth}px`);
		this.containerEl.style.setProperty('--grid-columns', String(cols));
		this.containerEl.style.setProperty('--dynamic-views-image-aspect-ratio', String(settings.imageAspectRatio));
	}

	cleanup(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		if (this.scrollListener) {
			this.containerEl.removeEventListener('scroll', this.scrollListener);
			this.scrollListener = null;
		}
		if (this.scrollThrottleTimeout !== null) {
			window.clearTimeout(this.scrollThrottleTimeout);
			this.scrollThrottleTimeout = null;
		}
	}
}

