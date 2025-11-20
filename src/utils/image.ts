import { App, TFile } from 'obsidian';

/**
 * Check if a URL is an external HTTP/HTTPS URL
 */
export function isExternalUrl(url: string): boolean {
	return /^https?:\/\//i.test(url);
}

/**
 * Check if a path has a valid image file extension
 */
export function hasValidImageExtension(path: string): boolean {
	return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(path);
}

/**
 * Validate if a URL points to a valid, loadable image
 * NOTE: This is slow and should be avoided for performance. Only use when absolutely necessary.
 */
export function validateImageUrl(url: string): Promise<boolean> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(true);
		img.onerror = () => resolve(false);
		setTimeout(() => resolve(false), 5000);
		img.src = url;
	});
}

/**
 * Strip wikilink syntax from image path
 */
export function stripWikilinkSyntax(path: string): string {
	const wikilinkMatch = path.match(/^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
	return wikilinkMatch ? wikilinkMatch[1].trim() : path;
}

/**
 * Process and validate image paths from property values
 * Handles wikilink stripping, URL validation, and path separation
 * Based on Dynamic Views' approach with parallel validation for performance
 * 
 * @param imagePaths - Raw image paths from properties (may contain wikilinks)
 * @returns Promise resolving to object with validated internal paths and external URLs
 */
export async function processImagePaths(
	imagePaths: string[]
): Promise<{ internalPaths: string[]; externalUrls: string[] }> {
	const internalPaths: string[] = [];
	const externalUrlCandidates: string[] = [];

	// First pass: separate internal paths and external URL candidates
	for (const imgPath of imagePaths) {
		// Strip wikilink syntax
		const cleanPath = stripWikilinkSyntax(imgPath);

		if (cleanPath.length === 0) continue;

		if (isExternalUrl(cleanPath)) {
			// External URL - validate extension if present
			if (hasValidImageExtension(cleanPath) || !cleanPath.includes('.')) {
				externalUrlCandidates.push(cleanPath);
			}
		} else {
			// Internal path - validate extension
			if (hasValidImageExtension(cleanPath)) {
				internalPaths.push(cleanPath);
			}
		}
	}

	// Second pass: validate external URLs in parallel (much faster)
	const validationPromises = externalUrlCandidates.map(url => 
		validateImageUrl(url).then(isValid => isValid ? url : null)
	);
	const validatedUrls = await Promise.all(validationPromises);
	const externalUrls = validatedUrls.filter((url): url is string => url !== null);

	return { internalPaths, externalUrls };
}

/**
 * Convert internal image paths to resource URLs
 */
export function resolveInternalImagePaths(
	internalPaths: string[],
	sourcePath: string,
	app: App
): string[] {
	const validImageExtensions = ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];
	const resourcePaths: string[] = [];

	for (const propPath of internalPaths) {
		const imageFile = app.metadataCache.getFirstLinkpathDest(propPath, sourcePath);
		if (imageFile && validImageExtensions.includes(imageFile.extension)) {
			const resourcePath = app.vault.getResourcePath(imageFile);
			resourcePaths.push(resourcePath);
		}
	}

	return resourcePaths;
}

/**
 * Extract image URLs from file embeds
 * Validates external URLs in parallel for better performance
 */
export async function extractEmbedImages(
	file: TFile,
	app: App
): Promise<string[]> {
	const validImageExtensions = ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];
	const metadata = app.metadataCache.getFileCache(file);

	if (!metadata?.embeds) return [];

	const bodyResourcePaths: string[] = [];
	const bodyExternalUrlCandidates: string[] = [];

	// First pass: separate internal paths and external URL candidates
	for (const embed of metadata.embeds) {
		const embedLink = embed.link;
		if (isExternalUrl(embedLink)) {
			if (hasValidImageExtension(embedLink) || !embedLink.includes('.')) {
				bodyExternalUrlCandidates.push(embedLink);
			}
		} else {
			const targetFile = app.metadataCache.getFirstLinkpathDest(embedLink, file.path);
			if (targetFile && validImageExtensions.includes(targetFile.extension)) {
				const resourcePath = app.vault.getResourcePath(targetFile);
				bodyResourcePaths.push(resourcePath);
			}
		}
	}

	// Second pass: validate external URLs in parallel (much faster)
	const validationPromises = bodyExternalUrlCandidates.map(url => 
		validateImageUrl(url).then(isValid => isValid ? url : null)
	);
	const validatedUrls = await Promise.all(validationPromises);
	const bodyExternalUrls = validatedUrls.filter((url): url is string => url !== null);

	return [...bodyResourcePaths, ...bodyExternalUrls];
}

