<!--
Source: Based on Obsidian Sample Plugin and community plugin guidelines
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin repo for updates
Applicability: Plugin
-->

# Commands & settings

**Note**: This file is specific to plugin development. Themes do not have commands or settings.

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Settings tabs

These projects target `minAppVersion: "1.11.0"` or later, so `SettingGroup` is always available — use it directly, with no `requireApiVersion()` guards or pre-1.11 fallbacks.

For authoring or migrating a `PluginSettingTab`, use the **`settings` skill**. It is the authoritative reference for the declarative `getSettingDefinitions()` API (Obsidian 1.13+) and the optional `display()` fallback for supporting older app versions. Do not hand-roll settings guidance here.


