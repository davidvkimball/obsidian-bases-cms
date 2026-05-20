/**
 * Settings schema for CMS views
 */

import type { BasesCMSSettings } from '../types';
import type { CMSSettings } from './data-transform';

interface BasesConfig {
	get(key: string): unknown;
}

export function readCMSSettings(
	config: BasesConfig | undefined,
	pluginSettings: BasesCMSSettings
): CMSSettings {
	const getConfig = (key: string): unknown => {
		return config?.get?.(key);
	};

	const getProp = (key: string): string => {
		const baseVal = getConfig(key) as string;
		if (!baseVal) return '';
		
		const hasNested = getConfig(key + 'HasNested') as boolean;
		if (hasNested) {
			const nestedVal = getConfig(key + 'Nested') as string;
			if (nestedVal) {
				return baseVal + '.' + nestedVal;
			}
		}
		return baseVal;
	};

	return {
		titleProperty: getProp('titleProperty') || 'note.title',
		descriptionProperty: getProp('descriptionProperty') || '',
		imageProperty: getProp('imageProperty') || '',
		showTitle: true,
		showDate: (getConfig('showDate') as boolean) ?? false,
		dateProperty: getProp('dateProperty') || '',
		dateIncludeTime: (getConfig('dateIncludeTime') as boolean) ?? false,
		showTextPreview: (getConfig('showTextPreview') as boolean) ?? true,
		fallbackToContent: (getConfig('fallbackToContent') as boolean) ?? true,
		richContentPreview: (getConfig('richContentPreview') as boolean) ?? false,
		richContentPreviewScroll: (getConfig('richContentPreviewScroll') as boolean) ?? false,
		truncatePreviewProperty: (getConfig('truncatePreviewProperty') as boolean) ?? false,
		descriptionMaxLength: (getConfig('descriptionMaxLength') as number) ?? 500,
		descriptionMaxLines: (getConfig('descriptionMaxLines') as number) ?? 5,
		fallbackToEmbeds: (() => {
			const value = getConfig('fallbackToEmbeds');
			if (value === 'always' || value === 'if-empty' || value === 'never') return value;
			return (value === false) ? 'never' : 'if-empty';
		})(),
		propertyDisplay1: getProp('propertyDisplay1') || '',
		propertyDisplay2: getProp('propertyDisplay2') || '',
		propertyDisplay3: getProp('propertyDisplay3') || '',
		propertyDisplay4: getProp('propertyDisplay4') || '',
		propertyDisplay5: getProp('propertyDisplay5') || '',
		propertyDisplay6: getProp('propertyDisplay6') || '',
		propertyDisplay7: getProp('propertyDisplay7') || '',
		propertyDisplay8: getProp('propertyDisplay8') || '',
		propertyDisplay9: getProp('propertyDisplay9') || '',
		propertyDisplay10: getProp('propertyDisplay10') || '',
		propertyDisplay11: getProp('propertyDisplay11') || '',
		propertyDisplay12: getProp('propertyDisplay12') || '',
		propertyDisplay13: getProp('propertyDisplay13') || '',
		propertyDisplay14: getProp('propertyDisplay14') || '',
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
		propertyDisplayMaxLength: (getConfig('propertyDisplayMaxLength') as number) ?? 0,
		showDraftStatus: (getConfig('showDraftStatus') as boolean) ?? false,
		draftStatusProperty: getProp('draftStatusProperty') || '',
		draftStatusReverse: (getConfig('draftStatusReverse') as boolean) ?? false,
		draftStatusUseFilenamePrefix: (getConfig('draftStatusUseFilenamePrefix') as boolean) ?? false,
		showTags: (getConfig('showTags') as boolean) ?? false,
		tagsProperty: getProp('tagsProperty') || '',
		maxTagsToShow: (getConfig('maxTagsToShow') as number) ?? 3,
		customizeNewButton: (getConfig('customizeNewButton') as boolean) ?? false,
		newNoteLocation: (getConfig('newNoteLocation') as string) || '',
		hideQuickEditIcon: (getConfig('hideQuickEditIcon') as boolean) ?? false,
		cardSize: (getConfig('cardSize') as number) ?? 250,
		imageAspectRatio: (getConfig('imageAspectRatio') as number) ?? 0.55,
	};
}

