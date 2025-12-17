<!--
Source: Based on Obsidian Sample Plugin and community guidelines
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin and Sample Theme repos for updates
Applicability: Plugin / Theme
-->

# Project overview

## Plugins

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `main.ts` (in root for simple plugins, or `src/main.ts` for organized plugins) compiled to `main.js` and loaded by Obsidian.
- **Important**: `main.ts` can be in root for simple plugins, or in `src/` for better organization. Never have it in both locations. See [file-conventions.md](file-conventions.md) for structure.
- Required release artifacts: `main.js` (compiled from `main.ts`), `manifest.json`, and optional `styles.css`.

## Themes

- Target: Obsidian Community Theme (CSS/SCSS).
- Entry point: `theme.css` (or compiled from SCSS) loaded by Obsidian.
- Required release artifacts: `manifest.json` and `theme.css`.
- Optional: `snippets/` directory for theme snippets.


