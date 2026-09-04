<script setup lang="ts">
// 编辑区 textarea(纯编辑模式与分栏模式共用,消除模板重复)
defineProps<{ content: string }>();

defineEmits<{
  input: [e: Event];
  keydown: [e: KeyboardEvent];
  paste: [e: ClipboardEvent];
}>();
</script>

<template>
  <textarea
    :value="content"
    @input="$emit('input', $event)"
    @keydown="$emit('keydown', $event)"
    @paste="$emit('paste', $event)"
    class="editor-input dark:text-gray-200"
    placeholder="开始写作..."
  ></textarea>
</template>
