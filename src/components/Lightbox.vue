<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { X, ZoomIn, ZoomOut, RotateCcw } from '@lucide/vue';

const props = defineProps<{ src: string | null }>();

const emit = defineEmits<{ close: [] }>();

const scale = ref(1);

// 仅在灯箱打开期间监听键盘,关闭即摘除
watch(() => props.src, (s) => {
  if (s) {
    scale.value = 1;
    window.addEventListener('keydown', onKey, true);
  } else {
    window.removeEventListener('keydown', onKey, true);
  }
}, { immediate: true });

onUnmounted(() => window.removeEventListener('keydown', onKey, true));

function zoom(delta: number) {
  scale.value = Math.min(5, Math.max(0.2, Math.round((scale.value + delta) * 100) / 100));
}

function onWheel(e: WheelEvent) {
  zoom(e.deltaY < 0 ? 0.15 : -0.15);
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    emit('close');
  } else if (e.key === '+' || e.key === '=') {
    zoom(0.25);
  } else if (e.key === '-') {
    zoom(-0.25);
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="src" class="ink-lightbox" @click.self="emit('close')" @wheel.prevent="onWheel">
      <img :src="src" alt="" :style="{ transform: `scale(${scale})` }" />
      <div class="ink-lightbox-bar" @click.stop>
        <button title="缩小 (-)" @click="zoom(-0.25)"><ZoomOut :size="16" /></button>
        <span class="ink-lightbox-scale">{{ Math.round(scale * 100) }}%</span>
        <button title="放大 (+)" @click="zoom(0.25)"><ZoomIn :size="16" /></button>
        <button title="重置 (100%)" @click="scale = 1"><RotateCcw :size="16" /></button>
        <span class="ink-lightbox-sep"></span>
        <button title="关闭 (Esc)" @click="emit('close')"><X :size="16" /></button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ink-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  animation: ink-lightbox-in 0.15s ease-out;
}
@keyframes ink-lightbox-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.ink-lightbox img {
  max-width: 92vw;
  max-height: 92vh;
  transition: transform 0.12s ease-out;
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  user-select: none;
  -webkit-user-drag: none;
}
.ink-lightbox-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(31, 41, 55, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  color: #e5e7eb;
  font-size: 13px;
  user-select: none;
}
.ink-lightbox-bar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.ink-lightbox-bar button:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.ink-lightbox-scale {
  min-width: 44px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.ink-lightbox-sep {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}
</style>
