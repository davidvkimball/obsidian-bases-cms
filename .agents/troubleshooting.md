<!--
Source: Based on Obsidian community troubleshooting
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Update as common issues are identified
-->

# Troubleshooting

**Source**: Based on common errors from developer docs, community patterns, and API best practices. Always verify API details in `.ref/obsidian-api/obsidian.d.ts`.

### Build and Loading Issues

- **Plugin doesn't load after build**: Ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`.
- **Build issues**: If `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- **TypeScript compilation errors**: Check `tsconfig.json` settings, ensure `"strict": true` is handled properly, verify all imports are correct.
- **Module not found errors**: Ensure all dependencies are in `package.json` and run `npm install`. Check that imports use correct paths.

### Command Issues

- **Commands not appearing**: Verify `addCommand` runs after `onload` completes, and command IDs are unique.
- **Command not executing**: Check that callback/editorCallback/checkCallback is properly defined and not throwing errors.
- **Command only works sometimes**: If using `checkCallback`, ensure it returns `true` when the command should be available.

### Settings Issues

- **Settings not persisting**: Ensure `loadData`/`saveData` are awaited. Check that `saveSettings()` is called after changes.
- **Settings not loading**: Verify `loadSettings()` is called in `onload()` and properly awaited.
- **Settings UI not updating**: Call `display()` after changing settings that affect the UI.
- **Settings structure changed**: Old saved data may not match new interface. Add migration logic or reset settings.

### View Issues

- **Views not appearing**: Verify `registerView()` is called in `onload()`, and view type constant matches.
- **Views not cleaning up**: Ensure `detachLeavesOfType()` is called in `onunload()`.
- **View errors**: Never store view references. Use `getLeavesOfType()` to access views.

### Mobile Issues

- **Mobile-only issues**: Confirm you're not using desktop-only APIs; check `isDesktopOnly` in `manifest.json` and adjust.
- **Status bar not working on mobile**: Status bar items are not supported on mobile. Use feature detection.

## AI Agent Issues

### .ref Folder Not Found

**Problem**: AI agent can't find `.ref` folder when searching.

**Solution**:
- The `.ref` folder is gitignored and may be hidden
- Use `list_dir` with the project root to see hidden directories
- Use `glob_file_search` with pattern `.ref/**` to search recursively
- Try direct paths like `.ref/obsidian-api/README.md`
- See [ref-instructions.md](ref-instructions.md) for detailed search strategies

**For AI agents**: When user asks about `.ref`, actively search using multiple methods. Don't assume it doesn't exist if first search fails.

## Common Error Messages

### TypeScript Errors

- **"Property does not exist on type"**: Check API types in `.ref/obsidian-api/obsidian.d.ts`. Plugin docs may be outdated.
- **"Cannot find module 'obsidian'"**: Ensure `obsidian` is in `package.json` dependencies (usually `"obsidian": "latest"`).
- **"Type 'undefined' is not assignable"**: Add proper null checks or provide defaults for optional properties.

### Runtime Errors

- **"Cannot read property of undefined"**: Add null checks before accessing properties. Verify objects are initialized.
- **"Plugin failed to load"**: Check browser console (Help → Toggle Developer Tools) for detailed error messages.
- **"Settings failed to load"**: Check that settings file isn't corrupted. Handle errors in `loadSettings()`.

### Build Errors

- **"Cannot find name"**: Check imports, ensure all dependencies are installed.
- **"Module not found"**: Verify file paths in imports are correct relative to source files.

## Debugging Techniques

### Console Logging

```ts
// Log plugin state
console.log("Plugin loaded:", this);
console.log("Settings:", this.settings);

// Log in event handlers
this.app.workspace.on("file-open", (file) => {
  console.log("File opened:", file.path);
});
```

### Inspect Plugin State

Open browser console (Help → Toggle Developer Tools) and inspect:
```javascript
// Access your plugin instance
app.plugins.plugins['your-plugin-id']
```

### Check Settings File

Settings are stored at:
```
<Vault>/.obsidian/plugins/<plugin-id>/data.json
```

You can manually inspect this file (backup first!) to see what's saved.

### Verify API Usage

Always check `.ref/obsidian-api/obsidian.d.ts` for:
- Correct method signatures
- Available properties
- New features (e.g., `SettingGroup` since 1.11.0)
- Deprecated methods

Plugin docs may not reflect the latest API changes.

## Settings Issues (Detailed)

### Settings Not Saving

**Symptoms**: Changes don't persist after restart.

**Causes**:
1. Not awaiting `saveData()`
2. Settings object structure changed
3. File permissions issue

**Solution**:
```ts
async saveSettings() {
  await this.saveData(this.settings); // Must await!
}
```

### Settings Not Loading

**Symptoms**: Settings always use defaults.

**Causes**:
1. `loadSettings()` not called or not awaited
2. Settings file doesn't exist (first run)
3. Settings file corrupted

**Solution**:
```ts
async onload() {
  await this.loadSettings(); // Must be called and awaited
}

async loadSettings() {
  try {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  } catch (error) {
    console.error("Failed to load settings:", error);
    this.settings = { ...DEFAULT_SETTINGS };
  }
}
```

### Settings UI Not Updating

**Symptoms**: Settings tab doesn't reflect changes.

**Solution**: Call `display()` after changing settings:
```ts
.onChange(async (value) => {
  this.plugin.settings.value = value;
  await this.plugin.saveSettings();
  this.display(); // Re-render settings tab
})
```

## View Issues (Detailed)

### Views Not Appearing

**Checklist**:
1. `registerView()` called in `onload()`?
2. View type constant matches?
3. `activateView()` method called?
4. View class properly extends `ItemView`?

### Views Not Cleaning Up

**Solution**: Always detach in `onunload()`:
```ts
async onunload() {
  this.app.workspace.detachLeavesOfType(VIEW_TYPE_MY_VIEW);
}
```

### View Reference Errors

**Problem**: Storing view references causes issues.

**Solution**: Always use `getLeavesOfType()`:
```ts
// Don't store: let myView: MyView;
// Instead:
const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_VIEW);
```

## Build Issues (Detailed)

### Missing main.js

**Cause**: Build didn't run or failed.

**Solution**: 
1. Run `npm run build`
2. Check for TypeScript errors
3. Verify `esbuild.config.mjs` or build config is correct

### TypeScript Compilation Errors

**Common causes**:
- Missing type definitions
- Incorrect import paths
- Strict mode type errors

**Solution**: 
1. Check `tsconfig.json` settings
2. Verify all imports are correct
3. Add proper type annotations
4. Check `.ref/obsidian-api/obsidian.d.ts` for correct types


