<!--
Source: Created to document fixes for Obsidian plugin linting issues
Last synced: N/A - Project-specific documentation
Update frequency: Update as new linting issues are identified
Applicability: Plugin
-->

# Linting Fixes Guide

**Purpose**: This guide provides **step-by-step fix procedures** for common linting issues detected by `eslint-plugin-obsidianmd`. Use this when you need to fix specific linting errors in your plugin code.

**Related documentation**:
- [obsidian-bot-requirements.md](obsidian-bot-requirements.md) - Bot requirements (authoritative source)
- [common-pitfalls.md](common-pitfalls.md) - General development pitfalls
- [release-readiness.md](release-readiness.md) - Pre-submission checklist

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

### Sentence Case - Cannot Be Disabled in Code

**CRITICAL**: The `obsidianmd/ui/sentence-case` rule **cannot be disabled with eslint-disable comments**. The Obsidian bot will reject any attempt to disable this rule in code.

**However**, the Obsidian bot does allow you to use `/skip` in bot review comments to handle legitimate false positives. This is the only way to handle cases where the bot incorrectly flags text that is already correct.

**When to fix text vs. use `/skip`**:

1. **Fix the text** if:
   - The text is actually not in proper sentence case
   - You can rephrase to avoid the false positive
   - The issue is a simple capitalization error

2. **Use `/skip` in bot review** if:
   - The text is already correct but the bot flags it as incorrect
   - The text contains proper nouns (framework names, product names) that must be capitalized
   - The text contains technical notation (date format codes, file paths) that cannot be changed
   - Rephrasing would make the text less clear or accurate
   - The bot is incorrectly interpreting context

**If the linter flags text that appears to be correct**, you have two options:
1. Try to rephrase the text to avoid the false positive (preferred)
2. Use `/skip` in the bot review comment with an explanation (acceptable for legitimate false positives)

#### Common Scenarios Requiring Text Fixes

**1. Proper Nouns (Framework/Product Names)**

When proper nouns like framework or product names appear in the middle of sentences, ensure they are capitalized correctly:

```typescript
// ❌ Wrong - Cannot disable, must fix text
// eslint-disable-next-line obsidianmd/ui/sentence-case  // ❌ Bot will reject this!
.setDesc("Choose the default format for copied heading links. Obsidian format respects your Obsidian settings for wikilink vs markdown preference. Astro link uses your link base path from above and converts the heading into kebab-case format as an anchor link")

// ✅ Correct - Fix text to proper sentence case with capitalized proper nouns
.setDesc("Choose the default format for copied heading links. Obsidian format respects your Obsidian settings for wikilink vs markdown preference. Astro link uses your link base path from above and converts the heading into kebab-case format as an anchor link")
// Note: "Astro" is a proper noun and should remain capitalized
```

**2. Date/Time Format Codes**

Date format placeholders and format codes (like "YYYY-MM-DD", "MMMM", "yyyy") are technical notation. The linter may flag these, but you cannot disable the rule. Ensure the surrounding text is in proper sentence case:

```typescript
// ❌ Wrong - Cannot disable, must ensure text is correct
// eslint-disable-next-line obsidianmd/ui/sentence-case  // ❌ Bot will reject this!
.setPlaceholder("YYYY-MM-DD")
.setDesc("Format for the date in properties (e.g., yyyy-mm-dd, MMMM D, yyyy, yyyy-mm-dd HH:mm)")

// ✅ Correct - Text is already in proper sentence case
// Format codes like "YYYY-MM-DD" and "MMMM" are technical notation and acceptable
.setPlaceholder("YYYY-MM-DD")
.setDesc("Format for the date in properties (e.g., yyyy-mm-dd, MMMM D, yyyy, yyyy-mm-dd HH:mm)")
// Note: If the linter still flags this, you may need to rephrase the description
```

**3. Technical Notation and Code Examples**

When descriptions contain code examples, file paths, or technical notation:

```typescript
// ❌ Linter error (false positive)
.setDesc("Path relative to the Obsidian vault root folder. Use ../.. for two levels up. Leave blank to use the vault folder")

// ✅ Correct - Suppress with explanation
// False positive: Text is already in sentence case; "Obsidian" is a proper noun and "../.." is a path example
// eslint-disable-next-line obsidianmd/ui/sentence-case
.setDesc("Path relative to the Obsidian vault root folder. Use ../.. for two levels up. Leave blank to use the vault folder")
```

