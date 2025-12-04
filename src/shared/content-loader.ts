/**
 * Content loading utilities
 * Handles loading images and snippets for entries
 * Optimized for performance with parallel loading and caching
 */

import type { App, TFile } from 'obsidian';
import { processImagePaths, resolveInternalImagePaths, extractEmbedImages } from '../utils/image';
import { loadFilePreview } from '../utils/preview';

/**
 * Loads images for an entry
 * Handles property images, fallback to embeds, and caching
 * Based on Dynamic Views' fast parallel loading approach
 *
 * @param path - File path for the entry
 * @param file - TFile object
 * @param app - Obsidian app instance
 * @param imagePropertyValues - Array of image property values
 * @param fallbackToEmbeds - Whether to extract embedded images if no property images ('always' | 'if-empty' | 'never' | boolean for legacy)
 * @param imageCache - Cache object to store loaded images
 * @param hasImageCache - Cache object to track image availability
 */
export async function loadImageForEntry(
	path: string,
	file: TFile,
	app: App,
	imagePropertyValues: unknown[],
	fallbackToEmbeds: boolean | 'always' | 'if-empty' | 'never',
	imageCache: Record<string, string | string[]>,
	hasImageCache: Record<string, boolean>
): Promise<void> {
	// Check if image property has any values at all (even if they fail to resolve)
	const hasPropertyValues = imagePropertyValues && Array.isArray(imagePropertyValues) && imagePropertyValues.length > 0;
	
	// Convert fallbackToEmbeds to boolean for logic
	const shouldFallback = fallbackToEmbeds === true || fallbackToEmbeds === 'always' || 
		(fallbackToEmbeds === 'if-empty' && !hasPropertyValues);
	
	// If fallback is disabled and we have cached images, clear them to force re-evaluation
	// This ensures cached embed images are removed when setting is turned off
	if (!shouldFallback && path in imageCache) {
		delete imageCache[path];
		delete hasImageCache[path];
	}
	
	// If already in cache and no property values, skip (only if fallback is enabled)
	if (path in imageCache && !hasPropertyValues && shouldFallback) {
		return;
	}

	try {
		// Process and validate image paths using shared utility
		const { internalPaths, externalUrls } = await processImagePaths(imagePropertyValues as string[]);

		// Convert internal paths to resource URLs using shared utility
		let validImages: string[] = [
			...resolveInternalImagePaths(internalPaths, path, app),
			...externalUrls  // External URLs already validated by processImagePaths
		];

		// Only fall back to embed images if:
		// 1. No property values were set at all (not when they exist but fail to resolve)
		// 2. No valid images were found from property
		// 3. Fallback is enabled
		if (validImages.length === 0 && !hasPropertyValues && shouldFallback) {
			validImages = await extractEmbedImages(file, app);
		}

		if (validImages.length > 0) {
			// Store as array if multiple, string if single
			// This will overwrite any cached embed images if property images are found
			imageCache[path] = validImages.length > 1 ? validImages : validImages[0];
			hasImageCache[path] = true;
		} else if (hasPropertyValues) {
			// If property values exist but failed to resolve, mark as attempted
			// This prevents embed images from being loaded later
			// Also clear any cached embed images
			delete imageCache[path];
			hasImageCache[path] = true;
		} else if (!shouldFallback) {
			// If fallback is disabled and no property images, clear cache
			delete imageCache[path];
			delete hasImageCache[path];
		}
	} catch (error) {
		console.error(`Failed to load image for ${path}:`, error);
	}
}

/**
 * Loads images for multiple entries in parallel batches
 * Uses batching to avoid overwhelming the browser with too many concurrent requests
 * Based on Dynamic Views' approach but with batching for large datasets
 *
 * @param entries - Array of entries with path, file, and imagePropertyValues
 * @param fallbackToEmbeds - Whether to extract embedded images if no property images
 * @param app - Obsidian app instance
 * @param imageCache - Cache object to store loaded images
 * @param hasImageCache - Cache object to track image availability
 */
export async function loadImagesForEntries(
	entries: Array<{
		path: string;
		file: TFile;
		imagePropertyValues: unknown[];
	}>,
	fallbackToEmbeds: boolean | 'always' | 'if-empty' | 'never',
	app: App,
	imageCache: Record<string, string | string[]>,
	hasImageCache: Record<string, boolean>
): Promise<void> {
	// Filter entries: only skip if cached AND no property values exist
	// If property values exist, we MUST re-evaluate to ensure property images take priority
	const entriesToProcess = entries.filter(entry => {
		const hasPropertyValues = entry.imagePropertyValues && Array.isArray(entry.imagePropertyValues) && entry.imagePropertyValues.length > 0;
		// Process if: not cached, OR has property values (to ensure property images override cached embeds)
		return !(entry.path in imageCache) || hasPropertyValues;
	});
	
	// Batch size: process 50 images at a time to avoid overwhelming the browser
	// This balances performance (parallel loading) with browser limits
	const BATCH_SIZE = 50;
	
	// Process in batches
	for (let i = 0; i < entriesToProcess.length; i += BATCH_SIZE) {
		const batch = entriesToProcess.slice(i, i + BATCH_SIZE);
		
		// Load batch in parallel
		await Promise.all(
			batch.map(async (entry) => {
				await loadImageForEntry(
					entry.path,
					entry.file,
					app,
					entry.imagePropertyValues,
					fallbackToEmbeds,
					imageCache,
					hasImageCache
				);
			})
		);
	}
}

/**
 * Loads images for multiple entries synchronously (fast path)
 * Resolves image file references immediately for instant rendering
 * Uses parallel loading like Dynamic Views for better performance
 * 
 * @deprecated Use loadImagesForEntries instead - it's faster with parallel loading
 */
export async function loadImagesForEntriesSync(
	entries: Array<{
		path: string;
		file: TFile;
		imagePropertyValues: unknown[];
	}>,
	fallbackToEmbeds: boolean | 'always' | 'if-empty' | 'never',
	app: App,
	imageCache: Record<string, string | string[]>,
	hasImageCache: Record<string, boolean>
): Promise<void> {
	// Use the parallel loading approach for better performance
	await loadImagesForEntries(entries, fallbackToEmbeds, app, imageCache, hasImageCache);
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

