/**
 * Manage Tags Modal
 * Modal for adding/removing tags from selected files
 */

import { Modal, App, Setting, TFile } from 'obsidian';
import { BulkOperations } from '../utils/bulk-operations';

export class ManageTagsModal extends Modal {
	private files: string[];
	private tagsToAdd: string = '';
	private tagsToRemove: Set<string> = new Set();
	private bulkOps: BulkOperations;

	constructor(app: App, files: string[]) {
		super(app);
		this.files = files;
		this.bulkOps = new BulkOperations(app);
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.empty();
		new Setting(contentEl).setName('Manage tags').setHeading();
		contentEl.createEl('p', { text: `Managing tags for ${this.files.length} file${this.files.length !== 1 ? 's' : ''}` });

		// Add tags input
		new Setting(contentEl)
			.setName('Add tags')
			.setDesc('Enter tags to add (comma-separated).')
			.addText(text => {
				text
					.setPlaceholder('tag1, tag2, tag3')
					.onChange(value => {
						this.tagsToAdd = value;
					});
			});

		// Remove tags section
		contentEl.createEl('h3', { text: 'Remove tags' }); // Keep h3 for section heading
		const removeContainer = contentEl.createDiv();

		// Get all unique tags from selected files
		const allTags = new Set<string>();
		for (const filePath of this.files) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				const metadata = this.app.metadataCache.getFileCache(file);
				const frontmatter = metadata?.frontmatter;
				if (frontmatter?.tags) {
					const tags = Array.isArray(frontmatter.tags) 
						? frontmatter.tags 
						: [frontmatter.tags];
					tags.forEach(tag => allTags.add(tag));
				}
			}
		}

		// Create checkboxes for each tag
		for (const tag of Array.from(allTags).sort()) {
			new Setting(removeContainer)
				.setName(tag)
				.addToggle(toggle => {
					toggle
						.setValue(this.tagsToRemove.has(tag))
						.onChange(value => {
							if (value) {
								this.tagsToRemove.add(tag);
							} else {
								this.tagsToRemove.delete(tag);
							}
						});
				});
		}

		// Buttons
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass('bases-cms-modal-button-container');

		const cancelBtn = buttonContainer.createEl('button');
		cancelBtn.setText('Cancel');
		cancelBtn.addEventListener('click', () => this.close());

		const applyBtn = buttonContainer.createEl('button');
		applyBtn.setText('Apply');
		applyBtn.addClass('mod-cta');
		applyBtn.addEventListener('click', () => {
			void (async () => {
				await this.applyChanges();
				this.close();
			})();
		});
	}

	private async applyChanges(): Promise<void> {
		// Add tags
		if (this.tagsToAdd.trim()) {
			const tagsToAdd = this.tagsToAdd
				.split(',')
				.map(t => t.trim())
				.filter(t => t.length > 0);
			if (tagsToAdd.length > 0) {
				await this.bulkOps.addTags(this.files, tagsToAdd);
			}
		}

		// Remove tags
		if (this.tagsToRemove.size > 0) {
			await this.bulkOps.removeTags(this.files, Array.from(this.tagsToRemove));
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

