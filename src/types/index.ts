/**
 * TypeScript types for Bases CMS plugin
 */

export interface BasesCMSSettings {
	// Bulk operation settings
	confirmBulkOperations: boolean;
	
	// Deletion settings
	deleteParentFolder: boolean;
	deleteParentFolderFilename: string;
	deleteUniqueAttachments: boolean;
	
	// Confirmation dialog settings
	confirmDeletions: boolean;
	
	// Icon settings
	useHomeIcon: boolean;
	
	// Image performance settings
	thumbnailCacheSize: 'minimal' | 'small' | 'balanced' | 'large' | 'unlimited';
}

export const DEFAULT_SETTINGS: BasesCMSSettings = {
	confirmBulkOperations: true,
	deleteParentFolder: false,
	deleteParentFolderFilename: 'index',
	deleteUniqueAttachments: false,
	confirmDeletions: true,
	useHomeIcon: false,
	thumbnailCacheSize: 'balanced',
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

