# InkStone MD

[中文](./README.md) | English

A lightweight and elegant desktop Markdown editor built with Tauri 2 + Vue 3. Out-of-the-box support for live preview, WYSIWYG-style editing, syntax highlighting, math equations, Mermaid diagrams, multiple themes, and OS-level file associations.

![preview](docs/preview.png)

## Features

### Content authoring

- **Multi-mode live preview**:split / edit-only / preview-only
- **Code blocks**:highlight.js (100+ languages) + line numbers + one-click copy
- **Math equations**:KaTeX rendering (inline `$...$` and block `$$...$$`)
- **Mermaid diagrams**:flowcharts, sequence, gantt, class, state, and more
- **Task lists and footnotes**:standard `- [x]` and `[^1]` syntax
- **Search & replace** (`Ctrl+F`):regex-escaped matches, prev/next, replace / replace-all
- **Auto-pairing**:typing `(` / `[` / `{` / `"` auto-completes the matching close
- **Paste image**:clipboard screenshots auto-saved to `<file>/assets/` and inserted as relative references
- **Image interaction**:hover toolbar with 25% / 50% / 75% / 100% zoom and left / center / right alignment
- **Visual table editing**:toggle `✏️ Edit`, ± row / ± column, `💾 Save to source` writes the DOM table back to the original markdown
- **TOC insertion**:write `[[toc]]` anywhere to expand a clickable outline based on all headings

### View & navigation

- **Outline / TOC sidebar**:one-click jump to the corresponding heading
- **Dual-zone file tree sidebar**:
  - 📚 **My Library**: in-app workspace with a default root ready out of the box; full create / rename / delete / move for files and folders; one-click library migration
  - 📁 **External folders**: open any system directory as read-only structure; only file operations allowed
  - Tree visuals: expand/collapse arrows + per-level guide lines; drag-to-move across drives and between zones
- **Assets panel**:scans every image referenced by the current document. Supports
  - 📂 Reveal in OS file manager (explorer / Finder / xdg-open)
  - ✏️ Rename / 📁 Move / 🗜️ Compress (jpeg / png)
  - 📋 Copy absolute path / 🔗 Copy Markdown reference
  - ✕ Remove the reference from the document
- **Focus mode** (`F8`):hide the toolbar and sidebar, keep only the editor
- **Typewriter mode** (`F9`):cursor stays centered on screen
- **Recent files**:the last 10 opened files are remembered

### Files & workflow

- **Windows file association**:double-clicking `.md` / `.markdown` / `.txt` opens the file in InkStone MD
- **Single instance**:double-clicking a file while the app is already running focuses the existing window instead of spawning a new one
- **Command-line open**:`inkstone-md xxx.md`
- **Drag & drop**:drop files onto the window to open
- **30-second auto-save**:guards against accidental close
- **Export HTML**:fully self-contained single file — KaTeX CSS + highlight.js theme + Mermaid JS + active theme + images (base64) are all inlined. Open offline in any browser.
- **Export PDF**:hidden-iframe print; text is selectable/searchable and layout matches the preview; choose "Save as PDF" and the filename is auto-filled with the document name

### Themes & personalization

- **4 built-in themes**:`InkStone` / `GitHub` / `One Dark` / `Typora`
- **Light / dark mode** for every theme (One Dark is dark-only)
- Theme and mode are both persisted to `localStorage`
- Toolbar dropdown to switch with live preview

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New file |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save file |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+F` | Search & Replace |
| `Ctrl+\` | Cycle edit / split / preview view |
| `F1` | Keyboard shortcuts |
| `F7` | Toggle scroll sync |
| `F8` | Focus mode |
| `F9` | Typewriter mode |
| `Esc` | Close search panel / dialogs |

## Installation

### Build from source

```bash
# 1. Install dependencies
npm install

# 2. Vite dev server (no Tauri window)
npm run dev

# 3. Tauri dev mode (frontend + Rust backend)
npm run tauri dev

