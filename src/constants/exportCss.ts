/**
 * 导出用 CSS。
 * 预览内容样式(.markdown-body)不再在此维护手工副本,
 * 而是由 App.vue 以 `?raw` 导入 src/assets/markdown-body.css 内联进产物,
 * 预览与导出永远同一份,不会漂移。
 * 本文件只保留导出文档的外壳样式与打印分页样式。
 */
export const EXPORT_SHELL_CSS = `
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
`;

export const PRINT_CSS = `
@page { size: A4; margin: 15mm; }
@media print {
  body { background: white !important; color: black !important; padding: 0 !important; }
  .modal-overlay { display: none !important; }
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
