# Antigravity Study Editor — Architecture & Build Spec

## 1. Problem Statement

During tutoring sessions in the Gemini for Mac desktop app, taking and co-editing structured study notes alongside the chat faces three platform constraints:

1. **Native Markdown Canvas Strips Custom Formatting on Manual Edits:** Gemini's Markdown Canvas preview strips custom inline HTML and CSS attributes (such as role-based color tags, structural underlines, and hover tooltips) whenever the user edits text directly in the visual preview.
2. **Raw HTML Canvas Lacks Direct WYSIWYG Editing and Wastes Output Tokens:** Raw `.html` Canvas files support arbitrary CSS and JavaScript study widgets in the preview iframe, but the user cannot click into the preview to type or reorganize notes without switching to the raw HTML source code view. Additionally, having Gemini regenerate hundreds of lines of editor UI layout and CSS boilerplate on every tutoring session consumes output tokens and introduces layout regressions.
3. **Preview Iframe Runtime Isolation:** Gemini Canvas renders `.html` previews inside a sandboxed iframe served from a unique `*.scf.usercontent.goog` origin per artifact/render. Edits made inside the iframe's runtime DOM do not automatically mutate the underlying Canvas source code that Gemini reads on subsequent chat turns. Furthermore, regular Gemini Chat mode does not execute local `stdio` Model Context Protocol (MCP) servers (such as the local Obsidian MCP), which are restricted to Task mode.

**Objective:** Build a single, reusable frontend study editor package (`dist/study-editor.min.js` and `dist/study-editor.min.css`) hosted via GitHub tags and jsDelivr. On each tutoring session, Gemini generates a ~35-line HTML shell containing only a structured JSON payload (`#note-data`) and `<script>`/`<link>` tags pointing to the pinned CDN release. This provides direct, Notion-style block editing and specialized study primitives inside the Gemini Canvas preview pane, paired with a 1-click JSON diff sync (`Cmd+Shift+S`) back to Gemini Chat and a 1-click Markdown export to Obsidian or Notion.

---

## 2. Goals & Non-Goals

