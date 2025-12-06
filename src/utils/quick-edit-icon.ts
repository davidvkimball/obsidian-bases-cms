import { App, TFile, setIcon, Modal, TextComponent, Notice } from 'obsidian';
import type BasesCMSPlugin from '../main';
import type { CMSSettings } from '../shared/data-transform';

/**
 * Show rename dialog for a file without opening it
 * Similar to how Astro Composer's renameContentByPath works
 */
function showRenameDialog(app: App, file: TFile): void {
	const modal = new Modal(app);
	modal.titleEl.setText('Rename file');
	
	const inputContainer = modal.contentEl.createDiv();
	// Make input container full width
	inputContainer.style.width = '100%';
	const input = new TextComponent(inputContainer);
	input.setValue(file.basename);
	// Make input field full width to match Obsidian's native dialog
	input.inputEl.style.width = '100%';
	input.inputEl.style.boxSizing = 'border-box';
	input.inputEl.focus();
	input.inputEl.select();
	
	const buttonContainer = modal.contentEl.createDiv({ cls: 'modal-button-container' });
	const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
	cancelButton.addEventListener('click', () => modal.close());
	
	const renameButton = buttonContainer.createEl('button', { 
		text: 'Rename',
		cls: 'mod-cta'
	});
	
	const handleRename = async () => {
		const newName = input.getValue().trim();
		if (!newName || newName === file.basename) {
			modal.close();
			return;
		}
		
		// Construct new path with extension
		const pathParts = file.path.split('/');
		pathParts[pathParts.length - 1] = newName + (file.extension ? `.${file.extension}` : '');
		const newPath = pathParts.join('/');
		
		try {
			await app.fileManager.renameFile(file, newPath);
			modal.close();
		} catch (error) {
			// Error handling - the rename might fail if file already exists, etc.
			console.error('[Bases CMS] Error renaming file:', error);
			modal.close();
		}
	};
	
	renameButton.addEventListener('click', () => {
		void handleRename();
	});
	
	input.inputEl.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			void handleRename();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			modal.close();
		}
	});
	
	modal.open();
}

/**
 * Check if a command is Obsidian's default "Rename file" command
 */
function isObsidianRenameCommand(commandId: string): boolean {
	// Obsidian's rename file command IDs (may vary by version)
	const lowerId = commandId.toLowerCase();
	return commandId === 'file-explorer:rename-file' || 
		   commandId === 'rename-file' ||
		   commandId === 'file:rename-file' ||
		   (lowerId.includes('rename') && lowerId.includes('file') && !lowerId.includes(':'));
}

/**
 * Check if a command is known to not work well without the file being properly opened
 * These commands typically need editor context or specific UI state that can't be faked
 */
function isProblematicCommand(commandId: string, commandName: string): boolean {
	const lowerId = commandId.toLowerCase();
	const lowerName = commandName.toLowerCase();
	
	// Commands that need editor context and typically don't work well programmatically
	const problematicPatterns = [
		'add tag',
		'add-tag',
		'insert-template',
		'insert-template',
		'editor:',
		'markdown:',
	];
	
	return problematicPatterns.some(pattern => 
		lowerId.includes(pattern) || lowerName.includes(pattern)
	);
}

/**
 * Setup quick edit icon on title element (or card if title is hidden)
 */
