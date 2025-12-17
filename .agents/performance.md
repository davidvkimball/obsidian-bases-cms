<!--
Source: Based on Obsidian community best practices
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian community discussions for updates
Applicability: Both
-->

# Performance

## Plugins

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Themes

- Keep CSS file size reasonable. Large themes can slow down Obsidian startup.
- Use CSS variables efficiently. Avoid excessive specificity.
- Minimize use of complex selectors that require expensive DOM queries.
- Test theme performance on lower-end devices, especially mobile.


