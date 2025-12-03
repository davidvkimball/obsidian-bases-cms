/**
 * Bulk Operations Toolbar
 * Toolbar that appears when items are selected
 */

import { App, setIcon } from 'obsidian';
import type BasesCMSPlugin from '../main';
import type { CMSSettings } from '../shared/data-transform';
import { ToolbarActions } from '../utils/toolbar-actions';

export class BulkToolbar {
	private toolbarEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private selectAllCallback?: () => void;
	private resizeObserver: ResizeObserver | null = null;
	private settings?: CMSSettings;
	private actions: ToolbarActions;
	private timeoutIds: number[] = [];

	constructor(
		private app: App,
		private plugin: BasesCMSPlugin,
		private container: HTMLElement,
		private getSelectedFiles: () => string[],
		private clearSelection: () => void,
		private refreshView: () => void,
		selectAllCallback?: () => void,
		settings?: CMSSettings
	) {
		this.selectAllCallback = selectAllCallback;
		this.settings = settings;
		this.actions = new ToolbarActions(
			this.app,
			this.plugin,
			this.getSelectedFiles,
			this.clearSelection,
			this.refreshView,
			() => this.show()
		);
		this.createToolbar();
	}

	/**
	 * Update settings (called when view settings change)
	 */
	updateSettings(settings: CMSSettings): void {
		this.settings = settings;
	}

	/**
	 * Get toolbar actions (for use in context menus)
	 */
	getActions(): ToolbarActions {
		return this.actions;
	}

	private createToolbar(): void {
		// Create toolbar element matching Bases structure
		this.toolbarEl = document.createElement('div');
		this.toolbarEl.className = 'bases-toolbar bases-cms-bulk-toolbar bases-cms-bulk-toolbar-hidden';
		// Store reference to this instance on the element for cleanup checks
		(this.toolbarEl as unknown as { __bulkToolbarInstance?: BulkToolbar }).__bulkToolbarInstance = this;

		// Create the toolbar content
		this.createToolbarContent();

		// Try to find and position the toolbar - use a small delay to ensure DOM is ready
		this.positionToolbar();
		
		// Also try positioning after a short delay in case DOM isn't ready yet
		const timeoutId = window.setTimeout(() => this.positionToolbar(), 100);
		this.timeoutIds.push(timeoutId);
	}

	private positionToolbar(): void {
		if (!this.toolbarEl) return;

		// Find the bases-header - it should be a sibling of our container
		// The structure should be: bases-header, then bulk toolbar, then bases-view bases-cms bases-cms-container
		let basesHeader = this.container.closest('.bases-header');
		if (!basesHeader) {
			// Try finding it in the parent hierarchy
			let parent = this.container.parentElement;
			while (parent && !basesHeader) {
				if (parent.classList.contains('bases-header')) {
					basesHeader = parent;
					break;
				}
				parent = parent.parentElement;
			}
		}
		if (!basesHeader) {
			// Try querying from document - look for one that contains our container
			const allHeaders = Array.from(document.querySelectorAll('.bases-header'));
			for (const header of allHeaders) {
				if (header.contains(this.container)) {
					basesHeader = header;
					break;
				}
			}
		}
		
		// Find the view-content container that should contain both bases-header and our container
		// The structure should be: view-content > bases-header > bases-toolbar, then our bulk toolbar, then bases-view
		const viewContent = this.container.closest('.view-content');
		
		if (viewContent) {
			// Position toolbar as a sibling of bases-header, right after it, before bases-view container
			// Find where to insert - should be after bases-header, before our container
			if (this.toolbarEl.parentElement !== viewContent) {
				if (this.toolbarEl.parentElement) {
					this.toolbarEl.remove();
				}
				// Insert after bases-header, before the bases-view container
				viewContent.insertBefore(this.toolbarEl, this.container);
			} else if (this.toolbarEl.nextSibling !== this.container) {
				// Reposition if it's not right before the container
				if (this.toolbarEl.parentElement) {
					this.toolbarEl.remove();
				}
				viewContent.insertBefore(this.toolbarEl, this.container);
			}
		} else if (basesHeader && basesHeader.parentElement) {
			// Fallback: insert after bases-header in its parent
			if (this.toolbarEl.parentElement !== basesHeader.parentElement) {
				if (this.toolbarEl.parentElement) {
					this.toolbarEl.remove();
				}
				basesHeader.parentElement.insertBefore(this.toolbarEl, basesHeader.nextSibling);
			}
		} else {
			// Last resort: insert before container
			const parent = this.container.parentElement;
			if (parent) {
				if (this.toolbarEl.parentElement !== parent || this.toolbarEl.nextSibling !== this.container) {
					if (this.toolbarEl.parentElement) {
						this.toolbarEl.remove();
					}
					parent.insertBefore(this.toolbarEl, this.container);
				}
			}
		}
	}

