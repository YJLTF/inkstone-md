<script setup lang="ts">
import { Printer, X } from '@lucide/vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
}>();
</script>

<template>
  <div v-if="visible" class="print-hint" role="alert">
    <Printer :size="18" class="print-hint-icon" />
    <div class="print-hint-body flex-1">
      <strong class="print-hint-title">PDF 导出说明</strong>
      系统打印对话框已就绪。在「打印机」下拉里选 <strong>另存为 PDF</strong>（Microsoft Edge 自带），文件名会自动填为当前文档名、文字可选可搜索、样式与预览完全一致。若选 <code>Microsoft Print to PDF</code>（系统虚拟打印机）则文件名需手动填写。建议在「更多设置」中关闭<strong>页眉和页脚</strong>，以获得不含日期和标题的纯净 PDF。
    </div>
    <button class="print-hint-close" title="知道了" @click="emit('dismiss')">
      <X :size="14" />
    </button>
  </div>
</template>

<style scoped>
.print-hint {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 480px;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  color: #374151;
  font-size: 13px;
  line-height: 1.5;
  animation: print-hint-in 200ms ease-out;
}
.print-hint-icon {
  color: #2563eb;
  flex-shrink: 0;
  margin-top: 1px;
}
.print-hint-title {
  color: #111827;
  display: block;
  margin-bottom: 2px;
}
.print-hint-close {
  background: transparent;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: background-color 100ms ease, color 100ms ease;
}
.print-hint-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #374151;
}
.dark .print-hint {
  background: #1f2937;
  border-color: #374151;
  color: #d1d5db;
}
.dark .print-hint-title { color: #f3f4f6; }
.dark .print-hint-close { color: #6b7280; }
.dark .print-hint-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #d1d5db;
}
@keyframes print-hint-in {
  from { opacity: 0; transform: translate(-50%, -8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
</style>
