import { PluginSettingTab, Setting, App, Plugin } from 'obsidian';
import { BasesCMSSettings } from './types';
import { CommandPickerModal } from './components/command-picker-modal';
import { IconPickerModal } from './components/icon-picker-modal';

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
		const pluginWithMethod = this.plugin as { refreshAllToolbars?: () => void };
		if (pluginWithMethod && typeof pluginWithMethod.refreshAllToolbars === 'function') {
			pluginWithMethod.refreshAllToolbars();
		}
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Bulk operation settings
		new Setting(containerEl)
			.setName('Confirm bulk operations')
			.setDesc('Show confirmation dialogs before performing bulk operations.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmBulkOperations)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.confirmBulkOperations = value;
						await this.plugin.saveData(this.plugin.settings);
					})();
				}));

		// Toolbar button visibility settings
		new Setting(containerEl).setName('Toolbar buttons').setHeading();

		new Setting(containerEl)
			.setName('Show select all button')
			.setDesc('Display the select all button in the CMS toolbar.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarSelectAll)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.showToolbarSelectAll = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					})();
				}));

		new Setting(containerEl)
			.setName('Show clear button')
			.setDesc('Display the clear selection button in the CMS toolbar.')
				.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarClear)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.showToolbarClear = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					})();
				}));

		new Setting(containerEl)
			.setName('Show publish button')
			.setDesc('Display the publish button in the CMS toolbar.')
				.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarPublish)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.showToolbarPublish = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					})();
				}));

		new Setting(containerEl)
			.setName('Show draft button')
			.setDesc('Display the draft button in the CMS toolbar.')
				.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarDraft)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.showToolbarDraft = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					})();
				}));

		new Setting(containerEl)
			.setName('Show tags button')
			.setDesc('Display the tags button in the CMS toolbar.')
				.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarTags)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.showToolbarTags = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					})();
				}));

		new Setting(containerEl)
			.setName('Show set button')
			.setDesc('Display the set property button in the CMS toolbar.')
				.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarSet)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.showToolbarSet = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					})();
				}));

		new Setting(containerEl)
			.setName('Show remove button')
			.setDesc('Display the remove property button in the CMS toolbar.')
				.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarRemove)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.showToolbarRemove = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					})();
				}));

		new Setting(containerEl)
			.setName('Show delete button')
			.setDesc('Display the delete button in the CMS toolbar.')
				.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showToolbarDelete)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.showToolbarDelete = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					})();
				}));

		// Deletion settings
		new Setting(containerEl).setName('Deletions').setHeading();

		new Setting(containerEl)
			.setName('Delete parent folder for specific file name')
			.setDesc('When enabled, deleting a note will delete its parent folder and all its contents if the note file name matches the specified name.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.deleteParentFolder)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.deleteParentFolder = value;
						await this.plugin.saveData(this.plugin.settings);
					})();
				}));

		new Setting(containerEl)
			.setName('Folder deletion file name')
			.setDesc('File name that triggers parent folder deletion.')
			.addText(text => text
				.setPlaceholder('index')
				.setValue(this.plugin.settings.deleteParentFolderFilename)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.deleteParentFolderFilename = value;
						await this.plugin.saveData(this.plugin.settings);
					})();
				}))
			.setDisabled(!this.plugin.settings.deleteParentFolder);

		new Setting(containerEl)
			.setName('Delete associated unique attachments')
			.setDesc('When deleting a note, automatically delete attachments that are only used by that note. Attachments used by other notes will be preserved.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.deleteUniqueAttachments)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.deleteUniqueAttachments = value;
						await this.plugin.saveData(this.plugin.settings);
					})();
				}));

		new Setting(containerEl)
			.setName('Confirm deletions')
			.setDesc('Show confirmation dialog before deleting files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.confirmDeletions)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.confirmDeletions = value;
						await this.plugin.saveData(this.plugin.settings);
					})();
				}));

		// Icon settings
		new Setting(containerEl).setName('Appearance').setHeading();

		new Setting(containerEl)
			.setName('Use home icon for CMS view')
			.setDesc('Use the home icon instead of blocks icon for the CMS view in the Bases view selector. Restart Obsidian for this change to take effect.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useHomeIcon)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.useHomeIcon = value;
						await this.plugin.saveData(this.plugin.settings);
					})();
				}));

		new Setting(containerEl)
			.setName('Force static image for animated GIFs')
			.setDesc('When enabled, animated GIFs will display only the first frame when used as card covers or thumbnails.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.forceStaticGifImages)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.forceStaticGifImages = value;
						await this.plugin.saveData(this.plugin.settings);
						// Refresh all active views to apply the change
						const pluginWithMethod = this.plugin as { activeViews?: Set<{ onDataUpdated?: () => void }> };
						if (pluginWithMethod.activeViews) {
							pluginWithMethod.activeViews.forEach(view => {
								if (view.onDataUpdated) {
									view.onDataUpdated();
								}
							});
						}
					})();
				}));

		// Properties info modal setting
		// Quick edit settings
		new Setting(containerEl).setName('Quick edit').setHeading();

		// Define quick edit settings first (needed for visibility toggling)
		let quickEditCommandSetting: Setting;
		let quickEditIconSetting: Setting;
		let quickEditOpenFileSetting: Setting;

		new Setting(containerEl)
			.setName('Enable quick edit')
			.setDesc('Show an icon on card titles that launches a command when clicked.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableQuickEdit)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.enableQuickEdit = value;
						await this.plugin.saveData(this.plugin.settings);
						// Show/hide command selector and related settings based on toggle
						if (quickEditCommandSetting) quickEditCommandSetting.settingEl.toggleClass('bases-cms-setting-hidden', !value);
						if (quickEditIconSetting) quickEditIconSetting.settingEl.toggleClass('bases-cms-setting-hidden', !value);
						if (quickEditOpenFileSetting) quickEditOpenFileSetting.settingEl.toggleClass('bases-cms-setting-hidden', !value);
					})();
				}));

		// Command picker setting
		quickEditCommandSetting = new Setting(containerEl)
			.setName('Quick edit command')
			.setDesc('The command to execute when clicking the quick edit icon on a card title.')
			.addButton(button => {
				const currentCommandName = this.plugin.settings.quickEditCommandName || 
					(this.plugin.settings.quickEditCommand ? 'Select command...' : 'No command selected');
				button.setButtonText(currentCommandName)
					.onClick(() => {
						const modal = new CommandPickerModal(this.app, (commandId: string) => {
							void (async () => {
								// Get command name by looking it up
								const commandRegistry = (this.app as { commands?: { listCommands?: () => Array<{ id: string; name: string }>; commands?: Record<string, { name?: string }> } }).commands;
								let commandName = '';
								
								// Try to find the command name
								if (commandRegistry) {
									// Try listCommands()
									if (typeof commandRegistry.listCommands === 'function') {
										const commands = commandRegistry.listCommands();
										const command = commands.find((cmd) => cmd.id === commandId);
										if (command) {
											commandName = command.name;
										}
									}
									
									// Fallback: try direct registry access
									if (!commandName) {
										const registry = commandRegistry.commands;
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
							})();
						});
						modal.open();
					});
				
				// Add a clear button if a command is selected
				if (this.plugin.settings.quickEditCommand) {
					const clearButton = button.buttonEl.parentElement?.createEl('button', {
						text: 'Clear',
						attr: { style: 'margin-left: 8px;' }
					});
					clearButton?.addEventListener('click', () => {
						void (async () => {
							this.plugin.settings.quickEditCommand = '';
							this.plugin.settings.quickEditCommandName = '';
							await this.plugin.saveData(this.plugin.settings);
							// Re-render to update the UI
							this.display();
						})();
					});
				}
			});
		
		// Hide command selector if quick edit is disabled
		quickEditCommandSetting.settingEl.toggleClass('bases-cms-setting-hidden', !this.plugin.settings.enableQuickEdit);

		// Icon picker setting
		quickEditIconSetting = new Setting(containerEl)
			.setName('Quick edit icon')
			.setDesc('Select the icon to display for the quick edit button on card titles.')
			.addButton(button => {
				const iconName = this.getIconName(this.plugin.settings.quickEditIcon || 'pencil-line');
				button.setButtonText(iconName || 'Select icon...')
					.onClick(() => {
						const modal = new IconPickerModal(this.app, async (iconId) => {
							this.plugin.settings.quickEditIcon = iconId;
							await this.plugin.saveData(this.plugin.settings);
							// Re-render to show updated icon name
							this.display();
						});
						modal.open();
					});
			});
		
		// Hide icon selector if quick edit is disabled
		quickEditIconSetting.settingEl.toggleClass('bases-cms-setting-hidden', !this.plugin.settings.enableQuickEdit);

		// Quick edit open file setting
		quickEditOpenFileSetting = new Setting(containerEl)
			.setName('Attempt to open file and execute quick edit command')
			.setDesc('For commands that don\'t have special handling, attempt to open the file and execute the command. Some commands may not work properly this way.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.quickEditOpenFile)
				.onChange((value) => {
					void (async () => {
						this.plugin.settings.quickEditOpenFile = value;
						await this.plugin.saveData(this.plugin.settings);
					})();
				}));
		
		// Hide this setting if quick edit is disabled
		quickEditOpenFileSetting.settingEl.toggleClass('bases-cms-setting-hidden', !this.plugin.settings.enableQuickEdit);

	}

	private getIconName(iconId: string): string {
		if (!iconId) return '';
		// Convert icon ID to a readable name, removing lucide- prefix if present
		return iconId
			.replace(/^lucide-/, '') // Remove lucide- prefix
			.split('-')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
}

