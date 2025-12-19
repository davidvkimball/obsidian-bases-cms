/**
 * Bulk Operation Confirmation Modal
 * Shows confirmation dialog before performing bulk operations
 */

import { Modal, App, Setting } from 'obsidian';

export class BulkOperationConfirmModal extends Modal {
	private files: string[];
	private operation: 'draft' | 'publish';
	private onConfirm: () => void;

	constructor(
		app: App,
		files: string[],
		operation: 'draft' | 'publish',
		onConfirm: () => void
	) {
		super(app);
		this.files = files;
		this.operation = operation;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.empty();

		const operationName = this.operation === 'draft' ? 'mark as draft' : 'mark as published';
		const headingText = operationName.charAt(0).toUpperCase() + operationName.slice(1);
		new Setting(contentEl).setName(`Confirm ${headingText}`).setHeading();

		contentEl.createEl('p', {
			text: `Are you sure you want to ${operationName} ${this.files.length} file${this.files.length !== 1 ? 's' : ''}?`
		});

		// Show file list (limited to 20)
		if (this.files.length > 0) {
			const filesList = contentEl.createEl('ul', { cls: 'bases-cms-deletion-list' });
			for (const filePath of this.files.slice(0, 20)) {
				const li = filesList.createEl('li');
				li.setText(filePath);
			}
			if (this.files.length > 20) {
				filesList.createEl('li', {
					text: `... and ${this.files.length - 20} more file${this.files.length - 20 !== 1 ? 's' : ''}`
				});
			}
		}

		// Buttons
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass('bases-cms-modal-button-container');

		const cancelBtn = buttonContainer.createEl('button');
		cancelBtn.setText('Cancel');
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = buttonContainer.createEl('button');
		confirmBtn.setText('Confirm');
		confirmBtn.addClass('mod-cta');
		confirmBtn.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}


