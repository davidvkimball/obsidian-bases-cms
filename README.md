# Bases CMS

A fork of [Dynamic Views](https://github.com/greetclammy/dynamic-views) that provides CMS-like functionality to Obsidian bases. Inspired by the [Multi-Properties](https://github.com/technohiker/obsidian-multi-properties) plugin.

## Installation

Bases CMS is not yet available in the Community plugins section. Install using [BRAT](https://github.com/TfTHacker/obsidian42-brat) or manually:

### BRAT

1. Download the [Beta Reviewers Auto-update Tester (BRAT)](https://github.com/TfTHacker/obsidian42-brat) plugin from the [Obsidian community plugins directory](https://obsidian.md/plugins?id=obsidian42-brat) and enable it.
2. In the BRAT plugin settings, select `Add beta plugin`.
3. Paste the following: `https://github.com/davidvkimball/obsidian-bases-cms` and select `Add plugin`.

### Manual

1. Download the latest release from the [Releases page](https://github.com/davidvkimball/obsidian-bases-cms/releases) and navigate to your Obsidian vault's `.obsidian/plugins/` directory.
2. Create a new folder called `bases-cms` and ensure `manifest.json`, `main.js` and `styles.css` are in there.
3. In Obsidian, go to Settings > Community plugins (enable it if you haven't already) and then enable "Bases CMS."

## Quick Edit Feature

The Quick Edit feature allows you to execute Obsidian commands directly from card titles without opening the file first. When enabled, a pencil icon appears on card titles that launches a selected command when clicked.

### For Plugin Authors: Adding Quick Edit Support

If your plugin has commands that operate on files, you can make them work seamlessly with the Quick Edit feature by exposing a helper method that doesn't require the file to be open.

#### Pattern

Expose a method on your plugin instance that takes only the file path:

```typescript
// In your plugin's main.ts
export default class YourPlugin extends Plugin {
  // ... your existing code ...
  
  /**
   * Execute your command by file path (for programmatic use from Bases CMS)
   * This allows the command to work without opening the file first
   */
  async yourCommandByPath(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      new Notice(`File not found: ${filePath}`);
      return;
    }
    
    // Your command logic here - you have access to:
    // - this.app (Obsidian app instance)
    // - this.settings (your plugin settings)
    // - file (the TFile object)
    // - this.app.metadataCache.getFileCache(file) (file metadata)
    
    // Example: Open a modal, modify the file, etc.
    // You don't need the file to be open in an editor!
  }
}
```

#### Example: Astro Composer

[Astro Composer](https://github.com/davidvkimball/obsidian-astro-composer) implements this pattern for its "Rename current content" command:

```typescript
// In astro-composer/src/main.ts
async renameContentByPath(filePath: string): Promise<void> {
  await renameContentByPathFunction(this.app, filePath, this.settings, this);
}
```

This allows the rename modal to appear directly over the Bases view without opening the file first.

#### Naming Convention

Bases CMS automatically detects helper methods using a naming convention:

- **Command ID format**: `plugin-id:command-id` (for example `astro-composer:rename-content`)
- **Method name pattern**: Convert the command ID part to camelCase and append `ByPath`
  - `rename-content` → `renameContentByPath`
  - `update-title` → `updateTitleByPath`
  - `edit-metadata` → `editMetadataByPath`

If your command ID doesn't include a plugin prefix (for example, just `rename-content`), Bases CMS will attempt to find the plugin through the command registry, but using the `plugin-id:command-id` format is recommended for best compatibility.

#### Automatic Detection

Bases CMS automatically detects and calls helper methods without requiring any hardcoded support. Simply:

1. **Expose the helper method** on your plugin instance following the naming convention above
2. **Use the `plugin-id:command-id` format** for your command IDs (recommended)
3. That's it! Bases CMS will automatically find and call your helper method when the quick edit icon is clicked

#### Fallback Behavior

If a command doesn't have a helper method:
- Bases CMS will attempt to execute the command without opening the file
- If that fails, it will open the file in an editor and then execute the command
- This ensures compatibility with all commands, but may not provide the seamless experience

#### Benefits

- **Better UX**: Commands can execute without switching away from the Bases view
- **Faster workflow**: No need to open files just to run a command
- **Modal support**: Commands that show modals can appear directly over the card view
