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
          if gh release view "$VERSION" >/dev/null 2>&1; then
            gh release upload "$VERSION" main.js styles.css manifest.json --clobber
          else
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
          fi
```

**Why read the version from `manifest.json`**: the workflow runs from either a tag push (where `github.ref_name` is the tag) or a `workflow_dispatch` from a branch (where `github.ref_name` is the branch name, e.g. `master`). Using `github.ref_name` directly would title a manually-triggered release after the branch. Reading from `manifest.json` is consistent across both triggers and matches what Obsidian's plugin loader actually reads.

**Why build the release notes manually instead of `--generate-notes`**: `--generate-notes` produces an auto-changelog headed by a "What's Changed" PR list and a "Full Changelog" compare link. For plugins maintained by a single person without a PR workflow, that auto-generated body is usually just the compare link with no context. Reading the latest commit message gives the reader the actual "what changed and why" up front. The compare link is still appended underneath for the full diff. `fetch-depth: 0` is required so `git tag --merged HEAD` has the tag history to find the previous version.

Cut releases by pushing a tag (`git tag 0.1.0 && git push origin 0.1.0`). The workflow attaches the three required assets and registers the attestation. The scorecard's "Build verified" signal also fires once the workflow has run, because the attested artifacts can be reproduced byte-for-byte from source.

For the full set of scorecard signals and their fixes, see [scorecard-compliance.md](scorecard-compliance.md).

### Pushing tags so the workflow actually fires

Push order matters. Push commits to the default branch **first**, in a separate command, then push the tag. If you push both in a single batch (`git push --tags --follow-tags` or some GUIs), GitHub occasionally processes the tag webhook before indexing the workflow file at that ref, and the trigger silently drops.

```bash
git push origin master           # commits first
# pause a few seconds
git push origin 0.1.0            # tag in a separate command
```

If the workflow does not fire on a tag push, diagnose with:

```bash
gh api repos/:owner/:repo/actions/runs --jq '.workflow_runs[0:5] | .[] | {id, event, status, conclusion, head_branch, created_at}'
gh workflow list
gh api repos/:owner/:repo/actions/permissions/workflow
```

If `gh api .../runs` is empty for the tag, the trigger was dropped. Recovery options:

- **Add `workflow_dispatch:` to the trigger** so you can re-run from the Actions tab without a re-push.
- **Re-push the tag**: `git push origin :refs/tags/0.1.0 && git push origin 0.1.0`.
- **Manually create the release** in the GitHub UI. The release will exist but it will not have the build provenance attestation, which costs scorecard points until the next release.

### Recovery trigger

It is worth adding a manual trigger alongside the tag-push trigger so future "the workflow didn't fire" situations have a one-click fix:

```yaml
on:
  push:
    tags:
      - "*"
  workflow_dispatch:
```

> [!NOTE]
> Themes and plugins have different asset requirements and submission paths. Ensure you follow the correct flow for your project type.


