/**
 * Bases CMS View
 * Based on Dynamic Views grid implementation
 */

import { BasesView, BasesEntry, QueryController, TFile } from 'obsidian';
import type BasesCMSPlugin from '../main';
import { transformBasesEntries } from '../shared/data-transform';
import { readCMSSettings, getCMSViewOptions } from '../shared/settings-schema';
import { getFirstBasesPropertyValue, getAllBasesImagePropertyValues } from '../utils/property';
import { loadSnippetsForEntries, loadImagesForEntries } from '../shared/content-loader';
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

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: BasesCMSPlugin) {
		super(controller);
		this.containerEl = containerEl;
		this.plugin = plugin;
		
		// Initialize shared card renderer
		this.cardRenderer = new SharedCardRenderer(
			this.app,
			this.plugin,
			this.propertyObservers,
			this.updateLayoutRef
		);
		
		// Add CMS container classes
		this.containerEl.addClass('bases-cms');
		this.containerEl.addClass('bases-cms-container');
		this.containerEl.style.overflowY = 'auto';
		this.containerEl.style.overflowX = 'hidden';
		this.containerEl.style.height = '100%';
		
		// Set initial batch size
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.displayedCount = (this.app as any).isMobile ? 25 : BATCH_SIZE;
	}

	onDataUpdated(): void {
		void (async () => {
			const groupedData = this.data.groupedData;
			const allEntries = this.data.data;

			// Read settings from Bases config
			const settings = readCMSSettings(
				this.config,
				this.plugin.settings
			);

			// Calculate grid columns
			const containerWidth = this.containerEl.clientWidth;
			const cardMinWidth = 250; // Minimum card width
			const minColumns = 1;
			const gap = GAP_SIZE;
			const cols = Math.max(minColumns, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
			const cardWidth = (containerWidth - (gap * (cols - 1))) / cols;

			// Set CSS variables for grid layout
			this.containerEl.style.setProperty('--card-min-width', `${cardWidth}px`);
			this.containerEl.style.setProperty('--grid-columns', String(cols));

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

			// Load snippets and images ONLY for displayed entries
			await this.loadContentForEntries(visibleEntries, settings);

			// Clear and re-render
			this.containerEl.empty();

			// Disconnect old property observers before re-rendering
			this.propertyObservers.forEach(obs => obs.disconnect());
			this.propertyObservers = [];

			// Create cards feed container
			const feedEl = this.containerEl.createDiv('bases-cms-grid');

			// Render groups with headers
			let displayedSoFar = 0;
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
					this.renderCard(groupEl, card, entry, displayedSoFar + i, settings);
				}

				displayedSoFar += entriesToDisplay;
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
					const cardMinWidth = 250;
					const minColumns = 1;
					const gap = GAP_SIZE;
					const cols = Math.max(minColumns, Math.floor((containerWidth + gap) / (cardMinWidth + gap)));
					const cardWidth = (containerWidth - (gap * (cols - 1))) / cols;

					this.containerEl.style.setProperty('--card-min-width', `${cardWidth}px`);
					this.containerEl.style.setProperty('--grid-columns', String(cols));
				});
				this.resizeObserver.observe(this.containerEl);
			}

			// Update selection UI
			this.updateSelectionUI();

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
	): void {
		const isSelected = this.selectedFiles.has(card.path);
		this.cardRenderer.renderCard(
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

	private async loadContentForEntries(entries: BasesEntry[], settings: any): Promise<void> {
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

			await loadSnippetsForEntries(
				snippetEntries,
				settings.fallbackToContent,
				false,
				this.app,
				this.snippets
			);
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

			await loadImagesForEntries(
				imageEntries,
				settings.fallbackToEmbeds,
				this.app,
				this.images,
				this.hasImageAvailable
			);
		}
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
		this.updateSelectionUI();
	}

	private async handlePropertyToggle(path: string, property: string, value: unknown): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return;

			// Strip "note." prefix if present (Bases uses "note.property" but frontmatter uses just "property")
			const cleanProperty = property.startsWith('note.') ? property.substring(5) : property;

			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				frontmatter[cleanProperty] = value;
			});

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

		// Show/hide bulk toolbar
		if (this.selectedFiles.size > 0) {
			if (!this.bulkToolbar) {
				this.bulkToolbar = new BulkToolbar(
					this.app,
					this.plugin,
					this.containerEl,
					() => Array.from(this.selectedFiles),
					() => {
						this.selectedFiles.clear();
						this.updateSelectionUI();
					},
					() => this.onDataUpdated(),
					() => this.selectAll(),
					() => this.deselectAll()
				);
			}
			this.bulkToolbar.updateCount(this.selectedFiles.size);
			this.bulkToolbar.show();
		} else {
			if (this.bulkToolbar) {
				this.bulkToolbar.hide();
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
	}
}
