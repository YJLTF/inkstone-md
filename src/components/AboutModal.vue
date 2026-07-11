<script setup lang="ts">
import { X, Feather } from '@lucide/vue';

defineProps<{
  modelValue: boolean;
  version: string;
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
    <div class="modal-card about-card">
      <div class="modal-header">
        <h3>关于 InkStone MD</h3>
        <button class="modal-close" title="关闭 (Esc)" @click="emit('update:modelValue', false)">
          <X :size="16" />
        </button>
      </div>
      <div class="modal-body about-body">
        <div class="about-logo"><Feather :size="40" /></div>
        <div class="about-name">InkStone MD</div>
        <div class="about-version">版本 {{ version }}</div>
        <p class="about-desc">轻量、优雅的桌面 Markdown 编辑器</p>
        <p class="about-meta">技术栈: Tauri 2 + Vue 3</p>
        <p class="about-meta">许可证: GPL-3.0</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-card {
  width: 380px;
}
.about-body {
  text-align: center;
  padding: 28px 20px;
}
.about-logo {
  color: #3b82f6;
  margin-bottom: 10px;
}
.dark .about-logo {
  color: #60a5fa;
}
.about-name {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
}
.about-version {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 14px;
}
.dark .about-version {
  color: #9ca3af;
}
.about-desc {
  font-size: 13px;
  margin: 6px 0;
}
.about-meta {
  font-size: 12px;
  color: #6b7280;
  margin: 4px 0;
}
.dark .about-meta {
  color: #9ca3af;
}
</style>
