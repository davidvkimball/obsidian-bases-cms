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

```bash
pnpm install
pnpm dev      # watch mode build
pnpm build    # production build
pnpm lint     # check code style
pnpm lint:fix # auto-fix where possible
```

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
