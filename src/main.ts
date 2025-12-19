import { Plugin } from 'obsidian';
import { BasesCMSSettingTab } from './settings';
import { BasesCMSView } from './views/cms-view';
import { BasesCMSSettings, DEFAULT_SETTINGS } from './types';
import { registerBasesCMSView } from './utils/view-registration';

export default class BasesCMSPlugin extends Plugin {
	settings!: BasesCMSSettings;
	activeViews: Set<BasesCMSView> = new Set();
	registrationTimeout: number | null = null;

	async onload() {
		await this.loadSettings();

		// Register settings tab
		this.addSettingTab(new BasesCMSSettingTab(this.app, this));

		// Register CMS view with Base plugin
		// Graceful degradation: if Base plugin not installed, this will simply do nothing
		// On mobile, Bases plugin may not be loaded yet, so we wait a bit
		registerBasesCMSView(this);
	}

	onunload() {
		// Clear any pending registration timeout
		if (this.registrationTimeout !== null) {
			window.clearTimeout(this.registrationTimeout);
			this.registrationTimeout = null;
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

}


