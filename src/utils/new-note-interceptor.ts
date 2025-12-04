import { App } from 'obsidian';
import { readCMSSettings } from '../shared/settings-schema';
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
		// Use activeLeaf for compatibility (deprecated but necessary here)
		const activeLeaf = (app.workspace as unknown as { activeLeaf?: { view?: unknown } }).activeLeaf;
		const activeView = activeLeaf?.view as { containerEl?: HTMLElement } | undefined;
		const activeViewContainer = activeView ? activeView.containerEl : null;
		const isOurView = activeView && activeViewContainer && (
			activeViewContainer === containerEl ||
			buttonEl.closest('.workspace-leaf')?.contains(activeViewContainer)
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
					const vaultConfig = (app.vault as { config?: { newFileLocation?: string; newFileFolderPath?: string } }).config;
					const newFileLocation = vaultConfig?.newFileLocation || 'folder';
					const newFileFolderPath = vaultConfig?.newFileFolderPath || '';
					
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
			const buttonWithFlag = buttonEl as unknown as { __cmsIntercepted?: boolean };
			if (!buttonWithFlag.__cmsIntercepted) {
				buttonWithFlag.__cmsIntercepted = true;
				buttonEl.addEventListener('click', interceptNewButton as EventListener, true);
			}
		});
	});

	observer.observe(document.body, { childList: true, subtree: true });
	
	// Check immediately
	const buttons = document.querySelectorAll('.bases-toolbar-new-item-menu .text-icon-button, .bases-toolbar-new-item-menu');
	buttons.forEach((buttonEl) => {
		const buttonWithFlag = buttonEl as unknown as { __cmsIntercepted?: boolean };
		if (!buttonWithFlag.__cmsIntercepted) {
			buttonWithFlag.__cmsIntercepted = true;
			buttonEl.addEventListener('click', interceptNewButton as EventListener, true);
		}
	});
	
	// Register cleanup
	registerCleanup(() => {
		document.removeEventListener('click', interceptNewButton as EventListener, true);
		observer.disconnect();
	});
}

