# Bases CMS for Obsidian

A plugin for [Obsidian](https://obsidian.md) inspired by [Dynamic Views](https://github.com/greetclammy/dynamic-views) and [Multi-Properties](https://github.com/technohiker/obsidian-multi-properties) that provides CMS-like functionality to bases. Transform your Obsidian bases into a powerful content management system with card-based views, bulk operations, and smart content management features.

![bases-cms-preview](https://github.com/user-attachments/assets/e20f2535-8991-4ccf-bb59-f97694e52c34)

## Made for Vault CMS

Part of the [Vault CMS](https://github.com/davidvkimball/vault-cms) project.

## Features

- **Card-Based CMS View**: Display your base entries as cards with thumbnails, snippets, and property information in a grid layout optimized for content management.
- **Bulk Operations Toolbar**: Select multiple items and perform batch operations including publish/draft status management, tag management, property setting/removal, and deletion.
- **Smart Deletion**: Automatically delete parent folders when deleting files with specific names (like `index.md`), and optionally remove unique attachments that are only used by deleted notes.
- **Quick Edit**: Execute Obsidian commands directly from card titles without opening files first. Configure a command and icon to appear on each card for fast access to your most-used actions.
- **Customizable Toolbar**: Show or hide individual toolbar buttons (select all, clear, publish, draft, tags, set, remove, delete) to match your workflow.
- **Draft Status Management**: Toggle publish/draft status for multiple files at once, with visual indicators on cards.
- **Tag Management**: Add or remove tags from multiple files simultaneously through an intuitive modal interface.
- **Property Management**: Set or remove properties across multiple files with bulk operations.
- **Confirmation Dialogs**: Optional confirmation dialogs for bulk operations and deletions to prevent accidental changes.
- **Icon Customization**: Choose between home icon or blocks icon for the CMS view in the Bases view selector.

## Installation

Bases CMS is not yet available in the Community plugins section. Install using [BRAT](https://github.com/TfTHacker/obsidian42-brat) or manually:

### BRAT

1. Download the [Beta Reviewers Auto-update Tester (BRAT)](https://github.com/TfTHacker/obsidian42-brat) plugin from the [Obsidian community plugins directory](https://obsidian.md/plugins?id=obsidian42-brat) and enable it.

2. In the BRAT plugin settings, select `Add beta plugin`.

3. Paste the following: `https://github.com/davidvkimball/obsidian-bases-cms` and select `Add plugin`.

### Manual

1. Download the latest release from the [Releases page](https://github.com/davidvkimball/obsidian-bases-cms/releases) and navigate to your Obsidian vault's `.obsidian/plugins/` directory.

2. Create a new folder called `bases-cms` and ensure `manifest.json`, `main.js`, and `styles.css` are in there.

3. In Obsidian, go to Settings > Community plugins (enable it if you haven't already) and then enable "Bases CMS."

## Usage

1. **Set Up a Base**: Ensure you have the Bases core plugin enabled and have created at least one base in your vault.
2. **Open CMS View**: In your base, select "CMS" from the view selector to switch to the card-based CMS view.
3. **Select Items**: Click on cards to select them. Selected items are highlighted, and a bulk operations toolbar appears at the top.
4. **Bulk Operations**: Use the toolbar buttons to:
   - **Select all**: Select all visible cards
   - **Clear**: Deselect all cards
   - **Publish**: Remove draft status from selected items
   - **Draft**: Add draft status to selected items
   - **Tags**: Open a modal to add or remove tags from selected items
   - **Set**: Set a property value across selected items
   - **Remove**: Remove a property from selected items
   - **Delete**: Delete selected items (with optional confirmation and smart deletion)
5. **Quick Edit**: Enable quick edit in settings and configure a command. A clickable icon will appear on each card title, allowing you to execute the command without opening the file.
6. **Customize Settings**: In **Settings > Bases CMS**, configure:
   - **Confirm bulk operations**: Toggle confirmation dialogs for bulk operations
   - **Toolbar buttons**: Show or hide individual toolbar buttons
   - **Delete parent folder for specific file name**: Enable smart folder deletion (e.g., delete parent folder when deleting `index.md`)
   - **Folder deletion file name**: Specify the file name that triggers parent folder deletion (default: `index`)
   - **Delete associated unique attachments**: Automatically delete attachments only used by deleted notes
   - **Confirm deletions**: Toggle confirmation dialogs before deleting files
   - **Use home icon for CMS view**: Switch between home and blocks icon
   - **Enable quick edit**: Show quick edit icon on card titles
   - **Quick edit command**: Select the command to execute when clicking the quick edit icon
   - **Quick edit icon**: Choose the icon to display for quick edit

## Quick Edit Feature

The Quick Edit feature allows you to execute Obsidian commands directly from card titles without opening the file first. When enabled, a configurable icon appears on card titles that launches a selected command when clicked.

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

## Example

- Base with multiple blog posts displayed as cards
- Select multiple cards using the selection interface
- Use the bulk toolbar to set all selected items to "draft" status
- Use quick edit icon on a card title to rename the post without opening it
- Delete a post with `index.md` filename, automatically deleting its parent folder and unique attachments

## Notes

- Requires the [Bases](https://help.obsidian.md/bases) core plugin to be enabled.
- The CMS view integrates seamlessly with Bases views and respects base queries and filters.
- Bulk operations preserve file metadata and handle edge cases like missing properties gracefully.
- Smart deletion features help maintain a clean vault structure when working with folder-based content.

## Contributing

Submit issues or pull requests on the [GitHub repository](https://github.com/davidvkimball/obsidian-bases-cms). Contributions to enhance features, improve documentation, or fix bugs are welcome!

## License

MIT License
