/**
 * Preview and snippet utilities
 * Extracts and sanitizes content for card previews
 */

import { App, TFile } from 'obsidian';

const markdownPatterns = [
	/`([^`]+)`/g,
	/\*\*\*((?:(?!\*\*\*).)+)\*\*\*/g,
	/___((?:(?!___).)+)___/g,
	/\*\*((?:(?!\*\*).)+)\*\*/g,
	/__((?:(?!__).)+)__/g,
	/\*((?:(?!\*).)+)\*/g,
	/_((?:(?!_).)+)_/g,
	/~~((?:(?!~~).)+)~~/g,
	/==((?:(?!==).)+)==/g,
	/\[([^\]]+)\]\([^)]+\)/g,
	/!\[\[[^\]]+\]\]/g,
	/\[\[[^\]|]+\|[^\]]+\]\]/g,
	/\[\[[^\]]+\]\]/g,
	/#[a-zA-Z0-9_\-/]+/g,
	/^[-*+]\s*\[[ xX]\]\s+/gm,
	/^(\d+\.\s*)\[[ xX]\]\s+/gm,
	/^(\d+\)\s*)\[[ xX]\]\s+/gm,
	/^[-*+]\s+/gm,
	/^#{1,6}\s+.+$/gm,
	/^\s*(?:[-_*])\s*(?:[-_*])\s*(?:[-_*])[\s\-_*]*$/gm,
	/^\s*\|.*\|.*$/gm,
	/\^\[[^\]]*?]/g,
	/\[\^[^\]]+]/g,
	/^\s*\[\^[^\]]+]:.*$/gm,
	/<([a-z][a-z0-9]*)\b[^>]*>(.*?)<\/\1>/gi,
	/<[^>]+>/g
];

function protectEscapedChars(text: string): { text: string; map: Map<string, string> } {
	const map = new Map<string, string>();
	let counter = 0;
	const result = text.replace(/\\(.)/g, (match: string, char: string) => {
		const placeholder = `§§ESCAPED${counter}§§`;
		map.set(placeholder, char);
		counter++;
		return placeholder;
	});
	return { text: result, map };
}

function restoreEscapedChars(text: string, map: Map<string, string>): string {
	let result = text;
	map.forEach((char, placeholder) => {
		result = result.split(placeholder).join(char);
	});
	return result;
}

function removeCodeBlocks(text: string): string {
	let result = text;
	let changed = true;
	while (changed) {
		changed = false;
		const openMatch = result.match(/^([`~]{3,})/m);
		if (!openMatch) break;
		const fenceChar = openMatch[1][0];
		const fenceLength = openMatch[1].length;
		const openIndex = openMatch.index!;
		const escapedChar = fenceChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const closePattern = new RegExp(`^${escapedChar}{${fenceLength}}\\s*$`, 'm');
		const afterOpen = result.substring(openIndex + openMatch[1].length);
		const closeMatch = afterOpen.match(closePattern);
		if (closeMatch) {
			const closeIndex = openIndex + openMatch[1].length + closeMatch.index!;
			const blockEnd = closeIndex + closeMatch[0].length;
			result = result.substring(0, openIndex) + result.substring(blockEnd);
			changed = true;
		} else {
			const lineEnd = result.indexOf('\n', openIndex);
			if (lineEnd === -1) {
				result = result.substring(0, openIndex);
			} else {
				result = result.substring(0, openIndex) + result.substring(lineEnd + 1);
			}
			changed = true;
		}
	}
	return result;
}

function stripMarkdownSyntax(text: string): string {
	if (!text || text.trim().length === 0) return '';
	text = text.replace(/^>\s*\[![\w-]+\][+-]?.*$/gm, '');
	text = text.replace(/^>\s?/gm, '');
	const { text: protectedText, map: escapedCharsMap } = protectEscapedChars(text);
	let result = removeCodeBlocks(protectedText);
	markdownPatterns.forEach((pattern) => {
		result = result.replace(pattern, (match: string, ...groups: string[]) => {
			if (match.match(/<[a-z][a-z0-9]*\b[^>]*>.*?<\//i)) {
				return groups[1] || '';
			}
			if (groups.length > 0 && groups[0] !== undefined) {
				for (let i = 0; i < groups.length - 2; i++) {
					if (typeof groups[i] === 'string') {
						return groups[i];
					}
				}
			}
			return '';
		});
	});
	result = restoreEscapedChars(result, escapedCharsMap);
	return result;
}

export function sanitizeForPreview(
	content: string,
	omitFirstLine: boolean = false,
	filename?: string,
	titleValue?: string
): string {
	const cleaned = content.replace(/^---[\s\S]*?---/, "").trim();
	let stripped = stripMarkdownSyntax(cleaned);
	const firstLineEnd = stripped.indexOf('\n');
	const firstLine = (firstLineEnd !== -1 ? stripped.substring(0, firstLineEnd) : stripped).trim();
	if (omitFirstLine ||
		(filename && firstLine === filename) ||
		(titleValue && firstLine === titleValue)) {
		stripped = firstLineEnd !== -1 ? stripped.substring(firstLineEnd + 1).trim() : '';
	}
	const normalized = stripped
		.replace(/\^[a-zA-Z0-9-]+/g, '')
		.split(/\s+/)
		.filter(word => word)
		.join(' ')
		.trim()
		.replace(/\.{2,}/g, match => match.replace(/\./g, '\u2024'));
	const wasTruncated = normalized.length > 500;
	let preview = normalized.substring(0, 500);
	if (wasTruncated) {
		preview += '…';
	}
	return preview;
}

export async function loadFilePreview(
	file: TFile,
	app: App,
	propertyValue: unknown,
	settings: {
		fallbackToContent: boolean;
		omitFirstLine: boolean;
		truncatePreviewProperty?: boolean;
	},
	fileName?: string,
	titleValue?: string
): Promise<string> {
	// Handle arrays (e.g., aliases, tags) by joining them
	let result: string | null = null;
	
	if (propertyValue != null) {
		if (Array.isArray(propertyValue)) {
			// Join array items into a string
			const items = propertyValue.map((item: unknown) => {
				if (item && typeof item === 'object' && 'data' in item) {
					return String((item as { data: unknown }).data);
				}
				return String(item);
			}).filter((s: string) => s.trim().length > 0);
			result = items.length > 0 ? items.join(', ') : null;
		} else if (typeof propertyValue === 'string' || typeof propertyValue === 'number') {
			const str = String(propertyValue).trim();
			result = str.length > 0 ? str : null;
		}
	}

	if (result) {
		// Truncate if setting is enabled
		if (settings.truncatePreviewProperty) {
			const wasTruncated = result.length > 500;
			result = result.substring(0, 500);
			if (wasTruncated) {
				result += '…';
			}
		}
		return result;
	}

	if (settings.fallbackToContent) {
		const content = await app.vault.cachedRead(file);
		return sanitizeForPreview(
			content,
			settings.omitFirstLine,
			fileName,
			titleValue
		);
	}

	return '';
}

