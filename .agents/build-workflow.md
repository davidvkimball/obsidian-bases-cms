<!--
Source: Project-specific workflow
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Update as build process evolves
Applicability: Plugin / Theme
-->

# Build Workflow

**CRITICAL**: Always run the build command after making changes to catch errors early.

## For Plugins

After making any changes to plugin code:

1. **Run the build** (assume npm is already installed):
   ```powershell
   npm run build
   ```

2. **If the build fails with npm/node errors**, then check if npm is installed:
   ```powershell
   npm --version
   ```
   - If npm is not found, inform the user that Node.js (which includes npm) needs to be installed
   - Do not automatically install npm - let the user handle installation

3. **Check for errors** and fix any build issues before proceeding. See [troubleshooting.md](troubleshooting.md) and [common-pitfalls.md](common-pitfalls.md) for common build issues.

## For Themes

After making any changes to theme code:

### Simple CSS Themes

If your theme is simple with just `theme.css` and no build tools:

- **No build step required** - just edit `theme.css` directly
- Changes take effect immediately when Obsidian reloads the theme

### Themes with Build Tools

If your theme uses build tools (Grunt, npm scripts, SCSS compiler, etc.):

1. **Run the build** (assume npm is already installed):
   ```powershell
   # For themes using Grunt
   npx grunt build
   
   # For themes using npm scripts
   npm run build
   
   # Or whatever build command your theme uses
   ```

2. **If the build fails with npm/node errors**, then check if npm is installed:
   ```powershell
   npm --version
   ```
   - If npm is not found, inform the user that Node.js (which includes npm) needs to be installed
   - Do not automatically install npm - let the user handle installation

3. **Check for errors** and fix any build issues before proceeding. See [troubleshooting.md](troubleshooting.md) and [common-pitfalls.md](common-pitfalls.md) for common build issues.

## Why This Matters

- **Catches errors early**: Build errors are easier to fix immediately after making changes
- **Prevents broken code**: Ensures the project always builds successfully
- **Saves time**: Fixing build errors right away is faster than discovering them later
- **Maintains quality**: Keeps the codebase in a working state

## Automated Workflow

When making changes:
1. Make the code change
2. **Immediately run the build command**
3. If build fails, fix errors
4. Repeat until build succeeds
5. Then proceed with testing or other tasks