### Goals (v1)
- **Thin HTML Loader + Hosted Engine:** Externalize all editor UI, state management, and styling into two static assets (`dist/study-editor.min.js` and `dist/study-editor.min.css`, `<= 40 KB` combined gzipped) loaded from `cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/...`.
- **Direct Block Editing for Note-Taking Primitives:** Support click-to-edit `contenteditable` blocks, Markdown live auto-conversion shortcuts (`# `, `## `, `### `, `- `, `1. `, `> `, `` ``` ``), a `/` slash command menu for standard note-taking blocks (`heading`, `paragraph`, `bullet-list`, `ordered-list`, `blockquote`, `callout`, `toggle`, `code`), and block reordering via hover drag handles and `Cmd+Shift+Up/Down`.
- **Interactive Pedagogical Study Widgets (Gemini-Authored, User-Editable):** Render specialized study block types authored by Gemini in `#note-data`—`tabs` (Horizontal Tabs), `gutter-diff` (`WRONG` vs. `CORRECT` comparison), `spotlight` (Step-to-Code line highlighter), and `peek` (native HTML5 `popover` reference table)—with full inline rich-text editing and floating toolbar formatting on all text fields.
- **Visual Weight Ladder Floating Toolbar:** Provide a selection toolbar for standard `<span data-*>` inline annotations: 8 unbolded semantic colors (`gray`, `blue`, `green`, `red`, `purple`, `orange`, `pink`, `brown`) that automatically tint nested `<code>` pills, structural underline (`<u>`), inline code (`<code>`), bold (`<strong>`), micro-dot hover notes (`data-note`), active-recall blur masks (`data-mask`), and cross-reference isolation bindings (`data-bind="1..8"`).
- **Version-Gated Same-Origin Crash Recovery & 1-Click Canonical JSON Diff Sync:** Persist unsynced edits in `localStorage` keyed by `noteId` and baseline `version`/hash, and copy a deterministic JSON sync envelope to the clipboard via `Cmd+Shift+S` (or the top-bar `Sync` pill) for Gemini to apply to `#note-data`.
- **Deterministic One-Way Markdown Export:** Export the active note (including custom inline spans and composite study blocks) to GFM/Obsidian-compatible Markdown via clipboard copy or `.md` file download.

### Non-Goals (v1)
- **Live Remote MCP & Bidirectional Obsidian Vault Sync (Deferred / Future Exploration):** v1 does not include a cloud backend (Cloudflare Worker + KV), local HTTP daemon behind Cloudflare Tunnel, Remote Custom MCP OAuth 2.0/2.1 server, or bidirectional Markdown-to-JSON AST parser.
- **In-Editor Structural CRUD UIs for Composite Widgets:** Users do not build or reconfigure the structural layout of `spotlight` code-line mappings, `peek` table column schemas, or `tabs` panel arrays via in-editor modal forms; Gemini authors those structural layouts via chat while the user edits their text content inline.
- **LaTeX / KaTeX Math Rendering:** Lazy-loading KaTeX from `unpkg.com` and math block editing are excluded from v1 scope.
- **Multi-User Real-Time Collaboration or Deep Recursive Block Trees:** Block nesting is strictly capped at single-level `toggle` and `tabs` containers; recursive multi-level block trees and CRDT collaboration are non-goals.

---

## 3. Proposed Architecture

### 3.1 Sandbox Probe Verdict

Empirical testing inside the Gemini for Mac Canvas preview iframe (`https://<hash>.scf.usercontent.goog`, `secure: true`) verified the following runtime capabilities:

| Capability | Probe Result | Architectural Application in v1 |
| --- | --- | --- |
| `cdn.jsdelivr.net/gh/...` | PASS (21ms observed baseline) | Serves the compiled editor bundle (`study-editor.min.js` and `study-editor.min.css`) from a tagged GitHub commit tree so each Canvas HTML file contains only the JSON data payload. |
| `unpkg.com` | PASS (41ms observed baseline) | Verified reachable inside the Canvas CSP; reserved for future extensions (not used in v1). |
| Outbound `GET` / `POST` | PASS (18ms / 92ms against mock API) | Verified basic `fetch()` connectivity; live outbound sync is deferred out of v1 (see Section 2 Non-Goals). |
| `localStorage` & `sessionStorage` | PASS | Buffers unsynced edits across soft reloads while the preview iframe remains on the same `scf.usercontent.goog` origin instance. |
| `navigator.clipboard.writeText()` & `execCommand('copy')` | PASS | Enables 1-click (`Cmd+Shift+S`) JSON diff sync and Markdown export directly to the system clipboard with `execCommand('copy')` fallback. |
| CSS `:has()` & HTML5 `popover` | PASS | Powers CSS Hover-to-Isolate (`data-bind="1..8"`), Step-to-Code Spotlight highlighting, and native HTML5 `popover` reference tables and confirmation menus. |

### 3.2 Thin Canvas Shell + Hosted Engine

Antigravity compiles the editor into two static files (`dist/study-editor.min.js` and `dist/study-editor.min.css`) committed directly to the Git repository tree on release tags (e.g., `v1.0.0`) at `https://github.com/AlexanderFisher-tech/study-editor` (where `AlexanderFisher-tech` is the target GitHub account constant configured at release time) and served via jsDelivr (`https://cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/...`).

> **Packaging Requirement for jsDelivr `/gh/`:** `cdn.jsdelivr.net/gh/<owner>/<repo>@<tag>/dist/...` serves files committed inside the **Git tree** of `<tag>`—it does **not** serve binary assets uploaded as GitHub Release attachments. `dist/study-editor.min.js` and `dist/study-editor.min.css` must be tracked in Git on tagged release commits.

#### HTML Loader Template Emitted by Gemini (`@study-notes-style` Skill Contract)

Every Canvas `.html` study note generated by Gemini uses this loader template, which includes an inline `onerror` fallback bootstrap on the `<script>` tag so the note renders as readable static HTML if the client is offline or jsDelivr is unreachable:

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Active vs. Passive Voice</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/study-editor.min.css" />
</head>
<body>
  <div id="study-root"></div>

  <!-- Baseline lesson data populated by Gemini -->
  <script id="note-data" type="application/json">
  {
    "noteId": "grammar-active-passive-01",
    "version": 1,
    "title": "Active vs. Passive Voice",
    "blocks": [
      {
        "id": "b1",
        "type": "paragraph",
        "html": "Active voice puts the <span data-color=\"red\">agent</span> in the <u>subject</u> seat."
      }
    ]
  }
  </script>

  <script
    src="https://cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/study-editor.min.js"
    onerror="(function(){var r=document.getElementById('study-root'),d=document.getElementById('note-data');if(!r||!d)return;try{var n=JSON.parse(d.textContent||'{}');r.innerHTML='<div style=&quot;padding:24px;font-family:sans-serif;&quot;><p style=&quot;color:#f59e0b;font-size:12px;&quot;>Offline / Read-Only Fallback (CDN unreachable)</p><h1>'+(n.title||'')+'</h1>'+(n.blocks||[]).map(function(b){return '<div style=&quot;margin:12px 0;&quot;>'+(b.html||b.code||'')+'</div>';}).join('')+'</div>';}catch(e){r.textContent='Failed to parse #note-data JSON.';}})()"
  ></script>
</body>
</html>
```

#### Operational Properties
- **Reduced Per-Turn Token Overhead:** Gemini emits only structured JSON note content inside `#note-data` rather than regenerating ~600 lines of UI component code on each turn.
- **Direct WYSIWYG Preview Editing:** Clicking any text block inside the Gemini Canvas preview pane edits content in place without opening the HTML code view.
- **Versioned Upgrades for Subsequent Notes:** Tagging `v1.1.0` in GitHub and updating the version string in the user's `@study-notes-style` Gemini skill causes all newly generated study notes to load `@v1.1.0`, while previously generated Canvas notes remain pinned to their immutable `@v1.0.0` tag unless their `<link>`/`<script>` tags are updated.

### 3.3 Block Data Schema (TypeScript Discriminated Union)

All blocks inside `#note-data` use a flat, non-recursive JSON schema (`src/types/schema.ts`) so serialization, diffing, and Markdown export remain deterministic:

```typescript
export interface NoteDocument {
  noteId: string;
  version: number; // Monotonic integer incremented by Gemini each time a sync patch is applied
  title: string;
  blocks: NoteBlock[];
}

export type NoteBlock =
  | ParagraphBlock
  | HeadingBlock
  | BulletListBlock
  | OrderedListBlock
  | BlockquoteBlock
  | CodeBlock
  | CalloutBlock
  | ToggleBlock
  | TabsBlock
  | GutterDiffBlock
  | SpotlightBlock
  | PeekBlock
  | UnknownBlock;

export interface ParagraphBlock {
  id: string;
  type: 'paragraph';
  html: string;
}

export interface HeadingBlock {
  id: string;
  type: 'heading';
  level: 1 | 2 | 3;
  html: string;
}

export interface BulletListBlock {
  id: string;
  type: 'bullet-list';
  items: Array<{ id: string; html: string }>;
}

export interface OrderedListBlock {
  id: string;
  type: 'ordered-list';
  items: Array<{ id: string; html: string }>;
}

export interface BlockquoteBlock {
  id: string;
  type: 'blockquote';
  html: string;
}

export interface CodeBlock {
  id: string;
  type: 'code';
  language: string;
  code: string; // Plain text code content (escaped on render)
}

export interface CalloutBlock {
  id: string;
  type: 'callout';
  tone?: 'gray' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
  titleHtml?: string;
  html: string;
}

export interface ToggleBlock {
  id: string;
  type: 'toggle';
  open?: boolean;
  summaryHtml: string;
  bodyHtml: string; // Single-level disclosure body (rich text with <br> line breaks)
}

export interface TabsBlock {
  id: string;
  type: 'tabs';
  activeTabId?: string;
  tabs: Array<{
    id: string;
    label: string;
    html: string;
  }>;
}

export interface GutterDiffBlock {
  id: string;
  type: 'gutter-diff';
  wrongLabel?: string;   // Defaults to "WRONG"
  wrongHtml: string;
  correctLabel?: string; // Defaults to "CORRECT"
  correctHtml: string;
}

export interface SpotlightBlock {
  id: string;
  type: 'spotlight';
  language: string;
  code: string;
  steps: Array<{
    id: string;
    lines: [number, number]; // 1-based inclusive [startLine, endLine] range in `code`
    html: string;
  }>;
}

export interface PeekBlock {
  id: string;
  type: 'peek';
  buttonLabel: string;
  title: string;
  headers: string[];
  rows: string[][]; // Each cell supports sanitized inline HTML
}

export interface UnknownBlock {
  id: string;
  type: string;
  html?: string;
  [key: string]: unknown;
}
```

#### Unknown Block Schema Resilience Rule
If the parser encounters a block whose `type` is not one of the 12 known types:
1. If `typeof block.html === 'string'`, render `block.html` as an editable paragraph while retaining the original `block.type` and all unknown object properties in memory so round-trip serialization does not strip fields.
2. If `block.html` is absent, render a read-only `<pre>` fallback block displaying `JSON.stringify(block, null, 2)` with a badge (`Unrecognized block type: ${block.type}`) so unrecognized composite blocks do not throw runtime exceptions or lose data.

### 3.4 Inline HTML Grammar, DOM Sanitizer & Visual Weight Ladder Styling Contract

#### Allowed Inline HTML Tag & Attribute Grammar
To avoid browser `contenteditable` inconsistencies with non-standard custom elements, all rich-text `html` strings use standard HTML5 elements and `data-*` attributes enforced by a strict DOM allowlist sanitizer (`src/utils/sanitizer.ts`) on initial load, `input` normalization, and `paste`:

| Visual Weight Tier | Purpose | Canonical HTML Serialization | Styling & Behavior |
| --- | --- | --- | --- |
| **1. Unbolded Color Tags** | Semantic role coloring (`gray` boilerplate, `blue`, `green`, `red`, `purple`, `orange`, `pink`, `brown`) | `<span data-color="red">agent</span>` | Applies `--color-<name>-fg` (`font-weight: 400`). Any nested `<code>` inside `<span data-color="<name>">` inherits `--color-<name>-fg` and uses `--color-<name>-bg` (`12%` alpha tint) as its pill background. *(Legacy shorthand `<red>...</red>` in `#note-data` is automatically normalized to `<span data-color="red">...</span>` on load.)* |
| **2. Structural Underline** | Syntactic slot marking independent of color | `<u>subject</u>` | `text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1.5px;`. Can wrap or be wrapped by `<span data-color="...">`. |
| **3. Inline Code Pill** | Identifiers, syntax tokens, flags | `<code>useState</code>` | `font-family: var(--font-mono); font-size: 0.88em; padding: 2px 5px; border-radius: 4px; background: var(--code-bg);`. Inherits parent `data-color` when nested. |
| **4. Bold Anchor** | Action verbs and structural anchors | `<strong>must</strong>` | `font-weight: 600; color: var(--fg-strong);`. Never applied automatically by color tags. |
| **5. Micro-Dot Note** | Z-axis hover tooltip without yellow highlight clutter | `<span data-note="Agent = doer of the action">agent</span>` | Renders a `4px × 4px` circular indicator dot (`background: var(--accent-dot)`) at the top-right corner (`::after`). Hovering displays the `data-note` tooltip popover; clicking inside the span opens an inline popover text input to edit or clear `data-note`. *(Legacy `<dot data-note="...">` is normalized to `<span data-note="...">` on load.)* |
| **6. Recall Mask** | Active-recall blur span | `<span data-mask="true">passive participle</span>` | In **Study Mode** (or while holding `Alt/Option`), renders with `filter: blur(5px)` and unblurs on hover or tap/click. In **Edit Mode** (default when typing), renders unblurred with a dashed bottom border (`1px dashed var(--fg-muted)`) so clicking places the text caret normally without fighting `contenteditable`. |
| **7. Hover-to-Isolate Bind Key** | Cross-referencing related tokens across sentences/code | `<span data-bind="1">agent</span>` | Supports 8 fixed bind slots (`"1"` through `"8"`). When any `[data-bind="<k>"]:hover` is active inside `#study-root:has([data-bind="<k>"]:hover)`, all `[data-bind]:not([data-bind="<k>"])` dim to `opacity: 0.32` while matching `[data-bind="<k>"]` receive a `1px solid var(--accent-bind)` outline and `10%` background highlight. |

All other HTML tags (including `<script>`, `<iframe>`, `<style>`, `<object>`, `<img>`, and event attributes `on*`) are stripped to plain text by `sanitizeInlineHtml()`. Line breaks inside single rich-text fields use `<br>`.

#### Visual Weight Ladder & Theme Color Tokens (`src/styles/study-editor.css`)

The editor supports adaptive Light (`html[data-theme="light"]`) and Dark (`html[data-theme="dark"]`) themes via a top-bar toggle button, using zero emojis and monochrome `1.5px`-stroke inline SVG icons:

| Token Group | CSS Custom Property | Dark Theme (`data-theme="dark"`) | Light Theme (`data-theme="light"`) |
| --- | --- | --- | --- |
| **Surfaces & Text** | `--bg-canvas` / `--bg-elevated` | `#121316` / `#1a1c20` | `#ffffff` / `#f7f7f5` |
| | `--fg-primary` / `--fg-muted` | `#e6e7eb` / `#8b8fa3` | `#1f2328` / `#656d76` |
| | `--border-subtle` | `rgba(255, 255, 255, 0.09)` | `rgba(31, 35, 40, 0.10)` |
| **Semantic Colors (`fg` / `12% bg`)** | `--color-gray-fg` / `--color-gray-bg` | `#9ca3af` / `rgba(156, 163, 175, 0.14)` | `#6b7280` / `rgba(107, 114, 128, 0.12)` |
| | `--color-blue-fg` / `--color-blue-bg` | `#60a5fa` / `rgba(96, 165, 250, 0.14)` | `#2563eb` / `rgba(37, 99, 235, 0.10)` |
| | `--color-green-fg` / `--color-green-bg` | `#4ade80` / `rgba(74, 222, 128, 0.14)` | `#16a34a` / `rgba(22, 163, 74, 0.10)` |
| | `--color-red-fg` / `--color-red-bg` | `#f87171` / `rgba(248, 113, 113, 0.14)` | `#dc2626` / `rgba(220, 38, 38, 0.10)` |
| | `--color-purple-fg` / `--color-purple-bg` | `#c084fc` / `rgba(192, 132, 252, 0.14)` | `#9333ea` / `rgba(147, 51, 234, 0.10)` |
| | `--color-orange-fg` / `--color-orange-bg` | `#fb923c` / `rgba(251, 146, 60, 0.14)` | `#ea580c` / `rgba(234, 88, 12, 0.10)` |
| | `--color-pink-fg` / `--color-pink-bg` | `#f472b6` / `rgba(244, 114, 182, 0.14)` | `#db2777` / `rgba(219, 39, 119, 0.10)` |
| | `--color-brown-fg` / `--color-brown-bg` | `#d6a27a` / `rgba(214, 162, 122, 0.14)` | `#92400e` / `rgba(146, 64, 14, 0.10)` |
| **Gutter Diff (`WRONG` / `CORRECT`)** | `--diff-wrong-border` / `--diff-wrong-bg` | `2px solid #f87171` / `rgba(248, 113, 113, 0.06)` | `2px solid #dc2626` / `rgba(220, 38, 38, 0.06)` |
| | `--diff-correct-border` / `--diff-correct-bg` | `2px solid #4ade80` / `rgba(74, 222, 128, 0.06)` | `2px solid #16a34a` / `rgba(22, 163, 74, 0.06)` |

### 3.5 Notion-Style UX & Study Toolkit Requirements

#### Editing Experience & Block Operations
- **Direct Block Editing:** Clicking any text field focuses its `contenteditable` surface. Pressing `Enter` at the end of a `paragraph` or `heading` inserts a new `paragraph` block below (`id: "b_" + crypto.randomUUID().slice(0, 8)`). Pressing `Backspace` at offset `0` of an empty `paragraph` deletes the block and moves focus to the preceding block.
- **Markdown Live Auto-Conversion Shortcuts (at start of `paragraph`):**
  - `# ` -> `heading` (`level: 1`)
  - `## ` -> `heading` (`level: 2`)
  - `### ` -> `heading` (`level: 3`)
  - `- ` or `* ` -> `bullet-list`
  - `1. ` -> `ordered-list`
  - `> ` -> `blockquote`
  - `` ``` `` -> `code`
- **Slash Command Menu (`/`):** Typing `/` in an empty `paragraph` (or clicking the `+` button next to the block drag handle) opens a keyboard-navigable (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`) popover menu to insert or convert the current block into any of the **8 user-insertable note-taking blocks**:
  - `Heading 1`, `Heading 2`, `Heading 3`
  - `Paragraph`
  - `Bullet List`, `Ordered List`
  - `Blockquote`
  - `Callout` (with tone picker: `gray`, `blue`, `green`, `red`, `purple`, `orange`)
  - `Single-Level Toggle` (collapsible `<details>`-style disclosure with editable `summaryHtml` and `bodyHtml`)
  - `Code Block` (monospace `<textarea>` or `<pre contenteditable="plaintext-only">` with language label)
  - `Gutter Diff (WRONG / CORRECT)` (paired two-row comparison block with `2px` red/green left border and `6%` surface tint)
