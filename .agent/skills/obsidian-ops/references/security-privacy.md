<!--
Source: Based on Obsidian Developer Policies and Guidelines
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Developer Policies for updates
-->

# Security, privacy, and compliance

Follow Obsidian's [**Developer Policies**](https://docs.obsidian.md/Developer+policies) and [**Plugin Guidelines**](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines). See [release-readiness.md](release-readiness.md) for a comprehensive release checklist.

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
- Respect user privacy. Do not collect vault contents, file names, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.

### Secret Storage

**Source**: Based on [SecretStorage and SecretComponent guide](https://docs.obsidian.md/plugins/guides/secret-storage) (available since Obsidian 1.11.4)

When your plugin needs to store sensitive data like API keys, tokens, or passwords, **always use SecretStorage** instead of storing secrets directly in your plugin's `data.json` file.

**Why use SecretStorage?**

- **Security**: Secrets are stored securely in a centralized location, not in plaintext alongside other plugin data
- **User experience**: Users can share secrets across multiple plugins without duplicating them
- **Maintenance**: When a token changes, users only need to update it once in SecretStorage, not in every plugin

**Best Practices**:

- **Never store secrets in `data.json`**: Use `SecretComponent` in your settings UI and store only the secret *name* (ID) in your settings
- **Always check for null**: When retrieving secrets with `app.secretStorage.get()`, the value may be `null` if the secret doesn't exist
- **Use descriptive secret IDs**: Follow the lowercase alphanumeric format with optional dashes (e.g., `my-plugin-api-key`)
- **Handle missing secrets gracefully**: Provide clear error messages if a required secret is not found

See [common-tasks.md](common-tasks.md) for code examples and [code-patterns.md](code-patterns.md) for comprehensive implementation patterns.

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

Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## Related Documentation

- [release-readiness.md](release-readiness.md) - Comprehensive release checklist including policy adherence
- [manifest.md](manifest.md) - Manifest requirements (includes security-related fields)
- [Developer Policies](https://docs.obsidian.md/Developer+policies) - Official Obsidian Developer Policies
- [Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) - Official Plugin Guidelines


