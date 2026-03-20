import { App, BasesEntry, TFile } from 'obsidian';
import type { CMSSettings } from '../shared/data-transform';
import { getFileFrontmatter } from './frontmatter-helper';

/**
 * Calculate draft status from entry and settings
 * Supports both .md files (via Bases API) and .mdx files (via manual frontmatter parsing)
 * Uses cached frontmatter when available to avoid async loading
 */
export async function calculateDraftStatusAsync(
	entry: BasesEntry,
	settings: CMSSettings,
	app: App,
	mdxFrontmatterCache?: Record<string, Record<string, unknown> | null>
): Promise<{ booleanValue: boolean | null; isDraft: boolean }> {
	let booleanValue: boolean | null = null;
	let isDraft = false;
	
	// Check if using filename prefix mode - this always provides a value
	if (settings.draftStatusUseFilenamePrefix && entry.file && entry.file.name) {
		const fileName = entry.file.name;
		const startsWithUnderscore = fileName.startsWith('_');
		booleanValue = startsWithUnderscore;
		isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
	} else if (settings.draftStatusProperty) {
		// Try synchronous Bases API first (works for .md files)
		const draftValue = entry.getValue(settings.draftStatusProperty as `note.${string}` | `formula.${string}` | `file.${string}`) as { data?: unknown } | null;
		if (draftValue && 'data' in draftValue && typeof draftValue.data === 'boolean') {
			booleanValue = draftValue.data;
			isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
		} else {
			// For MDX files, use cached frontmatter if available, otherwise fallback to async loading
			const file = app.vault.getAbstractFileByPath(entry.file.path);
			if (file instanceof TFile && file.extension === 'mdx') {
				// Check cache first
				let frontmatter: Record<string, unknown> | null = null;
				if (mdxFrontmatterCache) {
					frontmatter = mdxFrontmatterCache[entry.file.path] ?? null;
				}
				
				// If not in cache, load asynchronously
				if (frontmatter === undefined) {
					frontmatter = await getFileFrontmatter(app, file);
				}
				
				if (frontmatter) {
					// Strip "note." prefix if present
					const cleanProp = settings.draftStatusProperty.startsWith('note.') 
						? settings.draftStatusProperty.substring(5) 
						: settings.draftStatusProperty;
					const frontmatterValue = frontmatter[cleanProp];
					
					// Handle boolean values (YAML parser returns booleans directly)
					if (typeof frontmatterValue === 'boolean') {
						booleanValue = frontmatterValue;
						isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
					}
				}
			}
		}
	}
	
	return { booleanValue, isDraft };
}

/**
 * Calculate draft status from entry and settings (synchronous version for backwards compatibility)
 * Note: This only works for .md files. For MDX files, use calculateDraftStatusAsync instead.
 */
export function calculateDraftStatus(
	entry: BasesEntry,
	settings: CMSSettings
): { booleanValue: boolean | null; isDraft: boolean } {
	let booleanValue: boolean | null = null;
	let isDraft = false;
	
	// Check if using filename prefix mode - this always provides a value
	if (settings.draftStatusUseFilenamePrefix && entry.file && entry.file.name) {
		const fileName = entry.file.name;
		const startsWithUnderscore = fileName.startsWith('_');
		booleanValue = startsWithUnderscore;
		isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
	} else if (settings.draftStatusProperty) {
		// Use property-based detection (synchronous Bases API - works for .md files only)
		const draftValue = entry.getValue(settings.draftStatusProperty as `note.${string}` | `formula.${string}` | `file.${string}`) as { data?: unknown } | null;
		if (draftValue && 'data' in draftValue && typeof draftValue.data === 'boolean') {
			booleanValue = draftValue.data;
			isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
		}
	}
	
	return { booleanValue, isDraft };
}

/**
 * Render draft status badge on a container element
 * Supports both .md files (synchronous) and .mdx files (uses cache when available)
 */
