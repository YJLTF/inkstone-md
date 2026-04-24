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
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_open: boolean;
  children?: FileEntry[];
}

interface Tab {
  id: string;
  name: string;
  path: string | null;
  content: string;
  saved: boolean;
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {}
    }
    return "";
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

interface Heading {
  level: number;
  text: string;
  line: number;
}

const showSidebar = ref(false);
const sidebarMode = ref<'tree' | 'outline' | 'recent'>('outline');
const sidebarWidth = ref(280); // 增加默认宽度以容纳按钮
const isResizing = ref(false);
const isDark = ref(localStorage.getItem('isDark') === 'true');
const showPreview = ref(false);
const showSplit = ref(true);
const typewriterMode = ref(localStorage.getItem('typewriterMode') === 'true');
const workspacePath = ref<string | null>(null);
const fileTree = ref<FileEntry[]>([]);
const autoSaveInterval = ref<number | null>(null);

// 右键菜单状态
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: FileEntry | null;
  parentPath: string | null;
}
const contextMenu = ref<ContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  target: null,
  parentPath: null,
});

// 重命名状态
const renaming = ref<{
  active: boolean;
  path: string;
  originalName: string;
  input: string;
}>({
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

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

// 拖拽状态
const isDragging = ref(false);
const dragCounter = ref(0);

// 专注模式状态
const focusMode = ref(false);
const currentLine = ref(1);

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

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value));

const charCount = computed(() => activeTab.value?.content.length ?? 0);
const wordCount = computed(() => {
  const text = activeTab.value?.content.trim() ?? "";
  if (!text) return 0;
  return text.split(/\s+/).length;
});

const renderedHTML = computed(() => {
  if (!activeTab.value) return "";
  let html = md.render(activeTab.value.content);

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

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;">');
  // Replace mermaid code blocks with placeholder divs
  html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (_, code) => {
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    const decoded = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    return `<div class="mermaid-diagram" data-id="${id}" data-code="${encodeURIComponent(decoded)}"></div>`;
  });
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
  });
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
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea || !activeTab.value) return;

  let pos = 0;
  const lines = activeTab.value.content.split('\n');
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    pos += lines[i].length + 1;
  }

  textarea.focus();
  textarea.setSelectionRange(pos, pos);
}