- **Gemini-Authored, User-Editable Composite Study Widgets:** The remaining three structured study primitives (`tabs`, `spotlight`, `peek`) are populated by Gemini in `#note-data` and support direct user interaction and inline text editing:
  - `Horizontal Tabs (`tabs`)`: Clicking tab buttons switches the visible tab panel (`activeTabId`); the active panel's `html` and tab `label` are directly editable inline.
  - `Step-to-Code Spotlight (`spotlight`)`: Renders a line-numbered code block alongside numbered explanation steps (`steps[]`). Hovering or clicking step `i` highlights lines `steps[i].lines[0]..steps[i].lines[1]` in the code pane (`background: rgba(96, 165, 250, 0.18)`); each step's `html` is directly editable inline.
  - `Peek Reference Popover (`peek`)`: Renders an inline trigger button (`popovertarget="peek-${block.id}"`) that opens a native HTML5 `popover="auto"` card containing the reference table (`headers` and `rows`), where table cells support inline text editing.
- **Block Reordering & Deletion:** Hovering a block reveals a left-gutter control bar (`opacity: 0` at rest, `opacity: 1` on block hover) containing a drag/move handle and a delete trigger. Pressing `Cmd+Shift+Up` or `Cmd+Shift+Down` while focused inside a block moves the block up or down one slot (calling `e.preventDefault()` and `e.stopPropagation()` on `keydown`). Deleting a non-empty composite block opens a non-modal inline confirmation popover (`Delete block? [Confirm] [Cancel]`) instead of `window.confirm()`.