	private createToolbarContent(): void {
		if (!this.toolbarEl) return;
		
		// Left side container (Select all, Clear selection, Count)
		const leftContainer = this.toolbarEl.createDiv('bases-cms-bulk-toolbar-left');
		
		// Helper function to create Bases-style icon+text button
		const createBasesButton = (iconName: string, text: string, onClick: () => void, container: HTMLElement, isDestructive = false): HTMLElement => {
			const toolbarItem = container.createDiv('bases-toolbar-item');
			const button = toolbarItem.createDiv('text-icon-button');
			if (isDestructive) {
				button.addClass('destructive');
			}
			button.setAttribute('tabindex', '0');
			
			const iconEl = button.createSpan('text-button-icon');
			setIcon(iconEl, iconName);
			
			const textEl = button.createSpan('text-button-label');
			textEl.setText(text);
			
			button.addEventListener('click', onClick);
			return button;
		};

		// Left side: Select all
		if (this.plugin.settings.showToolbarSelectAll) {
			createBasesButton('copy-check', 'Select all', () => this.handleSelectAll(), leftContainer);
		}

		// Left side: Clear
		if (this.plugin.settings.showToolbarClear) {
			createBasesButton('square-x', 'Clear', () => this.clearSelection(), leftContainer);
		}

		// Left side: Selected count (not a button, just text)
		const countItem = leftContainer.createDiv('bases-toolbar-item bases-cms-selected-count');
		this.countEl = countItem.createSpan('text-button-label');
		this.countEl.setText('0 selected');

		// Right side container (all action buttons)
		const rightContainer = this.toolbarEl.createDiv('bases-cms-bulk-toolbar-right');

		// Right side: Publish
		if (this.plugin.settings.showToolbarPublish) {
			createBasesButton('book-check', 'Publish', () => {
				void this.actions.handlePublish(this.settings);
			}, rightContainer);
		}

		// Right side: Draft
		if (this.plugin.settings.showToolbarDraft) {
			createBasesButton('book-dashed', 'Draft', () => {
				void this.actions.handleSetDraft(this.settings);
			}, rightContainer);
		}

		// Right side: Tags
		if (this.plugin.settings.showToolbarTags) {
			createBasesButton('tags', 'Tags', () => this.actions.handleManageTags(), rightContainer);
		}

		// Right side: Set
		if (this.plugin.settings.showToolbarSet) {
			createBasesButton('list-check', 'Set', () => this.actions.handleSetProperty(), rightContainer);
		}

		// Right side: Remove
		if (this.plugin.settings.showToolbarRemove) {
			createBasesButton('list-x', 'Remove', () => this.actions.handleRemoveProperty(), rightContainer);
		}

		// Right side: Delete
		if (this.plugin.settings.showToolbarDelete) {
			createBasesButton('trash-2', 'Delete', () => {
				void this.actions.handleDelete();
			}, rightContainer, true);
		}

		// Set up responsive behavior - detect collapsed state
		this.setupResponsiveBehavior();
	}

	private setupResponsiveBehavior(): void {
		if (!this.toolbarEl) return;

		// Check initial state after a short delay to ensure toolbar is rendered
		const timeoutId1 = window.setTimeout(() => {
			this.updateCollapsedState();
		}, 100);
		this.timeoutIds.push(timeoutId1);

		// Observe toolbar width changes (more accurate than container)
		if (this.toolbarEl) {
			this.resizeObserver = new ResizeObserver(() => {
				this.updateCollapsedState();
			});
			this.resizeObserver.observe(this.toolbarEl);
		}
		
		// Also observe container as fallback
		const container = this.container;
		if (container) {
			// Use a separate observer for container to catch window resize
			const containerObserver = new ResizeObserver(() => {
				// Small delay to let toolbar resize first
				const timeoutId = window.setTimeout(() => {
					this.updateCollapsedState();
				}, 10);
				this.timeoutIds.push(timeoutId);
			});
			containerObserver.observe(container);
			
			// Store for cleanup
			(this as unknown as { containerObserver?: ResizeObserver }).containerObserver = containerObserver;
		}
	}

