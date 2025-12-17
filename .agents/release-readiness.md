<!--
Source: Based on Obsidian Developer Policies, Plugin Guidelines, and official release checklist
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Developer Policies and Plugin Guidelines for updates
Applicability: Plugin
-->

# Release Readiness Checklist

This document provides a comprehensive checklist to verify your plugin is ready for release to the Obsidian community. Use this when preparing a release or when asked "is my plugin ready for release?"

**For AI Agents**: When a user asks about release readiness, run through this checklist systematically. Perform automated checks where possible, and ask the user interactively for items that require their input.

## Quick Reference

- **Developer Policies**: https://docs.obsidian.md/Developer+policies
- **Plugin Guidelines**: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- **Release Process**: See [versioning-releases.md](versioning-releases.md)

## Automated Checks (AI Can Verify)

These checks can be performed automatically by reading files and scanning code:

### File Requirements

- [ ] **`main.js`** exists in project root (compiled output)
- [ ] **`manifest.json`** exists in project root with valid JSON structure
- [ ] **`styles.css`** exists (if plugin uses custom styles) - optional but should be included if present
- [ ] **`LICENSE`** file exists in project root
- [ ] **`README.md`** exists in project root

### Manifest Validation

- [ ] **Required fields present**: `id`, `name`, `version`, `minAppVersion`, `description`, `isDesktopOnly`
- [ ] **`id` format**: lowercase with hyphens (e.g., `"my-plugin-name"`), matches folder name
- [ ] **`version` format**: Semantic Versioning (x.y.z, e.g., `"1.0.0"`)
- [ ] **`minAppVersion`**: Set appropriately for APIs used
- [ ] **`isDesktopOnly`**: Set correctly based on mobile compatibility
- [ ] **JSON syntax**: Valid JSON (proper quotes, commas, brackets)

### Version Consistency

- [ ] **GitHub release tag**: Matches `manifest.json` version exactly (no "v" prefix)
  - If checking before release: Verify version format is ready
  - If checking after release: Verify tag matches manifest version

### Code Quality Checks

- [ ] **No code obfuscation**: Code is readable and not minified/obfuscated
- [ ] **No `eval()` usage**: Search codebase for `eval(` patterns
- [ ] **No `innerHTML` misuse**: Check for unsafe `innerHTML` assignments (should use `createEl` or safe alternatives)
- [ ] **No remote code execution**: No fetching and executing remote scripts
- [ ] **No self-updating mechanisms**: No automatic code updates outside normal releases
- [ ] **Console logging**: Only `console.warn()`, `console.error()`, or `console.debug()` - no `console.log()` in production code
- [ ] **Listener cleanup**: All event listeners registered using `registerEvent()`, `registerDomEvent()`, `registerInterval()`

### README.md Content

- [ ] **File exists**: `README.md` present in root
- [ ] **Describes purpose**: Clear description of what the plugin does
- [ ] **Usage instructions**: How to install and use the plugin
- [ ] **Attribution**: If using third-party code, proper attribution included

### LICENSE File

- [ ] **File exists**: `LICENSE` file present in root
- [ ] **License specified**: Clear license type (MIT, GPL, etc.)
- [ ] **Third-party compliance**: If using code from other plugins, verify license compatibility and attribution

## Interactive Checks (AI Asks User)

These checks require user input or confirmation:

### Platform Testing

- [ ] **Windows**: Plugin tested and working on Windows
- [ ] **macOS**: Plugin tested and working on macOS
- [ ] **Linux**: Plugin tested and working on Linux
- [ ] **Android**: Plugin tested and working on Android (if `isDesktopOnly: false`)
- [ ] **iOS**: Plugin tested and working on iOS (if `isDesktopOnly: false`)

**Note**: If user doesn't have access to all platforms, they should test on available platforms and note limitations.

### GitHub Release

- [ ] **Release created**: GitHub release exists for the version
- [ ] **Required files attached**: `main.js`, `manifest.json`, `styles.css` (if present) attached as **individual binary assets** (not just in source.zip)
- [ ] **Release name matches version**: Release name/tag exactly matches `manifest.json` version (no "v" prefix)

### Community Plugin Registration

- [ ] **`manifest.json` id matches `community-plugins.json`**: The `id` in your `manifest.json` matches the `id` in the `community-plugins.json` file (for plugins already in the community catalog)

### Documentation Quality

- [ ] **README.md describes purpose**: Clear explanation of what the plugin does
- [ ] **README.md provides usage instructions**: Step-by-step guide on how to use the plugin

