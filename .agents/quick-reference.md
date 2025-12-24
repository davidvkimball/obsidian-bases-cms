<!--
Source: Condensed from all reference documentation
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Update as workflows evolve
-->

# Quick Reference

One-page cheat sheet for common Obsidian plugin development tasks.

## Quick Commands

**One-word or short commands that trigger automatic actions:**

| Command | Action |
|---------|--------|
| `build` | Run `pnpm build` to compile TypeScript |
| `sync` or `quick sync` | Pull latest changes from all 6 core `.ref` repos |
| `what's the latest` or `check updates` | Check what's new in reference repos (read-only, then ask to pull) |
| `release ready?` | Run comprehensive release readiness checklist |
| `summarize` | Generate git commit message from all changes since last tag (or uncommitted if no tag) |
| `summarize for release` | Generate markdown release notes for GitHub |
| `bump the version` or `bump version` | Bump version by 0.0.1 (patch) by default, or specify: `patch`, `minor`, `major`, or exact version |
| `add ref [name]` | Add a reference project (external URL or local path) |
| `check API [feature]` | Look up a feature in `.ref/obsidian-api/obsidian.d.ts` |

**Usage examples:**
- `build` → Runs build command automatically
- `sync` → Pulls latest from all core repos automatically
- `bump the version` → Bumps version by 0.0.1 (patch) in package.json and manifest.json
- `bump version minor` → Bumps minor version (e.g., 1.0.0 → 1.1.0)
- `bump version major` → Bumps major version (e.g., 1.0.0 → 2.0.0)
- `add ref my-plugin https://github.com/user/my-plugin.git` → Clones external repo
- `add ref ../my-local-plugin` → Creates symlink to local project
- `check API SettingGroup` → Searches obsidian.d.ts for SettingGroup

**Note**: These commands are interpreted by AI agents and execute the corresponding workflows automatically. See detailed documentation in [AGENTS.md](../AGENTS.md) for full workflows.

## Build Commands

```powershell
pnpm build    # Build plugin (compile TypeScript to JavaScript)
pnpm dev      # Development build with watch mode
```

**Always run build after making changes** to catch errors early. See [build-workflow.md](build-workflow.md).

## File Paths

**Plugin location** (in vault):
```
<Vault>/.obsidian/plugins/<plugin-id>/
  ├── main.js          # Compiled plugin code
  ├── manifest.json    # Plugin manifest
  └── styles.css       # Plugin styles (if any)
```

**Build output**: Must be at top level of plugin folder in vault.

## Common API Patterns

### Command
```ts
this.addCommand({
  id: "command-id",
  name: "Command name",
  callback: () => { /* ... */ }
});
```

### Settings Tab
```ts
class MySettingTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Setting")
      .addText((text) => text.onChange(async (value) => {
        this.plugin.settings.value = value;
        await this.plugin.saveSettings();
      }));
  }
}
this.addSettingTab(new MySettingTab(this.app, this));
```

### Settings Groups (Conditional for 1.11.0+)
```ts
// Use compatibility utility for backward compatibility
import { createSettingsGroup } from "./utils/settings-compat";

const group = createSettingsGroup(containerEl, "Group Name");
group.addSetting((setting) => {
  setting.setName("Setting").addToggle(/* ... */);
});
```
See [code-patterns.md](code-patterns.md) for full implementation.

### Modal
```ts
class MyModal extends Modal {
  onOpen() { this.contentEl.setText("Content"); }
  onClose() { this.contentEl.empty(); }
}
new MyModal(this.app).open();
```

### Status Bar
```ts
const item = this.addStatusBarItem();
item.setText("Status text");
```

### Ribbon Icon
```ts
this.addRibbonIcon("icon-name", "Tooltip", () => { /* ... */ });
```

## Git Workflow

**Commit message format** (from [summarize-commands.md](summarize-commands.md)):
```
[Summary of changes]
- [detailed item 1]
- [detailed item 2]
```

**Release notes format** (markdown):
```markdown
### Release v1.2.0 - Title

### Features
- Feature description

### Improvements
- Improvement description
```

## Release Preparation

**Before releasing** (plugins only):
- Run release readiness check: See [release-readiness.md](release-readiness.md)
- Verify all checklist items (platform testing, files, policies, etc.)
- Ensure LICENSE file exists and third-party code is properly attributed

See [versioning-releases.md](versioning-releases.md) for release process.

## Sync Reference Repos

**Quick pull all 6 core repos** (from [quick-sync-guide.md](quick-sync-guide.md)):
```bash
# Navigate to central .ref location (adjust path as needed)
cd ../.ref/obsidian-dev  # or cd ~/Development/.ref/obsidian-dev

# Pull all repos
cd obsidian-api && git pull && cd ..
cd obsidian-sample-plugin && git pull && cd ..
cd obsidian-developer-docs && git pull && cd ..
cd obsidian-plugin-docs && git pull && cd ..
cd obsidian-sample-theme && git pull && cd ..
cd eslint-plugin && git pull && cd ..
```

**Note**: If using symlinks, navigate to the actual target location (usually `..\.ref\obsidian-dev`) before running git commands. See [quick-sync-guide.md](quick-sync-guide.md) for setup detection.

## API Authority

**Always check `.ref/obsidian-api/obsidian.d.ts` first** - it's the authoritative source. Plugin docs and developer docs may be outdated.

## Testing

**Manual installation**:
1. Build plugin (`pnpm build`)
2. Copy `main.js`, `manifest.json`, and `styles.css` (if any) to vault `.obsidian/plugins/<plugin-id>/`
3. Enable plugin in Obsidian: **Settings → Community plugins**
4. Reload Obsidian (Ctrl+R / Cmd+R)

See [testing.md](testing.md) for details.

## Linting: Promise in Void Context

**Quick Fix Guide** - When you see "Promise returned in function argument where a void return was expected":

| Error Location | Cause | Fix |
|----------------|-------|-----|
| `addSetting` line (from `SettingGroup`/`createSettingsGroup`) | Callback returns `Setting` instead of `void` | Use block body `{ }` instead of expression body |
| `onChange` line | Callback returns Promise | Make async + await, or use `void` operator |
| `addToggle` line | Callback returns Promise | Use block body `{ }` |

**Quick Fix**: If error is on `addSetting`/`addToggle`, change `=>` to `=> { ... }`

**Example**:
```typescript
// ❌ Wrong - Expression body (only affects SettingGroup.addSetting)
group.addSetting(setting => setting.setName("Feature"));

// ✅ Correct - Block body
group.addSetting(setting => { setting.setName("Feature"); });

// ✅ This works fine - Direct Setting usage (most common pattern)
new Setting(containerEl)
  .setName("Feature")
  .addToggle(toggle => toggle.onChange(async (value) => { ... }));
```

**Note**: The `addSetting` issue only applies when using `SettingGroup` or `createSettingsGroup()`. Direct `new Setting(containerEl)` usage (the most common pattern) doesn't have this restriction.

See [linting-fixes-guide.md](linting-fixes-guide.md#critical-addsetting-callbacks-must-return-void) for detailed explanation.

## Common File Structure

```
src/
  main.ts
  settings.ts
  commands/
  ui/
manifest.json
package.json
```

See [file-conventions.md](file-conventions.md) for details.

