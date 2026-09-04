<script setup lang="ts">
import { getFileName } from '../utils';

defineProps<{
  saved: boolean;
  path: string | null;
  charCount: number;
  wordCount: number;
  selectedCount: number;
  showSplit: boolean;
  scrollSync: boolean;
}>();

defineEmits<{
  'toggle-scroll-sync': [];
}>();
</script>

<template>
  <div class="flex items-center gap-4 px-4 py-1 text-xs border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700 text-gray-500 dark:text-gray-400">
    <span :class="saved ? 'text-green-500' : 'text-orange-500'">
      {{ saved ? '✓ 已保存' : '● 未保存' }}
    </span>
    <span class="truncate max-w-48" :title="path || '未命名文档'">
      {{ path ? getFileName(path) : '未命名文档' }}
    </span>
    <span>{{ charCount }} 字符</span>
    <span>{{ wordCount }} 词</span>
    <span v-if="selectedCount > 0" class="text-blue-500">选中 {{ selectedCount }} 字</span>
    <span
      v-if="showSplit"
      @click="$emit('toggle-scroll-sync')"
      :class="scrollSync ? 'text-blue-500 cursor-pointer hover:text-blue-600' : 'text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-500 dark:hover:text-gray-400'"
      :title="scrollSync ? '滚动同步已开启 (F7)' : '滚动同步已暂停 (F7)'"
    >🔗 {{ scrollSync ? '同步' : '已暂停' }}</span>
    <span class="ml-auto text-gray-400 dark:text-gray-500">自动保存: 30s</span>
  </div>
</template>
