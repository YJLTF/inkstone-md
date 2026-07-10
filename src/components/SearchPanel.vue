<script setup lang="ts">
const searchQuery = defineModel<string>('searchQuery', { required: true });
const replaceQuery = defineModel<string>('replaceQuery', { required: true });

defineProps<{
  visible: boolean;
  matchCount: number;
  currentIndex: number;
}>();

defineEmits<{
  'next': [];
  'prev': [];
  'replace-current': [];
  'replace-all': [];
  'close': [];
}>();
</script>

<template>
  <div
    v-show="visible"
    class="search-panel flex items-center gap-2 px-3 py-2 border-b bg-gray-100 dark:bg-gray-800 dark:border-gray-700"
  >
    <input
      v-model="searchQuery"
      type="text"
      placeholder="搜索..."
      class="search-input px-2 py-1 text-sm border rounded flex-1 max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
      @keydown.enter="$emit('next')"
    />
    <input
      v-model="replaceQuery"
      type="text"
      placeholder="替换为..."
      class="px-2 py-1 text-sm border rounded flex-1 max-w-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
      @keydown.enter="$emit('replace-current')"
    />
    <span class="text-xs text-gray-500 dark:text-gray-400">
      {{ matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : '0/0' }}
    </span>
    <button @click="$emit('prev')" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">↑ 上一条</button>
    <button @click="$emit('next')" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">↓ 下一条</button>
    <button @click="$emit('replace-current')" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">替换</button>
    <button @click="$emit('replace-all')" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">全部替换</button>
    <button @click="$emit('close')" class="px-2 py-1 text-sm border rounded hover:bg-gray-200 dark:hover:bg-gray-700">× 关闭</button>
  </div>
</template>
