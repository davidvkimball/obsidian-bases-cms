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
	config: BasesConfig,
	pluginSettings: BasesCMSSettings
): CMSSettings {
	return {
		titleProperty: (config.get('titleProperty') as string) || '',
		descriptionProperty: (config.get('descriptionProperty') as string) || '',
		imageProperty: (config.get('imageProperty') as string) || '',
		showTitle: (config.get('showTitle') as boolean) ?? true,
		showDate: (config.get('showDate') as boolean) ?? false,
		dateProperty: (config.get('dateProperty') as string) || '',
		dateIncludeTime: (config.get('dateIncludeTime') as boolean) ?? false,
		showTextPreview: (config.get('showTextPreview') as boolean) ?? true,
		fallbackToContent: (config.get('fallbackToContent') as boolean) ?? true,
		fallbackToEmbeds: (() => {
			const value = config.get('fallbackToEmbeds');
			if (value === 'always' || value === 'if-empty' || value === 'never') {
				return value;
			}
			// Legacy boolean support - default to 'if-empty' for backward compatibility
			return (value === false) ? 'never' : 'if-empty';
		})(),
		propertyDisplay1: (config.get('propertyDisplay1') as string) || '',
		propertyDisplay2: (config.get('propertyDisplay2') as string) || '',
		propertyDisplay3: (config.get('propertyDisplay3') as string) || '',
		propertyDisplay4: (config.get('propertyDisplay4') as string) || '',
		propertyDisplay5: (config.get('propertyDisplay5') as string) || '',
		propertyDisplay6: (config.get('propertyDisplay6') as string) || '',
		propertyDisplay7: (config.get('propertyDisplay7') as string) || '',
		propertyDisplay8: (config.get('propertyDisplay8') as string) || '',
		propertyDisplay9: (config.get('propertyDisplay9') as string) || '',
		propertyDisplay10: (config.get('propertyDisplay10') as string) || '',
		propertyDisplay11: (config.get('propertyDisplay11') as string) || '',
		propertyDisplay12: (config.get('propertyDisplay12') as string) || '',
		propertyDisplay13: (config.get('propertyDisplay13') as string) || '',
		propertyDisplay14: (config.get('propertyDisplay14') as string) || '',
		propertyLayout12SideBySide: (config.get('propertyLayout12SideBySide') as boolean) ?? false,
		propertyLayout34SideBySide: (config.get('propertyLayout34SideBySide') as boolean) ?? false,
		propertyLayout56SideBySide: (config.get('propertyLayout56SideBySide') as boolean) ?? false,
		propertyLayout78SideBySide: (config.get('propertyLayout78SideBySide') as boolean) ?? false,
		propertyLayout910SideBySide: (config.get('propertyLayout910SideBySide') as boolean) ?? false,
		propertyLayout1112SideBySide: (config.get('propertyLayout1112SideBySide') as boolean) ?? false,
		propertyLayout1314SideBySide: (config.get('propertyLayout1314SideBySide') as boolean) ?? false,
		propertyGroup1Position: (config.get('propertyGroup1Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup2Position: (config.get('propertyGroup2Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup3Position: (config.get('propertyGroup3Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup4Position: (config.get('propertyGroup4Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup5Position: (config.get('propertyGroup5Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup6Position: (config.get('propertyGroup6Position') as 'top' | 'bottom') || 'bottom',
		propertyGroup7Position: (config.get('propertyGroup7Position') as 'top' | 'bottom') || 'bottom',
		imageFormat: (config.get('imageFormat') as 'none' | 'thumbnail' | 'cover') || 'thumbnail',
		imagePosition: (config.get('imagePosition') as 'left' | 'right' | 'top' | 'bottom') || 'right',
		propertyLabels: (config.get('propertyLabels') as 'hide' | 'inline' | 'above') || 'hide',
		showDraftStatus: (config.get('showDraftStatus') as boolean) ?? false,
		draftStatusProperty: (config.get('draftStatusProperty') as string) || '',
		draftStatusReverse: (config.get('draftStatusReverse') as boolean) ?? false,
		draftStatusUseFilenamePrefix: (config.get('draftStatusUseFilenamePrefix') as boolean) ?? false,
		showTags: (config.get('showTags') as boolean) ?? false,
		tagsProperty: (config.get('tagsProperty') as string) || '',
		maxTagsToShow: (config.get('maxTagsToShow') as number) ?? 3,
		customizeNewButton: (config.get('customizeNewButton') as boolean) ?? false,
		newNoteLocation: (config.get('newNoteLocation') as string) || '',
		hideQuickEditIcon: (config.get('hideQuickEditIcon') as boolean) ?? false,
		cardSize: (config.get('cardSize') as number) ?? 250,
		imageAspectRatio: (config.get('imageAspectRatio') as number) ?? 0.55,
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
					type: 'dropdown',
					displayName: 'Image position',
					key: 'imagePosition',
					options: {
						'left': 'Left',
						'right': 'Right',
						'top': 'Top',
						'bottom': 'Bottom'
					},
					default: 'right',
					showWhen: {
						key: 'imageFormat',
						value: 'thumbnail'
					}
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
					displayName: 'Customize new button behavior',
					key: 'customizeNewButton',
					default: false
				},
				{
					type: 'text',
					displayName: 'Default location for new notes',
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

