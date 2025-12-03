/**
 * Interceptor for properties button in CMS views
 * Shows helpful information about how properties work in CMS views
 */

import { App } from 'obsidian';
import { readCMSSettings } from '../shared/settings-schema';
import type { BasesCMSSettings } from '../types';
import { PropertiesInfoModal } from '../components/properties-info-modal';

// Bases config object interface
interface BasesConfig {
	get(key: string): unknown;
}

/**
 * Setup interceptor for properties button clicks
 * Shows a helpful modal explaining how properties work in CMS views
 */
export function setupPropertiesButtonInterceptor(
	app: App,
	containerEl: HTMLElement,
	config: BasesConfig | undefined,
	pluginSettings: BasesCMSSettings,
	plugin: { settings: BasesCMSSettings; saveSettings: () => Promise<void> },
	registerCleanup: (cleanup: () => void) => void
): void {
	// Intercept clicks on the properties button - use capture phase to catch before Bases
	const interceptPropertiesButton = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		
		// Check if this is a programmatic click that should skip interception
		if ((window as unknown as { __cmsSkipPropertiesInterception?: boolean }).__cmsSkipPropertiesInterception) {
			return; // Let Bases handle it normally
		}
		
		// Check if we're in a CMS view first
		const isCMSView = containerEl.classList.contains('bases-cms-container') ||
			containerEl.querySelector('.bases-cms-container') !== null ||
			containerEl.closest('.bases-cms-container') !== null;
		
		if (!isCMSView) {
			return; // Not a CMS view, let Bases handle it normally
		}
		
		// Look for properties button - target the specific class from Bases
		let propertiesButton = target.closest(
			'.bases-toolbar-properties-menu, ' +
			'.bases-toolbar-properties-menu .text-icon-button, ' +
			'.bases-toolbar-properties, ' +
			'.bases-toolbar-properties-item, ' +
			'[aria-label*="properties" i], ' +
			'[aria-label*="Properties" i]'
		);
		
		// Also check if the click is on a button with properties-related icon
		// Properties icon is often "list", "layout-list", "columns", or "layout-grid" in lucide
		if (!propertiesButton) {
			const buttonEl = target.closest('.text-icon-button, .bases-toolbar-item');
			if (buttonEl) {
				const iconEl = buttonEl.querySelector('.text-button-icon, svg');
				if (iconEl) {
					const svg = iconEl.querySelector('svg') || (iconEl.tagName === 'svg' ? iconEl : null);
					if (svg) {
						const lucideIcon = svg.getAttribute('data-lucide');
						// Common properties panel icons
						if (lucideIcon && ['list', 'layout-list', 'columns', 'layout-grid', 'sidebar'].includes(lucideIcon)) {
							propertiesButton = buttonEl as HTMLElement;
						}
					}
				}
			}
		}
		
		// Check if clicked element is within the toolbar and might be properties-related
		if (!propertiesButton) {
			const toolbar = target.closest('.bases-toolbar, .bases-header');
			if (toolbar) {
				// Check if there's a properties button in the toolbar
				const propsButton = toolbar.querySelector(
					'.bases-toolbar-properties, ' +
					'[aria-label*="properties" i], ' +
					'[aria-label*="Properties" i]'
				);
				if (propsButton && (propsButton.contains(target) || target.closest('.bases-toolbar-item') === propsButton)) {
					propertiesButton = propsButton as HTMLElement;
				}
			}
		}
		
		if (!propertiesButton) {
			return; // Not the properties button
		}
		
		// Don't interfere with clicks inside the bulk toolbar or other CMS elements
		if (target.closest('.bases-cms-bulk-toolbar, .bases-cms-container .card, .modal')) {
			return; // Let these clicks work normally
		}
		
		// Check if this view is active - check if the button is within our view's container
		// or if the active leaf contains our container
		// Use activeLeaf for compatibility (deprecated but necessary here)
		const activeLeaf = (app.workspace as unknown as { activeLeaf?: { view?: unknown } }).activeLeaf;
		const activeView = activeLeaf?.view as { containerEl?: HTMLElement } | undefined;
		const activeViewContainer = activeView ? activeView.containerEl : null;
		const isOurView = activeView && activeViewContainer && (
			activeViewContainer === containerEl ||
			propertiesButton?.closest('.workspace-leaf')?.contains(activeViewContainer)
		);
		
		if (!isOurView) {
			return; // Not our view
		}
		
		// Check if user has disabled the modal
		if (!plugin.settings.showPropertiesInfoModal) {
			return; // Let Bases handle it normally
		}
		
		// Prevent default behavior and show our modal
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
		
		// Store the button element so we can trigger it after modal closes
		const buttonToTrigger = propertiesButton.querySelector('.text-icon-button') || propertiesButton;
		
		// Try to get config from the view if it wasn't passed or is undefined
		let effectiveConfig = config;
		if (!effectiveConfig || typeof effectiveConfig.get !== 'function') {
			// Try to get config from the active view
			const activeLeaf = (app.workspace as unknown as { activeLeaf?: { view?: { config?: BasesConfig } } }).activeLeaf;
			const activeView = activeLeaf?.view as { config?: BasesConfig } | undefined;
			if (activeView?.config && typeof activeView.config.get === 'function') {
				effectiveConfig = activeView.config;
			}
		}
		
		// Show the properties info modal (config can be undefined, modal will handle it)
		const modal = new PropertiesInfoModal(app, effectiveConfig, pluginSettings, plugin, buttonToTrigger as HTMLElement);
		modal.open();
	};

	// Add event listener to document with capture phase to intercept before Bases
	document.addEventListener('click', interceptPropertiesButton as EventListener, true);
	
	// Helper function to check if a button is a properties button
	const isPropertiesButton = (buttonEl: Element): boolean => {
		// Check for explicit properties classes/attributes
		if (buttonEl.classList.contains('bases-toolbar-properties-menu') ||
			buttonEl.classList.contains('bases-toolbar-properties') ||
			buttonEl.classList.contains('bases-toolbar-properties-item') ||
			buttonEl.getAttribute('aria-label')?.toLowerCase().includes('properties')) {
			return true;
		}
		
		// Check if it's within a properties menu
		if (buttonEl.closest('.bases-toolbar-properties-menu')) {
			return true;
		}
		
		// Check for properties-related icons
		const iconEl = buttonEl.querySelector('.text-button-icon, svg');
		if (iconEl) {
			const svg = iconEl.querySelector('svg') || (iconEl.tagName === 'svg' ? iconEl : null);
			if (svg) {
				const lucideIcon = svg.getAttribute('data-lucide');
				if (lucideIcon && ['list', 'layout-list', 'columns', 'layout-grid', 'sidebar'].includes(lucideIcon)) {
					return true;
				}
			}
		}
		
		return false;
	};

	// Also try to intercept on the button directly when it appears
	const observer = new MutationObserver(() => {
		// Look for all toolbar buttons and check if they're properties buttons
		const toolbarButtons = document.querySelectorAll(
			'.bases-toolbar-properties-menu, ' +
			'.bases-toolbar .text-icon-button, ' +
			'.bases-toolbar .bases-toolbar-item, ' +
			'.bases-toolbar-properties, ' +
			'.bases-toolbar-properties-item'
		);
		
		toolbarButtons.forEach((buttonEl) => {
			if (isPropertiesButton(buttonEl)) {
				const buttonWithFlag = buttonEl as unknown as { __cmsPropertiesIntercepted?: boolean };
				if (!buttonWithFlag.__cmsPropertiesIntercepted) {
					buttonWithFlag.__cmsPropertiesIntercepted = true;
					buttonEl.addEventListener('click', interceptPropertiesButton as EventListener, true);
				}
			}
		});
	});

	observer.observe(document.body, { childList: true, subtree: true });
	
	// Check immediately
	const toolbarButtons = document.querySelectorAll(
		'.bases-toolbar-properties-menu, ' +
		'.bases-toolbar .text-icon-button, ' +
		'.bases-toolbar .bases-toolbar-item, ' +
		'.bases-toolbar-properties, ' +
		'.bases-toolbar-properties-item'
	);
	toolbarButtons.forEach((buttonEl) => {
		if (isPropertiesButton(buttonEl)) {
			const buttonWithFlag = buttonEl as unknown as { __cmsPropertiesIntercepted?: boolean };
			if (!buttonWithFlag.__cmsPropertiesIntercepted) {
				buttonWithFlag.__cmsPropertiesIntercepted = true;
				buttonEl.addEventListener('click', interceptPropertiesButton as EventListener, true);
			}
		}
	});
	
	// Register cleanup
	registerCleanup(() => {
		document.removeEventListener('click', interceptPropertiesButton as EventListener, true);
		observer.disconnect();
	});
}

