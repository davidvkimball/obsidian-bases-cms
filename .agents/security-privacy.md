<!--
Source: Based on Obsidian Developer Policies and Guidelines
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Developer Policies for updates
Applicability: Both
-->

# Security, privacy, and compliance

Follow Obsidian's **Developer Policies** (https://docs.obsidian.md/Developer+policies) and **Plugin Guidelines** (https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines). See [release-readiness.md](release-readiness.md) for a comprehensive release checklist.

## Developer Policies Requirements

### Prohibited Practices

- **Code obfuscation**: Code must be readable and not minified/obfuscated
- **Dynamic ads**: No dynamic advertising in plugins
- **Client-side telemetry**: No hidden telemetry. If you collect optional analytics, require explicit opt-in and document clearly in `README.md` and in settings
- **Self-updating mechanisms**: No automatic code updates outside of normal releases. Never execute remote code, fetch and eval scripts, or auto-update code

### Mandatory Disclosures

If your plugin requires any of the following, you **must** disclose it clearly in `README.md` and in settings:

- **Payments or subscriptions**: Clearly state if the plugin requires payment
- **User accounts**: Disclose if user accounts are required
- **Network usage**: Disclose any API calls, external services, or network requests
- **Files outside vault**: Disclose if the plugin accesses files outside the Obsidian vault

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
- Ensure license compatibility between your plugin's license and any third-party code licenses

## Plugin Guidelines

- **Code organization**: Organize code into logical files/folders
- **Console logging**: Minimize console output (only `console.warn()`, `console.error()`, or `console.debug()` - no `console.log()` in production)
- **UI text**: Use sentence case for UI text (see [ux-copy.md](ux-copy.md))
- **Class naming**: Use descriptive class names (not placeholders like "MyPlugin")
- **Security**: Avoid unsafe patterns (eval, innerHTML misuse, etc.)

## Implementation

**Plugins**: Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

**Themes**: Themes are CSS-only and have minimal security surface area, but still follow privacy guidelines for any optional features.

## Related Documentation

- [release-readiness.md](release-readiness.md) - Comprehensive release checklist including policy adherence
- [manifest.md](manifest.md) - Manifest requirements (includes security-related fields)
- [Developer Policies](https://docs.obsidian.md/Developer+policies) - Official Obsidian Developer Policies
- [Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) - Official Plugin Guidelines


