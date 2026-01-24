import { Plugin } from 'obsidian';
import { BasesCMSSettingTab } from './settings';
import { BasesCMSView } from './views/cms-view';
import { BasesCMSSettings, DEFAULT_SETTINGS } from './types';
import { registerBasesCMSView } from './utils/view-registration';

export default class BasesCMSPlugin extends Plugin {
	settings!: BasesCMSSettings;
	activeViews: Set<BasesCMSView> = new Set();
	registrationTimeout: number | null = null;
	private refreshEmbeddedViewsTimeout: number | null = null;
	selections: Map<string, Set<string>> = new Map();

	async onload() {
		await this.loadSettings();

		// Register settings tab
		this.addSettingTab(new BasesCMSSettingTab(this.app, this));

		// Register CMS view with Base plugin
		// Graceful degradation: if Base plugin not installed, this will simply do nothing
		// On mobile, Bases plugin may not be loaded yet, so we wait a bit
		registerBasesCMSView(this);

		// Listen for active file changes to refresh embedded views
		// This ensures embedded views update when the active file changes (for dynamic filters using this.file)
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.refreshEmbeddedViews();
			})
		);

		// Also listen for file-open events as a backup
		this.registerEvent(
			this.app.workspace.on('file-open', () => {
				this.refreshEmbeddedViews();
			})
		);
	}

	onunload() {
		// Clear any pending registration timeout
		if (this.registrationTimeout !== null) {
			window.clearTimeout(this.registrationTimeout);
			this.registrationTimeout = null;
		}

		// Clear any pending embedded view refresh timeout
		if (this.refreshEmbeddedViewsTimeout !== null) {
			window.clearTimeout(this.refreshEmbeddedViewsTimeout);
			this.refreshEmbeddedViewsTimeout = null;
		}
		
		// Clean up active views
		this.activeViews.clear();
	}

	async loadSettings() {
		const data = await this.loadData() as Partial<BasesCMSSettings>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Refresh toolbars in all active CMS views
	 */
	refreshAllToolbars(): void {
		// Clean up any views that are no longer active
		const viewsToRemove: BasesCMSView[] = [];
		this.activeViews.forEach(view => {
			// Check if view is still in DOM
			const containerEl = (view as unknown as { containerEl?: HTMLElement }).containerEl;
			if (!containerEl || !containerEl.parentElement) {
				viewsToRemove.push(view);
			}
		});
		
		// Remove inactive views
		viewsToRemove.forEach(view => this.activeViews.delete(view));
		
		// Refresh all active views
		this.activeViews.forEach(view => {
			if (view && typeof view.refreshToolbar === 'function') {
				view.refreshToolbar();
			}
		});
	}

	/**
	 * Remove a view from tracking when it's closed
	 */
	removeView(view: BasesCMSView): void {
		this.activeViews.delete(view);
	}

	/**
	 * Refresh all embedded CMS views when the active file changes
	 * This ensures embedded views update their filters when using this.file properties
	 * Debounced to avoid excessive refreshes when switching files quickly
	 */
	refreshEmbeddedViews(): void {
		// Debounce to avoid excessive refreshes when switching files quickly
		if (this.refreshEmbeddedViewsTimeout !== null) {
			window.clearTimeout(this.refreshEmbeddedViewsTimeout);
		}

		this.refreshEmbeddedViewsTimeout = window.setTimeout(() => {
			this.refreshEmbeddedViewsTimeout = null;

			// Clean up any views that are no longer active
			const viewsToRemove: BasesCMSView[] = [];
			this.activeViews.forEach(view => {
				// Check if view is still in DOM
				const containerEl = (view as unknown as { containerEl?: HTMLElement }).containerEl;
				if (!containerEl || !containerEl.parentElement) {
					viewsToRemove.push(view);
				}
			});

			// Remove inactive views
			viewsToRemove.forEach(view => this.activeViews.delete(view));

			// Refresh all embedded views
			let refreshedCount = 0;
			this.activeViews.forEach(view => {
				// Only refresh embedded views
				if (view.isEmbedded) {
					try {
						// Check if view is still connected to DOM
						const containerEl = (view as unknown as { containerEl?: HTMLElement }).containerEl;
						if (containerEl && containerEl.isConnected) {
							// Trigger refresh by calling onDataUpdated
							// The Bases plugin will re-evaluate filters with the new this.file context
							if (typeof (view as { onDataUpdated?: () => void }).onDataUpdated === 'function') {
								(view as { onDataUpdated: () => void }).onDataUpdated();
								refreshedCount++;
							}
						}
					} catch (error) {
						// Silently ignore errors for individual views
						console.warn('Bases CMS: Error refreshing embedded view:', error);
					}
				}
			});

			// Log for debugging (can be removed in production)
			if (refreshedCount > 0) {
				console.debug(`Bases CMS: Refreshed ${refreshedCount} embedded view(s) after active file change`);
			}
		}, 150); // 150ms debounce - short enough to feel responsive, long enough to batch rapid changes
	}

}