# 4. Build
npm run build              # vue-tsc type check + Vite build
npm run tauri build        # produce the NSIS installer (.exe)
```

### Installer

After `npm run tauri build` finishes, the installer is at:

```
src-tauri/target/release/bundle/nsis/InkStone MD_1.5.0_x64-setup.exe
```

Double-click to install. Windows will register `.md` / `.markdown` / `.txt` associations automatically.

### Uninstall

Use "Control Panel → Add or remove programs". The uninstaller cleans the file-association registry keys so no "Open with" entries are left behind.

## Usage

### Workspace (file tree)

The sidebar **File tree** has two zones:
- 📚 **My Library**: the in-app document library, auto-created on first launch; right-click to create files/folders, rename, delete, or drag to move; the `⋯` menu on the library header lets you migrate the library
- 📁 **External folders**: the `📁 Folder` button opens any system directory (read-only structure, file operations only); closing removes it from recents

Every directory (including roots) can be expanded/collapsed; files and folders can be dragged to a target directory, across drives supported.

### Switch theme

Pick `InkStone` / `GitHub` / `One Dark` / `Typora` from the toolbar dropdown. The `🌙` / `☀️` button on the right toggles dark / light. (Choosing One Dark auto-switches to dark mode.)

### Assets panel

Open the second sidebar tab `🖼️ Assets` to see every image referenced by the current document. Each entry supports reveal / rename / move / compress / copy path / copy reference / remove reference.

### Export

- **HTML**:click `📤 HTML` in the toolbar, pick a path. The produced `.html` contains every style, the active theme, all images as base64, and the Mermaid / KaTeX runtime — open it offline in any browser, no network needed.
- **PDF**:click `📄 PDF` in the toolbar to open the system print dialog. Pick **"Save as PDF"** (Microsoft Edge) — the filename is auto-filled with the current document name and the layout matches the preview. A one-time hint shows on first use.

### Table editing

On any rendered markdown table, a toolbar appears at the top:
- `✏️ Edit`:toggle contenteditable on the cells
- `+ Row` / `- Row` / `+ Col` / `- Col`:structural changes
- `💾 Save to source`:write the current DOM table back to the original markdown (matched by exact source string; the editor cursor is preserved)
- `Copy as Markdown`:put the markdown form of the table on the clipboard

### Code blocks

Fenced code blocks (` ```rust ` etc.) render with:
- A top toolbar showing the language label and a Copy button
- Line numbers on the left, perfectly aligned with each line
- Copy never includes the line-number prefix

### Table of contents

Write this anywhere in the document:

```markdown
[[toc]]
```

It expands to a multi-level outline based on all `# / ## / ###` headings. Click any entry to jump.

## Tech stack

- **Frontend**:Vue 3 + TypeScript + Vite + TailwindCSS
- **Backend**:Tauri 2.x (Rust)
- **Markdown parsing**:markdown-it + markdown-it-task-lists + markdown-it-footnote
- **Code highlighting**:highlight.js
- **Math**:KaTeX
- **Diagrams**:mermaid
- **UI icons**:`@lucide/vue` (pure SVG, inherits theme color)
- **Image compression** (server-side):the `image` crate (jpeg / png)

## Project structure

```
inkstone-md/
├── src/                       # Vue frontend source
│   ├── App.vue                # Main component (layout shell + editor/export/shortcut orchestration)
│   ├── main.ts                # Vue entry
│   ├── style.css              # Global styles + 4 themes
│   ├── components/            # SFC components (toolbar/tab/editor/file tree/dialogs…)
│   ├── composables/           # Composition logic (useWorkspace dual-zone file tree…)
│   ├── types/                 # TypeScript declarations
│   ├── utils.ts               # Pure utility functions
│   └── constants/             # Constants (export CSS etc.)
├── src-tauri/                 # Tauri backend
│   ├── src/
│   │   ├── lib.rs             # Rust library entry (commands, single instance, file open)
│   │   └── main.rs            # Rust binary entry
│   ├── capabilities/
│   │   └── default.json       # Tauri permissions
│   ├── icons/                 # App icons
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri config (window, bundle, file association)
├── ROADMAP_V1.0.0.md          # V1.0.0 release plan and P0/P1 acceptance
├── package.json               # Node dependencies and scripts
├── vite.config.ts             # Vite config
├── tailwind.config.js         # TailwindCSS config
└── tsconfig.json              # TypeScript config
```

