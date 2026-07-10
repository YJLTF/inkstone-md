<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, h } from "vue";
import MarkdownIt from "markdown-it";
import mk from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import hljs from "highlight.js";
import katex from "katex";
import mermaid from "mermaid";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import katexCss from "katex/dist/katex.min.css?raw";
import hljsLightCss from "highlight.js/styles/github.css?raw";
import hljsDarkCss from "highlight.js/styles/github-dark.css?raw";
import mermaidJs from "mermaid/dist/mermaid.min.js?raw";

import type { FileEntry, Tab, Heading, ThemeName, ViewMode, ContextMenuState, RenamingState, DocumentAsset, ImageAlign, SidebarMode, ThemeOption } from './types';
import { isAbsolutePath, posixNormalize, slugify, escapeHtml, formatBytes, getFileName, getMimeFromExt, bytesToBase64, fetchAsDataUri } from './utils';
import ShortcutsModal from './components/ShortcutsModal.vue';
import AboutModal from './components/AboutModal.vue';
import PrintHint from './components/PrintHint.vue';
import TheStatusBar from './components/TheStatusBar.vue';
import SearchPanel from './components/SearchPanel.vue';
import TheTabBar from './components/TheTabBar.vue';
import TheToolbar from './components/TheToolbar.vue';
import EditorPane from './components/EditorPane.vue';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    // 用 <div class="line"> 把每行包起来,这样 CSS 能让行号与代码行一一对齐。
    const wrap = (s: string) =>
      s
        .split("\n")
        .map((line) => `<div class="line">${line || " "}</div>`)
        .join("");
    if (lang && hljs.getLanguage(lang)) {
      try {
        return wrap(hljs.highlight(str, { language: lang }).value);
      } catch {}
    }
    return wrap(str);
  },
});
md.use(mk, { enabled: true, label: true });
md.use(footnote);

const defaultContent = `# 欢迎使用 InkStone MD

> 简洁、高效的 Markdown 编辑器

## 特性

- **所见即所得** - 输入即渲染
- **实时预览** - 分栏同步查看
- **轻量级** - Tauri + Vue 构建

## 代码示例

\`\`\`javascript
function hello() {
  console.log("Hello, InkStone!");
}
\`\`\`

## 数学公式

行内公式: $E = mc^2$

块级公式:
$$
\\sum_{i=1}^n i = \\frac{n(n+1)}{2}
$$

## 任务列表

- [x] 安装 InkStone MD
- [ ] 写一篇文档
- [ ] 享受写作

---

**开始编辑吧！**
`;

let tabIdCounter = 1;
const tabs = ref<Tab[]>([{
  id: `tab-${tabIdCounter++}`,
  name: "未命名",
  path: null,
  content: defaultContent,
  saved: true,
}]);
const activeTabId = ref(tabs.value[0].id);

const showSidebar = ref(false);
const sidebarMode = ref<SidebarMode>('outline');
const sidebarWidth = ref(280); // 增加默认宽度以容纳按钮
const isResizing = ref(false);
const isDark = ref(localStorage.getItem('isDark') === 'true');
const THEME_OPTIONS: ThemeOption[] = [
  { value: "inkstone", label: "InkStone" },
  { value: "github", label: "GitHub" },
  { value: "onedark", label: "One Dark", forceDark: true },
  { value: "typora", label: "Typora" },
];
const themeName = ref<ThemeName>(
  (localStorage.getItem("themeName") as ThemeName) || "inkstone",
);
function setTheme(name: ThemeName) {
  themeName.value = name;
  localStorage.setItem("themeName", name);
  const opt = THEME_OPTIONS.find((o) => o.value === name);
  document.documentElement.setAttribute("data-theme", name);
  // onedark 等强制 dark 主题:自动切到 dark
  if (opt?.forceDark && !isDark.value) {
    isDark.value = true;
    document.documentElement.classList.add("dark");
    localStorage.setItem("isDark", "true");
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    });
    nextTick(() => renderMermaidDiagrams());
  }
}
const viewMode = ref<ViewMode>((localStorage.getItem('viewMode') as ViewMode) || 'split');
// 由 viewMode 派生的布尔值,保持模板/下游读取不变(只读,不可直接赋值)
const showSplit = computed(() => viewMode.value === 'split');
const showPreview = computed(() => viewMode.value === 'preview');
function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
  localStorage.setItem('viewMode', mode);
  // 切到分栏时对齐预览位置
  if (mode === 'split') nextTick(() => syncPreviewFromEditor());
}
const scrollSync = ref(localStorage.getItem('scrollSync') !== 'false');
let syncingFrom: 'editor' | 'preview' | null = null;
const activeHeadingIndex = ref(-1);

const workspacePath = ref<string | null>(null);
const fileTree = ref<FileEntry[]>([]);
const autoSaveInterval = ref<number | null>(null);

// 右键菜单状态
const contextMenu = ref<ContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  target: null,
  parentPath: null,
});

// 重命名状态
const renaming = ref<RenamingState>({
  active: false,
  path: '',
  originalName: '',
  input: '',
});

// 最近文件功能
const MAX_RECENT_FILES = 10;
const recentFiles = ref<string[]>([]);

function loadRecentFiles() {
  try {
    const saved = localStorage.getItem('recentFiles');
    if (saved) {
      recentFiles.value = JSON.parse(saved);
    }
  } catch {}
}

function saveRecentFiles() {
  localStorage.setItem('recentFiles', JSON.stringify(recentFiles.value));
}

function addToRecentFiles(path: string) {
  // 移除已存在的路径
  recentFiles.value = recentFiles.value.filter(p => p !== path);
  // 添加到最前面
  recentFiles.value.unshift(path);
  // 限制最大数量
  if (recentFiles.value.length > MAX_RECENT_FILES) {
    recentFiles.value = recentFiles.value.slice(0, MAX_RECENT_FILES);
  }
  saveRecentFiles();
}

function clearRecentFiles() {
  recentFiles.value = [];
  saveRecentFiles();
}

// 当前文档中引用的资源(图为主)列表

const assetExistsCache = new Map<string, boolean>();

const documentAssets = computed<DocumentAsset[]>(() => {
  if (!activeTab.value) return [];
  const content = activeTab.value.content;
  const seen = new Set<string>();
  const list: DocumentAsset[] = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const raw = m[1];
    if (seen.has(raw)) continue;
    seen.add(raw);
    const name = getFileName(raw.split("?")[0].split("#")[0]);
    const isRemote = /^(https?:|data:|blob:|tauri:|asset:)/i.test(raw);
    const filePath = activeTab.value.path;
    let resolved = raw;
    let relative = raw;
    if (!isRemote && filePath) {
      const dir = filePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
      if (isAbsolutePath(raw)) {
        resolved = posixNormalize(raw.replace(/\\/g, "/"));
        relative = raw;
      } else {
        resolved = posixNormalize(dir + "/" + raw);
        relative = raw;
      }
    }
    list.push({ raw, name, relative, resolved, exists: assetExistsCache.get(resolved) ?? true });
  }
  return list;
});

async function refreshAssetExists() {
  // 异步刷新:对每个本地资源 get_file_info 一次
  const next = new Map<string, boolean>();
  await Promise.all(
    documentAssets.value.map(async (a) => {
      if (/^(https?:|data:|blob:|tauri:|asset:)/i.test(a.raw)) {
        next.set(a.resolved, true);
        return;
      }
      try {
        await invoke("get_file_info", { path: a.resolved });
        next.set(a.resolved, true);
      } catch {
        next.set(a.resolved, false);
      }
    }),
  );
  assetExistsCache.clear();
  for (const [k, v] of next) assetExistsCache.set(k, v);
}

async function revealAsset(absPath: string) {
  try {
    await invoke("reveal_in_folder", { path: absPath });
  } catch (err) {
    alert("无法定位该资源: " + err);
  }
}

async function copyAssetPath(p: string) {
  try {
    await navigator.clipboard.writeText(p);
  } catch (err) {
    console.error("复制失败:", err);
  }
}

function removeAssetReference(raw: string) {
  if (!activeTab.value) return;
  // 删除所有 `![alt](raw)` 形式的整行(简单替换)
  const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`!\\[[^\\]]*\\]\\(${escaped}(?:\\s+"[^"]*")?\\)\\n?`, "g");
  activeTab.value.content = activeTab.value.content.replace(re, "");
  activeTab.value.saved = false;
}

// 把文档中所有 `![alt](oldRaw)` 形式的引用替换为 `![alt](newRaw)`
function replaceAssetRefInContent(oldRaw: string, newRaw: string) {
  if (!activeTab.value) return;
  const escaped = oldRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `!\\[([^\\]]*)\\]\\(${escaped}(?:\\s+"([^"]*)")?\\)`,
    "g",
  );
  activeTab.value.content = activeTab.value.content.replace(
    re,
    (_m, alt: string) => `![${alt}](${newRaw})`,
  );
  activeTab.value.saved = false;
}

function isRemoteAsset(raw: string): boolean {
  return /^(https?:|data:|blob:|tauri:|asset:)/i.test(raw);
}

function isInvalidName(name: string): boolean {
  return (
    name.includes("/") ||
    name.includes("\\") ||
    name.includes(":") ||
    name.includes("*") ||
    name.includes("?") ||
    name.includes('"') ||
    name.includes("<") ||
    name.includes(">") ||
    name.includes("|")
  );
}

async function renameAsset(asset: DocumentAsset) {
  if (isRemoteAsset(asset.raw)) {
    alert("远程资源不能重命名。");
    return;
  }
  const newName = window.prompt("重命名为(仅文件名):", asset.name);
  if (!newName || newName === asset.name) return;
  if (isInvalidName(newName)) {
    alert("文件名包含非法字符。");
    return;
  }
  const dir = asset.resolved.replace(/[\\/][^\\/]+$/, "").replace(/\\/g, "/");
  const newPath = `${dir}/${newName}`;
  try {
    await invoke("rename_path", { oldPath: asset.resolved, newPath });
    replaceAssetRefInContent(asset.raw, newName);
    if (workspacePath.value) await loadFileTree();
    await refreshAssetExists();
  } catch (err) {
    alert("重命名失败: " + err);
  }
}

async function moveAsset(asset: DocumentAsset) {
  if (isRemoteAsset(asset.raw)) {
    alert("远程资源不能移动。");
    return;
  }
  const target = await open({ directory: true, multiple: false });
  if (!target) return;
  const targetDir = (target as string).replace(/\\/g, "/").replace(/\/$/, "");
  const newPath = `${targetDir}/${asset.name}`;
  try {
    await invoke("rename_path", { oldPath: asset.resolved, newPath });
    // 新引用:尽量用相对路径,否则用绝对路径
    let newRaw = newPath;
    if (activeTab.value?.path) {
      const fileDir = activeTab.value.path
        .replace(/\\/g, "/")
        .replace(/[\\/][^\\/]+$/, "");
      if (fileDir === targetDir) {
        newRaw = `./${asset.name}`;
      }
    }
    replaceAssetRefInContent(asset.raw, newRaw);
    if (workspacePath.value) await loadFileTree();
    await refreshAssetExists();
  } catch (err) {
    alert("移动失败: " + err);
  }
}

async function getFileSize(p: string): Promise<number> {
  try {
    const info = await invoke<{ name: string; size: number }>("get_file_info", {
      path: p,
    });
    return info.size;
  } catch {
    return 0;
  }
}


