<!--
Source: Based on Obsidian Sample Plugin
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check Obsidian Sample Plugin repo for updates
-->

# Common tasks

**Note**: The examples below are for plugin development (TypeScript).

**When to use this vs [code-patterns.md](code-patterns.md)**: 
- **common-tasks.md**: Quick snippets and basic patterns for common operations
- **code-patterns.md**: Complete, production-ready examples with full context and error handling

> **Note**: If user asks "what does the Obsidian API say about X?" or similar, check `.ref/obsidian-api/obsidian.d.ts` first. See [ref-instructions.md](ref-instructions.md) for when to check `.ref` setup.

## Organize code across multiple files

**main.ts** (minimal, lifecycle only):
```ts
import { Plugin } from "obsidian";
import { MySettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
  settings: MySettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    registerCommands(this);
  }
}
```

**settings.ts**:
```ts
export interface MySettings {
  enabled: boolean;
  apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
  enabled: true,
  apiKey: "",
};
```

**commands/index.ts**:
```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
  plugin.addCommand({
    id: "do-something",
    name: "Do something",
    callback: () => doSomething(plugin),
  });
}
```

## Add a command

```ts
this.addCommand({
  id: "your-command-id",
  name: "Do the thing",
  callback: () => this.doTheThing(),
});
```

## Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

## Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */ }));
this.registerDomEvent(window, "resize", () => { /* ... */ });
this.registerInterval(window.setInterval(() => { /* ... */ }, 1000));
```

## Settings Tab Implementation

**Source**: Based on `.ref/obsidian-sample-plugin/main.ts` and `.ref/obsidian-api/obsidian.d.ts` (API is authoritative for SettingGroup - available since 1.11.0)

Basic settings tab:

```ts
import { App, PluginSettingTab, Setting } from "obsidian";

class MySettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Setting name")
      .setDesc("Setting description")
      .addText((text) =>
        text
          .setPlaceholder("Enter value")
          .setValue(this.plugin.settings.mySetting)
          .onChange(async (value) => {
            this.plugin.settings.mySetting = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

// In main plugin class:
this.addSettingTab(new MySettingTab(this.app, this));
```

**Note**: For settings groups (available since API 1.11.0), use `SettingGroup` from the API. Plugin docs may not yet document this feature - always check `.ref/obsidian-api/obsidian.d.ts` for the latest API.

**Backward Compatibility**: To support users on both Obsidian 1.11.0+ and older versions, use a compatibility utility. See [code-patterns.md](code-patterns.md) for the complete implementation with `createSettingsGroup()` utility. Alternatively, you can force `minAppVersion: "1.11.0"` in `manifest.json` if you don't need to support older versions.

## Modal Patterns

**Source**: Based on `.ref/obsidian-sample-plugin/main.ts` and `.ref/obsidian-plugin-docs/docs/guides/modals.md`

Simple modal:

```ts
import { App, Modal } from "obsidian";

class MyModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText("Modal content");
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Open modal:
new MyModal(this.app).open();
```

Modal with user input:

```ts
import { App, Modal, Setting } from "obsidian";

class InputModal extends Modal {
  result: string;
  onSubmit: (result: string) => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h1", { text: "Enter value" });

    new Setting(contentEl)
      .setName("Name")
      .addText((text) =>
        text.onChange((value) => {
          this.result = value;
        })
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Submit")
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit(this.result);
          })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
```

## Custom Views

**Source**: Based on `.ref/obsidian-plugin-docs/docs/guides/custom-views.md`

```ts
import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_MY_VIEW = "my-view";

export class MyView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_MY_VIEW;
  }

  getDisplayText() {
    return "My View";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("h4", { text: "My View Content" });
  }

  async onClose() {
    // Clean up resources
  }
}

// In main plugin class:
async onload() {
  this.registerView(VIEW_TYPE_MY_VIEW, (leaf) => new MyView(leaf));
  
  // Activate view:
  await this.activateView();
}

async activateView() {
  const { workspace } = this.app;
  let leaf = workspace.getLeavesOfType(VIEW_TYPE_MY_VIEW)[0];
  
  if (!leaf) {
    leaf = workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE_MY_VIEW, active: true });
  }
  
  workspace.revealLeaf(leaf);
}

async onunload() {
  this.app.workspace.detachLeavesOfType(VIEW_TYPE_MY_VIEW);
}
```

**Warning**: Never store references to views. Use `getLeavesOfType()` to access view instances.

## Status Bar Items

**Source**: Based on `.ref/obsidian-sample-plugin/main.ts` and `.ref/obsidian-plugin-docs/docs/guides/status-bar.md`

```ts
// Add status bar item (not supported on mobile)
const statusBarItemEl = this.addStatusBarItem();
statusBarItemEl.setText("Status text");

// Or create custom elements:
const statusBarItemEl = this.addStatusBarItem();
statusBarItemEl.createEl("span", { text: "Status: " });
statusBarItemEl.createEl("span", { text: "Active" });
```

## Ribbon Icons

**Source**: Based on `.ref/obsidian-sample-plugin/main.ts` and `.ref/obsidian-plugin-docs/docs/guides/ribbon-actions.md`

```ts
const ribbonIconEl = this.addRibbonIcon("dice", "My Plugin", (evt: MouseEvent) => {
  new Notice("Ribbon clicked!");
});

// Add CSS class for styling:
ribbonIconEl.addClass("my-plugin-ribbon-class");
```

## Editor Commands

**Source**: Based on `.ref/obsidian-sample-plugin/main.ts`

```ts
this.addCommand({
  id: "editor-command",
  name: "Editor command",
  editorCallback: (editor: Editor, view: MarkdownView) => {
    const selection = editor.getSelection();
    editor.replaceSelection("Replaced text");
  },
});
```

## Complex Commands with Conditions

**Source**: Based on `.ref/obsidian-sample-plugin/main.ts`

```ts
this.addCommand({
  id: "conditional-command",
  name: "Conditional command",
  checkCallback: (checking: boolean) => {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (markdownView) {
      if (!checking) {
        // Execute command
        this.doAction();
      }
      return true; // Command is available
    }
    return false; // Command is not available
  },
});
```

The `checkCallback` receives a `checking` boolean:
- When `true`: Only check if command can run (don't execute)
- When `false`: Actually execute the command


