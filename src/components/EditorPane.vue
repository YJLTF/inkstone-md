<script setup lang="ts">
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
</script>

<template>
  <div class="flex-1 overflow-hidden editor-area">
    <!-- 纯编辑模式 -->
    <div v-show="!showPreview && !showSplit" class="w-full h-full">
      <textarea
        :value="content"
        @input="$emit('input', $event)"
        @keydown="$emit('keydown', $event)"
        @paste="$emit('paste', $event)"
        class="editor-input dark:text-gray-200"
        placeholder="开始写作..."
      ></textarea>
    </div>

    <!-- 纯预览模式 -->
    <div v-show="showPreview && !showSplit" class="w-full h-full overflow-y-auto preview-area">
      <div class="markdown-body" v-html="renderedHtml"></div>
    </div>

    <!-- 分栏模式 -->
    <div v-show="showSplit" class="w-full h-full flex">
      <div class="w-1/2 h-full border-r dark:border-gray-700">
        <textarea
          :value="content"
          @input="$emit('input', $event)"
          @keydown="$emit('keydown', $event)"
          @paste="$emit('paste', $event)"
          class="editor-input dark:text-gray-200"
          placeholder="开始写作..."
        ></textarea>
      </div>
      <div class="w-1/2 h-full overflow-y-auto preview-area bg-white dark:bg-gray-900">
        <div class="markdown-body" v-html="renderedHtml"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 编辑器区域 */
.editor-area {
  background: #fff;
  border: 1px solid #e5e5e5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
}
:global(.dark) .editor-area {
  background: #1f2937;
  border-color: #374151;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.editor-input {
  border: none;
  outline: none;
  width: 100%;
  height: 100%;
  resize: none;
  padding: 1rem;
  font-size: 16px;
  line-height: 1.8;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  transition: box-shadow 0.2s ease;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}
.editor-input:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}
:global(.dark) .editor-input {
  background: #1f2937;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}
:global(.dark) .editor-input:focus {
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.5);
}
.preview-area {
  border-left: 1px solid #e5e5e5;
}
:global(.dark) .preview-area {
  border-color: #374151;
}

/* Mermaid diagram */
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
:global(.dark) .mermaid-error {
  background: #422;
}

/* 图片交互 */
:deep(.ink-image-wrap) {
  position: relative;
  display: block;
  margin: 0.5em 0;
}
:deep(.ink-image-wrap:hover) :deep(.ink-image-toolbar) {
  opacity: 1;
  pointer-events: auto;
}
:deep(.ink-image-toolbar) {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  font-size: 12px;
  z-index: 5;
  user-select: none;
}
:global(.dark) :deep(.ink-image-toolbar) {
  background: rgba(31, 41, 55, 0.95);
  border-color: #4b5563;
  color: #e5e7eb;
}
:deep(.ink-image-toolbar button) {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 1.4;
  color: inherit;
}
:deep(.ink-image-toolbar button:hover) {
  background: rgba(59, 130, 246, 0.15);
}
:deep(.ink-image-scale) {
  padding: 0 4px;
  min-width: 38px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: #6b7280;
}
:global(.dark) :deep(.ink-image-scale) {
  color: #9ca3af;
}
:deep(.ink-image-sep) {
  width: 1px;
  height: 14px;
  background: #d1d5db;
  margin: 0 2px;
}
:global(.dark) :deep(.ink-image-sep) {
  background: #4b5563;
}

/* 目录([[toc]]) */
:deep(.ink-toc) {
  display: block;
  padding: 0.75em 1em;
  margin: 1em 0;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
  font-size: 0.95em;
}
:global(.dark) :deep(.ink-toc) {
  border-color: #374151;
  background: #1f2937;
}
:deep(.ink-toc-title) {
  font-weight: 600;
  margin-bottom: 0.5em;
  color: #6b7280;
  font-size: 0.85em;
  letter-spacing: 0.05em;
}
:deep(.ink-toc ul) {
  list-style: none;
  padding-left: 0;
  margin: 0;
}
:deep(.ink-toc ul ul) {
  padding-left: 1.2em;
  margin: 0.2em 0;
}
:deep(.ink-toc li) {
  margin: 0.2em 0;
}
:deep(.ink-toc a) {
  color: #2563eb;
  text-decoration: none;
  border-bottom: 1px dashed transparent;
}
:deep(.ink-toc a:hover) {
  border-bottom-color: #2563eb;
}
:global(.dark) :deep(.ink-toc a) {
  color: #93c5fd;
}
:global(.dark) :deep(.ink-toc a:hover) {
  border-bottom-color: #93c5fd;
}
:deep(.ink-toc-empty) {
  color: #9ca3af;
  font-style: italic;
}