async function compressAsset(asset: DocumentAsset) {
  if (isRemoteAsset(asset.raw)) {
    alert("远程资源不能压缩。");
    return;
  }
  const fmt = window.prompt("目标格式(输入 jpeg 或 png):", "jpeg");
  if (!fmt) return;
  const format = fmt.trim().toLowerCase();
  if (format !== "jpeg" && format !== "png") {
    alert("仅支持 jpeg / png。");
    return;
  }
  let quality = 80;
  if (format === "jpeg") {
    const q = window.prompt("JPEG 质量(1-100):", "80");
    if (q === null) return;
    const n = Number(q);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      alert("质量必须是 1-100 之间的数字。");
      return;
    }
    quality = Math.round(n);
  }
  const dir = asset.resolved.replace(/[\\/][^\\/]+$/, "").replace(/\\/g, "/");
  const base = asset.name.replace(/\.[^.]+$/, "");
  const ext = format === "jpeg" ? "jpg" : "png";
  const dest = `${dir}/${base}.min.${ext}`;
  const before = await getFileSize(asset.resolved);
  try {
    const afterSize = (await invoke<number>("compress_image", {
      src: asset.resolved,
      dest,
      format,
      quality,
    })) as number;
    const savedBytes = before - afterSize;
    const ok = window.confirm(
      `压缩完成!\n` +
        `原: ${formatBytes(before)}\n` +
        `新: ${formatBytes(afterSize)}\n` +
        `节省: ${formatBytes(savedBytes)} (${before > 0 ? Math.round((savedBytes / before) * 100) : 0}%)\n\n` +
        `是否替换原文件并更新文档引用?`,
    );
    if (!ok) {
      // 不替换,清理临时文件
      try {
        await invoke("delete_path", { path: dest });
      } catch {}
      return;
    }
    // 删除原文件,把新文件 rename 成原名
    await invoke("delete_path", { path: asset.resolved });
    const finalName = `${base}.${ext}`;
    const finalPath = `${dir}/${finalName}`;
    await invoke("rename_path", { oldPath: dest, newPath: finalPath });
    // 更新引用:用最终文件名(同目录 → 相对名,否则用绝对路径)
    let newRaw = finalName;
    if (activeTab.value?.path) {
      const fileDir = activeTab.value.path
        .replace(/\\/g, "/")
        .replace(/[\\/][^\\/]+$/, "");
      if (fileDir !== dir) newRaw = finalPath;
    }
    replaceAssetRefInContent(asset.raw, newRaw);
    if (workspacePath.value) await loadFileTree();
    await refreshAssetExists();
  } catch (err) {
    alert("压缩失败: " + err);
  }
}


// 拖拽状态
const isDragging = ref(false);
const dragCounter = ref(0);

// 快捷键 / 关于对话框
const showShortcutsModal = ref(false);
const showAboutModal = ref(false);
const appVersion = __APP_VERSION__;

// 快捷键清单(单一数据源,对话框与 README 共同参考)
const SHORTCUTS: { group: string; key: string; desc: string }[] = [
  { group: '文件', key: 'Ctrl+N', desc: '新建文件' },
  { group: '文件', key: 'Ctrl+O', desc: '打开文件' },
  { group: '文件', key: 'Ctrl+S', desc: '保存文件' },
  { group: '文件', key: 'Ctrl+Shift+S', desc: '另存为' },
  { group: '编辑', key: 'Ctrl+F', desc: '搜索替换' },
  { group: '编辑', key: 'Ctrl+Z / Ctrl+Y', desc: '撤销 / 重做' },
  { group: '视图', key: 'Ctrl+B', desc: '切换侧边栏' },
  { group: '视图', key: 'Ctrl+\\', desc: '循环切换 编辑/分栏/预览' },
  { group: '视图', key: 'F7', desc: '切换滚动同步' },
  { group: '帮助', key: 'F1', desc: '快捷键说明' },
  { group: '其他', key: 'Esc', desc: '关闭搜索/对话框' },
];

// 搜索功能状态
const showSearch = ref(false);
const searchQuery = ref("");
const replaceQuery = ref("");
const searchMatches = ref<{ index: number; length: number }[]>([]);
const currentMatchIndex = ref(-1);

// 简单的文件树渲染函数
function renderFileTree(entries: FileEntry[], depth: number = 0): any[] {
  return entries.map(entry => {
    const paddingLeft = depth * 16 + 8;
    const children = entry.is_dir && entry.is_open && entry.children
      ? renderFileTree(entry.children, depth + 1)
      : [];

    // 获取文件所在的目录路径，使用正斜杠
    const normalizedPath = entry.path.replace(/\\/g, '/');
    const entryDirPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));

    // 检查是否是当前重命名的目标
    const isRenamingTarget = renaming.value.active && renaming.value.path === entry.path;

    return h('div', { key: entry.path }, [
      h('div', {
        class: 'flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 text-sm',
        style: { paddingLeft: paddingLeft + 'px' },
        onClick: () => {
          if (isRenamingTarget) return;
          if (entry.is_dir) {
            entry.is_open = !entry.is_open;
          } else {
            openFile(entry.path);
          }
        },
        onContextmenu: (e: MouseEvent) => {
          showContextMenu(e, entry, entryDirPath);
        }
      }, [
        h('span', {}, entry.is_dir ? (entry.is_open ? '📂' : '📁') : '📄'),
        isRenamingTarget
          ? h('input', {
            class: 'rename-input px-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200',
            style: 'width: auto; flex: 1;',
            value: renaming.value.input,
            onInput: (e: Event) => {
              renaming.value.input = (e.target as HTMLInputElement).value;
            },
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                confirmRename();
              } else if (e.key === 'Escape') {
                cancelRename();
              }
            },
            onClick: (e: Event) => {
              e.stopPropagation();
            },
            onBlur: () => {
              // 失去焦点时自动确认重命名
              if (renaming.value.active) {
                confirmRename();
              }
            }
          })
          : h('span', { class: 'truncate' }, entry.name)
      ]),
      ...children
    ]);
  });
}

// 选中文本统计
const selectedCount = ref(0);

// ---- 图片路径预处理 / 工具栏包装 ----

const IMAGE_SCALES = [25, 50, 75, 100] as const;


function toTauriAssetUrl(src: string, currentFilePath: string | null): string {
  if (/^(https?:|data:|blob:|tauri:|asset:)/i.test(src)) return src;
  let abs: string;
  if (isAbsolutePath(src)) {
    abs = posixNormalize(src.replace(/\\/g, "/"));
  } else {
    if (!currentFilePath) return src;
    const dir = currentFilePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    abs = posixNormalize(dir + "/" + src);
  }
  try {
    return convertFileSrc(abs);
  } catch {
    return src;
  }
}

/**
 * 在 markdown-it 渲染前,把图片语法里的本地 src 改写为 tauri 资源 URL,
 * 让 webview 通过 assetProtocol 正确加载本地图片。
 * 规则:
 *   - http(s)/data/blob/tauri/asset: 原样保留
 *   - Windows 绝对路径 (C:\...) / UNC / 类 Unix 绝对路径: 规范化后 convertFileSrc
 *   - 相对路径: 相对当前 tab 文件所在目录,convertFileSrc
 *   - 文件未保存: 保留原 src(后续保存后再打开会失效,但不破坏编辑)
 */
function preprocessImageSrcs(content: string, currentFilePath: string | null): string {
  return content.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (m, alt: string, src: string, _title?: string) => {
      const newSrc = toTauriAssetUrl(src, currentFilePath);
      if (newSrc === src) return m;
      return `![${alt}](${newSrc})`;
    },
  );
}

/**
 * 将文本中出现的 `[[toc]]` 标记替换为基于 `headings` 渲染出的目录 HTML。
 * `markdown-it` 配 `html: true` 会把 inline HTML 原样保留,所以我们直接在源字符串
 * 上做替换,然后交给 markdown-it 渲染,这样目录内含的 <ul> 不会被解析成 markdown。
 */
function preprocessToc(content: string, heads: Heading[]): string {
  if (!content.includes('[[toc]]')) return content;
  if (heads.length === 0) {
    return content.replace(/\[\[toc\]\]/g, '<p class="ink-toc-empty">暂无标题</p>');
  }
  const buildList = (idx: number, minLevel: number): { html: string; next: number } => {
    let out = '<ul>';
    while (idx < heads.length) {
      const h = heads[idx];
      if (h.level < minLevel) break;
      if (h.level > minLevel) {
        const sub = buildList(idx, h.level);
        out += `<li>${sub.html}`;
        idx = sub.next;
        out += '</li>';
        continue;
      }
      const anchor = slugify(h.text);
      out += `<li><a href="#${anchor}">${escapeHtml(h.text)}</a></li>`;
      idx++;
    }
    out += '</ul>';
    return { html: out, next: idx };
  };
  const { html } = buildList(0, heads[0].level);
  return content.replace(
    /\[\[toc\]\]/g,
    `<nav class="ink-toc"><div class="ink-toc-title">目录</div>${html}</nav>`,
  );
}


