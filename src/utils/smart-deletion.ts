/**
 * Smart deletion utilities
 * Handles folder-based content deletion and unique attachment detection
 */

import { App, TFile, TFolder, Notice } from 'obsidian';
import { BasesCMSSettings } from '../types';
import { findUniqueAttachments } from './attachment-detection';

export interface DeletionPreview {
	filesToDelete: TFile[];
	foldersToDelete: TFolder[];
	attachmentsToDelete: TFile[];
}

/**
 * Check if a file is folder-based content
 */
export function isFolderBasedContent(file: TFile, config: BasesCMSSettings): boolean {
	const configuredFilename = config.deleteParentFolderFilename || 'index';
	return file.basename === configuredFilename && file.parent !== null;
}

/**
 * Check if should delete parent folder
 */
export function shouldDeleteParentFolder(file: TFile, config: BasesCMSSettings): boolean {
	return config.deleteParentFolder && isFolderBasedContent(file, config);
}

/**
 * Prepare deletion preview
 */
export async function prepareDeletionPreview(
	app: App,
	files: string[],
	config: BasesCMSSettings
): Promise<DeletionPreview> {
	const filesToDelete: TFile[] = [];
	const foldersToDelete: TFolder[] = [];
	const attachmentsToDelete: TFile[] = [];
	
	for (const filePath of files) {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) continue;
		
		// Check if should delete parent folder
		if (shouldDeleteParentFolder(file, config)) {
			const parentFolder = file.parent;
			if (parentFolder && !foldersToDelete.includes(parentFolder)) {
				foldersToDelete.push(parentFolder);
				
				// Get all files in folder for deletion
				const folderFiles = parentFolder.children.filter(
					child => child instanceof TFile
				) as TFile[];
				filesToDelete.push(...folderFiles);
			}
		} else {
			filesToDelete.push(file);
		}
		
		// Find unique attachments if setting enabled
		if (config.deleteUniqueAttachments) {
			const parentFolder = shouldDeleteParentFolder(file, config) 
				? (file.parent || undefined)
				: undefined;
			const uniqueAttachments = await findUniqueAttachments(
				app,
				file,
				parentFolder
			);
			attachmentsToDelete.push(...uniqueAttachments);
		}
	}
	
	// Remove duplicates
	const uniqueFiles = Array.from(new Set(filesToDelete.map(f => f.path)))
		.map(path => app.vault.getAbstractFileByPath(path))
		.filter((file): file is TFile => file instanceof TFile);
	
	const uniqueAttachments = Array.from(new Set(attachmentsToDelete.map(a => a.path)))
		.map(path => app.vault.getAbstractFileByPath(path))
		.filter((file): file is TFile => file instanceof TFile);
	
	return {
		filesToDelete: uniqueFiles,
		foldersToDelete: Array.from(new Set(foldersToDelete)),
		attachmentsToDelete: uniqueAttachments,
	};
}

/**
 * Execute smart deletion
 */
export async function executeSmartDeletion(
	app: App,
	preview: DeletionPreview
): Promise<void> {
	let deletedCount = 0;
	let errorCount = 0;
	
	// Delete files
	for (const file of preview.filesToDelete) {
		try {
			await app.vault.delete(file);
			deletedCount++;
		} catch (error) {
			console.error(`Error deleting file ${file.path}:`, error);
			errorCount++;
		}
	}
	
	// Delete attachments
	for (const attachment of preview.attachmentsToDelete) {
		try {
			await app.vault.delete(attachment);
			deletedCount++;
		} catch (error) {
			console.error(`Error deleting attachment ${attachment.path}:`, error);
			errorCount++;
		}
	}
	
	// Delete folders (recursive)
	for (const folder of preview.foldersToDelete) {
		try {
			await app.vault.delete(folder, true);
			deletedCount++;
		} catch (error) {
			console.error(`Error deleting folder ${folder.path}:`, error);
			errorCount++;
		}
	}
	
	if (errorCount > 0) {
		new Notice(`Deleted ${deletedCount} items, ${errorCount} errors occurred`);
	} else {
		new Notice(`Successfully deleted ${deletedCount} item${deletedCount !== 1 ? 's' : ''}`);
	}
}