function getPropItems(displayName: string, key: string) {
	return [
		{
			type: 'property',
			displayName: displayName,
			key: key,
			placeholder: 'Select property',
			default: ''
		},
		{
			type: 'toggle',
			displayName: 'Has nested path',
			key: key + 'HasNested',
			default: false
		},
		{
			type: 'text',
			displayName: 'Nested path (after the dot)',
			key: key + 'Nested',
			placeholder: 'e.g. src',
			default: '',
			showWhen: { key: key + 'HasNested', value: true }
		}
	];
}

export function getCMSViewOptions(): unknown[] {
	return [
		{
			type: 'slider',
			displayName: 'Card size',
			key: 'cardSize',
			min: 50,
			max: 1000,
			step: 10,
			default: 250
		},
		{
			type: 'group',
			displayName: 'Title',
			items: [
				...getPropItems('Title property', 'titleProperty')
			]
		},
		{
			type: 'group',
			displayName: 'Text preview',
			items: [
				{ type: 'toggle', displayName: 'Show text preview', key: 'showTextPreview', default: true },
				...getPropItems('Text preview property', 'descriptionProperty'),
				{ type: 'toggle', displayName: 'Use note content if text preview property unavailable', key: 'fallbackToContent', default: true },
				{ type: 'toggle', displayName: 'Render preview as Markdown', key: 'richContentPreview', default: false },
				{ type: 'toggle', displayName: 'Scroll Markdown preview when it overflows', key: 'richContentPreviewScroll', default: false, showWhen: { key: 'richContentPreview', value: true } },
				{ type: 'toggle', displayName: 'Truncate preview property', key: 'truncatePreviewProperty', default: false },
				{ type: 'slider', displayName: 'Description max length (when truncation is on)', key: 'descriptionMaxLength', min: 50, max: 2000, step: 50, default: 500, showWhen: { key: 'truncatePreviewProperty', value: true } },
				{ type: 'slider', displayName: 'Description max lines', key: 'descriptionMaxLines', min: 1, max: 20, step: 1, default: 5 }
			]
		},
		{
			type: 'group',
			displayName: 'Image',
			items: [
				{ type: 'dropdown', displayName: 'Image format', key: 'imageFormat', options: { 'none': 'No image', 'thumbnail': 'Thumbnail', 'cover': 'Cover' }, default: 'thumbnail' },
				...getPropItems('Image property', 'imageProperty'),
				{ type: 'dropdown', displayName: 'Show image embeds', key: 'fallbackToEmbeds', options: { 'always': 'Always', 'if-empty': 'If image property missing or empty', 'never': 'Never' }, default: 'if-empty' },
				{ type: 'slider', displayName: 'Image aspect ratio', key: 'imageAspectRatio', min: 0.1, max: 2.0, step: 0.05, default: 0.55, showWhen: { key: 'imageFormat', value: 'cover' } }
			]
		},
		{
			type: 'group',
			displayName: 'Date',
			items: [
				{ type: 'toggle', displayName: 'Show date', key: 'showDate', default: false },
				...getPropItems('Date property', 'dateProperty'),
				{ type: 'toggle', displayName: 'Include time', description: 'When enabled, displays both date and time using your system locale settings', key: 'dateIncludeTime', default: false }
			]
		},
		{
			type: 'group',
			displayName: 'Draft status',
			items: [
				{ type: 'toggle', displayName: 'Show draft status', key: 'showDraftStatus', default: false },
				...getPropItems('Draft status property', 'draftStatusProperty'),
				{ type: 'toggle', displayName: 'Reverse logic', key: 'draftStatusReverse', default: false },
				{ type: 'toggle', displayName: 'File name underscore prefix as draft indicator', key: 'draftStatusUseFilenamePrefix', default: false }
			]
		},
		{
			type: 'group',
			displayName: 'Tags',
			items: [
				{ type: 'toggle', displayName: 'Show tags', key: 'showTags', default: false },
				...getPropItems('Tags property', 'tagsProperty'),
				{ type: 'slider', displayName: 'Maximum tags to show', key: 'maxTagsToShow', min: 1, max: 50, step: 1, default: 3, showWhen: { key: 'showTags', value: true } }
			]
		},
		{
			type: 'group',
			displayName: 'Properties',
			items: [
				{ type: 'dropdown', displayName: 'Show property labels', key: 'propertyLabels', options: { 'hide': 'Hide', 'inline': 'Inline', 'above': 'On top' }, default: 'hide' },
				{ type: 'slider', displayName: 'Max characters per property (0 = no limit)', key: 'propertyDisplayMaxLength', min: 0, max: 500, step: 10, default: 0 }
			]
		},
		{
			type: 'group',
			displayName: 'Property group 1',
			items: [
				...getPropItems('First property', 'propertyDisplay1'),
				...getPropItems('Second property', 'propertyDisplay2'),
				{ type: 'toggle', displayName: 'Show side-by-side', key: 'propertyLayout12SideBySide', default: false },
				{ type: 'dropdown', displayName: 'Position', key: 'propertyGroup1Position', options: { 'top': 'Top', 'bottom': 'Bottom' }, default: 'bottom' }
			]
		},
		{
			type: 'group',
			displayName: 'Property group 2',
			items: [
				...getPropItems('Third property', 'propertyDisplay3'),
				...getPropItems('Fourth property', 'propertyDisplay4'),
				{ type: 'toggle', displayName: 'Show side-by-side', key: 'propertyLayout34SideBySide', default: false },
				{ type: 'dropdown', displayName: 'Position', key: 'propertyGroup2Position', options: { 'top': 'Top', 'bottom': 'Bottom' }, default: 'bottom' }
			]
		},
		{
			type: 'group',
			displayName: 'Property group 3',
			items: [
				...getPropItems('First property', 'propertyDisplay5'),
				...getPropItems('Second property', 'propertyDisplay6'),
				{ type: 'toggle', displayName: 'Show side-by-side', key: 'propertyLayout56SideBySide', default: false },
				{ type: 'dropdown', displayName: 'Position', key: 'propertyGroup3Position', options: { 'top': 'Top', 'bottom': 'Bottom' }, default: 'bottom' }
			]
		},
		{
			type: 'group',
			displayName: 'Property group 4',
			items: [
				...getPropItems('First property', 'propertyDisplay7'),
				...getPropItems('Second property', 'propertyDisplay8'),
				{ type: 'toggle', displayName: 'Show side-by-side', key: 'propertyLayout78SideBySide', default: false },
				{ type: 'dropdown', displayName: 'Position', key: 'propertyGroup4Position', options: { 'top': 'Top', 'bottom': 'Bottom' }, default: 'bottom' }
			]
		},
		{
			type: 'group',
			displayName: 'Property group 5',
			items: [
				...getPropItems('First property', 'propertyDisplay9'),
				...getPropItems('Second property', 'propertyDisplay10'),
				{ type: 'toggle', displayName: 'Show side-by-side', key: 'propertyLayout910SideBySide', default: false },
				{ type: 'dropdown', displayName: 'Position', key: 'propertyGroup5Position', options: { 'top': 'Top', 'bottom': 'Bottom' }, default: 'bottom' }
			]
		},
		{
			type: 'group',
			displayName: 'Property group 6',
			items: [
				...getPropItems('First property', 'propertyDisplay11'),
				...getPropItems('Second property', 'propertyDisplay12'),
				{ type: 'toggle', displayName: 'Show side-by-side', key: 'propertyLayout1112SideBySide', default: false },
				{ type: 'dropdown', displayName: 'Position', key: 'propertyGroup6Position', options: { 'top': 'Top', 'bottom': 'Bottom' }, default: 'bottom' }
			]
		},
		{
			type: 'group',
			displayName: 'Property group 7',
			items: [
				...getPropItems('First property', 'propertyDisplay13'),
				...getPropItems('Second property', 'propertyDisplay14'),
				{ type: 'toggle', displayName: 'Show side-by-side', key: 'propertyLayout1314SideBySide', default: false },
				{ type: 'dropdown', displayName: 'Position', key: 'propertyGroup7Position', options: { 'top': 'Top', 'bottom': 'Bottom' }, default: 'bottom' }
			]
		},
		{
			type: 'group',
			displayName: 'Behavior',
			items: [
				{ type: 'toggle', displayName: 'Open new notes directly', description: 'Skip the Bases modal and create notes directly (like the file explorer). When disabled, uses normal Bases behavior with the property popup.', key: 'customizeNewButton', default: false },
				{ type: 'text', displayName: 'Location for new notes', description: 'Folder path where new notes will be created. Use / for vault root, or specify a folder path. Works independently of "Open new notes directly".', key: 'newNoteLocation', placeholder: 'Simply use / for vault folder', default: '' },
				{ type: 'toggle', displayName: 'Hide quick edit icon', key: 'hideQuickEditIcon', default: false }
			]
		}
	];
}
