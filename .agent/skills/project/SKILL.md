---
name: project
description: Project-specific architecture, maintenance tasks, and unique conventions for this repository. Load when performing project-wide maintenance or working with the core architecture.
---

# Project Context

This skill provides the unique context and architectural details for the **Obsidian Sample Plugin Plus** repository.

## Purpose

To provide guidance on project-specific structures and tasks that differ from general Obsidian development patterns.

## When to Use

Load this skill when:
- Understanding the repository's unique architecture.
- Performing recurring maintenance tasks.
- Following project-specific coding conventions.

## Project Overview

- **Architecture**: Organized structure with main code in `src/main.ts` and settings in `src/settings.ts`.
- **Reference Management**: Uses a `.ref` folder with symlinks to centralized Obsidian repositories for API and documentation.

## Maintenance Tasks

- **Sync References**: Run the setup scripts (`scripts/setup-ref-links.*`) to update symlinks to the 6 core Obsidian projects.
- **Update Skills**: Use `node scripts/update-agents.mjs "Description"` after syncing or updating reference materials.

## Project-Specific Conventions

- **Organized Source**: Prefer keeping logic separated into files within `src/` rather than bloating `main.ts`.
- **Ref Symlinks**: Always use the `.ref/` path when looking up API documentation to ensure parity with the central reference store.