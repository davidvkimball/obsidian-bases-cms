/**
 * Bulk Operations Toolbar
 * Toolbar that appears when items are selected
 */

import { App } from 'obsidian';
import type BasesCMSPlugin from '../main';
import { BulkOperations } from '../utils/bulk-operations';
import { ManageTagsModal } from './manage-tags-modal';
import { SetPropertyModal } from './set-property-modal';
import { RemovePropertyModal } from './remove-property-modal';
import { DeletionPreviewModal } from './deletion-preview';
import { prepareDeletionPreview, executeSmartDeletion } from '../utils/smart-deletion';

export class BulkToolbar {
	private toolbarEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private bulkOps: BulkOperations;

	constructor(
		private app: App,
		private plugin: BasesCMSPlugin,
		private container: HTMLElement,
		private getSelectedFiles: () => string[],
		private clearSelection: () => void,
		private refreshView: () => void,
		private selectAll?: () => void,
		private deselectAll?: () => void
	) {
		this.bulkOps = new BulkOperations(app);
		this.createToolbar();
	}

	private createToolbar(): void {
		this.toolbarEl = this.container.createDiv('bases-cms-bulk-toolbar');
		this.toolbarEl.style.display = 'none';

		// Selected count
		this.countEl = this.toolbarEl.createDiv('selected-count');
		this.countEl.setText('0 items selected');

		// Select All / Deselect All buttons
		if (this.selectAll && this.deselectAll) {
			const selectContainer = this.toolbarEl.createDiv();
			selectContainer.style.display = 'flex';
			selectContainer.style.gap = '0.5rem';
			selectContainer.style.marginRight = 'auto';

			const selectAllBtn = selectContainer.createEl('button');
			selectAllBtn.setText('Select All');
			selectAllBtn.addEventListener('click', () => {
				if (this.selectAll) this.selectAll();
			});

			const deselectAllBtn = selectContainer.createEl('button');
			deselectAllBtn.setText('Deselect All');
			deselectAllBtn.addEventListener('click', () => {
				if (this.deselectAll) this.deselectAll();
			});
		}

		// Buttons
		const buttonContainer = this.toolbarEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '0.5rem';

		// Set to Draft
		const draftBtn = buttonContainer.createEl('button');
		draftBtn.setText('Set to Draft');
		draftBtn.addEventListener('click', () => this.handleSetDraft());

		// Publish
		const publishBtn = buttonContainer.createEl('button');
		publishBtn.setText('Publish');
		publishBtn.addEventListener('click', () => this.handlePublish());

		// Manage Tags
		const tagsBtn = buttonContainer.createEl('button');
		tagsBtn.setText('Manage Tags');
		tagsBtn.addEventListener('click', () => this.handleManageTags());

		// Set Property
		const setPropBtn = buttonContainer.createEl('button');
		setPropBtn.setText('Set Property');
		setPropBtn.addEventListener('click', () => this.handleSetProperty());

		// Remove Property
		const removePropBtn = buttonContainer.createEl('button');
		removePropBtn.setText('Remove Property');
		removePropBtn.addEventListener('click', () => this.handleRemoveProperty());

		// Delete
		const deleteBtn = buttonContainer.createEl('button');
		deleteBtn.setText('Delete');
		deleteBtn.addClass('destructive');
		deleteBtn.addEventListener('click', () => this.handleDelete());

		// Clear selection
		const clearBtn = buttonContainer.createEl('button');
		clearBtn.setText('Clear Selection');
		clearBtn.addEventListener('click', () => this.clearSelection());
	}

	updateCount(count: number): void {
		if (this.countEl) {
			this.countEl.setText(`${count} item${count !== 1 ? 's' : ''} selected`);
		}
	}

	show(): void {
		if (this.toolbarEl) {
			this.toolbarEl.style.display = 'flex';
		}
	}

	hide(): void {
		if (this.toolbarEl) {
			this.toolbarEl.style.display = 'none';
		}
	}

	private async handleSetDraft(): Promise<void> {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		if (this.plugin.settings.confirmBulkOperations) {
			// TODO: Show confirmation dialog
		}

		await this.bulkOps.setDraft(files, true);
		this.refreshView();
	}

	private async handlePublish(): Promise<void> {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		if (this.plugin.settings.confirmBulkOperations) {
			// TODO: Show confirmation dialog
		}

		await this.bulkOps.setDraft(files, false);
		this.refreshView();
	}

	private async handleManageTags(): Promise<void> {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		const modal = new ManageTagsModal(this.app, files);
		modal.onClose = () => {
			this.refreshView();
		};
		modal.open();
	}

	private async handleSetProperty(): Promise<void> {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		const modal = new SetPropertyModal(this.app, files);
		modal.onClose = () => {
			this.refreshView();
		};
		modal.open();
	}

	private async handleRemoveProperty(): Promise<void> {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		const modal = new RemovePropertyModal(this.app, files);
		modal.onClose = () => {
			this.refreshView();
		};
		modal.open();
	}

	private async handleDelete(): Promise<void> {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		if (this.plugin.settings.confirmDeletions) {
			const preview = await prepareDeletionPreview(
				this.app,
				files,
				this.plugin.settings
			);

			const modal = new DeletionPreviewModal(
				this.app,
				preview,
				() => {
					this.clearSelection();
					this.refreshView();
				}
			);
			modal.open();
		} else {
			// Direct deletion without confirmation
			const preview = await prepareDeletionPreview(
				this.app,
				files,
				this.plugin.settings
			);
			await executeSmartDeletion(this.app, preview);
			this.clearSelection();
			this.refreshView();
		}
	}

	destroy(): void {
		if (this.toolbarEl) {
			this.toolbarEl.remove();
			this.toolbarEl = null;
		}
	}
}

