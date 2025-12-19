import { QueryController } from 'obsidian';
import type BasesCMSPlugin from '../main';
import { BasesCMSView, CMS_VIEW_TYPE } from '../views/cms-view';

/**
 * Register the CMS view with the Bases plugin
 * Handles graceful degradation if Bases plugin is not installed
 * Includes retry logic for mobile where Bases plugin may load later
 */
export function registerBasesCMSView(plugin: BasesCMSPlugin, retries = 5): void {
	try {
		const basesPlugin = plugin as { registerBasesView?: (type: string, config: { name: string; icon: string; factory: (controller: QueryController, containerEl: HTMLElement) => BasesCMSView; options: () => unknown[] }) => void };
		if (typeof basesPlugin.registerBasesView === 'function') {
			basesPlugin.registerBasesView(CMS_VIEW_TYPE, {
				name: 'CMS',
				icon: plugin.settings.useHomeIcon ? 'lucide-home' : 'lucide-blocks',
				factory: (controller: QueryController, containerEl: HTMLElement) => {
					const view = new BasesCMSView(controller, containerEl, plugin);
					// Add view to plugin's active views tracking
					const pluginWithViews = plugin as { activeViews?: Set<BasesCMSView> };
					if (pluginWithViews.activeViews) {
						pluginWithViews.activeViews.add(view);
					}
					return view;
				},
				options: getCMSViewOptions()
			});
		} else if (retries > 0) {
			// Method not available yet, retry after a short delay (common on mobile)
			// Clear any existing timeout before setting a new one
			const pluginWithTimeout = plugin as { registrationTimeout?: number | null };
			const registrationTimeout = pluginWithTimeout.registrationTimeout;
			if (registrationTimeout !== null && registrationTimeout !== undefined) {
				window.clearTimeout(registrationTimeout);
			}
			pluginWithTimeout.registrationTimeout = window.setTimeout(() => {
				pluginWithTimeout.registrationTimeout = null;
				registerBasesCMSView(plugin, retries - 1);
			}, 200);
		} else {
			console.warn('Bases CMS: registerBasesView not available. Is Bases plugin installed?');
		}
	} catch (error) {
		console.error('Bases CMS: Error registering view:', error);
	}
}

/**
 * Get CMS view options for Base plugin configuration
 */
function getCMSViewOptions(): () => unknown[] {
	// Dynamic import to avoid circular dependency
	// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- Need dynamic import for circular dependency
	const { getCMSViewOptions } = require('../shared/settings-schema') as { getCMSViewOptions: () => unknown[] };
	return getCMSViewOptions;
}

