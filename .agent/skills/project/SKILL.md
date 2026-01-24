---
name: project
description: Project-specific architecture, maintenance tasks, and unique conventions for Bases CMS.
---

# Bases CMS Project Skill

Manage your notes in bases like a content management system. This plugin provides a CMS-like experience within Obsidian, focusing on structural organization and metadata-driven workflows.

## Core Architecture

- **Structured Data**: Focuses on treating folders/notes as a structured database or "base".
- **Heavy UI Layer**: Uses an extensive 42KB `styles.css` to transform standard Obsidian views into CMS-like interfaces.
- **Metadata Orchestration**: Heavily relies on frontmatter and folder structures to define content relationships.

## Project-Specific Conventions

- **"Base" Concept**: All logic revolves around the definition and management of a "Base" (CMS-like view).
- **Rich UI**: High preference for custom modals and specialized views over standard Obsidian commands.
- **Modern API**: Requires `minAppVersion: 1.10.2`, utilizing modern Obsidian UI capabilities.

## Key Files

- `src/main.ts`: Entry point for the CMS logic and view registration.
- `manifest.json`: Plugin identification and modern version requirements (`bases-cms`).
- `styles.css`: Massive CSS payload for the CMS layout and custom components.
- `esbuild.config.mjs`: Complex build configuration for bundling CMS components.

## Maintenance Tasks

- **Layout Stability**: Check CMS views for breaking layout changes in Obsidian's DOM.
- **Performance**: Monitor main thread performance when processing large "Bases".
- **Documentation**: Keep README synchronized with the evolving CMS feature set.
