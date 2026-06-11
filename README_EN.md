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
- **File tree sidebar**:open a workspace, right-click to create / rename / delete
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
- **Export HTML / PDF**:PDF via html2canvas + jsPDF, with heading-aware page breaks and font fallbacks

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
| Toolbar buttons | Switch split / edit-only / preview-only |
| `F8` | Focus mode |
| `F9` | Typewriter mode |
| `Esc` | Close the search panel |

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
src-tauri/target/release/bundle/nsis/InkStone MD_1.0.0_x64-setup.exe
```

Double-click to install. Windows will register `.md` / `.markdown` / `.txt` associations automatically.

### Uninstall

Use "Control Panel → Add or remove programs". The uninstaller cleans the file-association registry keys so no "Open with" entries are left behind.

## Usage

### Open a workspace

`Ctrl+O` to open a file, or use the `📁 Folder` button to open a whole workspace. The file tree appears on the left; right-click to create / rename / delete.

### Switch theme

Pick `InkStone` / `GitHub` / `One Dark` / `Typora` from the toolbar dropdown. The `🌙` / `☀️` button on the right toggles dark / light. (Choosing One Dark auto-switches to dark mode.)

### Assets panel

Open the second sidebar tab `🖼️ Assets` to see every image referenced by the current document. Each entry supports reveal / rename / move / compress / copy path / copy reference / remove reference.

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
- **PDF export**:jspdf + html2canvas
- **Image compression** (server-side):the `image` crate (jpeg / png)

## Project structure

```
inkstone-md/
├── src/                       # Vue frontend source
│   ├── App.vue                # Main component (editor, file tree, toolbar, status bar)
│   ├── main.ts                # Vue entry
│   └── style.css              # Global styles + 4 themes
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
| `reveal_in_folder` | Reveal in OS file manager (explorer / open -R / xdg-open) |
| `compress_image` | Re-encode image to jpeg / png, return compressed size |
| `frontend_ready` | Frontend handshake, dispatches the startup pending file |

## Changelog

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

Candidates for V1.x and beyond are tracked in [ROADMAP_V1.0.0.md](./ROADMAP_V1.0.0.md), including DOCX export, spell-check, font preferences, and a custom dark palette.

## Contributing

Issues and Pull Requests are welcome. Before submitting a PR, run `npm install`, then make sure both `npm run build` and `cargo check` pass cleanly.

## License

GPL-3.0 License
