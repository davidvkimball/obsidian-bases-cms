<!--
Source: Based on Obsidian Sample Plugin and Sample Theme
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin and Sample Theme repos for updates
Applicability: Plugin / Theme
-->

# File & folder conventions

## Plugins

- **Organize code into multiple files**: Split functionality across separate modules rather than putting everything in `main.ts`.
- **Source file location**: 
  - **Recommended**: Place `main.ts` in `src/` directory (standard for most plugins)
  - **Acceptable for simple plugins**: `main.ts` in project root is acceptable for extremely simple plugins (like the sample plugin template)
  - **CRITICAL**: Never have `main.ts` in both root AND `src/` - this causes build confusion and errors
- Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- **Recommended file structure** (for plugins with multiple files):
  ```
  src/
    main.ts           # Plugin entry point, lifecycle management
    settings.ts       # Settings interface and defaults
    commands/         # Command implementations
      command1.ts
      command2.ts
    ui/              # UI components, modals, views
      modal.ts
      view.ts
    utils/           # Utility functions, helpers
      helpers.ts
      constants.ts
    types.ts         # TypeScript interfaces and types
  ```
  
  **Simple plugin structure** (acceptable for very simple plugins):
  ```
  main.ts           # ✅ OK for simple plugins (like sample plugin template)
  manifest.json
  package.json
  ```
  
  **Wrong structure** (common mistake):
  ```
  main.ts           # ❌ DON'T have it in both places
  src/
    main.ts         # ❌ This causes build confusion
  ```
  
  **Best practice**: As your plugin grows beyond a single file, move `main.ts` to `src/` and organize other files there too.
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files to version control.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Generated output should be placed at the plugin root or `dist/` depending on your build setup. Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Themes

- **Organize CSS/SCSS into logical files**: Split styles into separate files for maintainability.
- **Example file structure**:
  ```
  src/               # Source SCSS files (if using preprocessor)
    main.scss
    variables.scss
    components/
  theme.css          # Compiled CSS (or source if not using preprocessor)
  manifest.json
  snippets/         # Optional: Theme snippets
    snippet-name.css
  ```
- **Do not commit build artifacts**: Never commit `node_modules/`, compiled CSS if using SCSS, or other generated files.
- Keep themes lightweight. Avoid complex build processes unless necessary.
- Release artifacts: `manifest.json` and `theme.css` must be at the top level of the theme folder in the vault.


