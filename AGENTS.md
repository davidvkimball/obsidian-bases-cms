# AGENTS

This project uses the OpenSkills system for AI agent guidance. General development skills are provided by the [obsidian-dev-skills](https://github.com/davidvkimball/obsidian-dev-skills) repository.

<skills_system priority="1">

## Available Skills

<!-- SKILLS_TABLE_START -->
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills:
- Read skill: `cat ./.agent/skills/<skill-name>/SKILL.md`
  - For multiple: `cat ./.agent/skills/skill-one/SKILL.md ./.agent/skills/skill-two/SKILL.md`
- The skill content will load with detailed instructions on how to complete the task
- Skills are stored locally in ./.agent/skills/ directory

Usage notes:
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already loaded in your context
- Each skill invocation is stateless
</usage>

<available_skills>

<skill>
<name>obsidian-dev</name>
<description>Logic patterns, lifecycle management, and core development rules for Obsidian plugins. Load when editing src/main.ts, implementing new features, or handling plugin lifecycle events.</description>
<location>project</location>
</skill>

<skill>
<name>obsidian-ops</name>
<description>Operations, syncing, versioning, and release management for Obsidian projects. Load when running builds, syncing references, bumping versions, or preparing for release.</description>
<location>project</location>
</skill>

<skill>
<name>obsidian-ref</name>
<description>Technical references, manifest rules, file formats, and UX guidelines for Obsidian. Load when checking API details, manifest requirements, or UI/UX standards.</description>
<location>project</location>
</skill>

<skill>
<name>project</name>
<description>Project-specific architecture, maintenance tasks, and unique conventions for this repository. Load when performing project-wide maintenance or working with the core architecture.</description>
<location>project</location>
</skill>

</available_skills>
<!-- SKILLS_TABLE_END -->

</skills_system>

## Project Metadata
- **Project**: Obsidian Plugin
- **Package Manager**: pnpm
- **Primary Commands**: `pnpm build`, `pnpm lint`, `pnpm dev`, `pnpm lint:fix`, `pnpm upgrade`

## Core Policies
- **CRITICAL**: Never perform automatic git operations. AI agents must not execute `git commit`, `git push`, or any command that automatically stages or commits changes without explicit user approval for each step.

## Terminology
- Use **"properties"** (never "frontmatter" or "front-matter") when referring to YAML metadata at the top of Markdown files.
- **"Markdown"** is a proper noun and must always be capitalized.