### Rust commands (via `invoke`)

| Command | Purpose |
|---------|---------|
| `read_file` / `write_file` | Text file I/O |
| `read_file_bytes` / `write_file_bytes` | Binary file I/O (e.g. image copy) |
| `get_file_info` | File metadata (size, etc.) |
| `read_directory` | Recursive directory listing (skip dotfiles) |
| `create_file` / `create_directory` | Create |
| `rename_path` / `delete_path` | Rename / delete |
| `move_path` | Move file/folder to a target dir (cross-drive copy+delete fallback) |
| `reveal_in_folder` | Reveal/open in OS file manager (dirs open directly, files are selected) |
| `ensure_library` | Init/get the in-app library root (app data default, migratable) |
| `migrate_library` | Migrate library root to a new dir (move docs + update config) |
| `compress_image` | Re-encode image to jpeg / png, return compressed size |
| `frontend_ready` | Frontend handshake, dispatches the startup pending file |

## Changelog

### [1.5.0] — dual-zone file tree rebuild

The sidebar file tree is rebuilt as a two-zone model. See [ROADMAP_V1.5.0.md](./ROADMAP_V1.5.0.md).

#### ✨ Added
- **Dual-zone file tree**:
  - 📚 **My Library**: in-app workspace, auto-created default root in the app data dir; full create / rename / delete / move for files and folders; one-click "migrate library" to any location (open-tab paths are remapped)
  - 📁 **External folders**: open any system directory as read-only structure; only files can be created / renamed / moved / deleted (folders are protected)
  - **Drag to move**: drag files/folders to any directory (incl. roots); cross-drive (copy+delete fallback), cross library/external; prevents dropping into a node's own subtree
  - **Persistence & restore**: recent external folders are stored via `tauri-plugin-store` and restored on restart; invalid paths are greyed out and removable
- **Tree visuals**: expand/collapse arrows (▾/▸) + per-level guide lines; every level (incl. roots) is collapsible; library (blue) vs external (amber) are visually distinct
- New Rust commands: `ensure_library` / `migrate_library` / `move_path` (cross-drive safe move)
- New deps: `tauri-plugin-store`, `@tauri-apps/plugin-store`

#### 🏗️ Refactor
- File-tree logic extracted from App.vue into `useWorkspace.ts` composable + `TheFileTree.vue` + recursive `TreeNode.vue`, replacing the old `h()` hand-rolled recursion; App.vue shrank ~430 lines
- Incremental tree updates: CRUD/move now patch nodes locally instead of re-reading the whole tree
- Versions synced to `1.5.0`

#### 🐛 Fixed
- Code-block content being re-rendered (highlight's no-language branch wasn't HTML-escaped; katex/TOC/image preprocessing leaked into `<code>`); added `mapOutsideCode` + stash/restore around katex
- `reveal_in_folder` on a directory opened its parent (used `/select`); directories now open their content directly
- New file landed at root instead of the right-clicked folder
- PDF math rendered as code blocks (export pipeline aligned with preview)
- PDF default filename blank (now set from `document.title` before print)
- PDF hint reappearing (now shown once on first export)
- External folder reappearing after restart (close now also removes from recents)

### [1.4.0] — architecture cleanup & PDF export fixes

Two tasks: rebuild PDF export and split App.vue into components. See [ROADMAP_V1.4.0.md](./ROADMAP_V1.4.0.md).

