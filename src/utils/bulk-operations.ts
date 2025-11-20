/**
 * Bulk operation handlers
 */

import { App, TFile, Notice } from 'obsidian';
import { addProperties, removeProperties } from './frontmatter';
import { NewPropData } from './frontmatter';
import type { CMSSettings } from '../shared/data-transform';

export class BulkOperations {
	constructor(private app: App) {}

	/**
	 * Set draft status for multiple files
	 * Respects filename prefix mode and reverse logic settings
	 */
	async setDraft(files: string[], draft: boolean, settings?: CMSSettings): Promise<void> {
		await this.batchProcessFiles(files, async (file) => {
			// If settings provided, use the same logic as handlePropertyToggle
			if (settings) {
				// Check if using filename prefix mode
				if (settings.draftStatusUseFilenamePrefix) {
					// Always use filename-based detection when this setting is enabled
					const fileName = file.basename; // basename excludes extension
					const startsWithUnderscore = fileName.startsWith('_');
					const currentPath = file.path;
					const pathParts = currentPath.split('/');
					
					// Apply reverse logic if enabled
					let targetValue = draft;
					if (settings.draftStatusReverse) {
						targetValue = !draft;
					}
					
					// Toggle based on desired state: if targetValue is true (draft), ensure underscore; if false (published), remove it
					if (targetValue === true) {
						// Setting to draft - add underscore if not present
						if (!startsWithUnderscore) {
							const newName = `_${fileName}${file.extension ? `.${file.extension}` : ''}`;
							pathParts[pathParts.length - 1] = newName;
							const newPath = pathParts.join('/');
							await this.app.fileManager.renameFile(file, newPath);
						}
					} else {
						// Setting to published - remove underscore if present
						if (startsWithUnderscore) {
							const newName = fileName.substring(1) + (file.extension ? `.${file.extension}` : '');
							pathParts[pathParts.length - 1] = newName;
							const newPath = pathParts.join('/');
							await this.app.fileManager.renameFile(file, newPath);
						}
					}
				} else {
					// Use property-based detection (frontmatter)
					const cleanConfigProperty = settings.draftStatusProperty && settings.draftStatusProperty.trim()
						? (settings.draftStatusProperty.startsWith('note.') 
							? settings.draftStatusProperty.substring(5) 
							: settings.draftStatusProperty)
						: 'draft';
					
					// Apply reverse logic if enabled
					let targetValue = draft;
					if (settings.draftStatusReverse) {
						targetValue = !draft;
					}
					
					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[cleanConfigProperty] = targetValue;
					});
				}
			} else {
				// Fallback: use default behavior (set draft property)
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					frontmatter.draft = draft;
				});
			}
		});

		new Notice(`Set ${files.length} file${files.length !== 1 ? 's' : ''} to ${draft ? 'draft' : 'published'}`);
	}

	/**
	 * Add tags to multiple files
	 */
	async addTags(files: string[], tags: string[]): Promise<void> {
		const props = new Map<string, NewPropData>();
		props.set('tags', {
			type: 'tags',
			data: tags,
			overwrite: false,
			delimiter: ',',
		});

		await this.batchProcessFiles(files, async (file) => {
			await addProperties(this.app, file, props, false);
		});

		new Notice(`Added tags to ${files.length} file${files.length !== 1 ? 's' : ''}`);
	}

	/**
	 * Remove tags from multiple files
	 */
	async removeTags(files: string[], tagsToRemove: string[]): Promise<void> {
		await this.batchProcessFiles(files, async (file) => {
			const metadata = this.app.metadataCache.getFileCache(file);
			const frontmatter = metadata?.frontmatter;
			
			if (frontmatter?.tags) {
				const currentTags = Array.isArray(frontmatter.tags) 
					? frontmatter.tags 
					: [frontmatter.tags];
				
				const updatedTags = currentTags.filter((tag: string) => 
					!tagsToRemove.includes(tag)
				);

				await this.app.fileManager.processFrontMatter(file, (fm) => {
					if (updatedTags.length > 0) {
						fm.tags = updatedTags;
					} else {
						fm.tags = undefined;
					}
				});
			}
		});

		new Notice(`Removed tags from ${files.length} file${files.length !== 1 ? 's' : ''}`);
	}

	/**
	 * Set a property value for multiple files
	 */
	async setProperty(files: string[], property: string, value: unknown, propertyType: string = 'text'): Promise<void> {
		// Strip "note." prefix if present (Bases uses "note.property" but frontmatter uses just "property")
		const cleanProperty = property.startsWith('note.') ? property.substring(5) : property;
		
		const props = new Map<string, NewPropData>();
		props.set(cleanProperty, {
			type: propertyType,
			data: value as string | string[] | null,
			overwrite: true,
			delimiter: ',',
		});

		await this.batchProcessFiles(files, async (file) => {
			await addProperties(this.app, file, props, true);
		});

		new Notice(`Set ${cleanProperty} on ${files.length} file${files.length !== 1 ? 's' : ''}`);
	}

	/**
	 * Remove a property from multiple files
	 */
	async removeProperty(files: string[], property: string): Promise<void> {
		// Strip "note." prefix if present
		const cleanProperty = property.startsWith('note.') ? property.substring(5) : property;
		
		await this.batchProcessFiles(files, async (file) => {
			await removeProperties(this.app, file, [cleanProperty]);
		});

		new Notice(`Removed ${cleanProperty} from ${files.length} file${files.length !== 1 ? 's' : ''}`);
	}

	/**
	 * Batch process files with progress indication
	 */
	private async batchProcessFiles(
		files: string[],
		processor: (file: TFile) => Promise<void>
	): Promise<void> {
		let processed = 0;
		const total = files.length;

		for (const filePath of files) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				try {
					await processor(file);
					processed++;
				} catch (error) {
					console.error(`Error processing ${filePath}:`, error);
				}
			}
		}

		if (processed < total) {
			new Notice(`Processed ${processed} of ${total} files`);
		}
	}
}

