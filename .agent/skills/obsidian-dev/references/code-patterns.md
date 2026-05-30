<!--
Source: Complete examples from obsidian-sample-plugin, obsidian-plugin-docs, and obsidian-api (API is authoritative)
Last synced: See sync-status.json for authoritative sync dates
Update frequency: Check reference repos for new patterns
-->

# Code Patterns

Comprehensive code patterns for common Obsidian plugin development tasks. **Always verify API details in `.ref/obsidian-api/obsidian.d.ts`** - it's the authoritative source and may have features not yet documented in plugin docs.

**When to use this vs [common-tasks.md](common-tasks.md)**:
- **code-patterns.md**: Complete, production-ready examples with full context, error handling, and best practices
- **common-tasks.md**: Quick snippets and basic patterns for simple operations

## Settings tabs

Settings tabs are covered by the dedicated **`settings` skill** — use it for authoring or migrating any `PluginSettingTab`. It is the authoritative reference for the declarative `getSettingDefinitions()` API (Obsidian 1.13+), the control/render/validate/visible patterns, mutable lists, sub-pages, and the optional `display()` fallback for older app versions.

`SettingGroup` is always available at these projects' `minAppVersion` (1.11+) — use it directly, with no `requireApiVersion()` guards or pre-1.11 fallbacks. Sentence case for all UI text (names, descriptions, headings).

## Multi-window: target the app window, not `activeDocument`

**Source**: Obsidian 1.13 changelog ("Settings now open in a new window") + `Workspace.containerEl` in `.ref/obsidian-api/obsidian.d.ts`

Obsidian renders across multiple OS windows: pop-out leaves, and — since **1.13** — the Settings window. The globals `activeDocument` / `activeWindow` track **whichever window currently has focus**. During a settings `onChange` (or any handler that runs while a pop-out is focused) they point at the *other* window.

So any code that applies persistent UI to the **main app window** — toggling `<body>` classes, setting CSS variables, injecting a `<style>` into `<head>`, or inserting/replacing a ribbon/toolbar button — must NOT use `activeDocument`. On 1.13 the change lands in the Settings window and the user sees nothing change until restart. (This was a real fleet-wide bug: settings appeared to "not apply in real time".)

Use the workspace container's owner document, which always lives in the main window:

```ts
export default class MyPlugin extends Plugin {
  // The main app window's document — stable for the app's lifetime, and
  // unaffected by which window (Settings, pop-out) currently has focus.
  private get doc(): Document {
    return this.app.workspace.containerEl.ownerDocument;
  }

  applyStyles() {
    this.doc.body.classList.toggle("my-feature-on", this.settings.featureOn);
  }
}
```

In a manager/service class that holds a plugin reference, expose the same getter via `this.plugin.app.workspace.containerEl.ownerDocument`. For a standalone utility, accept an optional `getDoc?: () => Document` and fall back to `activeDocument` when omitted.

**Do / Don't**
- ✅ `this.app.workspace.containerEl.ownerDocument` for body classes, CSS vars, `<style>` injection, and button swaps that must affect the editing window.
- ✅ `activeDocument` is still correct for things that belong to the focused window: modal/suggest DOM you're building, reading a context menu the user just opened, transient measurement nodes.
- ❌ `activeDocument.body.classList.add(...)` / `activeDocument.head.appendChild(styleEl)` reached from a settings `onChange` — lands in the Settings window on 1.13+.
- ⚠️ Observers (`observer.observe(activeDocument.body, …)`) set up once at `onload` are fine (the main window is focused then), but re-creating them from a settings change can attach to the wrong window — prefer the `doc` getter there too.

## Modal with Form Input

**Source**: Based on `.ref/obsidian-plugin-docs/docs/guides/modals.md`

```ts
import { App, Modal, Notice, Setting } from "obsidian";

interface FormData {
  name: string;
  email: string;
}

class FormModal extends Modal {
  result: FormData;
  onSubmit: (result: FormData) => void;

  constructor(app: App, onSubmit: (result: FormData) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.result = { name: "", email: "" };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Enter Information" });

    new Setting(contentEl)
      .setName("Name")
      .addText((text) =>
        text.onChange((value) => {
          this.result.name = value;
        })
      );

    new Setting(contentEl)
      .setName("Email")
      .addText((text) =>
        text
          .setPlaceholder("email@example.com")
          .onChange((value) => {
            this.result.email = value;
          })
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Submit")
          .setCta()
          .onClick(() => {
            if (!this.result.name || !this.result.email) {
              new Notice("Please fill in all fields");
              return;
            }
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

// Usage:
new FormModal(this.app, (result) => {
  new Notice(`Submitted: ${result.name} (${result.email})`);
}).open();
```

## SuggestModal Implementation

**Source**: Based on `.ref/obsidian-plugin-docs/docs/guides/modals.md`

```ts
import { App, Notice, SuggestModal } from "obsidian";

interface Item {
  title: string;
  description: string;
}

const ALL_ITEMS: Item[] = [
  { title: "Item 1", description: "Description 1" },
  { title: "Item 2", description: "Description 2" },
];

class ItemSuggestModal extends SuggestModal<Item> {
  onChoose: (item: Item) => void;

  constructor(app: App, onChoose: (item: Item) => void) {
    super(app);
    this.onChoose = onChoose;
  }

  getSuggestions(query: string): Item[] {
    return ALL_ITEMS.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase())
    );
  }

  renderSuggestion(item: Item, el: HTMLElement) {
    el.createEl("div", { text: item.title });
    el.createEl("small", { text: item.description });
  }

  onChooseSuggestion(item: Item, evt: MouseEvent | KeyboardEvent) {
    this.onChoose(item);
  }
}

// Usage:
new ItemSuggestModal(this.app, (item) => {
  new Notice(`Selected: ${item.title}`);
}).open();
```

