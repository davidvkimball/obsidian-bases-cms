/**
 * Thumbnail generation utilities
 * Creates optimized thumbnail versions of images for faster loading
 */

import type { App, TFile } from 'obsidian';

export type ThumbnailCacheSize = 'minimal' | 'small' | 'balanced' | 'large' | 'unlimited';

interface ThumbnailSize {
	maxWidth: number;
	maxHeight: number;
	quality: number;
}

const THUMBNAIL_SIZES: Record<ThumbnailCacheSize, ThumbnailSize> = {
	minimal: { maxWidth: 100, maxHeight: 100, quality: 0.6 },
	small: { maxWidth: 200, maxHeight: 200, quality: 0.7 },
	balanced: { maxWidth: 400, maxHeight: 400, quality: 0.8 },
	large: { maxWidth: 800, maxHeight: 800, quality: 0.9 },
	unlimited: { maxWidth: Infinity, maxHeight: Infinity, quality: 1.0 }
};

/**
 * Generate a thumbnail data URL from an image file
 * Uses canvas to resize and compress the image
 */
export async function generateThumbnail(
	imageFile: TFile,
	app: App,
	cacheSize: ThumbnailCacheSize
): Promise<string | null> {
	try {
		// For unlimited, just return the resource path (no thumbnail needed)
		if (cacheSize === 'unlimited') {
			return app.vault.getResourcePath(imageFile);
		}

		const size = THUMBNAIL_SIZES[cacheSize];
		
		// Load the image file
		const arrayBuffer = await app.vault.readBinary(imageFile);
		const blob = new Blob([arrayBuffer]);
		const imageUrl = URL.createObjectURL(blob);

		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				try {
					// Calculate new dimensions maintaining aspect ratio
					let width = img.width;
					let height = img.height;
					
					if (width > size.maxWidth || height > size.maxHeight) {
						const aspectRatio = width / height;
						if (width > height) {
							width = Math.min(width, size.maxWidth);
							height = width / aspectRatio;
						} else {
							height = Math.min(height, size.maxHeight);
							width = height * aspectRatio;
						}
					}

					// Create canvas and resize
					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext('2d');
					
					if (!ctx) {
						URL.revokeObjectURL(imageUrl);
						resolve(null);
						return;
					}

					// Draw resized image
					ctx.drawImage(img, 0, 0, width, height);

					// Convert to data URL with quality setting
					const dataUrl = canvas.toDataURL('image/jpeg', size.quality);
					
					// Clean up
					URL.revokeObjectURL(imageUrl);
					
					resolve(dataUrl);
				} catch (error) {
					URL.revokeObjectURL(imageUrl);
					reject(error);
				}
			};
			
			img.onerror = () => {
				URL.revokeObjectURL(imageUrl);
				resolve(null);
			};
			
			img.src = imageUrl;
		});
	} catch (error) {
		console.error(`Failed to generate thumbnail for ${imageFile.path}:`, error);
		return null;
	}
}

/**
 * Generate thumbnail for external URL
 */
export async function generateThumbnailFromUrl(
	url: string,
	cacheSize: ThumbnailCacheSize
): Promise<string | null> {
	try {
		// For unlimited, just return the URL
		if (cacheSize === 'unlimited') {
			return url;
		}

		const size = THUMBNAIL_SIZES[cacheSize];

		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			
			img.onload = () => {
				try {
					// Calculate new dimensions maintaining aspect ratio
					let width = img.width;
					let height = img.height;
					
					if (width > size.maxWidth || height > size.maxHeight) {
						const aspectRatio = width / height;
						if (width > height) {
							width = Math.min(width, size.maxWidth);
							height = width / aspectRatio;
						} else {
							height = Math.min(height, size.maxHeight);
							width = height * aspectRatio;
						}
					}

					// Create canvas and resize
					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext('2d');
					
					if (!ctx) {
						resolve(null);
						return;
					}

					// Draw resized image
					ctx.drawImage(img, 0, 0, width, height);

					// Convert to data URL with quality setting
					const dataUrl = canvas.toDataURL('image/jpeg', size.quality);
					
					resolve(dataUrl);
				} catch (error) {
					reject(error);
				}
			};
			
			img.onerror = () => {
				resolve(null);
			};
			
			img.src = url;
		});
	} catch (error) {
		console.error(`Failed to generate thumbnail from URL ${url}:`, error);
		return null;
	}
}