export function renderDraftStatusBadge(
	container: HTMLElement,
	entry: BasesEntry,
	cardPath: string,
	settings: CMSSettings,
	onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>,
	app?: App,
	mdxFrontmatterCache?: Record<string, Record<string, unknown> | null>
): void {
	if (!settings.showDraftStatus) {
		return;
	}

	// Try synchronous first (works for .md files)
	const { booleanValue: syncValue, isDraft: syncIsDraft } = calculateDraftStatus(entry, settings);

	if (syncValue !== null) {
		// Synchronous result available (from Bases API or filename prefix)
		renderBadge(container, syncValue, syncIsDraft, onPropertyToggle, cardPath, settings, app);
	} else if (app) {
		// For MDX files, check cache first to render synchronously
		const file = app.vault.getAbstractFileByPath(entry.file.path);
		if (file instanceof TFile && file.extension === 'mdx' && mdxFrontmatterCache) {
			const frontmatter = mdxFrontmatterCache[entry.file.path];
			if (frontmatter && settings.draftStatusProperty) {
				// Strip "note." prefix if present
				const cleanProp = settings.draftStatusProperty.startsWith('note.')
					? settings.draftStatusProperty.substring(5)
					: settings.draftStatusProperty;
				const frontmatterValue = frontmatter[cleanProp];

				// Handle boolean values synchronously
				if (typeof frontmatterValue === 'boolean') {
					const booleanValue = frontmatterValue;
					const isDraft = settings.draftStatusReverse ? !booleanValue : booleanValue;
					renderBadge(container, booleanValue, isDraft, onPropertyToggle, cardPath, settings, app);
					return;
				}
			}
		}

		// No synchronous result - try async for MDX files (fallback if cache miss)
		void (async () => {
			const { booleanValue, isDraft } = await calculateDraftStatusAsync(entry, settings, app, mdxFrontmatterCache);
			if (booleanValue !== null && container.isConnected) {
				renderBadge(container, booleanValue, isDraft, onPropertyToggle, cardPath, settings, app);
			}
		})();
	}
}

/**
 * Helper function to render the badge element
 */
function renderBadge(
	container: HTMLElement,
	booleanValue: boolean,
	isDraft: boolean,
	onPropertyToggle: ((path: string, property: string, value: unknown) => void | Promise<void>) | undefined,
	cardPath: string,
	settings?: CMSSettings,
	app?: App
): void {
	// Check if badge already exists to avoid duplicates
	if (container.querySelector('.card-status-badge')) {
		return;
	}

	const statusBadge = container.createDiv('card-status-badge');
	if (isDraft) {
		statusBadge.addClass('status-draft');
		statusBadge.appendText('Draft');
	} else {
		statusBadge.addClass('status-published');
		statusBadge.appendText('Published');
	}

	const isUnderscoreMode = settings?.draftStatusUseFilenamePrefix;

	if (isUnderscoreMode && app) {
		// Underscore prefix mode: toggle by renaming the file
		statusBadge.addClass('bases-cms-cursor-pointer');
		statusBadge.addEventListener('click', (e) => {
			e.stopPropagation();
			void (async () => {
				const file = app.vault.getAbstractFileByPath(cardPath);
				if (!(file instanceof TFile)) return;

				const fileName = file.name;
				let newName: string;
				if (fileName.startsWith('_')) {
					// Remove underscore (publish)
					newName = fileName.substring(1);
				} else {
					// Add underscore (draft)
					newName = '_' + fileName;
				}
				const newPath = file.path.replace(fileName, newName);
				await app.fileManager.renameFile(file, newPath);
			})();
		});
	} else if (onPropertyToggle) {
		// Property mode: toggle the draft property value
		statusBadge.addClass('bases-cms-cursor-pointer');
		statusBadge.addEventListener('click', (e) => {
			e.stopPropagation();
			const newValue = !booleanValue;
			void onPropertyToggle(cardPath, 'draft', newValue);
		});
	}
}