export function setupQuickEditIcon(
	app: App,
	plugin: BasesCMSPlugin,
	titleEl: HTMLElement,
	cardEl: HTMLElement,
	cardPath: string,
	settings: CMSSettings
): void {
	// Quick edit icon (only if enabled, command is set, and not hidden in this view)
	if (!plugin.settings.enableQuickEdit || 
		!plugin.settings.quickEditCommand || 
		plugin.settings.quickEditCommand === '' ||
		settings.hideQuickEditIcon) {
		return;
	}
	
	// Attach to titleEl (title is always shown now)
	const quickEditIcon = titleEl.createSpan('bases-cms-quick-edit-icon');
	quickEditIcon.addClass('bases-cms-cursor-default');
	setIcon(quickEditIcon, plugin.settings.quickEditIcon || 'pencil-line');
	
	// Prevent title from being clickable when clicking icon
	titleEl.addEventListener('click', (e) => {
		if (quickEditIcon.contains(e.target as Node)) {
			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	}, true);
	
	// Execute command when icon is clicked
	// Register with capture phase BEFORE card click handler can see it
	cardEl.addEventListener('click', (e) => {
		void (async () => {
			const target = e.target as HTMLElement;
			if (!quickEditIcon.contains(target) && !target.closest('.bases-cms-quick-edit-icon')) {
				return; // Not clicking on icon
			}
			
			e.stopPropagation();
			e.stopImmediatePropagation();
			e.preventDefault();
			
			// Try to execute command without opening file first
			// For commands that need file context, try to call helper functions directly if available
			const file = app.vault.getAbstractFileByPath(cardPath);
			if (file instanceof TFile) {
				const commandId = plugin.settings.quickEditCommand;
				
				// FIRST: Check if this is Obsidian's "Rename file" command
				// Show rename dialog without opening the file, similar to Astro Composer
				const commandRegistry = (app as { commands?: { commands?: Record<string, { name?: string }> } }).commands;
				const command = commandRegistry?.commands?.[commandId];
				const commandName = command?.name || '';
				const lowerCommandName = commandName.toLowerCase();
				
				// Check if this is a rename file command by ID or name
				if (isObsidianRenameCommand(commandId) || 
					(lowerCommandName.includes('rename') && lowerCommandName.includes('file'))) {
					showRenameDialog(app, file);
					return; // Success, exit early - do NOT open the file
				}
				
				// Check if this is a known problematic command that won't work well
				if (isProblematicCommand(commandId, commandName)) {
					if (plugin.settings.quickEditOpenFile) {
						// User has enabled the setting, so try to open and execute anyway
						// Fall through to the file opening logic below
					} else {
						new Notice(`The "${commandName}" command requires the file to be open in an editor. Enable "Attempt to open file and execute quick edit command" in settings to try anyway.`, 5000);
						return; // Don't try to execute - it won't work properly
					}
				}
				
				// Try to find and call a helper function from the plugin that registered this command
				// Pattern: Look for [commandId]ByPath method on the source plugin
				let helperCalled = false;
				try {
					// Extract plugin ID from command ID if it has the format "plugin-id:command-id"
					// Otherwise, try to get it from the command registry
					let pluginId: string | null = null;
					let baseCommandId = commandId;
					
					if (commandId.includes(':')) {
						const parts = commandId.split(':');
						pluginId = parts[0];
						baseCommandId = parts.slice(1).join(':');
					} else {
						// Try to get plugin from command registry
						const appWithCommands = app as { commands?: { commands?: Record<string, unknown> } };
						const commandRegistry = appWithCommands.commands;
						const command = commandRegistry?.commands?.[commandId] as { plugin?: { manifest?: { id?: string }; pluginId?: string }; sourcePlugin?: { manifest?: { id?: string }; pluginId?: string } } | undefined;
						if (command) {
							// Try multiple ways to get the plugin
							const sourcePlugin = command.plugin || command.sourcePlugin;
							if (sourcePlugin) {
								// Try to get plugin ID from plugin instance
								pluginId = sourcePlugin.manifest?.id || sourcePlugin.pluginId || null;
							}
						}
					}
					
					// If we have a plugin ID, try to get the plugin instance
					if (pluginId) {
						const plugins = (app as { plugins?: { plugins?: Record<string, Record<string, unknown>> } }).plugins;
						const sourcePlugin = plugins?.plugins?.[pluginId];
						
						if (sourcePlugin) {
							// Convert command ID to camelCase method name
							// e.g., "rename-content" -> "renameContentByPath"
							const methodName = baseCommandId
								.split('-')
								.map((part, index) => 
									index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
								)
								.join('') + 'ByPath';
							
							// Check if the plugin exposes this helper function
							if (sourcePlugin && typeof sourcePlugin[methodName] === 'function') {
								// Call the helper function directly - no need to open file!
								await (sourcePlugin[methodName] as (path: string) => Promise<void>)(cardPath);
								helperCalled = true;
								return; // Success, exit early
							}
						}
					}
				} catch {
					// Fall through to try regular command execution
				}
				
				// For other commands or if helper not available, check if user wants to try opening the file
				if (!helperCalled) {
					// Only attempt to open file and execute if the setting is enabled
					if (!plugin.settings.quickEditOpenFile) {
						new Notice(`This command doesn't have special handling. Enable "Attempt to open file and execute quick edit command" in settings to try executing it.`, 5000);
						return; // Don't try to execute
					}
					
					// User has enabled the setting, so try to open the file first
					// and make it active so commands like "Rename file" target the correct file
					// Always open the file first and make it active before executing the command
					// This ensures commands that use getActiveFile() target the correct file
					const leaf = app.workspace.getLeaf(false);
					await leaf.openFile(file);
					
					// CRITICAL: Set this leaf as active so commands target the correct file
					// Commands like "Rename file" use getActiveFile() to determine which file to operate on
					app.workspace.setActiveLeaf(leaf, { focus: true });
					
					// Wait for the editor to be ready and the file to be active
					// Use multiple checks to ensure the workspace state has fully updated
					let attempts = 0;
					const maxAttempts = 30; // Maximum 1.5 seconds of waiting (30 * 50ms)
					const executeCommand = () => {
						// Final check right before executing
						const finalActiveFile = app.workspace.getActiveFile();
						if (finalActiveFile === file) {
							// File is confirmed active, execute the command
							void (async () => {
								try {
									await (app as { commands?: { executeCommandById?: (id: string) => Promise<void> } }).commands?.executeCommandById?.(plugin.settings.quickEditCommand);
								} catch {
									// Command execution failed
								}
							})();
						}
					};
					
					const checkEditorReady = () => {
						const view = leaf.view;
						const viewWithEditor = view as { editor?: unknown };
						const activeFile = app.workspace.getActiveFile();
						
						// Check that both the editor is ready AND the file is active
						if (view && 'editor' in view && viewWithEditor.editor && activeFile === file) {
							// Editor is ready and file is active
							// Wait a bit more to ensure workspace state is fully propagated
							// Use multiple animation frames and timeouts to ensure everything is settled
							requestAnimationFrame(() => {
								requestAnimationFrame(() => {
									setTimeout(() => {
										executeCommand();
									}, 200);
								});
							});
						} else if (attempts < maxAttempts) {
							// Editor not ready yet or file not active, check again
							attempts++;
							setTimeout(checkEditorReady, 50);
						}
					};
					
					// Start checking for editor readiness
					checkEditorReady();
				}
			}
		})();
	}, true); // Capture phase - runs BEFORE the regular card click handler
	
	// Also add a mousedown handler to catch it even earlier
	quickEditIcon.addEventListener('mousedown', (e) => {
		e.stopPropagation();
		e.stopImmediatePropagation();
		e.preventDefault();
	}, true);
}

