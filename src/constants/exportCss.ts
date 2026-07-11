export const EXPORT_BASE_CSS = `
:root {
  font-family: var(--ink-font, 'Segoe UI', system-ui, -apple-system, 'Microsoft YaHei', 'PingFang SC', sans-serif);
  font-size: 16px;
  line-height: 1.7;
  color: var(--ink-fg, #1a1a1a);
  background: var(--ink-bg, #fafafa);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { padding: 2rem 1.5rem; }
.markdown-body { max-width: 820px; margin: 0 auto; line-height: 1.7; color: inherit; word-wrap: break-word; }
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  font-weight: 600; line-height: 1.3; margin-top: 1.6em; margin-bottom: 0.8em; letter-spacing: -0.01em; scroll-margin-top: 80px; color: inherit;
}
.markdown-body h1 { font-size: 2.25em; font-weight: 700; padding-bottom: 0.4em; border-bottom: 2px solid #e5e7eb; margin-top: 0.4em; }
.markdown-body h2 { font-size: 1.65em; padding-bottom: 0.3em; border-bottom: 1px solid #e5e7eb; }
.markdown-body h3 { font-size: 1.35em; position: relative; padding-left: 12px; }
.markdown-body h3::before { content: ''; position: absolute; left: 0; top: 0.25em; bottom: 0.25em; width: 3px; border-radius: 2px; background: #3b82f6; }
.markdown-body h4 { font-size: 1.1em; color: #374151; }
.markdown-body h5, .markdown-body h6 { font-size: 1em; color: #6b7280; }
.markdown-body h1 + p, .markdown-body h2 + p, .markdown-body h3 + p { margin-top: 0.4em; }
.markdown-body p { margin: 1em 0 1.1em; }
.markdown-body ul, .markdown-body ol { margin: 1em 0; padding-left: 1.6em; }
.markdown-body li { margin: 0.4em 0; line-height: 1.7; }
.markdown-body li > p { margin: 0.4em 0; }
.markdown-body ul ul, .markdown-body ul ol, .markdown-body ol ul, .markdown-body ol ol { margin: 0.4em 0; }
.markdown-body ul { list-style: none; padding-left: 1.4em; }
.markdown-body ul > li { position: relative; padding-left: 0.2em; }
.markdown-body ul > li::before { content: ''; position: absolute; left: -1em; top: 0.65em; width: 6px; height: 6px; border-radius: 50%; background: #6b7280; }
.markdown-body ul ul > li::before { width: 5px; height: 5px; background: transparent; border: 1.5px solid #6b7280; }
.markdown-body ul ul ul > li::before { width: 5px; height: 5px; border-radius: 1px; background: #6b7280; border: none; }
.markdown-body ol { list-style-type: decimal; }
.markdown-body ol li::marker { color: #6b7280; font-weight: 500; }
.markdown-body code { background: rgba(127,127,127,0.1); padding: 0.15em 0.4em; border-radius: 4px; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 0.88em; border: 1px solid rgba(127,127,127,0.12); color: inherit; }
.markdown-body pre { background: rgba(127,127,127,0.06); padding: 1.2em; border-radius: 8px; overflow-x: auto; margin: 1.2em 0; border: 1px solid rgba(127,127,127,0.1); position: relative; }
.markdown-body pre code { background: transparent; padding: 0; border: none; font-size: 0.9em; line-height: 1.6; }
.markdown-body pre .line { display: block; min-height: 1.5em; }
.markdown-body blockquote { border-left: 4px solid #d1d5db; padding: 0.6em 1.2em; color: #6b7280; margin: 1.2em 0; background: rgba(127,127,127,0.05); border-radius: 0 6px 6px 0; }
.markdown-body blockquote p { margin: 0.4em 0; }
.markdown-body blockquote p:first-child { margin-top: 0; }
.markdown-body blockquote p:last-child { margin-bottom: 0; }
.markdown-body table { border-collapse: separate; border-spacing: 0; width: 100%; margin: 1.2em 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; }
.markdown-body th, .markdown-body td { padding: 0.6em 1em; text-align: left; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; }
.markdown-body th:last-child, .markdown-body td:last-child { border-right: none; }
.markdown-body tr:last-child td { border-bottom: none; }
.markdown-body th { background: rgba(127,127,127,0.05); font-weight: 600; border-bottom: 2px solid #d1d5db; }
.markdown-body tr:nth-child(even) td { background: rgba(127,127,127,0.02); }
.markdown-body a { color: #2563eb; text-decoration: none; text-underline-offset: 2px; transition: color 0.15s ease; }
.markdown-body a:hover { color: #1d4ed8; text-decoration: underline; }
.markdown-body hr { border: none; height: 1px; background: linear-gradient(to right, transparent, #d1d5db, transparent); margin: 2.5em 0; }
.markdown-body img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.markdown-body li.task-list-item { list-style: none; position: relative; padding-left: 0.2em; }
.markdown-body li.task-list-item::before { display: none; }
.markdown-body li.task-list-item input[type="checkbox"] { position: absolute; left: -1.4em; top: 0.4em; width: 16px; height: 16px; appearance: none; -webkit-appearance: none; border: 1.5px solid #d1d5db; border-radius: 3px; background: #fff; cursor: pointer; transition: all 0.15s ease; }
.markdown-body li.task-list-item input[type="checkbox"]:checked { background: #3b82f6; border-color: #3b82f6; }
.markdown-body .mermaid-diagram { text-align: center; margin: 1.2em 0; padding: 1em; background: rgba(127,127,127,0.04); border-radius: 8px; border: 1px solid rgba(127,127,127,0.08); }
.markdown-body .mermaid-diagram svg { max-width: 100%; height: auto; }
.markdown-body .mermaid-error { color: #b91c1c; font-size: 0.9em; padding: 0.5em; }
.katex-display { margin: 1.2em 0; overflow-x: auto; padding: 0.5em 0; }

/* InkStone theme */
[data-theme="inkstone"] .markdown-body h3::before { background: #3b82f6; }

/* GitHub theme */
[data-theme="github"] { color: #1f2328; background: #ffffff; }
[data-theme="github"].dark, .dark[data-theme="github"], html[data-theme="github"].dark { color: #e6edf3; background: #0d1117; }
[data-theme="github"] .markdown-body h1, [data-theme="github"] .markdown-body h2 { border-bottom-color: #d1d9e0; }
[data-theme="github"].dark .markdown-body h1, [data-theme="github"].dark .markdown-body h2 { border-bottom-color: #3d444d; }
[data-theme="github"] .markdown-body h3::before { background: #0969da; }
[data-theme="github"].dark .markdown-body h3::before { background: #58a6ff; }
[data-theme="github"] .markdown-body code { background: #eff1f3; color: #1f2328; border-color: #d1d9e0; }
[data-theme="github"].dark .markdown-body code { background: #161b22; color: #e6edf3; border-color: #3d444d; }
[data-theme="github"] .markdown-body pre { background: #f6f8fa; border-color: #d1d9e0; }
[data-theme="github"].dark .markdown-body pre { background: #161b22; border-color: #3d444d; }
[data-theme="github"] .markdown-body blockquote { border-left-color: #d1d9e0; color: #59636e; background: #f6f8fa; }
[data-theme="github"].dark .markdown-body blockquote { border-left-color: #3d444d; color: #9198a1; background: #161b22; }
[data-theme="github"] .markdown-body th, [data-theme="github"] .markdown-body tr:nth-child(even) td { background: #f6f8fa; }
[data-theme="github"].dark .markdown-body th, [data-theme="github"].dark .markdown-body tr:nth-child(even) td { background: #161b22; }
[data-theme="github"] .markdown-body th, [data-theme="github"] .markdown-body td { border-color: #d1d9e0; }
[data-theme="github"].dark .markdown-body th, [data-theme="github"].dark .markdown-body td { border-color: #3d444d; }
[data-theme="github"] .markdown-body table { border-color: #d1d9e0; }
[data-theme="github"].dark .markdown-body table { border-color: #3d444d; }
[data-theme="github"] .markdown-body a { color: #0969da; }
[data-theme="github"].dark .markdown-body a { color: #58a6ff; }
[data-theme="github"] .markdown-body a:hover { color: #0550ae; }
[data-theme="github"].dark .markdown-body a:hover { color: #79c0ff; }
[data-theme="github"] .markdown-body hr { background: linear-gradient(to right, transparent, #d1d9e0, transparent); }
[data-theme="github"].dark .markdown-body hr { background: linear-gradient(to right, transparent, #3d444d, transparent); }
[data-theme="github"] .markdown-body ul > li::before { background: #59636e; }
[data-theme="github"].dark .markdown-body ul > li::before { background: #9198a1; }
[data-theme="github"] .markdown-body ul ul > li::before { border-color: #59636e; }
[data-theme="github"].dark .markdown-body ul ul > li::before { border-color: #9198a1; }
[data-theme="github"] .markdown-body ul ul ul > li::before { background: #59636e; }
[data-theme="github"].dark .markdown-body ul ul ul > li::before { background: #9198a1; }

/* One Dark theme */
[data-theme="onedark"] { color: #abb2bf; background: #282c34; font-family: 'Source Code Pro', 'Cascadia Code', 'Fira Code', Consolas, ui-monospace, monospace; }
[data-theme="onedark"] .markdown-body { line-height: 1.65; }
[data-theme="onedark"] .markdown-body h1, [data-theme="onedark"] .markdown-body h2 { border-bottom-color: #3e4452; color: #e5c07b; }
[data-theme="onedark"] .markdown-body h3, [data-theme="onedark"] .markdown-body h4, [data-theme="onedark"] .markdown-body h5, [data-theme="onedark"] .markdown-body h6 { color: #e5c07b; }
[data-theme="onedark"] .markdown-body h3::before { background: #e5c07b; }
[data-theme="onedark"] .markdown-body code { background: #3e4452; color: #e06c75; border-color: #4b5263; }
[data-theme="onedark"] .markdown-body pre { background: #21252b; color: #abb2bf; border-color: #3e4452; }
[data-theme="onedark"] .markdown-body pre code { color: #abb2bf; }
[data-theme="onedark"] .markdown-body blockquote { border-left-color: #3e4452; color: #7f848e; background: rgba(255,255,255,0.02); }
[data-theme="onedark"] .markdown-body th, [data-theme="onedark"] .markdown-body tr:nth-child(even) td { background: #21252b; }
[data-theme="onedark"] .markdown-body th, [data-theme="onedark"] .markdown-body td { border-color: #3e4452; }
[data-theme="onedark"] .markdown-body table { border-color: #3e4452; }
[data-theme="onedark"] .markdown-body a { color: #61afef; }
[data-theme="onedark"] .markdown-body a:hover { color: #90caf9; }
[data-theme="onedark"] .markdown-body hr { background: linear-gradient(to right, transparent, #3e4452, transparent); }
[data-theme="onedark"] .markdown-body ul > li::before { background: #7f848e; }
[data-theme="onedark"] .markdown-body ul ul > li::before { border-color: #7f848e; }
[data-theme="onedark"] .markdown-body ul ul ul > li::before { background: #7f848e; }
[data-theme="onedark"] .markdown-body .mermaid-diagram { background: #21252b; border-color: #3e4452; }

/* Typora theme */
[data-theme="typora"] { color: #2c2c2c; background: #ffffff; font-family: 'Source Serif Pro', 'Georgia', 'Cambria', 'Times New Roman', 'SimSun', 'Songti SC', serif; }
[data-theme="typora"].dark { color: #d0d0d0; background: #1f1f1f; font-family: 'Source Serif Pro', 'Georgia', 'Cambria', 'Times New Roman', 'SimSun', 'Songti SC', serif; }
[data-theme="typora"] .markdown-body { max-width: 760px; font-size: 1.05rem; line-height: 1.8; }
[data-theme="typora"] .markdown-body h1, [data-theme="typora"] .markdown-body h2, [data-theme="typora"] .markdown-body h3, [data-theme="typora"] .markdown-body h4, [data-theme="typora"] .markdown-body h5, [data-theme="typora"] .markdown-body h6 { font-family: inherit; color: #1a1a1a; font-weight: 700; }
[data-theme="typora"].dark .markdown-body h1, [data-theme="typora"].dark .markdown-body h2, [data-theme="typora"].dark .markdown-body h3, [data-theme="typora"].dark .markdown-body h4, [data-theme="typora"].dark .markdown-body h5, [data-theme="typora"].dark .markdown-body h6 { color: #f0f0f0; }
[data-theme="typora"] .markdown-body h1, [data-theme="typora"] .markdown-body h2 { border-bottom: 1px solid #ececec; }
[data-theme="typora"].dark .markdown-body h1, [data-theme="typora"].dark .markdown-body h2 { border-bottom-color: #2c2c2c; }
[data-theme="typora"] .markdown-body h3::before { background: #b3594a; width: 4px; border-radius: 2px; }
[data-theme="typora"].dark .markdown-body h3::before { background: #e8a292; }
[data-theme="typora"] .markdown-body code { background: #f4f0ec; color: #b3594a; font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace; border-color: #e8e2db; }
[data-theme="typora"].dark .markdown-body code { background: #2a2a2a; color: #e8a292; border-color: #3a3a3a; }
[data-theme="typora"] .markdown-body pre { background: #faf8f5; border: 1px solid #ececec; }
[data-theme="typora"].dark .markdown-body pre { background: #252525; border-color: #2c2c2c; }
[data-theme="typora"] .markdown-body blockquote { border-left-color: #c9c2b8; color: #777; font-style: italic; background: transparent; }
[data-theme="typora"].dark .markdown-body blockquote { border-left-color: #555; color: #aaa; background: transparent; }
[data-theme="typora"] .markdown-body th, [data-theme="typora"] .markdown-body tr:nth-child(even) td { background: #f4f0ec; }
[data-theme="typora"].dark .markdown-body th, [data-theme="typora"].dark .markdown-body tr:nth-child(even) td { background: #2a2a2a; }
[data-theme="typora"] .markdown-body th, [data-theme="typora"] .markdown-body td { border-color: #ececec; }
[data-theme="typora"].dark .markdown-body th, [data-theme="typora"].dark .markdown-body td { border-color: #2c2c2c; }
[data-theme="typora"] .markdown-body table { border-color: #ececec; }
[data-theme="typora"].dark .markdown-body table { border-color: #2c2c2c; }
[data-theme="typora"] .markdown-body a { color: #b3594a; }
[data-theme="typora"].dark .markdown-body a { color: #e8a292; }
[data-theme="typora"] .markdown-body a:hover { color: #924a3d; }
[data-theme="typora"].dark .markdown-body a:hover { color: #f0b8a8; }
[data-theme="typora"] .markdown-body hr { background: linear-gradient(to right, transparent, #d4cdc4, transparent); }
[data-theme="typora"].dark .markdown-body hr { background: linear-gradient(to right, transparent, #3a3a3a, transparent); }
[data-theme="typora"] .markdown-body ul > li::before { background: #8a827a; }
[data-theme="typora"].dark .markdown-body ul > li::before { background: #888; }
[data-theme="typora"] .markdown-body ul ul > li::before { border-color: #8a827a; }
[data-theme="typora"].dark .markdown-body ul ul > li::before { border-color: #888; }
[data-theme="typora"] .markdown-body ul ul ul > li::before { background: #8a827a; }
[data-theme="typora"].dark .markdown-body ul ul ul > li::before { background: #888; }
`;

export const PRINT_CSS = `
@page { size: A4; margin: 15mm; }
@media print {
  body { background: white !important; color: black !important; padding: 0 !important; }
  .toolbar, .tab-bar, .sidebar, .search-panel, .empty-state, .status-bar, .toolbar-tabs, .tab-icon-btn, .tab-item, .modal-overlay { display: none !important; }
  .preview-area, .editor-area { border: none !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
  .markdown-body { max-width: 100% !important; }
  .ink-image-toolbar, .ink-codeblock-toolbar, .ink-table-toolbar, .mermaid-diagram[data-code] { display: none !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  h1, h2, h3, h4, h5, h6 { page-break-after: avoid; break-after: avoid; }
  pre, blockquote, table, img, figure { page-break-inside: avoid; break-inside: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: inherit !important; text-decoration: none !important; }
  a[href]::after { content: "" !important; }
}
`;
