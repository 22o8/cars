<script setup lang="ts">
const route = useRoute()
const { users, currentUserId, currentUser, roleLabels } = useAuth()
const nav = [
  ['/', 'لوحة المتابعة', '⌂'], ['/transactions', 'المعاملات', '▤'], ['/archive', 'الأرشيف', '▣'],
  ['/reports', 'التقارير المالية', '▥'], ['/settings/companies', 'الشركات والرموز', '◫'], ['/users', 'المستخدمون', '♙']
]
</script>
<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">ط</div><div><b>طريبيل</b><small>نظام المعاملات</small></div></div>
      <nav>
        <NuxtLink v-for="n in nav" :key="n[0]" :to="n[0]" :class="{active: route.path===n[0] || (n[0] !== '/' && route.path.startsWith(n[0]))}"><span>{{n[2]}}</span>{{n[1]}}</NuxtLink>
      </nav>
      <div class="userbox">
        <label>المستخدم الحالي</label>
        <select v-model="currentUserId"><option v-for="u in users" :key="u.id" :value="u.id">{{u.name}}</option></select>
        <small>{{ roleLabels[currentUser.role] }}</small>
      </div>
    </aside>
    <main class="main"><slot /></main>
  </div>
</template>
