<!--
Source: Authored for Obsidian plugin scorecard compliance
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Update when the standard development setup changes
Applicability: Plugin
-->

# CONTRIBUTING.md Template

The Obsidian community scorecard's **Hygiene** check looks for a `CONTRIBUTING.md` at the repo root. The template below is portable across plugin repositories without modification, because it uses relative GitHub links (`../../issues`) and references generic plugin concepts.

## When to drop in unmodified

Use the template as-is when the repo:

- Uses pnpm with the standard `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm lint:fix` scripts.
- Builds `main.js`, `styles.css`, and `manifest.json` to the repo root.
- Is licensed MIT.
- Uses the house terminology rules (properties, Markdown capitalized).

## When to customize

Change the template only when:

- The plugin uses npm/yarn/bun instead of pnpm (update the install/build commands).
- The plugin has additional scripts the contributor needs to run (e.g. a separate test command).
- The license is not MIT (update the License section).

Do not customize the issue link — the relative `../../issues` form resolves correctly on any GitHub repo.

## Template

```markdown
# Contributing

Thanks for your interest in contributing. This document describes how to report issues, propose changes, and get a local development environment running.

## Reporting issues

- Search [existing issues](../../issues) before opening a new one.
- For bugs, include: Obsidian version, plugin version, operating system, reproduction steps, and what you expected vs. what happened. Screenshots or a short screen recording help.
- For feature requests, describe the use case and the problem the feature would solve, not just the proposed solution.

## Development setup

Requirements:

- [Node.js](https://nodejs.org/) (LTS recommended)
- [pnpm](https://pnpm.io/). This repo pins a specific version via `packageManager` in `package.json`.

`​`​`bash
pnpm install
pnpm dev      # watch mode build
pnpm build    # production build
pnpm lint     # check code style
pnpm lint:fix # auto-fix where possible
`​`​`

Build artifacts (`main.js`, `manifest.json`, `styles.css`) are produced at the repo root.

To test against a real vault, point the build output at `<vault>/.obsidian/plugins/<plugin-id>/` (symlink the three files, or use a tool like [hot-reload](https://github.com/pjeby/hot-reload)).

## Pull requests

- Open an issue first for anything non-trivial so we can agree on direction before you spend time on it.
- Keep PRs focused. One concern per PR is easier to review.
- Run `pnpm lint` and `pnpm build` before submitting; CI will run these too.
- Follow the existing code style. Use **"properties"** (not "frontmatter") when referring to YAML metadata. **"Markdown"** is always capitalized.
- Update the README if you change user-facing behavior.

## Code style

- TypeScript strict mode, no `any` unless unavoidable.
- Prefer Obsidian's API (`Vault`, `MetadataCache`, `Workspace`) over Node `fs` for vault access.
- No network requests from the plugin runtime.

## Releases

Maintainers cut releases by bumping the version in `manifest.json`, `package.json`, and `versions.json`, committing, then tagging and pushing the tag. The release workflow builds and attaches `main.js`, `manifest.json`, and `styles.css` with build provenance attestation.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
```

## Style notes

- The template avoids em dashes (`—`); prefer periods, commas, or parentheses instead.
- The template avoids the word "Claude" and any reference to AI assistance, since the file is user-facing documentation.
- Headings use sentence case to match Obsidian UI conventions.

## Related Documentation

- [scorecard-compliance.md](scorecard-compliance.md) — covers every scorecard signal, not just the contributing guide.
- [release-readiness.md](release-readiness.md) — broader pre-release checklist.
- [versioning-releases.md](versioning-releases.md) — release workflow setup.
