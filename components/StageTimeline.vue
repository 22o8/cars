<script setup lang="ts">
import type { Transaction } from '~/types'
const props = defineProps<{ tx: Transaction }>()
const emit = defineEmits(['select'])
</script>
<template>
  <div class="timeline">
    <button v-for="(s,i) in tx.stages" :key="s.key" class="stage" :class="s.status" @click="emit('select',s)">
      <span class="dot">{{s.status==='done'?'✓':s.status==='blocked'?'!':i+1}}</span><span class="stage-label">{{s.label}}</span>
    </button>
  </div>
</template>
