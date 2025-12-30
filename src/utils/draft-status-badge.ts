import { BasesEntry } from 'obsidian';
import type { CMSSettings } from '../shared/data-transform';

/**
 * Calculate draft status from entry and settings
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
		// Use property-based detection
		// Note: getFirstBasesPropertyValue is async, but for draft status badge we use synchronous Bases API
		// This works for .md files; for MDX files, draft status should be resolved during card transformation
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
 */
export function renderDraftStatusBadge(
	container: HTMLElement,
	entry: BasesEntry,
	cardPath: string,
	settings: CMSSettings,
	onPropertyToggle?: (path: string, property: string, value: unknown) => void | Promise<void>
): void {
	if (!settings.showDraftStatus) {
		return;
	}
	
	const { booleanValue, isDraft } = calculateDraftStatus(entry, settings);
	
	// Show badge if we have a draft status determination
	// When filename prefix is enabled, booleanValue is always set, so badge always shows
	if (booleanValue !== null) {
		const statusBadge = container.createDiv('card-status-badge');
		if (isDraft) {
			statusBadge.addClass('status-draft');
			statusBadge.appendText('Draft');
		} else {
			statusBadge.addClass('status-published');
			statusBadge.appendText('Published');
		}
		
		if (onPropertyToggle) {
			statusBadge.addClass('bases-cms-cursor-pointer');
			statusBadge.addEventListener('click', (e) => {
				e.stopPropagation();
				const newValue = !booleanValue;
				void onPropertyToggle(cardPath, 'draft', newValue);
			});
		}
	}
}


