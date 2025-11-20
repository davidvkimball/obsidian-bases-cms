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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (typeof (plugin as any).registerBasesView === 'function') {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(plugin as any).registerBasesView(CMS_VIEW_TYPE, {
				name: 'CMS',
				icon: plugin.settings.useHomeIcon ? 'lucide-home' : 'lucide-blocks',
				factory: (controller: QueryController, containerEl: HTMLElement) => {
					const view = new BasesCMSView(controller, containerEl, plugin);
					// Add view to plugin's active views tracking
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(plugin as any).activeViews.add(view);
					return view;
				},
				options: getCMSViewOptions()
			});
		} else if (retries > 0) {
			// Method not available yet, retry after a short delay (common on mobile)
			// Clear any existing timeout before setting a new one
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const registrationTimeout = (plugin as any).registrationTimeout;
			if (registrationTimeout !== null) {
				window.clearTimeout(registrationTimeout);
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(plugin as any).registrationTimeout = window.setTimeout(() => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(plugin as any).registrationTimeout = null;
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
function getCMSViewOptions(): () => any[] {
	const { getCMSViewOptions } = require('../shared/settings-schema');
	return getCMSViewOptions;
}

