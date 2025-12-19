/**
 * Compatibility utilities for settings
 * Provides backward compatibility for SettingGroup (requires API 1.11.0+)
 */
import { Setting, requireApiVersion } from 'obsidian';

// Type definition for SettingGroup (may not be in type definitions for older versions)
type SettingGroupConstructor = new (containerEl: HTMLElement) => {
	setHeading(heading: string): {
		addSetting(cb: (setting: Setting) => void): void;
	};
};

/**
 * Interface that works with both SettingGroup and fallback container
 */
export interface SettingsContainer {
	addSetting(cb: (setting: Setting) => void): void;
}

/**
 * Creates a settings container that uses SettingGroup if available (API 1.11.0+),
 * otherwise falls back to creating a heading and using the container directly.
 * 
 * Uses requireApiVersion('1.11.0') to check if SettingGroup is available.
 * This is the official Obsidian API method for version checking.
 * 
 * @param containerEl - The container element for settings
 * @param heading - The heading text for the settings group
 * @returns A container that can be used to add settings
 */
export function createSettingsGroup(
	containerEl: HTMLElement,
	heading: string
): SettingsContainer {
	// Check if SettingGroup is available (API 1.11.0+)
	// requireApiVersion is the official Obsidian API method for version checking
	if (requireApiVersion('1.11.0')) {
		// Use SettingGroup - it's guaranteed to exist if requireApiVersion returns true
		// Access SettingGroup from the obsidian module dynamically to avoid type errors
		// We need to use require here because SettingGroup may not be in type definitions for older versions
		// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
		const obsidianModule = require('obsidian') as { SettingGroup?: SettingGroupConstructor };
		const SettingGroup = obsidianModule.SettingGroup;
		if (SettingGroup) {
			const group = new SettingGroup(containerEl).setHeading(heading);
			return {
				addSetting(cb: (setting: Setting) => void) {
					group.addSetting(cb);
				}
			};
		}
		// Fallback if SettingGroup is not found (shouldn't happen if requireApiVersion is correct)
	}
	
	// Fallback: Create a heading manually and use container directly
	const headingEl = containerEl.createDiv('setting-group-heading');
	headingEl.createEl('h3', { text: heading });
	
	return {
		addSetting(cb: (setting: Setting) => void) {
			const setting = new Setting(containerEl);
			cb(setting);
		}
	};
}
