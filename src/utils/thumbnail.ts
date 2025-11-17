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
 * Calculate appropriate thumbnail size based on card size and image format
 * The thumbnail cache size acts as a maximum cap - thumbnails will scale with card size
 * but never exceed the cache size limit (unless unlimited)
 */
export function calculateThumbnailSize(
	cardSize: number,
	imageFormat: 'none' | 'thumbnail' | 'cover',
	thumbnailCacheSize: ThumbnailCacheSize
): { maxWidth: number; maxHeight: number; quality: number } {
	// If unlimited, return unlimited size
	if (thumbnailCacheSize === 'unlimited') {
		return THUMBNAIL_SIZES.unlimited;
	}

	// Get base size from cache size setting (this acts as a maximum cap)
	const baseSize = THUMBNAIL_SIZES[thumbnailCacheSize];
	
	// For cover images, thumbnail should be at least as wide as the card
	// Add some padding for high DPI displays (2x multiplier)
	// But cap it at the cache size setting
	if (imageFormat === 'cover') {
		const targetWidth = Math.ceil(cardSize * 2); // 2x for retina displays
		return {
			maxWidth: Math.min(targetWidth, baseSize.maxWidth), // Cap at cache size
			maxHeight: Math.min(targetWidth, baseSize.maxHeight), // Cap at cache size
			quality: baseSize.quality
		};
	}
	
	// For thumbnail format, use a percentage of card size (thumbnail is typically smaller)
	// Default thumbnail size in CSS is 80px, but scale with card size
	// But cap it at the cache size setting
	if (imageFormat === 'thumbnail') {
		const thumbnailBaseSize = 80; // Base thumbnail size from CSS
		const scaleFactor = cardSize / 250; // Scale based on default card size of 250
		const targetSize = Math.ceil(thumbnailBaseSize * scaleFactor * 2); // 2x for retina
		return {
			maxWidth: Math.min(targetSize, baseSize.maxWidth), // Cap at cache size
			maxHeight: Math.min(targetSize, baseSize.maxHeight), // Cap at cache size
			quality: baseSize.quality
		};
	}
	
	// Default to base size
	return baseSize;
}

/**
 * Generate a thumbnail data URL from an image file
 * Uses canvas to resize and compress the image
 */
export async function generateThumbnail(
	imageFile: TFile,
	app: App,
	cacheSize: ThumbnailCacheSize,
	customSize?: { maxWidth: number; maxHeight: number; quality: number }
): Promise<string | null> {
	try {
		// For unlimited, just return the resource path (no thumbnail needed)
		if (cacheSize === 'unlimited' && !customSize) {
			return app.vault.getResourcePath(imageFile);
		}

		const size = customSize || THUMBNAIL_SIZES[cacheSize];
		
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
	cacheSize: ThumbnailCacheSize,
	customSize?: { maxWidth: number; maxHeight: number; quality: number }
): Promise<string | null> {
	try {
		// For unlimited, just return the URL
		if (cacheSize === 'unlimited' && !customSize) {
			return url;
		}

		const size = customSize || THUMBNAIL_SIZES[cacheSize];

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

