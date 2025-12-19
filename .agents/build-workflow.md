<!--
Source: Project-specific workflow
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Update as build process evolves
-->

# Build Workflow

**CRITICAL**: Always run the build command after making changes to catch errors early.

After making any changes to plugin code:

1. **Run the build** (assume npm is already installed):
   ```powershell
   npm run build    # Production build (outputs to main.js in root)
   npm run dev      # Development build with watch mode (outputs to main.js in root)
   ```
   
   **Note**: Both `npm run build` and `npm run dev` output to `main.js` in the root directory. The difference is that `npm run build` is a one-time build, while `npm run dev` watches for changes and rebuilds automatically.

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


