/**
 * Set Property Modal
 * Modal for setting a property value on selected files
 */

import { Modal, App, Setting } from 'obsidian';
import { BulkOperations } from '../utils/bulk-operations';

export class SetPropertyModal extends Modal {
	private files: string[];
	private propertyName: string = '';
	private propertyValue: string = '';
	private propertyType: string = 'text';
	private bulkOps: BulkOperations;

	constructor(app: App, files: string[]) {
		super(app);
		this.files = files;
		this.bulkOps = new BulkOperations(app);
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.empty();
		new Setting(contentEl).setName('Set property').setHeading();
		contentEl.createEl('p', { text: `Setting property on ${this.files.length} file${this.files.length !== 1 ? 's' : ''}` });

		// Property name
		new Setting(contentEl)
			.setName('Property name')
			.setDesc('Enter the property name to set')
			.addText(text => {
				text
					.setPlaceholder('e.g., status, category, priority')
					.onChange(value => {
						this.propertyName = value;
					});
			});

		// Property type
		new Setting(contentEl)
			.setName('Property type')
			.setDesc('Select the property type')
			.addDropdown(dropdown => {
				dropdown
					.addOption('text', 'Text')
					.addOption('number', 'Number')
					.addOption('checkbox', 'Checkbox')
					.addOption('date', 'Date')
					.setValue(this.propertyType)
					.onChange(value => {
						this.propertyType = value;
					});
			});

		// Property value
		new Setting(contentEl)
			.setName('Property value')
			.setDesc('Enter the property value')
			.addText(text => {
				text
					.setPlaceholder('Enter value')
					.onChange(value => {
						this.propertyValue = value;
					});
			});

		// Buttons
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass('bases-cms-modal-button-container');

		const cancelBtn = buttonContainer.createEl('button');
		cancelBtn.setText('Cancel');
		cancelBtn.addEventListener('click', () => this.close());

		const applyBtn = buttonContainer.createEl('button');
		applyBtn.setText('Apply');
		applyBtn.addClass('mod-cta');
		applyBtn.addEventListener('click', async () => {
			if (this.propertyName && this.propertyValue) {
				await this.applyChanges();
				this.close();
			}
		});
	}

	private async applyChanges(): Promise<void> {
		let value: unknown = this.propertyValue;

		// Convert value based on type
		if (this.propertyType === 'number') {
			value = Number(this.propertyValue);
		} else if (this.propertyType === 'checkbox') {
			value = this.propertyValue.toLowerCase() === 'true' || this.propertyValue === '1';
		} else if (this.propertyType === 'date') {
			value = this.propertyValue; // Keep as string for date
		}

		await this.bulkOps.setProperty(this.files, this.propertyName, value, this.propertyType);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

