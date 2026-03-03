/**
 * Remove Property Modal
 * Modal for removing properties from selected files
 */

import { Modal, App, Setting, TFile } from 'obsidian';
import { BulkOperations } from '../utils/bulk-operations';
import { getFileFrontmatter } from '../utils/frontmatter-helper';

export class RemovePropertyModal extends Modal {
	private files: string[];
	private propertiesToRemove: Set<string> = new Set();
	private bulkOps: BulkOperations;

	constructor(app: App, files: string[]) {
		super(app);
		this.files = files;
		this.bulkOps = new BulkOperations(app);
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.empty();
		new Setting(contentEl).setName('Remove property').setHeading();
		contentEl.createEl('p', { text: `Removing properties from ${this.files.length} file${this.files.length !== 1 ? 's' : ''}` });

		// Create checkboxes container first
		const propertiesContainer = contentEl.createDiv();
		
		// Get all unique properties from selected files
		const allProperties = new Set<string>();
		
		// Load properties synchronously for .md files first
		for (const filePath of this.files) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile && file.extension !== 'mdx') {
				const metadata = this.app.metadataCache.getFileCache(file);
				const frontmatter = metadata?.frontmatter;
				if (frontmatter) {
					for (const key in frontmatter) {
						if (key !== 'tags' && key !== 'title') {
							allProperties.add(key);
						}
					}
				}
			}
		}
		
		// Render checkboxes for .md file properties
		for (const prop of Array.from(allProperties).sort()) {
			this.addPropertyCheckbox(propertiesContainer, prop);
		}
		
		// Load MDX file properties asynchronously
		void (async () => {
			for (const filePath of this.files) {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile && file.extension === 'mdx') {
					const frontmatter = await getFileFrontmatter(this.app, file);
					if (frontmatter) {
						for (const key in frontmatter) {
							if (key !== 'tags' && key !== 'title') {
								if (!allProperties.has(key)) {
									allProperties.add(key);
									// Add checkbox for this property dynamically
									if (this.contentEl && this.contentEl.isConnected && propertiesContainer.isConnected) {
										this.addPropertyCheckbox(propertiesContainer, key);
									}
								}
							}
						}
					}
				}
			}
		})();

		if (allProperties.size === 0) {
			contentEl.createEl('p', { text: 'No properties found in selected files.' });
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
				if (this.propertiesToRemove.size > 0) {
					await this.applyChanges();
					this.close();
				}
			})();
		});
	}

	private addPropertyCheckbox(container: HTMLElement, prop: string): void {
		new Setting(container)
			.setName(prop)
			.addToggle(toggle => {
				toggle
					.setValue(this.propertiesToRemove.has(prop))
					.onChange(value => {
						if (value) {
							this.propertiesToRemove.add(prop);
						} else {
							this.propertiesToRemove.delete(prop);
						}
					});
			});
	}

	private async applyChanges(): Promise<void> {
		for (const prop of this.propertiesToRemove) {
			await this.bulkOps.removeProperty(this.files, prop);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}


