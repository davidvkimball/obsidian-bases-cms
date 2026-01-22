# Pre-Commit Hooks (Optional)

Pre-commit hooks are scripts that run automatically before each commit. They can help catch linting errors before code is committed.

## What Are Pre-Commit Hooks?

Pre-commit hooks are Git hooks that run before a commit is finalized. If the hook fails, the commit is blocked until the issues are fixed.

**Example**: A pre-commit hook runs `pnpm lint`. If linting fails, the commit is rejected with an error message.

## How They Work

1. **Git hooks**: Git has a `.git/hooks/` directory with executable scripts
2. **Hook tools**: Tools like Husky make it easier to manage hooks
3. **Automatic execution**: Git runs the hook script before completing the commit
4. **Blocking commits**: If the hook exits with a non-zero code, the commit is blocked

## Should You Use Them?

**Pros**:
- ✅ Catches linting errors before commit
- ✅ Prevents committing broken code
- ✅ Enforces code quality standards

**Cons**:
- ❌ Adds a step to the commit process (can slow down quick commits)
- ❌ Requires setup in each repository
- ❌ Can be bypassed with `git commit --no-verify` (defeats the purpose)

## Recommendation

**Optional, not required**: Pre-commit hooks are a nice-to-have, but not essential. The current workflow (running `pnpm lint` manually before pushing) works well.

**If you want to add them**:
1. Install Husky: `pnpm add -D husky`
2. Initialize: `pnpm exec husky init`
3. Add pre-commit hook: Create `.husky/pre-commit` with `pnpm lint`

**Note**: This is optional. The ESLint configuration already catches these issues, and running `pnpm lint` before pushing is sufficient.

## Alternative: CI/CD Checks

Instead of pre-commit hooks, you can rely on:
- Running `pnpm lint` manually before pushing
- GitHub Actions or other CI/CD to run linting on pull requests
- The Obsidian bot review (final check before approval)

These approaches are less intrusive and work well for most workflows.

