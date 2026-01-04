<!--
Source: Based on Obsidian Sample Plugin
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin repo for updates
-->

# Environment & tooling

**Purpose**: This document covers development environment setup, tooling configuration, and ESLint setup. Use this for initial setup and configuration.

**Related documentation**:
- [obsidian-bot-requirements.md](obsidian-bot-requirements.md) - Bot requirements and ESLint configuration
- [build-workflow.md](build-workflow.md) - Build commands and workflow
- [common-pitfalls.md](common-pitfalls.md) - Common development pitfalls

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: pnpm** (required for this sample - `package.json` defines pnpm scripts and dependencies).
- **Bundler: esbuild** (required for this sample - `esbuild.config.mjs` and build scripts depend on it). Alternative bundlers like Rollup or webpack are acceptable for other projects if they bundle all external dependencies into `main.js`.
- Types: `obsidian` type definitions.

**Note**: This sample project has specific technical dependencies on pnpm and esbuild. If you're creating a plugin from scratch, you can choose different tools, but you'll need to replace the build configuration accordingly.

### Install

```bash
pnpm install
```

### Dev (watch)

```bash
pnpm dev
```

### Production build

```bash
pnpm build
```

**Important for AI Agents**: Always run `pnpm build` after making changes to plugins to catch build errors early. If pnpm is not installed, install it via `npm install -g pnpm` or enable corepack with `corepack enable`. Do not run `pnpm install` to install pnpm itself - that command installs project dependencies.

**Backwards compatibility**: `npm install` will automatically proxy to `pnpm install` via a preinstall hook. `npm run build`, `npm run dev`, and `npm run lint` will also work since npm scripts execute the same commands.

### Linting

**Recommended**: Use `eslint-plugin-obsidianmd` for Obsidian-specific linting rules. The repository is at `.ref/eslint-plugin/` - see its README for setup and complete rule documentation.

**Quick Setup**:
```bash
pnpm add -D eslint@^9.39.1 eslint-plugin-obsidianmd@^0.1.9 @typescript-eslint/eslint-plugin@^8.33.1 @typescript-eslint/parser@^8.33.1 typescript-eslint@^8.35.1 @eslint/js@^9.30.1 @eslint/json@^0.14.0
```

**Important**: ESLint v9 is required (the plugin requires `eslint >=9.0.0 <10.0.0`). ESLint 9 uses the flat config format (`eslint.config.mjs`).

**Basic eslint.config.mjs configuration**:
```javascript
// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { 
        project: "./tsconfig.json",
        sourceType: "module"
      },
    },
    // You can add your own configuration to override or add rules
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-prototype-builtins": "off",
    },
  },
]);
```

**Note**: The `obsidianmd.configs.recommended` config includes all recommended Obsidian plugin linting rules and is the same configuration used by the Obsidian Review Bot. However, some rules need explicit configuration to match the bot's requirements (see "Obsidian Bot vs Local Linting" below).

**Run ESLint**:
```bash
pnpm lint            # Uses lint-wrapper.mjs for helpful success messages
pnpm lint:fix        # Auto-fix issues where possible
# Or for specific files:
pnpm exec eslint src/**/*.ts
```

**Note**: The setup script (`node scripts/setup-eslint.mjs`) automatically creates `scripts/lint-wrapper.mjs` which adds helpful success messages when linting passes. The wrapper is included in the template and copied during setup.

**Common issues caught by `eslint-plugin-obsidianmd`**: See [common-pitfalls.md](common-pitfalls.md#common-linting-issues) for details on style manipulation, settings headings, UI text case, file deletion, and more.

### Obsidian Bot vs Local Linting

**Important**: The Obsidian review bot uses stricter rules than the default `obsidianmd.configs.recommended` config. To match the bot's requirements, you need to explicitly configure some rules:

1. **Console statements**: Only `console.warn()`, `console.error()`, and `console.debug()` are allowed. Configure:
   ```javascript
   "no-console": ["error", { "allow": ["warn", "error", "debug"] }]
   ```

2. **Required rules**: Enable `@typescript-eslint/require-await` to catch async methods without await:
   ```javascript
   "@typescript-eslint/require-await": "error"
   ```

3. **Disallowed rule disabling**: The bot prevents disabling these rules:
   - `obsidianmd/no-static-styles-assignment` - Refactor code instead
   - `@typescript-eslint/no-explicit-any` - Use `unknown` with type guards
   - `obsidianmd/ui/sentence-case` - Fix text to proper sentence case

4. **ESLint disable comments**: All disable comments must include descriptions explaining why they're necessary. The bot will flag undescribed directives.

5. **Unused disables**: Remove any eslint-disable directives that aren't actually needed.

**Production-Ready ESLint Configuration**:

For production code that will be reviewed by the Obsidian bot, use this configuration:

```javascript
// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { 
        project: "./tsconfig.json",
        sourceType: "module"
      },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-prototype-builtins": "off",
      // Console rules: Match Obsidian bot requirements
      "no-console": ["error", { "allow": ["warn", "error", "debug"] }],
      // Require await in async functions (matches Obsidian bot)
      "@typescript-eslint/require-await": "error",
    },
  },
]);
```

**See also**: [obsidian-bot-requirements.md](obsidian-bot-requirements.md) for complete bot requirements documentation, [common-pitfalls.md](common-pitfalls.md#obsidian-bot-review-requirements) for common bot review issues, and [release-readiness.md](release-readiness.md) for pre-submission checklist.


