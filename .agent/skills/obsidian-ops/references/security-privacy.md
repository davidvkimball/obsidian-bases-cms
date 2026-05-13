<!--
Source: Based on Obsidian Developer Policies and Guidelines
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Developer Policies for updates
-->

# Security, privacy, and compliance

Follow Obsidian's **Developer Policies** (https://docs.obsidian.md/Developer+policies) and **Theme Guidelines** (https://docs.obsidian.md/Themes/Releasing/Theme+guidelines). See [release-readiness.md](release-readiness.md) for a comprehensive release checklist.

## Developer Policies Requirements

### Prohibited Practices

- **Code obfuscation**: CSS must be readable and not minified/obfuscated
- **Dynamic ads**: No dynamic advertising
- **Client-side telemetry**: No hidden telemetry. If you collect optional analytics, require explicit opt-in and document clearly in `README.md`
- **Self-updating mechanisms**: No automatic code updates outside normal releases. Never execute remote code, fetch and eval scripts, or auto-update code

### Mandatory Disclosures

If your theme requires any of the following, you **must** disclose it clearly in `README.md`:

- **Payments or subscriptions**: Clearly state if the theme requires payment
- **User accounts**: Disclose if user accounts are required
- **Network usage**: Disclose any API calls, external services, or network requests
- **Files outside vault**: Disclose if the theme accesses files outside the Obsidian vault (rare for themes, but applicable if using any external resources)

### Privacy and Security

- Default to local/offline operation. Only make network requests when essential to the feature.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.

### Licensing

- Include a LICENSE file in your project root
- Respect licenses of any third-party code used
- Provide proper attribution for third-party code in `README.md`
- Ensure license compatibility between your theme's license and any third-party code licenses

## Theme Guidelines

- **CSS organization**: Organize CSS/SCSS into logical files/folders
- **CSS variables**: Use consistent naming conventions for CSS variables
- **Security**: Themes are CSS-only and have minimal security surface area

## Implementation

Themes are CSS-only and have minimal security surface area, but still follow privacy guidelines for any optional features.

## Dependency Vulnerability Hygiene (Plugins)

The community scorecard scans the lockfile and flags any package with a known advisory, even if the package is dev-only and never ships in `main.js`. Common offenders are transitives pulled in by `eslint`, `eslint-plugin-obsidianmd`, and `@typescript-eslint/*`: `minimatch`, `picomatch`, `brace-expansion`, `ajv`, `flatted`, `fast-uri`, `yaml`.

Use `pnpm.overrides` in `package.json` to force patched versions of vulnerable transitives without changing direct dependencies. Major-version-scoped ranges avoid breaking consumers that depend on a specific major:

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

Verify with `pnpm install` then `pnpm why <pkg>` for each advisory. Every resolved version should be at or above the advisory's fix version.

If a direct dependency (e.g. `eslint-plugin-obsidianmd`) has a newer release that already pulls in patched transitives, prefer bumping the direct dep before adding an override. Overrides are appropriate when no upstream release covers your case.

See [scorecard-compliance.md](scorecard-compliance.md) for the full set of scorecard signals and their fixes.

## Related Documentation

- [release-readiness.md](release-readiness.md) - Comprehensive release checklist including policy adherence
- [scorecard-compliance.md](scorecard-compliance.md) - Mapping of scorecard signals to concrete fixes
- [manifest.md](../../obsidian-ref/references/manifest.md) - Manifest requirements (includes security-related fields)
- [Developer Policies](https://docs.obsidian.md/Developer+policies) - Official Obsidian Developer Policies
- [Theme Guidelines](https://docs.obsidian.md/Themes/Releasing/Theme+guidelines) - Official Theme Guidelines