#### Floating Selection Toolbar
Selecting a non-empty text range inside any rich-text `contenteditable` field positions a floating toolbar (`position: fixed`, clamped within the viewport bounds) above the selection with one-click actions matching Section 3.4:
- **Color Palette Swatches (`gray`, `blue`, `green`, `red`, `purple`, `orange`, `pink`, `brown` + `clear`):** Wraps or updates `<span data-color="...">` on the selected range.
- **Underline (`<u>`), Inline Code (`<code>`), Bold (`<strong>`):** Toggles the corresponding semantic tag on the selection.
- **+ Micro-Dot Note (`data-note`):** Opens an inline text input inside the floating bar; submitting wraps the selection in `<span data-note="...">` (or updates/removes `data-note` if already wrapped).
- **Recall Mask (`data-mask="true"`):** Toggles `<span data-mask="true">` on the selection. A top-bar `Study Mode` switch toggles whether masks blur actively (`data-study-mode="true"`) or remain unblurred with a dashed underline for editing (`data-study-mode="false"`).
- **Bind Key (`data-bind="1..8"`):** Opens a compact `1`–`8` slot selector (plus `Clear`) to assign `data-bind="<slot>"` for `:has()` Hover-to-Isolate cross-referencing.

### 3.6 State Sync & One-Way Markdown Export

#### Version-Gated Same-Origin `localStorage` Recovery
1. On initial mount, the editor parses `#note-data` as `baselineDoc` (`NoteDocument`) and computes a deterministic FNV-1a content hash `baselineHash = hashBlocks(baselineDoc.blocks)`.
2. It reads `localStorage.getItem("draft:" + baselineDoc.noteId)` (wrapped in `try/catch` to handle `SecurityError` or `QuotaExceededError`). Stored draft objects follow the schema:
   ```typescript
   interface StoredDraft {
     noteId: string;
     baseVersion: number;
     baselineHash: string;
     updatedAt: number;
     title: string;
     blocks: NoteBlock[];
   }
   ```
3. **Reconciliation Decision:**
   - **Matching Baseline (`draft.baseVersion === baselineDoc.version && draft.baselineHash === baselineHash`):** The user has unsynced edits from earlier in the same preview session/reload. The editor mounts `draft.blocks` and displays the top-bar status pill: `Unsynced: N block(s) | Sync (Cmd+Shift+S)`.
   - **Newer Baseline from Gemini (`baselineDoc.version > draft.baseVersion || draft.baselineHash !== baselineHash`):** Gemini has updated `#note-data` in the Canvas file since the local draft was saved. The editor mounts the fresh `baselineDoc.blocks`, archives the superseded draft to `localStorage.setItem("backup:" + baselineDoc.noteId, JSON.stringify(draft))`, clears `draft:${noteId}`, and displays a non-modal 8-second toast (`role="status"`, `aria-live="polite"`): `Loaded updated note (v${baselineDoc.version}). [Restore previous unsynced draft]`.

