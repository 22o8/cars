<script setup lang="ts">
import { roleStageMap } from '~/utils/stages'
const route = useRoute()
const { users, currentUserId, currentUser, roleLabels, homePath } = useAuth()

const theme = useState<'light'|'dark'>('ui-theme', () => 'light')
function applyTheme(value:'light'|'dark') {
  theme.value = value
  if (import.meta.client) {
    document.documentElement.dataset.theme = value
    localStorage.setItem('tarabil.ui.theme', value)
  }
}
function toggleTheme(){ applyTheme(theme.value === 'light' ? 'dark' : 'light') }
onMounted(() => {
  const saved = localStorage.getItem('tarabil.ui.theme')
  applyTheme(saved === 'dark' ? 'dark' : 'light')
})

const adminNav = [
  { to: '/', path: '/', label: 'الرئيسية', icon: '⌂' },
  { to: '/transactions', path: '/transactions', label: 'ساحة العمل', icon: '▤' },
  { to: '/unified-procedure', path: '/unified-procedure', label: 'رقم الإجراء الموحد', icon: '#' },
  { to: '/asycuda', path: '/asycuda', label: 'السكودة', icon: 'A' },
  { to: '/archive', path: '/archive', label: 'الأرشفة', icon: '▣' },
  { to: '/settings/companies', path: '/settings/companies', label: 'الشركات', icon: '◫' },
  { to: '/users', path: '/users', label: 'المستخدمون', icon: '♙' }
]

const nav = computed(() => {
  const role = currentUser.value.role
  if (role === 'admin') return adminNav
  if (role === 'unified') return [{ to: '/unified-procedure', path: '/unified-procedure', label: 'رقم الإجراء الموحد', icon: '#' }]
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
  <div class="shell shell-v2">
    <aside class="sidebar sidebar-v2">
      <div class="brand brand-v2">
        <div class="brand-mark">ط</div>
        <div class="brand-copy"><b>طريبيل</b><small>متابعة المعاملات</small></div>
        <span class="brand-live"><i></i> مباشر</span>
      </div>
      <div class="nav-caption">التنقل</div>
      <nav class="side-nav">
        <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :class="{active: route.path===n.path || (n.path !== '/' && route.path.startsWith(n.path))}">
          <span class="nav-icon">{{n.icon}}</span><span class="nav-label">{{n.label}}</span><span class="nav-arrow">‹</span>
        </NuxtLink>
      </nav>
      <div class="sidebar-tools">
        <button class="theme-toggle" type="button" :aria-label="theme==='light'?'تفعيل الوضع الداكن':'تفعيل الوضع الفاتح'" @click="toggleTheme">
          <span class="theme-toggle-icon">{{ theme==='light' ? '◐' : '☀' }}</span>
          <span><b>{{ theme==='light' ? 'الوضع الداكن' : 'الوضع الفاتح' }}</b><small>تغيير مظهر النظام</small></span>
        </button>
      </div>
      <div class="userbox userbox-v2">
        <div class="user-meta"><div class="user-avatar">{{currentUser.name?.slice(0,1) || 'م'}}</div><div><b>{{currentUser.name}}</b><small>{{ roleLabels[currentUser.role] }}</small></div></div>
        <label>تبديل المستخدم — تجريبي</label>
        <select v-model="currentUserId"><option v-for="u in users" :key="u.id" :value="u.id">{{u.name}}</option></select>
      </div>
    </aside>
    <section class="workspace">
      <header class="mobile-brandbar">
        <div class="mobile-brand-identity"><div class="brand-mark">ط</div><div><b>طريبيل</b><small>{{ roleLabels[currentUser.role] }}</small></div></div>
        <button class="mobile-theme-toggle" type="button" @click="toggleTheme">{{ theme==='light' ? '◐' : '☀' }}</button>
      </header>
      <main class="main"><div class="content-wrap"><slot /></div></main>
    </section>
  </div>
</template>
