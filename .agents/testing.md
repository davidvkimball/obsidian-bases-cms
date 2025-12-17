<!--
Source: Based on Obsidian Sample Plugin and Sample Theme
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin and Sample Theme repos for updates
Applicability: Plugin / Theme
-->

# Testing

## Plugins

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if any) to:
  ```
  <Vault>/.obsidian/plugins/<plugin-id>/
  ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

**Platform testing**: Before release, test on all applicable platforms (Windows, macOS, Linux, Android, iOS). See [release-readiness.md](release-readiness.md) for the complete testing checklist.

## Themes

- Manual install for testing: copy `manifest.json` and `theme.css` to:
  ```
  <Vault>/.obsidian/themes/<theme-name>/
  ```
- Reload Obsidian and select the theme in **Settings → Appearance → Themes**.

**Platform testing**: Before release, test on all applicable platforms (Windows, macOS, Linux, Android, iOS). See [release-readiness.md](release-readiness.md) for the complete testing checklist.


