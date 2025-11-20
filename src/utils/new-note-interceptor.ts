import { App } from 'obsidian';
import { readCMSSettings } from '../shared/settings-schema';
import { CMS_VIEW_TYPE } from '../views/cms-view';
import type { BasesCMSSettings } from '../types';

// Bases config object interface
interface BasesConfig {
	get(key: string): unknown;
}

/**
 * Setup interceptor for new note button clicks
 * Handles custom new note location settings
 */
export function setupNewNoteInterceptor(
	app: App,
	containerEl: HTMLElement,
	config: BasesConfig,
	pluginSettings: BasesCMSSettings,
	registerCleanup: (cleanup: () => void) => void
): void {
	const handleNewButtonClick = async (e: MouseEvent) => {
		// Check if this is the new button - must be very specific to avoid interfering with other clicks
		const target = e.target as HTMLElement;
		const buttonEl = target.closest('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
		
		if (!buttonEl) {
			return; // Not the new button, let event continue normally
		}
		
		// Don't interfere with clicks inside the bulk toolbar or other CMS elements
		if (target.closest('.bases-cms-bulk-toolbar, .bases-cms-container .card')) {
			return; // Let these clicks work normally
		}
		
		console.log('[CMS View] New button clicked!', buttonEl);
		
		// Check if this view is active - find the workspace leaf containing our container
		const workspaceLeaf = app.workspace.getLeavesOfType(CMS_VIEW_TYPE).find(leaf => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const view = leaf.view as any;
			return view && view.containerEl === containerEl;
		});
		
		// Check if this leaf is the active one
		const activeLeaf = app.workspace.activeLeaf;
		const isActive = workspaceLeaf && activeLeaf && workspaceLeaf === activeLeaf;
		
		if (!isActive) {
			console.log('[CMS View] Not our active view, skipping. Active leaf:', activeLeaf, 'Our leaf:', workspaceLeaf);
			return; // Not our view, let event continue normally
		}
		
		const settings = readCMSSettings(config, pluginSettings);

		console.log('[CMS View] Settings:', {
			customizeNewButton: settings.customizeNewButton,
			newNoteLocation: settings.newNoteLocation
		});

		if (settings.customizeNewButton) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			
			const locationInput = settings.newNoteLocation?.trim() || '';
			
			// If location is empty, use Obsidian's default new note location
			if (locationInput === '') {
				console.log('[CMS View] Using Obsidian default new note location');
				// Use Obsidian's default new note creation behavior
				// Access Obsidian's vault config directly
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const vaultConfig = (app.vault as any).config;
				const newFileLocation = vaultConfig?.newFileLocation || 'folder';
				const newFileFolderPath = vaultConfig?.newFileFolderPath || '';
				
				console.log('[CMS View] Obsidian config:', { newFileLocation, newFileFolderPath });
				
				let filePath = 'Untitled.md';
				
				// Handle Obsidian's new file location settings
				if (newFileLocation === 'folder' && newFileFolderPath) {
					// Create in specified folder
					filePath = `${newFileFolderPath}/Untitled.md`;
				} else if (newFileLocation === 'current') {
					// Create in current file's folder
					const activeFile = app.workspace.getActiveFile();
					if (activeFile && activeFile.parent) {
						filePath = `${activeFile.parent.path}/Untitled.md`;
					}
					// If no active file, fall through to vault root
				} else if (newFileLocation === 'root') {
					// Create in vault root (already set)
					filePath = 'Untitled.md';
				}
				// For 'folder' without path or any other value, default to vault root
				
				console.log('[CMS View] Creating file at:', filePath);
				const file = await app.vault.create(filePath, '');
				await app.workspace.openLinkText(file.path, '', false);
				return;
			}
			
			// If location is "/" or just slashes, use vault root
			if (locationInput === '/' || locationInput.replace(/\//g, '') === '') {
				console.log('[CMS View] Creating note in vault root');
				try {
					// Explicitly create in vault root (no folder path)
					const newFile = await app.vault.create('Untitled.md', '');
					await app.workspace.openLinkText(newFile.path, '', false);
				} catch (error) {
					console.error('[CMS View] Error creating new note:', error);
				}
				return;
			}
			
			// Otherwise, use the specified folder
			console.log('[CMS View] Intercepting and creating note in:', locationInput);
			
			try {
				const folderPath = locationInput.replace(/^\/+|\/+$/g, '');
				console.log('[CMS View] Folder path:', folderPath);
				
				let folder = app.vault.getAbstractFileByPath(folderPath);
				
				if (!folder || !('children' in folder)) {
					console.log('[CMS View] Folder does not exist, creating:', folderPath);
					await app.vault.createFolder(folderPath);
					folder = app.vault.getAbstractFileByPath(folderPath);
				}
				
				if (folder && 'children' in folder) {
					const newFile = await app.vault.create(`${folderPath}/Untitled.md`, '');
					console.log('[CMS View] Created new file:', newFile.path);
					await app.workspace.openLinkText(newFile.path, '', false);
				} else {
					console.error('[CMS View] Failed to create or access folder:', folderPath);
				}
			} catch (error) {
				console.error('[CMS View] Error creating new note:', error);
			}
		} else {
			console.log('[CMS View] Custom new button not enabled');
			// Don't prevent default if setting is not enabled
		}
	};

	// Intercept clicks on the new button - use capture phase to catch before Bases
	const interceptNewButton = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		const buttonEl = target.closest('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
		
		if (!buttonEl) {
			return; // Not the new button
		}
		
		// Don't interfere with clicks inside the bulk toolbar or other CMS elements
		if (target.closest('.bases-cms-bulk-toolbar, .bases-cms-container .card')) {
			return; // Let these clicks work normally
		}
		
		// Check if this view is active - check if the button is within our view's container
		// or if the active leaf contains our container
		const activeLeaf = app.workspace.activeLeaf;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const activeView = activeLeaf?.view as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const activeLeafContainer = (activeLeaf as any)?.containerEl;
		const isOurView = activeView && (
			activeView.containerEl === containerEl ||
			activeView === containerEl ||
			(buttonEl.closest('.workspace-leaf') === activeLeafContainer)
		);
		
		if (!isOurView) {
			return; // Not our view
		}
		
		const settings = readCMSSettings(config, pluginSettings);

		if (settings.customizeNewButton) {
			// Always prevent default to stop the preview popup - do this FIRST
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			
			// Handle the note creation asynchronously
			void (async () => {
				const locationInput = settings.newNoteLocation?.trim() || '';
				
				// If location is empty, use Obsidian's default new note location
				if (locationInput === '') {
					// Use Obsidian's default new note creation behavior
					// Access Obsidian's vault config directly
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const vaultConfig = (app.vault as any).config;
					const newFileLocation = vaultConfig?.newFileLocation || 'folder';
					const newFileFolderPath = vaultConfig?.newFileFolderPath || '';
					
					console.log('[CMS View] Obsidian config:', { newFileLocation, newFileFolderPath });
					
					let filePath = 'Untitled.md';
					
					// Handle Obsidian's new file location settings
					if (newFileLocation === 'folder' && newFileFolderPath) {
						// Create in specified folder
						filePath = `${newFileFolderPath}/Untitled.md`;
					} else if (newFileLocation === 'current') {
						// Create in current file's folder
						const activeFile = app.workspace.getActiveFile();
						if (activeFile && activeFile.parent) {
							filePath = `${activeFile.parent.path}/Untitled.md`;
						}
						// If no active file, fall through to vault root
					} else if (newFileLocation === 'root') {
						// Create in vault root (already set)
						filePath = 'Untitled.md';
					}
					// For 'folder' without path or any other value, default to vault root
					
					console.log('[CMS View] Creating file at:', filePath);
					const file = await app.vault.create(filePath, '');
					await app.workspace.openLinkText(file.path, '', false);
					return;
				}
				
				// If location is "/" or just slashes, use vault root
				if (locationInput === '/' || locationInput.replace(/\//g, '') === '') {
					// Explicitly create in vault root (no folder path)
					const newFile = await app.vault.create('Untitled.md', '');
					await app.workspace.openLinkText(newFile.path, '', false);
					return;
				}
				
				// Otherwise, use the specified folder
				const folderPath = locationInput.replace(/^\/+|\/+$/g, '');
				
				let folder = app.vault.getAbstractFileByPath(folderPath);
				
				if (!folder || !('children' in folder)) {
					await app.vault.createFolder(folderPath);
					folder = app.vault.getAbstractFileByPath(folderPath);
				}
				
				if (folder && 'children' in folder) {
					const newFile = await app.vault.create(`${folderPath}/Untitled.md`, '');
					await app.workspace.openLinkText(newFile.path, '', false);
				}
			})();
		}
	};

	// Add event listener to document with capture phase to intercept before Bases
	document.addEventListener('click', interceptNewButton as EventListener, true);
	
	// Also try to intercept on the button directly when it appears
	const observer = new MutationObserver(() => {
		const buttons = document.querySelectorAll('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
		buttons.forEach((buttonEl) => {
			if (!(buttonEl as any).__cmsIntercepted) {
				(buttonEl as any).__cmsIntercepted = true;
				buttonEl.addEventListener('click', interceptNewButton as EventListener, true);
			}
		});
	});

	observer.observe(document.body, { childList: true, subtree: true });
	
	// Check immediately
	const buttons = document.querySelectorAll('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
	buttons.forEach((buttonEl) => {
		if (!(buttonEl as any).__cmsIntercepted) {
			(buttonEl as any).__cmsIntercepted = true;
			buttonEl.addEventListener('click', interceptNewButton as EventListener, true);
		}
	});
	
	// Register cleanup
	registerCleanup(() => {
		document.removeEventListener('click', interceptNewButton as EventListener, true);
		observer.disconnect();
	});
}

