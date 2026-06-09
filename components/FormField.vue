<template>
  <label class="form-field">
    <span class="form-label">{{ label }}</span>
    <slot />
    <span v-if="hint" class="form-hint">{{ hint }}</span>
  </label>
</template>
<script setup lang="ts">
defineProps<{ label: string; hint?: string }>()
</script>
