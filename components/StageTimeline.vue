<script setup lang="ts">
import type { Transaction } from '~/types'
defineProps<{ tx: Transaction }>()
</script>
<template>
  <div class="timeline">
    <div v-for="(s,i) in tx.stages" :key="s.key" class="stage" :class="s.status">
      <span class="dot">{{s.status==='done'?'✓':s.status==='blocked'?'!':i+1}}</span><span class="stage-label">{{s.label}}</span>
    </div>
  </div>
</template>
