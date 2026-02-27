import { Plugin, View, Constructor } from 'obsidian';
import { BasesCMSSettingTab } from './settings';
import { BasesCMSView, CMS_VIEW_TYPE, CMS_VIEW_ALIAS } from './views/cms-view';
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
		// Register keyboard shortcuts for bulk operations
		this.addCommand({
			id: 'select-all',
			name: 'Select all visible cards',
			checkCallback: (checking: boolean) => {
				const activeView = this.getActiveCMSView();
				if (activeView) {
					if (!checking) {
						activeView.selectAll();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'deselect-all',
			name: 'Deselect all cards',
			checkCallback: (checking: boolean) => {
				const activeView = this.getActiveCMSView();
				if (activeView) {
					if (!checking) {
						activeView.deselectAll();
					}
					return true;
				}
				return false;
			}
		});

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

	/**
	 * Robustly find the active CMS view
	 */
	private getActiveCMSView(): BasesCMSView | null {
		// 1. Try standard Obsidian way
		try {
			// Use string-based constructor access if possible, or direct class reference
			const obsidianActiveView = this.app.workspace.getActiveViewOfType(BasesCMSView as unknown as Constructor<View>);
			if (obsidianActiveView && obsidianActiveView instanceof BasesCMSView) {
				return obsidianActiveView;
			}
		} catch (e) {
			// Ignore errors from standard detection
		}

		// 2. Fallback: check all our tracked views
		// This is necessary because Bases plugin might manage views in a way that
		// getActiveViewOfType doesn't recognize (e.g., if it wraps the view)
		const activeLeaf = this.app.workspace.activeLeaf;
		if (!activeLeaf) return null;

		for (const view of this.activeViews) {
			try {
				// Use type check instead of instanceof to avoid circular dependency issues
				if (view.type !== CMS_VIEW_TYPE && view.type !== CMS_VIEW_ALIAS) continue;

				const containerEl = (view as unknown as { containerEl?: HTMLElement }).containerEl;
				if (containerEl && containerEl.isConnected) {
					// Check if this view's container is within the active leaf's container
					if (activeLeaf.view.containerEl.contains(containerEl)) {
						return view;
					}
				}
			} catch (e) {
				// Skip if view is in a weird state
			}
		}

		return null;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Clean up stale view references that are no longer in the DOM
	 * Returns the number of views removed
	 */
	private cleanupStaleViews(): number {
		const viewsToRemove: BasesCMSView[] = [];
		this.activeViews.forEach(view => {
			const containerEl = (view as unknown as { containerEl?: HTMLElement }).containerEl;
			if (!containerEl || !containerEl.parentElement) {
				viewsToRemove.push(view);
			}
		});
		viewsToRemove.forEach(view => this.activeViews.delete(view));
		return viewsToRemove.length;
	}

	/**
	 * Refresh toolbars in all active CMS views
	 */
	refreshAllToolbars(): void {
		this.cleanupStaleViews();

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

			this.cleanupStaleViews();

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
		}, this.settings.embeddedViewRefreshDebounceMs); // Configurable debounce delay
	}

}


