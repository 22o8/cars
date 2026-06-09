<template><NuxtLayout><NuxtPage /></NuxtLayout></template>
<script setup lang="ts">
const { initTheme } = useTheme()
onMounted(initTheme)
</script>
