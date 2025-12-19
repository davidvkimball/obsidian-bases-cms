<!--
Source: Based on Obsidian Sample Plugin
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin repo for updates
-->

# Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm** (required for this sample - `package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (required for this sample - `esbuild.config.mjs` and build scripts depend on it). Alternative bundlers like Rollup or webpack are acceptable for other projects if they bundle all external dependencies into `main.js`.
- Types: `obsidian` type definitions.

**Note**: This sample project has specific technical dependencies on npm and esbuild. If you're creating a plugin from scratch, you can choose different tools, but you'll need to replace the build configuration accordingly.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

**Important for AI Agents**: Always run `npm run build` after making changes to plugins to catch build errors early. If npm is not installed, install Node.js (which includes npm). Do not run `npm install` to install npm itself - that command installs project dependencies.

### Linting

**Recommended**: Use `eslint-plugin-obsidianmd` for Obsidian-specific linting rules. The repository is at `.ref/eslint-plugin/` - see its README for setup and complete rule documentation.

**Quick Setup**:
```bash
npm install --save-dev eslint@^9.39.1 eslint-plugin-obsidianmd@^0.1.9 @typescript-eslint/eslint-plugin@^8.33.1 @typescript-eslint/parser@^8.33.1 typescript-eslint@^8.35.1 @eslint/js@^9.30.1 @eslint/json@^0.14.0
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

**Note**: The `obsidianmd.configs.recommended` config includes all recommended Obsidian plugin linting rules and is the same configuration used by the Obsidian Review Bot.

**Run ESLint**:
```bash
npm run lint        # Uses lint-wrapper.mjs for helpful success messages
npm run lint:fix    # Auto-fix issues where possible
# Or for specific files:
npx eslint src/**/*.ts
```

**Note**: The setup script (`node scripts/setup-eslint.mjs`) automatically creates `scripts/lint-wrapper.mjs` which adds helpful success messages when linting passes. The wrapper is included in the template and copied during setup.

**Common issues caught by `eslint-plugin-obsidianmd`**: See [common-pitfalls.md](common-pitfalls.md#common-linting-issues) for details on style manipulation, settings headings, UI text case, file deletion, and more.


