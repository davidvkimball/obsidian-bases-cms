/**
 * Utility functions to detect if a CMS view is embedded in a markdown note
 */

/**
 * Check if a container element is inside a markdown embed
 * @param containerEl - The container element to check
 * @returns true if the container is inside an embed, false otherwise
 */
export function isEmbeddedView(containerEl: HTMLElement): boolean {
	if (!containerEl) {
		return false;
	}

	// Check if container is inside a markdown embed
	// Obsidian uses various classes for embeds:
	// - .markdown-embed for markdown embeds (transclusions)
	// - .internal-embed for internal file embeds
	// - .markdown-embed-content for the content wrapper
	// - .markdown-source-view for standard code blocks in Live Preview
	// - .markdown-reading-view for standard code blocks in Reading mode
	const embedParent = containerEl.closest('.markdown-embed, .internal-embed, .markdown-embed-content, .markdown-source-view, .markdown-reading-view');

	return embedParent !== null;
}

/**
 * Get the file path of the note containing the embed (if embedded)
 * @param containerEl - The container element to check
 * @param app - Obsidian app instance
 * @returns The file path of the containing note, or null if not embedded
 */
export function getEmbeddingFile(containerEl: HTMLElement, app: { workspace?: { getActiveFile?: () => { path: string } | null } }): string | null {
	if (!isEmbeddedView(containerEl)) {
		return null;
	}

	// Try to find the markdown view that contains this embed
	const embedParent = containerEl.closest('.markdown-embed, .internal-embed');
	if (!embedParent) {
		return null;
	}

	// Look for the markdown view in the parent chain
	let current: HTMLElement | null = embedParent.parentElement;
	while (current) {
		// Check if this is a markdown view
		const viewEl = current.closest('.markdown-source-view, .markdown-reading-view');
		if (viewEl) {
			// Try to get the file from the view
			const view = (viewEl as unknown as { file?: { path: string } }).file;
			if (view?.path) {
				return view.path;
			}
		}
		current = current.parentElement;
	}

	// Fallback: try to get active file (less reliable for embedded views)
	if (app.workspace?.getActiveFile) {
		const activeFile = app.workspace.getActiveFile();
		if (activeFile) {
			return activeFile.path;
		}
	}

	return null;
}