#### 1-Click Canonical JSON Diff Sync (`Cmd+Shift+S`)
1. As the user edits, adds, reorders, or deletes blocks, the store compares current `blocks` against `baselineDoc.blocks` by `id` and structural order.
2. Clicking the top-bar **Sync** pill (or pressing `Cmd+Shift+S` while focus is inside the preview iframe, which calls `e.preventDefault()` to prevent macOS browser "Save As" interception) generates a deterministic `[NOTE SYNC]` JSON patch envelope containing the ordered `blockOrder` array, `deletedIds`, and full `NoteBlock` objects for all added or modified blocks (`upsertedBlocks`):
   ```text
   [NOTE SYNC: grammar-active-passive-01 | baseVersion: 1 -> targetVersion: 2]
   Please apply this JSON sync patch to `<script id="note-data" type="application/json">` in the Canvas file (set `"version": 2`, apply `upsertedBlocks` by `id`, remove `deletedIds`, and order `blocks` by `blockOrder`):
   ```json
   {
     "noteId": "grammar-active-passive-01",
     "baseVersion": 1,
     "targetVersion": 2,
     "title": "Active vs. Passive Voice",
     "blockOrder": ["b1", "b_9a4f12c0"],
     "deletedIds": ["b4"],
     "upsertedBlocks": [
       {
         "id": "b1",
         "type": "paragraph",
         "html": "Active voice puts the <span data-color=\"red\">agent</span> in the <u>subject</u> seat (never passive)."
       },
       {
         "id": "b_9a4f12c0",
         "type": "paragraph",
         "html": "Edge case: non-human agents like <span data-color=\"red\">Failure</span> still count."
       }
     ]
   }
   ```
   ```
3. **3-Tier Clipboard Copy Fallback:**
   - **Tier 1:** Call `await navigator.clipboard.writeText(payload)` within the synchronous user-activation gesture and display a 4-second inline toast: `Sync patch copied to clipboard — paste into Gemini Chat`.
   - **Tier 2:** If `navigator.clipboard.writeText` rejects, create an offscreen `<textarea>`, select its text, and execute `document.execCommand('copy')`.
   - **Tier 3:** If both programmatic clipboard methods fail, open an inline HTML5 `popover` containing a pre-selected read-only `<textarea>` prompting the user to press `Cmd+C`.

#### Deterministic One-Way Markdown Export (`src/utils/markdown.ts`)
Clicking **Export Markdown** in the top bar copies the converted Markdown to the clipboard (and provides a `Download .md` button triggering a `<a download="${noteId}.md">` Blob download) using the following conversion rules:

