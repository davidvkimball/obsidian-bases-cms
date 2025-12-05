/**
 * Settings schema for CMS views
 */

import type { BasesCMSSettings } from '../types';
import type { CMSSettings } from './data-transform';

// Bases config object interface
interface BasesConfig {
	get(key: string): unknown;
}

/**
 * Read CMS settings from Bases config with plugin defaults
 */
export function readCMSSettings(
	config: BasesConfig | undefined,
	pluginSettings: BasesCMSSettings
): CMSSettings {
	// Helper to safely get config values
	const getConfig = (key: string): unknown => {
		return config?.get?.(key);
	};
	
	return {
		titleProperty: (getConfig('titleProperty') as string) || '',
		descriptionProperty: (getConfig('descriptionProperty') as string) || '',
		imageProperty: (getConfig('imageProperty') as string) || '',
		showTitle: (getConfig('showTitle') as boolean) ?? true,
		showDate: (getConfig('showDate') as boolean) ?? false,
		dateProperty: (getConfig('dateProperty') as string) || '',
		dateIncludeTime: (getConfig('dateIncludeTime') as boolean) ?? false,
		showTextPreview: (getConfig('showTextPreview') as boolean) ?? true,
		fallbackToContent: (getConfig('fallbackToContent') as boolean) ?? true,
		fallbackToEmbeds: (() => {
			const value = getConfig('fallbackToEmbeds');
			if (value === 'always' || value === 'if-empty' || value === 'never') {
				return value;
			}
			// Legacy boolean support - default to 'if-empty' for backward compatibility
			return (value === false) ? 'never' : 'if-empty';
		})(),
		propertyDisplay1: (getConfig('propertyDisplay1') as string) || '',
		propertyDisplay2: (getConfig('propertyDisplay2') as string) || '',
		propertyDisplay3: (getConfig('propertyDisplay3') as string) || '',
		propertyDisplay4: (getConfig('propertyDisplay4') as string) || '',
		propertyDisplay5: (getConfig('propertyDisplay5') as string) || '',
		propertyDisplay6: (getConfig('propertyDisplay6') as string) || '',
		propertyDisplay7: (getConfig('propertyDisplay7') as string) || '',
		propertyDisplay8: (getConfig('propertyDisplay8') as string) || '',
		propertyDisplay9: (getConfig('propertyDisplay9') as string) || '',
		propertyDisplay10: (getConfig('propertyDisplay10') as string) || '',
		propertyDisplay11: (getConfig('propertyDisplay11') as string) || '',
		propertyDisplay12: (getConfig('propertyDisplay12') as string) || '',
		propertyDisplay13: (getConfig('propertyDisplay13') as string) || '',
		propertyDisplay14: (getConfig('propertyDisplay14') as string) || '',
		propertyLayout12SideBySide: (getConfig('propertyLayout12SideBySide') as boolean) ?? false,
		propertyLayout34SideBySide: (getConfig('propertyLayout34SideBySide') as boolean) ?? false,
		propertyLayout56SideBySide: (getConfig('propertyLayout56SideBySide') as boolean) ?? false,
		propertyLayout78SideBySide: (getConfig('propertyLayout78SideBySide') as boolean) ?? false,
		propertyLayout910SideBySide: (getConfig('propertyLayout910SideBySide') as boolean) ?? false,
		propertyLayout1112SideBySide: (getConfig('propertyLayout1112SideBySide') as boolean) ?? false,
		propertyLayout1314SideBySide: (getConfig('propertyLayout1314SideBySide') as boolean) ?? false,
		propertyGroup1Position: (getConfig('propertyGroup1Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup2Position: (getConfig('propertyGroup2Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup3Position: (getConfig('propertyGroup3Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup4Position: (getConfig('propertyGroup4Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup5Position: (getConfig('propertyGroup5Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup6Position: (getConfig('propertyGroup6Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup7Position: (getConfig('propertyGroup7Position') as 'top' | 'bottom') || 'bottom',
		imageFormat: (getConfig('imageFormat') as 'none' | 'thumbnail' | 'cover') || 'thumbnail',
		imagePosition: (getConfig('imagePosition') as 'left' | 'right' | 'top' | 'bottom') || 'right',
		propertyLabels: (getConfig('propertyLabels') as 'hide' | 'inline' | 'above') || 'hide',
		showDraftStatus: (getConfig('showDraftStatus') as boolean) ?? false,
		draftStatusProperty: (getConfig('draftStatusProperty') as string) || '',
		draftStatusReverse: (getConfig('draftStatusReverse') as boolean) ?? false,
		draftStatusUseFilenamePrefix: (getConfig('draftStatusUseFilenamePrefix') as boolean) ?? false,
		showTags: (getConfig('showTags') as boolean) ?? false,
		tagsProperty: (getConfig('tagsProperty') as string) || '',
		maxTagsToShow: (getConfig('maxTagsToShow') as number) ?? 3,
		customizeNewButton: (getConfig('customizeNewButton') as boolean) ?? false,
		newNoteLocation: (getConfig('newNoteLocation') as string) || '',
		hideQuickEditIcon: (getConfig('hideQuickEditIcon') as boolean) ?? false,
		cardSize: (getConfig('cardSize') as number) ?? 250,
		imageAspectRatio: (getConfig('imageAspectRatio') as number) ?? 0.55,
	};
}

/**
 * CMS view options for Bases configuration
 */
export function getCMSViewOptions(): unknown[] {
	return [
		// Card size (standalone)
		{
			type: 'slider',
			displayName: 'Card size',
			key: 'cardSize',
			min: 50,
			max: 800,
			step: 10,
			default: 250
		},
		// Title group
		{
			type: 'group',
			displayName: 'Title',
			items: [
				{
					type: 'toggle',
					displayName: 'Show title',
					key: 'showTitle',
					default: true
				},
				{
					type: 'property',
					displayName: 'Title property',
					key: 'titleProperty',
					placeholder: 'Select property',
					default: ''
				}
			]
		},
		// Text preview group
		{
			type: 'group',
			displayName: 'Text preview',
			items: [
				{
					type: 'toggle',
					displayName: 'Show text preview',
					key: 'showTextPreview',
					default: true
				},
				{
					type: 'property',
					displayName: 'Text preview property',
					key: 'descriptionProperty',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Use note content if text preview property unavailable',
					key: 'fallbackToContent',
					default: true
				}
			]
		},
		// Image group
		{
			type: 'group',
			displayName: 'Image',
			items: [
				{
					type: 'dropdown',
					displayName: 'Image format',
					key: 'imageFormat',
					options: {
						'none': 'No image',
						'thumbnail': 'Thumbnail',
						'cover': 'Cover'
					},
					default: 'thumbnail'
				},
				{
					type: 'property',
					displayName: 'Image property',
					key: 'imageProperty',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'dropdown',
					displayName: 'Show image embeds',
					key: 'fallbackToEmbeds',
					options: {
						'always': 'Always',
						'if-empty': 'If image property missing or empty',
						'never': 'Never'
					},
					default: 'if-empty'
				},
				{
					type: 'slider',
					displayName: 'Image aspect ratio',
					key: 'imageAspectRatio',
					min: 0.1,
					max: 2.0,
					step: 0.05,
					default: 0.55,
					showWhen: {
						key: 'imageFormat',
						value: 'cover'
					}
				}
			]
		},
		// Date group
		{
			type: 'group',
			displayName: 'Date',
			items: [
				{
					type: 'toggle',
					displayName: 'Show date',
					key: 'showDate',
					default: false
				},
				{
					type: 'property',
					displayName: 'Date property',
					key: 'dateProperty',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Include time',
					description: 'When enabled, displays both date and time using your system locale settings',
					key: 'dateIncludeTime',
					default: false
				}
			]
		},
		// Draft status group
		{
			type: 'group',
			displayName: 'Draft status',
			items: [
				{
					type: 'toggle',
					displayName: 'Show draft status',
					key: 'showDraftStatus',
					default: false
				},
				{
					type: 'property',
					displayName: 'Draft status property',
					key: 'draftStatusProperty',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Reverse logic',
					key: 'draftStatusReverse',
					default: false
				},
				{
					type: 'toggle',
					displayName: 'Filename underscore prefix as draft indicator',
					key: 'draftStatusUseFilenamePrefix',
					default: false
				}
			]
		},
		// Tags group
		{
			type: 'group',
			displayName: 'Tags',
			items: [
				{
					type: 'toggle',
					displayName: 'Show tags',
					key: 'showTags',
					default: false
				},
				{
					type: 'property',
					displayName: 'Tags property',
					key: 'tagsProperty',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'slider',
					displayName: 'Maximum tags to show',
					key: 'maxTagsToShow',
					min: 1,
					max: 50,
					step: 1,
					default: 3,
					showWhen: {
						key: 'showTags',
						value: true
					}
				}
			]
		},
		// Properties group
		{
			type: 'group',
			displayName: 'Properties',
			items: [
				{
					type: 'dropdown',
					displayName: 'Show property labels',
					key: 'propertyLabels',
					options: {
						'hide': 'Hide',
						'inline': 'Inline',
						'above': 'On top'
					},
					default: 'hide'
				}
			]
		},
		// Property group 1
		{
			type: 'group',
			displayName: 'Property group 1',
			items: [
				{
					type: 'property',
					displayName: 'First property',
					key: 'propertyDisplay1',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'property',
					displayName: 'Second property',
					key: 'propertyDisplay2',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Show side-by-side',
					key: 'propertyLayout12SideBySide',
					default: false
				},
				{
					type: 'dropdown',
					displayName: 'Position',
					key: 'propertyGroup1Position',
					options: {
						'top': 'Top',
						'bottom': 'Bottom'
					},
					default: 'bottom'
				}
			]
		},
		// Property group 2
		{
			type: 'group',
			displayName: 'Property group 2',
			items: [
				{
					type: 'property',
					displayName: 'Third property',
					key: 'propertyDisplay3',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'property',
					displayName: 'Fourth property',
					key: 'propertyDisplay4',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Show side-by-side',
					key: 'propertyLayout34SideBySide',
					default: false
				},
				{
					type: 'dropdown',
					displayName: 'Position',
					key: 'propertyGroup2Position',
					options: {
						'top': 'Top',
						'bottom': 'Bottom'
					},
					default: 'bottom'
				}
			]
		},
		// Property group 3
		{
			type: 'group',
			displayName: 'Property group 3',
			items: [
				{
					type: 'property',
					displayName: 'First property',
					key: 'propertyDisplay5',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'property',
					displayName: 'Second property',
					key: 'propertyDisplay6',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Show side-by-side',
					key: 'propertyLayout56SideBySide',
					default: false
				},
				{
					type: 'dropdown',
					displayName: 'Position',
					key: 'propertyGroup3Position',
					options: {
						'top': 'Top',
						'bottom': 'Bottom'
					},
					default: 'bottom'
				}
			]
		},
		// Property group 4
		{
			type: 'group',
			displayName: 'Property group 4',
			items: [
				{
					type: 'property',
					displayName: 'First property',
					key: 'propertyDisplay7',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'property',
					displayName: 'Second property',
					key: 'propertyDisplay8',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Show side-by-side',
					key: 'propertyLayout78SideBySide',
					default: false
				},
				{
					type: 'dropdown',
					displayName: 'Position',
					key: 'propertyGroup4Position',
					options: {
						'top': 'Top',
						'bottom': 'Bottom'
					},
					default: 'bottom'
				}
			]
		},
		// Property group 5
		{
			type: 'group',
			displayName: 'Property group 5',
			items: [
				{
					type: 'property',
					displayName: 'First property',
					key: 'propertyDisplay9',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'property',
					displayName: 'Second property',
					key: 'propertyDisplay10',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Show side-by-side',
					key: 'propertyLayout910SideBySide',
					default: false
				},
				{
					type: 'dropdown',
					displayName: 'Position',
					key: 'propertyGroup5Position',
					options: {
						'top': 'Top',
						'bottom': 'Bottom'
					},
					default: 'bottom'
				}
			]
		},
		// Property group 6
		{
			type: 'group',
			displayName: 'Property group 6',
			items: [
				{
					type: 'property',
					displayName: 'First property',
					key: 'propertyDisplay11',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'property',
					displayName: 'Second property',
					key: 'propertyDisplay12',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Show side-by-side',
					key: 'propertyLayout1112SideBySide',
					default: false
				},
				{
					type: 'dropdown',
					displayName: 'Position',
					key: 'propertyGroup6Position',
					options: {
						'top': 'Top',
						'bottom': 'Bottom'
					},
					default: 'bottom'
				}
			]
		},
		// Property group 7
		{
			type: 'group',
			displayName: 'Property group 7',
			items: [
				{
					type: 'property',
					displayName: 'First property',
					key: 'propertyDisplay13',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'property',
					displayName: 'Second property',
					key: 'propertyDisplay14',
					placeholder: 'Select property',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Show side-by-side',
					key: 'propertyLayout1314SideBySide',
					default: false
				},
				{
					type: 'dropdown',
					displayName: 'Position',
					key: 'propertyGroup7Position',
					options: {
						'top': 'Top',
						'bottom': 'Bottom'
					},
					default: 'bottom'
				}
			]
		},
		// Behavior group
		{
			type: 'group',
			displayName: 'Behavior',
			items: [
				{
					type: 'toggle',
					displayName: 'Open new notes directly',
					description: 'Skip the Bases modal and create notes directly (like the file explorer). When disabled, uses normal Bases behavior with the property popup.',
					key: 'customizeNewButton',
					default: false
				},
				{
					type: 'text',
					displayName: 'Location for new notes',
					description: 'Folder path where new notes will be created. Use / for vault root, or specify a folder path. Works independently of "Open new notes directly".',
					key: 'newNoteLocation',
					placeholder: 'Simply use / for vault folder',
					default: ''
				},
				{
					type: 'toggle',
					displayName: 'Hide quick edit icon',
					key: 'hideQuickEditIcon',
					default: false
				}
			]
		}
	];
}

