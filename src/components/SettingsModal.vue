<script setup lang="ts">
import { X } from '@lucide/vue';

defineProps<{
  show: boolean;
  readerFont: string;
  readerFontSize: string;
  readerWidth: string;
  hljsTheme: string;
  hljsThemeOptions: { value: string; label: string }[];
}>();

defineEmits<{
  close: [];
  'set-font': [v: string];
  'set-font-size': [v: string];
  'set-width': [v: string];
  'set-hljs-theme': [v: string];
}>();

const fontOptions = [
  { value: 'auto', label: '跟随主题' },
  { value: 'sans', label: '无衬线' },
  { value: 'serif', label: '衬线' },
];

const fontSizeOptions = [
  { value: 'auto', label: '跟随主题' },
  { value: '14', label: '14px' },
  { value: '15', label: '15px' },
  { value: '16', label: '16px' },
  { value: '18', label: '18px' },
  { value: '20', label: '20px' },
];

const widthOptions = [
  { value: 'auto', label: '跟随主题' },
  { value: '720', label: '窄 (720px)' },
  { value: '820', label: '中 (820px)' },
  { value: '1000', label: '宽 (1000px)' },
];
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card settings-card">
        <div class="modal-header">
          <h3>阅读偏好</h3>
          <button class="modal-close" @click="$emit('close')"><X :size="15" /></button>
        </div>
        <div class="modal-body">
          <div class="settings-group">
            <label class="settings-label">正文字体</label>
            <div class="settings-options">
              <button
                v-for="opt in fontOptions"
                :key="opt.value"
                class="settings-option"
                :class="{ active: readerFont === opt.value }"
                @click="$emit('set-font', opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>

          <div class="settings-group">
            <label class="settings-label">字号</label>
            <div class="settings-options">
              <button
                v-for="opt in fontSizeOptions"
                :key="opt.value"
                class="settings-option"
                :class="{ active: readerFontSize === opt.value }"
                @click="$emit('set-font-size', opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>

          <div class="settings-group">
            <label class="settings-label">内容行宽</label>
            <div class="settings-options">
              <button
                v-for="opt in widthOptions"
                :key="opt.value"
                class="settings-option"
                :class="{ active: readerWidth === opt.value }"
                @click="$emit('set-width', opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>

          <div class="settings-group">
            <label class="settings-label">代码高亮主题</label>
            <div class="settings-options">
              <button
                v-for="opt in hljsThemeOptions"
                :key="opt.value"
                class="settings-option"
                :class="{ active: hljsTheme === opt.value }"
                @click="$emit('set-hljs-theme', opt.value)"
              >{{ opt.label }}</button>
            </div>
            <p class="settings-hint">「自动」跟随应用深浅色切换;导出 HTML / PDF 使用此处所选主题。</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-card {
  width: 460px;
}
.settings-group {
  margin-bottom: 18px;
}
.settings-group:last-child {
  margin-bottom: 4px;
}
.settings-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #374151;
}
.dark .settings-label {
  color: #d1d5db;
}
.settings-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.settings-option {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: transparent;
  color: #4b5563;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.settings-option:hover {
  border-color: #9ca3af;
}
.settings-option.active {
  background: rgba(59, 130, 246, 0.12);
  border-color: #3b82f6;
  color: #2563eb;
  font-weight: 500;
}
.dark .settings-option {
  border-color: #374151;
  color: #9ca3af;
}
.dark .settings-option:hover {
  border-color: #6b7280;
}
.dark .settings-option.active {
  background: rgba(96, 165, 250, 0.18);
  border-color: #60a5fa;
  color: #93c5fd;
}
.settings-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.5;
}
</style>
