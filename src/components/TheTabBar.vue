<script setup lang="ts">
import { PanelLeft, Plus, X } from '@lucide/vue';
import type { Tab } from '../types';

defineProps<{
  tabs: Tab[];
  activeTabId: string | null;
  showSidebar: boolean;
}>();

defineEmits<{
  'toggle-sidebar': [];
  'set-active': [id: string];
  'close-tab': [id: string, e: MouseEvent];
  'new-tab': [];
}>();
</script>

<template>
  <div class="tab-bar flex items-center gap-1 px-2 py-1 border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700 overflow-x-auto">
    <button
      @click="$emit('toggle-sidebar')"
      class="tab-icon-btn"
      :class="{ active: showSidebar }"
      title="文件树 (Ctrl+B)"
    >
      <PanelLeft :size="16" />
    </button>
    <div
      v-for="tab in tabs"
      :key="tab.id"
      @click="$emit('set-active', tab.id)"
      @auxclick="(e: MouseEvent) => { if (e.button === 1) $emit('close-tab', tab.id, e); }"
      class="tab-item"
      :class="{ active: tab.id === activeTabId }"
    >
      <span class="max-w-32 truncate">{{ tab.name }}</span>
      <span v-if="!tab.saved" class="tab-unsaved" title="未保存"></span>
      <button
        @click.stop="$emit('close-tab', tab.id, $event)"
        class="tab-close"
        title="关闭"
      >
        <X :size="12" />
      </button>
    </div>
    <button @click="$emit('new-tab')" class="tab-icon-btn" title="新建标签 (Ctrl+N)">
      <Plus :size="14" />
    </button>
  </div>
</template>

<style scoped>
.tab-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 5px;
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
  flex-shrink: 0;
}
.tab-icon-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #111827;
}
.tab-icon-btn.active {
  background: rgba(0, 0, 0, 0.08);
  color: #2563eb;
}
.dark .tab-icon-btn {
  color: #9ca3af;
}
.dark .tab-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f3f4f6;
}
.dark .tab-icon-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: #93c5fd;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px 0 12px;
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
  color: #4b5563;
  background: transparent;
  border-bottom: 2px solid transparent;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
  flex-shrink: 0;
  position: relative;
  user-select: none;
}
.tab-item:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #111827;
}
.tab-item.active {
  background: #ffffff;
  color: #111827;
  border-bottom-color: #2563eb;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.tab-item:hover .tab-close {
  opacity: 1;
}
.dark .tab-item {
  color: #9ca3af;
}
.dark .tab-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #f3f4f6;
}
.dark .tab-item.active {
  background: #1f2937;
  color: #f3f4f6;
  border-bottom-color: #60a5fa;
}

.tab-unsaved {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
  flex-shrink: 0;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0;
  transition: opacity 150ms ease, background-color 100ms ease, color 100ms ease;
}
.tab-close:hover {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}
.tab-item.active .tab-close {
  opacity: 0.6;
}
</style>