function addHeadingIds(html: string, heads: Heading[]): string {
  const used = new Map<string, number>();
  const slugList = heads.map((h) => {
    const base = slugify(h.text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
  let idx = 0;
  return html.replace(/<h([1-6])>/g, (_m, level) => {
    if (idx >= slugList.length) return `<h${level}>`;
    const id = slugList[idx++];
    return `<h${level} id="${id}" class="ink-heading">`;
  });
}

/**
 * 把渲染后的 <img> 包成可交互结构:
 *   <span class="ink-image-wrap" data-scale="100" data-align="center">
 *     <img src="..." data-original="..." />
 *     <span class="ink-image-toolbar"> ... 缩放/对齐 按钮 ... </span>
 *   </span>
 * 不写回 markdown,仅控制显示。
 */

/**
 * 用 markdown-it 解析 content,提取每个表格在源 markdown 中的字符 offset 区间,
 * 用于表格编辑"保存到源"功能定位原段。
 * `token.map = [startLine, endLine]` 0-indexed 半开区间,lineToOffset 把行号转为字符 offset。
 */
function findTableRanges(content: string): { start: number; end: number; md: string }[] {
  let tokens: any[] = [];
  try {
    tokens = md.parse(content, {});
  } catch {
    return [];
  }
  const lines = content.split("\n");
  const lineToOffset = (line0: number) => {
    let off = 0;
    for (let l = 0; l < line0 && l < lines.length; l++) off += lines[l].length + 1;
    return off;
  };
  const ranges: { start: number; end: number; md: string }[] = [];
  for (const t of tokens) {
    if (t.type === "table_open" && t.map) {
      const [sLine, eLine] = t.map as [number, number];
      const start = lineToOffset(sLine);
      const end = lineToOffset(eLine);
      ranges.push({ start, end, md: content.slice(start, end) });
    }
  }
  return ranges;
}
function wrapImagesForInteraction(html: string): string {
  return html.replace(/<img\s+([^>]*?)\/?>/g, (m, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) return m;
    const src = srcMatch[1];
    // 跳过 base64 / data / 已经在 asset 协议里的(可选)
    return (
      `<span class="ink-image-wrap" data-scale="100" data-align="center">` +
        `<img ${attrs} data-original="${src.replace(/"/g, "&quot;")}" />` +
        `<span class="ink-image-toolbar" contenteditable="false">` +
          `<button type="button" data-act="zoom-out" title="缩小">−</button>` +
          `<span class="ink-image-scale">100%</span>` +
          `<button type="button" data-act="zoom-in" title="放大">+</button>` +
          `<span class="ink-image-sep"></span>` +
          `<button type="button" data-act="align-left" title="左对齐">⫷</button>` +
          `<button type="button" data-act="align-center" title="居中">≡</button>` +
          `<button type="button" data-act="align-right" title="右对齐">⫸</button>` +
        `</span>` +
      `</span>`
    );
  });
}

/**
 * 把 markdown-it 渲染出的 `<pre><code class="language-xxx">…</code></pre>`
 * 包成 `<div class="ink-codeblock">` 并附加语言标签 + 复制按钮。
 * 行号这一版不做(留给后续版本),只做复制 + 语言徽标。
 */
function wrapCodeBlocks(html: string): string {
  return html.replace(
    /<pre>\s*<code(?:\s+class="([^"]*)")?\s*>([\s\S]*?)<\/code>\s*<\/pre>/g,
    (_m, cls: string | undefined, inner: string) => {
      const langMatch = (cls || "").match(/language-([^\s"]+)/);
      const lang = langMatch ? langMatch[1] : "";
      const lineMatches = inner.match(/<div class="line">/g) || [];
      const lineCount = Math.max(lineMatches.length, 1);
      const nums = Array.from({ length: lineCount }, (_, i) => `<li>${i + 1}</li>`).join("");
      return (
        `<div class="ink-codeblock" data-lang="${lang}">` +
          `<div class="ink-codeblock-toolbar">` +
            `<span class="ink-codeblock-lang">${lang || "text"}</span>` +
            `<button type="button" class="ink-codeblock-copy" data-act="copy-code">复制</button>` +
          `</div>` +
          `<div class="ink-codeblock-body">` +
            `<pre class="${cls ? (cls.includes("hljs") ? "hljs" : "") : ""}">` +
              `<ol class="ink-line-nums">${nums}</ol>` +
              `<code${cls ? ` class="${cls}"` : ""}>${inner}</code>` +
            `</pre>` +
          `</div>` +
        `</div>`
      );
    },
  );
}

function bindCodeToolbar(root: HTMLElement) {
  if ((root as any)._inkCodeBound) return;
  (root as any)._inkCodeBound = true;
  root.addEventListener("click", async (e: Event) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".ink-codeblock-copy");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const block = btn.closest(".ink-codeblock");
    if (!block) return;
    const code = block.querySelector("code") as HTMLElement | null;
    if (!code) return;
    const text = code.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      const orig = btn.textContent;
      btn.textContent = "已复制";
      btn.classList.add("copied");
      window.setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove("copied");
      }, 1500);
    } catch (err) {
      console.error("复制失败:", err);
      btn.textContent = "复制失败";
    }
  });
}

/**
 * 把渲染出的 `<table>` 包成 `<div class="ink-table">` 并附加工具栏。
 * 支持:
 *   - + 行 / - 行 / + 列 / - 列:直接改 DOM
 *   - 编辑模式:切换 td/th 的 contenteditable
 *   - 复制为 Markdown:把当前 DOM 表转回 md 字符串,写入剪贴板
 *   - 保存到源:把 DOM 表转 md,在源 markdown 中匹配 data-source-md 精确定位并替换
 * `tableRanges` 由 `findTableRanges(content)` 提供,顺序与渲染出的 <table> 一一对应。
 */
function wrapTablesForEdit(
  html: string,
  tableRanges: { start: number; end: number; md: string }[],
): string {
  let idx = 0;
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (_m, inner: string) => {
    const r = tableRanges[idx++];
    const dataMd = r ? ` data-source-md="${encodeURIComponent(r.md)}"` : "";
    return (
      `<div class="ink-table" data-edit="false"${dataMd}>` +
        `<div class="ink-table-toolbar">` +
          `<button type="button" data-act="t-edit">✏️ 编辑</button>` +
          `<button type="button" data-act="t-add-row">+ 行</button>` +
          `<button type="button" data-act="t-del-row">- 行</button>` +
          `<button type="button" data-act="t-add-col">+ 列</button>` +
          `<button type="button" data-act="t-del-col">- 列</button>` +
          `<button type="button" data-act="t-save">💾 保存到源</button>` +
          `<button type="button" data-act="t-copy-md">复制为 Markdown</button>` +
        `</div>` +
        `<table>${inner}</table>` +
      `</div>`
    );
  });
}

function tableToMarkdown(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return "";
  const matrix: string[][] = rows.map((tr) =>
    Array.from(tr.querySelectorAll("th,td")).map(
      (c) => (c.textContent ?? "").replace(/\|/g, "\\|").trim(),
    ),
  );
  // 估算列数
  const colCount = Math.max(...matrix.map((r) => r.length));
  for (const r of matrix) {
    while (r.length < colCount) r.push("");
  }
  const out: string[] = [];
  out.push("| " + matrix[0].join(" | ") + " |");
  out.push("| " + matrix[0].map(() => "---").join(" | ") + " |");
  for (let i = 1; i < matrix.length; i++) {
    out.push("| " + matrix[i].join(" | ") + " |");
  }
  return out.join("\n");
}

function bindTableToolbar(root: HTMLElement) {
  if ((root as any)._inkTableBound) return;
  (root as any)._inkTableBound = true;
  root.addEventListener("click", async (e: Event) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>(".ink-table-toolbar button[data-act]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = btn.closest<HTMLElement>(".ink-table");
    if (!wrap) return;
    const table = wrap.querySelector("table") as HTMLTableElement | null;
    if (!table) return;
    const act = btn.dataset.act;
    if (act === "t-edit") {
      const editing = wrap.dataset.edit === "true";
      wrap.dataset.edit = String(!editing);
      btn.textContent = editing ? "✏️ 编辑" : "✓ 完成编辑";
      const cells = table.querySelectorAll<HTMLElement>("th, td");
      cells.forEach((c) => {
        if (!editing) c.setAttribute("contenteditable", "true");
        else c.removeAttribute("contenteditable");
      });
      return;
    }
    if (act === "t-add-row") {
      const rows = table.querySelectorAll("tr");
      if (rows.length === 0) return;
      const ref = rows[rows.length - 1];
      const cols = ref.querySelectorAll("th,td").length || 1;
      const newRow = document.createElement("tr");
      for (let i = 0; i < cols; i++) {
        const cell = document.createElement("td");
        cell.textContent = " ";
        newRow.appendChild(cell);
      }
      table.appendChild(newRow);
      return;
    }
    if (act === "t-del-row") {
      const rows = table.querySelectorAll("tr");
      if (rows.length <= 1) return;
      table.deleteRow(-1);
      return;
    }
    if (act === "t-add-col") {
      const rows = Array.from(table.querySelectorAll("tr"));
      rows.forEach((tr, idx) => {
        const cell = document.createElement(idx === 0 ? "th" : "td");
        cell.textContent = " ";
        tr.appendChild(cell);
      });
      return;
    }
    if (act === "t-del-col") {
      const rows = Array.from(table.querySelectorAll("tr"));
      rows.forEach((tr) => {
        const cells = tr.querySelectorAll("th,td");
        if (cells.length > 1) tr.removeChild(cells[cells.length - 1]);
      });
      return;
    }
    if (act === "t-copy-md") {
      const md = tableToMarkdown(table);
      try {
        await navigator.clipboard.writeText(md);
        const orig = btn.textContent;
        btn.textContent = "已复制";
        btn.classList.add("copied");
        window.setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove("copied");
        }, 1500);
      } catch (err) {
        console.error("复制失败:", err);
        btn.textContent = "复制失败";
      }
      return;
    }
    if (act === "t-save") {
      const srcMd = decodeURIComponent(wrap.dataset.sourceMd || "");
      if (!activeTab.value) return;
      if (!srcMd) {
        alert("此表格未携带源 markdown 信息,无法回写。");
        return;
      }
      const ranges = findTableRanges(activeTab.value.content);
      const r = ranges.find((x) => x.md === srcMd);
      if (!r) {
        alert(
          "无法定位原表格段:可能文档结构已变更。请先保存当前表格,然后再编辑其他部分。",
        );
        return;
      }
      const newMd = tableToMarkdown(table);
      activeTab.value.content =
        activeTab.value.content.slice(0, r.start) +
        newMd +
        "\n" +
        activeTab.value.content.slice(r.end);
      activeTab.value.saved = false;
      const orig = btn.textContent;
      btn.textContent = "✓ 已保存";
      btn.classList.add("copied");
      window.setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove("copied");
      }, 1500);
    }
  });
}

function applyImageTransforms(root: HTMLElement) {
  const wraps = root.querySelectorAll<HTMLElement>(".ink-image-wrap");
  wraps.forEach((wrap) => {
    const img = wrap.querySelector("img") as HTMLImageElement | null;
    if (!img) return;
    const scale = Number(wrap.dataset.scale || "100") / 100;
    img.style.width = `${scale * 100}%`;
    img.style.height = "auto";
    img.style.display = "block";
    img.style.maxWidth = "none";
    img.style.borderRadius = "4px";
    const align = wrap.dataset.align as ImageAlign | undefined;
    wrap.style.display = "block";
    wrap.style.textAlign = align === "left" ? "left" : align === "right" ? "right" : "center";
    const scaleLabel = wrap.querySelector(".ink-image-scale");
    if (scaleLabel) scaleLabel.textContent = `${Math.round(scale * 100)}%`;
  });
}

function bindImageToolbar(root: HTMLElement) {
  if ((root as any)._inkImageToolbarBound) return;
  (root as any)._inkImageToolbarBound = true;
  root.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>(".ink-image-toolbar button[data-act]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = btn.closest<HTMLElement>(".ink-image-wrap");
    if (!wrap) return;
    const act = btn.dataset.act;
    let scale = Number(wrap.dataset.scale || "100");
    let align = (wrap.dataset.align as ImageAlign) || "center";
    if (act === "zoom-in") {
      const idx = IMAGE_SCALES.findIndex((v) => v > scale);
      scale = idx === -1 ? IMAGE_SCALES[IMAGE_SCALES.length - 1] : IMAGE_SCALES[idx];
    } else if (act === "zoom-out") {
      const smaller = IMAGE_SCALES.filter((v) => v < scale);
      scale = smaller.length ? smaller[smaller.length - 1] : IMAGE_SCALES[0];
    } else if (act === "align-left") align = "left";
    else if (act === "align-center") align = "center";
    else if (act === "align-right") align = "right";
    wrap.dataset.scale = String(scale);
    wrap.dataset.align = align;
    applyImageTransforms(root);
  });
}

/**
 * 解析 markdown 中 [[toc]] 形式的占位时,生成的 <a href="#slug"> 在预览中点击应滚动
 * 到对应 heading。由于 markdown-it 默认不会给 heading 加 id,我们这里用最简实现:
 * 点击 a 时,在 markdown 源中找到对应文本的 heading 行号,然后用现有的 jumpToHeading 跳转。
 */
function bindTocNavigation(root: HTMLElement) {
  if ((root as any)._inkTocBound) return;
  (root as any)._inkTocBound = true;
  root.addEventListener("click", (e: Event) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(".ink-toc a[href^='#']");
    if (!a) return;
    e.preventDefault();
    const hash = decodeURIComponent(a.getAttribute("href")!.slice(1));
    if (!activeTab.value) return;
    const lines = activeTab.value.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^#{1,6}\s+(.+?)\s*$/);
      if (m && slugify(m[1]) === hash) {
        jumpToHeading(i + 1);
        return;
      }
    }
  });
}

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value));

