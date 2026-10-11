<script setup lang="ts">defineProps<{ status: string }>()
const map:any={pending:'لم تبدأ',active:'قيد العمل',done:'مكتملة',blocked:'متوقفة'}
</script>
<template><span class="status" :class="status">{{map[status]||status}}</span></template>
