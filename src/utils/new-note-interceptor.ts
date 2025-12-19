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
		
		// Try multiple selectors for the new button - Bases might use different structures
		const buttonEl = target.closest('.bases-toolbar-new-item-menu, .bases-toolbar-new-item-menu .text-icon-button, [data-action="new-item"], button[aria-label*="new"], button[aria-label*="New"], .bases-toolbar button');
		
		if (!buttonEl) {
			return; // Not the new button
		}
		
		// Don't interfere with clicks inside the bulk toolbar or other CMS elements
		if (target.closest('.bases-cms-bulk-toolbar, .bases-cms-container .card')) {
			return; // Let these clicks work normally
		}
		
		// Check if this click is for OUR specific view instance
		// Get the active view to see which one is actually active
		const activeLeaf = (app.workspace as unknown as { activeLeaf?: { view?: { containerEl?: HTMLElement; readonly type?: string } } }).activeLeaf;
		const activeView = activeLeaf?.view;
		const activeViewContainer = activeView?.containerEl;
		
		// FIRST: Only intercept if the active view is a CMS view (type === 'bases-cms')
		// This prevents intercepting when user switches to table/cards view
		// Check the container for the CMS class as a fallback if type isn't available
		const isCMSView = activeView?.type === 'bases-cms' || 
			(activeViewContainer?.querySelector('.bases-cms-container') !== null);
		
		if (!isCMSView) {
			return; // Not a CMS view, let Bases handle it normally (don't prevent default)
		}
		
		// SECOND: Check if our container is within the active view's container, or if they're the same
		// The active view's containerEl is usually workspace-leaf-content, and our container is inside it
		const isOurView = activeViewContainer && (
			activeViewContainer === containerEl || 
			activeViewContainer.contains(containerEl) ||
			containerEl.contains(activeViewContainer)
		);
		
		if (!isOurView) {
			return; // Not our view
		}
		
		// Get the config from the view instance stored on the container - this ensures we get the current config
		const containerWithView = containerEl as unknown as { 
			__cmsConfig?: BasesConfig;
			__cmsView?: { config?: BasesConfig };
		};
		
		// Try to get config from the view instance first (most reliable)
		const viewInstance = containerWithView.__cmsView;
		const viewConfig = viewInstance?.config || containerWithView.__cmsConfig || config;
		
		const settings = readCMSSettings(viewConfig, pluginSettings);

		// Check if we need to intercept: either "Open new notes directly" is enabled, or a location is specified
		const hasCustomLocation = settings.newNoteLocation && settings.newNoteLocation.trim() !== '';
		
		if (settings.customizeNewButton || hasCustomLocation) {
			// Prevent default to handle note creation ourselves
			// (We must intercept if location is set, even if "Open new notes directly" is off,
			// because Bases modal doesn't support custom locations)
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			
			// Handle the note creation asynchronously
			void (async () => {
				const locationInput = settings.newNoteLocation?.trim() || '';
				
				// If location is empty and "Open new notes directly" is off, use Obsidian's default
				// (This case should be rare since we only intercept if location is set or option is on)
				if (locationInput === '' && !settings.customizeNewButton) {
					// Use Obsidian's default new note location
					const vaultConfig = (app.vault as { config?: { newFileLocation?: string; newFileFolderPath?: string } }).config;
					const newFileLocation = vaultConfig?.newFileLocation || 'folder';
					const newFileFolderPath = vaultConfig?.newFileFolderPath || '';
					
					let filePath = 'Untitled.md';
					
					if (newFileLocation === 'folder' && newFileFolderPath) {
						filePath = `${newFileFolderPath}/Untitled.md`;
					} else if (newFileLocation === 'current') {
						const activeFile = app.workspace.getActiveFile();
						if (activeFile && activeFile.parent) {
							filePath = `${activeFile.parent.path}/Untitled.md`;
						}
					} else if (newFileLocation === 'root') {
						filePath = 'Untitled.md';
					}
					
					const file = await app.vault.create(filePath, '');
					// Only open directly if "Open new notes directly" is enabled
					if (settings.customizeNewButton) {
						await app.workspace.openLinkText(file.path, '', false);
					}
					return;
				}
				
				// If location is "/" or just slashes, use vault root
				if (locationInput === '/' || locationInput.replace(/\//g, '') === '') {
					const newFile = await app.vault.create('Untitled.md', '');
					// Only open directly if "Open new notes directly" is enabled
					if (settings.customizeNewButton) {
						await app.workspace.openLinkText(newFile.path, '', false);
					}
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
					// Only open directly if "Open new notes directly" is enabled
					if (settings.customizeNewButton) {
						await app.workspace.openLinkText(newFile.path, '', false);
					}
				}
			})().catch((error) => {
				console.error('[CMS] Error creating new note:', error);
			});
		}
	};

	// Add event listener to document with capture phase to intercept before Bases
	document.addEventListener('click', interceptNewButton as EventListener, true);
	
	// Also try to intercept on the button directly when it appears
	const observer = new MutationObserver(() => {
		const buttons = document.querySelectorAll('.bases-toolbar-new-item-menu, .bases-toolbar-new-item-menu .text-icon-button, [data-action="new-item"]');
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
	const buttons = document.querySelectorAll('.bases-toolbar-new-item-menu, .bases-toolbar-new-item-menu .text-icon-button, [data-action="new-item"]');
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


