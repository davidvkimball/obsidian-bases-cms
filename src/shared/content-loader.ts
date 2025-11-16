/**
 * Content loading utilities
 * Handles loading images and snippets for entries
 */

import type { App, TFile } from 'obsidian';
import { processImagePaths, resolveInternalImagePaths, extractEmbedImages } from '../utils/image';
import { loadFilePreview } from '../utils/preview';

/**
 * Loads images for multiple entries in parallel
 */
export async function loadImagesForEntries(
	entries: Array<{
		path: string;
		file: TFile;
		imagePropertyValues: unknown[];
	}>,
	fallbackToEmbeds: boolean,
	app: App,
	imageCache: Record<string, string | string[]>,
	hasImageCache: Record<string, boolean>
): Promise<void> {
	await Promise.all(
		entries.map(async (entry) => {
			// Skip if already in cache
			if (entry.path in imageCache) {
				return;
			}

			try {
				// Process and validate image paths
				const { internalPaths, externalUrls } = await processImagePaths(entry.imagePropertyValues as string[]);

				// Convert internal paths to resource URLs
				let validImages: string[] = [
					...resolveInternalImagePaths(internalPaths, entry.path, app),
					...externalUrls
				];

				// If no property images and fallback enabled, extract embed images
				if (validImages.length === 0 && fallbackToEmbeds) {
					validImages = await extractEmbedImages(entry.file, app);
				}

				if (validImages.length > 0) {
					// Store as array if multiple, string if single
					imageCache[entry.path] = validImages.length > 1 ? validImages : validImages[0];
					hasImageCache[entry.path] = true;
				}
			} catch (error) {
				console.error(`Failed to load image for ${entry.path}:`, error);
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

