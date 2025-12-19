<!--
Source: Based on Obsidian community guidelines
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian releases repo for validation requirements
-->

# Manifest rules (`manifest.json`)

### Required Fields

All plugins must include these fields in `manifest.json`:

- **`id`** (string, required) - Unique plugin identifier. Should be lowercase with hyphens (e.g., `"my-plugin-name"`). For local development, it should match the folder name. **Never change `id` after release** - treat it as stable API.
- **`name`** (string, required) - Display name of the plugin (e.g., `"My Plugin Name"`)
- **`version`** (string, required) - Semantic Versioning format `x.y.z` (e.g., `"1.0.0"`, `"0.9.3"`)
- **`minAppVersion`** (string, required) - Minimum Obsidian version required (e.g., `"0.15.0"`). Keep this accurate when using newer APIs.
- **`description`** (string, required) - Brief description of what the plugin does
- **`isDesktopOnly`** (boolean, required) - Set to `false` if the plugin works on mobile, `true` if desktop-only

### Optional Fields

- **`author`** (string, optional) - Author name
- **`authorUrl`** (string, optional) - URL to author's website or profile
- **`fundingUrl`** (string, optional) - URL for funding/support (e.g., Patreon, Ko-fi, GitHub Sponsors)

### Example Structure

```json
{
	"id": "your-plugin-id",
	"name": "Your Plugin Name",
	"version": "1.0.0",
	"minAppVersion": "0.15.0",
	"description": "A brief description of what your plugin does.",
	"author": "Your Name",
	"authorUrl": "https://yourwebsite.com",
	"fundingUrl": "https://your-funding-url.com",
	"isDesktopOnly": false
}
```

### Important Notes

- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Use semantic versioning for `version` field.
- Canonical requirements: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Validation Checklist

When reviewing or creating a `manifest.json` file, ensure:

- [ ] All required fields are present (`id`, `name`, `version`, `minAppVersion`, `description`, `isDesktopOnly`)
- [ ] `id` uses lowercase with hyphens, matches folder name
- [ ] `version` follows semantic versioning (x.y.z)
- [ ] `minAppVersion` is set appropriately for the APIs used
- [ ] `isDesktopOnly` is set correctly based on mobile compatibility
- [ ] JSON syntax is valid (proper quotes, commas, brackets)
- [ ] All string values are properly quoted
- [ ] Boolean values are `true` or `false` (not strings)


