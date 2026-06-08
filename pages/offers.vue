<template><section class="page-pad"><div class="card p-6"><h1 class="text-2xl font-black">تم دمج هذه الصفحة</h1><p class="text-muted mt-2">تم حذف الصفحات الزائدة ودمج وظائفها داخل الصفحة الأساسية حتى يكون النظام أسرع وأوضح.</p><NuxtLink class="btn-primary btn mt-4 inline-flex" to="/">رجوع للوحة التحكم</NuxtLink></div></section></template>
<script setup lang="ts">
const route = useRoute()
onMounted(()=>{ const p=route.path; if(p.startsWith('/cars')) navigateTo('/cars'); else if(p.startsWith('/customers')) navigateTo('/customers'); else if(p.startsWith('/statistics')) navigateTo('/reports'); else if(p.startsWith('/payments')||p.startsWith('/offers')) navigateTo('/sales') })
</script>
