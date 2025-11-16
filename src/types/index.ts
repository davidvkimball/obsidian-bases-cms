/**
 * TypeScript types for Bases CMS plugin
 */

export interface BasesCMSSettings {
	// Card layout settings
	cardLayout: 'top-cover' | 'square';
	
	// Bulk operation settings
	confirmBulkOperations: boolean;
	
	// Deletion settings
	deleteParentFolder: boolean;
	deleteParentFolderFilename: string;
	deleteUniqueAttachments: boolean;
	
	// Confirmation dialog settings
	confirmDeletions: boolean;
}

export const DEFAULT_SETTINGS: BasesCMSSettings = {
	cardLayout: 'top-cover',
	confirmBulkOperations: true,
	deleteParentFolder: false,
	deleteParentFolderFilename: 'index',
	deleteUniqueAttachments: false,
	confirmDeletions: true,
};

/**
 * Card data structure for rendering
 */
export interface CardData {
	path: string;
	name: string;
	title: string;
	tags: string[];
	yamlTags: string[];
	ctime: number;
	mtime: number;
	folderPath: string;
	snippet?: string;
	imageUrl?: string | string[];
	hasImageAvailable: boolean;
	properties: Record<string, unknown>;
}

/**
 * Bulk operation types
 */
export type BulkOperation = 
	| 'set-draft'
	| 'publish'
	| 'manage-tags'
	| 'set-property'
	| 'remove-property'
	| 'delete';