| Source Primitive | Markdown Output Format |
| --- | --- |
| `<span data-color="c">text</span>` | Preserved as `<span data-color="c">text</span>` by default (renders in HTML-aware Markdown viewers), or plain `text` when "Strip HTML color tags" is toggled. |
| `<u>text</u>`, `<code>text</code>`, `<strong>text</strong>` | `<u>text</u>`, `` `text` ``, `**text**` |
| `<span data-note="tip">text</span>` | `text (*Note: tip*)` |
| `<span data-mask="true">text</span>` | `==text==` (Obsidian highlight/cloze syntax) |
| `<span data-bind="k">text</span>` | `text` (strips transient hover-isolation attribute) |
| `heading` (`level: 1\|2\|3`) | `# ` / `## ` / `### ` |
| `paragraph`, `blockquote` | Paragraph line / `> ` blockquote |
| `bullet-list`, `ordered-list` | `- item` / `1. item` |
| `code` | Fenced code block (```` ```language ````) |
| `callout` | Obsidian/GFM callout (`> [!NOTE] Title\n> Body`) |
| `toggle` | HTML `<details><summary>Summary</summary>\n\nBody\n</details>` |
| `tabs` | Sequential `#### [Tab: Label]` subsections |
| `gutter-diff` | `> [!FAILURE] WRONG\n> ...\n\n> [!SUCCESS] CORRECT\n> ...` |
| `spotlight` | Fenced code block followed by numbered steps `1. **Lines X–Y:** ...` |
| `peek` | `#### Reference: Title` followed by a standard GFM pipe table (`\| Header \| ... \|`) |

---

## 4. Alternatives Considered

| Alternative Design | Evaluation & Concrete Reason for Rejection |
| --- | --- |
| **1. Gemini Task Mode + Local Obsidian MCP** | Task mode supports the local `stdio` Obsidian MCP and direct vault folder access, allowing notes to be edited directly in Obsidian. **Rejected for live tutoring sessions** because Task mode replaces conversational chat pacing with a multi-step execution work panel, consumes higher compute quota on repeated file-patching tool calls, and lacks Chat-mode Canvas quick-edit tools and custom HTML/CSS interactive widgets (`:has()` Hover-to-Isolate, Step-to-Code Spotlight). |
| **2. In-Chat Google Docs or Inline PDF Editing** | Google Docs preserves native text colors, underlines, and tables during inline co-editing. **Rejected** because neither Google Docs nor inline PDF previews can execute custom interactive study primitives (micro-dot hover tooltips, active-recall blur masks, `:has()` token cross-referencing, or Step-to-Code line highlighting), and PDF lacks fluid block-based Notion reflow. |
| **3. Native Gemini Markdown (`.md`) Canvas** | Built directly into Chat mode with zero external scripts. **Rejected** because Gemini's `.md` WYSIWYG editor strips custom inline HTML tags, CSS classes, and `data-*` attributes whenever the user makes a manual edit in the preview pane. |
| **4. Self-Contained "Micro-Kernel" Inline HTML Skill Template (Zero CDN)** | Embeds the entire CSS and JS editor inline inside every Canvas `.html` file via the `@study-notes-style` skill (100% immune to CDN outages or CSP changes). **Rejected as the primary mode** because pasting 400–600 lines of minified JS/CSS into every Canvas artifact increases per-turn LLM generation latency and token usage, and prevents bug fixes from reaching the template without bloated skill files. Retained in compact form as the 1-line `onerror` static read-only fallback on the `<script>` tag. |
| **5. Heavy Open-Source Rich-Text Frameworks (ProseMirror / TipTap / Lexical)** | Full-featured rich-text editor engines with custom schema support. **Rejected** because a complete TipTap + ProseMirror bundle plus custom node views exceeds 150–250 KB gzipped and introduces complex nested document AST requirements, whereas a flat block model in Preact (`~4 KB` gzipped) with constrained `<span data-*>` inline annotations fits well under `<= 40 KB` gzipped. |

---

## 5. Risks & Mitigations

| Risk / Limitation | Impact | Concrete Mitigation |
| --- | --- | --- |
| **Ephemeral `scf.usercontent.goog` Iframe Origins Across Re-Renders** | When Gemini rewrites the Canvas `.html` file, the host may assign a new random `*.scf.usercontent.goog` subdomain origin, making prior origin-scoped `localStorage` unreachable. | Calibrate `localStorage` strictly as a same-origin soft-reload crash buffer. Display a high-visibility `Unsynced: N block(s) | Sync (Cmd+Shift+S)` pill immediately upon any edit so the user copies the sync patch before prompting Gemini to edit the Canvas file. |
| **Stale `localStorage` Draft Overwriting Updated `#note-data`** | If the iframe origin persists after Gemini applies a sync patch, an unversioned `localStorage` load would overwrite Gemini's newly updated `#note-data` with the old draft. | Gate `localStorage` draft restoration on both `draft.baseVersion === noteData.version` and `draft.baselineHash === hashBlocks(noteData.blocks)`. When `#note-data` is newer, load `#note-data`, archive the old draft to `backup:${noteId}`, and show an inline recovery toast. |
| **DOM Corruption or Self-XSS from Raw HTML in `#note-data` or Clipboard Paste** | Study notes discussing HTML, generics (`List<T>`), or shell scripts could break DOM rendering or execute injected scripts if assigned directly to `innerHTML`. | Pass all block `html` strings on load, blur/input normalization, and `paste` events through `sanitizeInlineHtml()`, which parses via `DOMParser` and strips all elements and attributes outside the Section 3.4 allowlist. |
| **jsDelivr `404 Not Found` Due to `.gitignore`d `dist/` Directory** | Standard Vite templates add `dist/` to `.gitignore`. Because `cdn.jsdelivr.net/gh/user/repo@v1.0.0/dist/...` reads the Git tag tree (not GitHub Release binary attachments), ignoring `dist/` causes `404` failures in Canvas. | Keep `dist/study-editor.min.js` and `dist/study-editor.min.css` un-ignored in `.gitignore` and enforce a pre-tag verification check (`git ls-tree v1.0.0 dist/`) in Milestone 3. |
| **Offline Viewing or jsDelivr CDN Outage** | If jsDelivr is unreachable, `<div id="study-root"></div>` would remain blank despite the lesson JSON existing in `#note-data`. | Include the inline `onerror` fallback bootstrap on the loader `<script>` tag (Section 3.2) to render `#note-data` as readable static HTML whenever the external bundle fails to load. |
| **macOS Browser Shortcut Interception (`Cmd+Shift+S`) & Clipboard Permission Rejection** | macOS browsers intercept `Cmd+Shift+S` for "Save As / Duplicate" when focus is outside the iframe, and `navigator.clipboard.writeText()` throws `NotAllowedError` without transient user activation. | Attach keydown listeners with `e.preventDefault()` inside the iframe, pair every keyboard shortcut with a clickable UI button (`Sync`), and implement the 3-tier clipboard fallback (`navigator.clipboard` -> `execCommand('copy')` -> selectable `<textarea>` popover). |

---

## 6. Detailed Implementation Plan

### 6.1 Technical Stack & Vite Build Configuration

- **Core Stack (Zero Ambiguity):**
  - **UI & State Runtime:** Preact (`preact@^10.25.4`, ~4 KB gzipped) + TypeScript (`typescript@^5.6.3`, `strict: true`). Zero other runtime dependencies.
  - **Bundler:** Vite (`vite@^5.4.11`) + `@preact/preset-vite@^2.9.3` in IIFE library mode.
  - **Test Harness:** Vitest (`vitest@^2.1.5`, `jsdom@^25.0.1`) for unit tests + Playwright (`@playwright/test@^1.48.2`) for real Chromium DOM/CSS/popover integration tests.
- **Bundle Size Budget:** Combined gzipped size of `dist/study-editor.min.js` + `dist/study-editor.min.css` must be `<= 40 KB` (enforced via `scripts/verify-bundle.mjs`).
- **Auto-Mount Lifecycle Contract (`src/index.tsx`):**
  1. Expose `window.AntigravityStudyEditor = { mount(rootEl: HTMLElement, rawJson?: string | NoteDocument) }` for programmatic mounting and test fixtures.
  2. On script evaluation (or on `DOMContentLoaded` if `document.readyState === 'loading'`), automatically look up `document.getElementById('study-root')` and `document.getElementById('note-data')`.
  3. Wrap `JSON.parse(noteDataEl.textContent)` in a `try/catch`; if malformed, render a non-modal inline error banner inside `#study-root` displaying the JSON parse error offset and raw text rather than throwing an uncaught exception.

#### `vite.config.ts` Specification
```typescript
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'AntigravityStudyEditor',
      formats: ['iife'],
      fileName: () => 'study-editor.min.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'study-editor.min.css';
          }
          return '[name].[ext]';
        },
      },
    },
  },
});
```

### 6.2 Target Scope & File Boundary Manifest

All implementation work takes place in a new project repository (`study-editor`). Every file below has action `Create`:

| File Path | Action | Responsibility |
| --- | --- | --- |
| `package.json` | `Create` | Pin exact dependencies (`preact@^10.25.4`) and devDependencies (`typescript`, `vite`, `@preact/preset-vite`, `vitest`, `jsdom`, `@playwright/test`), plus `build`, `test:unit`, `test:e2e`, and `verify:bundle` scripts. |
| `tsconfig.json` | `Create` | Configure TypeScript (`strict: true`, `jsx: "react-jsx"`, `jsxImportSource: "preact"`, `target: "ES2022"`). |
| `vite.config.ts` | `Create` | Configure Vite IIFE library build outputting `dist/study-editor.min.js` and `dist/study-editor.min.css`. |
| `.gitignore` | `Create` | Ignore `node_modules/`, `coverage/`, `playwright-report/`, `test-results/`; explicitly **do not** ignore `dist/study-editor.min.js` and `dist/study-editor.min.css` so jsDelivr can serve tagged Git commits. |
| `src/types/schema.ts` | `Create` | Define `NoteDocument`, `NoteBlock` discriminated union (12 known block types + `UnknownBlock`), `StoredDraft`, and `SyncPatchEnvelope` interfaces. |
| `src/utils/sanitizer.ts` | `Create` | Implement `sanitizeInlineHtml(rawHtml: string): string` (normalizing legacy `<red>`/`<dot>` tags, stripping disallowed tags/attributes, and preserving allowed `<span data-*>`, `<u>`, `<code>`, `<strong>`, `<br>`). |
| `src/utils/hash.ts` | `Create` | Implement deterministic 32-bit FNV-1a `hashBlocks(blocks: NoteBlock[]): string` for baseline drift detection. |
| `src/utils/storage.ts` | `Create` | Implement `loadReconciledDraft(baseline: NoteDocument)` and `saveDraft(doc: NoteDocument, baseline: NoteDocument)` with version/hash gating, `backup:${noteId}` archival, and `try/catch` storage error guards. |
| `src/utils/diff.ts` | `Create` | Implement `computeSyncPatch(baseline: NoteDocument, current: NoteDocument): SyncPatchEnvelope` and `formatSyncClipboardPayload(patch: SyncPatchEnvelope): string`. |
| `src/utils/clipboard.ts` | `Create` | Implement 3-tier clipboard copy (`navigator.clipboard.writeText` -> offscreen `<textarea>` + `document.execCommand('copy')` -> fallback modal callback). |
| `src/utils/markdown.ts` | `Create` | Implement `exportToMarkdown(doc: NoteDocument, options?: { stripColorHtml?: boolean }): string` covering all 12 block types and 7 inline annotation types. |
| `src/utils/selection.ts` | `Create` | Implement DOM `Selection` / `Range` inspection and inline tag wrapping/unwrapping helpers (`applyColorTag`, `toggleInlineTag`, `setMicroDotNote`, `toggleRecallMask`, `setBindKey`). |
| `src/state/store.ts` | `Create` | Manage reactive editor state (`blocks`, `baselineDoc`, `dirtyBlockIds`, `theme`, `studyMode`, `toastMessage`, `activeSlashBlockId`, `clipboardFallbackText`) and block mutation actions (`updateBlock`, `insertBlockAfter`, `deleteBlock`, `moveBlock`, `convertBlockType`). |
| `src/components/Editor.tsx` | `Create` | Root editor shell: top header bar (title, theme toggle, Study/Edit mode toggle, dirty block counter pill, `Sync (Cmd+Shift+S)` button, `Export Markdown` button, toast banner, fallback copy popover) and block list container. |
| `src/components/EditableRichText.tsx` | `Create` | Controlled `contenteditable` component handling `sanitizeInlineHtml` on blur/paste, Markdown prefix auto-conversion (`# `, `## `, `### `, `- `, `1. `, `> `, `` ``` ``), `/` trigger detection, `Enter`/`Backspace` block splitting/deletion, and `Cmd+Shift+Up/Down` reordering. |
| `src/components/FloatingToolbar.tsx` | `Create` | Selection-anchored floating toolbar providing color swatches (`gray`..`brown`), `<u>`, `<code>`, `<strong>`, `+ Micro-Dot Note` input popover, `Recall Mask`, and `Bind Key (1..8)` selector. |
| `src/components/SlashMenu.tsx` | `Create` | Keyboard-navigable `/` command menu for inserting or converting the 8 user-insertable block types. |
| `src/components/blocks/StandardBlocks.tsx` | `Create` | Renderers for `paragraph`, `heading`, `bullet-list`, `ordered-list`, `blockquote`, `code`, `callout`, `toggle`, and `UnknownBlock` fallback. |
| `src/components/blocks/StudyBlocks.tsx` | `Create` | Renderers for `tabs` (Horizontal Tabs), `gutter-diff` (`WRONG` vs. `CORRECT`), `spotlight` (Step-to-Code line highlighter), and `peek` (native HTML5 `popover` reference table). |
| `src/styles/study-editor.css` | `Create` | Complete stylesheet: Light/Dark theme CSS custom properties (Section 3.4), Visual Weight Ladder rules, `:has()` Hover-to-Isolate rules for `data-bind="1..8"`, Recall Mask blur states, Gutter Diff borders/tints, Spotlight line highlights, and popover/toast layouts. |
| `src/index.tsx` | `Create` | IIFE entry point: auto-mount logic on `#study-root` + `#note-data`, `try/catch` JSON error boundary banner, global `Cmd+Shift+S` listener, and `window.AntigravityStudyEditor` export. |
| `examples/sample-note.html` | `Create` | Self-contained sample study note demonstrating all 12 block types and all 7 Visual Weight Ladder inline annotations for local preview and Playwright E2E testing. |
| `scripts/verify-bundle.mjs` | `Create` | Node build verification script asserting `dist/study-editor.min.js` and `dist/study-editor.min.css` exist, contain zero `window.alert(` or `window.confirm(` calls, and have a combined gzipped size `<= 40960` bytes (`40 KB`). |
| `tests/unit/sanitizer.test.ts` | `Create` | Vitest unit tests for `sanitizeInlineHtml` (legacy tag normalization, nested `<code>` inside `data-color`, and XSS tag stripping). |
| `tests/unit/sync-and-storage.test.ts` | `Create` | Vitest unit tests for `computeSyncPatch`, version-gated `localStorage` draft recovery vs. stale draft invalidation, and `UnknownBlock` round-trip field preservation. |
| `tests/unit/markdown.test.ts` | `Create` | Vitest unit tests for `exportToMarkdown` across all 12 block types and 7 inline annotation types. |
| `tests/e2e/editor.spec.ts` | `Create` | Playwright Chromium E2E tests verifying auto-mount, inline editing, Markdown shortcuts, `/` slash menu, floating toolbar wrapping, `:has()` Hover-to-Isolate, Step-to-Code Spotlight, `popover` reference table, and `Cmd+Shift+S` clipboard sync. |

### 6.3 Phased Implementation Milestones

#### Milestone 1: Project Scaffold, Schema & Core Block Editor
1. Initialize `package.json`, `tsconfig.json`, `vite.config.ts`, and `.gitignore`.
2. Implement `src/types/schema.ts`, `src/utils/sanitizer.ts`, `src/utils/hash.ts`, and `src/utils/selection.ts`.
3. Implement `src/state/store.ts`, `src/components/EditableRichText.tsx`, `src/components/SlashMenu.tsx`, `src/components/FloatingToolbar.tsx`, and `src/components/blocks/StandardBlocks.tsx` (covering `paragraph`, `heading`, `bullet-list`, `ordered-list`, `blockquote`, `code`, `callout`, `toggle`, and `UnknownBlock` fallback, plus Markdown live shortcuts and block reordering via drag handle and `Cmd+Shift+Up/Down`).
4. Implement `src/styles/study-editor.css` with the Section 3.4 Light/Dark CSS custom property table and Visual Weight Ladder rules.
5. **Milestone 1 Checkpoint:** Run `npm run test:unit` and `npm run build` and verify zero TypeScript or bundler errors.

#### Milestone 2: Pedagogical Study Primitives (`tabs`, `gutter-diff`, `spotlight`, `peek`) & Interactive CSS
1. Implement `src/components/blocks/StudyBlocks.tsx`:
   - `TabsBlock`: X-axis tab bar switching `activeTabId` with inline editable panel `html` and tab `label`.
   - `GutterDiffBlock`: Two-row `WRONG` (`2px` red border + `6%` tint) vs. `CORRECT` (`2px` green border + `6%` tint) block with inline editable rich text.
   - `SpotlightBlock`: Line-numbered `<pre><code>` view paired with clickable/hoverable steps highlighting `lines[0]..lines[1]` and editable step `html`.
   - `PeekBlock`: Trigger button coupled to a native `<div popover="auto" id="peek-${block.id}">` card rendering an editable reference table.
2. Wire `:has()` Hover-to-Isolate rules for `data-bind="1..8"`, micro-dot (`data-note`) tooltip + inline editor popover, and Study/Edit mode Recall Mask (`data-mask="true"`) toggling in `src/styles/study-editor.css` and `src/components/FloatingToolbar.tsx`.
3. Create `examples/sample-note.html` containing a comprehensive fixture with all 12 block types and 7 inline formatting primitives.
4. **Milestone 2 Checkpoint:** Build the library (`npm run build`) and run Playwright E2E tests against `examples/sample-note.html`.

#### Milestone 3: State Sync, Markdown Export, Bundle Verification & jsDelivr Release
1. Implement `src/utils/storage.ts` (version/hash-gated `localStorage` draft recovery + `backup:${noteId}` archival), `src/utils/diff.ts` (canonical `[NOTE SYNC]` JSON patch generator), `src/utils/clipboard.ts` (3-tier clipboard copy chain), and `src/utils/markdown.ts` (one-way Markdown exporter with clipboard copy and `.md` download).
2. Wire top-bar sync pill (`Unsynced: N block(s) | Sync (Cmd+Shift+S)`), `Restore previous unsynced draft` toast action, `Export Markdown` menu, and `try/catch` JSON error boundary in `src/components/Editor.tsx` and `src/index.tsx`.
3. Implement `scripts/verify-bundle.mjs` and run `npm run verify:bundle` to enforce `<= 40 KB` combined gzipped size and zero `alert()`/`confirm()` usage.
4. Commit `dist/study-editor.min.js` and `dist/study-editor.min.css` to Git, tag `v1.0.0`, push to GitHub, verify `https://cdn.jsdelivr.net/gh/AlexanderFisher-tech/study-editor@v1.0.0/dist/study-editor.min.js` resolves with HTTP 200, and update the `@study-notes-style` Gemini skill with the Section 3.2 HTML loader template and Section 3.3 `NoteDocument` JSON contract.

### 6.4 Test Plan & Verification Checkpoints

All tests must pass via `npm test` (`vitest run && npx playwright test && node scripts/verify-bundle.mjs`) before tagging `v1.0.0`:

1. **Unit Tests — HTML Sanitizer & Legacy Normalization (`tests/unit/sanitizer.test.ts`):**
   - *Happy path:* Preserves `<span data-color="red">`, `<u>`, `<code>`, `<strong>`, `<span data-note="...">`, `<span data-mask="true">`, `<span data-bind="3">`, and `<br>`.
   - *Legacy tag migration:* Normalizes `<red>agent</red>` to `<span data-color="red">agent</span>` and `<dot data-note="tip">word</dot>` to `<span data-note="tip">word</span>`.
   - *Edge cases / XSS:* Strips `<script>alert(1)</script>`, `onload`/`onerror` attributes, arbitrary `style="..."` injected by browser `contenteditable`, and invalid `data-color="neon"` or `data-bind="99"` values while keeping inner text intact; safely escapes angle brackets in code generics (`List<T>`).
2. **Unit Tests — Sync Diff & Version-Gated `localStorage` (`tests/unit/sync-and-storage.test.ts`):**
   - *Happy path:* Modifying `b1`, adding `b_new` after `b1`, reordering `b2`/`b3`, and deleting `b4` produces a `[NOTE SYNC]` JSON envelope with `targetVersion: baseVersion + 1`, exact `blockOrder`, `deletedIds: ["b4"]`, and `upsertedBlocks` containing full objects for `b1` and `b_new`.
   - *Same-version reload:* When `draft.baseVersion === 1` and `#note-data.version === 1` (with matching `baselineHash`), `loadReconciledDraft()` restores `draft.blocks` and flags dirty block IDs.
   - *Version-bump invalidation:* When `#note-data.version === 2` and `draft.baseVersion === 1`, `loadReconciledDraft()` returns `#note-data.blocks`, writes the old draft to `backup:${noteId}`, deletes `draft:${noteId}`, and sets `supersededDraftAvailable: true`.
   - *Unknown block resilience:* An unrecognized block `{ id: "b9", type: "future-chart", html: "Fallback text", chartData: [1, 2, 3] }` renders as an editable paragraph and preserves `type: "future-chart"` and `chartData: [1, 2, 3]` in `upsertedBlocks` after text edits.
3. **Unit Tests — One-Way Markdown Export (`tests/unit/markdown.test.ts`):**
   - Verifies conversion of all 12 block types and 7 inline annotation types against golden Markdown snapshots (both with `stripColorHtml: false` and `stripColorHtml: true`).
4. **End-to-End Browser Tests (`tests/e2e/editor.spec.ts` in Chromium):**
   - Mounts `examples/sample-note.html`, verifies dark/light theme toggle updates computed CSS variables, converts a paragraph via `# ` to an H1 block, inserts a `Gutter Diff` block via the `/` slash menu, wraps selected text in `<span data-color="blue">` and `<span data-note="test note">` via the floating toolbar, verifies hovering `[data-bind="1"]` dims `[data-bind="2"]` via CSS `:has()`, verifies clicking a `Spotlight` step highlights the target code lines, verifies clicking a `Peek` button opens the HTML5 `popover` table, and verifies pressing `Cmd+Shift+S` writes the `[NOTE SYNC]` JSON payload to the clipboard.
5. **Bundle & Policy Verification (`scripts/verify-bundle.mjs`):**
   - Asserts `gzipSync(js).length + gzipSync(css).length <= 40960` bytes and asserts neither bundle contains `alert(` or `confirm(`.
