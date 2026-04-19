# InkStone MD

[中文](./README.md) | English

A lightweight and elegant desktop Markdown editor, built with Tauri + Vue 3.

## Features

### Editing
- Multiple tabs
- Live preview (split / edit-only / preview-only)
- Search and replace (Ctrl+F)
- Auto-pairing (brackets, quotes, etc.)
- Footnote support
- Image drag & drop
- Mermaid diagram support
- KaTeX math support
- Task list support

### View
- Outline / TOC
- File tree sidebar (open folder, right-click to create/rename/delete)
- Focus mode (F8) - hide sidebar and toolbar
- Typewriter mode (F9) - keep cursor centered

### Theme
- Dark / Light mode
- Theme persistence

### Utilities
- Auto-save (30 seconds)
- Recent files
- Word count statistics
- Drag to open files
- Export HTML
- Keyboard shortcuts (Ctrl+N/O/S/B)

## Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+N | New file |
| Ctrl+O | Open file |
| Ctrl+S | Save file |
| Ctrl+B | Bold |
| Ctrl+F | Search & Replace |
| F8 | Focus mode |
| F9 | Typewriter mode |

## Installation

### Build from source

```bash
# Install dependencies
npm install

# Development
npm run dev

# Tauri development
npm run tauri dev

# Build
npm run build
npm run tauri build
```

### Preview

```bash
npm run preview
```

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + TailwindCSS
- **Backend**: Tauri 2.x (Rust)
- **Markdown**: markdown-it + markdown-it-task-lists + highlight.js + KaTeX + mermaid

## Project Structure

```
inkstone-md/
├── src/                    # Vue frontend source
│   ├── App.vue            # Main component
│   └── main.ts            # Entry point
├── src-tauri/             # Tauri backend source
│   ├── src/
│   │   ├── lib.rs         # Library entry
│   │   └── main.rs        # Rust entry
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri config
├── package.json           # Node dependencies
└── vite.config.ts         # Vite config
```

## License

MIT License

## Contributing

Issues and Pull Requests are welcome!