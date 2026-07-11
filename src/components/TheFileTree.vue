<script setup lang="ts">
import { inject, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import TreeNode from "./TreeNode.vue";
import { workspaceKey } from "../composables/useWorkspace";

const ws = inject(workspaceKey)!;
const {
  libraryRoot,
  externalRoots,
  contextMenu,
  dragOverPath,
  menuCanNewFile,
  menuCanNewFolder,
  menuCanRename,
  menuCanDelete,
  menuCanMove,
  reloadLibrary,
  migrateLibrary,
  showContextMenuOnTree,
  removeRecentFolder,
  handleNewFile,
  handleNewFolder,
  handleRename,
  handleDelete,
  moveEntryTo,
  onContainerDragOver,
  onContainerDrop,
} = ws;

const hasTarget = computed(() => !!contextMenu.value.target);

async function reveal(path: string) {
  try {
    await invoke("reveal_in_folder", { path });
  } catch (e) {
    alert("打开失败: " + e);
  }
}

function moveCurrent() {
  const t = contextMenu.value.target!;
  const k = contextMenu.value.rootKind!;
  moveEntryTo(t, k);
}
</script>

<template>
  <div class="file-tree select-none pb-4">
    <!-- 库根(蓝色系) -->
    <div
      v-if="libraryRoot"
      class="root-section rounded border border-blue-200 dark:border-blue-900 mb-2 overflow-hidden"
      @contextmenu.prevent.stop="showContextMenuOnTree($event, libraryRoot)"
    >
      <div
        class="flex items-center gap-1 px-2 py-1 text-xs font-semibold sticky top-0 z-10 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200"
        :class="{ 'ring-2 ring-inset ring-blue-400': dragOverPath === libraryRoot.path }"
        @dragover="onContainerDragOver($event, libraryRoot.path)"
        @drop.prevent.stop="onContainerDrop(libraryRoot.path)"
      >
        <span
          class="w-4 text-center cursor-pointer select-none"
          @click="libraryRoot.is_open = !libraryRoot.is_open"
        >{{ libraryRoot.is_open ? '▾' : '▸' }}</span>
        <span class="flex-1 truncate cursor-pointer" :title="libraryRoot.path" @click="libraryRoot.is_open = !libraryRoot.is_open">📚 {{ libraryRoot.label }}</span>
        <span class="px-1 rounded bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-[10px]">库</span>
        <button class="opacity-60 hover:opacity-100 hover:text-blue-600" title="刷新" @click="reloadLibrary()">🔄</button>
        <button class="opacity-60 hover:opacity-100 hover:text-blue-600" title="在资源管理器中打开" @click="reveal(libraryRoot.path)">📂</button>
        <button class="opacity-60 hover:opacity-100 hover:text-blue-600" title="迁移库到其他位置" @click="migrateLibrary()">⋯</button>
      </div>
      <div v-if="libraryRoot.is_open">
        <div v-if="libraryRoot.invalid" class="text-xs text-red-500 px-2 py-1">库目录不可访问</div>
        <div v-else-if="libraryRoot.entries.length === 0" class="text-xs text-gray-400 dark:text-gray-500 px-2 py-3 text-center">
          📝 开始新建你的第一篇文档<br />
          <span class="text-gray-300 dark:text-gray-600">右键此处可新建</span>
        </div>
        <template v-else>
          <TreeNode
            v-for="e in libraryRoot.entries"
            :key="e.path"
            :entry="e"
            :root="libraryRoot"
            :depth="0"
          />
        </template>
      </div>
    </div>

    <!-- 外部文件夹根(琥珀色系,与库明显区分) -->
    <div
      v-for="root in externalRoots"
      :key="root.path"
      class="root-section rounded border border-amber-300 dark:border-amber-800 mb-2 overflow-hidden"
      @contextmenu.prevent.stop="showContextMenuOnTree($event, root)"
    >
      <div
        class="flex items-center gap-1 px-2 py-1 text-xs font-semibold sticky top-0 z-10 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200"
        :class="{ 'ring-2 ring-inset ring-amber-400': dragOverPath === root.path }"
        @dragover="!root.invalid && onContainerDragOver($event, root.path)"
        @drop.prevent.stop="!root.invalid && onContainerDrop(root.path)"
      >
        <span
          class="w-4 text-center cursor-pointer select-none"
          @click="root.is_open = !root.is_open"
        >{{ root.is_open ? '▾' : '▸' }}</span>
        <span class="flex-1 truncate cursor-pointer" :title="root.path" @click="root.is_open = !root.is_open">📁 {{ root.label }}</span>
        <span class="px-1 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 text-[10px]" title="外部文件夹:只读目录结构,仅可操作文件">外部</span>
        <button v-if="!root.invalid" class="opacity-60 hover:opacity-100 hover:text-amber-700" title="在资源管理器中打开" @click="reveal(root.path)">📂</button>
        <button class="opacity-60 hover:opacity-100 hover:text-red-500" title="关闭并从最近记录移除" @click="removeRecentFolder(root.path)">✕</button>
      </div>
      <div v-if="root.is_open">
        <div v-if="root.invalid" class="text-xs text-red-500 px-2 py-1 flex items-center justify-between gap-2">
          <span>⚠️ 路径已失效</span>
          <button
            class="text-xs px-2 py-0.5 rounded border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
            @click="removeRecentFolder(root.path)"
          >移除</button>
        </div>
        <template v-else>
          <TreeNode
            v-for="e in root.entries"
            :key="e.path"
            :entry="e"
            :root="root"
            :depth="0"
          />
        </template>
      </div>
    </div>

    <!-- 右键菜单(按权限动态显示项) -->
    <div
      v-if="contextMenu.visible"
      class="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-1 z-50 min-w-[160px]"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @contextmenu.prevent.stop
    >
      <div v-if="menuCanNewFile" class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" @click="handleNewFile">📄 新建文件</div>
      <div v-if="menuCanNewFolder" class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" @click="handleNewFolder">📁 新建文件夹</div>
      <template v-if="hasTarget">
        <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
        <div v-if="menuCanRename" class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" @click="handleRename">✏️ 重命名</div>
        <div v-if="menuCanMove" class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" @click="moveCurrent">📦 移动到…</div>
        <div v-if="menuCanDelete" class="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-red-500" @click="handleDelete">🗑️ 删除</div>
      </template>
    </div>
  </div>
</template>
