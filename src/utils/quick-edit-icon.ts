import { App, TFile, setIcon } from 'obsidian';
import type BasesCMSPlugin from '../main';
import type { CMSSettings } from '../shared/data-transform';

/**
 * Setup quick edit icon on title element
 */
export function setupQuickEditIcon(
	app: App,
	plugin: BasesCMSPlugin,
	titleEl: HTMLElement,
	cardEl: HTMLElement,
	cardPath: string,
	settings: CMSSettings
): void {
	// Quick edit icon (only if enabled, command is set, title is shown, and not hidden in this view)
	if (!plugin.settings.enableQuickEdit || 
		!plugin.settings.quickEditCommand || 
		plugin.settings.quickEditCommand === '' ||
		settings.hideQuickEditIcon) {
		return;
	}
	
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
				
				// For other commands or if helper not available, try executing without opening file first
				// Many commands work without the file being open
				if (!helperCalled) {
					try {
						await (app as { commands?: { executeCommandById?: (id: string) => Promise<void> } }).commands?.executeCommandById?.(plugin.settings.quickEditCommand);
						return; // Success, no need to open file
					} catch {
						// Command failed - it might need the file open
						// Open file as a last resort
						
						// Open the file in an editor view (not just preview)
						// This ensures editorCallback commands have the proper context
						const leaf = app.workspace.getLeaf(false);
						await leaf.openFile(file);
						
						// Wait for the editor to be ready before executing command
						// Some commands need the editor context
						const checkEditorReady = () => {
							const view = leaf.view;
							const viewWithEditor = view as { editor?: unknown };
							if (view && 'editor' in view && viewWithEditor.editor) {
								// Editor is ready, execute command
								setTimeout(() => {
									void (async () => {
										try {
											await (app as { commands?: { executeCommandById?: (id: string) => Promise<void> } }).commands?.executeCommandById?.(plugin.settings.quickEditCommand);
										} catch {
											// Command execution failed
										}
									})();
								}, 100);
							} else {
								// Editor not ready yet, check again
								setTimeout(checkEditorReady, 50);
							}
						};
						
						// Start checking for editor readiness
						checkEditorReady();
					}
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

