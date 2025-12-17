<!--
Source: Based on Obsidian Sample Plugin and Sample Theme
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin and Sample Theme repos for updates
Applicability: Plugin / Theme
-->

# Environment & tooling

## Plugins

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
npm install --save-dev eslint@^8.57.1 eslint-plugin-obsidianmd@^0.1.9 @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest typescript-eslint@latest @eslint/json
```

**Important**: Use ESLint v8 (not v9) for compatibility with `.eslintrc` format. ESLint v9 requires the new flat config format (`eslint.config.js`).

**Basic .eslintrc configuration**:
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "env": { "node": true },
  "plugins": ["@typescript-eslint", "obsidianmd"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": { "sourceType": "module" },
  "rules": {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
    "@typescript-eslint/ban-ts-comment": "off",
    "no-prototype-builtins": "off",
    "@typescript-eslint/no-empty-function": "off"
  }
}
```

**Note**: The `plugin:obsidianmd/recommended` config is not available, but the plugin still works when loaded in the `plugins` array. The rules are automatically applied.

**Run ESLint**:
```bash
npm run lint
# Or for specific files:
npx eslint src/**/*.ts
```

**Common issues caught by `eslint-plugin-obsidianmd`**: See [common-pitfalls.md](common-pitfalls.md#common-linting-issues) for details on style manipulation, settings headings, UI text case, file deletion, and more.

## Themes

- **Optional**: Node.js and npm if using SCSS/Sass preprocessors or build tools.
- **Simple themes**: Can be developed with just CSS and `manifest.json` (no build tools required).
- **SCSS themes**: Use Sass/SCSS compiler (e.g., `sass`, `node-sass`, or build tools like Vite).
- No TypeScript or bundler required for basic themes.

### Simple Theme Setup

No build tools needed - just edit `theme.css` directly.

### SCSS Theme Setup

```bash
npm install -D sass
npm run build  # Compile SCSS to CSS
```

### Theme Build Tools (Optional)

Simple themes with just CSS don't need build tools. More complex themes might use Grunt, npm scripts, or other build tools for tasks like SCSS compilation, minification, or preprocessing:

```bash
# For themes using Grunt
npx grunt build

# For themes using npm scripts
npm run build
```

Only use build commands if your theme has a `Gruntfile.js`, `package.json` with build scripts, or other build configuration files.

### Linting (Optional)

- Use `stylelint` for CSS/SCSS linting: `npm install -D stylelint`
- Configure stylelint for Obsidian theme conventions


