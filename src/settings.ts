import { PluginSettingTab, Setting, App, Plugin } from 'obsidian';
import { BasesCMSSettings, DEFAULT_SETTINGS } from './types';
import { CommandPickerModal } from './components/command-picker-modal';

export class BasesCMSSettingTab extends PluginSettingTab {
	plugin: Plugin & { settings: BasesCMSSettings };

	constructor(app: App, plugin: Plugin & { settings: BasesCMSSettings }) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Refresh toolbars in all active CMS views when settings change
	 */
	private refreshActiveToolbars(): void {
		// Use the plugin's method to refresh all toolbars
		if (this.plugin && typeof (this.plugin as any).refreshAllToolbars === 'function') {
			(this.plugin as any).refreshAllToolbars();
		}
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

		// Toolbar button visibility settings
		containerEl.createEl('h3', { text: 'Toolbar buttons' });

		new Setting(containerEl)
			.setName('Show select all button')
			.setDesc('Display the select all button in the CMS toolbar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarSelectAll)
				.onChange(async (value) => {
					this.plugin.settings.showToolbarSelectAll = value;
					await this.plugin.saveData(this.plugin.settings);
					this.refreshActiveToolbars();
				}));

		new Setting(containerEl)
			.setName('Show clear button')
			.setDesc('Display the clear selection button in the CMS toolbar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarClear)
				.onChange(async (value) => {
					this.plugin.settings.showToolbarClear = value;
					await this.plugin.saveData(this.plugin.settings);
					this.refreshActiveToolbars();
				}));

		new Setting(containerEl)
			.setName('Show publish button')
			.setDesc('Display the publish button in the CMS toolbar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarPublish)
				.onChange(async (value) => {
					this.plugin.settings.showToolbarPublish = value;
					await this.plugin.saveData(this.plugin.settings);
					this.refreshActiveToolbars();
				}));

		new Setting(containerEl)
			.setName('Show draft button')
			.setDesc('Display the draft button in the CMS toolbar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarDraft)
				.onChange(async (value) => {
					this.plugin.settings.showToolbarDraft = value;
					await this.plugin.saveData(this.plugin.settings);
					this.refreshActiveToolbars();
				}));

		new Setting(containerEl)
			.setName('Show tags button')
			.setDesc('Display the tags button in the CMS toolbar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarTags)
				.onChange(async (value) => {
					this.plugin.settings.showToolbarTags = value;
					await this.plugin.saveData(this.plugin.settings);
					this.refreshActiveToolbars();
				}));

		new Setting(containerEl)
			.setName('Show set button')
			.setDesc('Display the set property button in the CMS toolbar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarSet)
				.onChange(async (value) => {
					this.plugin.settings.showToolbarSet = value;
					await this.plugin.saveData(this.plugin.settings);
					this.refreshActiveToolbars();
				}));

		new Setting(containerEl)
			.setName('Show remove button')
			.setDesc('Display the remove property button in the CMS toolbar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarRemove)
				.onChange(async (value) => {
					this.plugin.settings.showToolbarRemove = value;
					await this.plugin.saveData(this.plugin.settings);
					this.refreshActiveToolbars();
				}));

		new Setting(containerEl)
			.setName('Show delete button')
			.setDesc('Display the delete button in the CMS toolbar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarDelete)
				.onChange(async (value) => {
					this.plugin.settings.showToolbarDelete = value;
					await this.plugin.saveData(this.plugin.settings);
					this.refreshActiveToolbars();
				}));

		// Deletion settings
		containerEl.createEl('h3', { text: 'Deletions' });

		new Setting(containerEl)
			.setName('Delete parent folder for specific file name')
			.setDesc('When enabled, deleting a note will delete its parent folder and all its contents if the note filename matches the specified name')
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

		// Quick edit settings
		containerEl.createEl('h3', { text: 'Quick edit' });

		const quickEditToggleSetting = new Setting(containerEl)
			.setName('Enable quick edit')
			.setDesc('Show a pencil icon on card titles that launches a command when clicked')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableQuickEdit)
				.onChange(async (value) => {
					this.plugin.settings.enableQuickEdit = value;
					await this.plugin.saveData(this.plugin.settings);
					// Show/hide command selector based on toggle
					quickEditCommandSetting.settingEl.style.display = value ? '' : 'none';
				}));

		// Command picker setting
		const quickEditCommandSetting = new Setting(containerEl)
			.setName('Quick edit command')
			.setDesc('The Obsidian command to execute when clicking the quick edit icon on a card title')
			.addButton(button => {
				const currentCommandName = this.plugin.settings.quickEditCommandName || 
					(this.plugin.settings.quickEditCommand ? 'Select command...' : 'No command selected');
				button.setButtonText(currentCommandName)
					.onClick(() => {
						const modal = new CommandPickerModal(this.app, async (commandId: string) => {
							// Get command name by looking it up
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							const commandRegistry = (this.app as any).commands;
							let commandName = '';
							
							// Try to find the command name
							if (commandRegistry) {
								// Try listCommands()
								if (typeof commandRegistry.listCommands === 'function') {
									const commands = commandRegistry.listCommands();
									const command = commands.find((cmd: any) => cmd.id === commandId);
									if (command) {
										commandName = command.name;
									}
								}
								
								// Fallback: try direct registry access
								if (!commandName) {
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									const registry = (commandRegistry as any).commands;
									if (registry && registry[commandId]) {
										commandName = registry[commandId].name || '';
									}
								}
							}
							
							this.plugin.settings.quickEditCommand = commandId;
							this.plugin.settings.quickEditCommandName = commandName;
							await this.plugin.saveData(this.plugin.settings);
							
							// Re-render to update the UI
							this.display();
						});
						modal.open();
					});
				
				// Add a clear button if a command is selected
				if (this.plugin.settings.quickEditCommand) {
					const clearButton = button.buttonEl.parentElement?.createEl('button', {
						text: 'Clear',
						attr: { style: 'margin-left: 8px;' }
					});
					clearButton?.addEventListener('click', async () => {
						this.plugin.settings.quickEditCommand = '';
						this.plugin.settings.quickEditCommandName = '';
						await this.plugin.saveData(this.plugin.settings);
						// Re-render to update the UI
						this.display();
					});
				}
			});
		
		// Hide command selector if quick edit is disabled
		quickEditCommandSetting.settingEl.style.display = this.plugin.settings.enableQuickEdit ? '' : 'none';

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
				.onChange(async (value: string) => {
					this.plugin.settings.thumbnailCacheSize = value as 'minimal' | 'small' | 'balanced' | 'large' | 'unlimited';
					await this.plugin.saveData(this.plugin.settings);
				}));
	}
}

