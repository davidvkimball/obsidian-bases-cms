/**
 * Deletion Preview Modal
 * Shows preview of what will be deleted before confirmation
 */

import { Modal, App, Setting } from 'obsidian';
import { DeletionPreview } from '../utils/smart-deletion';
import { executeSmartDeletion } from '../utils/smart-deletion';

export class DeletionPreviewModal extends Modal {
	private preview: DeletionPreview;
	private onConfirm: () => void;

	constructor(app: App, preview: DeletionPreview, onConfirm: () => void) {
		super(app);
		this.preview = preview;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.empty();
		new Setting(contentEl).setName('Confirm deletion').setHeading();
		contentEl.createEl('p', { 
			text: 'The following items will be deleted:',
			cls: 'bases-cms-deletion-warning'
		});

		// Files to delete
		if (this.preview.filesToDelete.length > 0) {
			contentEl.createEl('h3', { text: `Files (${this.preview.filesToDelete.length})` });
			const filesList = contentEl.createEl('ul', { cls: 'bases-cms-deletion-list' });
			for (const file of this.preview.filesToDelete.slice(0, 20)) {
				const li = filesList.createEl('li');
				li.setText(file.path);
			}
			if (this.preview.filesToDelete.length > 20) {
				filesList.createEl('li', { 
					text: `... and ${this.preview.filesToDelete.length - 20} more files`
				});
			}
		}

		// Folders to delete
		if (this.preview.foldersToDelete.length > 0) {
			contentEl.createEl('h3', { text: `Folders (${this.preview.foldersToDelete.length})` });
			const foldersList = contentEl.createEl('ul', { cls: 'bases-cms-deletion-list' });
			for (const folder of this.preview.foldersToDelete) {
				const li = foldersList.createEl('li');
				li.setText(folder.path);
			}
		}

		// Attachments to delete
		if (this.preview.attachmentsToDelete.length > 0) {
			contentEl.createEl('h3', { text: `Attachments (${this.preview.attachmentsToDelete.length})` });
			const attachmentsList = contentEl.createEl('ul', { cls: 'bases-cms-deletion-list' });
			for (const attachment of this.preview.attachmentsToDelete.slice(0, 20)) {
				const li = attachmentsList.createEl('li');
				li.setText(attachment.path);
			}
			if (this.preview.attachmentsToDelete.length > 20) {
				attachmentsList.createEl('li', { 
					text: `... and ${this.preview.attachmentsToDelete.length - 20} more attachments`
				});
			}
		}

		// Warning
		contentEl.createEl('p', {
			text: 'This action cannot be undone.',
			cls: 'bases-cms-deletion-warning'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass('bases-cms-modal-button-container');

		const cancelBtn = buttonContainer.createEl('button');
		cancelBtn.setText('Cancel');
		cancelBtn.addEventListener('click', () => this.close());

		const deleteBtn = buttonContainer.createEl('button');
		deleteBtn.setText('Delete');
		deleteBtn.addClass('mod-cta');
		deleteBtn.addClass('destructive');
		deleteBtn.addEventListener('click', () => {
			void (async () => {
				await executeSmartDeletion(this.app, this.preview);
				this.onConfirm();
				this.close();
			})();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

