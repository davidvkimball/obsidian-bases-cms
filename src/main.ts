import { Plugin, QueryController } from 'obsidian';
import { BasesCMSSettingTab } from './settings';
import { BasesCMSView, CMS_VIEW_TYPE } from './views/cms-view';
import { BasesCMSSettings, DEFAULT_SETTINGS } from './types';

export default class BasesCMSPlugin extends Plugin {
	settings: BasesCMSSettings;

	async onload() {
		await this.loadSettings();

		// Register settings tab
		this.addSettingTab(new BasesCMSSettingTab(this.app, this));

		// Register CMS view with Base plugin
		// Graceful degradation: if Base plugin not installed, this will simply do nothing
		try {
			this.registerBasesView(CMS_VIEW_TYPE, {
				name: 'CMS',
				icon: this.settings.useHomeIcon ? 'lucide-home' : 'lucide-blocks',
				factory: (controller: QueryController, containerEl: HTMLElement) => {
					return new BasesCMSView(controller, containerEl, this);
				},
				options: this.getCMSViewOptions()
			});
		} catch (error) {
			// Base plugin not available - graceful degradation
			console.log('Bases CMS: Base plugin not available');
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
	 * Get CMS view options for Base plugin configuration
	 */
	private getCMSViewOptions(): () => any[] {
		const { getCMSViewOptions } = require('./shared/settings-schema');
		return getCMSViewOptions;
	}
}

