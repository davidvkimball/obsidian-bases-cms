<!--
Source: Created to document fixes for Obsidian plugin linting issues
Last synced: N/A - Project-specific documentation
Update frequency: Update as new linting issues are identified
Applicability: Plugin
-->

# Linting Fixes Guide

This guide provides specific fixes for common linting issues detected by `eslint-plugin-obsidianmd`. Use this when fixing issues in your plugin code.

## Table of Contents

1. [Promise Handling](#promise-handling)
2. [Command ID and Name](#command-id-and-name)
3. [Style Element Creation](#style-element-creation)
4. [Direct Style Manipulation](#direct-style-manipulation)
5. [Unnecessary Type Assertions](#unnecessary-type-assertions)
6. [Promise Return in Void Context](#promise-return-in-void-context)
7. [Object Stringification](#object-stringification)
8. [Navigator API Usage](#navigator-api-usage)
9. [Unused Imports](#unused-imports)

---

## Promise Handling

**Issue**: Promises must be awaited, have `.catch()`, or be marked with `void` operator.

**Error Message**: "Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator."

### Fix Options

#### Option 1: Await the Promise (Recommended)
```typescript
// ❌ Wrong
this.loadData();
this.saveData(this.settings);

// ✅ Correct
await this.loadData();
await this.saveSettings();
```

#### Option 2: Add Error Handling with .catch()
```typescript
// ❌ Wrong
this.loadData();

// ✅ Correct
this.loadData().catch((error) => {
  console.error("Failed to load data:", error);
});
```

#### Option 3: Mark as Intentionally Ignored with void
```typescript
// ❌ Wrong
this.loadData();

// ✅ Correct (when you intentionally want to fire-and-forget)
void this.loadData();
```

### Common Patterns

**Settings Loading:**
```typescript
// ❌ Wrong
async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, this.loadData());
}

// ✅ Correct
async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}
```

**Settings Saving:**
```typescript
// ❌ Wrong
onChange(async (value) => {
  this.plugin.settings.enabled = value;
  this.plugin.saveData(this.plugin.settings);
});

// ✅ Correct
onChange(async (value) => {
  this.plugin.settings.enabled = value;
  await this.plugin.saveData(this.plugin.settings);
});
```

**File Operations:**
```typescript
// ❌ Wrong
this.app.vault.create("path/to/file.md", "content");

// ✅ Correct
await this.app.vault.create("path/to/file.md", "content");
```

---

## Command ID and Name

**Issue**: Command ID should not include plugin ID, command name should not include plugin name, and UI text should use sentence case.

**Error Messages**:
- "The command ID should not include the plugin ID. Obsidian will make sure that there are no conflicts with other plugins."
- "The command name should not include the plugin name, the plugin name is already shown next to the command name in the UI."
- "Use sentence case for UI text."

### Fix

```typescript
// ❌ Wrong
this.addCommand({
  id: "obsidian-ui-tweaker-toggle-sidebar",
  name: "Obsidian UI Tweaker: Toggle Sidebar",
  callback: () => { /* ... */ }
});

// ✅ Correct
this.addCommand({
  id: "toggle-sidebar",
  name: "Toggle sidebar",
  callback: () => { /* ... */ }
});
```

### Sentence Case Rules

- **First word capitalized**: "Toggle sidebar" ✅
- **Proper nouns capitalized**: "Open GitHub repository" ✅
- **No title case**: "Toggle Sidebar" ❌
- **No all caps**: "TOGGLE SIDEBAR" ❌

---

## Style Element Creation

**Issue**: Creating and attaching `<style>` elements is not allowed. Use `styles.css` instead.

**Error Message**: "Creating and attaching 'style' elements is not allowed. For loading CSS, use a 'styles.css' file instead, which Obsidian loads for you."

### Fix

```typescript
// ❌ Wrong
onload() {
  const style = document.createElement("style");
  style.textContent = `
    .my-class {
      color: red;
    }
  `;
  document.head.appendChild(style);
}

// ✅ Correct
// Move CSS to styles.css file:
// .my-class {
//   color: red;
// }

// Then in your code, just use the class:
onload() {
  // No style element creation needed
  // Obsidian automatically loads styles.css
}
```

**Note**: If you need dynamic styles, use CSS custom properties (CSS variables) and update them with `setCssProps()`:

```typescript
// ✅ Correct - Using CSS variables
// In styles.css:
// .my-element {
//   color: var(--dynamic-color);
// }

// In TypeScript:
import { setCssProps } from "obsidian";
setCssProps(element, {
  "--dynamic-color": "red"
});
```

---

## Direct Style Manipulation

**Issue**: Avoid setting styles directly via `element.style.*`. Use CSS classes or `setCssProps()`.

**Error Messages**:
- "Avoid setting styles directly via `element.style.display`. Use CSS classes for better theming and maintainability. Use the `setCssProps` function to change CSS properties."
- "Avoid setting styles directly via `element.style.setProperty`. Use CSS classes for better theming and maintainability. Use the `setCssProps` function to change CSS properties."

### Fix Options

#### Option 1: Use CSS Classes (Recommended)
```typescript
// ❌ Wrong
element.style.display = "block";
element.style.opacity = "0.5";

// ✅ Correct
// In styles.css:
// .visible {
//   display: block;
//   opacity: 0.5;
// }

// In TypeScript:
element.addClass("visible");
element.removeClass("hidden");
```

#### Option 2: Use setCssProps() for Dynamic Styles
```typescript
// ❌ Wrong
element.style.display = "block";
element.style.setProperty("margin-top", "10px");

// ✅ Correct
import { setCssProps } from "obsidian";
setCssProps(element, {
  display: "block",
  marginTop: "10px"
});
```

### Common Patterns

**Show/Hide Elements:**
```typescript
// ❌ Wrong
element.style.display = "none";
element.style.display = "block";

// ✅ Correct - Using CSS classes
element.addClass("hidden");
element.removeClass("hidden");

// In styles.css:
// .hidden {
//   display: none !important;
// }
```

**Dynamic Values:**
```typescript
// ❌ Wrong
element.style.setProperty("--custom-property", value);

// ✅ Correct
import { setCssProps } from "obsidian";
setCssProps(element, {
  "--custom-property": value
});
```

---

## Unnecessary Type Assertions

**Issue**: Type assertions that don't change the type are unnecessary.

**Error Message**: "This assertion is unnecessary since it does not change the type of the expression."

### Fix

```typescript
// ❌ Wrong
const value: string = "test";
const result = value as string; // Unnecessary

// ✅ Correct
const value: string = "test";
const result = value; // No assertion needed
```

### When Type Assertions Are Needed

Type assertions are only needed when you're narrowing or widening the type:

```typescript
// ✅ Correct - Narrowing from unknown
const data: unknown = getData();
const result = data as MyType;

// ✅ Correct - Widening for API compatibility
const element = document.createElement("div") as HTMLElement;
```

---

## Promise Return in Void Context

**Issue**: Promise returned in function argument where a void return was expected.

**Error Message**: "Promise returned in function argument where a void return was expected."

### Fix Options

#### Option 1: Add void Operator
```typescript
// ❌ Wrong
new Setting(containerEl)
  .addToggle((toggle) =>
    toggle.onChange(async (value) => {
      await this.plugin.saveData(this.plugin.settings);
    })
  );

// ✅ Correct
new Setting(containerEl)
  .addToggle((toggle) =>
    toggle.onChange(async (value) => {
      void this.plugin.saveData(this.plugin.settings);
    })
  );
```

#### Option 2: Make Callback Async and Await
```typescript
// ❌ Wrong
new Setting(containerEl)
  .addToggle((toggle) =>
    toggle.onChange((value) => {
      this.plugin.saveData(this.plugin.settings);
    })
  );

// ✅ Correct
new Setting(containerEl)
  .addToggle((toggle) =>
    toggle.onChange(async (value) => {
      await this.plugin.saveData(this.plugin.settings);
    })
  );
```

### Common Patterns

**Settings Tab Callbacks:**
```typescript
// ❌ Wrong
new Setting(containerEl)
  .setName("Enable feature")
  .addToggle((toggle) =>
    toggle
      .setValue(this.plugin.settings.enabled)
      .onChange((value) => {
        this.plugin.settings.enabled = value;
        this.plugin.saveData(this.plugin.settings);
      })
  );

// ✅ Correct
new Setting(containerEl)
  .setName("Enable feature")
  .addToggle((toggle) =>
    toggle
      .setValue(this.plugin.settings.enabled)
      .onChange(async (value) => {
        this.plugin.settings.enabled = value;
        await this.plugin.saveData(this.plugin.settings);
      })
  );
```

---

## Object Stringification

**Issue**: Objects may use default stringification format `[object Object]` when stringified.

**Error Message**: "'this.plugin.settings[key]' may use Object's default stringification format ('[object Object]') when stringified."

### Fix

```typescript
// ❌ Wrong
const settings = { key1: "value1", key2: "value2" };
console.log(`Settings: ${settings}`); // Outputs: "Settings: [object Object]"

// ✅ Correct - Use JSON.stringify()
console.log(`Settings: ${JSON.stringify(settings)}`);
// Outputs: "Settings: {\"key1\":\"value1\",\"key2\":\"value2\"}"

// ✅ Correct - Access specific properties
console.log(`Key1: ${settings.key1}, Key2: ${settings.key2}`);
// Outputs: "Key1: value1, Key2: value2"

// ✅ Correct - For arrays of objects
const items = [{ name: "item1" }, { name: "item2" }];
console.log(`Items: ${items.map(item => item.name).join(", ")}`);
// Outputs: "Items: item1, item2"
```

### Common Patterns

**Settings Display:**
```typescript
// ❌ Wrong
new Setting(containerEl)
  .setDesc(`Current value: ${this.plugin.settings[key]}`);

// ✅ Correct
new Setting(containerEl)
  .setDesc(`Current value: ${JSON.stringify(this.plugin.settings[key])}`);

// ✅ Better - If it's a simple value
new Setting(containerEl)
  .setDesc(`Current value: ${String(this.plugin.settings[key] || "")}`);
```

---

## Navigator API Usage

**Issue**: Avoid using `navigator` API to detect the operating system. Use the Platform API instead.

**Error Messages**:
- "Avoid using the navigator API to detect the operating system. Use the Platform API instead."
- "`platform` is deprecated."

### Fix

```typescript
// ❌ Wrong
const isMac = navigator.platform.includes("Mac");
const isWindows = navigator.platform.includes("Win");

// ✅ Correct - Use Obsidian's Platform API
import { Platform } from "obsidian";

if (Platform.isMacOS) {
  // Mac-specific code
} else if (Platform.isWin) {
  // Windows-specific code
} else if (Platform.isLinux) {
  // Linux-specific code
}

// ✅ Correct - Check mobile
if (this.app.isMobile) {
  // Mobile-specific code
} else {
  // Desktop-specific code
}
```

### Platform Detection Patterns

```typescript
import { Platform } from "obsidian";

// Check specific platform
if (Platform.isMacOS) { /* ... */ }
if (Platform.isWin) { /* ... */ }
if (Platform.isLinux) { /* ... */ }
if (Platform.isAndroidApp) { /* ... */ }
if (Platform.isIOSApp) { /* ... */ }

// Check mobile vs desktop
if (this.app.isMobile) { /* ... */ }

// Check desktop platform
if (Platform.isDesktop) {
  if (Platform.isMacOS) { /* Mac */ }
  else if (Platform.isWin) { /* Windows */ }
  else if (Platform.isLinux) { /* Linux */ }
}
```

---

## Unused Imports

**Issue**: Imported module is defined but never used.

**Error Message**: "'Setting' is defined but never used." (or similar for other imports)

### Fix

```typescript
// ❌ Wrong
import { Setting, Plugin } from "obsidian";
// Setting is never used

// ✅ Correct - Remove unused import
import { Plugin } from "obsidian";
```

### Auto-fix

Most IDEs and ESLint can auto-remove unused imports:

```bash
# Run ESLint with --fix flag
npm run lint:fix
```

Or configure your IDE to remove unused imports on save.

---

## Quick Reference: Common Fixes Summary

| Issue | Quick Fix |
|-------|-----------|
| Promise not awaited | Add `await` or `void` operator |
| Command ID includes plugin ID | Remove plugin ID prefix |
| Command name includes plugin name | Remove plugin name prefix |
| Not sentence case | Use sentence case (first word capitalized) |
| Creating style elements | Move CSS to `styles.css` |
| Direct style manipulation | Use CSS classes or `setCssProps()` |
| Unnecessary type assertion | Remove `as Type` assertion |
| Promise in void context | Add `void` operator or make async |
| Object stringification | Use `JSON.stringify()` or access properties |
| Navigator API | Use `Platform` from Obsidian |
| Unused import | Remove unused import |

---

## Setting Up ESLint

### Installation

```bash
npm install -D eslint eslint-plugin-obsidianmd
```

### Configuration

Update your `.eslintrc` file:

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "env": { "node": true },
  "plugins": [
    "@typescript-eslint",
    "obsidianmd"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    "sourceType": "module"
  }
}
```

### Version Compatibility Note

If you encounter dependency conflicts, you may need to:
- Update TypeScript to 4.8.4 or higher
- Update `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` to compatible versions
- Install missing peer dependencies like `@typescript-eslint/utils` or `@eslint/json`

The exact versions depend on your project's setup. If issues persist, check the [eslint-plugin-obsidianmd documentation](https://github.com/obsidianmd/eslint-plugin).

## Running ESLint

After setting up ESLint (see [environment.md](environment.md)), run:

```bash
# Check for issues
npm run lint

# Auto-fix issues where possible
npm run lint:fix

# Check specific file
npx eslint src/main.ts

# Check specific directory
npx eslint src/
```

---

## Related Documentation

- [environment.md](environment.md) - ESLint setup instructions
- [common-pitfalls.md](common-pitfalls.md) - More common mistakes and gotchas
- [build-workflow.md](build-workflow.md) - Build commands and workflow
- [release-readiness.md](release-readiness.md) - Release checklist