const charCount = computed(() => activeTab.value?.content.length ?? 0);
const wordCount = computed(() => {
  const text = activeTab.value?.content.trim() ?? "";
  if (!text) return 0;
  return text.split(/\s+/).length;
});

const headings = computed(() => {
  if (!activeTab.value) return [];
  const content = activeTab.value.content;
  const result: Heading[] = [];
  const regex = /^#{1,6}\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    const level = match[0].indexOf(' ') - 1;
    result.push({ level, text: match[1].trim(), line });
  }
  return result;
});

const renderedHTML = computed(() => {
  if (!activeTab.value) return "";
  const pre1 = preprocessImageSrcs(activeTab.value.content, activeTab.value.path);
  const pre2 = preprocessToc(pre1, headings.value);
  let html = md.render(pre2);

  html = addHeadingIds(html, headings.value);

  // 先处理块级公式（多行 $...$）
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      const cleanTex = tex.trim();
      return `<div class="katex-display">${katex.renderToString(cleanTex, { throwOnError: false, displayMode: true })}</div>`;
    } catch {
      return `<div class="katex-error">${tex}</div>`;
    }
  });

  // 再处理行内公式（单行 $...$）
  html = html.replace(/\$([^$\n]+)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, { throwOnError: false });
    } catch {
      return tex;
    }
  });

  // Replace mermaid code blocks with placeholder divs
  html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (_, code) => {
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    const decoded = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    return `<div class="mermaid-diagram" data-id="${id}" data-code="${encodeURIComponent(decoded)}"></div>`;
  });

  // 包装 <img> 为可交互元素
  html = wrapImagesForInteraction(html);
  html = wrapCodeBlocks(html);
  // 表格回写需要在原 markdown 字符级别定位,把每个 table 的源段挂到 div 上
  const tableRanges = findTableRanges(pre2);
  html = wrapTablesForEdit(html, tableRanges);
  return html;
});

// Render mermaid diagrams in the preview
async function renderMermaidDiagrams() {
  try {
    const containers = document.querySelectorAll('.mermaid-diagram');
    for (const container of containers) {
      const code = decodeURIComponent(container.getAttribute('data-code') || '');
      const id = container.getAttribute('data-id') || '';
      if (code && id) {
        try {
          const { svg } = await mermaid.render(`svg-${id}`, code);
          container.innerHTML = svg;
        } catch (e) {
          container.innerHTML = `<pre class="mermaid-error">${code}</pre><p class="text-red-500 text-sm">渲染错误: ${e}</p>`;
        }
      }
    }
  } catch {}
}

// Watch for HTML changes to render mermaid diagrams
watch(renderedHTML, () => {
  nextTick(() => {
    renderMermaidDiagrams();
    // 给所有预览区绑定图片工具栏 / TOC 跳转
    document.querySelectorAll<HTMLElement>(".preview-area .markdown-body").forEach((root) => {
      applyImageTransforms(root);
      bindImageToolbar(root);
      bindTocNavigation(root);
      bindCodeToolbar(root);
      bindTableToolbar(root);
    });
  });
});

const windowTitle = computed(() => {
  if (!activeTab.value) return "InkStone MD";
  const name = activeTab.value.name;
  return `InkStone MD - ${name}${activeTab.value.saved ? "" : " *"}`;
});

async function setWindowTitle(title: string) {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.setTitle(title);
  } catch {}
}

watch(windowTitle, (title) => {
  setWindowTitle(title);
});

// 搜索词变化时重新搜索
watch(searchQuery, () => {
  performSearch();
});

// 活动标签变化时清除搜索高亮
watch(activeTabId, () => {
  searchMatches.value = [];
  currentMatchIndex.value = -1;
});

// 当前 tab 内容 / 资源视图激活时,刷新"资源是否存在"缓存
watch(
  [activeTabId, () => sidebarMode.value === "assets" ? sidebarMode.value : ""],
  () => {
    if (sidebarMode.value === "assets") refreshAssetExists();
  },
  { immediate: false },
);

// 自动配对配置
const pairConfig: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
  '*': '*',
  '_': '_',
  '~': '~',
};

function handleKeydown(e: KeyboardEvent) {
  const textarea = e.target as HTMLTextAreaElement;
  if (!textarea || !activeTab.value) return;

  const key = e.key;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const content = activeTab.value.content;

  // 处理 Backspace：删除配对符号
  if (key === 'Backspace') {
    const prevChar = content[start - 1];
    const nextChar = content[start];
    for (const [open, close] of Object.entries(pairConfig)) {
      if (prevChar === open && nextChar === close) {
        e.preventDefault();
        activeTab.value.content = content.slice(0, start - 1) + content.slice(start + 1);
        nextTick(() => {
          textarea.focus();
          textarea.setSelectionRange(start - 1, start - 1);

        });
        return;
      }
    }
    return;
  }

  // 处理配对符号输入
  if (key in pairConfig) {
    const open = key;
    const close = pairConfig[open];
    const selected = start !== end ? content.slice(start, end) : '';

    // 输入左符号：自动插入右符号，光标放中间
    // 检查 key 是否是左括号（开符号）
    const isOpenBracket = !(key === ')' || key === ']' || key === '}' || key === '"' || key === "'" || key === '`');
    if (isOpenBracket) {
      e.preventDefault();
      let newContent: string;
      let newCursorPos: number;

      if (selected) {
        newContent = content.slice(0, start) + open + selected + close + content.slice(end);
        newCursorPos = start + open.length + selected.length + close.length;
      } else {
        newContent = content.slice(0, start) + open + close + content.slice(end);
        newCursorPos = start + open.length;
      }

      activeTab.value.content = newContent;
      activeTab.value.saved = false;

      nextTick(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);

      });
      return;
    }

    // 输入右符号：如果前面是配对符号则跳过
    const isCloseBracket = key === ')' || key === ']' || key === '}' || key === '"' || key === "'" || key === '`';
    if (isCloseBracket) {
      const prevChar = content[start - 1];
      let isPaired = false;
      for (const [openChar, closeChar] of Object.entries(pairConfig)) {
        if (key === closeChar && prevChar === openChar) {
          isPaired = true;
          break;
        }
      }

      if (isPaired) {
        e.preventDefault();
        nextTick(() => {
          textarea.focus();
          textarea.setSelectionRange(start + 1, start + 1);

        });
        return;
      }
    }
    return;
  }

  // 处理 Enter：在配对符号内自动缩进
  if (key === 'Enter') {
    const prevChar = content[start - 1];
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const currentLine = content.slice(lineStart, start);

    // 列表：自动添加下一项
    if (currentLine.match(/^(\s*)([-*+]|\d+\.)\s/)) {
      e.preventDefault();
      const match = currentLine.match(/^(\s*)([-*+]|\d+\.)\s/);
      if (match) {
        const prefix = match[1] + match[2] + ' ';
        let newContent: string;
        let newCursorPos: number;

        if (prevChar === '\n' || start === 0) {
          newContent = content.slice(0, start) + prefix + content.slice(start);
          newCursorPos = start + prefix.length;
        } else {
          newContent = content.slice(0, start) + '\n' + prefix + content.slice(start);
          newCursorPos = start + prefix.length + 1;
        }

        activeTab.value.content = newContent;
        activeTab.value.saved = false;

        nextTick(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);

        });
        return;
      }
    }

    // 引用块 >
    if (currentLine.match(/^>\s/)) {
      e.preventDefault();
      const match = currentLine.match(/^(\s*)(>\s*)/);
      if (match) {
        const prefix = match[1] + '> ';
        let newContent: string;
        let newCursorPos: number;

        if (prevChar === '\n' || start === 0) {
          newContent = content.slice(0, start) + prefix + content.slice(start);
          newCursorPos = start + prefix.length;
        } else {
          newContent = content.slice(0, start) + '\n' + prefix + content.slice(start);
          newCursorPos = start + prefix.length + 1;
        }

        activeTab.value.content = newContent;
        activeTab.value.saved = false;

        nextTick(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);

        });
        return;
      }
    }
    return;
  }

  // Tab 键：表格跳单元格，有序列表继续编号
  if (key === 'Tab') {
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const currentLine = content.slice(lineStart, start);

    // 表格：按 Tab 跳到下一个单元格
    if (currentLine.includes('|')) {
      e.preventDefault();
      const pipePos = content.indexOf('|', start);
      if (pipePos !== -1) {
        nextTick(() => {
          textarea.focus();
          textarea.setSelectionRange(pipePos + 1, pipePos + 1);

        });
      }
      return;
    }

    // 有序列表：按 Tab 继续编号
    if (currentLine.match(/^\d+\.\s/)) {
      e.preventDefault();
      const match = currentLine.match(/^(\s*)(\d+)(\.\s)/);
      if (match) {
        const num = parseInt(match[2]) + 1;
        const prefix = match[1] + num + match[3];
        const newContent = content.slice(0, lineStart) + prefix + content.slice(start);
        activeTab.value.content = newContent;
        activeTab.value.saved = false;

        nextTick(() => {
          textarea.focus();
          textarea.setSelectionRange(start + prefix.length - match[0].length + 1, start + prefix.length - match[0].length + 1);

        });
      }
      return;
    }
    return;
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement;
  if (activeTab.value) {
    activeTab.value.content = target.value;
    activeTab.value.saved = false;
  }
}

function setActiveTab(tabId: string) {
  activeTabId.value = tabId;
  nextTick(() => {
    const textarea = document.querySelector('.editor-input') as HTMLTextAreaElement;
    if (textarea) textarea.focus();
  });
}

function closeTab(tabId: string, e?: Event) {
  e?.stopPropagation();
  const tab = tabs.value.find(t => t.id === tabId);
  if (!tab) return;

  if (!tab.saved) {
    const confirmed = window.confirm(`${tab.name} 未保存，是否关闭？`);
    if (!confirmed) return;
  }

  const index = tabs.value.findIndex(t => t.id === tabId);
  tabs.value = tabs.value.filter(t => t.id !== tabId);

  if (tabs.value.length === 0) {
    tabs.value = [{
      id: `tab-${tabIdCounter++}`,
      name: "未命名",
      path: null,
      content: "",
      saved: true,
    }];
  }

  if (activeTabId.value === tabId) {
    activeTabId.value = tabs.value[Math.min(index, tabs.value.length - 1)].id;
  }
}

function createNewTab(path: string | null = null, content: string = "") {
  const name = path ? path.split(/[/\\]/).pop() ?? "未命名" : "未命名";
  const newTab: Tab = {
    id: `tab-${tabIdCounter++}`,
    name,
    path,
    content: content || "",
    saved: true,
  };
  tabs.value.push(newTab);
  activeTabId.value = newTab.id;
  return newTab;
}

async function openFile(filePath?: string) {
  try {
    let path = filePath;
    if (!path) {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
      });
      if (!selected) return;
      path = selected as string;
    }

    const existingTab = tabs.value.find(t => t.path === path);
    if (existingTab) {
      activeTabId.value = existingTab.id;
      return;
    }

    const text = await invoke<string>("read_file", { path });
    createNewTab(path, text);
    addToRecentFiles(path);
  } catch (err) {
    console.error("打开文件失败:", err);
  }
}

