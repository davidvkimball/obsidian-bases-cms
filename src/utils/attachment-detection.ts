/**
 * Attachment detection utilities
 * Detects unique attachments that are only used by specific files/folders
 */

import { App, TFile, TFolder } from 'obsidian';

/**
 * Find all attachments in a note
 */
export function getAttachmentsInNote(app: App, file: TFile): TFile[] {
	const attachments: TFile[] = [];
	const content = app.vault.getAbstractFileByPath(file.path);
	
	if (content instanceof TFile) {
		const metadata = app.metadataCache.getFileCache(content);
		const embeds = metadata?.embeds || [];
		
		for (const embed of embeds) {
			const embedFile = app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
			if (embedFile instanceof TFile) {
				attachments.push(embedFile);
			}
		}
	}
	
	return attachments;
}

/**
 * Find all attachments in a folder
 */
export function getAttachmentsInFolder(app: App, folder: TFolder): TFile[] {
	const attachments: TFile[] = [];
	
	for (const child of folder.children) {
		if (child instanceof TFile && child.extension === 'md') {
			attachments.push(...getAttachmentsInNote(app, child));
		} else if (child instanceof TFolder) {
			attachments.push(...getAttachmentsInFolder(app, child));
		}
	}
	
	return attachments;
}

/**
 * Check if an attachment is used in other notes
 */
export async function isAttachmentUsedInOtherNotes(
	app: App,
	attachment: TFile,
	excludedNote: TFile,
	excludedFolder?: TFolder
): Promise<boolean> {
	const allNotes = app.vault.getMarkdownFiles().filter(
		file => file.path !== excludedNote.path
	);
	
	const attachmentPath = attachment.path;
	const attachmentName = attachment.name;
	const attachmentBasename = attachment.basename;
	
	for (const note of allNotes) {
		// Skip notes in excluded folder
		if (excludedFolder && note.path.startsWith(excludedFolder.path + '/')) {
			continue;
		}
		
		const content = await app.vault.read(note);
		
		// Check for various reference patterns
		if (
			content.includes(attachmentPath) ||
			content.includes(attachmentName) ||
			content.includes(attachmentBasename) ||
			content.includes(`![[${attachmentName}]]`) ||
			content.includes(`[[${attachmentName}]]`) ||
			content.includes(`(${attachmentName})`) ||
			content.includes(`(${attachmentPath})`)
		) {
			return true; // Attachment is used elsewhere
		}
	}
	
	return false; // Attachment is unique to deleted note/folder
}

/**
 * Find unique attachments for a note/folder
 */
export async function findUniqueAttachments(
	app: App,
	deletedNote: TFile,
	deletedFolder?: TFolder
): Promise<TFile[]> {
	// Get all attachments in deleted note/folder
	const attachments: TFile[] = [];
	
	attachments.push(...getAttachmentsInNote(app, deletedNote));
	
	if (deletedFolder) {
		attachments.push(...getAttachmentsInFolder(app, deletedFolder));
	}
	
	// Remove duplicates
	const uniqueAttachments = Array.from(new Set(attachments.map(a => a.path)))
		.map(path => app.vault.getAbstractFileByPath(path))
		.filter((file): file is TFile => file instanceof TFile);
	
	// Check each attachment against all other notes
	const result: TFile[] = [];
	
	for (const attachment of uniqueAttachments) {
		const isUsedElsewhere = await isAttachmentUsedInOtherNotes(
			app,
			attachment,
			deletedNote,
			deletedFolder
		);
		
		if (!isUsedElsewhere) {
			result.push(attachment);
		}
	}
	
	return result;
}

