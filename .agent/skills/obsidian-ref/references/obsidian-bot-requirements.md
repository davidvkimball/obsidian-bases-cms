<!--
Source: Based on Obsidian bot review feedback and requirements
Last synced: N/A - Project-specific documentation
Update frequency: Update as new bot requirements are identified
Applicability: Plugin
-->

# Obsidian Bot Review Requirements

**Purpose**: This is the **authoritative source** for Obsidian bot review requirements. It outlines requirements enforced by the Obsidian review bot that may differ from local linting. Use this as a reference when preparing your plugin for submission.

**Related documentation**:
- [linting-fixes-guide.md](linting-fixes-guide.md) - Step-by-step fix procedures
- [common-pitfalls.md](common-pitfalls.md) - General development pitfalls
- [release-readiness.md](release-readiness.md) - Pre-submission checklist

## Required Configuration

Your `eslint.config.mjs` should include these rules to match the bot:

```javascript
rules: {
  // Restrict console to only warn, error, debug (Obsidian bot requirement)
  "no-console": ["error", { "allow": ["warn", "error", "debug"] }],
  
  // Require await in async functions (Obsidian bot requirement)
  "@typescript-eslint/require-await": "error",
}
```

## Rules That Cannot Be Disabled

These rules cannot be disabled with eslint-disable comments. If you encounter these, you must fix the underlying issue rather than disabling the rule:

- **`obsidianmd/no-static-styles-assignment`** - Refactor code to use `setCssProperties()` or CSS classes instead of direct style manipulation
- **`@typescript-eslint/no-explicit-any`** - Use proper types, `unknown` with type guards, or type assertions instead
- **`obsidianmd/ui/sentence-case`** - Fix UI text to use proper sentence case, or use `/skip` in bot review for legitimate false positives

### Examples

**Static Style Assignment** (cannot disable):
```ts
// ❌ Wrong - Cannot disable this rule
// eslint-disable-next-line obsidianmd/no-static-styles-assignment
element.style.cssText = 'color: red;';

// ✅ Correct - Use setCssProperties or CSS classes
import { setCssProps } from 'obsidian';
setCssProps(element, { color: 'red' });
// Or:
element.addClass('my-custom-class');
```

**No Explicit Any** (cannot disable):
```ts
// ❌ Wrong - Cannot disable this rule
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function process(data: any) { }

// ✅ Correct - Use unknown with type guards
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data');
}
```

**UI Sentence Case** (cannot disable in code):
```ts
// ❌ Wrong - Cannot disable this rule in code
// eslint-disable-next-line obsidianmd/ui/sentence-case  // Bot will reject this!
.setName("Enable Feature")

// ✅ Correct - Use sentence case
.setName("Enable feature")

// ✅ Also acceptable - Use /skip in bot review for legitimate false positives
// If text is already correct but bot flags it (e.g., proper nouns, technical notation),
// use /skip in bot review comment: /skip False positive: "Astro" is a proper noun
```

## ESLint Disable Comment Requirements

All eslint-disable comments must:

1. **Include descriptions** explaining why the disable is necessary (REQUIRED - bot will reject without description)
2. **Be placed directly before** the line with the error (no blank lines)
3. **Not disable any of the rules listed above** (non-disablable rules)

**CRITICAL**: The bot will flag any eslint-disable comment that lacks a description. This is a required field, not optional.

### Format

**Wrong** (no description):
```ts
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const data = await fetchExternalData();
```

**Correct** (with description):
```ts
// External API returns unknown type - reason: External API
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const data = await fetchExternalData();
```

**Wrong** (blank line between comment and error):
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any

const data: any = fetchData();
```

**Correct** (comment directly before error):
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = fetchData();
```

## Unused ESLint Disable Directives

Remove any eslint-disable directives that aren't actually needed. The bot will flag unused disables.

**Problem**: Disabling a rule that isn't being violated:
```ts
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const value = this.settings.enabled; // This line doesn't actually violate the rule
```

**Solution**: Remove the disable comment if it's not needed.

## Common Issues

### Console.log() Usage

**Problem**: Using `console.log()` will fail bot review.

**Solution**: Use `console.debug()`, `console.warn()`, or `console.error()` instead.

```ts
// ❌ Wrong
console.log("Debug info");

// ✅ Correct
console.debug("Debug info");
```

### Async Functions Without Await

**Problem**: Async functions that don't use await will fail bot review.

**Solution**: Remove `async` keyword if no await is needed, or add await if the function should be async.

```ts
// ❌ Wrong
async handleClick() {
  this.doSomething(); // No await needed
}

// ✅ Correct
handleClick() {
  this.doSomething();
}

// Or if you need async:
async handleClick() {
  await this.doSomethingAsync();
}
```

## Handling False Positives

### Sentence Case False Positives

The `obsidianmd/ui/sentence-case` rule cannot be disabled in code, but the Obsidian bot allows `/skip` in review comments for legitimate false positives.

### When to use `/skip`

- Text is already correct but bot flags it
- Text contains proper nouns (framework names, product names) that must be capitalized
- Text contains technical notation (date format codes, file paths) that cannot be changed
- Rephrasing would make the text less clear or accurate

### How to use `/skip`
In the bot review comment, use: `/skip False positive: [explanation]`

**Example**:
```markdown
/skip False positive: "Astro" is a proper noun (framework name) and must be capitalized
```

**Note**: Only use `/skip` for legitimate false positives. If the text can be fixed, fix it instead.

## Testing Before Submission

Before submitting to Obsidian:

1. **Run `pnpm build`** - Must pass
2. **Run `pnpm lint`** - Must pass with the stricter configuration
3. **Verify no `console.log()` statements** (only debug/warn/error)
4. **Verify all async methods have await** or are not async
5. **Verify no disallowed rule disables present** (except use `/skip` for sentence-case false positives)
6. **Verify all disable comments have descriptions**
7. **Remove any unused eslint-disable directives**

## Configuration Checklist

Ensure your `eslint.config.mjs` includes:

- [ ] `"no-console": ["error", { "allow": ["warn", "error", "debug"] }]`
- [ ] `"@typescript-eslint/require-await": "error"`
- [ ] No attempts to disable non-disablable rules
- [ ] All disable comments include descriptions

## Related Documentation

- [environment.md](environment.md) - ESLint setup and configuration
- [common-pitfalls.md](common-pitfalls.md#obsidian-bot-review-requirements) - Common bot review issues
- [release-readiness.md](release-readiness.md) - Pre-submission checklist
