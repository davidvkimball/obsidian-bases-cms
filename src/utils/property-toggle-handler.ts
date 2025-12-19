/**
 * Property Toggle Handler
 * Handles toggling properties on files (including draft status)
 */

import { App, TFile } from 'obsidian';
import { readCMSSettings } from '../shared/settings-schema';
import type { BasesCMSSettings } from '../types';

interface BasesConfig {
	get(key: string): unknown;
}

export class PropertyToggleHandler {
	constructor(
		private app: App,
		private config: BasesConfig,
		private pluginSettings: BasesCMSSettings,
		private onRefresh: () => void
	) {}

	async handlePropertyToggle(path: string, property: string, value: unknown): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) return;

			// Strip "note." prefix if present (Bases uses "note.property" but frontmatter uses just "property")
			const cleanProperty = property.startsWith('note.') ? property.substring(5) : property;

			// Read settings to check if this is the draft property
			const settings = readCMSSettings(
				this.config,
				this.pluginSettings
			);

			// Check if this is the draft status property
			const isDraftProperty = settings.showDraftStatus && cleanProperty === 'draft';
			let shouldRefresh = false;

			if (isDraftProperty) {
				// Check if using filename prefix mode
				if (settings.draftStatusUseFilenamePrefix) {
					// Always use filename-based detection when this setting is enabled
					const fileName = file.basename; // basename excludes extension
					const startsWithUnderscore = fileName.startsWith('_');
					const currentPath = file.path;
					const pathParts = currentPath.split('/');
					
					// Toggle based on desired state: if value is true (draft), ensure underscore; if false (published), remove it
					if (value === true) {
						// Toggling to draft - add underscore if not present
						if (!startsWithUnderscore) {
							const newName = `_${fileName}${file.extension ? `.${file.extension}` : ''}`;
							pathParts[pathParts.length - 1] = newName;
							const newPath = pathParts.join('/');
							await this.app.fileManager.renameFile(file, newPath);
							shouldRefresh = true;
						}
					} else {
						// Toggling to published - remove underscore if present
						if (startsWithUnderscore) {
							const newName = fileName.substring(1) + (file.extension ? `.${file.extension}` : '');
							pathParts[pathParts.length - 1] = newName;
							const newPath = pathParts.join('/');
							await this.app.fileManager.renameFile(file, newPath);
							shouldRefresh = true;
						}
					}
				} else {
					// Use property-based detection (frontmatter)
					const cleanConfigProperty = settings.draftStatusProperty && settings.draftStatusProperty.trim()
						? (settings.draftStatusProperty.startsWith('note.') 
							? settings.draftStatusProperty.substring(5) 
							: settings.draftStatusProperty)
						: 'draft';
					
					await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
						const fm = frontmatter as Record<string, unknown>;
						fm[cleanConfigProperty] = value;
					});
					shouldRefresh = true;
				}
			} else {
				// Normal property toggle - update frontmatter
				await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					const fm = frontmatter as Record<string, unknown>;
					fm[cleanProperty] = value;
				});
				shouldRefresh = true;
			}

			// Only refresh if we actually made a change
			if (shouldRefresh) {
				// Wait for metadata cache to update, then refresh view
				requestAnimationFrame(() => {
					window.setTimeout(() => {
						try {
							this.onRefresh();
						} catch (error) {
							console.error('Error refreshing view after property toggle:', error);
						}
					}, 100);
				});
			}
		} catch (error) {
			console.error('Error toggling property:', error);
		}
	}
}


