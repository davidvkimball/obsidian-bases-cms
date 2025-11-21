/**
 * Icon Picker Modal
 * Searchable modal for selecting a Lucide icon
 */

import { App, FuzzySuggestModal, setIcon, getIconIds, requireApiVersion } from 'obsidian';

interface IconOption {
	id: string;
	name: string;
}

// Get icon list from Obsidian API if available, otherwise use fallback list
const getIconList = (): string[] => {
	if (requireApiVersion && requireApiVersion('1.7.3') && getIconIds) {
		try {
			return getIconIds();
		} catch (e) {
			console.warn('[Bases CMS] Error getting icon IDs from Obsidian:', e);
		}
	}
	// Fallback to a basic list if API is not available
	return [
		'settings-2', 'settings', 'help-circle', 'info', 'star', 'heart', 'bookmark',
		'home', 'search', 'bell', 'mail', 'user', 'users', 'folder', 'file', 'file-text',
		'image', 'video', 'music', 'calendar', 'clock', 'edit', 'pencil', 'trash',
		'copy', 'cut', 'paste', 'download', 'upload', 'save', 'share', 'link',
		'external-link', 'lock', 'unlock', 'eye', 'eye-off', 'key', 'shield',
		'check', 'x', 'plus', 'minus', 'arrow-left', 'arrow-right', 'arrow-up',
		'arrow-down', 'chevron-left', 'chevron-right', 'chevron-up', 'chevron-down',
		'menu', 'more-horizontal', 'more-vertical', 'grid', 'list', 'layout',
		'columns', 'rows', 'maximize', 'minimize', 'zoom-in', 'zoom-out',
		'refresh-cw', 'play', 'pause', 'stop', 'sun', 'moon', 'cloud', 'zap',
		'wand-2', 'wand', 'wand-sparkles', 'palette', 'brush', 'sliders',
		'power', 'wifi', 'bluetooth', 'monitor', 'laptop', 'smartphone',
		'camera', 'mic', 'headphones', 'code', 'terminal', 'terminal-square',
		'github', 'gitlab', 'git-branch', 'git-commit', 'database', 'server',
		'cloud-download', 'cloud-upload', 'tag', 'tags', 'flag', 'pin',
		'map-pin', 'compass', 'globe', 'rocket', 'car', 'bike', 'robot',
		'apple', 'windows', 'linux', 'chrome', 'firefox', 'safari',
		'credit-card', 'wallet', 'coins', 'book', 'book-open', 'award',
		'trophy', 'badge', 'wrench', 'tool', 'package', 'box', 'archive',
		'send', 'reply', 'forward', 'mail-open', 'tag-plus', 'tag-minus',
		'flag-off', 'pin-off', 'map-pin-off', 'navigation', 'map', 'earth',
		'plane', 'ship', 'anchor', 'helicopter', 'drone', 'android',
		'keyhole', 'keys', 'fingerprint', 'scan', 'qr-code', 'barcode',
		'receipt', 'piggy-bank', 'banknote', 'pencil-line', 'edit-2', 'edit-3'
	];
};

// Convert icon IDs to IconOption format
const LUCIDE_ICONS: IconOption[] = getIconList().map(id => ({
	id: id,
	name: id
		.replace(/^lucide-/, '') // Remove lucide- prefix for display
		.replace(/-/g, ' ')
		.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase())
})).sort((a, b) => a.name.localeCompare(b.name));

export class IconPickerModal extends FuzzySuggestModal<IconOption> {
	private onSelect: (iconId: string) => void;

	constructor(app: App, onSelect: (iconId: string) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	getItems(): IconOption[] {
		return LUCIDE_ICONS;
	}

	getItemText(item: IconOption): string {
		return item.name;
	}

	onChooseItem(item: IconOption, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(item.id);
	}

	// Override to show icon preview
	renderSuggestion(match: { item: IconOption }, el: HTMLElement): void {
		const item = match.item;
		el.addClass('mod-complex');
		const content = el.createDiv({ cls: 'suggestion-content' });
		content.createDiv({ cls: 'suggestion-title', text: item.name });
		
		// Create icon preview using Obsidian's setIcon
		const aux = el.createDiv({ cls: 'suggestion-aux' });
		setIcon(aux.createSpan({ cls: 'suggestion-flair' }), item.id);
	}
}