	private updateCollapsedState(): void {
		if (!this.toolbarEl) return;

		// Check if toolbar itself is narrow (collapsed)
		// Use the toolbar's actual width, not the container
		const toolbarWidth = this.toolbarEl.offsetWidth;
		const isCollapsed = toolbarWidth < 680; // Threshold for collapsing

		if (isCollapsed) {
			this.toolbarEl.addClass('collapsed');
		} else {
			this.toolbarEl.removeClass('collapsed');
		}
	}

	updateCount(count: number): void {
		if (this.countEl) {
			this.countEl.setText(`${count} selected`);
		}
	}

	private handleSelectAll(): void {
		if (this.selectAllCallback) {
			this.selectAllCallback();
		}
	}

	show(): void {
		if (!this.toolbarEl) {
			console.warn('[Bases CMS] Toolbar element not found, recreating...');
			this.createToolbar();
		}
		
		if (this.toolbarEl) {
			// Make sure it's positioned correctly first
			this.positionToolbar();
			
			// Ensure it's in the DOM
			if (!this.toolbarEl.parentElement) {
				console.warn('[Bases CMS] Toolbar not in DOM, repositioning...');
				this.positionToolbar();
			}
			
			// Show it with flex display
			this.toolbarEl.removeClass('bases-cms-bulk-toolbar-hidden');
			this.toolbarEl.addClass('bases-cms-bulk-toolbar-visible');
			
			// Force reflow to ensure transition works
			void this.toolbarEl.offsetHeight;
			
			// Animate in - use setTimeout instead of requestAnimationFrame for more reliability
			const timeoutId = window.setTimeout(() => {
				if (this.toolbarEl) {
					this.toolbarEl.removeClass('bases-cms-bulk-toolbar-animating-out');
					this.toolbarEl.addClass('bases-cms-bulk-toolbar-animating-in');
				}
			}, 10);
			this.timeoutIds.push(timeoutId);
		} else {
			console.error('[Bases CMS] Failed to show toolbar - element is null');
		}
	}

	hide(): void {
		if (this.toolbarEl) {
			// Animate out
			this.toolbarEl.removeClass('bases-cms-bulk-toolbar-animating-in');
			this.toolbarEl.addClass('bases-cms-bulk-toolbar-animating-out');
			// Wait for transition to complete before hiding
			const timeoutId = window.setTimeout(() => {
				if (this.toolbarEl) {
					this.toolbarEl.removeClass('bases-cms-bulk-toolbar-visible');
					this.toolbarEl.addClass('bases-cms-bulk-toolbar-hidden');
				}
			}, 200);
			this.timeoutIds.push(timeoutId);
		}
	}


	/**
	 * Recreate the toolbar with updated settings
	 * Preserves visibility state and count
	 */
	recreate(): void {
		const wasVisible = this.toolbarEl && !this.toolbarEl.hasClass('bases-cms-bulk-toolbar-hidden');
		let currentCount = 0;
		
		// Get current count before destroying
		if (this.countEl && this.countEl.textContent) {
			const match = this.countEl.textContent.match(/\d+/);
			if (match) {
				currentCount = parseInt(match[0], 10);
			}
		}
		
		// Destroy existing toolbar
		this.destroy();
		
		// Recreate toolbar
		this.createToolbar();
		
		// Restore visibility and count if it was visible
		if (wasVisible && this.toolbarEl && currentCount > 0) {
			this.updateCount(currentCount);
			this.show();
		}
	}

	destroy(): void {
		// Clear all timeouts
		this.timeoutIds.forEach(id => window.clearTimeout(id));
		this.timeoutIds = [];
		
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		// Clean up container observer if it exists
		const containerObserver = (this as unknown as { containerObserver?: ResizeObserver }).containerObserver;
		if (containerObserver) {
			containerObserver.disconnect();
			(this as unknown as { containerObserver?: ResizeObserver }).containerObserver = undefined;
		}
		if (this.toolbarEl) {
			this.toolbarEl.remove();
			this.toolbarEl = null;
		}
	}
}

