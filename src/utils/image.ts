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
		// Try resolving with metadata cache first (handles relative paths, wikilinks, etc.)
		let imageFile: TFile | null = app.metadataCache.getFirstLinkpathDest(propPath, sourcePath);
		
		// If not found and path starts with ./, try resolving relative to source file's directory
		if (!imageFile && propPath.startsWith('./')) {
			const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
			if (sourceFile && sourceFile.parent) {
				// Remove ./ prefix and resolve relative to parent directory
				const relativePath = propPath.substring(2); // Remove ./
				const fullPath = sourceFile.parent.path ? `${sourceFile.parent.path}/${relativePath}` : relativePath;
				const resolvedFile = app.vault.getAbstractFileByPath(fullPath);
				if (resolvedFile instanceof TFile) {
					imageFile = resolvedFile;
				}
			}
		}
		
		// If still not found, try as absolute path
		if (!imageFile) {
			const absoluteFile = app.vault.getAbstractFileByPath(propPath);
			if (absoluteFile instanceof TFile) {
				imageFile = absoluteFile;
			}
		}
		
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
 * Also parses file content for external images in markdown and HTML
 */
export async function extractEmbedImages(
	file: TFile,
	app: App
): Promise<string[]> {
	const validImageExtensions = ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];
	const metadata = app.metadataCache.getFileCache(file);

	const bodyResourcePaths: string[] = [];
	const bodyExternalUrlCandidates: Set<string> = new Set();

	// First pass: check metadata embeds (fast, from cache)
	if (metadata?.embeds) {
		for (const embed of metadata.embeds) {
			const embedLink = embed.link;
			if (isExternalUrl(embedLink)) {
				if (hasValidImageExtension(embedLink) || !embedLink.includes('.')) {
					bodyExternalUrlCandidates.add(embedLink);
				}
			} else {
				const targetFile = app.metadataCache.getFirstLinkpathDest(embedLink, file.path);
				if (targetFile && validImageExtensions.includes(targetFile.extension)) {
					const resourcePath = app.vault.getResourcePath(targetFile);
					bodyResourcePaths.push(resourcePath);
				}
			}
		}
	}

	// Second pass: parse file content for external images (markdown and HTML)
	// This catches external images that might not be in metadata.embeds
	if (file.extension === 'md') {
		try {
			const content = await app.vault.cachedRead(file);
			
			// Extract markdown image syntax: ![alt](url) or ![alt](url "title")
			const markdownImageRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s\)]+)/gi;
			let match;
			while ((match = markdownImageRegex.exec(content)) !== null) {
				const url = match[2].trim();
				// Remove trailing quotes, parentheses, or whitespace that might be part of title
				const cleanUrl = url.replace(/["')\s]+$/, '');
				if (isExternalUrl(cleanUrl) && (hasValidImageExtension(cleanUrl) || !cleanUrl.includes('.'))) {
					bodyExternalUrlCandidates.add(cleanUrl);
				}
			}

			// Extract HTML img tags: <img src="url"> or <img src='url'> or <img src=url>
			const htmlImgRegex = /<img[^>]+src\s*=\s*["']?(https?:\/\/[^\s"'<>]+)/gi;
			while ((match = htmlImgRegex.exec(content)) !== null) {
				const url = match[1].trim();
				// Remove trailing quotes or whitespace
				const cleanUrl = url.replace(/["'\s>]+$/, '');
				if (isExternalUrl(cleanUrl) && (hasValidImageExtension(cleanUrl) || !cleanUrl.includes('.'))) {
					bodyExternalUrlCandidates.add(cleanUrl);
				}
			}
		} catch (error) {
			// If file read fails, just continue with what we found in metadata
			console.warn(`Failed to read file content for image extraction: ${file.path}`, error);
		}
	}

	// Third pass: validate external URLs in parallel (much faster)
	const externalUrlArray = Array.from(bodyExternalUrlCandidates);
	const validationPromises = externalUrlArray.map(url => 
		validateImageUrl(url).then(isValid => isValid ? url : null)
	);
	const validatedUrls = await Promise.all(validationPromises);
	const bodyExternalUrls = validatedUrls.filter((url): url is string => url !== null);

	return [...bodyResourcePaths, ...bodyExternalUrls];
}

/**
 * Check if a URL points to a GIF image
 */
export function isGifUrl(url: string): boolean {
	// Check for .gif extension (case-insensitive)
	// Match .gif at the end of the path, optionally followed by query string or fragment
	return /\.gif(\?|#|$)/i.test(url) || /\.gif$/i.test(url);
}

/**
 * Convert an animated GIF to a static image (first frame)
 * Returns a data URL of the first frame, or the original URL if conversion fails
 */
export async function convertGifToStatic(
	url: string,
	forceStatic: boolean
): Promise<string> {
	// If not forcing static or not a GIF, return original URL
	if (!forceStatic || !isGifUrl(url)) {
		return url;
	}

	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous'; // Handle CORS if needed
		
		img.onload = () => {
			try {
				// Create canvas and draw first frame
				const canvas = document.createElement('canvas');
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext('2d');
				
				if (ctx) {
					ctx.drawImage(img, 0, 0);
					// Convert to PNG data URL
					const dataUrl = canvas.toDataURL('image/png');
					resolve(dataUrl);
				} else {
					// Canvas context not available, return original
					resolve(url);
				}
			} catch (error) {
				console.warn('Failed to convert GIF to static image:', error);
				// On error, return original URL
				resolve(url);
			}
		};
		
		img.onerror = () => {
			// If image fails to load, return original URL
			resolve(url);
		};
		
		// Set timeout to prevent hanging
		setTimeout(() => {
			resolve(url);
		}, 5000);
		
		img.src = url;
	});
}