### Developer Policies Adherence

- [ ] **Read Developer Policies**: User confirms they have read https://docs.obsidian.md/Developer+policies
- [ ] **No prohibited features**:
  - [ ] No code obfuscation
  - [ ] No dynamic ads
  - [ ] No client-side telemetry (unless explicitly opt-in and disclosed)
  - [ ] No self-updating mechanisms
- [ ] **Mandatory disclosures** (if applicable):
  - [ ] Payments required: Disclosed in README and settings
  - [ ] User accounts required: Disclosed in README and settings
  - [ ] Network usage: Disclosed in README and settings
  - [ ] Files outside vault: Disclosed in README and settings
- [ ] **Licensing**: LICENSE file present and compliant with any third-party code licenses

### Plugin Guidelines Adherence

- [ ] **Read Plugin Guidelines**: User confirms they have read https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- [ ] **Code organization**: Code is well-organized (not all in one file if complex)
- [ ] **Class naming**: Placeholder class names (like "MyPlugin") renamed to reflect actual functionality
- [ ] **Console logging**: Minimal console logging (only warnings, errors, debug - no `console.log()`)
- [ ] **UI text conventions**: UI text uses sentence case (see [ux-copy.md](ux-copy.md))
- [ ] **Security**: No unsafe patterns (eval, innerHTML misuse, etc.)

### Third-Party Code

- [ ] **License compliance**: All third-party code licenses are compatible with your plugin's license
- [ ] **Attribution**: Proper attribution given in README.md for any code from other plugins/projects
- [ ] **License compatibility**: Your plugin's license is compatible with any third-party code used

## Developer Policies Summary

For reference, key points from [Developer Policies](https://docs.obsidian.md/Developer+policies):

### Prohibited

- **Code obfuscation**: Code must be readable
- **Dynamic ads**: No dynamic advertising
- **Client-side telemetry**: No hidden telemetry (opt-in telemetry must be clearly disclosed)
- **Self-updating**: No automatic code updates outside normal releases

### Mandatory Disclosures

If your plugin requires any of the following, you **must** disclose it clearly:
- Payments or subscriptions
- User accounts
- Network usage (API calls, external services)
- Accessing files outside the Obsidian vault

### Licensing

- Include a LICENSE file
- Respect licenses of any third-party code used
- Provide proper attribution for third-party code

## Plugin Guidelines Summary

For reference, key points from [Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines):

- **Code organization**: Organize code into logical files/folders
- **Console logging**: Minimize console output (only warnings, errors, debug)
- **UI text**: Use sentence case for UI text (see [ux-copy.md](ux-copy.md))
- **Class naming**: Use descriptive class names (not placeholders)
- **Security**: Avoid unsafe patterns (eval, innerHTML misuse, etc.)
- **Testing**: Test on all applicable platforms

## AI Agent Workflow

When user asks "is my plugin ready for release?" or similar:

1. **Run automated checks**:
   - Check file existence (`main.js`, `manifest.json`, `styles.css`, `LICENSE`, `README.md`)
   - Validate `manifest.json` structure and required fields
   - Check version format and consistency
   - Scan code for prohibited patterns (eval, innerHTML misuse, obfuscation, etc.)
   - Verify README.md has basic content

2. **Present interactive checklist**:
   - Ask about platform testing (Windows, macOS, Linux, Android, iOS)
   - Ask about GitHub release status and file attachments
   - Ask about community-plugins.json id matching (if applicable)
   - Ask about README.md quality (purpose and usage instructions)
   - Ask about Developer Policies adherence
   - Ask about Plugin Guidelines adherence
   - Ask about third-party code license compliance and attribution

3. **Report results**:
   - Show pass/fail/warning status for each item
   - Provide actionable guidance for any failures
   - Summarize overall readiness status

4. **Provide next steps**:
   - If ready: Guide user through release process (see [versioning-releases.md](versioning-releases.md))
   - If not ready: List specific items to address before release

## Related Documentation

- [versioning-releases.md](versioning-releases.md) - Release process and versioning
- [security-privacy.md](security-privacy.md) - Security and privacy guidelines
- [manifest.md](manifest.md) - Manifest requirements and validation
- [testing.md](testing.md) - Testing procedures and platform testing
- [ux-copy.md](ux-copy.md) - UI text conventions
- [common-pitfalls.md](common-pitfalls.md) - Common mistakes to avoid
- [build-workflow.md](build-workflow.md) - Build commands (must run before release)

