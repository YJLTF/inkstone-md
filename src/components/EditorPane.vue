<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import EditorTextarea from './EditorTextarea.vue';

defineProps<{
  content: string;
  renderedHtml: string;
  showSplit: boolean;
  showPreview: boolean;
}>();

defineEmits<{
  input: [e: Event];
  keydown: [e: KeyboardEvent];
  paste: [e: ClipboardEvent];
}>();

const splitRatio = ref(Number(localStorage.getItem('splitRatio')) || 50);
const isDragging = ref(false);
const splitContainer = ref<HTMLElement | null>(null);

// 阅读进度(0-1),预览区滚动时更新
const previewProgress = ref(0);

function onPreviewScroll(e: Event) {
  const el = e.target as HTMLElement;
  const max = el.scrollHeight - el.clientHeight;
  previewProgress.value = max > 0 ? el.scrollTop / max : 0;
}

function startSplitResize(e: MouseEvent) {
  e.preventDefault();
  isDragging.value = true;
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', doSplitResize);
  document.addEventListener('mouseup', stopSplitResize);
}

function doSplitResize(e: MouseEvent) {
  if (!isDragging.value || !splitContainer.value) return;
  const rect = splitContainer.value.getBoundingClientRect();
  const ratio = ((e.clientX - rect.left) / rect.width) * 100;
  splitRatio.value = Math.max(15, Math.min(85, ratio));
}

function stopSplitResize() {
  if (isDragging.value) {
    localStorage.setItem('splitRatio', String(splitRatio.value));
  }
  isDragging.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', doSplitResize);
  document.removeEventListener('mouseup', stopSplitResize);
}

onUnmounted(() => {
  document.removeEventListener('mousemove', doSplitResize);
  document.removeEventListener('mouseup', stopSplitResize);
});
</script>

<template>
  <div class="flex-1 overflow-hidden editor-area">
    <!-- 纯编辑模式 -->
    <div v-show="!showPreview && !showSplit" class="w-full h-full">
      <EditorTextarea
        :content="content"
        @input="$emit('input', $event)"
        @keydown="$emit('keydown', $event)"
        @paste="$emit('paste', $event)"
      />
    </div>

    <!-- 纯预览模式 -->
    <div v-show="showPreview && !showSplit" class="w-full h-full flex flex-col">
      <div class="ink-reading-progress" aria-hidden="true">
        <div class="ink-reading-progress-fill" :style="{ transform: `scaleX(${previewProgress})` }"></div>
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto preview-area" @scroll="onPreviewScroll">
        <div class="markdown-body" v-html="renderedHtml"></div>
      </div>
    </div>

    <!-- 分栏模式 -->
    <div v-show="showSplit" ref="splitContainer" class="w-full h-full flex">
      <div :style="{ width: splitRatio + '%' }" class="h-full overflow-hidden">
        <EditorTextarea
          :content="content"
          @input="$emit('input', $event)"
          @keydown="$emit('keydown', $event)"
          @paste="$emit('paste', $event)"
        />
      </div>
      <div
        class="split-divider"
        :class="{ active: isDragging }"
        @mousedown="startSplitResize"
      ></div>
      <div :style="{ width: (100 - splitRatio) + '%' }" class="h-full min-w-0 flex flex-col">
        <div class="ink-reading-progress" aria-hidden="true">
          <div class="ink-reading-progress-fill" :style="{ transform: `scaleX(${previewProgress})` }"></div>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto preview-area bg-white dark:bg-gray-900" @scroll="onPreviewScroll">
          <div class="markdown-body" v-html="renderedHtml"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 编辑器区域(布局属性在全局 style.css,此处仅视觉增强)。
   注意:预览内容(ink-codeblock / ink-table / 图片工具栏 / TOC / mermaid 等)
   的样式已统一迁移至 src/assets/markdown-body.css —— v-html 内容
   不携带本组件的 scoped 属性,且迁移后可随主题变量联动并同步进导出物。 */
.editor-area {
  background: #fff;
  border: 1px solid #e5e5e5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
}
.dark .editor-area {
  background: #1f2937;
  border-color: #374151;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.editor-input {
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
.preview-area {
  border-left: 1px solid transparent;
}
.dark .preview-area {
  border-color: transparent;
}

/* 阅读进度条:占预览面板顶部的独立布局空间,不参与滚动、不遮挡内容 */
.ink-reading-progress {
  flex-shrink: 0;
  width: 100%;
  height: 3px;
  background: var(--ink-md-border, #e5e7eb);
  overflow: hidden;
  pointer-events: none;
}
.ink-reading-progress-fill {
  width: 100%;
  height: 100%;
  background: var(--ink-md-accent, #3b82f6);
  transform-origin: left center;
  transform: scaleX(0);
  will-change: transform;
}

/* 分栏拖拽分隔条 */
.split-divider {
  width: 5px;
  flex-shrink: 0;
  cursor: ew-resize;
  background: #e5e7eb;
  position: relative;
  transition: background 150ms ease;
}
.split-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 3px;
  height: 32px;
  border-radius: 2px;
  background: #cbd5e1;
  transition: background 150ms ease;
}
.split-divider:hover,
.split-divider.active {
  background: #bfdbfe;
}
.split-divider:hover::after,
.split-divider.active::after {
  background: #3b82f6;
}
.dark .split-divider {
  background: #374151;
}
.dark .split-divider::after {
  background: #6b7280;
}
.dark .split-divider:hover,
.dark .split-divider.active {
  background: #1e3a5f;
}
.dark .split-divider:hover::after,
.dark .split-divider.active::after {
  background: #60a5fa;
}
</style>
