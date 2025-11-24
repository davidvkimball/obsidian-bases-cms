/**
 * Selection Management for CMS View
 * Handles file selection state and UI updates
 */

import type { BulkToolbar } from '../components/bulk-toolbar';
import type { CMSSettings } from '../shared/data-transform';
import { readCMSSettings } from '../shared/settings-schema';
import type BasesCMSPlugin from '../main';

interface BasesConfig {
	get(key: string): unknown;
}

export class SelectionManager {
	private selectedFiles: Set<string> = new Set();
	private bulkToolbar: BulkToolbar | null = null;
	private isRefreshingWithSelection: boolean = false;

	constructor(
		private containerEl: HTMLElement,
		private app: { vault: { getAbstractFileByPath: (path: string) => unknown } },
		private plugin: BasesCMSPlugin,
		private config: BasesConfig,
		private createToolbar: (
			getSelectedFiles: () => string[],
			clearSelection: () => void,
			refreshView: () => void,
			selectAllCallback: () => void,
			settings: CMSSettings
		) => BulkToolbar,
		private selectAllCallback: () => void
	) {}

	getSelectedFiles(): Set<string> {
		return this.selectedFiles;
	}

	hasSelection(): boolean {
		return this.selectedFiles.size > 0;
	}

	add(path: string): void {
		this.selectedFiles.add(path);
	}

	delete(path: string): void {
		this.selectedFiles.delete(path);
	}

	clear(): void {
		this.selectedFiles.clear();
	}

	setRefreshingWithSelection(value: boolean): void {
		this.isRefreshingWithSelection = value;
	}

	isRefreshing(): boolean {
		return this.isRefreshingWithSelection;
	}

	setToolbar(toolbar: BulkToolbar | null): void {
		this.bulkToolbar = toolbar;
	}

	getToolbar(): BulkToolbar | null {
		return this.bulkToolbar;
	}

	handleSelectionChange(path: string, selected: boolean): void {
		if (selected) {
			this.selectedFiles.add(path);
		} else {
			this.selectedFiles.delete(path);
		}
		this.updateSelectionUI();
	}

	selectAll(): void {
		const cards = this.containerEl.querySelectorAll('.bases-cms-card');
		cards.forEach((cardEl) => {
			const path = cardEl.getAttribute('data-path');
			if (path) {
				this.selectedFiles.add(path);
			}
		});
		this.updateSelectionUI();
	}

	deselectAll(): void {
		this.selectedFiles.clear();
		this.updateSelectionUI();
	}