async function openFolder() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected) {
      workspacePath.value = selected as string;
      showSidebar.value = true;
      await loadFileTree();
    }
  } catch (err) {
    console.error("打开文件夹失败:", err);
  }
}

async function loadFileTree() {
  if (!workspacePath.value) return;
  try {
    fileTree.value = await invoke<FileEntry[]>("read_directory", { path: workspacePath.value });
  } catch (err) {
    console.error("读取目录失败:", err);
  }
}

// 右键菜单处理
function showContextMenu(event: MouseEvent, entry: FileEntry | null, parentPath: string) {
  event.preventDefault();
  event.stopPropagation();

  // 计算菜单位置，防止超出屏幕边界
  const menuWidth = 150; // 估计菜单宽度
  const menuHeight = 150; // 估计菜单高度
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  let x = event.clientX;
  let y = event.clientY;

  // 如果右侧空间不足，向左显示
  if (x + menuWidth > windowWidth) {
    x = windowWidth - menuWidth - 10;
  }

  // 如果下方空间不足，向上显示
  if (y + menuHeight > windowHeight) {
    y = windowHeight - menuHeight - 10;
  }

  contextMenu.value = {
    visible: true,
    x: Math.max(10, x),
    y: Math.max(10, y),
    target: entry,
    parentPath: parentPath,
  };
}

function showContextMenuOnTree(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation(); // 阻止事件冒泡
  if (workspacePath.value) {
    showContextMenu(event, null, workspacePath.value);
  }
}

function hideContextMenu() {
  contextMenu.value.visible = false;
  contextMenu.value.target = null;
  contextMenu.value.parentPath = null;
}

async function handleNewFile() {
  if (!contextMenu.value.parentPath) return;
  const name = prompt("请输入文件名:", "新建文件.md");
  if (!name) return;

  // 验证文件名
  if (name.includes('/') || name.includes('\\') || name.includes(':') ||
      name.includes('*') || name.includes('?') || name.includes('"') ||
      name.includes('<') || name.includes('>') || name.includes('|')) {
    alert("文件名包含非法字符，请使用有效的文件名");
    return;
  }

  // 使用正确的路径分隔符
  const basePath = contextMenu.value.parentPath.replace(/\\/g, '/');
  const filePath = basePath + '/' + name;
  try {
    await invoke("create_file", { path: filePath });
    await loadFileTree();
  } catch (err) {
    alert("创建文件失败: " + err);
  }
  hideContextMenu();
}

async function handleNewFolder() {
  if (!contextMenu.value.parentPath) return;
  const name = prompt("请输入文件夹名:", "新建文件夹");
  if (!name) return;

  // 验证文件夹名
  if (name.includes('/') || name.includes('\\') || name.includes(':') ||
      name.includes('*') || name.includes('?') || name.includes('"') ||
      name.includes('<') || name.includes('>') || name.includes('|')) {
    alert("文件夹名包含非法字符，请使用有效的文件夹名");
    return;
  }

  // 使用正确的路径分隔符
  const basePath = contextMenu.value.parentPath.replace(/\\/g, '/');
  const folderPath = basePath + '/' + name;
  try {
    await invoke("create_directory", { path: folderPath });
    await loadFileTree();
  } catch (err) {
    alert("创建文件夹失败: " + err);
  }
  hideContextMenu();
}

function handleRename() {
  if (!contextMenu.value.target) return;
  renaming.value = {
    active: true,
    path: contextMenu.value.target.path,
    originalName: contextMenu.value.target.name,
    input: contextMenu.value.target.name,
  };
  hideContextMenu();

  // 使用 nextTick 确保 DOM 更新后再聚焦
  nextTick(() => {
    const input = document.querySelector('.rename-input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.select(); // 选中全部文本，方便用户直接输入
    }
  });
}

async function confirmRename() {
  if (!renaming.value.input || renaming.value.input === renaming.value.originalName) {
    cancelRename();
    return;
  }

  // 验证新名称
  const newName = renaming.value.input;
  if (newName.includes('/') || newName.includes('\\') || newName.includes(':') ||
      newName.includes('*') || newName.includes('?') || newName.includes('"') ||
      newName.includes('<') || newName.includes('>') || newName.includes('|')) {
    alert("名称包含非法字符，请使用有效的名称");
    cancelRename();
    return;
  }

  const oldPath = renaming.value.path;
  // 使用正确的路径分隔符处理
  const normalizedOldPath = oldPath.replace(/\\/g, '/');
  const parentPath = normalizedOldPath.substring(0, normalizedOldPath.lastIndexOf('/'));
  const newPath = parentPath + '/' + newName;

  try {
    await invoke("rename_path", { oldPath, newPath });
    await loadFileTree();

    // 如果重命名的文件正在编辑器中打开，更新标签页信息
    const tab = tabs.value.find(t => t.path === oldPath);
    if (tab) {
      tab.path = newPath;
      tab.name = newName;
    }
  } catch (err) {
    alert("重命名失败: " + err);
  }
  cancelRename();
}

function cancelRename() {
  renaming.value = {
    active: false,
    path: '',
    originalName: '',
    input: '',
  };
}

async function handleDelete() {
  if (!contextMenu.value.target) return;
  const targetName = contextMenu.value.target.name;
  const isDir = contextMenu.value.target.is_dir;
  const message = isDir
    ? `确定要删除文件夹 "${targetName}" 及其所有内容吗？此操作不可撤销。`
    : `确定要删除文件 "${targetName}" 吗？此操作不可撤销。`;

  const confirmed = window.confirm(message);
  if (!confirmed) return;

  try {
    await invoke("delete_path", { path: contextMenu.value.target.path });
    await loadFileTree();

    // 如果删除的文件正在编辑器中打开，关闭对应的标签页
    const tab = tabs.value.find(t => t.path === contextMenu.value.target!.path);
    if (tab) {
      closeTab(tab.id);
    }
  } catch (err) {
    alert("删除失败: " + err);
  }
  hideContextMenu();
}

async function saveFile() {
  if (!activeTab.value) return;
  try {
    if (activeTab.value.path) {
      await invoke("write_file", { path: activeTab.value.path, content: activeTab.value.content });
      activeTab.value.saved = true;
    } else {
      await saveFileAs();
    }
  } catch (err) {
    console.error("保存文件失败:", err);
  }
}

async function saveFileAs() {
  if (!activeTab.value) return;
  try {
    const path = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: activeTab.value.name === "未命名" ? "untitled.md" : activeTab.value.name,
    });
    if (path) {
      await invoke("write_file", { path, content: activeTab.value.content });
      activeTab.value.path = path;
      activeTab.value.name = path.split(/[/\\]/).pop() ?? "未命名";
      activeTab.value.saved = true;
      if (workspacePath.value) await loadFileTree();
    }
  } catch (err) {
    console.error("另存为失败:", err);
  }
}

async function insertImage() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
    });
    if (selected) {
      const path = selected as string;
      insertText(`![image](${path})`);
    }
  } catch (err) {
    console.error("插入图片失败:", err);
  }
}

function insertText(text: string) {
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea || !activeTab.value) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = activeTab.value.content.substring(0, start);
  const after = activeTab.value.content.substring(end);

  activeTab.value.content = before + text + after;
  activeTab.value.saved = false;

  nextTick(() => {
    textarea.focus();
    textarea.setSelectionRange(start + text.length, start + text.length);

  });
}

// 粘贴图片:从剪贴板读取图片二进制,保存到当前文件同目录的 assets/ 下,并以 Markdown 图片语法插入
async function handlePaste(e: ClipboardEvent) {
  if (!e.clipboardData) return;
  if (!activeTab.value) return;
  if (!activeTab.value.path) {
    // 阻止默认行为(否则浏览器会在光标处插入一大坨 data URL)
    e.preventDefault();
    alert('请先保存文件，然后再粘贴图片。');
    return;
  }

  const items = Array.from(e.clipboardData.items);
  const imageItem = items.find(
    (it) => it.kind === 'file' && it.type.startsWith('image/'),
  );
  if (!imageItem) return; // 非图片粘贴,走默认行为

  const file = imageItem.getAsFile();
  if (!file) return;

  e.preventDefault();

  try {
    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp =
      ts.getFullYear() +
      pad(ts.getMonth() + 1) +
      pad(ts.getDate()) +
      '-' +
      pad(ts.getHours()) +
      pad(ts.getMinutes()) +
      pad(ts.getSeconds());
    const rand = Math.random().toString(36).slice(2, 6);
    const fileName = `paste-${stamp}-${rand}.${ext}`;

    const filePath = activeTab.value.path;
    const dir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    const assetsDir = `${dir}/assets`;
    const targetPath = `${assetsDir}/${fileName}`;

    // 创建 assets 目录(若已存在则忽略错误)
    try {
      await invoke('create_directory', { path: assetsDir });
    } catch {}

    // 写入图片字节
    const buf = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buf));
    await invoke('write_file_bytes', { path: targetPath, content: bytes });

    // 插入 Markdown 图片语法(相对路径)
    const alt = fileName.replace(/\.[^.]+$/, '');
    insertText(`\n![${alt}](./assets/${fileName})\n`);
  } catch (err) {
    console.error('粘贴图片失败:', err);
    alert('粘贴图片失败: ' + err);
  }
}

function insertFormat(before: string, after: string = before) {
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea || !activeTab.value) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = activeTab.value.content.substring(start, end);

  const newText = selected ? `${before}${selected}${after}` : `${before}文本${after}`;
  insertText(newText);
}

function insertHeading(level: number) {
  if (!activeTab.value) return;
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea) return;

  const prefix = '#'.repeat(level) + ' ';
  const start = textarea.selectionStart;
  const lineStart = activeTab.value.content.lastIndexOf('\n', start - 1) + 1;
  const before = activeTab.value.content.substring(0, lineStart);
  const after = activeTab.value.content.substring(lineStart);

  activeTab.value.content = before + prefix + after;
  activeTab.value.saved = false;
}

function jumpToHeading(line: number) {
  navigateToHeading(line);
}

function navigateToHeading(line: number) {
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea || !activeTab.value) return;

  let pos = 0;
  const lines = activeTab.value.content.split('\n');
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    pos += lines[i].length + 1;
  }

  textarea.focus();
  textarea.setSelectionRange(pos, pos);

  const headingText = (lines[line - 1] || '').replace(/^#{1,6}\s+/, '');
  if (!headingText) return;

  const slug = slugify(headingText);
  const previews = document.querySelectorAll<HTMLElement>('.preview-area:not([style*="display: none"])');
  previews.forEach((preview) => {
    let target = preview.querySelector<HTMLElement>(`#${CSS.escape(slug)}`);
    if (!target) {
      const headings = preview.querySelectorAll<HTMLElement>('.ink-heading');
      for (const h of headings) {
        if (slugify(h.textContent || '') === slug) {
          target = h;
          break;
        }
      }
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('ink-heading-highlight');
      setTimeout(() => target?.classList.remove('ink-heading-highlight'), 2000);
    }
  });

  const headIdx = headings.value.findIndex((h) => h.line === line);
  if (headIdx >= 0) {
    activeHeadingIndex.value = headIdx;
  }
}

// ========= 导出相关(V1.1.0 重做) =========

