<script setup lang="ts">
import { roleStageMap } from '~/utils/stages'
const route = useRoute()
const { users, currentUserId, currentUser, roleLabels, homePath } = useAuth()

const adminNav = [
  { to: '/', path: '/', label: 'الرئيسية', icon: '⌂' },
  { to: '/transactions', path: '/transactions', label: 'ساحة العمل', icon: '▤' },
  { to: '/asycuda', path: '/asycuda', label: 'السكودة', icon: 'A' },
  { to: '/archive', path: '/archive', label: 'الأرشفة', icon: '▣' },
  { to: '/settings/companies', path: '/settings/companies', label: 'الشركات', icon: '◫' },
  { to: '/users', path: '/users', label: 'المستخدمون', icon: '♙' }
]

const nav = computed(() => {
  const role = currentUser.value.role
  if (role === 'admin') return adminNav
  if (role === 'asycuda') return [{ to: '/asycuda', path: '/asycuda', label: 'السكودة', icon: 'A' }]
  if (role === 'archive') return [{ to: '/archive', path: '/archive', label: 'الأرشفة', icon: '▣' }]
  const stage = roleStageMap[role]
  if (stage) return [{ to: `/transactions?stage=${stage}`, path: '/transactions', label: roleLabels[role], icon: '▤' }]
  return [{ to: '/', path: '/', label: 'الرئيسية', icon: '⌂' }]
})

watch(() => currentUser.value.role, async () => {
  await navigateTo(homePath())
})
</script>
<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">ط</div><div><b>طريبيل</b><small>متابعة المعاملات</small></div></div>
      <nav><NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :class="{active: route.path===n.path || (n.path !== '/' && route.path.startsWith(n.path))}"><span>{{n.icon}}</span>{{n.label}}</NuxtLink></nav>
      <div class="userbox"><label>تبديل المستخدم — تجريبي</label><select v-model="currentUserId"><option v-for="u in users" :key="u.id" :value="u.id">{{u.name}}</option></select><small>{{ roleLabels[currentUser.role] }}</small></div>
    </aside>
    <main class="main"><slot /></main>
  </div>
</template>