/* 代码块工具栏 */
:deep(.ink-codeblock) {
  position: relative;
  margin: 1em 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}
:global(.dark) :deep(.ink-codeblock) {
  border-color: #374151;
}
:deep(.ink-codeblock-toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  user-select: none;
}
:global(.dark) :deep(.ink-codeblock-toolbar) {
  background: #1f2937;
  border-bottom-color: #374151;
}
:deep(.ink-codeblock-lang) {
  color: #6b7280;
  text-transform: lowercase;
  font-family: ui-monospace, monospace;
}
:global(.dark) :deep(.ink-codeblock-lang) {
  color: #9ca3af;
}
:deep(.ink-codeblock-copy) {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
:deep(.ink-codeblock-copy:hover) {
  background: #f3f4f6;
  border-color: #9ca3af;
}
:deep(.ink-codeblock-copy.copied) {
  background: #10b981;
  color: #fff;
  border-color: #10b981;
}
:global(.dark) :deep(.ink-codeblock-copy) {
  background: #374151;
  color: #e5e7eb;
  border-color: #4b5563;
}
:global(.dark) :deep(.ink-codeblock-copy:hover) {
  background: #4b5563;
  border-color: #6b7280;
}
:deep(.ink-codeblock-body) {
  display: block;
}
:deep(.ink-codeblock pre) {
  margin: 0;
  border-radius: 0;
  border: none;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding: 0;
  line-height: 1.5;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 0.9em;
}
:deep(.ink-codeblock pre code) {
  display: block;
  flex: 1 1 auto;
  padding: 1em 1em 1em 0.6em;
  margin: 0;
  background: transparent;
  white-space: pre;
  overflow-x: auto;
}
:deep(.ink-codeblock .line) {
  display: block;
  min-height: 1.5em;
}
:deep(.ink-codeblock .ink-line-nums) {
  list-style: none;
  margin: 0;
  padding: 1em 0.5em 1em 1em;
  text-align: right;
  color: #9ca3af;
  user-select: none;
  background: rgba(0, 0, 0, 0.04);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  flex: 0 0 auto;
}
:global(.dark) :deep(.ink-codeblock .ink-line-nums) {
  background: rgba(255, 255, 255, 0.04);
  border-right-color: rgba(255, 255, 255, 0.06);
  color: #6b7280;
}
:deep(.ink-codeblock .ink-line-nums li) {
  font-size: 0.85em;
}

/* 表格工具栏 */
:deep(.ink-table) {
  position: relative;
  margin: 1em 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}
:global(.dark) :deep(.ink-table) {
  border-color: #374151;
}
:deep(.ink-table-toolbar) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  user-select: none;
  flex-wrap: wrap;
}
:global(.dark) :deep(.ink-table-toolbar) {
  background: #1f2937;
  border-bottom-color: #374151;
}
:deep(.ink-table-toolbar button) {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
:deep(.ink-table-toolbar button:hover) {
  background: #f3f4f6;
  border-color: #9ca3af;
}
:deep(.ink-table-toolbar button.copied) {
  background: #10b981;
  color: #fff;
  border-color: #10b981;
}
:global(.dark) :deep(.ink-table-toolbar button) {
  background: #374151;
  color: #e5e7eb;
  border-color: #4b5563;
}
:global(.dark) :deep(.ink-table-toolbar button:hover) {
  background: #4b5563;
  border-color: #6b7280;
}
:deep(.ink-table table) {
  margin: 0;
  border: none;
  border-radius: 0;
}
:deep(.ink-table[data-edit="true"]) :deep(th),
:deep(.ink-table[data-edit="true"]) :deep(td) {
  outline: 1px dashed #93c5fd;
  outline-offset: -1px;
  background: rgba(59, 130, 246, 0.04);
  cursor: text;
}
:deep(.ink-table[data-edit="true"]) :deep(th:focus),
:deep(.ink-table[data-edit="true"]) :deep(td:focus) {
  outline: 2px solid #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}
</style>
