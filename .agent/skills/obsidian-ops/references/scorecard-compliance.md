<!--
Source: Obsidian community plugin scorecard (community.obsidian.md/plugins/<id>)
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check the Obsidian community portal scorecard format for changes
Applicability: Plugin
-->

# Community Plugin Scorecard Compliance

The Obsidian community portal publishes an automated scorecard for every plugin. It scans the latest GitHub release plus the source repository and reports across four health categories (**Hygiene**, **Maintenance**, **Responsiveness**, **Adoption**) and a **Review** section that flags concrete issues from automated scans.

This document maps the scorecard signals to concrete fixes you can apply. Use it when a user asks "why is my score low?" or "help me fix my plugin's scorecard."

## Health Category Fixes

### Hygiene

The portal checks for four files at the repo root.

| Signal                | Fix                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Missing readme        | Add `README.md` describing the plugin's purpose, installation, usage, and screenshots.                                               |
| Missing license       | Add `LICENSE` (MIT is typical).                                                                                                      |
| Missing description   | Ensure `manifest.json` has a clear `description` field.                                                                              |
| Missing contributing  | Add `CONTRIBUTING.md`. See [contributing-template.md](contributing-template.md) for a portable template.                             |

### Maintenance, Responsiveness, Adoption

These reflect commit cadence, issue close rate, install count, and stars. They are not directly fixable by editing files. Steer the user toward consistent maintenance habits rather than a one-shot fix.

## Review Section Fixes

The Review section is where most score improvement happens. Issues are grouped into **Risks**, **Warnings**, **Disclosures**, **Other**, and **Passed**.

### Disclosures (informational, not fixable)

Disclosures are not deductions, they are informational. Common ones for plugins:

- **Vault Enumeration** — uses `vault.getFiles()`, `getMarkdownFiles()`, etc.
- **Vault Read** — uses `vault.read()` or `vault.cachedRead()`.
- **Vault Write** — uses `vault.modify()`, `vault.create()`, etc.
- **Clipboard Access** — reads or writes the system clipboard.
- **Malware scan not available** / **Vulnerable dependencies scan not available** — scanner-side limitations.

Do not try to remove these. They reflect the plugin's actual API surface and the user should understand them when installing.

### Vulnerable transitive dev dependencies

The scanner reports advisories like:

> Potentially vulnerable dependency `<pkg>` (via `<parent>`). Upgrade to version X or later.

These are almost always **dev-only transitives** pulled in through `eslint`, `eslint-plugin-obsidianmd`, and `@typescript-eslint/*`. They never ship in `main.js`, but the scorecard still counts them.

**Fix**: add a `pnpm.overrides` block to `package.json` that forces patched versions. Major-version-scoped ranges keep API compatibility while bumping the patch:

```json
{
  "pnpm": {
    "overrides": {
      "minimatch@<3.1.3": "^3.1.3",
      "minimatch@^4 || ^5 || ^6 || ^7 || ^8": "^8.0.5",
      "minimatch@^9": "^9.0.6",
      "picomatch@<2.3.2": "^2.3.2",
      "picomatch@^3 || ^4": "^4.0.4",
      "brace-expansion@<1.1.13": "^1.1.13",
      "brace-expansion@^2": "^2.0.3",
      "ajv@<6.14.0": "^6.14.0",
      "ajv@^7 || ^8": "^8.18.0",
      "flatted@<3.4.0": "^3.4.0",
      "fast-uri@<3.1.1": "^3.1.1",
      "yaml@<2.8.3": "^2.8.3"
    }
  }
}
```

Then run `pnpm install` and `pnpm why <pkg>` to verify the patched version is resolved.

**Why this format**: pnpm override selectors match against resolved versions. The `package@<range>` key form lets you target one major at a time. A bare `package: "version"` would force every consumer to the same major and break anything depending on a different one.

### Missing GitHub artifact attestation

> X release assets are missing a GitHub artifact attestation.

**Fix**: add a release workflow that runs `actions/attest-build-provenance@v2` against the release files. Drop this at `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - "*"

permissions:
  contents: write
  id-token: write
  attestations: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/attest-build-provenance@v2
        with:
          subject-path: |
            main.js
            styles.css
            manifest.json
      - env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAG: ${{ github.ref_name }}
        run: |
          gh release create "$TAG" \
            --title="$TAG" \
            --generate-notes \
            main.js styles.css manifest.json
```

Then cut releases by pushing a tag (e.g. `git tag 0.1.0 && git push origin 0.1.0`) instead of uploading files manually. The workflow attaches the assets and registers the attestation, which the scorecard checks against the source repo for byte-for-byte reproducibility.

### Duplicate CSS selectors

> Unexpected duplicate selector ".foo .bar", first used at line N.

**Fix**: merge the two rule blocks. If they target the same selector and have non-overlapping properties, combine into one block. If they target the same selector and one is meant to override the other (e.g. inside a media query), wrap the override in a more specific selector or use a CSS variable.

### `obsidianmd` ESLint rules (Warnings and Risks)

`eslint-plugin-obsidianmd` enforces Obsidian-idiomatic patterns. Common signals and fixes:

#### `obsidianmd/ui/sentence-case` (Risk if disabled, Warning if violated)

User-facing strings must follow sentence case. The rule auto-detects most static strings; template literals are sometimes missed but still violate the spirit of the rule.

```ts
// Wrong
new Notice('Click Here To Continue');
this.countEl.setText('0 selected');

// Right
new Notice('Click here to continue');
this.countEl.setText('0 Selected');
```

