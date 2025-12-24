<!--
Source: Project-specific workflow
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Update as workflow evolves
Applicability: Both
-->

# Summarize Commands

When the user requests "Summarize" or "Summarize for release", use these workflows to generate commit messages or release notes.

## "Summarize" Command

**Purpose**: Generate a succinct git commit message based on all changes since the last tag (or all uncommitted changes if no tags exist).

**Workflow**:

1. **Find the last tag** (if any exist):
   ```bash
   git describe --tags --abbrev=0 2>/dev/null || echo ""  # Get last tag, or empty if none
   ```
   - If a tag exists, use it as the baseline
   - If no tags exist, fall back to analyzing uncommitted changes only

2. **Get all commits since last tag** (or recent commits if no tag):
   ```bash
   # If tag exists:
   git log --oneline <last-tag>..HEAD  # All commits since last tag
   git log --oneline <last-tag>..HEAD --format="%H %s"  # With full hashes
   
   # If no tag exists, get recent commits:
   git log --oneline -10  # Last 10 commits as fallback
   ```

3. **Get all file changes since last tag** (or uncommitted if no tag):
   ```bash
   # If tag exists:
   git diff <last-tag>..HEAD --name-status  # All changed files since tag
   git diff <last-tag>..HEAD  # Full diff of all changes
   
   # Also check for uncommitted changes:
   git status
   git diff --cached  # For staged changes
   git diff           # For unstaged changes
   
   # If no tag exists, use uncommitted changes:
   git diff --cached  # For staged changes
   git diff           # For unstaged changes
   ```

4. **Read and analyze all changed files**:
   - Look at the actual file contents and diffs, not just the chat history
   - Review commit messages to understand the intent of each change
   - Understand what changed across all files since the last tag
   - Get the overall picture of all changes (committed + uncommitted)
   - Prioritize feature changes over version bumps or minor updates

5. **Generate commit message** in this format:
   ```
   [Summary of changes]
   - [more detailed item 1]
   - [more detailed item 2]
   - [more detailed item 3]
   ```

6. **Present as a code block** so the user can easily copy it:
   ````
   ```
   [Summary of changes]
   - [more detailed item 1]
   - [more detailed item 2]
   ```
   ````

**Important**:
- **Always check for tags first** - this ensures you capture all important commits, not just what's in the working directory
- Look at actual file changes and commit history, not just chat context
- Include all significant changes since the last tag, even if they're already committed
- Be succinct but descriptive
- Focus on what changed, not how it was changed
- Use present tense (e.g., "Add feature" not "Added feature")
- Group related changes together
- Prioritize feature additions and important fixes over version bumps

**Example**:
```
Reorganize agent instructions into structured directory
- Split AGENTS.md into topic-based files in .agents/
- Add build workflow documentation
- Update ref-instructions with symlink strategy
- Add summarize command workflows
```

## "Summarize for Release" Command

**Purpose**: Generate markdown-formatted release notes for a GitHub release.

**Workflow**:

1. **Check the version**:
   ```bash
   # Check manifest.json for version
   # Or check package.json
   # Or ask the user if version is unclear
   ```

2. **Get all changes since last release**:
   ```bash
   git log --oneline  # See recent commits
   git diff <last-release-tag>..HEAD  # See all changes
   ```

3. **Read and analyze all changed files**:
   - Look at actual file contents and changes
   - Understand the full scope of changes
   - Categorize changes by type (Features, Fixes, Improvements, etc.)

4. **Generate release notes** in markdown format:
   ```markdown
   ### Features
   - [Feature description 1]
   - [Feature description 2]

   ### Fixes
   - [Fix description 1]
   - [Fix description 2]

   ### Improvements
   - [Improvement description 1]
   ```

5. **Present as a code block** with the version clearly indicated:
   ````
   ```markdown
   ## Version X.Y.Z

   ### Features
   - [Feature description 1]
   - [Feature description 2]

   ### Fixes
   - [Fix description 1]

   ### Improvements
   - [Improvement description 1]
   ```
   ````

**Important**:
- Start with `###` headings (third-level markdown)
- Use bullet points under each heading
- Be succinct and punchy
- Focus on user-facing changes
- Group logically (Features, Fixes, Breaking Changes, Improvements, etc.)
- Include version number at the top
- Look at actual changes, not just chat history

**Example**:
```markdown
## Version 1.2.0

### Features
- Add structured .agents directory for better organization
- Implement symlink strategy for reference repositories
- Add build workflow automation

### Improvements
- Reorganize documentation into topic-based files
- Update ref-instructions with Windows symlink guide
- Add summarize command workflows

### Fixes
- Fix build command execution order
- Update documentation paths
```

## Tips for Better Summaries

- **Read the files**: Don't rely solely on chat history - actually read the changed files
- **Understand context**: Look at related files to understand the full picture
- **Be specific**: "Add build workflow" is better than "Update docs"
- **Group logically**: Related changes should be grouped together
- **User perspective**: Focus on what users/developers will notice
- **Version awareness**: For releases, always check and include the version number

