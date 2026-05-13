<!--
Source: Based on Obsidian Sample Theme
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Theme repo for updates
-->

# Versioning & releases

**Before releasing**: Use the comprehensive [release-readiness.md](release-readiness.md) checklist to verify your project is ready for release.

- Bump `version` in `manifest.json` (SemVer).
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
### Theme Releases
- Attach `manifest.json` and `theme.css` to the release as individual assets.
- After the initial release, follow the process to add/update your theme in the community catalog as required.

### Plugin Releases
- Attach `main.js`, `manifest.json`, and `styles.css` to the release as individual assets.
- Follow the plugin submission process to add/update your plugin in the community catalog.

### Automated plugin releases with build provenance attestation

The Obsidian community scorecard penalizes plugin releases whose assets are missing a GitHub artifact attestation. The recommended way to satisfy this signal is a tag-triggered release workflow that runs `actions/attest-build-provenance@v2` against the release files.

Drop the following at `.github/workflows/release.yml`:

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

Cut releases by pushing a tag (`git tag 0.1.0 && git push origin 0.1.0`). The workflow attaches the three required assets and registers the attestation. The scorecard's "Build verified" signal also fires once the workflow has run, because the attested artifacts can be reproduced byte-for-byte from source.

For the full set of scorecard signals and their fixes, see [scorecard-compliance.md](scorecard-compliance.md).

> [!NOTE]
> Themes and plugins have different asset requirements and submission paths. Ensure you follow the correct flow for your project type.


