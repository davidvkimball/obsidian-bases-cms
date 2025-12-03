/**
 * Modal explaining how properties work in CMS views
 */

import { App, Modal, Setting } from 'obsidian';
import { readCMSSettings } from '../shared/settings-schema';
import type { BasesCMSSettings } from '../types';

// Bases config object interface
interface BasesConfig {
	get(key: string): unknown;
}

/**
 * Modal that explains how properties work in CMS views
 */
export class PropertiesInfoModal extends Modal {
	private config: BasesConfig | undefined;
	private pluginSettings: BasesCMSSettings;
	private plugin: { settings: BasesCMSSettings; saveSettings: () => Promise<void> };
	private propertiesButton: HTMLElement;
	private dontShowAgain: boolean = false;

	constructor(
		app: App,
		config: BasesConfig | undefined,
		pluginSettings: BasesCMSSettings,
		plugin: { settings: BasesCMSSettings; saveSettings: () => Promise<void> },
		propertiesButton: HTMLElement
	) {
		super(app);
		this.config = config;
		this.pluginSettings = pluginSettings;
		this.plugin = plugin;
		this.propertiesButton = propertiesButton;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Title
		contentEl.createEl('h2', { text: 'Properties in CMS Views' });

		// Explanation
		const explanation = contentEl.createDiv('properties-info-explanation');
		explanation.createEl('p', {
			text: 'In CMS views, properties work differently than in standard Base views. Instead of toggling properties on/off with checkboxes, you configure which properties to display in the view settings.'
		});
		explanation.createEl('p', {
			text: 'That being said, you can view all available properties and formulas. However, checking or unchecking properties in the dropdown won\'t affect what\'s displayed on cards in CMS views.'
		});

		// Special properties section
		const specialSection = contentEl.createDiv('properties-info-special');
		specialSection.createEl('p', {
			text: 'Some properties have special hardcoded placements on cards, like title, image, draft status, and tags.'
		});

		// How to configure section
		const howToSection = contentEl.createDiv('properties-info-howto');
		howToSection.createEl('h3', { text: 'How to Configure Properties' });
		howToSection.createEl('p', {
			text: 'To configure which properties appear on cards:'
		});
		howToSection.createEl('p', {
			text: 'Click the name of the view you\'d like to edit, and select the right arrow/chevron icon to the configure view menu. Here\'s where you can adjust card size, image placement, and other properties to show.'
		});

		// Don't show again checkbox
		const dontShowSetting = new Setting(contentEl)
			.setName('Don\'t show this message again')
			.addToggle(toggle => {
				toggle
					.setValue(this.dontShowAgain)
					.onChange(value => {
						this.dontShowAgain = value;
					});
			});

		// I understand button that opens properties dropdown
		new Setting(contentEl)
			.addButton(button => {
				button
					.setButtonText('I understand')
					.setCta()
					.onClick(async () => {
						// Save the "don't show again" preference
						if (this.dontShowAgain) {
							this.plugin.settings.showPropertiesInfoModal = false;
							await this.plugin.saveSettings();
						}
						
						// Close the modal
						this.close();
						
						// Open the properties dropdown by triggering a click on the button
						// Use a small delay to ensure modal is fully closed
						setTimeout(() => {
							if (this.propertiesButton) {
								// Set flag to skip interception for this programmatic click
								// Access the skip flag through the button's data attribute or window
								(window as unknown as { __cmsSkipPropertiesInterception?: boolean }).__cmsSkipPropertiesInterception = true;
								
								// Trigger click on the button to open the dropdown
								this.propertiesButton.click();
								
								// Clear the flag after a short delay
								setTimeout(() => {
									delete (window as unknown as { __cmsSkipPropertiesInterception?: boolean }).__cmsSkipPropertiesInterception;
								}, 50);
							}
						}, 100);
					});
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

