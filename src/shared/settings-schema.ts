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
		showTextPreview: (config.get('showTextPreview') as boolean) ?? true,
		fallbackToContent: (config.get('fallbackToContent') as boolean) ?? true,
		fallbackToEmbeds: (config.get('fallbackToEmbeds') as boolean) ?? false,
		propertyDisplay1: (config.get('propertyDisplay1') as string) || '',
		propertyDisplay2: (config.get('propertyDisplay2') as string) || '',
		propertyDisplay3: (config.get('propertyDisplay3') as string) || '',
		propertyDisplay4: (config.get('propertyDisplay4') as string) || '',
		propertyLayout12SideBySide: (config.get('propertyLayout12SideBySide') as boolean) ?? false,
		propertyLayout34SideBySide: (config.get('propertyLayout34SideBySide') as boolean) ?? false,
		imageFormat: (config.get('imageFormat') as 'none' | 'thumbnail' | 'cover') || 'thumbnail',
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
		thumbnailCacheSize: pluginSettings.thumbnailCacheSize,
		cardSize: (config.get('cardSize') as number) ?? 250,
		imageAspectRatio: (config.get('imageAspectRatio') as number) ?? 0.55,
	};
}

/**
 * CMS view options for Bases configuration
 */
export function getCMSViewOptions(): any[] {
	return [
		{
			type: 'slider',
			displayName: 'Card size',
			key: 'cardSize',
			min: 50,
			max: 800,
			step: 10,
			default: 250
		},
		{
			type: 'dropdown',
			displayName: 'Card image',
			key: 'imageFormat',
			options: {
				'none': 'No image',
				'thumbnail': 'Thumbnail',
				'cover': 'Cover'
			},
			default: 'thumbnail'
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
		},
		{
			type: 'property',
			displayName: 'Image property',
			key: 'imageProperty',
			placeholder: 'Select property',
			default: ''
		},
		{
			type: 'toggle',
			displayName: 'Use in-note images if image property unavailable',
			key: 'fallbackToEmbeds',
			default: false
		},
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
		},
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
		},
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
		},
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
		},
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
			displayName: 'Show first and second properties side by side',
			key: 'propertyLayout12SideBySide',
			default: false
		},
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
			displayName: 'Show third and fourth properties side by side',
			key: 'propertyLayout34SideBySide',
			default: false
		},
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
		},
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
	];
}

