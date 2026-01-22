<!--
Source: Project-specific workflow
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Update as build process evolves
-->

# Build Workflow

**CRITICAL**: Always run the build command after making changes to catch errors early.

After making any changes to plugin code:

1. **Run the build** (assume pnpm is already installed):
   ```powershell
   pnpm build    # Production build (outputs to main.js in root)
   pnpm dev      # Development build with watch mode (outputs to main.js in root)
   ```
   
   **Note**: Both `pnpm build` and `pnpm dev` output to `main.js` in the root directory. The difference is that `pnpm build` is a one-time build, while `pnpm dev` watches for changes and rebuilds automatically.
   
   **Backwards compatibility**: `npm run build` and `npm run dev` will also work since npm scripts execute the same commands.

2. **If the build fails with pnpm/node errors**, then check if pnpm is installed:
   ```powershell
   pnpm --version
   ```
   - If pnpm is not found, inform the user that pnpm needs to be installed (via `npm install -g pnpm` or `corepack enable`)
   - Do not automatically install pnpm - let the user handle installation

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


