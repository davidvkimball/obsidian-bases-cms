/**
 * Command Picker Modal
 * Searchable modal for selecting an Obsidian command
 */

import { Modal, App, FuzzySuggestModal } from 'obsidian';

interface CommandOption {
	id: string;
	name: string;
}

export class CommandPickerModal extends FuzzySuggestModal<CommandOption> {
	private onSelect: (commandId: string) => void;

	constructor(app: App, onSelect: (commandId: string) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	getItems(): CommandOption[] {
		// Get all available commands
		// Try multiple methods to ensure we get ALL commands, not just context-filtered ones
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const commandRegistry = (this.app as any).commands;
		
		// Use a Set to deduplicate by command ID
		const commandMap = new Map<string, CommandOption>();
		
		// Method 1: Try listCommands() - but this might be context-filtered
		if (commandRegistry && typeof commandRegistry.listCommands === 'function') {
			try {
				const commands = commandRegistry.listCommands();
				for (const command of commands) {
					if (command && command.id && command.name && !commandMap.has(command.id)) {
						commandMap.set(command.id, {
							id: command.id,
							name: command.name
						});
					}
				}
			} catch (e) {
				console.warn('[Bases CMS] Error getting commands via listCommands():', e);
			}
		}
		
		// Method 2: Try accessing the internal commands registry directly
		// This should give us ALL commands regardless of context
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const registry = (commandRegistry as any).commands;
			if (registry && typeof registry === 'object') {
				const allCommands = Object.values(registry) as any[];
				for (const command of allCommands) {
					if (command && command.id && command.name && !commandMap.has(command.id)) {
						commandMap.set(command.id, {
							id: command.id,
							name: command.name
						});
					}
				}
			}
		} catch (e) {
			console.warn('[Bases CMS] Error getting commands via registry:', e);
		}
		
		// Method 3: Try accessing via internal structure (fallback)
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const internalRegistry = (commandRegistry as any).commandRegistry;
			if (internalRegistry && typeof internalRegistry === 'object') {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const allCommands = Object.values(internalRegistry) as any[];
				for (const command of allCommands) {
					if (command && command.id && command.name && !commandMap.has(command.id)) {
						commandMap.set(command.id, {
							id: command.id,
							name: command.name
						});
					}
				}
			}
		} catch (e) {
			console.warn('[Bases CMS] Error getting commands via internal registry:', e);
		}
		
		const commandOptions = Array.from(commandMap.values());
		
		// Sort alphabetically by name
		commandOptions.sort((a, b) => a.name.localeCompare(b.name));
		
		return commandOptions;
	}

	getItemText(item: CommandOption): string {
		return item.name;
	}

	onChooseItem(item: CommandOption, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(item.id);
	}

	// Override to show command ID in subtitle for clarity
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	renderSuggestion(match: any, el: HTMLElement): void {
		const item = match.item as CommandOption;
		el.createDiv({ cls: 'suggestion-title', text: item.name });
		el.createDiv({ cls: 'suggestion-note', text: item.id });
	}
}