	updateSelectionUI(): void {
		// Update card visual states
		const cards = this.containerEl.querySelectorAll('.card');
		cards.forEach((cardEl) => {
			const path = cardEl.getAttribute('data-path');
			const checkbox = cardEl.querySelector('input[type="checkbox"].selection-checkbox') as HTMLInputElement;
			if (path) {
				const isSelected = this.selectedFiles.has(path);
				if (isSelected) {
					cardEl.addClass('selected');
				} else {
					cardEl.removeClass('selected');
				}
				if (checkbox) {
					checkbox.checked = isSelected;
				}
			}
		});

		// Show/hide bulk toolbar - hide when selection is empty
		// Don't hide if we're in the middle of a refresh that will restore selection
		if (this.selectedFiles.size > 0) {
			// Check if toolbar element already exists in DOM (from previous view switch)
			// Remove any orphaned toolbar elements that might be left over
			const orphanedToolbars = document.querySelectorAll('.bases-cms-bulk-toolbar');
			orphanedToolbars.forEach(toolbar => {
				// Only remove if it's not our current toolbar
				const toolbarInstance = (toolbar as unknown as { __bulkToolbarInstance?: BulkToolbar }).__bulkToolbarInstance;
				if (!toolbarInstance || toolbarInstance !== this.bulkToolbar) {
					toolbar.remove();
				}
			});
			
			// If toolbar doesn't exist, create it
			if (!this.bulkToolbar) {
				const settings = readCMSSettings(
					this.config,
					this.plugin.settings
				);
				this.bulkToolbar = this.createToolbar(
					() => Array.from(this.selectedFiles),
					() => {
						this.selectedFiles.clear();
						this.updateSelectionUI();
					},
					() => {
						// Refresh view but preserve selection
						const selectedPaths = Array.from(this.selectedFiles);
						
						// Set flag to prevent toolbar from being hidden during refresh
						this.isRefreshingWithSelection = true;
						
						// Keep toolbar visible during refresh - critical to prevent it from disappearing
						if (this.bulkToolbar && selectedPaths.length > 0) {
							this.bulkToolbar.show();
						}
						
						// Refresh the view - this will be handled by the view
						// The view should call restoreSelectionAfterRefresh when done
					},
					this.selectAllCallback,
					settings
				);
			} else {
				// Update settings if toolbar already exists
				const settings = readCMSSettings(
					this.config,
					this.plugin.settings
				);
				this.bulkToolbar.updateSettings(settings);
			}
			this.bulkToolbar.updateCount(this.selectedFiles.size);
			this.bulkToolbar.show();
		} else {
			// Selection is empty - force hide toolbar immediately
			if (this.bulkToolbar && !this.isRefreshingWithSelection) {
				this.bulkToolbar.hide();
				// Force immediate hide as backup
				const toolbarEl = this.containerEl.querySelector('.bases-cms-bulk-toolbar');
				if (toolbarEl instanceof HTMLElement) {
					toolbarEl.removeClass('bases-cms-bulk-toolbar-visible');
					toolbarEl.addClass('bases-cms-bulk-toolbar-hidden');
				}
			}
		}
	}

	restoreSelectionAfterRefresh(onDataUpdated: () => void): void {
		const selectedPaths = Array.from(this.selectedFiles);
		
		// Set flag to prevent toolbar from being hidden during refresh
		this.isRefreshingWithSelection = true;
		
		// Keep toolbar visible during refresh - critical to prevent it from disappearing
		if (this.bulkToolbar && selectedPaths.length > 0) {
			this.bulkToolbar.show();
		}
		
		// Refresh the view
		onDataUpdated();
		
		// Restore selection after refresh completes
		// Use multiple timeouts to ensure it works even if the first one is too early
		window.setTimeout(() => {
			// Restore selection
			selectedPaths.forEach(path => {
				if (this.app.vault.getAbstractFileByPath(path)) {
					this.selectedFiles.add(path);
				}
			});
			
			// Clear the flag and update UI
			this.isRefreshingWithSelection = false;
			this.updateSelectionUI();
			
			// Ensure toolbar is visible and updated
			if (this.selectedFiles.size > 0 && this.bulkToolbar) {
				this.bulkToolbar.show();
				this.bulkToolbar.updateCount(this.selectedFiles.size);
			}
			
			// Double-check after a bit more time
			window.setTimeout(() => {
				if (this.selectedFiles.size > 0 && this.bulkToolbar) {
					this.bulkToolbar.show();
					this.bulkToolbar.updateCount(this.selectedFiles.size);
				}
			}, 100);
		}, 250);
	}

	updateCardStates(): void {
		// Just update card states, don't touch toolbar visibility
		const cards = this.containerEl.querySelectorAll('.card');
		cards.forEach((cardEl) => {
			const path = cardEl.getAttribute('data-path');
			const checkbox = cardEl.querySelector('input[type="checkbox"].selection-checkbox') as HTMLInputElement;
			if (path) {
				const isSelected = this.selectedFiles.has(path);
				if (isSelected) {
					cardEl.addClass('selected');
				} else {
					cardEl.removeClass('selected');
				}
				if (checkbox) {
					checkbox.checked = isSelected;
				}
			}
		});
	}

	refreshToolbar(): void {
		if (this.bulkToolbar) {
			const currentCount = this.selectedFiles.size;
			this.bulkToolbar.recreate();
			// Update count after recreation
			if (currentCount > 0) {
				this.bulkToolbar.updateCount(currentCount);
			}
		}
	}
}

