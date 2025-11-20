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
	
	// Quick edit settings
	enableQuickEdit: boolean;
	quickEditCommand: string;
	quickEditCommandName: string; // Store command name for display
	
	// Toolbar button visibility settings
	showToolbarSelectAll: boolean;
	showToolbarClear: boolean;
	showToolbarDraft: boolean;
	showToolbarPublish: boolean;
	showToolbarTags: boolean;
	showToolbarSet: boolean;
	showToolbarRemove: boolean;
	showToolbarDelete: boolean;
}

export const DEFAULT_SETTINGS: BasesCMSSettings = {
	confirmBulkOperations: true,
	deleteParentFolder: false,
	deleteParentFolderFilename: 'index',
	deleteUniqueAttachments: false,
	confirmDeletions: true,
	useHomeIcon: false,
	enableQuickEdit: false,
	quickEditCommand: '',
	quickEditCommandName: '',
	showToolbarSelectAll: true,
	showToolbarClear: true,
	showToolbarDraft: true,
	showToolbarPublish: true,
	showToolbarTags: true,
	showToolbarSet: true,
	showToolbarRemove: true,
	showToolbarDelete: true,
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

