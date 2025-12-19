<!--
Source: Based on Obsidian Sample Plugin
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin repo for updates
-->

# Versioning & releases

**Before releasing**: Use the comprehensive [release-readiness.md](release-readiness.md) checklist to verify your plugin is ready for release.

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- **Build for production**: Run `npm run build` to create `main.js` in root
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `main.js`, `manifest.json`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.


