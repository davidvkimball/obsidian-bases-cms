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

- **Vault Enumeration**: uses `vault.getFiles()`, `getMarkdownFiles()`, etc.
- **Vault Read**: uses `vault.read()` or `vault.cachedRead()`.
- **Vault Write**: uses `vault.modify()`, `vault.create()`, etc.
- **Clipboard Access**: reads or writes the system clipboard.
- **Malware scan not available** / **Vulnerable dependencies scan not available**: scanner-side limitations.

Do not try to remove these. They reflect the plugin's actual API surface and the user should understand them when installing.

### Vulnerable transitive dev dependencies

The scanner reports advisories like:

> Potentially vulnerable dependency `<pkg>` (via `<parent>`). Upgrade to version X or later.

These are almost always **dev-only transitives** pulled in through `eslint`, `eslint-plugin-obsidianmd`, and `@typescript-eslint/*`. They never ship in `main.js`, but the scorecard still counts them.

**Fix**: add an `overrides` block to `pnpm-workspace.yaml` (create the file at the repo root if it does not exist) that forces patched versions. Recent pnpm (v10.x and later) reads `overrides` from `pnpm-workspace.yaml`, not the old `pnpm.overrides` field in `package.json`; newer pnpm ignores the old location and prints a deprecation warning ("the pnpm field in package.json is no longer read"). Major-version-scoped ranges keep API compatibility while bumping the patch:

```yaml
# pnpm-workspace.yaml
overrides:
  "minimatch@<3.1.3": "^3.1.3"
  "minimatch@^4 || ^5 || ^6 || ^7 || ^8": "^8.0.5"
  "minimatch@^9": "^9.0.6"
  "picomatch@<2.3.2": "^2.3.2"
  "picomatch@^3 || ^4": "^4.0.4"
  "brace-expansion@<1.1.13": "^1.1.13"
  "brace-expansion@^2": "^2.0.3"
  "ajv@<6.14.0": "^6.14.0"
  "ajv@^7 || ^8": "^8.18.0"
  "flatted@<3.4.0": "^3.4.0"
  "fast-uri@<3.1.1": "^3.1.1"
  "yaml@<2.8.3": "^2.8.3"
```

Then run `pnpm install` and `pnpm why <pkg>` to verify the patched version is resolved. (Plugins created before this pnpm change may still carry a `pnpm.overrides` block in `package.json`; move it to `pnpm-workspace.yaml` and delete the old field.)

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
  workflow_dispatch:

permissions:
  contents: write
  id-token: write
  attestations: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - id: version
        run: echo "version=$(jq -r .version manifest.json)" >> "$GITHUB_OUTPUT"
      - uses: actions/attest-build-provenance@v2
        with:
          subject-path: |
            main.js
            styles.css
            manifest.json
      - env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VERSION: ${{ steps.version.outputs.version }}
        run: |
          COMMIT_NOTES=$(git log -1 --pretty=format:%B)
          PREV_TAG=$(git tag --sort=-creatordate --merged HEAD | grep -v "^${VERSION}$" | head -n 1 || true)
          if [ -n "$PREV_TAG" ]; then
            COMPARE="**Full Changelog**: https://github.com/${GITHUB_REPOSITORY}/compare/${PREV_TAG}...${VERSION}"
          else
            COMPARE="**Full Changelog**: https://github.com/${GITHUB_REPOSITORY}/commits/${VERSION}"
          fi
          NOTES=$(printf "%s\n\n---\n\n%s\n" "$COMMIT_NOTES" "$COMPARE")
          gh release create "$VERSION" \
            --title="$VERSION" \
            --notes "$NOTES" \
            main.js styles.css manifest.json
```

Then cut releases by pushing a tag (e.g. `git tag 0.1.0 && git push origin 0.1.0`) instead of uploading files manually. The workflow attaches the assets and registers the attestation, which the scorecard checks against the source repo for byte-for-byte reproducibility.

### Build verification failed (non-reproducible build)

> Build verification failed: the `main.js` built from source does not match the release artifact.

This appears even when attestation passes; attestation proves CI built the
asset; build verification proves the asset can be **reproduced** byte-for-byte
from the tagged source. The single most common cause is an **inline sourcemap**
in the production build.

`sourcemap: "inline"` in `esbuild.config.mjs` base64-embeds the build machine's
**absolute file paths** into `main.js`. GitHub Actions builds at
`/home/runner/work/<repo>/...`; the scorecard's reproducer builds at a
different path. Same source, byte-different `main.js` → verification fails. (It
also bloats the shipped file and leaks build paths.)

**Fix**: gate the sourcemap on build mode so production ships without one.
Compute the flag before `esbuild.context(...)` and reference it on the
`sourcemap` field:

```js
// Production builds must be reproducible. An inline sourcemap embeds the
// build machine's absolute file paths into main.js, so CI and the scorecard
// reproducer produce byte-different output. Ship production with no
// sourcemap; keep the inline sourcemap only for the dev/watch build.
const isProduction =
	process.argv.slice(2).includes("build") ||
	process.argv.slice(2).includes("production");