**4. Dropdown Options with Proper Nouns**

Dropdown option labels that include proper nouns:

```typescript
// ❌ Linter error (false positive)
.addOption("astro", "Astro link")

// ✅ Correct - Suppress with explanation
// False positive: "Astro" is a proper noun (framework name) and should be capitalized
// eslint-disable-next-line obsidianmd/ui/sentence-case
.addOption("astro", "Astro link")
```

#### How to Handle Sentence Case Issues

**⚠️ CRITICAL: Sentence Case Rule Cannot Be Disabled in Code**

**The Obsidian bot will reject any attempt to disable `obsidianmd/ui/sentence-case` with eslint-disable comments**. However, you can use `/skip` in bot review comments for legitimate false positives.

**Step 1: Verify the text is correct**
- First word capitalized
- Rest lowercase except proper nouns
- Proper nouns (framework names, product names) should be capitalized
- Technical notation (date codes, file paths) may need special handling

**Step 2: Try to fix the text** (preferred):
- Rephrase to avoid the false positive
- Use code formatting for technical notation
- Restructure sentences if needed

**Step 3: If text is already correct but bot flags it** (legitimate false positive):
- You cannot disable the rule in code
- Use `/skip` in the bot review comment with an explanation
- Example: `/skip False positive: "Astro" is a proper noun (framework name) and must be capitalized`

3. **Common scenarios**:
   - Proper nouns (framework names, product names, company names) - Keep capitalized
   - Technical notation (date format codes, file paths, code examples) - May need rephrasing or code formatting
   - Placeholders that are format strings - Consider using code formatting or rephrasing

#### Fixing Sentence Case Issues

**Remember: You cannot disable this rule. You must fix the text.**

**Example: Fixing text to proper sentence case**
```typescript
// ❌ Wrong - Cannot disable, must fix text
// eslint-disable-next-line obsidianmd/ui/sentence-case  // ❌ Bot will reject!
.setDesc('Display the button in the CMS toolbar.')

// ✅ Correct - Text is already in proper sentence case
.setDesc('Display the button in the CMS toolbar.')
```

**Example: Handling proper nouns**
```typescript
// ❌ Wrong - Cannot disable
// eslint-disable-next-line obsidianmd/ui/sentence-case  // ❌ Bot will reject!
.setDesc('Choose the default format. Astro link uses your link base path.')

// ✅ Correct - Proper nouns (Astro) remain capitalized, rest is sentence case
.setDesc('Choose the default format. Astro link uses your link base path.')
```

**Example: Handling technical notation**
```typescript
// ❌ Wrong - Cannot disable
// eslint-disable-next-line obsidianmd/ui/sentence-case  // ❌ Bot will reject!
.setDesc('Format for the date in properties (e.g., yyyy-mm-dd, MMMM D, yyyy)')

// ✅ Correct - Rephrase to avoid false positives, or ensure text is correct
.setDesc('Format for the date in properties. Examples: yyyy-mm-dd, MMMM D, yyyy')
// Or use code formatting for technical notation:
.setDesc('Format for the date in properties. Use format codes like `yyyy-mm-dd` or `MMMM D, yyyy`')
```

#### When NOT to Use Disable Comments

**Do NOT use disable comments to:**
- Skip fixing legitimate errors
- Avoid refactoring problematic code
- Work around type safety issues
- Suppress warnings you don't understand

**Only use disable comments when:**
- The text is already correct and the linter is wrong
- You've verified the text follows all formatting rules
- You can clearly explain why it's a false positive
- The error cannot be fixed by changing the code

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

// ✅ Correct - Works with direct Setting usage
new Setting(containerEl)
  .addToggle((toggle) =>
    toggle.onChange(async (value) => {
      await this.plugin.saveData(this.plugin.settings);
    })
  );
```

**Important**: Option 2 works with direct `Setting` usage, but **does NOT work** with `addSetting` from `createSettingsGroup()`:

```typescript
// ❌ FAILS with addSetting from createSettingsGroup
group.addSetting(setting =>
  setting.addToggle(toggle =>
    toggle.onChange(async (value) => {
      await this.plugin.saveData(this.plugin.settings);
    })
  )
);

