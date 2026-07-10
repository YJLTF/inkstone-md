<script setup lang="ts">
import { X } from '@lucide/vue';

defineProps<{
  modelValue: boolean;
  shortcuts: { group: string; key: string; desc: string }[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
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
            <tr v-for="(s, i) in shortcuts" :key="i">
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
:global(.dark) .shortcuts-table th,
:global(.dark) .shortcuts-table td {
  border-color: #374151;
}
.shortcuts-table th {
  font-weight: 600;
  color: #6b7280;
}
:global(.dark) .shortcuts-table th {
  color: #9ca3af;
}
.shortcuts-table code {
  background: rgba(127, 127, 127, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