const context = await esbuild.context({
	// ...
	sourcemap: isProduction ? false : "inline",
	// ...
});
```

(`pnpm build` runs `node esbuild.config.mjs production`; `pnpm dev` runs it
with no args, so dev/watch keeps the inline sourcemap for local debugging.)

Other reproducibility killers to rule out if the sourcemap is already gated:
commit `pnpm-lock.yaml` and use `pnpm install --frozen-lockfile` in CI (so the
dependency tree is identical), pin the CI Node version, and never hand-edit
`main.js` after building or upload a locally built asset; let the workflow
build and attach it.

### Duplicate CSS selectors

> Unexpected duplicate selector ".foo .bar", first used at line N.

**Fix**: merge the two rule blocks. If they target the same selector and have non-overlapping properties, combine into one block. If they target the same selector and one is meant to override the other (e.g. inside a media query), wrap the override in a more specific selector or use a CSS variable.

### `!important` declarations

> Avoid `!important`. Override styles by increasing selector specificity or using CSS variables instead.

The fix is almost never to keep `!important` and hope the scorecard ignores it. Instead, scope the rule with a parent class so it wins the cascade naturally.

```css
/* Wrong: leans on !important to beat Obsidian's defaults */
.my-plugin-btn {
  border: none !important;
  background: none !important;
}

/* Right: parent class boosts specificity, no !important needed */
.my-plugin-panel .my-plugin-btn {
  border: none;
  background: none;
}
```

The parent class is whatever wrapper the plugin's UI lives inside (e.g. the panel root, settings container). For toggle classes that need to beat an element's natural display, chain the toggle class with the base class for the same specificity boost: `.my-plugin-panel .my-toggle-hidden { display: none; }`.

### `:has()` selector

> Avoid `:has()`. It can cause significant performance issues due to broad selector invalidation.

Most uses of `:has()` are stylistic preferences that can be rewritten as descendant selectors targeting the child element directly.

```css
/* Wrong: re-styles the parent based on a descendant */
.result:has(a[href*="http"]) {
  word-break: break-all;
}

/* Right: targets the child directly */
.result a[href*="http"] {
  word-break: break-all;
}
```

If the rule genuinely needs to style a parent based on a child's presence, fall back to adding a marker class via TypeScript when the child is appended (e.g. `parentEl.addClass('has-external-link')`).

### Don't override global Obsidian UI selectors

A plugin's `styles.css` is loaded globally. Rules targeting Obsidian's built-in classes affect every other plugin and Obsidian itself, not just yours.

```css
/* Wrong: forces flex layout on every menu in Obsidian, not just this plugin's */
.menu .menu-item {
  display: flex !important;
  justify-content: space-between !important;
}
```

**Fix**: either remove the rule and accept Obsidian's default styling, or scope it. Menus appended outside your plugin's panel (via `new Menu()`) can't be scoped via parent class, so the rule has to be removed, or a marker class added when the menu is opened. The scorecard does not specifically flag this leak, but it's a hygiene rule that prevents conflicts with other plugins.

### `obsidianmd` ESLint rules (Warnings and Risks)

`eslint-plugin-obsidianmd` enforces Obsidian-idiomatic patterns. Common signals and fixes:

#### `obsidianmd/ui/sentence-case` (Risk if disabled, Warning if violated)

User-facing strings must follow sentence case. The rule auto-detects most static strings; template literals are sometimes missed but still violate the spirit of the rule.

```ts
// Wrong
new Notice('Click Here To Continue');
this.countEl.setText('0 Selected');

