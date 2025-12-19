<!--
Source: Based on Obsidian developer docs warnings, community patterns, and API best practices
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Update as common issues are identified
-->

# Common Pitfalls

This document covers common mistakes and gotchas when developing Obsidian plugins. Always verify API details in `.ref/obsidian-api/obsidian.d.ts` as it's the authoritative source.

## Async/Await Issues

**Problem**: Forgetting to await `loadData()` or `saveData()` causes settings not to persist.

**Wrong**:
```ts
onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, this.loadData()); // Missing await!
}
```

**Correct**:
```ts
async onload() {
  await this.loadSettings(); // Properly awaited
}

async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}
```

**Also**: Always await `saveData()`:
```ts
async saveSettings() {
  await this.saveData(this.settings); // Don't forget await!
}
```

## Settings Object.assign Gotcha

**Source**: Warning from `.ref/obsidian-developer-docs/en/Plugins/User interface/Settings.md`

**Problem**: `Object.assign()` performs a shallow copy. Nested properties share references, causing changes to affect all copies.

**Wrong** (with nested properties):
```ts
interface MySettings {
  nested: { value: string };
}

const DEFAULT_SETTINGS: MySettings = {
  nested: { value: "default" }
};

// This creates a shallow copy - nested properties share references!
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
```

**Correct**: Use deep copy for nested properties:
```ts
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
// Deep copy nested properties:
if (!this.settings.nested) {
  this.settings.nested = { ...DEFAULT_SETTINGS.nested };
}
```

Or use a deep merge utility for complex nested structures.

## Listener Cleanup

**Problem**: Not using `registerEvent()`, `registerDomEvent()`, or `registerInterval()` causes memory leaks when the plugin unloads.

**Wrong**:
```ts
onload() {
  this.app.workspace.on("file-open", this.handleFileOpen); // Not registered!
  window.addEventListener("resize", this.handleResize); // Not registered!
  setInterval(this.updateStatus, 1000); // Not registered!
}
```

**Correct**:
```ts
onload() {
  this.registerEvent(this.app.workspace.on("file-open", this.handleFileOpen));
  this.registerDomEvent(window, "resize", this.handleResize);
  this.registerInterval(setInterval(this.updateStatus, 1000));
}
```

All registered events/intervals are automatically cleaned up when the plugin unloads.

## Settings Not Updating UI

**Problem**: Changing settings but the settings tab UI doesn't reflect the change.

**Solution**: Call `display()` after updating settings that affect the UI:

```ts
new Setting(containerEl)
  .setName("Toggle setting")
  .addToggle((toggle) =>
    toggle
      .setValue(this.plugin.settings.enabled)
      .onChange(async (value) => {
        this.plugin.settings.enabled = value;
        await this.plugin.saveSettings();
        this.display(); // Re-render settings tab
      })
  );
```

## Settings Tab Scroll Jump

**Problem**: When using conditional settings (showing/hiding settings based on other settings), calling `this.display()` causes the settings tab to jump to the top, losing the user's scroll position.

**Why it happens**: `display()` calls `containerEl.empty()`, which removes all content and rebuilds the settings tab from scratch, resetting the scroll position to the top.

**Solution**: Preserve scroll position when re-rendering:

```ts
new Setting(containerEl)
  .setName("Toggle setting")
  .addToggle((toggle) =>
    toggle
      .setValue(this.plugin.settings.enabled)
      .onChange(async (value) => {
        this.plugin.settings.enabled = value;
        await this.plugin.saveSettings();
        
        // Save scroll position before re-rendering
        const scrollContainer = containerEl.closest('.vertical-tab-content') || 
                                containerEl.closest('.settings-content') || 
                                containerEl.parentElement;
        const scrollTop = scrollContainer?.scrollTop || 0;
        
        this.display(); // Re-render settings tab
        
        // Restore scroll position after rendering
        requestAnimationFrame(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollTop;
          }
        });
      })
  );
```

**Alternative approach**: Instead of calling `this.display()`, conditionally show/hide specific settings elements without rebuilding the entire tab. This avoids scroll issues but requires more code to manage visibility:

