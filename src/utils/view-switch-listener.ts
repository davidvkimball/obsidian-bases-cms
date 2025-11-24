/**
 * View Switch Listener
 * Detects when the view is switched away and clears selection
 */

import type BasesCMSPlugin from '../main';

export class ViewSwitchListener {
	private mutationObserver: MutationObserver | null = null;
	private backupInterval: number | null = null;
	private currentBaseIdentifier: string | null = null;

	constructor(
		private containerEl: HTMLElement,
		private plugin: BasesCMSPlugin,
		private config: { getName?: () => string; name?: string },
		private controller: { getBaseName?: () => string; baseName?: string } | undefined,
		private data: { baseName?: string } | undefined,
		private selectedFiles: Set<string>,
		private onSelectionCleared: () => void,
		private registerCleanup: (cleanup: () => void) => void
	) {}

	setup(handleSelectionChange: (path: string, selected: boolean) => void): (path: string, selected: boolean) => void {
		const startObserving = () => {
			if (this.mutationObserver) return; // Already observing
			
			this.mutationObserver = new MutationObserver((mutations) => {
				// Only check if we have selection
				if (this.selectedFiles.size === 0) {
					return;
				}
				
				// Check if any cards were removed
				for (const mutation of mutations) {
					if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
						// Cards were removed - check if our selected cards are gone
						let foundSelectedCard = false;
						for (const path of this.selectedFiles) {
							const card = this.containerEl.querySelector(`[data-path="${path}"]`);
							if (card) {
								foundSelectedCard = true;
								break;
							}
						}
						
						// Also check if container has any cards at all
						const allCards = this.containerEl.querySelectorAll('.card[data-path]');
						
						if (!foundSelectedCard || allCards.length === 0) {
							this.selectedFiles.clear();
							this.onSelectionCleared();
							break;
						}
					}
				}
			});
			
			// Observe the container for child removals
			if (this.containerEl) {
				this.mutationObserver.observe(this.containerEl, {
					childList: true,
					subtree: true
				});
			}
		};
		
		const stopObserving = () => {
			if (this.mutationObserver) {
				this.mutationObserver.disconnect();
				this.mutationObserver = null;
				
				// When observer stops, it means selection is empty or view switched
				// Force clear selection and hide toolbar
				if (this.selectedFiles.size > 0) {
					this.selectedFiles.clear();
				}
				this.onSelectionCleared();
			}
		};
		
		// Get base identifier - try multiple methods
		const getBaseIdentifier = (): string | null => {
			try {
				// Try to get base name from config
				if (this.config?.getName) {
					return this.config.getName();
				}
				if (this.config?.name) {
					return String(this.config.name);
				}
				// Try to access controller
				if (this.controller) {
					if (this.controller?.getBaseName) {
						return this.controller.getBaseName();
					}
					if (this.controller?.baseName) {
						return String(this.controller.baseName);
					}
				}
				// Try to get from data
				if (this.data) {
					if (this.data.baseName) {
						return String(this.data.baseName);
					}
				}
			} catch {
				// Ignore errors
			}
			return null;
		};
		
		// Also check periodically as backup (slower, 500ms)
		const backupCheck = () => {
			if (this.selectedFiles.size === 0) {
				if (this.backupInterval !== null) {
					window.clearInterval(this.backupInterval);
					this.backupInterval = null;
				}
				return;
			}
			
			// Check if base identifier changed
			const currentBaseId = getBaseIdentifier();
			if (this.currentBaseIdentifier !== null && currentBaseId !== null && 
				this.currentBaseIdentifier !== currentBaseId) {
				this.selectedFiles.clear();
				this.onSelectionCleared();
				stopObserving();
				if (this.backupInterval !== null) {
					window.clearInterval(this.backupInterval);
					this.backupInterval = null;
				}
				return;
			}
			
			// Check if container has cards
			const allCards = this.containerEl.querySelectorAll('.card[data-path]');
			if (allCards.length === 0) {
				this.selectedFiles.clear();
				this.onSelectionCleared();
			}
		};
		
		// Start observing when selection is made
		const originalHandleSelectionChange = handleSelectionChange.bind(this);
		const wrappedHandleSelectionChange = (path: string, selected: boolean) => {
			originalHandleSelectionChange(path, selected);
			
			// Start observing if we have selection, stop if we don't
			if (this.selectedFiles.size > 0) {
				// Store current base identifier when selection starts
				if (this.currentBaseIdentifier === null) {
					this.currentBaseIdentifier = getBaseIdentifier();
				}
				startObserving();
				// Also start backup interval - use plugin's registerInterval for proper cleanup
				if (this.backupInterval === null) {
					this.backupInterval = this.plugin.registerInterval(window.setInterval(backupCheck, 500));
				}
			} else {
				// Clear base identifier when selection is empty
				this.currentBaseIdentifier = null;
				// Selection became empty - stop observing
				stopObserving();
				if (this.backupInterval !== null) {
					window.clearInterval(this.backupInterval);
					this.backupInterval = null;
				}
			}
		};
		
		// Register cleanup
		this.registerCleanup(() => {
			stopObserving();
			if (this.backupInterval !== null) {
				window.clearInterval(this.backupInterval);
				this.backupInterval = null;
			}
		});

		return wrappedHandleSelectionChange;
	}

	cleanup(): void {
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = null;
		}
		if (this.backupInterval !== null) {
			window.clearInterval(this.backupInterval);
			this.backupInterval = null;
		}
	}
}

