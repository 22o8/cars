<template>
  <div class="mb-6 flex flex-wrap gap-3">
    <NuxtLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="btn btn-secondary" :class="route.path===tab.to ? 'btn-primary' : ''">
      {{ tab.label }}
    </NuxtLink>
  </div>
</template>
<script setup lang="ts">
const route = useRoute()
const tabs = [
  { to: '/settings/system', label: 'إعدادات النظام' },
  { to: '/settings/account', label: 'إعدادات الحساب' },
  { to: '/settings/backup', label: 'النسخ الاحتياطي والضبط' }
]
</script>