```ts
// Show/hide settings without re-rendering entire tab
const conditionalSetting = containerEl.querySelector('.conditional-setting');
if (conditionalSetting) {
  // Use CSS classes or setCssProps instead of direct style manipulation
  conditionalSetting.toggleClass('hidden', !this.plugin.settings.enabled);
  // Or: setCssProps(conditionalSetting, { display: this.plugin.settings.enabled ? 'block' : 'none' });
}
```

## View Management

**Source**: Warning from `.ref/obsidian-plugin-docs/docs/guides/custom-views.md`

**Problem**: Storing references to views causes issues because Obsidian may call the view factory function multiple times.

**Wrong**:
```ts
let myView: MyView; // Don't store view references!

onload() {
  this.registerView(VIEW_TYPE_MY_VIEW, (leaf) => {
    myView = new MyView(leaf); // BAD: Storing reference
    return myView;
  });
}
```

**Correct**: Always use `getLeavesOfType()` to access views:

```ts
onload() {
  this.registerView(VIEW_TYPE_MY_VIEW, (leaf) => new MyView(leaf));
}

// Access views when needed:
const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_VIEW);
leaves.forEach((leaf) => {
  if (leaf.view instanceof MyView) {
    // Access view instance
  }
});
```

## Mobile vs Desktop APIs

**Problem**: Using desktop-only APIs without setting `isDesktopOnly: true` in `manifest.json`.

**Solution**: 
- Check if an API is desktop-only in `.ref/obsidian-api/obsidian.d.ts`
- Set `isDesktopOnly: true` in `manifest.json` if using Node.js/Electron APIs
- Or use feature detection and provide mobile alternatives

**Example**: Status bar items don't work on mobile. Check before using:
```ts
// Status bar is desktop-only
if (this.app.isMobile) {
  // Use alternative UI for mobile
} else {
  const statusBarItemEl = this.addStatusBarItem();
  statusBarItemEl.setText("Status");
}
```

## TypeScript Strict Mode

**Problem**: Common type errors when using strict TypeScript.

**Common issues**:
- `Object.assign()` may not satisfy strict null checks - use proper typing
- Event handlers may have `undefined` types - add null checks
- Settings may be `undefined` on first load - provide defaults
- Using `any` type defeats TypeScript's type safety - avoid explicit `any`

**Solution**: Always provide proper defaults and type guards:

```ts
interface MySettings {
  value: string;
}

const DEFAULT_SETTINGS: MySettings = {
  value: "",
};

async loadSettings() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  // Now this.settings.value is always defined
}
```

**Avoid `any` type**: Prefer proper types, `unknown`, or type assertions:

**Wrong**:
```ts
function processData(data: any) { // Avoid any!
  return data.value;
}
```

**Correct** - Use proper types:
```ts
interface Data {
  value: string;
}

function processData(data: Data) {
  return data.value;
}
```

**Correct** - Use `unknown` when type is truly unknown:
```ts
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data');
}
```

**Correct** - Use type assertions when you know the type:
```ts
const result = someApiCall() as MyType;
```

## Command ID Stability

**Problem**: Changing command IDs after release breaks user keybindings.

**Solution**: Use stable command IDs. Once released, never change them. If you need to rename, keep the old ID and add a new one, or use aliases.

## Forgetting to Clean Up Views

**Problem**: Views remain in workspace after plugin unloads.

**Solution**: Always detach views in `onunload()`:

```ts
async onunload() {
  this.app.workspace.detachLeavesOfType(VIEW_TYPE_MY_VIEW);
}
```

## main.ts File Location

**Problem**: Having `main.ts` in both the project root AND `src/` directory, which causes build confusion and errors.

**Acceptable** (simple plugins):
```
project-root/
  main.ts           # ✅ OK for very simple plugins (like sample plugin template)
  manifest.json
```

**Also Acceptable** (recommended for most plugins):
```
project-root/
  src/
    main.ts         # ✅ Recommended for plugins with multiple files
    settings.ts
    commands/
```

**Wrong** (duplicate - causes build errors):
```
project-root/
  main.ts           # ❌ Don't have it in both places
  src/
    main.ts         # ❌ This causes build confusion and errors
```

