<script setup lang="ts">
import { roleStageMap } from '~/utils/stages'

const route = useRoute()
const { users, currentUserId, currentUser, roleLabels, homePath } = useAuth()

const theme = useState<'light'|'dark'>('ui-theme', () => 'light')
const mobileMenuOpen = ref(false)

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

function isActive(path:string) {
  return route.path === path || (path !== '/' && route.path.startsWith(path))
}

const mobilePrimary = computed(() => {
  if (currentUser.value.role !== 'admin') return nav.value.slice(0, 4)
  const wanted = ['/', '/transactions', '/unified-procedure', '/asycuda']
  return wanted.map(path => adminNav.find(item => item.path === path)).filter(Boolean) as typeof adminNav
})

const mobilePageTitle = computed(() => {
  const active = nav.value.find(item => isActive(item.path))
  if (active) return active.label
  if (route.path.startsWith('/transactions/')) return 'تفاصيل المعاملة'
  if (route.path.startsWith('/unified-procedure/')) return 'تفاصيل الطلب'
  return 'طريبيل'
})

function closeMobileMenu(){ mobileMenuOpen.value = false }

watch(() => route.fullPath, closeMobileMenu)
watch(mobileMenuOpen, (open) => {
  if (!import.meta.client) return
  document.documentElement.classList.toggle('mobile-menu-open', open)
})

watch(() => currentUser.value.role, async () => {
  closeMobileMenu()
  await navigateTo(homePath())
})

onBeforeUnmount(() => {
  if (import.meta.client) document.documentElement.classList.remove('mobile-menu-open')
})
</script>

<template>
  <div class="shell shell-v2">
    <aside class="sidebar sidebar-v2 desktop-sidebar">
      <div class="brand brand-v2">
        <div class="brand-mark">ط</div>
        <div class="brand-copy"><b>طريبيل</b><small>متابعة المعاملات</small></div>
        <span class="brand-live"><i></i> مباشر</span>
      </div>
      <div class="nav-caption">التنقل</div>
      <nav class="side-nav">
        <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :class="{active: isActive(n.path)}">
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
      <header class="mobile-appbar">
        <button class="mobile-menu-trigger" type="button" aria-label="فتح القائمة" @click="mobileMenuOpen = true">
          <span></span><span></span><span></span>
        </button>
        <div class="mobile-appbar-title">
          <small>{{ roleLabels[currentUser.role] }}</small>
          <b>{{ mobilePageTitle }}</b>
        </div>
        <button class="mobile-theme-toggle" type="button" :aria-label="theme==='light'?'الوضع الداكن':'الوضع الفاتح'" @click="toggleTheme">{{ theme==='light' ? '◐' : '☀' }}</button>
      </header>

      <main class="main"><div class="content-wrap"><slot /></div></main>

      <nav class="mobile-bottom-nav" aria-label="التنقل السريع">
        <NuxtLink v-for="n in mobilePrimary" :key="n.to" :to="n.to" :class="{active: isActive(n.path)}">
          <span class="mobile-bottom-icon">{{n.icon}}</span>
          <small>{{ n.label === 'رقم الإجراء الموحد' ? 'الإجراء' : n.label }}</small>
        </NuxtLink>
        <button type="button" :class="{active: mobileMenuOpen}" @click="mobileMenuOpen = true">
          <span class="mobile-bottom-icon more-icon">•••</span>
          <small>المزيد</small>
        </button>
      </nav>
    </section>

    <Transition name="drawer-fade">
      <button v-if="mobileMenuOpen" class="mobile-drawer-backdrop" type="button" aria-label="إغلاق القائمة" @click="closeMobileMenu"></button>
    </Transition>
    <Transition name="drawer-slide">
      <aside v-if="mobileMenuOpen" class="mobile-drawer" aria-label="القائمة الرئيسية">
        <div class="mobile-drawer-head">
          <div class="mobile-drawer-brand">
            <div class="brand-mark">ط</div>
            <div><b>طريبيل</b><small>متابعة المعاملات</small></div>
          </div>
          <button type="button" class="drawer-close" aria-label="إغلاق القائمة" @click="closeMobileMenu">×</button>
        </div>

        <div class="mobile-drawer-user">
          <div class="user-avatar">{{currentUser.name?.slice(0,1) || 'م'}}</div>
          <div><b>{{currentUser.name}}</b><small>{{ roleLabels[currentUser.role] }}</small></div>
          <span class="drawer-online"><i></i> متصل</span>
        </div>

        <nav class="mobile-drawer-nav">
          <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" :class="{active: isActive(n.path)}">
            <span class="drawer-nav-icon">{{n.icon}}</span>
            <span>{{n.label}}</span>
            <span class="drawer-chevron">‹</span>
          </NuxtLink>
        </nav>

        <div class="mobile-drawer-tools">
          <button type="button" @click="toggleTheme">
            <span class="drawer-tool-icon">{{ theme==='light' ? '◐' : '☀' }}</span>
            <span><b>{{ theme==='light' ? 'الوضع الداكن' : 'الوضع الفاتح' }}</b><small>المظهر الحالي: {{ theme==='light' ? 'فاتح' : 'داكن' }}</small></span>
          </button>
          <label class="mobile-user-switch">
            <span>تبديل المستخدم</span>
            <select v-model="currentUserId"><option v-for="u in users" :key="u.id" :value="u.id">{{u.name}}</option></select>
          </label>
        </div>
      </aside>
    </Transition>
  </div>
</template>
