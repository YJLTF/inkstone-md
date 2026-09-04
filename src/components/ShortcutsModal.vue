<script setup lang="ts">
import { X } from '@lucide/vue';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

// 快捷键清单(单一数据源,README 的快捷键表与此对照)
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
</script>

<template>
  <div
    v-if="modelValue"
    class="modal-overlay"
    @click.self="emit('update:modelValue', false)"
  >
    <div class="modal-card">
      <div class="modal-header">
        <h3>快捷键</h3>
        <button class="modal-close" title="关闭 (Esc)" @click="emit('update:modelValue', false)">
          <X :size="16" />
        </button>
      </div>
      <div class="modal-body">
        <table class="shortcuts-table">
          <thead>
            <tr><th>分组</th><th>快捷键</th><th>功能</th></tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in SHORTCUTS" :key="i">
              <td class="text-gray-500 dark:text-gray-400">{{ s.group }}</td>
              <td><code>{{ s.key }}</code></td>
              <td>{{ s.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.shortcuts-table th,
.shortcuts-table td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid #e5e7eb;
}
.dark .shortcuts-table th,
.dark .shortcuts-table td {
  border-color: #374151;
}
.shortcuts-table th {
  font-weight: 600;
  color: #6b7280;
}
.dark .shortcuts-table th {
  color: #9ca3af;
}
.shortcuts-table code {
  background: rgba(127, 127, 127, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