**Why this matters**:
- Having `main.ts` in both locations causes ambiguity - build tools don't know which one to use
- This leads to build errors, confusion about which file is being compiled
- The compiled `main.js` always outputs to `main.js` in the root directory
- You should have only ONE source `main.ts`

**Solution**: 
- For simple plugins: Keep `main.ts` in root (like the sample plugin template)
- For plugins with multiple files: Move `main.ts` to `src/` and organize all source files there
- **Never have `main.ts` in both locations** - choose one location and stick with it
- If you see `main.ts` in both places, remove one (preferably keep it in `src/` for better organization)

## Settings Not Persisting

**Problem**: Settings appear to save but don't persist after restart.

**Common causes**:
1. Not awaiting `saveData()`
2. Settings object structure changed (old data doesn't match new interface)
3. Settings file is corrupted or locked

**Solution**: 
- Always await `saveData()`
- Use migration logic if settings structure changes
- Handle errors when loading settings:

```ts
async loadSettings() {
  try {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  } catch (error) {
    console.error("Failed to load settings:", error);
    this.settings = { ...DEFAULT_SETTINGS };
  }
}
```

## Common Linting Issues

**Source**: Based on `eslint-plugin-obsidianmd` (npm package) rules and Obsidian plugin review requirements. The repository is at `.ref/eslint-plugin/` - see its README and rule documentation for complete details.

**Note**: Install and configure `eslint-plugin-obsidianmd` in your project to catch these issues automatically. See [environment.md](environment.md) for setup instructions.

### Setting Styles Directly on DOM Elements

**Problem**: Setting styles via `element.style.*` with static literals prevents proper theming and maintainability.

**Wrong**:
```ts
element.style.display = 'block';
element.style.opacity = '0.5';
element.style.marginTop = '10px';
element.style.setProperty('color', 'red');
element.setAttribute('style', 'color: red;');
```

**Correct**: Use CSS classes or `setCssProps()`:
```ts
// Option 1: CSS classes (preferred)
element.addClass('my-custom-class');

// Option 2: setCssProps for dynamic styles
import { setCssProps } from 'obsidian';
setCssProps(element, {
  display: 'block',
  opacity: '0.5',
  marginTop: '10px'
});
```

**Note**: The ESLint rule only flags static literal assignments. Dynamic values (from variables or template literals) are allowed, but CSS classes are still preferred.

**ESLint rule**: `no-static-styles-assignment` (from `eslint-plugin-obsidianmd`)

### Manual HTML Headings in Settings

**Problem**: Creating HTML heading elements directly in settings tabs instead of using the Settings API.

**Wrong**:
```ts
containerEl.createEl('h2', { text: 'My Settings' });
containerEl.createEl('h3', { text: 'General' });
```

**Correct**: Use `Setting.setHeading()`:
```ts
new Setting(containerEl)
  .setHeading('My Settings');

new Setting(containerEl)
  .setHeading('General');
```

**ESLint rule**: `settings-tab/no-manual-html-headings` (from `eslint-plugin-obsidianmd`)

### UI Text Not in Sentence Case

**Problem**: UI text should use sentence case for consistency with Obsidian's design system. See [ux-copy.md](ux-copy.md) for complete UX guidelines.

**Wrong**:
```ts
.setName("Enable Feature")
.setDesc("This Feature Does Something")
```

**Correct**: Use sentence case:
```ts
.setName("Enable feature")
.setDesc("This feature does something")
```

**ESLint rule**: `ui/sentence-case` (from `eslint-plugin-obsidianmd`)

### Using Vault.delete() Instead of FileManager.trashFile()

**Problem**: `Vault.delete()` doesn't respect user's file deletion preferences (trash vs. permanent delete).

**Wrong**:
```ts
await this.app.vault.delete(file);
```

**Correct**: Use `FileManager.trashFile()`:
```ts
await this.app.fileManager.trashFile(file);
```

**ESLint rule**: `prefer-file-manager-trash-file` (from `eslint-plugin-obsidianmd`)

### addSetting Callback Return Type

**Problem**: Using expression body arrow functions with `addSetting` from `createSettingsGroup()` or `SettingGroup` causes "Promise returned in function argument" errors.

**When This Applies**: This only affects plugins using `SettingGroup` (API 1.11.0+) or the `createSettingsGroup()` compatibility utility. If you use `new Setting(containerEl)` directly (the most common pattern), you don't have this issue.

**Wrong**:
```typescript
group.addSetting(setting =>
  setting.setName("Feature").addToggle(toggle => {
    toggle.onChange(async (value) => {
      await this.plugin.saveData(this.plugin.settings);
    });
  })
);
```

**Why It Fails**: The expression body returns the result of the chain (a `Setting` object), but `addSetting` expects a callback that returns `void`. The type signature is `addSetting(cb: (setting: Setting) => void)`, so expression body syntax violates this contract.

**Correct**:
```typescript
group.addSetting(setting => {
  setting.setName("Feature").addToggle(toggle => {
    toggle.onChange(async (value) => {
      await this.plugin.saveData(this.plugin.settings);
    });
  });
});
```

**Rule**: Always use block body `{ }` with `addSetting` when using `createSettingsGroup()`. This ensures the callback returns `void` as expected.

**See also**: [linting-fixes-guide.md](linting-fixes-guide.md#critical-addsetting-callbacks-must-return-void) for detailed explanation and troubleshooting.

**ESLint rule**: `no-floating-promises` / `promise-return-in-void-context` (from `eslint-plugin-obsidianmd`)

### Disabling TypeScript Rules for `any`

**Problem**: Disabling `@typescript-eslint/no-explicit-any` defeats TypeScript's type safety.

**Wrong**:
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function process(data: any) { }
```

**Correct**: Use proper types or `unknown`:
```ts
function process(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // Type guard and process
  }
}
```

### Async Functions Without Await

**Problem**: Marking functions as `async` but never using `await` is unnecessary and can cause confusion.

**Wrong**:
```ts
async handleClick() {
  this.doSomething(); // No await needed
}
```

**Correct**: Remove `async` if not needed, or use `await`:
```ts
handleClick() {
  this.doSomething();
}

// Or if you need async:
async handleClick() {
  await this.doSomethingAsync();
}
```

### Awaiting Non-Promise Values

**Problem**: Using `await` on values that aren't Promises is unnecessary and can cause confusion.

**Wrong**:
```ts
const value = await this.getSetting(); // getSetting() returns string, not Promise
```

**Correct**: Only await Promises:
```ts
const value = this.getSetting(); // No await needed
```

### Console Statements

**Problem**: Using `console.log()` in production code. Only `console.warn()`, `console.error()`, and `console.debug()` are allowed.

**Wrong**:
```ts
console.log("Debug info");
```

**Correct**: Use appropriate console method:
```ts
console.debug("Debug info"); // For development debugging
console.warn("Warning message");
console.error("Error message");
```

### Using Deprecated APIs

**Problem**: Using deprecated Obsidian APIs that may be removed in future versions.

**Example**: `activeLeaf` is deprecated. Use `getActiveViewOfType()` or `getLeaf()` instead.

**Wrong**:
```ts
const leaf = this.app.workspace.activeLeaf;
```

**Correct**:
```ts
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
// Or for navigation:
const leaf = this.app.workspace.getLeaf();
```

**Solution**: Always check `.ref/obsidian-api/obsidian.d.ts` for deprecated warnings and use recommended alternatives.

### Object Stringification Issues

**Problem**: Stringifying objects directly results in `[object Object]` instead of useful output.

**Wrong**:
```ts
const tags = { tag1: 'value1', tag2: 'value2' };
console.log(`Tags: ${tags}`); // Outputs: "Tags: [object Object]"
```

**Correct**: Use `JSON.stringify()` or access specific properties:
```ts
console.log(`Tags: ${JSON.stringify(tags)}`);
// Or:
console.log(`Tags: ${Object.keys(tags).join(', ')}`);
```

### Unnecessary Type Assertions

**Problem**: Type assertions that don't change the type are unnecessary and should be removed.

**Wrong**:
```ts
const value: string = "test";
const result = value as string; // Unnecessary - value is already string
```

**Correct**: Remove unnecessary assertions:
```ts
const value: string = "test";
const result = value; // No assertion needed
```

### Promise Rejection Should Be Error

**Problem**: Rejecting Promises with non-Error values makes error handling difficult.

**Wrong**:
```ts
Promise.reject("Something went wrong");
```

**Correct**: Always reject with Error objects:
```ts
Promise.reject(new Error("Something went wrong"));
```

### Using require() Instead of import

**Problem**: CommonJS `require()` style imports are not allowed in modern TypeScript/ES modules.

**Wrong**:
```ts
const fs = require('fs');
```

**Correct**: Use ES module imports:
```ts
import * as fs from 'fs';
```

### Using hasOwnProperty Directly

**Problem**: Accessing `hasOwnProperty` directly from objects can fail if the object has a null prototype.

**Wrong**:
```ts
if (obj.hasOwnProperty('key')) { }
```

**Correct**: Use `Object.prototype.hasOwnProperty.call()` or `Object.hasOwn()`:
```ts
if (Object.prototype.hasOwnProperty.call(obj, 'key')) { }
// Or (modern):
if (Object.hasOwn(obj, 'key')) { }
```

### Type Casting to TFile or TFolder

**Problem**: Type casting to `TFile` or `TFolder` is unsafe and can cause runtime errors.

**Wrong**:
```ts
const file = abstractFile as TFile;
file.basename; // May fail if abstractFile is actually a TFolder
```

**Correct**: Use `instanceof` checks to safely narrow the type:
```ts
if (abstractFile instanceof TFile) {
  abstractFile.basename; // Safe - TypeScript knows it's a TFile
} else if (abstractFile instanceof TFolder) {
  // Handle folder case
}
```

**ESLint rule**: `no-tfile-tfolder-cast` (from `eslint-plugin-obsidianmd`)

### Iterating All Files to Find by Path

**Problem**: Iterating through all files to find one by path is inefficient and slow.

**Wrong**:
```ts
const file = this.app.vault.getFiles().find(f => f.path === 'path/to/file.md');
```

**Correct**: Use `getAbstractFileByPath()` for direct lookup:
```ts
const file = this.app.vault.getAbstractFileByPath('path/to/file.md');
if (file instanceof TFile) {
  // Use file
}
```

**ESLint rule**: `vault/iterate` (from `eslint-plugin-obsidianmd`) - automatically fixable

### Using Navigator API for OS Detection

**Problem**: Using `navigator` API for OS detection is unreliable and not recommended.

**Wrong**:
```ts
const isMac = navigator.platform.includes('Mac');
```

**Correct**: Use Obsidian's built-in platform detection:
```ts
// Check if mobile
if (this.app.isMobile) { }

// Check platform via app (if available in API)
// Or use feature detection instead of OS detection
```

**ESLint rule**: `platform` (from `eslint-plugin-obsidianmd`)

### Using Custom TextInputSuggest Instead of AbstractInputSuggest

**Problem**: Using a custom `TextInputSuggest` implementation when Obsidian provides `AbstractInputSuggest`.

**Wrong**: Copying a custom `TextInputSuggest` implementation.

**Correct**: Use Obsidian's built-in `AbstractInputSuggest`:
```ts
import { AbstractInputSuggest } from 'obsidian';

class MySuggest extends AbstractInputSuggest<string> {
  // Implement required methods
  getSuggestions(inputStr: string): string[] {
    // Return suggestions
  }
  renderSuggestion(item: string, el: HTMLElement): void {
    // Render suggestion
  }
  selectSuggestion(item: string): void {
    // Handle selection
  }
}
```

**ESLint rule**: `prefer-abstract-input-suggest` (from `eslint-plugin-obsidianmd`)

### Using Regex Lookbehinds

**Problem**: Regex lookbehinds are not supported in some iOS versions, causing plugins to fail on mobile.

**Wrong**:
```ts
const regex = /(?<=prefix)match/; // Lookbehind not supported on iOS
```

**Correct**: Rewrite regex without lookbehinds:
```ts
const regex = /prefix(match)/; // Use capturing group instead
const match = text.match(regex);
if (match) {
  const result = match[1]; // Get captured group
}
```

**ESLint rule**: `regex-lookbehind` (from `eslint-plugin-obsidianmd`)