#### 🐛 Fixed
- **PDF export rebuilt** with a hidden iframe: no more toolbar/sidebar/status-bar leaking into the PDF, long documents are no longer clipped, and the header no longer shows "InkStone MD"
- Updated the print hint to guide users to disable headers/footers

#### 🏗️ Refactor
- **App.vue split**: 4400 → ~3000 lines; added `src/components/`, `src/types/`, `src/utils.ts`, `src/constants/`; extracted 8 SFC components
- Versions synced to `1.4.0`

### [1.3.0] — feature completion & experience fixes

Focused on four reported issues: adding a true edit-only view, fixing the typewriter / focus modes that had no visible effect, and adding Shortcuts & About entries to the native menu bar. See [ROADMAP_V1.3.0.md](./ROADMAP_V1.3.0.md).

#### ✨ Added
- **Edit-only view**: toolbar (pencil icon), native menu "View → Edit Mode", and `Ctrl+\` to cycle edit / split / preview; the view mode is persisted across restarts
- **Native "Help" menu**: "Shortcuts (F1)" opens a grouped shortcuts dialog, "About InkStone MD" shows version / stack / license
- `F1` opens the shortcuts dialog directly; the About version is injected from `package.json` via Vite `define`
- Shortcuts list centralized in a single `SHORTCUTS` constant

#### 🐛 Fixed
- **Typewriter mode had no effect**: `scrollToCursor` hardcoded line height 20px (actual ~28.8px) so the cursor never centered; now uses real `getComputedStyle` line height + character-ratio pixel estimation, and centers immediately on toggle / view switch
- **Focus mode had no effect**: `toggleFocusMode` had no side-effect on enable and the current-line highlight was too faint and hidden under the dark background; now highlights the current line on enable, with stronger theme-aware contrast (light 0.18 / dark 0.22) and `scrollTop` correction so the highlight follows the line while scrolling

#### 🔧 Changed
- View mode refactored from two booleans to a single `viewMode` enum (edit/split/preview); `showSplit`/`showPreview` are now `computed` derivations, eliminating invalid combined states
- Versions synced to `1.3.0` across `package.json` / `Cargo.toml` / `tauri.conf.json`
- Print styles hide the modal overlay

### [1.1.0] — optimization pass

A pure optimization release, no breaking changes. Focuses on toolbar/UI polish and HTML/PDF export fidelity. See [ROADMAP_V1.1.0.md](./ROADMAP_V1.1.0.md) for details.

#### 🎨 UI & toolbar
- **Toolbar is now icon-only**: switched from emoji + Chinese to Lucide SVG icons (`FilePlus` / `FolderOpen` / `Save` / `Bold` / `Italic` / `Heading1` …), uniform size, inherits theme color
- Buttons have full state coverage: default / hover / active (split / preview mode highlight) / disabled / focus-visible outline; `:active` adds a `scale(0.96)` micro-animation
- Groups now use spacing + faint separators; logo is text + feather icon
- **Responsive overflow**: < 1080px collapses the “Lists” group, < 820px also collapses the “Insert” group, both into a `⋯` dropdown with section headers
- **Tab bar upgrade**: active tab gets a 2px theme-color bottom border + soft shadow; close button only appears on hover; unsaved indicator is a 6px dot instead of the `●` glyph; middle-click closes a tab
- Global 200ms color transition (theme / dark mode swaps don't flicker); custom 8px rounded scrollbar

#### 📤 Export
- **HTML export → single self-contained file**: CSS (KaTeX + highlight.js theme + active theme) / Mermaid JS / images (base64) are all inlined into one `.html`. Works fully offline.
- HTML export uses `captureCurrentTheme` so the result matches the live preview (all 4 themes, light/dark)
- **PDF export → WebView print + Save as PDF**: `window.print()` opens the system print dialog. Pick `Microsoft Print to PDF` to save. Text is selectable / searchable, file size is small, layout = preview
- Complete `@media print` rules: hide toolbar / tabs / sidebar / status bar; `@page A4 / margin 15mm`; prevent page-breaks inside headings / code blocks / tables / images; `print-color-adjust: exact` keeps code-block backgrounds
- First-time PDF click shows a one-time hint banner; remembered via `localStorage`
- Removed `jspdf` + `html2canvas` dependencies (bundle −~600KB)

#### 🔧 Improved
- Version bumped to `1.1.0` in all three places
- New dependency: `@lucide/vue`
- Export rendering uses the same markdown pipeline as the live preview (image base64 inlining + TOC preprocess + KaTeX + Mermaid placeholder), guaranteeing WYSIWYG

#### ⚠️ Known limitations
- HTML exports with many images can be large (each base64 image ≈ 1.3× the original). Typical documents stay under 5 MB.
- Exported HTML without KaTeX font files falls back to system serif for math glyphs. Common symbols render fine; very rare characters may show as boxes.
- PDF export requires the user to pick `Microsoft Print to PDF` in the system dialog (cannot be 100% automated).

### [1.0.0] — first stable release

Targets "daily-usable" as the bar. Fixes the two blocking bugs and fills the core experience gap with Typora.

#### 🐛 Fixed
- **Images not rendering**:WebView blocks `file://` by default. Enable `assetProtocol` + `convertFileSrc`. Local absolute / relative / network URL / base64 all work.
- **Win 10 double-click on `.md` did nothing**:missing single-instance + race in event timing. Switched to `tauri-plugin-single-instance` + `tauri-plugin-deep-link`, with a `frontend-ready` handshake and a unified `open-file` event. NSIS `installMode: perMachine` registers the association globally.