async function exportHTML() {
  if (!activeTab.value) return;
  try {
    const path = await save({
      filters: [{ name: "HTML", extensions: ["html"] }],
      defaultPath: activeTab.value.name.replace(/\.[^.]+$/, '.html'),
    });
    if (path) {
      const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${activeTab.value.name.replace(/\.[^.]+$/, '')}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
  <style>
    body { max-width: 800px; margin: 0 auto; padding: 2rem; font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; }
    pre { background: #f5f5f5; padding: 1em; border-radius: 6px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
    blockquote { border-left: 4px solid #ddd; padding-left: 1em; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 0.5em 1em; }
  </style>
</head>
<body>
${renderedHTML.value}
</body>
</html>`;
      await invoke("write_file", { path, content: htmlContent });
    }
  } catch (err) {
    console.error("导出HTML失败:", err);
  }
}

async function exportPDF() {
  if (!activeTab.value) return;
  try {
    const path = await save({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      defaultPath: activeTab.value.name.replace(/\.[^.]+$/, '.pdf'),
    });
    if (!path) return;

    // 创建临时容器渲染内容
    const container = document.createElement('div');
    container.className = 'markdown-body';
    container.style.width = '210mm';
    container.style.padding = '25mm 20mm 30mm 20mm';
    container.style.background = 'white';
    container.style.fontFamily = "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif";
    container.style.fontSize = '11pt';
    container.style.lineHeight = '1.8';
    container.style.color = '#2c3e50';
    container.style.boxSizing = 'border-box';
    container.innerHTML = renderedHTML.value;

    // 添加专业的Markdown样式（包含分页控制）
    const style = document.createElement('style');
    style.textContent = `
      .markdown-body {
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      /* 标题样式 - 避免分页 */
      .markdown-body h1 {
        font-size: 24pt;
        font-weight: 700;
        margin: 0.8em 0 0.4em 0;
        padding-bottom: 0.3em;
        border-bottom: 2px solid #e1e4e8;
        color: #1a1a1a;
        line-height: 1.3;
        page-break-after: avoid;
        break-after: avoid;
      }
      .markdown-body h2 {
        font-size: 18pt;
        font-weight: 600;
        margin: 0.8em 0 0.4em 0;
        padding-bottom: 0.25em;
        border-bottom: 1px solid #e1e4e8;
        color: #24292e;
        line-height: 1.4;
        page-break-after: avoid;
        break-after: avoid;
      }
      .markdown-body h3 {
        font-size: 14pt;
        font-weight: 600;
        margin: 0.8em 0 0.4em 0;
        color: #24292e;
        line-height: 1.4;
        page-break-after: avoid;
        break-after: avoid;
      }
      .markdown-body h4 {
        font-size: 12pt;
        font-weight: 600;
        margin: 0.8em 0 0.3em 0;
        color: #24292e;
        page-break-after: avoid;
        break-after: avoid;
      }
      .markdown-body h5, .markdown-body h6 {
        font-size: 11pt;
        font-weight: 600;
        margin: 0.8em 0 0.3em 0;
        color: #586069;
        page-break-after: avoid;
        break-after: avoid;
      }

      /* 段落和文本 - 避免内部断页 */
      .markdown-body p {
        margin: 0.8em 0;
        text-align: justify;
        orphans: 3;
        widows: 3;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* 代码块 - 避免内部断页 */
      .markdown-body pre {
        background: #f6f8fa;
        border: 1px solid #e1e4e8;
        border-radius: 6px;
        padding: 1em;
        overflow-x: auto;
        margin: 1em 0;
        font-size: 10pt;
        line-height: 1.5;
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .markdown-body pre code {
        background: transparent;
        padding: 0;
        border-radius: 0;
        font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
      }

      /* 行内代码 */
      .markdown-body code {
        background: #f6f8fa;
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
        font-size: 0.9em;
        color: #d73a49;
        border: 1px solid #e1e4e8;
      }

      /* 引用块 - 避免内部断页 */
      .markdown-body blockquote {
        border-left: 4px solid #dfe2e5;
        padding: 0.5em 1em;
        margin: 1em 0;
        color: #6a737d;
        background: #f6f8fa;
        border-radius: 0 6px 6px 0;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .markdown-body blockquote p {
        margin: 0.5em 0;
      }

      /* 列表 - 避免内部断页 */
      .markdown-body ul, .markdown-body ol {
        padding-left: 2em;
        margin: 1em 0;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .markdown-body li {
        margin: 0.4em 0;
        line-height: 1.6;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .markdown-body li > ul, .markdown-body li > ol {
        margin: 0.4em 0;
      }

      /* 表格 - 避免内部断页 */
      .markdown-body table {
        border-collapse: collapse;
        width: 100%;
        margin: 1.5em 0;
        font-size: 10.5pt;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .markdown-body th {
        background: #f6f8fa;
        font-weight: 600;
        text-align: left;
        border: 1px solid #dfe2e5;
        padding: 0.75em 1em;
      }
      .markdown-body td {
        border: 1px solid #dfe2e5;
        padding: 0.6em 1em;
      }
      .markdown-body tr:nth-child(even) {
        background: #f6f8fa;
      }

      /* 图片 */
      .markdown-body img {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        margin: 1em 0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        display: block;
      }

      /* 水平线 */
      .markdown-body hr {
        border: none;
        border-top: 2px solid #e1e4e8;
        margin: 2em 0;
      }

      /* 链接 */
      .markdown-body a {
        color: #0366d6;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s;
      }
      .markdown-body a:hover {
        border-bottom-color: #0366d6;
      }

      /* 数学公式 */
      .katex-display {
        margin: 1.5em 0;
        overflow-x: auto;
        padding: 0.5em 0;
      }

      /* 强调和加粗 */
      .markdown-body strong {
        font-weight: 600;
        color: #24292e;
      }
      .markdown-body em {
        font-style: italic;
      }

      /* 删除线 */
      .markdown-body del {
        text-decoration: line-through;
        color: #6a737d;
      }

      /* 任务列表 */
      .markdown-body input[type="checkbox"] {
        margin-right: 0.5em;
      }
    `;
    container.appendChild(style);
    document.body.appendChild(container);

    // 等待样式应用和图片加载
    await new Promise(resolve => setTimeout(resolve, 100));

    // 获取所有需要避免分页的元素位置
    const elements = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, pre, blockquote, table, ul, ol');
    const elementPositions: { top: number; bottom: number; isHeading: boolean }[] = [];

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const relativeTop = rect.top - containerRect.top;
      const relativeBottom = rect.bottom - containerRect.top;
      const isHeading = /^H[1-6]$/.test(el.tagName);

      elementPositions.push({
        top: relativeTop,
        bottom: relativeBottom,
        isHeading
      });
    });

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
      removeContainer: false,
      onclone: (clonedDoc) => {
        // 确保克隆的文档也应用了样式
        const clonedContainer = clonedDoc.body.querySelector('.markdown-body') as HTMLElement;
        if (clonedContainer) {
          clonedContainer.style.visibility = 'visible';
        }
      }
    });
    document.body.removeChild(container);

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // A4纸的有效打印区域（考虑页边距）
    const margin = 10;
    const effectiveWidth = pageWidth - 2 * margin;
    const effectiveHeight = pageHeight - 2 * margin;

    // 计算图片在PDF中的尺寸
    const imgWidth = effectiveWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // 计算像素到毫米的转换比例
    const pxToMm = imgHeight / canvas.height;

    // 智能分页：计算分页位置，避免在标题后立即分页
    const pageBreaks: number[] = [0];
    let currentHeight = 0;
    const scale = canvas.height / (container.scrollHeight || canvas.height);

    while (currentHeight < imgHeight) {
      let nextBreak = currentHeight + effectiveHeight;

      // 查找最近的标题元素
      for (let i = 0; i < elementPositions.length; i++) {
        const pos = elementPositions[i];
        const posMm = pos.top * pxToMm / scale;

        // 如果标题在当前页底部附近（距离分页点小于30mm）
        if (pos.isHeading && posMm > currentHeight && posMm < nextBreak && (nextBreak - posMm) < 30) {
          // 检查标题后的内容是否会被截断
          if (i + 1 < elementPositions.length) {
            const nextPos = elementPositions[i + 1];
            const nextPosMm = nextPos.top * pxToMm / scale;

            // 如果下一个元素在下一页，则提前分页
            if (nextPosMm > nextBreak) {
              nextBreak = posMm - 5; // 在标题前5mm分页
              break;
            }
          }
        }
      }

      if (nextBreak < imgHeight) {
        pageBreaks.push(nextBreak);
      }
      currentHeight = nextBreak;
    }

    // 根据计算的分页位置生成PDF页面
    for (let i = 0; i < pageBreaks.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const startY = pageBreaks[i];
      const endY = i < pageBreaks.length - 1 ? pageBreaks[i + 1] : imgHeight;
      const pageContentHeight = endY - startY;

      // 计算源图片的裁剪区域
      const sourceY = (startY / imgHeight) * canvas.height;
      const sourceHeight = ((pageContentHeight) / imgHeight) * canvas.height;

      // 创建临时canvas来裁剪当前页的内容
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = Math.ceil(sourceHeight);
      const ctx = tempCanvas.getContext('2d');

      if (ctx) {
        // 绘制当前页对应的内容区域
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceHeight,
          0, 0, canvas.width, sourceHeight
        );

        const pageImgData = tempCanvas.toDataURL('image/png', 1.0);
        const pageImgHeight = (sourceHeight * imgWidth) / canvas.width;

        pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, pageImgHeight);
      }
    }

    const pdfBlob = pdf.output('blob');
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    await invoke("write_file_bytes", { path, content: Array.from(uint8Array) });
  } catch (err) {
    console.error("导出PDF失败:", err);
  }
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

// 专注模式切换
function toggleFocusMode() {
  focusMode.value = !focusMode.value;
  // 关闭专注模式时清除背景样式
  if (!focusMode.value) {
    const textareas = document.querySelectorAll('.editor-input');
    textareas.forEach((ta) => {
      (ta as HTMLTextAreaElement).style.background = '';
    });
  }
}

// 打字机模式切换
function toggleTypewriterMode() {
  typewriterMode.value = !typewriterMode.value;
  localStorage.setItem('typewriterMode', String(typewriterMode.value));
}

// 打字机模式：滚动到光标位置，保持光标行在屏幕垂直居中
function scrollToCursor() {
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea) return;

  // 获取光标所在的行号
  const pos = textarea.selectionStart;
  const content = textarea.value.substring(0, pos);
  const lineNumber = content.split('\n').length;

  // 计算光标在textarea中的垂直位置（近似值：行号 * 行高）
  const lineHeight = 20; // 假设行高为 20px
  const cursorTop = (lineNumber - 1) * lineHeight;

  // 获取 textarea 的可见区域高度
  const textareaHeight = textarea.clientHeight;

  // 计算滚动位置，使光标行居中
  const scrollTo = cursorTop - (textareaHeight / 2) + (lineHeight / 2);

  textarea.scrollTop = Math.max(0, scrollTo);
}

// 更新当前行号并应用高亮
function updateCurrentLine() {
  const textarea = document.querySelector('.editor-input:not([style*="display: none"])') as HTMLTextAreaElement;
  if (!textarea || !activeTab.value) return;
  const pos = textarea.selectionStart;
  const content = activeTab.value.content.substring(0, pos);
  currentLine.value = content.split('\n').length;

  // 使用背景渐变高亮当前行
  const lineHeight = 28; // 约等于 line-height: 1.8 * 16px
  const highlightPos = (currentLine.value - 1) * lineHeight;
  textarea.style.background = `linear-gradient(transparent ${highlightPos}px, rgba(59, 130, 246, 0.1) ${highlightPos}px, rgba(59, 130, 246, 0.1) ${highlightPos + lineHeight}px, transparent ${highlightPos + lineHeight}px)`;
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
        case "split":
          showSplit.value = true;
          showPreview.value = false;
          break;
        case "preview":
          showPreview.value = true;
          showSplit.value = false;
          break;
        case "dark":
          toggleDark();
          break;
      }
    });

    // 监听命令行传递的文件路径事件
    await listen<string>("open-file-init", async (event) => {
      if (event.payload) {
        await openFile(event.payload);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey) {
        if (e.key === "n") { e.preventDefault(); createNewTab(); }
        if (e.key === "o") { e.preventDefault(); openFile(); }
        if (e.key === "s" && !e.shiftKey) { e.preventDefault(); saveFile(); }
        if (e.key === "s" && e.shiftKey) { e.preventDefault(); saveFileAs(); }
        if (e.key === "b") { e.preventDefault(); toggleSidebar(); }
        if (e.key === "f") { e.preventDefault(); openSearch(); }
      }
      // F8 切换专注模式
      if (e.key === "F8") {
        e.preventDefault();
        toggleFocusMode();
      }
      // F9 切换打字机模式
      if (e.key === "F9") {
        e.preventDefault();
        toggleTypewriterMode();
      }
      if (e.key === "Escape" && showSearch.value) {
        e.preventDefault();
        closeSearch();
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

      if (focusMode.value) {
        updateCurrentLine();
      }
      // 打字机模式：光标位置变化时自动滚动
      if (typewriterMode.value) {
        scrollToCursor();
      }
    });
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
    <div class="flex items-center gap-1 px-3 py-2 border-b bg-white dark:bg-gray-900 dark:border-gray-700 flex-wrap">
      <span class="font-semibold text-gray-700 dark:text-gray-200 mr-3">📝 InkStone</span>

      <div class="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
        <span class="text-xs text-gray-400 dark:text-gray-500 mr-1">文件</span>
        <button @click="createNewTab()" title="新建 (Ctrl+N)" class="toolbar-btn">📄 新建</button>
        <button @click="openFile()" title="打开 (Ctrl+O)" class="toolbar-btn">📂 打开</button>
        <button @click="openFolder" title="打开文件夹" class="toolbar-btn">📁 文件夹</button>
        <button @click="saveFile()" title="保存 (Ctrl+S)" class="toolbar-btn">💾 保存</button>
      </div>

      <div class="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
        <span class="text-xs text-gray-400 dark:text-gray-500 mr-1">标题</span>
        <button @click="insertHeading(1)" title="一级标题" class="toolbar-btn text-sm font-bold">H1</button>
        <button @click="insertHeading(2)" title="二级标题" class="toolbar-btn text-sm font-bold">H2</button>
        <button @click="insertHeading(3)" title="三级标题" class="toolbar-btn text-sm font-bold">H3</button>
      </div>

      <div class="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
        <span class="text-xs text-gray-400 dark:text-gray-500 mr-1">格式</span>
        <button @click="insertFormat('**')" title="粗体" class="toolbar-btn font-bold">B</button>
        <button @click="insertFormat('*')" title="斜体" class="toolbar-btn italic">I</button>
        <button @click="insertFormat('~~')" title="删除线" class="toolbar-btn line-through">S</button>
        <button @click="insertFormat('`')" title="行内代码" class="toolbar-btn font-mono">`</button>
      </div>

      <div class="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
        <span class="text-xs text-gray-400 dark:text-gray-500 mr-1">列表</span>
        <button @click="insertText('- ')" title="无序列表" class="toolbar-btn">•</button>
        <button @click="insertText('1. ')" title="有序列表" class="toolbar-btn">1.</button>
        <button @click="insertText('- [ ] ')" title="任务列表" class="toolbar-btn">☐</button>
        <button @click="insertText('> ')" title="引用" class="toolbar-btn">"</button>
      </div>

      <div class="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
        <span class="text-xs text-gray-400 dark:text-gray-500 mr-1">插入</span>
        <button @click="insertImage" title="插入图片" class="toolbar-btn">🖼️ 图片</button>
        <button @click="insertText('[链接](url)')" title="链接" class="toolbar-btn">🔗</button>
        <button @click="insertText('$$')" title="数学公式" class="toolbar-btn">∑ 公式</button>
        <button @click="insertText('```\n\n```')" title="代码块" class="toolbar-btn font-mono">&lt;/&gt; 代码</button>
        <button @click="insertText('| 表头 | 表头 |\n|------|------|\n| 单元格 | 单元格 |')" title="表格" class="toolbar-btn">⊞</button>
      </div>

      <div class="flex-1"></div>

      <div class="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-2 mr-2">
        <span class="text-xs text-gray-400 dark:text-gray-500 mr-1">导出</span>
        <button @click="exportHTML" title="导出HTML" class="toolbar-btn">📤 HTML</button>
        <button @click="exportPDF" title="导出PDF" class="toolbar-btn">📄 PDF</button>
      </div>

      <button
        @click="showSplit = true; showPreview = false"
        class="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        :class="{ 'bg-gray-200 dark:bg-gray-700': showSplit }"
      >
        分栏
      </button>
      <button
        @click="showPreview = true; showSplit = false"
        class="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
        :class="{ 'bg-gray-200 dark:bg-gray-700': showPreview }"
      >
        预览
      </button>
      <button
        @click="toggleDark"
        class="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
      >
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </div>

    <!-- Search Panel -->
    <div
      v-show="showSearch"
      class="flex items-center gap-2 px-3 py-2 border-b bg-gray-100 dark:bg-gray-800 dark:border-gray-700"
    >
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索..."
        class="search-input px-2 py-1 text-sm border rounded flex-1 max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        @keydown.enter="searchNext"
      />
      <input
        v-model="replaceQuery"
        type="text"
        placeholder="替换为..."
        class="px-2 py-1 text-sm border rounded flex-1 max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        @keydown.enter="replaceCurrent"
      />
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ searchMatches.length > 0 ? `${currentMatchIndex + 1}/${searchMatches.length}` : '0/0' }}
      </span>
      <button @click="searchPrev" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">↑ 上一条</button>
      <button @click="searchNext" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">↓ 下一条</button>
      <button @click="replaceCurrent" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">替换</button>
      <button @click="replaceAll" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">全部替换</button>
      <button @click="closeSearch" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">× 关闭</button>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 px-2 py-1 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700 overflow-x-auto">
      <button
        @click="toggleSidebar"
        class="px-2 py-1 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 mr-2"
        :class="showSidebar ? 'bg-gray-200 dark:bg-gray-700' : ''"
        title="文件树 (Ctrl+B)"
      >
        📁
      </button>
      <div
        v-for="tab in tabs"
        :key="tab.id"
        @click="setActiveTab(tab.id)"
        class="flex items-center gap-1 px-3 py-1 text-sm rounded cursor-pointer group"
        :class="tab.id === activeTabId ? 'bg-white dark:bg-gray-900 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700'"
      >
        <span class="max-w-32 truncate">{{ tab.name }}</span>
        <span v-if="!tab.saved" class="text-orange-500">●</span>
        <button
          @click="closeTab(tab.id, $event)"
          class="opacity-0 group-hover:opacity-100 hover:text-red-500 ml-1"
        >×</button>
      </div>
      <button @click="createNewTab()" class="px-2 py-1 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700">+</button>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <div
        v-show="showSidebar"
        class="flex border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden"
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
              class="outline-item cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 text-sm"
              :style="{ paddingLeft: ((heading.level - 1) * 12 + 8) + 'px' }"
            >
              <span class="text-gray-600 dark:text-gray-400 mr-1">#</span>
              <span class="text-gray-700 dark:text-gray-300">{{ heading.text }}</span>
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
        </div>
        <div
          class="w-1 cursor-ew-resize hover:bg-blue-400"
          @mousedown="startResize"
        ></div>
      </div>

      <!-- Editor -->
      <div class="flex-1 overflow-hidden editor-area" :class="{ 'focus-mode': focusMode }">
        <div v-show="!showPreview && !showSplit" class="w-full h-full">
          <textarea
            :value="activeTab?.content"
            @input="handleInput"
            @keydown="handleKeydown"
            class="editor-input dark:text-gray-200"
            placeholder="开始写作..."
          ></textarea>
        </div>

        <div v-show="showPreview && !showSplit" class="w-full h-full overflow-y-auto preview-area">
          <div class="markdown-body" v-html="renderedHTML"></div>
        </div>

        <div v-show="showSplit" class="w-full h-full flex">
          <div class="w-1/2 h-full border-r dark:border-gray-700">
            <textarea
              :value="activeTab?.content"
              @input="handleInput"
              @keydown="handleKeydown"
              class="editor-input dark:text-gray-200"
              placeholder="开始写作..."
            ></textarea>
          </div>
          <div class="w-1/2 h-full overflow-y-auto preview-area bg-white dark:bg-gray-900">
            <div class="markdown-body" v-html="renderedHTML"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="flex items-center gap-4 px-4 py-1 text-xs border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700 text-gray-500 dark:text-gray-400">
      <span :class="activeTab?.saved ? 'text-green-500' : 'text-orange-500'">
        {{ activeTab?.saved ? '✓ 已保存' : '● 未保存' }}
      </span>
      <span class="truncate max-w-48" :title="activeTab?.path || '未命名文档'">
        {{ activeTab?.path ? activeTab.path.split(/[/\\]/).pop() : '未命名文档' }}
      </span>
      <span>{{ charCount }} 字符</span>
      <span>{{ wordCount }} 词</span>
      <span v-if="selectedCount > 0" class="text-blue-500">选中 {{ selectedCount }} 字</span>
      <span v-if="typewriterMode" class="text-blue-500" title="打字机模式 (F9)">⌨️ 打字机</span>
      <span v-if="focusMode" class="text-purple-500" title="专注模式 (F8)">🎯 专注</span>
      <span class="ml-auto text-gray-400 dark:text-gray-500">自动保存: 30s</span>
    </div>
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

.toolbar-btn {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  background: transparent;
  border: none;
  color: #666;
  transition: background 0.2s;
}
.toolbar-btn:hover {
  background: #e5e5e5;
}
.dark .toolbar-btn {
  color: #aaa;
}
.dark .toolbar-btn:hover {
  background: #333;
}

/* 专注模式样式 */
.focus-mode .editor-input {
  line-height: 1.8;
}

.focus-mode .editor-input::placeholder {
  color: transparent;
}

/* Mermaid diagram styles */
.mermaid-diagram {
  margin: 1rem 0;
  text-align: center;
  overflow-x: auto;
}
.mermaid-diagram svg {
  max-width: 100%;
  height: auto;
}
.mermaid-error {
  background: #fee;
  padding: 1rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
}
.dark .mermaid-error {
  background: #422;
}

/* 编辑器区域样式 */
.editor-area {
  background: #fff;
  border: 1px solid #e5e5e5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.dark .editor-area {
  background: #1f2937;
  border-color: #374151;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* textarea 聚焦高亮 */
.editor-input {
  border: none;
  outline: none;
  transition: box-shadow 0.2s ease;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}
.editor-input:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}
.dark .editor-input {
  background: #1f2937;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}
.dark .editor-input:focus {
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.5);
}

/* 预览区域边框 */
.preview-area {
  border-left: 1px solid #e5e5e5;
}
.dark .preview-area {
  border-color: #374151;
}
</style>