**Never disable this rule.** The scorecard explicitly flags `eslint-disable-next-line obsidianmd/ui/sentence-case` as a Risk and counts each occurrence. If a string genuinely cannot be sentence case (e.g. it embeds a proper noun or product name), fix the casing instead of disabling.

#### `obsidianmd/prefer-create-el-shorthand` (Warning)

Use `createDiv()` and `createSpan()` instead of `createEl('div')` and `createEl('span')`.

```ts
// Wrong
const wrap = containerEl.createEl('div', { cls: 'my-wrap' });
const label = wrap.createEl('span', { text: 'Hello' });

// Right
const wrap = containerEl.createDiv({ cls: 'my-wrap' });
const label = wrap.createSpan({ text: 'Hello' });
```

#### `obsidianmd/prefer-active-doc` (Warning)

Use `activeDocument` instead of `document` and `activeWindow.setTimeout/setInterval/clearTimeout/clearInterval` instead of the globals. This ensures behavior in Obsidian popout windows.

```ts
// Wrong
this.registerDomEvent(document, 'click', handler);
setTimeout(refresh, 500);
clearInterval(this.intervalId);

// Right
this.registerDomEvent(activeDocument, 'click', handler);
activeWindow.setTimeout(refresh, 500);
activeWindow.clearInterval(this.intervalId);
```

#### `obsidianmd/no-eslint-disable-without-description` (Risk)

> Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.

Every `eslint-disable*` comment must end with `--` and a reason.

```ts
// Wrong
// eslint-disable-next-line @typescript-eslint/no-explicit-any

// Right
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party type is loose
```

This is the most common Risk-tier finding for plugins that accumulated `eslint-disable` comments before adopting the rule. Audit every existing disable comment and either add a reason or refactor the code to avoid the disable.

#### `@typescript-eslint/no-unused-vars` (Warning)

> 'foo' is defined but never used. Allowed unused args must match /^_/u.

**Fix**: prefix unused parameters with `_` (e.g. `_file`, `_index`, `_settings`). For destructured properties you don't need, remove them.

#### `@typescript-eslint/no-explicit-any` (Warning)

> Unexpected `any`. Specify a different type.

**Fix**: replace `any` with `unknown` and narrow at the use site, or with a proper type. If the API is genuinely typed loosely (e.g. `JSON.parse`), use `unknown` and validate. Reserve `any` only for cases where even `unknown` is infeasible and document with an inline disable that has a description.

#### `@typescript-eslint/no-unnecessary-type-assertion` (Error after upgrading typescript-eslint)

> This assertion is unnecessary since it does not change the type of the expression.

**Fix**: run `pnpm lint:fix`. The autofix removes the redundant assertion.

#### `@typescript-eslint/no-misused-promises` (Warning)

> Promise returned in function argument where a void return was expected.

**Fix**: explicitly `void` or `.catch()` the promise:

```ts
// Wrong
button.onclick = async () => { await doThing(); };

// Right (fire-and-forget)
button.onclick = () => { void doThing(); };

// Better (handle errors)
button.onclick = () => { doThing().catch(console.error); };
```

#### `@typescript-eslint/no-floating-promises` (Warning)

> Promises must be awaited, end with a call to .catch, or be explicitly marked as ignored with the `void` operator.

Same fix as above.

### `Plugin name should not be in all caps` (manifest.json)

Lowercase the `name` field in `manifest.json`. Title case is fine; all caps is not.

```json
// Wrong
"name": "SEO"

// Right
"name": "SEO Checker"   // proper noun is OK
"name": "Search engine optimization"
```

## ESLint Config Pattern for the Type-Aware Rules

When you bump `eslint-plugin-obsidianmd` to a version that adds type-aware rules (0.3.0+), the rules will fail on non-TypeScript files because there is no `parserOptions.project` for them. Scope the recommended config to TS only:

```js
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "*.js", "scripts/**"] },
  // Only run obsidianmd recommended rules on TypeScript files
  ...obsidianmd.configs.recommended.map((config) => ({
    ...config,
    files: config.files ?? ["**/*.ts"],
  })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json", sourceType: "module" },
      // ...
    },
  },
]);
```

## Verification Workflow

After applying fixes:

1. `pnpm install` to refresh the lockfile.
2. `pnpm why <vulnerable-pkg>` for each advisory to confirm the patched version is resolved everywhere.
3. `pnpm build` to confirm the production build still works.
4. `pnpm lint` to confirm no new errors.
5. Bump `version` in `manifest.json`, `package.json`, and `versions.json`.
6. Commit, then tag and push the tag. The release workflow handles the rest.
7. Wait for the scorecard to refresh (usually within an hour of the release).

## What the Scorecard Doesn't Penalize

- Plugin runtime API surface (vault read/write, clipboard, network) — these become **Disclosures** and inform the user, not deductions.
- Obsidian API breadth — using lots of API is fine and expected.
- Plugin file count or repo size.
- The plugin's actual functionality or popularity (Maintenance and Adoption are reported separately and do not require code changes).

## Related Documentation

- [contributing-template.md](contributing-template.md) — canonical CONTRIBUTING.md text.
- [versioning-releases.md](versioning-releases.md) — release workflow setup.
- [security-privacy.md](security-privacy.md) — dependency vulnerability handling.
- [release-readiness.md](release-readiness.md) — broader pre-release checklist.
- [code-patterns.md](../../obsidian-dev/references/code-patterns.md) — idiomatic API usage that satisfies obsidianmd rules.
- [ux-copy.md](../../obsidian-ref/references/ux-copy.md) — sentence case and other UI text rules.