#### ✨ Added
- Code block line numbers (per-line `<div class="line">`, copy stays clean)
- Code block one-click copy
- Visual table editing:✏️ Edit / ± Row / ± Col / 💾 Save to source / Copy as Markdown
- TOC insertion:`[[toc]]` placeholder + toolbar button + anchor jumps
- Assets panel:reveal / rename / move / compress / copy path / copy reference / remove reference
- 4 built-in themes:`InkStone` / `GitHub` / `One Dark` / `Typora`
- Pasted images auto-saved to `<file>/assets/`
- Image zoom (4 steps: 25 / 50 / 75 / 100%) and alignment (3 steps: left / center / right)
- Single instance:double-clicking a file focuses the existing window

#### 🔧 Improved
- `fileAssociations` extended to `.md` / `.markdown` / `.txt`
- Tauri `protocol-asset` feature enabled; `Cargo.lock` updated
- New Rust dependencies:`tauri-plugin-single-instance` / `tauri-plugin-deep-link` / `image`
- Startup argument parsing:handles paths with spaces / quotes / non-ASCII characters

#### ⚠️ Known limitations
- Image compression uses the Rust `image` 0.25 crate (pure Rust, no external tools). webp / avif are not yet supported.
- Rename / move / compress use the browser-native `prompt` / `confirm` dialogs; a custom modal can replace them later.
- Theme fonts rely on system fonts; no custom font file is bundled.

### [0.1.2] — early development

Earlier development snapshot. Implemented multi-tab, file tree, search & replace, KaTeX, Mermaid, auto-save, recent files, focus / typewriter modes, HTML / PDF export, etc. Known bugs at this point:images not rendering, Win 10 file association broken.

## Roadmap

V1.x candidates are tracked in [ROADMAP_V1.0.0.md](./ROADMAP_V1.0.0.md) (DOCX export, spell-check, font preferences, etc.), [ROADMAP_V1.1.0.md](./ROADMAP_V1.1.0.md), [ROADMAP_V1.4.0.md](./ROADMAP_V1.4.0.md) and [ROADMAP_V1.5.0.md](./ROADMAP_V1.5.0.md) (detailed records of each pass and remaining follow-ups).

## Contributing

Issues and Pull Requests are welcome. Before submitting a PR, run `npm install`, then make sure both `npm run build` and `cargo check` pass cleanly.

## License

GPL-3.0 License
