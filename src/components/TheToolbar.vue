<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  FilePlus, FolderOpen, Folder, Save,
  Heading1, Heading2, Heading3,
  Bold, Italic, Strikethrough, Code,
  List, ListOrdered, SquareCheck, Quote,
  Image, Link, Sigma, Code2, Table, ListTree,
  FileCode, Printer,
  Columns2, Eye, Pencil,
  Sun, Moon, MoreHorizontal, Feather,
} from '@lucide/vue';
import type { ViewMode, ThemeName, ThemeOption } from '../types';

defineProps<{
  viewMode: ViewMode;
  showSplit: boolean;
  showPreview: boolean;
  themeName: ThemeName;
  isDark: boolean;
  themeOptions: ThemeOption[];
}>();

defineEmits<{
  'new-tab': [];
  'open-file': [];
  'open-folder': [];
  'save-file': [];
  'insert-heading': [level: number];
  'insert-format': [fmt: string];
  'insert-text': [text: string];
  'insert-image': [];
  'export-html': [];
  'export-pdf': [];
  'set-view-mode': [mode: ViewMode];
  'set-theme': [name: ThemeName];
  'toggle-dark': [];
}>();

const toolbarRef = ref<HTMLElement | null>(null);
const overflowLevel = ref<0 | 1 | 2>(0);
const overflowMenuOpen = ref(false);

function updateOverflow() {
  const w = toolbarRef.value?.clientWidth ?? 0;
  if (w > 0 && w < 820) overflowLevel.value = 2;
  else if (w > 0 && w < 1080) overflowLevel.value = 1;
  else overflowLevel.value = 0;
}

let ro: ResizeObserver | null = null;

onMounted(() => {
  if (toolbarRef.value) {
    updateOverflow();
    ro = new ResizeObserver(() => updateOverflow());
    ro.observe(toolbarRef.value);
  }
  document.addEventListener('click', () => { overflowMenuOpen.value = false; });
});

onUnmounted(() => {
  ro?.disconnect();
});
</script>

