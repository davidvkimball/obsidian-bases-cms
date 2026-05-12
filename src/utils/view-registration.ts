import { QueryController } from 'obsidian';
import type BasesCMSPlugin from '../main';
import { BasesCMSView, CMS_VIEW_TYPE } from '../views/cms-view';
import { BasesTitlesView, TITLES_VIEW_TYPE } from '../views/titles-view';

/**
 * Register the CMS view with the Bases plugin
 * Handles graceful degradation if Bases plugin is not installed
 * Includes retry logic for mobile where Bases plugin may load later
 */
export function registerBasesCMSView(plugin: BasesCMSPlugin, retries = 5): void {
	try {
		// Use the plugin instance itself for registration.
		// The Bases plugin likely monkey-patches this onto the Plugin prototype.
		const basesPlugin = plugin as any;

		if (typeof basesPlugin.registerBasesView === 'function') {
			const viewOptionsFn = getCMSViewOptions();
			const viewConfig = {
				name: 'CMS',
				icon: plugin.settings.useHomeIcon ? 'lucide-home' : 'lucide-blocks',
				factory: (controller: QueryController, containerEl: HTMLElement) => {
					const view = new BasesCMSView(controller, containerEl, plugin);
					// Add view to plugin's active views tracking
					const pluginWithViews = plugin as { activeViews?: Set<BasesCMSView> };
					if (pluginWithViews.activeViews) {
						pluginWithViews.activeViews.add(view);
					}

					// If this is an embedded view, schedule an initial refresh with retry logic
					// This ensures embedded views populate immediately when first added to a note
					if (view.isEmbedded) {
						// Retry logic: try multiple times with increasing delays until data is ready
						let retryCount = 0;
						const maxRetries = 8; // Try up to 8 times over ~1.5 seconds
						const baseDelay = 250; // Start with 250ms, increase by 100ms each retry

						const tryRefresh = () => {
							try {
								const containerEl = (view as unknown as { containerEl?: HTMLElement }).containerEl;
								if (!containerEl || !containerEl.isConnected) {
									return; // View no longer exists, stop retrying
								}

								// Check if data is ready (ensure array is populated, not just an empty structure)
								const viewData = (view as unknown as { data?: { data?: unknown[]; groupedData?: unknown[] } }).data;
								const hasData = viewData && Array.isArray(viewData.data) && viewData.data.length > 0 && viewData.groupedData;

								// Always trigger onDataUpdated() - it has its own retry logic if data isn't ready
								// This ensures the Bases plugin re-evaluates filters with current active file context
								if (typeof (view as { onDataUpdated?: () => void }).onDataUpdated === 'function') {
									(view as { onDataUpdated: () => void }).onDataUpdated();
								}

								// If data wasn't ready and we haven't hit max retries, schedule another attempt
								if (!hasData && retryCount < maxRetries) {
									retryCount++;
									const delay = baseDelay + (retryCount * 100); // 250ms, 350ms, 450ms, etc.
									activeWindow.setTimeout(tryRefresh, delay);
								}
							} catch (error) {
								// Silently ignore errors during initial refresh
								console.warn('Bases CMS: Error refreshing newly created embedded view:', error);
							}
						};

						// Start the retry sequence after initial delay
						activeWindow.setTimeout(tryRefresh, baseDelay);
					}

					return view;
				},
				options: () => viewOptionsFn(CMS_VIEW_TYPE)
			};

			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- registerBasesView is monkey-patched onto the plugin instance by the Bases core plugin
			basesPlugin.registerBasesView(CMS_VIEW_TYPE, viewConfig);

			// Register titles view (list of note titles, optional secondary after dash)
			const titlesViewConfig = {
				name: 'Titles',
				icon: 'lucide-type',
				factory: (controller: QueryController, containerEl: HTMLElement) => new BasesTitlesView(controller, containerEl, plugin),
				options: () => [
					{
						type: 'group' as const,
						displayName: 'Title',
						items: [
							{ type: 'property' as const, displayName: 'Title property', key: 'titleProperty', placeholder: 'Select property', default: 'note.title' },
							{ type: 'property' as const, displayName: 'Secondary property (after dash)', key: 'secondaryProperty', placeholder: 'Optional, e.g. date', default: '' }
						]
					}
				]
			};
			basesPlugin.registerBasesView(TITLES_VIEW_TYPE, titlesViewConfig);
		} else if (retries > 0) {
			// Method not available yet, retry after a short delay (common on mobile)
			// Clear any existing timeout before setting a new one
			const pluginWithTimeout = plugin as { registrationTimeout?: number | null };
			const registrationTimeout = pluginWithTimeout.registrationTimeout;
			if (registrationTimeout !== null && registrationTimeout !== undefined) {
				window.clearTimeout(registrationTimeout);
			}
			pluginWithTimeout.registrationTimeout = activeWindow.setTimeout(() => {
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
function getCMSViewOptions(): (viewType?: string) => unknown[] {
	// Dynamic import to avoid circular dependency
	// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- Need dynamic import for circular dependency
	const { getCMSViewOptions } = require('../shared/settings-schema') as { getCMSViewOptions: (viewType?: string) => unknown[] };
	return getCMSViewOptions;
}

