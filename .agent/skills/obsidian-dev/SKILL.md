---
name: obsidian-dev
description: Logic patterns, lifecycle management, and core development rules for Obsidian plugins. Load when editing src/main.ts, implementing new features, or handling plugin lifecycle events.
---

# Obsidian Development Skill

This skill provides patterns and rules for developing Obsidian plugins, focusing on core logic and lifecycle management.

## Purpose

To ensure consistent implementation of plugin features, proper resource management, and adherence to Obsidian's development patterns.

## When to Use

Load this skill when:
- Implementing or modifying the `main.ts` entry point.
- Creating new plugin features or logic patterns.
- Managing the plugin lifecycle (`onload`, `onunload`).
- Implementing commands or settings.

## Core Rules

- **Use "properties" instead of "frontmatter"**: Always refer to YAML metadata as "properties" in UI, comments, and documentation.
- **Capitalize "Markdown"**: Always treat "Markdown" as a proper noun.
- **Resource Cleanup**: Ensure all event listeners and resources are properly cleaned up in `onunload`.
- **Async Safety**: Most Obsidian API operations are asynchronous; use `await` appropriately.

## Bundled Resources

- `references/agent-dos-donts.md`: Critical do's and don'ts for development.
- `references/code-patterns.md`: Reusable code snippets and architectural patterns.
- `references/coding-conventions.md`: Style guides and naming conventions.
- `references/commands-settings.md`: Guidance for implementing commands and settings tabs.
- `references/common-tasks.md`: Quick reference for frequent implementation tasks.