<template>
  <div ref="toolbarRef" class="toolbar flex items-center gap-1 px-2 py-1.5 border-b bg-white dark:bg-gray-900 dark:border-gray-700">
    <div class="toolbar-brand flex items-center gap-1.5 pr-2 mr-1 select-none">
      <Feather :size="16" class="text-blue-500" />
      <span class="font-semibold text-sm text-gray-700 dark:text-gray-200">InkStone</span>
    </div>

    <div class="toolbar-group">
      <button @click="$emit('new-tab')" title="新建 (Ctrl+N)" class="toolbar-btn">
        <FilePlus :size="16" /><span class="toolbar-label">新建</span>
      </button>
      <button @click="$emit('open-file')" title="打开 (Ctrl+O)" class="toolbar-btn">
        <FolderOpen :size="16" /><span class="toolbar-label">打开</span>
      </button>
      <button @click="$emit('open-folder')" title="打开文件夹" class="toolbar-btn">
        <Folder :size="16" /><span class="toolbar-label">文件夹</span>
      </button>
      <button @click="$emit('save-file')" title="保存 (Ctrl+S)" class="toolbar-btn">
        <Save :size="16" /><span class="toolbar-label">保存</span>
      </button>
    </div>

    <div class="toolbar-group">
      <button @click="$emit('insert-heading', 1)" title="一级标题" class="toolbar-btn">
        <Heading1 :size="16" />
      </button>
      <button @click="$emit('insert-heading', 2)" title="二级标题" class="toolbar-btn">
        <Heading2 :size="16" />
      </button>
      <button @click="$emit('insert-heading', 3)" title="三级标题" class="toolbar-btn">
        <Heading3 :size="16" />
      </button>
    </div>

    <div class="toolbar-group">
      <button @click="$emit('insert-format', '**')" title="粗体" class="toolbar-btn">
        <Bold :size="16" />
      </button>
      <button @click="$emit('insert-format', '*')" title="斜体" class="toolbar-btn">
        <Italic :size="16" />
      </button>
      <button @click="$emit('insert-format', '~~')" title="删除线" class="toolbar-btn">
        <Strikethrough :size="16" />
      </button>
      <button @click="$emit('insert-format', '`')" title="行内代码" class="toolbar-btn">
        <Code :size="16" />
      </button>
    </div>

    <div v-show="overflowLevel < 1" class="toolbar-group">
      <button @click="$emit('insert-text', '- ')" title="无序列表" class="toolbar-btn">
        <List :size="16" />
      </button>
      <button @click="$emit('insert-text', '1. ')" title="有序列表" class="toolbar-btn">
        <ListOrdered :size="16" />
      </button>
      <button @click="$emit('insert-text', '- [ ] ')" title="任务列表" class="toolbar-btn">
        <SquareCheck :size="16" />
      </button>
      <button @click="$emit('insert-text', '> ')" title="引用" class="toolbar-btn">
        <Quote :size="16" />
      </button>
    </div>

    <div v-show="overflowLevel < 2" class="toolbar-group">
      <button @click="$emit('insert-image')" title="插入图片" class="toolbar-btn">
        <Image :size="16" />
      </button>
      <button @click="$emit('insert-text', '[链接](url)')" title="链接" class="toolbar-btn">
        <Link :size="16" />
      </button>
      <button @click="$emit('insert-text', '$$')" title="数学公式" class="toolbar-btn">
        <Sigma :size="16" />
      </button>
      <button @click="$emit('insert-text', '```\n\n```')" title="代码块" class="toolbar-btn">
        <Code2 :size="16" />
      </button>
      <button @click="$emit('insert-text', '| 表头 | 表头 |\n|------|------|\n| 单元格 | 单元格 |')" title="表格" class="toolbar-btn">
        <Table :size="16" />
      </button>
      <button @click="$emit('insert-text', '\n[[toc]]\n')" title="插入目录" class="toolbar-btn">
        <ListTree :size="16" />
      </button>
    </div>

    <div v-if="overflowLevel > 0" class="toolbar-group relative" @click.stop>
      <button
        @click="overflowMenuOpen = !overflowMenuOpen"
        title="更多工具"
        class="toolbar-btn"
        :class="{ active: overflowMenuOpen }"
      >
        <MoreHorizontal :size="16" />
      </button>
      <div
        v-if="overflowMenuOpen"
        class="overflow-menu absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-50 min-w-[180px]"
      >
        <template v-if="overflowLevel >= 1">
          <div class="overflow-menu-title">列表</div>
          <button @click="$emit('insert-text', '- ')" class="overflow-menu-item">
            <List :size="14" /><span>无序列表</span>
          </button>
          <button @click="$emit('insert-text', '1. ')" class="overflow-menu-item">
            <ListOrdered :size="14" /><span>有序列表</span>
          </button>
          <button @click="$emit('insert-text', '- [ ] ')" class="overflow-menu-item">
            <SquareCheck :size="14" /><span>任务列表</span>
          </button>
          <button @click="$emit('insert-text', '> ')" class="overflow-menu-item">
            <Quote :size="14" /><span>引用</span>
          </button>
        </template>
        <template v-if="overflowLevel >= 2">
          <div class="overflow-menu-divider"></div>
          <div class="overflow-menu-title">插入</div>
          <button @click="$emit('insert-image')" class="overflow-menu-item">
            <Image :size="14" /><span>图片</span>
          </button>
          <button @click="$emit('insert-text', '[链接](url)')" class="overflow-menu-item">
            <Link :size="14" /><span>链接</span>
          </button>
          <button @click="$emit('insert-text', '$$')" class="overflow-menu-item">
            <Sigma :size="14" /><span>数学公式</span>
          </button>
          <button @click="$emit('insert-text', '```\n\n```')" class="overflow-menu-item">
            <Code2 :size="14" /><span>代码块</span>
          </button>
          <button @click="$emit('insert-text', '| 表头 | 表头 |\n|------|------|\n| 单元格 | 单元格 |')" class="overflow-menu-item">
            <Table :size="14" /><span>表格</span>
          </button>
          <button @click="$emit('insert-text', '\n[[toc]]\n')" class="overflow-menu-item">
            <ListTree :size="14" /><span>目录</span>
          </button>
        </template>
      </div>
    </div>

    <div class="flex-1"></div>

    <div class="toolbar-group">
      <button @click="$emit('export-html')" title="导出 HTML" class="toolbar-btn">
        <FileCode :size="16" /><span class="toolbar-label">HTML</span>
      </button>
      <button @click="$emit('export-pdf')" title="导出 PDF(系统打印)" class="toolbar-btn">
        <Printer :size="16" /><span class="toolbar-label">PDF</span>
      </button>
    </div>

    <div class="toolbar-group">
      <button
        @click="$emit('set-view-mode', 'edit')"
        class="toolbar-btn"
        :class="{ active: viewMode === 'edit' }"
        title="编辑视图 (Ctrl+\)"
      >
        <Pencil :size="16" />
      </button>
      <button
        @click="$emit('set-view-mode', 'split')"
        class="toolbar-btn"
        :class="{ active: showSplit }"
        title="分栏视图"
      >
        <Columns2 :size="16" />
      </button>
      <button
        @click="$emit('set-view-mode', 'preview')"
        class="toolbar-btn"
        :class="{ active: showPreview }"
        title="预览视图"
      >
        <Eye :size="16" />
      </button>
    </div>

    <div class="toolbar-group">
      <select
        :value="themeName"
        @change="(e: any) => $emit('set-theme', e.target.value)"
        class="toolbar-select"
        title="切换主题"
      >
        <option v-for="opt in themeOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <button
        @click="$emit('toggle-dark')"
        class="toolbar-btn"
        :title="isDark ? '切换到浅色' : '切换到深色'"
      >
        <Sun v-if="isDark" :size="16" class="theme-toggle-icon" />
        <Moon v-else :size="16" class="theme-toggle-icon" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  min-height: 40px;
  user-select: none;
  -webkit-app-region: no-drag;
}
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  height: 30px;
  border-radius: 6px;
  background: transparent;
  transition: background 150ms ease;
}
.toolbar-group + .toolbar-group {
  margin-left: 2px;
  border-left: 1px solid rgba(0, 0, 0, 0.06);
  padding-left: 8px;
  margin-left: 4px;
}
:global(.dark) .toolbar-group + .toolbar-group {
  border-left-color: rgba(255, 255, 255, 0.08);
}
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  min-width: 28px;
  padding: 0 6px;
  border-radius: 5px;
  background: transparent;
  border: none;
  color: #4b5563;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease, transform 100ms ease;
  -webkit-user-select: none;
  user-select: none;
  font-size: 13px;
  line-height: 1;
}
.toolbar-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #111827;
}
.toolbar-btn:active { transform: scale(0.96); }
.toolbar-btn:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.5);
  outline-offset: 1px;
}
.toolbar-btn.active {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}
:global(.dark) .toolbar-btn { color: #9ca3af; }
:global(.dark) .toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f3f4f6;
}
:global(.dark) .toolbar-btn.active {
  background: rgba(96, 165, 250, 0.18);
  color: #93c5fd;
}
.toolbar-label {
  font-size: 12px;
  font-weight: 500;
}
.toolbar-select {
  height: 28px;
  padding: 0 6px;
  border-radius: 5px;
  background: transparent;
  border: 1px solid transparent;
  color: #4b5563;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
  outline: none;
}
.toolbar-select:hover {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.08);
}
:global(.dark) .toolbar-select { color: #9ca3af; }
:global(.dark) .toolbar-select:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}
.theme-toggle-icon { transition: transform 200ms ease; }
.toolbar-btn:hover .theme-toggle-icon { transform: rotate(20deg); }

.overflow-menu { animation: overflow-fade-in 120ms ease-out; }
@keyframes overflow-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.overflow-menu-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9ca3af;
  padding: 6px 12px 4px;
}
.overflow-menu-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 4px 0;
}
:global(.dark) .overflow-menu-divider { background: rgba(255, 255, 255, 0.08); }
.overflow-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  background: transparent;
  border: none;
  color: #374151;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 100ms ease;
}
.overflow-menu-item:hover { background: rgba(0, 0, 0, 0.05); }
:global(.dark) .overflow-menu-item { color: #d1d5db; }
:global(.dark) .overflow-menu-item:hover { background: rgba(255, 255, 255, 0.06); }
</style>