/**
 * 截取当前主题快照:导出/打印时用来注入到产物里,保证所见即所得。
 * 返回:
 *   - dataTheme: <html data-theme> 的值
 *   - isDark:    是否暗色
 *   - fontFamily: 主题对应的字体栈
 *   - bodyBg/bodyColor: 主题背景/前景色
 */
function captureCurrentTheme(): {
  dataTheme: string;
  isDark: boolean;
  fontFamily: string;
  bodyBg: string;
  bodyColor: string;
  highlightCss: string;
} {
  const theme = themeName.value;
  const dark = isDark.value;
  // 主题对应的字体栈(与 src/style.css 中保持一致)
  const fontMap: Record<string, string> = {
    inkstone: `'Segoe UI', system-ui, -apple-system, 'Microsoft YaHei', 'PingFang SC', sans-serif`,
    github: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`,
    onedark: `'Source Code Pro', 'Cascadia Code', 'Fira Code', Consolas, ui-monospace, monospace`,
    typora: `'Source Serif Pro', 'Georgia', 'Cambria', 'Times New Roman', serif`,
  };
  // 主题对应的背景/前景(从 style.css 抄出)
  const colorMap: Record<string, { bg: string; fg: string }> = {
    inkstone: { bg: dark ? '#1a1a1a' : '#fafafa', fg: dark ? '#e5e5e5' : '#1a1a1a' },
    github: { bg: dark ? '#0d1117' : '#ffffff', fg: dark ? '#e6edf3' : '#1f2328' },
    onedark: { bg: '#282c34', fg: '#abb2bf' },
    typora: { bg: dark ? '#1f1f1f' : '#ffffff', fg: dark ? '#d0d0d0' : '#2c2c2c' },
  };
  const c = colorMap[theme] || colorMap.inkstone;
  return {
    dataTheme: theme,
    isDark: dark,
    fontFamily: fontMap[theme] || fontMap.inkstone,
    bodyBg: c.bg,
    bodyColor: c.fg,
    highlightCss: dark ? hljsDarkCss : hljsLightCss,
  };
}


/**
 * 把 markdown 中的本地图片内联为 data URI(base64),网络图片尝试 fetch 内联。
 * 不可用的图片保持原样。
 */
async function inlineImagesInMarkdown(
  markdown: string,
  currentFilePath: string | null,
): Promise<string> {
  const re = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  type Hit = { start: number; end: number; alt: string; src: string };
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    hits.push({ start: m.index, end: m.index + m[0].length, alt: m[1], src: m[2] });
  }
  if (hits.length === 0) return markdown;

  let out = markdown;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    let newSrc = h.src;

    if (/^(data:|blob:)/i.test(h.src)) {
      continue;
    } else if (/^https?:/i.test(h.src)) {
      const inlined = await fetchAsDataUri(h.src);
      if (inlined) newSrc = inlined;
    } else {
      // 本地路径
      let absPath: string;
      if (isAbsolutePath(h.src)) {
        absPath = h.src.replace(/\\/g, "/");
      } else if (currentFilePath) {
        const dir = currentFilePath
          .replace(/\\/g, "/")
          .split("/")
          .slice(0, -1)
          .join("/");
        absPath = dir + "/" + h.src;
      } else {
        continue;
      }
      try {
        const bytes = (await invoke<number[]>("read_file_bytes", { path: absPath })) as number[];
        const ext = absPath.split(".").pop() || "";
        newSrc = `data:${getMimeFromExt(ext)};base64,${bytesToBase64(bytes)}`;
      } catch (e) {
        console.warn("导出图片内联失败:", absPath, e);
        continue;
      }
    }

    out = out.slice(0, h.start) + `![${h.alt}](${newSrc})` + out.slice(h.end);
  }
  return out;
}

/**
 * 渲染 markdown 到"可导出" HTML(不带交互包装)。
 * 流程与 renderedHTML 一致,但跳过 wrapImagesForInteraction / wrapCodeBlocks / wrapTablesForEdit。
 */
function renderHTMLForExport(source: string): string {
  let html = md.render(source);
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      const cleanTex = tex.trim();
      return `<div class="katex-display">${katex.renderToString(cleanTex, { throwOnError: false, displayMode: true })}</div>`;
    } catch {
      return `<div class="katex-error">${tex}</div>`;
    }
  });
  html = html.replace(/\$([^$\n]+)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, { throwOnError: false });
    } catch {
      return tex;
    }
  });
  html = html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => {
      const id = "mermaid-" + Math.random().toString(36).slice(2, 11);
      const decoded = code
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim();
      return `<div class="mermaid-diagram" data-id="${id}" data-code="${encodeURIComponent(decoded)}">${escapeHtml(decoded)}</div>`;
    },
  );
  return html;
}

const EXPORT_BASE_CSS = `
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

const PRINT_CSS = `
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

/**
 * 导出 HTML:单文件全内联,完全离线可打开。
 */
async function exportHTML() {
  if (!activeTab.value) return;
  const tab = activeTab.value;
  try {
    const path = await save({
      filters: [{ name: "HTML", extensions: ["html"] }],
      defaultPath: tab.name.replace(/\.[^.]+$/, ".html"),
    });
    if (!path) return;

    const theme = captureCurrentTheme();
    const withInlinedImages = await inlineImagesInMarkdown(tab.content, tab.path);
    const withToc = preprocessToc(withInlinedImages, headings.value);
    const body = renderHTMLForExport(withToc);
    const title = tab.name.replace(/\.[^.]+$/, "");

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme.dataTheme}"${theme.isDark ? ' class="dark"' : ""}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
:root {
  --ink-font: ${theme.fontFamily};
  --ink-bg: ${theme.bodyBg};
  --ink-fg: ${theme.bodyColor};
}
${EXPORT_BASE_CSS}
${theme.highlightCss}
${katexCss}
${PRINT_CSS}
</style>
</head>
<body>
<div class="markdown-body">${body}</div>
<script>
${mermaidJs}
(function() {
  if (typeof mermaid === 'undefined') return;
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: ${theme.isDark ? "'dark'" : "'default'"},
      securityLevel: 'loose',
      fontFamily: 'inherit'
    });
    document.querySelectorAll('.mermaid-diagram[data-code]').forEach(function(el, i) {
      var code = decodeURIComponent(el.getAttribute('data-code') || '');
      if (!code) return;
      var id = 'm-' + Date.now() + '-' + i;
      mermaid.render(id, code).then(function(r) {
        el.innerHTML = r.svg;
      }).catch(function(e) {
        el.innerHTML = '<pre class="mermaid-error">Mermaid 渲染失败: ' + (e.message || e) + '</pre>';
      });
    });
  } catch (e) {
    console.error('Mermaid init failed:', e);
  }
})();
</` + `script>
</body>
</html>`;
    await invoke("write_file", { path, content: htmlContent });
  } catch (err) {
    console.error("导出HTML失败:", err);
  }
}

const showPrintHint = ref(localStorage.getItem("pdfHintShown") === "true");

/**
 * 组装打印用独立 HTML 文档(空 title 避免页眉显示应用名)。
 */