// Right
new Notice('Click here to continue');
this.countEl.setText('0 selected');
```

**Never disable this rule.** The scorecard explicitly flags `eslint-disable-next-line obsidianmd/ui/sentence-case` as a Risk and counts each occurrence. If a string genuinely cannot be sentence case (e.g. it embeds a proper noun or product name), fix the casing instead of disabling.

**Configure the rule for domain-specific acronyms.** The rule accepts `acronyms`, `brands`, `ignoreWords`, and `ignoreRegex` options. Use these when your plugin legitimately uses acronyms or quoted button names that the rule otherwise rejects.

```js
// eslint.config.mjs
"obsidianmd/ui/sentence-case": ["error", {
  acronyms: ["SEO", "MDX", "URL", "CSV", "H1", "H2", "H3", "H4", "H5", "H6"],
  ignoreRegex: ['"[^"]+"'],  // ignore content inside double quotes (referenced button/control names)
}]
```

This is the right answer when the autofix expected output is something like `'Open seo audit panel'` (downcased acronym) but the string genuinely should read `'Open SEO audit panel'`. Configuring the rule is preferred over per-line disables, which are forbidden, or awkward rephrasing.

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

#### `obsidianmd/no-static-styles-assignment` (Risk if disabled)

Setting styles imperatively (via `element.style.foo = ...` or `element.style.setProperty(...)`) is flagged. Static styling belongs in `styles.css` (use a class); only genuinely runtime-computed values (a measured height, a zoom factor, a drag offset) should be set from code, and those must go through Obsidian's element helpers.

```ts
// Wrong
el.style.maxHeight = '0';
el.style.setProperty('--progress', `${pct}%`);

// Right - static styling in a class, dynamic values via helpers
el.addClass('my-plugin-collapsed');            // static
el.setCssStyles({ maxHeight: '0' });           // runtime standard property (camelCase)
el.setCssProps({ '--progress': `${pct}%` });   // runtime custom property (uses setProperty)
```

**Never disable this rule.** Unlike the generic disable rule above, a `--` reason does not make it acceptable; refactor to a class or a `setCssStyles` / `setCssProps` call instead. `setCssProps` maps to `setProperty` (use it for CSS custom properties and kebab-case properties); `setCssStyles` takes camelCase standard properties.

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

When you bump `eslint-plugin-obsidianmd` to a version that adds type-aware rules (0.3.0+), the rules will fail on non-TypeScript files because there is no `parserOptions.project` for them. Scope the recommended config to TS only, but scope **only the rule-bearing config objects**:

```js
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "*.js", "scripts/**"] },
  // Only run obsidianmd recommended rules on TypeScript files. Objects that
  // merely register the plugin must stay unscoped, or rules applied to other
  // file types cannot resolve the plugin and ESLint refuses to start.
  ...obsidianmd.configs.recommended.map((config) =>
    config.rules ? { ...config, files: config.files ?? ["**/*.ts"] } : config,
  ),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json", sourceType: "module" },
      // ...
    },
  },
  {
    files: ["**/*.mjs"],
    // Build tooling (esbuild config, version bump) runs in Node, not inside the
    // plugin sandbox, so the mobile-compatibility and console restrictions that
    // apply to plugin source are not relevant. The scorecard scans plugin source
    // only and does not flag these files either.
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
      "obsidianmd/rule-custom-message": "off",
      "no-console": "off",
    },
  },
]);
```

**Do not blanket-map `files` onto every recommended config object.** The older form below breaks on 0.4.1, because that version's recommended config includes a plugin-registration object with no `files` of its own. Forcing `files: ["**/*.ts"]` onto it registers the plugin for TS only, while other blocks still apply `obsidianmd/*` rules to `.js`/`.mjs`, and ESLint aborts with "could not find plugin obsidianmd" before linting anything:

```js
// Wrong on 0.4.1+ - ESLint fails to start
...obsidianmd.configs.recommended.map((config) => ({
  ...config,
  files: config.files ?? ["**/*.ts"],
})),
```

### Keep the lint toolchain at the version the scorecard runs

The scorecard runs the **latest** `eslint-plugin-obsidianmd`, not the version pinned in `package.json`. A pinned older version cannot report rules it does not contain, so a green local `pnpm lint` says nothing about the scorecard. For example 0.1.9 has no `prefer-create-el` and no `prefer-window-timers` at all.

Before interpreting any scorecard result, match the version and re-lint:

```bash
pnpm add -D eslint-plugin-obsidianmd@latest
pnpm lint
```

Most `prefer-create-el` findings are auto-fixable with `pnpm exec eslint src --fix` (it rewrites `createEl('div', ...)` to `createDiv(...)`). Note the scorecard labels these "uses `document.createElement`" even when the code already uses `createEl`; the rule is really about the shorthand.

## Declare the TypeScript lib your code actually uses

A large cluster of `@typescript-eslint/no-unsafe-*` findings (`no-unsafe-member-access`, `no-unsafe-call`, `no-unsafe-assignment`, `no-unsafe-argument`, `no-unsafe-return`) that you **cannot reproduce locally** usually means the `lib` in `tsconfig.json` does not declare the APIs the code calls.

The Obsidian sample plugin template ships:

```json
"lib": ["DOM", "ES5", "ES6", "ES7"]
```

That stops at ES2016. Anything newer is undeclared, so calls to it resolve to `any` and every downstream use is flagged as unsafe. Commonly hit:

| API | Requires |
| --- | --- |
| `Object.values`, `Object.entries`, `padStart`, `padEnd` | ES2017 |
| `Array.flat`, `Array.flatMap`, `Object.fromEntries`, `trimStart`, `trimEnd` | ES2019 |
| `String.matchAll`, `Promise.allSettled` | ES2020 |
| `String.replaceAll`, `Promise.any` | ES2021 |
| `Array.at`, `Object.hasOwn` | ES2022 |

It still type checks locally because `@types/node` contains a `/// <reference lib="es2020" />` that pulls the newer lib in as a side effect. Any type check that does not get that incidental injection sees the calls as untyped, which is what the scorecard reports.

