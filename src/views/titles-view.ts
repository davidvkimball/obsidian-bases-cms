/**
 * Titles view: list of note titles (used when base view type is "titles").
 * Lists notes by a chosen property (typically title), hyperlinked to the note.
 * Optional secondary property shown after a dash, e.g. "Example Title - 2/3/2025".
 *
 * Follows the same lifecycle as Dynamic Views: defer render with queueMicrotask
 * so Obsidian has set config and data before we read them.
 */

import { BasesView, BasesEntry, QueryController } from 'obsidian';
import { setCssProps } from '../utils/css-props';
import type BasesCMSPlugin from '../main';

export const TITLES_VIEW_TYPE = 'titles';

function getTitleFromEntry(entry: BasesEntry, titleProperty: string): string {
	const prop = titleProperty?.trim() || 'note.title';
	const value = entry.getValue(prop as `note.${string}` | `file.${string}` | `formula.${string}`) as { data?: unknown } | null;
	if (value?.data != null) {
		const d = value.data;
		if (typeof d === 'string' || typeof d === 'number') return String(d).trim() || entry.file.basename;
		if (Array.isArray(d)) {
			const first = (d as unknown[])[0];
			if (first != null && typeof first === 'object' && 'data' in first) return String((first as { data: unknown }).data).trim() || entry.file.basename;
		}
	}
	return entry.file.basename || entry.file.name;
}

function getSecondaryFromEntry(entry: BasesEntry, propertyKey: string): string | null {
	const prop = propertyKey?.trim();
	if (!prop) return null;
	const value = entry.getValue(prop as `note.${string}` | `file.${string}` | `formula.${string}`) as { data?: unknown; date?: Date } | null;
	if (!value) return null;
	if (value.date instanceof Date) {
		return value.date.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
	}
	if (value.data != null) {
		const d = value.data;
		if (typeof d === 'string' || typeof d === 'number') return String(d).trim() || null;
		if (typeof d === 'boolean') return String(d);
		if (d instanceof Date) return d.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
		if (Array.isArray(d) && d.length > 0) {
			const first = (d as unknown[])[0];
			if (first != null && typeof first === 'object' && 'data' in first) return String((first as { data: unknown }).data);
			return String(first);
		}
	}
	return null;
}

export class BasesTitlesView extends BasesView {
	readonly type = TITLES_VIEW_TYPE;
	private containerEl: HTMLElement;
	private plugin: BasesCMSPlugin;

	constructor(controller: QueryController, parentContainerEl: HTMLElement, plugin: BasesCMSPlugin) {
		super(controller);
		this.plugin = plugin;
		// Match Dynamic Views: create content div inside the scroll container Bases provides
		this.containerEl = parentContainerEl.createDiv('bases-titles-view bases-cms-wrapper bases-titles-loading');
		setCssProps(this.containerEl, {
			height: '100%',
			width: '100%',
			overflowY: 'auto'
		});
	}

	onload(): void {
		super.onload();
	}

	onDataUpdated(): void {
		// API: "Called when there is new data for the query. This view should rerender with the updated data."
		// Defer so the framework has finished setting this.data and config before we read them.
		queueMicrotask(() => this.renderContents());
	}

	private renderContents(): void {
		if (!this.containerEl?.isConnected) return;
		if (!this.data) return;

		let entries: BasesEntry[] = [];
		try {
			const result = this.data;
			// Use direct .data first (API: ungrouped list). Avoid .groupedData getter which can throw.
			if (Array.isArray(result.data)) {
				entries = result.data;
			}
			if (entries.length === 0 && result.groupedData) {
				const groups = result.groupedData as Array<{ entries?: BasesEntry[] }>;
				entries = groups.flatMap(g => g.entries ?? []);
			}
		} catch {
			entries = [];
		}

		let titleProp = 'note.title';
		let secondaryProp = '';
		try {
			const config = this.config as { get?: (key: string) => unknown } | undefined;
			if (config?.get) {
				const t = config.get('titleProperty');
				titleProp = (typeof t === 'string' ? t : '')?.trim() || 'note.title';
				const s = config.get('secondaryProperty');
				secondaryProp = (typeof s === 'string' ? s : '')?.trim() || '';
			}
		} catch {
			// config.get can throw if internal state not ready
		}

		// Build list in a fragment so we never show an empty container (avoids flash).
		const fragment = createFragment();
		const listEl = fragment.createEl('ul', { cls: 'bases-titles-list' });
		setCssProps(listEl, {
			listStyle: 'none',
			margin: '0',
			padding: '0'
		});

		for (const entry of entries) {
			const title = getTitleFromEntry(entry, titleProp) || entry.file.basename;
			const secondary = secondaryProp ? getSecondaryFromEntry(entry, secondaryProp) : null;

			const li = listEl.createEl('li');
			const link = li.createEl('a', {
				href: entry.file.path,
				cls: 'internal-link',
				text: title
			});
			link.setAttribute('data-href', entry.file.path);
			const path = entry.file.path;
			this.registerDomEvent(link, 'click', (ev) => {
				ev.preventDefault();
				const newLeaf = ev.metaKey || ev.ctrlKey;
				void this.app.workspace.openLinkText(path, '', newLeaf);
			});
			this.registerDomEvent(link, 'mousedown', (ev) => {
				if (ev.button === 1) { // Middle click
					ev.preventDefault();
					void this.app.workspace.openLinkText(path, '', true);
				}
			});
			if (secondary) {
				li.appendText(' - ' + secondary);
			}
		}

		fragment.appendChild(listEl);
		this.containerEl.empty();
		this.containerEl.appendChild(fragment);
		this.containerEl.removeClass('bases-titles-loading');
	}

	async onClose(): Promise<void> {
		this.containerEl?.empty();
		await Promise.resolve();
	}
}
