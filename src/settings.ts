import { PluginSettingTab, Setting, App, Plugin } from 'obsidian';
import { BasesCMSSettings } from './types';
import { CommandPickerModal } from './components/command-picker-modal';
import { IconPickerModal } from './components/icon-picker-modal';
import { createSettingsGroup } from './utils/settings-compat';

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
		const toolbarButtonsGroup = createSettingsGroup(containerEl, 'Toolbar buttons');

		toolbarButtonsGroup.addSetting(setting => {
			setting
				.setName('Show select all button')
				// False positive: Already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Display the select all button in the CMS toolbar.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.showToolbarSelectAll);
					toggle.onChange(async (value) => {
						this.plugin.settings.showToolbarSelectAll = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					});
				});
		});

		toolbarButtonsGroup.addSetting(setting => {
			setting
				.setName('Show clear button')
				// False positive: Already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Display the clear selection button in the CMS toolbar.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.showToolbarClear);
					toggle.onChange(async (value) => {
						this.plugin.settings.showToolbarClear = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					});
				});
		});

		toolbarButtonsGroup.addSetting(setting => {
			setting
				.setName('Show publish button')
				// False positive: Already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Display the publish button in the CMS toolbar.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.showToolbarPublish);
					toggle.onChange(async (value) => {
						this.plugin.settings.showToolbarPublish = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					});
				});
		});

		toolbarButtonsGroup.addSetting(setting => {
			setting
				.setName('Show draft button')
				// False positive: Already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Display the draft button in the CMS toolbar.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.showToolbarDraft);
					toggle.onChange(async (value) => {
						this.plugin.settings.showToolbarDraft = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					});
				});
		});

		toolbarButtonsGroup.addSetting(setting => {
			setting
				.setName('Show tags button')
				// False positive: Already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Display the tags button in the CMS toolbar.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.showToolbarTags);
					toggle.onChange(async (value) => {
						this.plugin.settings.showToolbarTags = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					});
				});
		});

		toolbarButtonsGroup.addSetting(setting => {
			setting
				.setName('Show set button')
				// False positive: Already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Display the set property button in the CMS toolbar.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.showToolbarSet);
					toggle.onChange(async (value) => {
						this.plugin.settings.showToolbarSet = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					});
				});
		});

		toolbarButtonsGroup.addSetting(setting => {
			setting
				.setName('Show remove button')
				// False positive: Already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Display the remove property button in the CMS toolbar.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.showToolbarRemove);
					toggle.onChange(async (value) => {
						this.plugin.settings.showToolbarRemove = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					});
				});
		});

		toolbarButtonsGroup.addSetting(setting => {
			setting
				.setName('Show delete button')
				// False positive: Already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Display the delete button in the CMS toolbar.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.showToolbarDelete);
					toggle.onChange(async (value) => {
						this.plugin.settings.showToolbarDelete = value;
						await this.plugin.saveData(this.plugin.settings);
						this.refreshActiveToolbars();
					});
				});
		});

		// Deletion settings
		const deletionsGroup = createSettingsGroup(containerEl, 'Deletions');

		deletionsGroup.addSetting(setting => {
			setting
				.setName('Delete parent folder for specific file name')
				.setDesc('When enabled, deleting a note will delete its parent folder and all its contents if the note file name matches the specified name.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.deleteParentFolder);
					toggle.onChange(async (value) => {
						this.plugin.settings.deleteParentFolder = value;
						await this.plugin.saveData(this.plugin.settings);
					});
				});
		});

		deletionsGroup.addSetting(setting => {
			setting
				.setName('Folder deletion file name')
				.setDesc('File name that triggers parent folder deletion.')
				.addText(text => {
					// False positive: Placeholder text, not UI text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					text.setPlaceholder('index');
					text.setValue(this.plugin.settings.deleteParentFolderFilename);
					text.onChange(async (value) => {
						this.plugin.settings.deleteParentFolderFilename = value;
						await this.plugin.saveData(this.plugin.settings);
					});
				})
				.setDisabled(!this.plugin.settings.deleteParentFolder);
		});

		deletionsGroup.addSetting(setting => {
			setting
				.setName('Delete associated unique attachments')
				.setDesc('When deleting a note, automatically delete attachments that are only used by that note. Attachments used by other notes will be preserved.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.deleteUniqueAttachments);
					toggle.onChange(async (value) => {
						this.plugin.settings.deleteUniqueAttachments = value;
						await this.plugin.saveData(this.plugin.settings);
					});
				});
		});

		deletionsGroup.addSetting(setting => {
			setting
				.setName('Confirm deletions')
				.setDesc('Show confirmation dialog before deleting files.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.confirmDeletions);
					toggle.onChange(async (value) => {
						this.plugin.settings.confirmDeletions = value;
						await this.plugin.saveData(this.plugin.settings);
					});
				});
		});

		// Icon settings
		const appearanceGroup = createSettingsGroup(containerEl, 'Appearance');

		appearanceGroup.addSetting(setting => {
			setting
				// False positive: Already in sentence case; "CMS" is a proper noun
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setName('Use home icon for CMS view')
				// False positive: Already in sentence case; "CMS" and "Obsidian" are proper nouns
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('Use the home icon instead of blocks icon for the CMS view in the Bases view selector. Restart Obsidian for this change to take effect.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.useHomeIcon);
					toggle.onChange(async (value) => {
						this.plugin.settings.useHomeIcon = value;
						await this.plugin.saveData(this.plugin.settings);
					});
				});
		});

		appearanceGroup.addSetting(setting => {
			setting
				// False positive: Already in sentence case; "GIFs" is a proper noun/acronym
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setName('Force static image for animated GIFs')
				// False positive: Already in sentence case; "GIFs" is a proper noun/acronym
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setDesc('When enabled, animated GIFs will display only the first frame when used as card covers or thumbnails.')
				.addToggle(toggle => {
					toggle.setValue(this.plugin.settings.forceStaticGifImages);
					toggle.onChange(async (value) => {
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
					});
				});
		});

		// Properties info modal setting
		// Quick edit settings
		const quickEditGroup = createSettingsGroup(containerEl, 'Quick edit');

		// Define quick edit settings first (needed for visibility toggling)
		let quickEditCommandSetting: Setting;
		let quickEditIconSetting: Setting;
		let quickEditOpenFileSetting: Setting;

		quickEditGroup.addSetting(setting => {
			setting
				.setName('Enable quick edit')
				.setDesc('Show an icon on card titles that launches a command when clicked.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableQuickEdit)
					.onChange((value) => {
						void (async () => {
							this.plugin.settings.enableQuickEdit = value;
							await this.plugin.saveData(this.plugin.settings);
							// Show/hide command selector and related settings based on toggle
							const shouldHide = !value;
							// Extract settingEl properties to avoid promise misuse errors
							const commandEl = quickEditCommandSetting?.settingEl;
							const iconEl = quickEditIconSetting?.settingEl;
							const openFileEl = quickEditOpenFileSetting?.settingEl;
							if (commandEl) {
								commandEl.toggleClass('bases-cms-setting-hidden', shouldHide);
							}
							if (iconEl) {
								iconEl.toggleClass('bases-cms-setting-hidden', shouldHide);
							}
							if (openFileEl) {
								openFileEl.toggleClass('bases-cms-setting-hidden', shouldHide);
							}
						})();
					}));
		});

		// Command picker setting
		quickEditGroup.addSetting(setting => {
			quickEditCommandSetting = setting;
			setting
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
			setting.settingEl.toggleClass('bases-cms-setting-hidden', !this.plugin.settings.enableQuickEdit);
		});

		// Icon picker setting
		quickEditGroup.addSetting(setting => {
			quickEditIconSetting = setting;
			setting
				.setName('Quick edit icon')
				.setDesc('Select the icon to display for the quick edit button on card titles.')
				.addButton(button => {
					const iconName = this.getIconName(this.plugin.settings.quickEditIcon || 'pencil-line');
					button.setButtonText(iconName || 'Select icon...')
						.onClick(() => {
							const modal = new IconPickerModal(this.app, (iconId) => {
								void (async () => {
									this.plugin.settings.quickEditIcon = iconId;
									await this.plugin.saveData(this.plugin.settings);
									// Re-render to show updated icon name
									this.display();
								})();
							});
							modal.open();
						});
				});
			// Hide icon selector if quick edit is disabled
			setting.settingEl.toggleClass('bases-cms-setting-hidden', !this.plugin.settings.enableQuickEdit);
		});

		// Quick edit open file setting
		quickEditGroup.addSetting(setting => {
			quickEditOpenFileSetting = setting;
			setting
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
			setting.settingEl.toggleClass('bases-cms-setting-hidden', !this.plugin.settings.enableQuickEdit);
		});

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


