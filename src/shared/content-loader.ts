/**
 * Content loading utilities
 * Handles loading images and snippets for entries
 */

import type { App, TFile } from 'obsidian';
import { processImagePaths, resolveInternalImagePaths, extractEmbedImages } from '../utils/image';
import { loadFilePreview } from '../utils/preview';
import { generateThumbnail, generateThumbnailFromUrl, type ThumbnailCacheSize, calculateThumbnailSize } from '../utils/thumbnail';

/**
 * Loads images for multiple entries synchronously (fast path)
 * Resolves image file references immediately for instant rendering
 * Generates thumbnails based on cache size setting for better performance
 */
export async function loadImagesForEntriesSync(
	entries: Array<{
		path: string;
		file: TFile;
		imagePropertyValues: unknown[];
	}>,
	fallbackToEmbeds: boolean,
	app: App,
	imageCache: Record<string, string | string[]>,
	hasImageCache: Record<string, boolean>,
	thumbnailCacheSize: ThumbnailCacheSize = 'balanced',
	cardSize?: number,
	imageFormat?: 'none' | 'thumbnail' | 'cover'
): Promise<void> {
	for (const entry of entries) {
		// Skip if already in cache
		if (entry.path in imageCache) {
			continue;
		}

		try {
			// Process image paths synchronously (no validation for performance)
			const { internalPaths, externalUrls } = processImagePaths(entry.imagePropertyValues as string[]);

			// Resolve internal paths to TFile references first, then convert to resource URLs
			const validImageFiles: TFile[] = [];
			const validImageExtensions = ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];
			
			for (const propPath of internalPaths) {
				const imageFile = app.metadataCache.getFirstLinkpathDest(propPath, entry.path);
				if (imageFile && validImageExtensions.includes(imageFile.extension)) {
					validImageFiles.push(imageFile);
				}
			}

			// Generate thumbnails for better performance (unless unlimited)
			const thumbnailPromises: Promise<string | null>[] = [];
			
			// Calculate thumbnail size based on card size and image format
			const thumbnailSize = (cardSize !== undefined && imageFormat !== undefined)
				? calculateThumbnailSize(cardSize, imageFormat, thumbnailCacheSize)
				: undefined;
			
			// Generate thumbnails for internal images
			for (const imageFile of validImageFiles) {
				thumbnailPromises.push(generateThumbnail(imageFile, app, thumbnailCacheSize, thumbnailSize));
			}
			
			// Generate thumbnails for external URLs
			for (const externalUrl of externalUrls) {
				thumbnailPromises.push(generateThumbnailFromUrl(externalUrl, thumbnailCacheSize, thumbnailSize));
			}
			
			// Wait for all thumbnails to be generated
			const thumbnails = await Promise.all(thumbnailPromises);
			const validThumbnails = thumbnails.filter((thumb): thumb is string => thumb !== null);

			if (validThumbnails.length > 0) {
				// Store thumbnails as data URLs (served from memory cache like Bases)
				imageCache[entry.path] = validThumbnails.length > 1 ? validThumbnails : validThumbnails[0];
				hasImageCache[entry.path] = true;
			} else if (fallbackToEmbeds) {
				// Mark for async embed extraction (don't block rendering)
				hasImageCache[entry.path] = false;
			}
		} catch (error) {
			console.error(`Failed to load image for ${entry.path}:`, error);
		}
	}
}

/**
 * Loads embed images asynchronously (fallback only)
 * Called in background after initial render for entries without property images
 */
export async function loadEmbedImagesForEntries(
	entries: Array<{
		path: string;
		file: TFile;
	}>,
	app: App,
	imageCache: Record<string, string | string[]>,
	hasImageCache: Record<string, boolean>
): Promise<void> {
	await Promise.all(
		entries.map(async (entry) => {
			// Only process entries that don't have images yet
			if (entry.path in imageCache || hasImageCache[entry.path]) {
				return;
			}

			try {
				const validImages = await extractEmbedImages(entry.file, app);
				if (validImages.length > 0) {
					imageCache[entry.path] = validImages.length > 1 ? validImages : validImages[0];
					hasImageCache[entry.path] = true;
				}
			} catch (error) {
				console.error(`Failed to load embed images for ${entry.path}:`, error);
			}
		})
	);
}

/**
 * Loads snippets for multiple entries in parallel
 */
export async function loadSnippetsForEntries(
	entries: Array<{
		path: string;
		file: TFile;
		descriptionData: unknown;
		fileName?: string;
		titleString?: string;
	}>,
	fallbackToContent: boolean,
	omitFirstLine: boolean,
	app: App,
	snippetCache: Record<string, string>
): Promise<void> {
	await Promise.all(
		entries.map(async (entry) => {
			// Skip if already in cache
			if (entry.path in snippetCache) {
				return;
			}

			try {
				if (entry.file.extension === 'md') {
					snippetCache[entry.path] = await loadFilePreview(
						entry.file,
						app,
						entry.descriptionData,
						{
							fallbackToContent,
							omitFirstLine
						},
						entry.fileName,
						entry.titleString
					);
				} else {
					snippetCache[entry.path] = '';
				}
			} catch (error) {
				console.error(`Failed to load snippet for ${entry.path}:`, error);
				snippetCache[entry.path] = '';
			}
		})
	);
}

