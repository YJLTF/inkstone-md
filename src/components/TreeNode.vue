<script setup lang="ts">
import { inject, computed } from "vue";
import type { FileEntry, TreeRoot } from "../types";
import { workspaceKey } from "../composables/useWorkspace";

const props = defineProps<{ entry: FileEntry; root: TreeRoot; depth: number }>();
const ws = inject(workspaceKey)!;

const isRenaming = computed(
  () => ws.renaming.value.active && ws.renaming.value.path === props.entry.path,
);
const isDragOver = computed(() => ws.dragOverPath.value === props.entry.path);
const arrow = computed(() => (props.entry.is_dir ? (props.entry.is_open ? "▾" : "▸") : ""));

const canDrag = computed(
  () => !(props.root.kind === "external" && props.entry.is_dir),
);

function toggle() {
  if (props.entry.is_dir) props.entry.is_open = !props.entry.is_open;
}

function onClick() {
  if (isRenaming.value) return;
  if (props.entry.is_dir) {
    props.entry.is_open = !props.entry.is_open;
  } else {
    ws.openFile(props.entry.path);
  }
}

function onContextmenu(e: MouseEvent) {
  ws.showContextMenu(e, props.entry, props.root);
}

function onDragstart(e: DragEvent) {
  if (!canDrag.value) {
    e.preventDefault();
    return;
  }
  ws.onDragStart(props.entry, props.root.kind);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", props.entry.path);
  }
}

function onDragover(e: DragEvent) {
  ws.onNodeDragOver(e, props.entry);
  if (e.defaultPrevented && e.dataTransfer) e.dataTransfer.dropEffect = "move";
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  ws.onNodeDrop(props.entry);
}
</script>

<template>
  <div>
    <div
      class="flex items-stretch cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
      :class="{ 'bg-blue-100 dark:bg-blue-900/40': isDragOver }"
      @click="onClick"
      @contextmenu="onContextmenu"
      @dragstart="onDragstart"
      @dragover="onDragover"
      @dragleave="ws.onNodeDragLeave(entry)"
      @drop="onDrop"
      @dragend="ws.onDragEnd()"
    >
      <!-- 树状缩进引导线:每层一条竖线 -->
      <span
        v-for="i in depth"
        :key="i"
        class="inline-block w-4 self-stretch border-l border-gray-200 dark:border-gray-700"
      ></span>
      <!-- 展开/收起箭头(目录),文件留空占位以对齐 -->
      <div class="flex items-center gap-1 flex-1 px-1 py-1 min-w-0">
        <span
          class="w-4 text-center text-gray-400 select-none flex-shrink-0"
          @click.stop="toggle"
        >{{ arrow }}</span>
        <span class="flex-shrink-0">{{ entry.is_dir ? (entry.is_open ? '📂' : '📁') : '📄' }}</span>
        <input
          v-if="isRenaming"
          class="rename-input px-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 min-w-0 flex-1"
          style="width: auto;"
          :value="ws.renaming.value.input"
          @input="ws.renaming.value.input = ($event.target as HTMLInputElement).value"
          @keydown.enter="ws.confirmRename()"
          @keydown.escape="ws.cancelRename()"
          @click.stop
          @blur="ws.confirmRename()"
        />
        <span v-else class="truncate">{{ entry.name }}</span>
      </div>
    </div>
    <template v-if="entry.is_dir && entry.is_open && entry.children">
      <TreeNode
        v-for="child in entry.children"
        :key="child.path"
        :entry="child"
        :root="root"
        :depth="depth + 1"
      />
    </template>
  </div>
</template>