**Fix**: declare the lib explicitly.

```json
"lib": ["DOM", "ES2020"]
```

This is a type-only change. `esbuild.config.mjs` sets its own `target`, so `main.js` is byte identical and the build stays reproducible. Verify that: hash `main.js` before and after, and confirm the hashes match.

**Reproduce the scorecard's view** with a throwaway config that disables the automatic `@types` injection:

```bash
printf '{ "extends": "./tsconfig.json", "compilerOptions": { "types": [] } }' > tsconfig.probe.json
pnpm exec tsc -p tsconfig.probe.json --noEmit --skipLibCheck
rm tsconfig.probe.json
```

Errors of the form `TS2550: Property 'values' does not exist on type 'ObjectConstructor'. Do you need to change your target library?` land on exactly the lines the scorecard flags. Zero errors means the plugin is unaffected and needs no change.

## A manifest version with no matching release

> No release matches your manifest version

This is worse than a failed review: the directory installs assets from the release tagged with the manifest version, so until one exists it can neither scan nor distribute the plugin. Bumping `manifest.json` in a commit without also pushing the tag is enough to cause it, and nothing local complains.

**Fix**: push a tag matching the manifest version exactly, with no `v` prefix (`0.1.0`, not `v0.1.0`).

```bash
git tag 0.1.0 && git push origin 0.1.0
```

`node scripts/fleet-audit.mjs --releases` checks every maintained repo for this mismatch.

## Auditing the whole fleet

The drift described above is invisible to a per-repo `pnpm lint`, so check it across every repo at once:

```bash
node scripts/fleet-audit.mjs           # config drift only
node scripts/fleet-audit.mjs --probe   # also compile-probe the TypeScript lib
```

It is read-only and never edits, commits, or releases. It reports, per repo: a tsconfig lib that stops at ES2016, an `eslint-plugin-obsidianmd` pin behind the expected version, the broken recommended-config mapping, and `pnpm.overrides` left in `package.json`.

The repo list comes from `fleet.json`, which is the single source of truth for the fleet scripts. Repos that are not David's to release live in its `excluded` map; anything found in the root but not yet classified is reported under "Unclassified" rather than silently skipped, so new repos cannot quietly fall out of fleet-wide audits.

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

- Plugin runtime API surface (vault read/write, clipboard, network): these become **Disclosures** and inform the user, not deductions.
- Obsidian API breadth: using lots of API is fine and expected.
- Plugin file count or repo size.
- The plugin's actual functionality or popularity (Maintenance and Adoption are reported separately and do not require code changes).

## Related Documentation

- [contributing-template.md](contributing-template.md): canonical CONTRIBUTING.md text.
- [versioning-releases.md](versioning-releases.md): release workflow setup.
- [security-privacy.md](security-privacy.md): dependency vulnerability handling.
- [release-readiness.md](release-readiness.md): broader pre-release checklist.
- [code-patterns.md](../../obsidian-dev/references/code-patterns.md): idiomatic API usage that satisfies obsidianmd rules.
- [ux-copy.md](../../obsidian-ref/references/ux-copy.md): sentence case and other UI text rules.
