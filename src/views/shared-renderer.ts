/**
 * Shared Card Renderer for CMS Views
 * Based on Dynamic Views but with CMS-specific features
 */

import { App, BasesEntry, TFile, Menu, setIcon, Notice } from 'obsidian';
import type BasesCMSPlugin from '../main';
import type { CardData } from '../shared/data-transform';
import type { CMSSettings } from '../shared/data-transform';
import { resolveBasesProperty } from '../shared/data-transform';
import { getPropertyLabel, getFirstBasesPropertyValue } from '../utils/property';

export class SharedCardRenderer {
	protected basesConfig?: { get?: (key: string) => unknown };
	protected basesController?: { getPropertyDisplayName?: (name: string) => string };
	
	constructor(
		protected app: App,
		protected plugin: BasesCMSPlugin,
		protected propertyObservers: ResizeObserver[],
		protected updateLayoutRef: { current: (() => void) | null },
		basesConfig?: { get?: (key: string) => unknown },
		basesController?: unknown
	) {
		this.basesConfig = basesConfig;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.basesController = basesController as any;
	}

	/**
	 * Renders a complete card with CMS features
	 */
	renderCard(
		container: HTMLElement,
		card: CardData,
		entry: BasesEntry,
		settings: CMSSettings,
		hoverParent: unknown,
		isSelected: boolean,
		onSelect: (path: string, selected: boolean) => void,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void
	): { img: HTMLImageElement; src: string } | null {
		// Create card element
		const cardEl = container.createDiv('card bases-cms-card');
		if (settings.imageFormat === 'cover') {
			cardEl.classList.add('image-format-cover');
		} else if (settings.imageFormat === 'thumbnail') {
			cardEl.classList.add('image-format-thumbnail');
		}
		cardEl.setAttribute('data-path', card.path);
		cardEl.setAttribute('data-href', card.path);
		cardEl.style.cursor = 'pointer';

		// Selection checkbox
		const checkboxEl = cardEl.createDiv('bases-cms-select-checkbox');
		const checkbox = checkboxEl.createEl('input', { type: 'checkbox', cls: 'selection-checkbox' });
		checkbox.checked = isSelected;
		checkbox.addEventListener('change', (e) => {
			e.stopPropagation();
			e.stopImmediatePropagation();
			onSelect(card.path, checkbox.checked);
		});
		// Also handle click on checkbox to ensure it works
		checkbox.addEventListener('click', (e) => {
			e.stopPropagation();
			e.stopImmediatePropagation();
		});

		// Draft status badge for non-cover formats (positioned absolutely, aligned with checkbox)
		if (settings.showDraftStatus && settings.imageFormat !== 'cover') {
			let booleanValue: boolean | null = null;
			let isDraft = false;
			
			console.log('[Bases CMS] Badge render check:', {
				showDraftStatus: settings.showDraftStatus,
				imageFormat: settings.imageFormat,
				draftStatusUseFilenamePrefix: settings.draftStatusUseFilenamePrefix,
				draftStatusProperty: settings.draftStatusProperty,
				hasFile: !!entry.file,
				fileName: entry.file?.name
			});
			
			// Check if using filename prefix mode - this always provides a value
			if (settings.draftStatusUseFilenamePrefix && entry.file && entry.file.name) {
				const fileName = entry.file.name;
				const startsWithUnderscore = fileName.startsWith('_');
				booleanValue = startsWithUnderscore;
				isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
			} else if (settings.draftStatusProperty) {
				// Use property-based detection
				const draftValue = getFirstBasesPropertyValue(entry, settings.draftStatusProperty);
				if (draftValue) {
					const draftObj = draftValue as { data?: unknown } | null;
					if (draftObj && 'data' in draftObj && typeof draftObj.data === 'boolean') {
						booleanValue = draftObj.data;
						isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
					}
				}
			}
			
			// Show badge if we have a draft status determination
			// When filename prefix is enabled, booleanValue is always set, so badge always shows
			if (booleanValue !== null) {
				const statusBadge = cardEl.createDiv('card-status-badge');
				if (isDraft) {
					statusBadge.addClass('status-draft');
					statusBadge.appendText('Draft');
				} else {
					statusBadge.addClass('status-published');
					statusBadge.appendText('Published');
				}
				
				if (onPropertyToggle) {
					statusBadge.style.cursor = 'pointer';
					statusBadge.addEventListener('click', async (e) => {
						e.stopPropagation();
						const newValue = !booleanValue;
						await onPropertyToggle(card.path, 'draft', newValue);
					});
				}
			}
		}

		// Handle card click to open file (but not when clicking checkbox or property checkboxes)
		cardEl.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			// Check if click is on quick edit icon or any of its children (like SVG)
			const quickEditIcon = target.closest('.bases-cms-quick-edit-icon');
			if (quickEditIcon) {
				// Explicitly prevent card click when icon is clicked
				e.stopPropagation();
				e.stopImmediatePropagation();
				e.preventDefault();
				return;
			}
			if (
				checkboxEl.contains(target) ||
				target.tagName === 'INPUT' ||
				target.closest('input') ||
				target.closest('.bases-cms-property') ||
				target.closest('.card-status-badge')
			) {
				return;
			}
			const newLeaf = e.metaKey || e.ctrlKey;
			void this.app.workspace.openLinkText(card.path, '', newLeaf);
		});

		// Handle right-click to show context menu
		cardEl.addEventListener('contextmenu', (e) => {
			const target = e.target as HTMLElement;
			// Don't show context menu for checkboxes, property checkboxes, status badges, or quick edit icon
			if (
				checkboxEl.contains(target) ||
				target.tagName === 'INPUT' ||
				target.closest('input') ||
				target.closest('.bases-cms-property') ||
				target.closest('.card-status-badge') ||
				target.closest('.bases-cms-quick-edit-icon')
			) {
				return;
			}

			// Get the file
			const file = this.app.vault.getAbstractFileByPath(card.path);
			if (file && file instanceof TFile) {
				// Prevent the card click handler from firing
				e.stopPropagation();
				// Don't prevent default - Obsidian's menu system needs default behavior
				
				const menu = new Menu();
				// Trigger file-menu with 'bases' source only (same as native Bases cards view)
				// This includes both Bases-specific options and standard file options
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				this.app.workspace.trigger('file-menu', menu, file, 'bases');
				menu.showAtMouseEvent(e);
			}
		});

		// Title
		if (settings.showTitle) {
			const titleEl = cardEl.createDiv('card-title');
			titleEl.appendText(card.title);
			
			// Quick edit icon (only if enabled, command is set, title is shown, and not hidden in this view)
			if (this.plugin.settings.enableQuickEdit && 
				this.plugin.settings.quickEditCommand && 
				this.plugin.settings.quickEditCommand !== '' &&
				!settings.hideQuickEditIcon) {
				const quickEditIcon = titleEl.createSpan('bases-cms-quick-edit-icon');
				quickEditIcon.style.cursor = 'default';
				setIcon(quickEditIcon, 'pencil-line');
				
				// Prevent title from being clickable when clicking icon
				titleEl.addEventListener('click', (e) => {
					if (quickEditIcon.contains(e.target as Node)) {
						e.stopPropagation();
						e.stopImmediatePropagation();
					}
				}, true);
				
				// Execute command when icon is clicked
				// Register with capture phase BEFORE card click handler can see it
				cardEl.addEventListener('click', async (e) => {
					const target = e.target as HTMLElement;
					if (!quickEditIcon.contains(target) && !target.closest('.bases-cms-quick-edit-icon')) {
						return; // Not clicking on icon
					}
					
					e.stopPropagation();
					e.stopImmediatePropagation();
					e.preventDefault();
					
					// Try to execute command without opening file first
					// For commands that need file context, try to call helper functions directly if available
					const file = this.app.vault.getAbstractFileByPath(card.path);
					if (file instanceof TFile) {
						const commandId = this.plugin.settings.quickEditCommand;
						
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
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const commandRegistry = (this.app as any).commands;
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const command = commandRegistry?.commands?.[commandId];
								if (command) {
									// Try multiple ways to get the plugin
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									const sourcePlugin = (command as any).plugin || (command as any).sourcePlugin;
									if (sourcePlugin) {
										// Try to get plugin ID from plugin instance
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										pluginId = (sourcePlugin as any).manifest?.id || (sourcePlugin as any).pluginId;
									}
								}
							}
							
							// If we have a plugin ID, try to get the plugin instance
							if (pluginId) {
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const plugins = (this.app as any).plugins;
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
									if (typeof sourcePlugin[methodName] === 'function') {
										// Call the helper function directly - no need to open file!
										await sourcePlugin[methodName](card.path);
										helperCalled = true;
										return; // Success, exit early
									}
								}
							}
						} catch (error) {
							// Fall through to try regular command execution
						}
						
						// For other commands or if helper not available, try executing without opening file first
						// Many commands work without the file being open
						if (!helperCalled) {
							try {
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								await (this.app as any).commands.executeCommandById(this.plugin.settings.quickEditCommand);
								return; // Success, no need to open file
							} catch (error) {
								// Command failed - it might need the file open
								// Open file as a last resort
								
								// Open the file in an editor view (not just preview)
								// This ensures editorCallback commands have the proper context
								const leaf = this.app.workspace.getLeaf(false);
								await leaf.openFile(file);
								
								// Wait for the editor to be ready before executing command
								// Some commands need the editor context
								const checkEditorReady = () => {
									const view = leaf.view;
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									if (view && 'editor' in view && (view as any).editor) {
										// Editor is ready, execute command
										setTimeout(async () => {
											try {
												// eslint-disable-next-line @typescript-eslint/no-explicit-any
												await (this.app as any).commands.executeCommandById(this.plugin.settings.quickEditCommand);
											} catch (error) {
												// Command execution failed
											}
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
				}, true); // Capture phase - runs BEFORE the regular card click handler
				
				// Also add a mousedown handler to catch it even earlier
				quickEditIcon.addEventListener('mousedown', (e) => {
					e.stopPropagation();
					e.stopImmediatePropagation();
					e.preventDefault();
				}, true);
			}
		}

		// Date (below title)
		if (settings.showDate && settings.dateProperty) {
			const dateValue = getFirstBasesPropertyValue(entry, settings.dateProperty);
			if (dateValue) {
				const dateObj = dateValue as { date?: Date; data?: unknown } | null;
				let dateString = '';
				if (dateObj && 'date' in dateObj && dateObj.date instanceof Date) {
					dateString = dateObj.date.toLocaleDateString();
				} else if (dateObj && 'data' in dateObj && dateObj.data) {
					const data = dateObj.data;
					if (data instanceof Date) {
						dateString = data.toLocaleDateString();
					} else if (typeof data === 'string' || typeof data === 'number') {
						const date = new Date(data);
						if (!isNaN(date.getTime())) {
							dateString = date.toLocaleDateString();
						} else {
							dateString = String(data);
						}
					}
				}
				if (dateString) {
					const dateEl = cardEl.createDiv('card-date');
					dateEl.appendText(dateString);
				}
			}
		}

		// Content container
		if (settings.showTextPreview ||
			(settings.showTags && card.displayTags && card.displayTags.length > 0) ||
			(settings.imageFormat !== 'none' && (card.imageUrl || card.hasImageAvailable)) ||
			(settings.imageFormat === 'cover')) {
			const contentContainer = cardEl.createDiv('card-content');

			// For thumbnail format, create a wrapper for text + tags
			if (settings.imageFormat === 'thumbnail') {
				const textWrapper = contentContainer.createDiv('card-text-wrapper');
				
				// Text preview - always create if showTextPreview is enabled, even if snippet isn't loaded yet
				if (settings.showTextPreview) {
					const textPreviewEl = textWrapper.createDiv('card-text-preview');
					if (card.snippet) {
						textPreviewEl.setText(card.snippet);
					}
					// Store reference to update later when snippet loads
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(cardEl as any).__textPreviewEl = textPreviewEl;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(cardEl as any).__cardPath = card.path;
				}

				// Tags as pills (under text preview)
				if (settings.showTags && card.displayTags && card.displayTags.length > 0) {
					const tagsContainer = textWrapper.createDiv('card-tags');
					const maxTags = settings.maxTagsToShow;
					const tagsToShow = card.displayTags.slice(0, maxTags);
					const remainingCount = card.displayTags.length - maxTags;
					
					tagsToShow.forEach(tag => {
						const tagEl = tagsContainer.createSpan('card-tag');
						tagEl.appendText(tag);
					});
					
					if (remainingCount > 0) {
						const moreEl = tagsContainer.createSpan('card-tag-more');
						moreEl.appendText(`+${remainingCount} more`);
					}
				}
			} else {
				// For cover/no-image format, stack vertically
				// Text preview - always create if showTextPreview is enabled, even if snippet isn't loaded yet
				if (settings.showTextPreview) {
					const textPreviewEl = contentContainer.createDiv('card-text-preview');
					if (card.snippet) {
						textPreviewEl.setText(card.snippet);
					}
					// Store reference to update later when snippet loads
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(cardEl as any).__textPreviewEl = textPreviewEl;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(cardEl as any).__cardPath = card.path;
				}

				// Tags as pills (under text preview)
				if (settings.showTags && card.displayTags && card.displayTags.length > 0) {
					const tagsContainer = contentContainer.createDiv('card-tags');
					const maxTags = settings.maxTagsToShow;
					const tagsToShow = card.displayTags.slice(0, maxTags);
					const remainingCount = card.displayTags.length - maxTags;
					
					tagsToShow.forEach(tag => {
						const tagEl = tagsContainer.createSpan('card-tag');
						tagEl.appendText(tag);
					});
					
					if (remainingCount > 0) {
						const moreEl = tagsContainer.createSpan('card-tag-more');
						moreEl.appendText(`+${remainingCount} more`);
					}
				}
			}

			// Thumbnail or cover
			if (settings.imageFormat !== 'none' && card.imageUrl) {
				const rawUrls = Array.isArray(card.imageUrl) ? card.imageUrl : [card.imageUrl];
				const imageUrls = rawUrls.filter(url => url && typeof url === 'string' && url.trim().length > 0);

				const imageClassName = settings.imageFormat === 'cover' ? 'card-cover' : 'card-thumbnail';
				const imageEl = contentContainer.createDiv(imageClassName);

				if (imageUrls.length > 0) {
					const imageEmbedContainer = imageEl.createDiv('image-embed');
					// Create img element WITHOUT src first (will be set in batch)
					const imgEl = imageEmbedContainer.createEl('img', {
						attr: { 
							alt: '',
							decoding: 'async',
							sizes: settings.imageFormat === 'cover' ? '100vw' : '80px'
						}
					});
					// Set CSS variable for letterbox blur background
					imageEmbedContainer.style.setProperty('--cover-image-url', `url("${imageUrls[0]}")`);
					
					// Draft status badge (top-left, clickable to toggle)
					// For cover images, place badge on the cover AFTER image-embed is created
					if (settings.showDraftStatus && settings.imageFormat === 'cover') {
						let booleanValue: boolean | null = null;
						let isDraft = false;
						
						// Check if using filename prefix mode - this always provides a value
						if (settings.draftStatusUseFilenamePrefix && entry.file && entry.file.name) {
							const fileName = entry.file.name;
							const startsWithUnderscore = fileName.startsWith('_');
							booleanValue = startsWithUnderscore;
							isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
						} else if (settings.draftStatusProperty) {
							// Use property-based detection
							const draftValue = getFirstBasesPropertyValue(entry, settings.draftStatusProperty);
							if (draftValue) {
								const draftObj = draftValue as { data?: unknown } | null;
								if (draftObj && 'data' in draftObj && typeof draftObj.data === 'boolean') {
									booleanValue = draftObj.data;
									isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
								}
							}
						}
						
						// Show badge if we have a draft status determination
						// When filename prefix is enabled, booleanValue is always set, so badge always shows
						if (booleanValue !== null) {
							const statusBadge = imageEl.createDiv('card-status-badge');
							if (isDraft) {
								statusBadge.addClass('status-draft');
								statusBadge.appendText('Draft');
							} else {
								statusBadge.addClass('status-published');
								statusBadge.appendText('Published');
							}
							
							if (onPropertyToggle) {
								statusBadge.style.cursor = 'pointer';
								statusBadge.addEventListener('click', async (e) => {
									e.stopPropagation();
									const newValue = !booleanValue;
									await onPropertyToggle(card.path, 'draft', newValue);
								});
							}
						}
					}
					
					// Properties - MUST be called before returning
					this.renderProperties(cardEl, card, entry, settings, onPropertyToggle);
					
					
					// Return image element and src for batch loading
					return { img: imgEl, src: imageUrls[0] };
				}
			} else if (settings.imageFormat === 'cover') {
				// For cover format, render placeholder and add badge if needed
				const placeholderEl = contentContainer.createDiv('card-cover-placeholder');
				
				// Draft status badge on placeholder (top-left, clickable to toggle)
				if (settings.showDraftStatus) {
					let booleanValue: boolean | null = null;
					let isDraft = false;
					
					// Check if using filename prefix mode - this always provides a value
					if (settings.draftStatusUseFilenamePrefix && entry.file && entry.file.name) {
						const fileName = entry.file.name;
						const startsWithUnderscore = fileName.startsWith('_');
						booleanValue = startsWithUnderscore;
						isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
					} else if (settings.draftStatusProperty) {
						// Use property-based detection
						const draftValue = getFirstBasesPropertyValue(entry, settings.draftStatusProperty);
						if (draftValue) {
							const draftObj = draftValue as { data?: unknown } | null;
							if (draftObj && 'data' in draftObj && typeof draftObj.data === 'boolean') {
								booleanValue = draftObj.data;
								isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
							}
						}
					}
					
					// Show badge if we have a draft status determination
					// When filename prefix is enabled, booleanValue is always set, so badge always shows
					if (booleanValue !== null) {
						const statusBadge = placeholderEl.createDiv('card-status-badge');
						if (isDraft) {
							statusBadge.addClass('status-draft');
							statusBadge.appendText('Draft');
						} else {
							statusBadge.addClass('status-published');
							statusBadge.appendText('Published');
						}
						
						if (onPropertyToggle) {
							statusBadge.style.cursor = 'pointer';
							statusBadge.addEventListener('click', async (e) => {
								e.stopPropagation();
								const newValue = !booleanValue;
								await onPropertyToggle(card.path, 'draft', newValue);
							});
						}
					}
				}
			}
			// For thumbnail format, don't render placeholder when no image - just skip it
		}


		// Properties
		this.renderProperties(cardEl, card, entry, settings, onPropertyToggle);
		
		return null; // No image for this card
	}

	/**
	 * Renders property fields for a card
	 */
	private renderProperties(
		cardEl: HTMLElement,
		card: CardData,
		entry: BasesEntry,
		settings: CMSSettings,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void
	): void {
		const props = [
			settings.propertyDisplay1,
			settings.propertyDisplay2,
			settings.propertyDisplay3,
			settings.propertyDisplay4
		];

		// Detect duplicates
		const seen = new Set<string>();
		const effectiveProps = props.map(prop => {
			if (!prop || prop === '') return '';
			if (seen.has(prop)) return '';
			seen.add(prop);
			return prop;
		});

		// Resolve property values
		const values = effectiveProps.map(prop =>
			prop ? resolveBasesProperty(prop, entry, card, settings) : null
		);

		// Check if any row has content
		const row1HasContent = effectiveProps[0] !== '' || effectiveProps[1] !== '';
		const row2HasContent = effectiveProps[2] !== '' || effectiveProps[3] !== '';

		if (!row1HasContent && !row2HasContent) return;

		const metaEl = cardEl.createDiv('card-properties properties-4field');

		// Row 1
		if (row1HasContent) {
			const row1El = metaEl.createDiv('property-row property-row-1');
			if (settings.propertyLayout12SideBySide) {
				row1El.addClass('property-row-side-by-side');
			}
			const field1El = row1El.createDiv('property-field property-field-1');
			if (effectiveProps[0]) this.renderPropertyContent(field1El, effectiveProps[0], values[0], card, entry, settings, onPropertyToggle);
			const field2El = row1El.createDiv('property-field property-field-2');
			if (effectiveProps[1]) this.renderPropertyContent(field2El, effectiveProps[1], values[1], card, entry, settings, onPropertyToggle);
		}

		// Row 2
		if (row2HasContent) {
			const row2El = metaEl.createDiv('property-row property-row-2');
			if (settings.propertyLayout34SideBySide) {
				row2El.addClass('property-row-side-by-side');
			}
			const field3El = row2El.createDiv('property-field property-field-3');
			if (effectiveProps[2]) this.renderPropertyContent(field3El, effectiveProps[2], values[2], card, entry, settings, onPropertyToggle);
			const field4El = row2El.createDiv('property-field property-field-4');
			if (effectiveProps[3]) this.renderPropertyContent(field4El, effectiveProps[3], values[3], card, entry, settings, onPropertyToggle);
		}
	}

	/**
	 * Renders individual property content
	 */
	private renderPropertyContent(
		container: HTMLElement,
		propertyName: string,
		resolvedValue: string | null,
		card: CardData,
		entry: BasesEntry,
		settings: CMSSettings,
		onPropertyToggle?: (path: string, property: string, value: unknown) => void
	): void {
		if (propertyName === '') return;

		// If no value and labels are hidden, render nothing
		if (!resolvedValue && settings.propertyLabels === 'hide') {
			return;
		}

		// Early return for empty special properties when labels are hidden
		if (settings.propertyLabels === 'hide') {
			if ((propertyName === 'tags' || propertyName === 'note.tags') && card.yamlTags.length === 0) {
				return;
			}
			if ((propertyName === 'file.tags' || propertyName === 'file tags') && card.tags.length === 0) {
				return;
			}
			if ((propertyName === 'file.path' || propertyName === 'path' || propertyName === 'file path') && card.folderPath.length === 0) {
				return;
			}
		}

		// Get property label from Bases if available
		const propertyLabel = getPropertyLabel(propertyName, this.app, this.basesConfig, this.basesController);
		// Check if we got a custom display name (different from property name)
		const isCustomLabel = propertyLabel.toLowerCase() !== propertyName.toLowerCase();

		// Render label if property labels are enabled
		if (settings.propertyLabels === 'above') {
			const labelEl = container.createDiv('property-label');
			if (isCustomLabel) {
				labelEl.addClass('property-label-custom');
			}
			labelEl.textContent = propertyLabel;
		}

		// Universal wrapper for all content types
		const metaContent = container.createDiv('property-content');

		// Add inline label if enabled (inside metaContent)
		if (settings.propertyLabels === 'inline') {
			const labelSpan = metaContent.createSpan('property-label-inline');
			labelSpan.textContent = propertyLabel + ': ';
		}

		// If no value but labels are enabled, show placeholder
		if (!resolvedValue) {
			metaContent.appendText('…');
			return;
		}

		// Handle timestamp properties
		const isKnownTimestampProperty = propertyName === 'file.mtime' || propertyName === 'file.ctime' ||
			propertyName === 'modified time' || propertyName === 'created time';

		if (isKnownTimestampProperty) {
			const timestampWrapper = metaContent.createSpan();
			timestampWrapper.appendText(resolvedValue);
		} else if ((propertyName === 'tags' || propertyName === 'note.tags') && card.yamlTags.length > 0) {
			// YAML tags only
			const tagsWrapper = metaContent.createDiv('tags-wrapper');
			card.yamlTags.forEach(tag => {
				const tagEl = tagsWrapper.createEl('a', {
					cls: 'tag',
					text: tag,
					href: '#'
				});
				tagEl.addEventListener('click', (e) => {
					e.preventDefault();
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const searchPlugin = (this.app as any).internalPlugins?.plugins?.["global-search"];
					if (searchPlugin?.instance?.openGlobalSearch) {
						searchPlugin.instance.openGlobalSearch("tag:" + tag);
					}
				});
			});
		} else if ((propertyName === 'file.tags' || propertyName === 'file tags') && card.tags.length > 0) {
			// tags in YAML + note body
			const tagsWrapper = metaContent.createDiv('tags-wrapper');
			card.tags.forEach(tag => {
				const tagEl = tagsWrapper.createEl('a', {
					cls: 'tag',
					text: tag,
					href: '#'
				});
				tagEl.addEventListener('click', (e) => {
					e.preventDefault();
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const searchPlugin = (this.app as any).internalPlugins?.plugins?.["global-search"];
					if (searchPlugin?.instance?.openGlobalSearch) {
						searchPlugin.instance.openGlobalSearch("tag:" + tag);
					}
				});
			});
		} else if ((propertyName === 'file.path' || propertyName === 'path' || propertyName === 'file path') && card.path.length > 0) {
			const pathWrapper = metaContent.createDiv('path-wrapper');
			const segments = card.path.split('/').filter(f => f);
			segments.forEach((segment, idx) => {
				const span = pathWrapper.createSpan();
				const isLastSegment = idx === segments.length - 1;
				const segmentClass = isLastSegment ? 'path-segment filename-segment' : 'path-segment file-path-segment';
				const segmentEl = span.createSpan({ cls: segmentClass, text: segment });
				segmentEl.addEventListener('click', (e) => {
					e.stopPropagation();
					if (isLastSegment) {
						const file = this.app.vault.getAbstractFileByPath(card.path);
						if (file instanceof TFile) {
							void this.app.workspace.getLeaf(false).openFile(file);
						}
					}
				});
				if (idx < segments.length - 1) {
					span.createSpan({ cls: 'path-separator', text: '/' });
				}
			});
		} else {
			// Check if this is a checkbox property
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const metadataCache = this.app.metadataCache as any;
			const propertyInfos = (typeof metadataCache.getAllPropertyInfos === 'function' 
				? metadataCache.getAllPropertyInfos() 
				: {}) || {};
			const propInfo = propertyInfos[propertyName.toLowerCase()];
			
			// Try to get value from entry to check if it's boolean
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
			const entryValue = entry.getValue(propertyName as any) as { data?: unknown } | null;
			const isCheckbox = propInfo?.widget === 'checkbox' || 
				(entryValue && 'data' in entryValue && typeof entryValue.data === 'boolean');

			if (isCheckbox && onPropertyToggle) {
				// Render as checkbox
				const checkbox = metaContent.createEl('input', { type: 'checkbox', cls: 'checkbox-input' });
				checkbox.checked = entryValue && 'data' in entryValue ? Boolean(entryValue.data) : false;
				
				// Strip "note." prefix for display
				const displayName = propertyName.startsWith('note.') ? propertyName.substring(5) : propertyName;
				metaContent.createSpan({ cls: 'checkbox-label', text: displayName });
				
				checkbox.addEventListener('click', (e) => {
					e.stopPropagation();
				});
				
				checkbox.addEventListener('change', async (e) => {
					e.stopPropagation();
					try {
						// Strip "note." prefix before toggling
						const cleanProperty = propertyName.startsWith('note.') ? propertyName.substring(5) : propertyName;
						await onPropertyToggle(card.path, cleanProperty, checkbox.checked);
					} catch (error) {
						console.error('Error toggling property:', error);
						checkbox.checked = !checkbox.checked;
					}
				});
			} else {
				// Generic property - wrap in div for proper scrolling
				const textWrapper = metaContent.createDiv('text-wrapper');
				textWrapper.appendText(resolvedValue);
			}
		}

		// Remove metaContent wrapper if it ended up empty
		if (!metaContent.textContent || metaContent.textContent.trim().length === 0) {
			metaContent.remove();
		}
	}
}

