/**
 * Attachment detection utilities
 * Detects unique attachments that are only used by specific files/folders
 */

import { App, TFile, TFolder } from 'obsidian';

/**
 * Find all attachments in a note
 * Includes both embedded images in markdown and images referenced in frontmatter properties
 */
export function getAttachmentsInNote(app: App, file: TFile): TFile[] {
	const attachments: TFile[] = [];
	const content = app.vault.getAbstractFileByPath(file.path);
	
	if (content instanceof TFile) {
		const metadata = app.metadataCache.getFileCache(content);
		
		// Get embedded images from markdown body
		const embeds = metadata?.embeds || [];
		for (const embed of embeds) {
			const embedFile = app.metadataCache.getFirstLinkpathDest(embed.link, file.path);
			if (embedFile instanceof TFile) {
				attachments.push(embedFile);
			}
		}
		
		// Get images from frontmatter properties
		// Check common image property names: image, imageOG, cover, thumbnail
		const frontmatter = metadata?.frontmatter;
		if (frontmatter) {
			const imagePropertyNames = ['image', 'imageOG', 'cover', 'thumbnail'];
			const validImageExtensions = ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];
			
			for (const propName of imagePropertyNames) {
				const propValue = (frontmatter as Record<string, unknown>)[propName];
				if (!propValue) continue;
				
				// Handle array of image paths
				const imagePaths = Array.isArray(propValue) ? propValue : [propValue];
				
				for (const imagePath of imagePaths) {
					if (typeof imagePath !== 'string') continue;
					
					// Strip wikilink syntax if present
					const cleanPath = imagePath.replace(/^!?\[\[([^\]]+)\]\]$/, '$1').trim();
					if (!cleanPath) continue;
					
					// Skip external URLs
					if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
						continue;
					}
					
					// Try to resolve the image file
					let imageFile: TFile | null = app.metadataCache.getFirstLinkpathDest(cleanPath, file.path);
					
					// If not found and path starts with ./, try resolving relative to file's directory
					if (!imageFile && cleanPath.startsWith('./')) {
						const relativePath = cleanPath.substring(2);
						const fullPath = file.parent?.path 
							? `${file.parent.path}/${relativePath}`
							: relativePath;
						const resolvedFile = app.vault.getAbstractFileByPath(fullPath);
						if (resolvedFile instanceof TFile) {
							imageFile = resolvedFile;
						}
					}
					
					// If still not found, try as absolute path
					if (!imageFile) {
						const absoluteFile = app.vault.getAbstractFileByPath(cleanPath);
						if (absoluteFile instanceof TFile) {
							imageFile = absoluteFile;
						}
					}
					
					// Only add if it's a valid image file
					if (imageFile && validImageExtensions.includes(imageFile.extension)) {
						attachments.push(imageFile);
					}
				}
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