function buildPrintHtml(bodyHtml: string, theme: ReturnType<typeof captureCurrentTheme>): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme.dataTheme}"${theme.isDark ? ' class="dark"' : ""}>
<head>
<meta charset="UTF-8">
<title></title>
<style>
:root {
  --ink-font: ${theme.fontFamily};
  --ink-bg: ${theme.isDark ? theme.bodyBg : '#ffffff'};
  --ink-fg: ${theme.isDark ? theme.bodyColor : '#000000'};
}
${EXPORT_BASE_CSS}
${theme.highlightCss}
${katexCss}
${PRINT_CSS}
</style>
</head>
<body>
<div class="markdown-body">${bodyHtml}</div>
<script>
${mermaidJs}
(function() {
  if (typeof mermaid === 'undefined') return;
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: ${theme.isDark ? "'dark'" : "'default'"},
      securityLevel: 'loose',
      fontFamily: 'inherit'
    });
    var diagrams = document.querySelectorAll('.mermaid-diagram[data-code]');
    var pending = diagrams.length;
    if (pending === 0) { window.dispatchEvent(new Event('mermaid-ready')); return; }
    diagrams.forEach(function(el, i) {
      var code = decodeURIComponent(el.getAttribute('data-code') || '');
      if (!code) { if (--pending === 0) window.dispatchEvent(new Event('mermaid-ready')); return; }
      var id = 'm-' + Date.now() + '-' + i;
      mermaid.render(id, code).then(function(r) {
        el.innerHTML = r.svg;
        if (--pending === 0) window.dispatchEvent(new Event('mermaid-ready'));
      }).catch(function(e) {
        el.innerHTML = '<pre class="mermaid-error">Mermaid 渲染失败: ' + (e.message || e) + '</pre>';
        if (--pending === 0) window.dispatchEvent(new Event('mermaid-ready'));
      });
    });
  } catch (e) {
    console.error('Mermaid init failed:', e);
    window.dispatchEvent(new Event('mermaid-ready'));
  }
})();
</` + `script>
</body>
</html>`;
}

/**
 * 等待 iframe 内图片、字体加载完成。
 */
function waitForImagesAndFonts(win: Window): Promise<void> {
  const imgPromises = Array.from(win.document.images).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
        }),
  );
  const fontPromise = (win as any).fonts?.ready ?? Promise.resolve();
  const mermaidPromise = new Promise<void>((res) => {
    win.addEventListener('mermaid-ready', () => res(), { once: true });
    setTimeout(() => res(), 5000);
  });
  return Promise.all([...imgPromises, fontPromise, mermaidPromise]).then(() => undefined);
}

/**
 * 构建隐藏 iframe 并打印纯文档内容(不含应用 chrome)。
 */
async function printDocument(): Promise<void> {
  const tab = activeTab.value;
  if (!tab) return;

  const withImages = await inlineImagesInMarkdown(tab.content, tab.path);
  const withToc = preprocessToc(withImages, headings.value);
  const bodyHtml = renderHTMLForExport(withToc);
  const theme = captureCurrentTheme();
  const docHtml = buildPrintHtml(bodyHtml, theme);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentWindow!.document;
    doc.open();
    doc.write(docHtml);
    doc.close();

    await waitForImagesAndFonts(iframe.contentWindow!);

    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
  } finally {
    setTimeout(() => iframe.remove(), 2000);
  }
}

async function exportPDF() {
  if (!activeTab.value) return;
  showPrintHint.value = false;
  localStorage.setItem("pdfHintShown", "true");
  try {
    await printDocument();
  } catch (e) {
    console.error("打印失败:", e);
  }
}

function dismissPrintHint() {
  showPrintHint.value = false;
  localStorage.setItem("pdfHintShown", "true");
}

function toggleSidebar() {
  showSidebar.value = !showSidebar.value;
}

function toggleDark() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle("dark", isDark.value);
  localStorage.setItem('isDark', String(isDark.value));
  // Update mermaid theme and re-render diagrams
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark.value ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });
  nextTick(() => renderMermaidDiagrams());
}

// 滚动同步切换
function toggleScrollSync() {
  scrollSync.value = !scrollSync.value;
  localStorage.setItem('scrollSync', String(scrollSync.value));
  if (scrollSync.value && showSplit.value) {
    nextTick(() => syncPreviewFromEditor());
  }
}

// 获取当前可见的编辑器 textarea（v-show 隐藏父 div，textarea 本身无 display:none 内联样式）
function getVisibleEditor(): HTMLTextAreaElement | null {
  const textareas = document.querySelectorAll<HTMLTextAreaElement>('.editor-input');
  for (const ta of textareas) {
    if (ta.offsetParent !== null) return ta;
  }
  return textareas[0] || null;
}

// 获取当前可见的预览区
function getVisiblePreview(): HTMLElement | null {
  const previews = document.querySelectorAll<HTMLElement>('.preview-area');
  for (const p of previews) {
    if (p.offsetParent !== null) return p;
  }
  return previews[0] || null;
}

// 编辑器滚动 -> 同步预览
function syncPreviewFromEditor() {
  if (!scrollSync.value || !showSplit.value) return;
  if (syncingFrom === 'preview') return;
  syncingFrom = 'editor';
  const textarea = getVisibleEditor();
  const preview = getVisiblePreview();
  if (!textarea || !preview) {
    syncingFrom = null;
    return;
  }
  const editorMax = textarea.scrollHeight - textarea.clientHeight;
  const previewMax = preview.scrollHeight - preview.clientHeight;
  if (editorMax <= 0 || previewMax <= 0) {
    setTimeout(() => { syncingFrom = null; }, 80);
    return;
  }
  const ratio = textarea.scrollTop / editorMax;
  preview.scrollTop = ratio * previewMax;
  setTimeout(() => { syncingFrom = null; }, 80);
}

// 预览滚动 -> 同步编辑器
function syncEditorFromPreview() {
  if (!scrollSync.value || !showSplit.value) return;
  if (syncingFrom === 'editor') return;
  syncingFrom = 'preview';
  const textarea = getVisibleEditor();
  const preview = getVisiblePreview();
  if (!textarea || !preview) {
    syncingFrom = null;
    return;
  }
  const editorMax = textarea.scrollHeight - textarea.clientHeight;
  const previewMax = preview.scrollHeight - preview.clientHeight;
  if (editorMax <= 0 || previewMax <= 0) {
    setTimeout(() => { syncingFrom = null; }, 80);
    return;
  }
  const ratio = preview.scrollTop / previewMax;
  textarea.scrollTop = ratio * editorMax;
  updateActiveHeadingFromScroll();
  setTimeout(() => { syncingFrom = null; }, 80);
}

// 根据预览滚动位置更新当前激活的大纲项
function updateActiveHeadingFromScroll() {
  const preview = getVisiblePreview();
  if (!preview) return;
  const headEls = preview.querySelectorAll<HTMLElement>('.ink-heading');
  if (headEls.length === 0) return;
  let activeIdx = -1;
  const offsetTop = 80;
  for (let i = 0; i < headEls.length; i++) {
    const rect = headEls[i].getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    if (rect.top - previewRect.top - offsetTop <= 0) {
      activeIdx = i;
    } else {
      break;
    }
  }
  if (activeIdx >= 0 && activeIdx < headings.value.length) {
    activeHeadingIndex.value = activeIdx;
  }
}

function startResize() {
  isResizing.value = true;
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
}

function doResize(e: MouseEvent) {
  if (!isResizing.value) return;
  sidebarWidth.value = Math.max(200, Math.min(500, e.clientX));
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
}

// 搜索功能
function performSearch() {
  if (!activeTab.value || !searchQuery.value) {
    searchMatches.value = [];
    currentMatchIndex.value = -1;
    return;
  }
  const content = activeTab.value.content;
  const matches: { index: number; length: number }[] = [];
  const regex = new RegExp(searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push({ index: match.index, length: match[0].length });
  }
  searchMatches.value = matches;
  currentMatchIndex.value = matches.length > 0 ? 0 : -1;
  highlightCurrentMatch();
}

function highlightCurrentMatch() {
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea || currentMatchIndex.value < 0 || searchMatches.value.length === 0) return;
  const match = searchMatches.value[currentMatchIndex.value];
  textarea.focus();
  textarea.setSelectionRange(match.index, match.index + match.length);
}

function searchNext() {
  if (searchMatches.value.length === 0) return;
  currentMatchIndex.value = (currentMatchIndex.value + 1) % searchMatches.value.length;
  highlightCurrentMatch();
}

function searchPrev() {
  if (searchMatches.value.length === 0) return;
  currentMatchIndex.value = (currentMatchIndex.value - 1 + searchMatches.value.length) % searchMatches.value.length;
  highlightCurrentMatch();
}

function replaceCurrent() {
  if (!activeTab.value || currentMatchIndex.value < 0 || searchMatches.value.length === 0) return;
  const match = searchMatches.value[currentMatchIndex.value];
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea) return;
  const content = activeTab.value.content;
  activeTab.value.content = content.slice(0, match.index) + replaceQuery.value + content.slice(match.index + match.length);
  activeTab.value.saved = false;
  performSearch();
}

function replaceAll() {
  if (!activeTab.value || !searchQuery.value) return;
  const content = activeTab.value.content;
  const regex = new RegExp(searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  activeTab.value.content = content.replace(regex, replaceQuery.value);
  activeTab.value.saved = false;
  performSearch();
}

// 拖拽事件处理
function handleDragEnter(e: DragEvent) {
  e.preventDefault();
  dragCounter.value++;
  isDragging.value = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  dragCounter.value--;
  if (dragCounter.value <= 0) {
    isDragging.value = false;
    dragCounter.value = 0;
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  dragCounter.value = 0;

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  // 支持的图片格式
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

  // 处理每个拖拽的文件
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = (file as any).path;
    if (path) {
      const ext = path.toLowerCase().split('.').pop();
      if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
        await openFile(path);
      } else if (imageExtensions.includes(ext || '')) {
        // 处理图片拖拽
        await handleImageDrop(file, path);
      }
    }
  }
}

// 处理图片拖拽
async function handleImageDrop(file: File, sourcePath: string) {
  if (!activeTab.value) return;

  // 检查文件是否已保存
  if (!activeTab.value.path) {
    alert('请先保存文件，然后再插入图片。');
    return;
  }

  try {
    // 获取当前文件所在目录
    const currentFilePath = activeTab.value.path;
    const pathParts = currentFilePath.replace(/\\/g, '/').split('/');
    pathParts.pop(); // 移除文件名
    const currentDir = pathParts.join('/');

    // 生成目标文件名（使用原文件名）
    const fileName = (file as any).name || sourcePath.split(/[\\/]/).pop();
    const targetPath = `${currentDir}/${fileName}`;

    // 读取源图片文件
    const fileContent = await invoke<number[]>("read_file_bytes", { path: sourcePath });
    const bytes = new Uint8Array(fileContent);

    // 写入目标目录
    await invoke("write_file_bytes", { path: targetPath, content: Array.from(bytes) });

    // 计算相对路径
    const relativePath = `./${fileName}`;

    // 插入 Markdown 图片语法
    insertText(`![${fileName}](${relativePath})`);
  } catch (err) {
    console.error('处理图片拖拽失败:', err);
    alert('处理图片失败: ' + err);
  }
}

function closeSearch() {
  showSearch.value = false;
  searchQuery.value = "";
  replaceQuery.value = "";
  searchMatches.value = [];
  currentMatchIndex.value = -1;
}

function openSearch() {
  showSearch.value = true;
  nextTick(() => {
    const searchInput = document.querySelector('.search-input') as HTMLInputElement;
    if (searchInput) searchInput.focus();
  });
}

onMounted(async () => {
  if (isDark.value) {
    document.documentElement.classList.add("dark");
  }
  // 应用保存的主题(onedark 强制 dark 时 setTheme 会顺便修正 isDark)
  document.documentElement.setAttribute("data-theme", themeName.value);
  const opt = THEME_OPTIONS.find((o) => o.value === themeName.value);
  if (opt?.forceDark && !isDark.value) {
    isDark.value = true;
    document.documentElement.classList.add("dark");
    localStorage.setItem("isDark", "true");
  }

  // Initialize mermaid with theme
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark.value ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  });

  // 加载最近文件
  loadRecentFiles();

  // 全局点击隐藏右键菜单
  document.addEventListener('click', () => {
    hideContextMenu();
  });

  autoSaveInterval.value = window.setInterval(() => {
    tabs.value.forEach(async tab => {
      if (!tab.saved && tab.path) {
        try {
          await invoke("write_file", { path: tab.path, content: tab.content });
          tab.saved = true;
        } catch {}
      }
    });
  }, 30000);

  try {
    await listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "new":
          createNewTab();
          break;
        case "open":
          openFile();
          break;
        case "save":
          saveFile();
          break;
        case "saveas":
          saveFileAs();
          break;
        case "sidebar":
          toggleSidebar();
          break;
        case "edit":
          setViewMode('edit');
          break;
        case "split":
          setViewMode('split');
          break;
        case "preview":
          setViewMode('preview');
          break;
        case "dark":
          toggleDark();
          break;
        case "shortcuts":
          showShortcutsModal.value = true;
          break;
        case "about":
          showAboutModal.value = true;
          break;
      }
    });

    // 监听后端下发的"打开文件"事件(单实例回调 / RunEvent::Opened / 启动 argv 都会走这里)
    await listen<string>("open-file", async (event) => {
      if (event.payload) {
        await openFile(event.payload);
      }
    });

    // 通知后端"前端已就绪",触发启动挂起文件的派发
    try {
      await emit("frontend-ready");
    } catch {}
    try {
      await invoke("frontend_ready");
    } catch {}

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey) {
        if (e.key === "n") { e.preventDefault(); createNewTab(); }
        if (e.key === "o") { e.preventDefault(); openFile(); }
        if (e.key === "s" && !e.shiftKey) { e.preventDefault(); saveFile(); }
        if (e.key === "s" && e.shiftKey) { e.preventDefault(); saveFileAs(); }
        if (e.key === "b") { e.preventDefault(); toggleSidebar(); }
        if (e.key === "f") { e.preventDefault(); openSearch(); }
        // Ctrl+\ 循环切换 编辑/分栏/预览
        if (e.key === "\\") {
          e.preventDefault();
          const order: ViewMode[] = ['edit', 'split', 'preview'];
          const idx = order.indexOf(viewMode.value);
          setViewMode(order[(idx + 1) % order.length]);
        }
      }
      // F7 切换滚动同步
      if (e.key === "F7") {
        e.preventDefault();
        toggleScrollSync();
      }
      // F1 快捷键说明
      if (e.key === "F1") {
        e.preventDefault();
        showShortcutsModal.value = true;
      }
      // Esc 优先关闭对话框,其次关搜索面板
      if (e.key === "Escape") {
        if (showShortcutsModal.value) {
          e.preventDefault();
          showShortcutsModal.value = false;
        } else if (showAboutModal.value) {
          e.preventDefault();
          showAboutModal.value = false;
        } else if (showSearch.value) {
          e.preventDefault();
          closeSearch();
        }
      }
    });

    // 监听光标位置变化
    document.addEventListener("selectionchange", () => {
      // 计算选中文本字数
      const selection = window.getSelection();
      if (selection && activeTab.value) {
        const selectedText = selection.toString();
        selectedCount.value = selectedText.length;
      } else {
        selectedCount.value = 0;
      }
    });

    // 滚动同步：监听编辑器和预览区的滚动事件
    let editorScrollTimer: number | null = null;
    let previewScrollTimer: number | null = null;
    document.addEventListener("scroll", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList?.contains("editor-input")) {
        if (editorScrollTimer) cancelAnimationFrame(editorScrollTimer);
        editorScrollTimer = requestAnimationFrame(() => {
          syncPreviewFromEditor();
        });
      } else if (target.classList?.contains("preview-area") || target.closest?.(".preview-area")) {
        const preview = target.closest?.(".preview-area") as HTMLElement || target;
        if (!preview.classList?.contains("preview-area")) return;
        if (previewScrollTimer) cancelAnimationFrame(previewScrollTimer);
        previewScrollTimer = requestAnimationFrame(() => {
          syncEditorFromPreview();
        });
      }
    }, true);
  } catch {}
});

onUnmounted(() => {
  if (autoSaveInterval.value) {
    clearInterval(autoSaveInterval.value);
  }
});
</script>

<template>
  <div
    class="h-full flex flex-col"
    :class="{ dark: isDark }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <!-- Drag Overlay -->
    <div
      v-if="isDragging"
      class="fixed inset-0 bg-blue-500/20 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center"
      style="pointer-events: none;"
    >
      <div class="bg-white dark:bg-gray-800 px-8 py-6 rounded-lg shadow-lg text-center">
        <div class="text-4xl mb-2">📄</div>
        <div class="text-lg font-medium text-gray-700 dark:text-gray-200">拖放 Markdown 文件到此处</div>
        <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">支持 .md, .markdown, .txt 文件</div>
      </div>
    </div>

    <!-- Toolbar -->
    <TheToolbar
      :view-mode="viewMode"
      :show-split="showSplit"
      :show-preview="showPreview"
      :theme-name="themeName"
      :is-dark="isDark"
      :theme-options="THEME_OPTIONS"
      @new-tab="createNewTab()"
      @open-file="openFile()"
      @open-folder="openFolder"
      @save-file="saveFile()"
      @insert-heading="insertHeading"
      @insert-format="insertFormat"
      @insert-text="insertText"
      @insert-image="insertImage"
      @export-html="exportHTML"
      @export-pdf="exportPDF"
      @set-view-mode="setViewMode"
      @set-theme="setTheme"
      @toggle-dark="toggleDark"
    />

    <!-- PDF 打印提示 -->
    <PrintHint :visible="showPrintHint" @dismiss="dismissPrintHint" />

    <!-- Search Panel -->
    <SearchPanel
      v-model:search-query="searchQuery"
      v-model:replace-query="replaceQuery"
      :visible="showSearch"
      :match-count="searchMatches.length"
      :current-index="currentMatchIndex"
      @next="searchNext"
      @prev="searchPrev"
      @replace-current="replaceCurrent"
      @replace-all="replaceAll"
      @close="closeSearch"
    />

    <!-- Tabs -->
    <TheTabBar
      :tabs="tabs"
      :active-tab-id="activeTabId"
      :show-sidebar="showSidebar"
      @toggle-sidebar="toggleSidebar"
      @set-active="setActiveTab"
      @close-tab="closeTab"
      @new-tab="createNewTab()"
    />

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <div
        v-show="showSidebar"
        class="sidebar flex border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <div class="flex-1 overflow-auto py-2 px-2">
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2 flex items-center justify-between gap-1">
            <button
              @click="sidebarMode = 'tree'"
              class="px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              :class="sidebarMode === 'tree' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'"
            >
              <span>📁</span>
              <span>文件树</span>
            </button>
            <button
              @click="sidebarMode = 'outline'"
              class="px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              :class="sidebarMode === 'outline' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'"
            >
              <span>📋</span>
              <span>大纲</span>
            </button>
            <button
              @click="sidebarMode = 'recent'"
              class="px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              :class="sidebarMode === 'recent' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'"
            >
              <span>🕐</span>
              <span>最近</span>
            </button>
            <button
              @click="sidebarMode = 'assets'"
              class="px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              :class="sidebarMode === 'assets' ? 'bg-blue-500 text-white dark:bg-blue-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'"
              title="当前文档引用到的图片/资源"
            >
              <span>🖼️</span>
              <span>资源</span>
            </button>
            <button v-if="sidebarMode === 'tree'" @click="loadFileTree" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 flex-shrink-0" title="刷新">🔄</button>
          </div>
          <!-- 文件树视图 -->
          <div v-if="sidebarMode === 'tree'" class="file-tree" @contextmenu="showContextMenuOnTree">
            <div v-if="!workspacePath" class="text-xs text-gray-400 dark:text-gray-500 px-2 py-4 text-center">
              <div class="mb-2">📂 请先打开文件夹</div>
              <button
                @click="openFolder"
                class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
              >
                打开文件夹
              </button>
            </div>
            <div v-else-if="fileTree.length === 0" class="text-xs text-gray-400 dark:text-gray-500 px-2 py-4 text-center">
              <div class="mb-2">📁 文件夹为空</div>
              <div class="text-gray-300 dark:text-gray-600">右键点击可新建文件</div>
            </div>
            <component v-else :is="() => h('div', {}, renderFileTree(fileTree))" />
          </div>

          <!-- 右键菜单 -->
          <div
            v-if="contextMenu.visible"
            class="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 z-50"
            :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
            @contextmenu.stop
          >
            <div
              class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              @click="handleNewFile"
            >
              📄 新建文件
            </div>
            <div
              class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              @click="handleNewFolder"
            >
              📁 新建文件夹
            </div>
            <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <div
              class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              @click="handleRename"
            >
              ✏️ 重命名
            </div>
            <div
              class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-red-500"
              @click="handleDelete"
            >
              🗑️ 删除
            </div>
          </div>
          <!-- 大纲视图 -->
          <div v-else-if="sidebarMode === 'outline'" class="outline-view">
            <div v-if="headings.length === 0" class="text-xs text-gray-400 dark:text-gray-500 px-2 py-4 text-center">
              暂无标题<br>请使用 # 语法添加标题
            </div>
            <div
              v-for="(heading, idx) in headings"
              :key="idx"
              @click="jumpToHeading(heading.line)"
              class="outline-item cursor-pointer rounded px-2 py-1 text-sm transition-colors"
              :class="[
                activeHeadingIndex === idx
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium border-l-2 border-blue-500 pl-1.5'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              ]"
              :style="{ paddingLeft: ((heading.level - 1) * 12 + 8) + 'px' }"
            >
              <span class="text-gray-500 dark:text-gray-400 mr-1">#</span>
              <span>{{ heading.text }}</span>
            </div>
          </div>
          <!-- 最近文件视图 -->
          <div v-else-if="sidebarMode === 'recent'" class="recent-view">
            <div v-if="recentFiles.length === 0" class="text-xs text-gray-400 dark:text-gray-500 px-2 py-4 text-center">
              暂无最近文件<br>打开的文件会自动记录
            </div>
            <div
              v-for="(filePath, idx) in recentFiles"
              :key="idx"
              @click="openFile(filePath)"
              class="recent-item cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 text-sm group"
            >
              <div class="flex items-center gap-1">
                <span class="text-gray-500 dark:text-gray-400">📄</span>
                <span class="text-gray-700 dark:text-gray-300 truncate">{{ getFileName(filePath) }}</span>
              </div>
              <div class="text-xs text-gray-400 dark:text-gray-500 truncate hidden group-hover:block">
                {{ filePath }}
              </div>
            </div>
            <div v-if="recentFiles.length > 0" class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                @click="clearRecentFiles"
                class="w-full px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                🗑️ 清除历史
              </button>
            </div>
          </div>
          <!-- 资源视图(扫描当前文档的图片) -->
          <div v-else-if="sidebarMode === 'assets'" class="assets-view">
            <div v-if="documentAssets.length === 0" class="text-xs text-gray-400 dark:text-gray-500 px-2 py-4 text-center">
              暂无图片资源<br>在文档中插入 <code class="font-mono">![]()</code> 试试
            </div>
            <div
              v-for="(asset, idx) in documentAssets"
              :key="idx"
              class="asset-item rounded px-2 py-2 mb-1 hover:bg-gray-100 dark:hover:bg-gray-700 group"
            >
              <div class="flex items-center gap-2">
                <span class="text-base">🖼️</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-gray-700 dark:text-gray-300 truncate" :title="asset.raw">
                    {{ asset.name }}
                  </div>
                  <div class="text-xs text-gray-400 dark:text-gray-500 truncate" :title="asset.resolved">
                    {{ asset.relative }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                <button
                  v-if="asset.exists"
                  @click="revealAsset(asset.resolved)"
                  class="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="在文件夹中显示"
                >📂 显示</button>
                <button
                  v-if="!isRemoteAsset(asset.raw) && asset.exists"
                  @click="renameAsset(asset)"
                  class="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="重命名(只改文件名)"
                >✏️ 重命名</button>
                <button
                  v-if="!isRemoteAsset(asset.raw) && asset.exists"
                  @click="moveAsset(asset)"
                  class="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="移动到其他文件夹"
                >📁 移动</button>
                <button
                  v-if="!isRemoteAsset(asset.raw) && asset.exists"
                  @click="compressAsset(asset)"
                  class="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="压缩图片(jpeg/png),节省体积"
                >🗜️ 压缩</button>
                <button
                  @click="copyAssetPath(asset.resolved)"
                  class="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="复制绝对路径"
                >📋 复制路径</button>
                <button
                  @click="copyAssetPath(asset.raw)"
                  class="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  title="复制 Markdown 引用(原始写法)"
                >🔗 复制引用</button>
                <button
                  v-if="asset.exists"
                  @click="removeAssetReference(asset.raw)"
                  class="text-xs px-2 py-0.5 rounded border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 ml-auto"
                  title="从文档中移除此引用"
                >✕</button>
              </div>
              <div v-if="!asset.exists" class="text-xs text-red-500 mt-1">⚠️ 文件不存在</div>
            </div>
          </div>
        </div>
        <div
          class="w-1 cursor-ew-resize hover:bg-blue-400"
          @mousedown="startResize"
        ></div>
      </div>

      <!-- Editor -->
      <EditorPane
        :content="activeTab?.content ?? ''"
        :rendered-html="renderedHTML"
        :show-split="showSplit"
        :show-preview="showPreview"
        @input="handleInput"
        @keydown="handleKeydown"
        @paste="handlePaste"
      />
    </div>

    <!-- Status Bar -->
    <TheStatusBar
      :saved="!!activeTab?.saved"
      :path="activeTab?.path ?? null"
      :char-count="charCount"
      :word-count="wordCount"
      :selected-count="selectedCount"
      :show-split="showSplit"
      :scroll-sync="scrollSync"
      @toggle-scroll-sync="toggleScrollSync"
    />

    <!-- 快捷键对话框 -->
    <ShortcutsModal v-model="showShortcutsModal" :shortcuts="SHORTCUTS" />

    <!-- 关于对话框 -->
    <AboutModal v-model="showAboutModal" :version="appVersion" />
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 深色模式滚动条 */
.dark ::-webkit-scrollbar-track {
  background: #1f2937;
}

.dark ::-webkit-scrollbar-thumb {
  background: #4b5563;
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

/* KaTeX 块级公式样式 */
.katex-display {
  display: block;
  text-align: center;
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.katex-error {
  color: #dc2626;
  background: #fee2e2;
  padding: 0.5em;
  border-radius: 4px;
  font-family: monospace;
}

.dark .katex-error {
  background: #7f1d1d;
  color: #fecaca;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
::-webkit-scrollbar-corner {
  background: transparent;
}
</style>
