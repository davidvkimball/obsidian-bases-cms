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

		containerEl.createEl('h2', { text: 'Bases CMS Settings' });

		// Card layout settings
		new Setting(containerEl)
			.setName('Card layout')
			.setDesc('Choose the default card layout style')
			.addDropdown(dropdown => dropdown
				.addOption('top-cover', 'Top Cover')
				.addOption('square', 'Square')
				.setValue(this.plugin.settings.cardLayout)
				.onChange(async (value: 'top-cover' | 'square') => {
					this.plugin.settings.cardLayout = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

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
		containerEl.createEl('h3', { text: 'Deletion Settings' });

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

		// Confirmation settings
		containerEl.createEl('h3', { text: 'Confirmation Settings' });

		new Setting(containerEl)
			.setName('Confirm deletions')
			.setDesc('Show confirmation dialog before deleting files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmDeletions)
				.onChange(async (value) => {
					this.plugin.settings.confirmDeletions = value;
					await this.plugin.saveData(this.plugin.settings);
				}));
	}
}

