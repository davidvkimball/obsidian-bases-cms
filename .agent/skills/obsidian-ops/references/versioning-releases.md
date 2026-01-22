<!--
Source: Based on Obsidian Sample Plugin
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin repo for updates
-->

# Versioning & releases

**Before releasing**: Use the comprehensive [release-readiness.md](release-readiness.md) checklist to verify your plugin is ready for release.

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- **Build for production**: Run `pnpm build` to create `main.js` in root
- **Create a GitHub release**: The release tag must exactly match `manifest.json`'s `version` field **WITHOUT** a leading "v" prefix.
  - **Correct**: If `manifest.json` has `"version": "0.1.0"`, the tag must be `0.1.0` (not `v0.1.0`)
  - **Wrong**: `v0.1.0` (with "v" prefix) - this will NOT match and can cause issues
  - The tag name and release name should both use the version number without "v" prefix
- Attach `main.js`, `manifest.json`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.