// ✅ CORRECT - Use block body for addSetting
group.addSetting(setting => {
  setting.addToggle(toggle => {
    toggle.onChange(async (value) => {
      await this.plugin.saveData(this.plugin.settings);
    });
  });
});
```

**Why**: `addSetting` expects `(setting: Setting) => void`, but expression body returns the `Setting` object from the chain. You MUST use block body `{ }` with `addSetting`.

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

## Critical: addSetting Callbacks Must Return Void

**Issue**: When using `createSettingsGroup().addSetting()` or `SettingGroup.addSetting()`, the callback MUST return `void`, not a `Setting` object.

**When This Applies**: This issue **only** affects plugins using `SettingGroup` (API 1.11.0+) or the `createSettingsGroup()` compatibility utility. If you're using `new Setting(containerEl)` directly (the most common pattern), you don't have this issue.

**Error Message**: "Promise returned in function argument where a void return was expected" on the `addSetting` line.

**Root Cause**: Expression body arrow functions return the result of the expression. When you chain methods like `setting.setName(...).addToggle(...)`, the expression returns the `Setting` object (for method chaining), but `addSetting` expects a callback that returns `void`.

**❌ Wrong - Expression Body (Returns Setting)**:
```typescript
group.addSetting(setting =>
  setting
    .setName("Enable feature")
    .addToggle(toggle => {
      toggle.setValue(this.plugin.settings.enabled);
      toggle.onChange(async (value) => {
        this.plugin.settings.enabled = value;
        await this.plugin.saveData(this.plugin.settings);
      });
    })
);
```

**✅ Correct - Block Body (Returns Void)**:
```typescript
group.addSetting(setting => {
  setting
    .setName("Enable feature")
    .addToggle(toggle => {
      toggle.setValue(this.plugin.settings.enabled);
      toggle.onChange(async (value) => {
        this.plugin.settings.enabled = value;
        await this.plugin.saveData(this.plugin.settings);
      });
    });
});
```

**Key Difference**:
- **Expression body**: `setting => setting.setName(...)` - Returns the result of the chain (a `Setting` object)
- **Block body**: `setting => { setting.setName(...); }` - Explicitly returns `void`

**Rule**: Always use block body `{ }` with semicolons when using `addSetting` from `createSettingsGroup()` or `SettingGroup`.

**Note**: This may only fail with strict ESLint rules, but using block body is safer, clearer, and prevents potential type errors.

**Direct Setting Usage (No Issue)**:
```typescript
// ✅ This works fine - no addSetting callback
new Setting(containerEl)
  .setName("Enable feature")
  .addToggle((toggle) =>
    toggle.onChange(async (value) => {
      await this.plugin.saveData(this.plugin.settings);
    })
  );
```

Most plugins use `new Setting(containerEl)` directly, which doesn't have this restriction. The issue only applies when using `SettingGroup` or the compatibility utility.

---

## Troubleshooting: When Fixes Don't Work

**Problem**: You've tried making `onChange` async, added `void` operators, but still get "Promise returned in function argument" errors.

**Check**: Is the error on the `addSetting` line or the `onChange` line?

- **Error on `addSetting` line**: The callback itself is returning a value (like `Setting`) instead of `void`. Use block body `{ }` instead of expression body.
- **Error on `onChange` line**: The `onChange` callback is returning a Promise. Make it async and await, or use `void` operator.

**Common Mistake**: Adding eslint-disable comments instead of fixing the root cause. The disable comment should be on the EXACT line with the error, but it's better to fix the actual issue.

**Debugging Steps**:
1. Check which line the error is on (column number matters)
2. If it's the `addSetting` callback, ensure it uses block body `{ }`
3. If it's the `onChange` callback, ensure it's properly async or uses `void`
4. Run `pnpm lint` after each change to verify
5. Never suppress errors without understanding the root cause

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
pnpm lint:fix
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
pnpm add -D eslint eslint-plugin-obsidianmd
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
pnpm lint

# Auto-fix issues where possible
pnpm lint:fix

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

