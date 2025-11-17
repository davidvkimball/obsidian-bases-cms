import { PluginSettingTab, Setting, App, Plugin } from 'obsidian';
import { BasesCMSSettings, DEFAULT_SETTINGS } from './types';

export class BasesCMSSettingTab extends PluginSettingTab {
	plugin: Plugin & { settings: BasesCMSSettings };

	constructor(app: App, plugin: Plugin & { settings: BasesCMSSettings }) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Bulk operation settings
		new Setting(containerEl)
			.setName('Confirm bulk operations')
			.setDesc('Show confirmation dialogs before performing bulk operations')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmBulkOperations)
				.onChange(async (value) => {
					this.plugin.settings.confirmBulkOperations = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		// Deletion settings
		containerEl.createEl('h3', { text: 'Deletions' });

		new Setting(containerEl)
			.setName('Delete parent folder for specific file name')
			.setDesc('When enabled, deleting a note will delete its parent folder if the note filename matches the specified name')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.deleteParentFolder)
				.onChange(async (value) => {
					this.plugin.settings.deleteParentFolder = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Folder deletion filename')
			.setDesc('Filename that triggers parent folder deletion (e.g., "index")')
			.addText(text => text
				.setPlaceholder('index')
				.setValue(this.plugin.settings.deleteParentFolderFilename)
				.onChange(async (value) => {
					this.plugin.settings.deleteParentFolderFilename = value;
					await this.plugin.saveData(this.plugin.settings);
				}))
			.setDisabled(!this.plugin.settings.deleteParentFolder);

		new Setting(containerEl)
			.setName('Delete associated unique attachments')
			.setDesc('When deleting a note, automatically delete attachments that are only used by that note. Attachments used by other notes will be preserved.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.deleteUniqueAttachments)
				.onChange(async (value) => {
					this.plugin.settings.deleteUniqueAttachments = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Confirm deletions')
			.setDesc('Show confirmation dialog before deleting files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmDeletions)
				.onChange(async (value) => {
					this.plugin.settings.confirmDeletions = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		// Icon settings
		containerEl.createEl('h3', { text: 'Appearance' });

		new Setting(containerEl)
			.setName('Use home icon for CMS view')
			.setDesc('Use the home icon instead of blocks icon for the CMS view in the Bases view selector. Restart Obsidian for this change to take effect.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useHomeIcon)
				.onChange(async (value) => {
					this.plugin.settings.useHomeIcon = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		// Performance settings
		containerEl.createEl('h3', { text: 'Performance' });

		new Setting(containerEl)
			.setName('Thumbnail cache size')
			.setDesc('Maximum size for generated thumbnails. Larger sizes provide better quality but use more memory. This setting caps the thumbnail size regardless of card size.')
			.addDropdown(dropdown => dropdown
				.addOption('minimal', 'Minimal (100x100, fastest)')
				.addOption('small', 'Small (200x200)')
				.addOption('balanced', 'Balanced (400x400, recommended)')
				.addOption('large', 'Large (800x800)')
				.addOption('unlimited', 'Unlimited (full resolution)')
				.setValue(this.plugin.settings.thumbnailCacheSize)
				.onChange(async (value: 'minimal' | 'small' | 'balanced' | 'large' | 'unlimited') => {
					this.plugin.settings.thumbnailCacheSize = value;
					await this.plugin.saveData(this.plugin.settings);
				}));
	}
}

