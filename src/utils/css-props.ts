/**
 * Utility function to set CSS properties on an element
 * Replaces the non-existent setCssProps from obsidian
 */

/**
 * Sets CSS properties on an element from an object
 * @param element - The element to apply styles to (HTMLElement or SVGElement)
 * @param props - Object with CSS properties in camelCase or kebab-case
 */
export function setCssProps(element: HTMLElement | SVGElement, props: Record<string, string | number>): void {
	for (const [key, value] of Object.entries(props)) {
		// CSS custom properties (variables) start with --
		if (key.startsWith('--')) {
			element.style.setProperty(key, String(value));
		} else {
			// Convert camelCase to kebab-case for CSS properties
			const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
			element.style.setProperty(cssKey, String(value));
		}
	}
}