## Custom View with Registration

**Source**: Based on `.ref/obsidian-plugin-docs/docs/guides/custom-views.md`

```ts
import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_MY_VIEW = "my-view";

export class MyView extends ItemView {
  private content: string;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.content = "Initial content";
  }

  getViewType(): string {
    return VIEW_TYPE_MY_VIEW;
  }

  getDisplayText(): string {
    return "My Custom View";
  }

  getIcon(): string {
    return "document"; // Icon name
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    
    container.createEl("h2", { text: "My View" });
    
    const contentEl = container.createEl("div", { cls: "my-view-content" });
    contentEl.setText(this.content);
    
    // Add interactive elements
    const button = container.createEl("button", { text: "Update" });
    button.addEventListener("click", () => {
      this.updateContent();
    });
  }

  async onClose() {
    // Clean up resources
  }

  private updateContent() {
    const container = this.containerEl.children[1];
    const contentEl = container.querySelector(".my-view-content");
    if (contentEl) {
      this.content = "Updated content";
      contentEl.setText(this.content);
    }
  }
}

// In main plugin class:
export default class MyPlugin extends Plugin {
  async onload() {
    // Register view
    this.registerView(VIEW_TYPE_MY_VIEW, (leaf) => new MyView(leaf));

    // Add command to open view
    this.addCommand({
      id: "open-my-view",
      name: "Open My View",
      callback: () => {
        this.activateView();
      },
    });
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
}
```

## File Operations

**Source**: Based on `.ref/obsidian-api/obsidian.d.ts` (API is authoritative)

```ts
// Read a file
async readFile(file: TFile): Promise<string> {
  return await this.app.vault.read(file);
}

// Write to a file
async writeFile(file: TFile, content: string): Promise<void> {
  await this.app.vault.modify(file, content);
}

// Create a new file
async createFile(path: string, content: string): Promise<TFile> {
  return await this.app.vault.create(path, content);
}

// Delete a file (respects user's trash preference)
async deleteFile(file: TFile): Promise<void> {
  await this.app.fileManager.trashFile(file);
}

// Check if file exists
fileExists(path: string): boolean {
  return this.app.vault.getAbstractFileByPath(path) !== null;
}

// Get all markdown files
getAllMarkdownFiles(): TFile[] {
  return this.app.vault.getMarkdownFiles();
}
```

## Workspace Events

**Source**: Based on `.ref/obsidian-api/obsidian.d.ts` and `.ref/obsidian-sample-plugin/main.ts`

```ts
// File opened event
this.registerEvent(
  this.app.workspace.on("file-open", (file) => {
    if (file) {
      console.log("File opened:", file.path);
    }
  })
);

// Active leaf changed
this.registerEvent(
  this.app.workspace.on("active-leaf-change", (leaf) => {
    if (leaf?.view instanceof MarkdownView) {
      console.log("Active markdown view:", leaf.view.file?.path);
    }
  })
);

// Layout changed
this.registerEvent(
  this.app.workspace.on("layout-change", () => {
    console.log("Workspace layout changed");
  })
);

// Editor change (in markdown view)
this.registerEvent(
  this.app.workspace.on("editor-change", (editor, info) => {
    console.log("Editor changed:", info);
  })
);
```

## Status Bar with Updates

**Source**: Based on `.ref/obsidian-sample-plugin/main.ts` and `.ref/obsidian-plugin-docs/docs/guides/status-bar.md`

```ts
export default class MyPlugin extends Plugin {
  private statusBarItem: HTMLElement;

  async onload() {
    // Create status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar("Ready");

    // Update status bar periodically
    this.registerInterval(
      window.setInterval(() => {
        this.updateStatusBar(`Time: ${new Date().toLocaleTimeString()}`);
      }, 1000)
    );

    // Update on file open
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) {
          this.updateStatusBar(`Open: ${file.name}`);
        }
      })
    );
  }

  private updateStatusBar(text: string) {
    this.statusBarItem.empty();
    this.statusBarItem.createEl("span", { text });
  }
}
```

## Editor Interactions

**Source**: Based on `.ref/obsidian-sample-plugin/main.ts` and `.ref/obsidian-api/obsidian.d.ts`

```ts
// Get active editor
getActiveEditor(): Editor | null {
  const view = this.app.workspace.getActiveViewOfType(MarkdownView);
  return view?.editor ?? null;
}

// Get selected text
getSelection(): string {
  const editor = this.getActiveEditor();
  return editor?.getSelection() ?? "";
}

// Replace selection
replaceSelection(text: string) {
  const editor = this.getActiveEditor();
  if (editor) {
    editor.replaceSelection(text);
  }
}

// Insert at cursor
insertAtCursor(text: string) {
  const editor = this.getActiveEditor();
  if (editor) {
    const cursor = editor.getCursor();
    editor.replaceRange(text, cursor);
  }
}

// Get current line
getCurrentLine(): string {
  const editor = this.getActiveEditor();
  if (editor) {
    const line = editor.getCursor().line;
    return editor.getLine(line);
  }
  return "";
}
```

