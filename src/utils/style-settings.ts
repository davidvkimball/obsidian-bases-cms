/**
 * Utility functions to read Style Settings values from CSS variables and body classes
 * Based on Dynamic Views style-settings.ts
 */

/**
 * Read a CSS variable value from the document body
 */
function getCSSVariable(name: string, defaultValue: string): string {
	const value = getComputedStyle(document.body).getPropertyValue(name).trim();
	return value || defaultValue;
}

/**
 * Parse a CSS variable as a number (removing units like 'px')
 */
function getCSSVariableAsNumber(name: string, defaultValue: number): number {
	const value = getCSSVariable(name, "");
	if (!value) return defaultValue;
	const parsed = parseFloat(value);
	return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Check if body has a specific class
 */
function hasBodyClass(className: string): boolean {
	return document.body.classList.contains(className);
}

/**
 * Get minimum grid columns from CSS variable
 */
export function getMinGridColumns(): number {
	return getCSSVariableAsNumber("--bases-cms-min-grid-columns", 1);
}

/**
 * Get card spacing from CSS variable
 */
export function getCardSpacing(): number {
	return getCSSVariableAsNumber("--bases-cms-card-spacing", 8);
}

/**
 * Get card padding container from CSS variable
 */
export function getCardPaddingContainer(): number {
	return getCSSVariableAsNumber("--bases-cms-card-padding-container", 12);
}

/**
 * Get card element spacing from CSS variable
 */
export function getElementSpacing(): number {
	return getCSSVariableAsNumber("--bases-cms-element-spacing", 8);
}

/**
 * Get card padding from CSS variable
 */
export function getCardPadding(): number {
	return getCSSVariableAsNumber("--bases-cms-card-padding", 12);
}

/**
 * Get card border radius from CSS variable
 */
export function getCardBorderRadius(): number {
	return getCSSVariableAsNumber("--bases-cms-card-border-radius", 8);
}

/**
 * Check if card background is enabled
 */
export function hasCardBackground(): boolean {
	return hasBodyClass("bases-cms-card-background");
}


/**
 * Get list separator from CSS variable
 * Returns the separator for list-type properties
 */
export function getListSeparator(): string {
	// Read without trim to preserve whitespace
	let value = getComputedStyle(document.body).getPropertyValue(
		"--bases-cms-list-separator",
	);

	// Strip surrounding quotes if present (Style Settings or CSS default adds them)
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		value = value.slice(1, -1);
	}

	// Fallback to default if empty (Style Settings shows placeholder but doesn't set variable)
	return value || ", ";
}

/**
 * Get empty value marker from CSS variable
 * Returns the symbol for empty property values
 */
export function getEmptyValueMarker(): string {
	// Read without trim to preserve whitespace
	let value = getComputedStyle(document.body).getPropertyValue(
		"--bases-cms-empty-value-marker",
	);

	// Strip surrounding quotes if present (Style Settings or CSS default adds them)
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		value = value.slice(1, -1);
	}

	// Fallback to default if empty (Style Settings shows placeholder but doesn't set variable)
	return value || "—";
}

/**
 * Check if missing properties should be hidden
 * Returns true if properties that don't exist on a file should not be displayed
 */
export function shouldHideMissingProperties(): boolean {
	return hasBodyClass("bases-cms-hide-missing-properties");
}

/**
 * Check if empty properties should be hidden
 * Returns true if properties with empty values should not be displayed
 */
export function shouldHideEmptyProperties(): boolean {
	// Check both the body class and also check if the CSS variable is set (as a fallback)
	const hasClass = hasBodyClass("bases-cms-hide-empty-properties");
	if (hasClass) return true;
	
	// Fallback: check if the setting is enabled via CSS variable or other means
	// This ensures we catch the setting even if the class isn't applied yet
	return false;
}

/**
 * Get tag style from body class
 */
export function getTagStyle(): "plain" | "theme" | "minimal" {
	if (hasBodyClass("bases-cms-tag-style-minimal")) return "minimal";
	if (hasBodyClass("bases-cms-tag-style-theme")) return "theme";
	return "plain";
}

/**
 * Check if tag hash (#) prefix should be shown
 */
export function showTagHashPrefix(): boolean {
	return hasBodyClass("bases-cms-show-tag-hash");
}

/**
 * Type for Style Settings color cache
 */
export interface StyleSettingsColorCache {
	titleColor?: { light?: string; dark?: string };
	snippetColor?: { light?: string; dark?: string };
	tagsColor?: { light?: string; dark?: string };
	timestampColor?: { light?: string; dark?: string };
	metadataColor?: { light?: string; dark?: string };
}

/**
 * Apply custom colors from Style Settings to a card element
 * Used for ambient card backgrounds to apply themed text colors
 * @param cardEl - Card element to apply colors to
 * @param theme - 'light' or 'dark' theme based on ambient color
 * @param cache - Style Settings color cache with custom colors
 */
export function applyCustomColors(
	cardEl: HTMLElement,
	theme: "light" | "dark",
	cache: StyleSettingsColorCache,
): void {
	if (cache.titleColor?.[theme]) {
		cardEl.style.setProperty(
			"--bases-cms-title-color",
			cache.titleColor[theme] || null,
		);
	}
	if (cache.snippetColor?.[theme]) {
		cardEl.style.setProperty(
			"--bases-cms-snippet-color",
			cache.snippetColor[theme] || null,
		);
	}
	if (cache.tagsColor?.[theme]) {
		cardEl.style.setProperty(
			"--bases-cms-tags-color",
			cache.tagsColor[theme] || null,
		);
	}
	if (cache.timestampColor?.[theme]) {
		cardEl.style.setProperty(
			"--bases-cms-timestamp-color",
			cache.timestampColor[theme] || null,
		);
	}
	if (cache.metadataColor?.[theme]) {
		cardEl.style.setProperty(
			"--bases-cms-metadata-color",
			cache.metadataColor[theme] || null,
		);
	}
}

