/**
 * Toolbar Actions
 * Handles all bulk operation actions from the toolbar
 */

import { App } from 'obsidian';
import type BasesCMSPlugin from '../main';
import { BulkOperations } from './bulk-operations';
import { ManageTagsModal } from '../components/manage-tags-modal';
import { SetPropertyModal } from '../components/set-property-modal';
import { RemovePropertyModal } from '../components/remove-property-modal';
import { DeletionPreviewModal } from '../components/deletion-preview';
import { BulkOperationConfirmModal } from '../components/bulk-operation-confirm';
import { prepareDeletionPreview, executeSmartDeletion } from './smart-deletion';
import type { CMSSettings } from '../shared/data-transform';

export class ToolbarActions {
	private bulkOps: BulkOperations;

	constructor(
		private app: App,
		private plugin: BasesCMSPlugin,
		private getSelectedFiles: () => string[],
		private clearSelection: () => void,
		private refreshView: () => void,
		private showToolbar: () => void
	) {
		this.bulkOps = new BulkOperations(app);
	}

	async handleSetDraft(settings?: CMSSettings): Promise<void> {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		if (this.plugin.settings.confirmBulkOperations) {
			const modal = new BulkOperationConfirmModal(
				this.app,
				files,
				'draft',
				() => {
					void (async () => {
						await this.bulkOps.setDraft(files, true, settings);
						this.refreshView();
					})();
				}
			);
			modal.open();
		} else {
			await this.bulkOps.setDraft(files, true, settings);
			this.refreshView();
		}
	}

	async handlePublish(settings?: CMSSettings): Promise<void> {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		if (this.plugin.settings.confirmBulkOperations) {
			const modal = new BulkOperationConfirmModal(
				this.app,
				files,
				'publish',
				() => {
					void (async () => {
						await this.bulkOps.setDraft(files, false, settings);
						this.refreshView();
					})();
				}
			);
			modal.open();
		} else {
			await this.bulkOps.setDraft(files, false, settings);
			this.refreshView();
		}
	}

	handleManageTags(): void {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		const modal = new ManageTagsModal(this.app, files);
		modal.onClose = () => {
			// Keep toolbar visible - don't let it close
			this.showToolbar();
			// Refresh view - the refreshView callback will preserve selection
			this.refreshView();
		};
		modal.open();
	}

	handleSetProperty(): void {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		const modal = new SetPropertyModal(this.app, files);
		modal.onClose = () => {
			// Keep toolbar visible - don't let it close
			this.showToolbar();
			// Refresh view - the refreshView callback will preserve selection
			this.refreshView();
		};
		modal.open();
	}

	handleRemoveProperty(): void {
		const files = this.getSelectedFiles();
		if (files.length === 0) return;

		const modal = new RemovePropertyModal(this.app, files);
		modal.onClose = () => {
			// Keep toolbar visible - don't let it close
			this.showToolbar();
			// Refresh view - the refreshView callback will preserve selection
			this.refreshView();
		};
		modal.open();
	}

	async handleDelete(): Promise<void> {
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
}

