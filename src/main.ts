import { Plugin, QueryController } from 'obsidian';
import { BasesCMSSettingTab } from './settings';
import { BasesCMSView, CMS_VIEW_TYPE } from './views/cms-view';
import { BasesCMSSettings, DEFAULT_SETTINGS } from './types';

export default class BasesCMSPlugin extends Plugin {
	settings!: BasesCMSSettings;
	private activeViews: Set<BasesCMSView> = new Set();

	async onload() {
		await this.loadSettings();

		// Register settings tab
		this.addSettingTab(new BasesCMSSettingTab(this.app, this));

		// Register CMS view with Base plugin
		// Graceful degradation: if Base plugin not installed, this will simply do nothing
		// On mobile, Bases plugin may not be loaded yet, so we wait a bit
		this.registerBasesCMSView();
	}

	private registerBasesCMSView(retries = 5): void {
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if (typeof (this as any).registerBasesView === 'function') {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(this as any).registerBasesView(CMS_VIEW_TYPE, {
					name: 'CMS',
					icon: this.settings.useHomeIcon ? 'lucide-home' : 'lucide-blocks',
					factory: (controller: QueryController, containerEl: HTMLElement) => {
						const view = new BasesCMSView(controller, containerEl, this);
						this.activeViews.add(view);
						return view;
					},
					options: this.getCMSViewOptions()
				});
			} else if (retries > 0) {
				// Method not available yet, retry after a short delay (common on mobile)
				setTimeout(() => {
					this.registerBasesCMSView(retries - 1);
				}, 200);
			} else {
				console.warn('Bases CMS: registerBasesView not available. Is Bases plugin installed?');
			}
		} catch (error) {
			console.error('Bases CMS: Error registering view:', error);
		}
	}

	onunload() {
		// Cleanup
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const containerEl = (view as any).containerEl;
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
	 * Get CMS view options for Base plugin configuration
	 */
	private getCMSViewOptions(): () => any[] {
		const { getCMSViewOptions } = require('./shared/settings-schema');
		return getCMSViewOptions;
	}
}

