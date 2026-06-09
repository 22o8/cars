<template>
  <div class="min-h-screen app-bg">
    <aside
      v-if="auth.user"
      class="desktop-sidebar fixed inset-y-0 right-0 z-30 hidden w-[300px] flex-col border-l text-white lg:flex"
      style="background: linear-gradient(180deg, var(--sidebar), var(--sidebar-2)); border-color: var(--border)"
    >
      <div class="px-6 py-6 border-b" style="border-color: var(--border)">
        <div class="text-2xl font-black tracking-tight">AutoDealer Pro</div>
        <div class="mt-2 text-xs text-slate-400">نظام ويب لإدارة معارض السيارات</div>
<<<<<<< HEAD
        <div v-if="auth.user" class="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <img v-if="auth.user.profileImage" :src="auth.user.profileImage" class="h-12 w-12 rounded-2xl object-cover" alt="صورة المستخدم" />
          <div v-else class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/25 text-lg font-black text-white">{{ userInitial }}</div>
          <div class="min-w-0">
            <div class="truncate text-sm font-black text-white">{{ auth.user.fullName }}</div>
            <div class="truncate text-xs text-slate-400">{{ roleLabel }}</div>
          </div>
        </div>
=======
>>>>>>> 35e1d7177da3a656fa8ec41967b4003683551daf
      </div>

      <div class="sidebar-scroll flex-1 overflow-y-auto px-4 py-5">
        <div v-for="group in visibleMenu" :key="group.title || 'home'" class="mb-5">
          <div v-if="group.title" class="nav-section px-4 mb-2 text-xs font-bold">{{ group.title }}</div>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            prefetch
            class="nav-link mb-1.5 flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-bold"
          >
            <span>{{ item.label }}</span>
            <span class="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <IconLine :name="item.icon" />
            </span>
          </NuxtLink>
        </div>
      </div>

      <div class="p-4 border-t" style="border-color: var(--border)">
        <button class="btn w-full border border-red-500/60 text-red-300 hover:bg-red-500/10" @click="logout">تسجيل خروج</button>
      </div>
    </aside>

    <main :class="auth.user ? 'lg:mr-[300px]' : ''" class="min-h-screen main-shell">
      <header
        v-if="auth.user"
        class="sticky top-0 z-30 border-b backdrop-blur-xl mobile-safe-header"
        style="background: color-mix(in srgb, var(--panel) 94%, transparent); border-color: var(--border)"
      >
        <div class="mobile-header-wrap px-4 py-3 lg:px-8 lg:py-4">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h1 class="truncate text-xl font-black lg:text-2xl">{{ pageTitle }}</h1>
<<<<<<< HEAD
              <p class="truncate text-xs text-muted lg:text-sm">مرحباً بك، {{ auth.user.fullName }} - {{ roleLabel }}</p>
            </div>
            <div class="flex items-center gap-2 lg:hidden">
              <img v-if="auth.user.profileImage" :src="auth.user.profileImage" class="h-10 w-10 rounded-2xl object-cover" alt="صورة المستخدم" />
              <button class="btn-primary btn shrink-0 px-4 py-2" @click="showMobileMenu = true">
                <IconLine name="menu" />
                <span>القائمة</span>
              </button>
            </div>
=======
              <p class="truncate text-xs text-muted lg:text-sm">مرحباً بك، {{ auth.user.fullName }}</p>
            </div>
            <button class="btn-primary btn shrink-0 px-4 py-2 lg:hidden" @click="showMobileMenu = true">
              <IconLine name="menu" />
              <span>القائمة</span>
            </button>
>>>>>>> 35e1d7177da3a656fa8ec41967b4003683551daf
          </div>

          <div class="mobile-search flex items-center gap-3 rounded-2xl border px-4 py-3" style="border-color: var(--border); background: var(--panel-2)">
            <IconLine name="search" class="text-muted" />
            <input class="w-full bg-transparent text-sm outline-none" placeholder="بحث سريع" />
          </div>

          <div class="mobile-actions flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button class="btn-secondary btn whitespace-nowrap text-xs lg:text-sm" @click="toggleTheme">{{ theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن' }}</button>
            <button class="btn-secondary btn whitespace-nowrap text-xs lg:text-sm" @click="enableNotifications">{{ notificationButtonText }}</button>
            <button v-if="canInstall" class="btn-primary btn whitespace-nowrap text-xs lg:text-sm" @click="installApp">تثبيت التطبيق</button>
          </div>
        </div>

        <div v-if="isMobileHeaderReady" class="mobile-menu-bar no-scrollbar lg:hidden">
          <NuxtLink v-for="item in mobilePrimaryMenu" :key="item.to" :to="item.to" prefetch class="mobile-menu-pill" active-class="mobile-menu-pill-active">
            <IconLine :name="item.icon" />
            <span>{{ item.short }}</span>
          </NuxtLink>
          <button class="mobile-menu-pill" @click="showMobileMenu = true">
            <IconLine name="list" />
            <span>المزيد</span>
          </button>
        </div>
      </header>

      <slot />
    </main>

    <nav
      v-if="auth.user"
      class="mobile-bottom-nav fixed bottom-0 right-0 left-0 z-40 grid grid-cols-5 border-t text-[11px] lg:hidden"
      style="border-color: var(--border); background: color-mix(in srgb, var(--panel) 97%, transparent)"
    >
      <NuxtLink v-for="item in mobileBottomMenu" :key="item.to" :to="item.to" prefetch class="mobile-nav-link py-2 text-center font-bold text-muted" active-class="mobile-nav-active">
        <span class="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-xl border" style="border-color: var(--border); background: var(--panel-2)"><IconLine :name="item.icon" /></span>
        <span class="block truncate px-1">{{ item.short }}</span>
      </NuxtLink>
    </nav>

    <div v-if="showMobileMenu && auth.user" class="fixed inset-0 z-50 bg-black/60 lg:hidden" @click.self="showMobileMenu = false">
      <aside class="mobile-drawer h-full w-[92vw] max-w-[390px] overflow-y-auto border-l p-4" style="background: linear-gradient(180deg, var(--sidebar), var(--sidebar-2)); border-color: var(--border)">
        <div class="mb-5 flex items-center justify-between text-white">
<<<<<<< HEAD
          <div class="flex items-center gap-3">
            <img v-if="auth.user.profileImage" :src="auth.user.profileImage" class="h-12 w-12 rounded-2xl object-cover" alt="صورة المستخدم" />
            <div v-else class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/25 text-lg font-black text-white">{{ userInitial }}</div>
            <div>
              <div class="text-xl font-black">AutoDealer Pro</div>
              <div class="mt-1 text-xs text-slate-400">{{ auth.user.fullName }} - {{ roleLabel }}</div>
            </div>
=======
          <div>
            <div class="text-xl font-black">AutoDealer Pro</div>
            <div class="mt-1 text-xs text-slate-400">{{ auth.user.fullName }}</div>
>>>>>>> 35e1d7177da3a656fa8ec41967b4003683551daf
          </div>
          <button class="btn-secondary btn px-3 py-2 text-xs" @click="showMobileMenu = false">إغلاق</button>
        </div>

        <div class="mb-4 grid grid-cols-2 gap-2">
          <button class="btn-secondary btn text-xs" @click="enableNotifications">{{ notificationButtonText }}</button>
          <button class="btn-primary btn text-xs" @click="installApp">تثبيت على الهاتف</button>
        </div>

        <div v-for="group in visibleMenu" :key="group.title || 'drawer-home'" class="mb-4">
          <div v-if="group.title" class="nav-section px-4 mb-2 text-xs font-bold">{{ group.title }}</div>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            prefetch
            class="nav-link mb-1.5 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold"
            @click="showMobileMenu = false"
          >
            <span>{{ item.label }}</span>
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5"><IconLine :name="item.icon" /></span>
          </NuxtLink>
        </div>
        <button class="btn mt-4 w-full border border-red-500/60 text-red-300" @click="logout">تسجيل خروج</button>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const route = useRoute()
const { theme, initTheme, toggleTheme } = useTheme()
const showMobileMenu = ref(false)
const canInstall = ref(false)
const deferredPrompt = ref<any>(null)
const notificationStatus = ref<'unsupported' | 'default' | 'granted' | 'denied'>('default')
let notificationTimer: any = null
let lastNotifiedKey = ''

onMounted(() => {
  initTheme()
  notificationStatus.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission as any
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as any)
<<<<<<< HEAD
  if (notificationStatus.value === 'granted') startNotificationPolling(true)
=======
  if (notificationStatus.value === 'granted') startNotificationPolling()
>>>>>>> 35e1d7177da3a656fa8ec41967b4003683551daf
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as any)
  if (notificationTimer) clearInterval(notificationTimer)
})

watch(() => route.fullPath, () => { showMobileMenu.value = false })
watch(() => auth.user?.id, (id) => { if (id && notificationStatus.value === 'granted') startNotificationPolling() })

function onBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  deferredPrompt.value = e
  canInstall.value = true
}

const notificationButtonText = computed(() => {
  if (notificationStatus.value === 'granted') return 'الإشعارات مفعلة'
  if (notificationStatus.value === 'denied') return 'الإشعارات محظورة'
  if (notificationStatus.value === 'unsupported') return 'الإشعارات غير مدعومة'
  return 'تفعيل الإشعارات'
})

async function enableNotifications() {
  if (typeof Notification === 'undefined') {
    alert('المتصفح لا يدعم إشعارات الويب على هذا الجهاز')
    notificationStatus.value = 'unsupported'
    return
  }
  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission()
    notificationStatus.value = result as any
  } else {
    notificationStatus.value = 'granted'
  }
  if (notificationStatus.value === 'granted') {
<<<<<<< HEAD
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready.catch(() => null)
    await showSystemNotification('تم تفعيل الإشعارات', 'ستصلك تنبيهات الأقساط المستحقة والمتأخرة أثناء استخدام النظام.')
=======
>>>>>>> 35e1d7177da3a656fa8ec41967b4003683551daf
    startNotificationPolling(true)
  } else if (notificationStatus.value === 'denied') {
    alert('الإشعارات محظورة من المتصفح. فعّلها من إعدادات الموقع حتى تصلك تنبيهات الأقساط.')
  }
}

async function installApp() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    await deferredPrompt.value.userChoice.catch(() => null)
    deferredPrompt.value = null
    canInstall.value = false
    return
  }
  alert('لإضافة النظام على الهاتف: افتح قائمة المتصفح ثم اختر إضافة إلى الشاشة الرئيسية أو Install app.')
}

function startNotificationPolling(runNow = false) {
  if (!auth.user || notificationStatus.value !== 'granted') return
  if (notificationTimer) clearInterval(notificationTimer)
  const check = async () => {
    try {
      const due: any[] = await $fetch('/api/installments/due', { credentials: 'include' })
      const count = due?.length || 0
      if (!count) return
      const first = due[0]
      const key = `${count}-${first?.id || ''}-${new Date().toDateString()}`
      if (key === lastNotifiedKey || localStorage.getItem('adp_last_due_notification') === key) return
      lastNotifiedKey = key
      localStorage.setItem('adp_last_due_notification', key)
<<<<<<< HEAD
      await showSystemNotification('تنبيه أقساط مستحقة', count === 1 ? `يوجد قسط مستحق على ${first?.sale?.customer?.fullName || 'أحد العملاء'}` : `يوجد ${count} أقساط مستحقة أو متأخرة تحتاج متابعة`)
=======
      new Notification('تنبيه أقساط مستحقة', {
        body: count === 1 ? `يوجد قسط مستحق على ${first?.sale?.customer?.fullName || 'أحد العملاء'}` : `يوجد ${count} أقساط مستحقة أو متأخرة تحتاج متابعة`,
        tag: 'autodealer-installments-due',
        icon: '/icons/icon-192.svg'
      })
>>>>>>> 35e1d7177da3a656fa8ec41967b4003683551daf
    } catch {}
  }
  if (runNow) check()
  notificationTimer = setInterval(check, 60_000)
}

<<<<<<< HEAD
async function showSystemNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const options: NotificationOptions = { body, tag: 'autodealer-pro', icon: '/icons/icon-192.svg', badge: '/icons/icon-192.svg' }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null)
      if (reg?.showNotification) return reg.showNotification(title, options)
    }
  } catch {}
  new Notification(title, options)
}

const roleLabel = computed(() => {
  const map: Record<string, string> = { ADMIN: 'مدير النظام', ACCOUNTANT: 'محاسب', SALES: 'موظف مبيعات', VIEWER: 'مشاهد' }
  return map[auth.user?.role || ''] || 'مستخدم'
})
const userInitial = computed(() => (auth.user?.fullName || auth.user?.username || 'م').trim().slice(0, 1))

=======
>>>>>>> 35e1d7177da3a656fa8ec41967b4003683551daf
const menu = [
  { title: '', items: [{ to: '/', label: 'لوحة التحكم', short: 'الرئيسية', icon: 'grid' }] },
  { title: 'إدارة السيارات', items: [
    { to: '/cars', label: 'السيارات والمخزن', short: 'سيارات', icon: 'car' }
  ]},
  { title: 'إدارة العملاء', items: [
    { to: '/customers', label: 'العملاء والمستمسكات', short: 'عملاء', icon: 'users' }
  ]},
  { title: 'إدارة المبيعات', items: [
    { to: '/sales', label: 'المبيعات والمراوسة', short: 'مبيعات', icon: 'cart' },
    { to: '/installments', label: 'الأقساط والدفعات', short: 'أقساط', icon: 'card' },
    { to: '/invoices', label: 'الفواتير والسندات', short: 'فواتير', icon: 'file' },
    { to: '/expenses', label: 'المصاريف', short: 'مصروفات', icon: 'swap' },
    { to: '/accounts', label: 'الحسابات والخزنة', short: 'خزنة', icon: 'database' }
  ]},
  { title: 'التقارير', items: [{ to: '/reports', label: 'التقارير والإحصائيات', short: 'تقارير', icon: 'chart' }] },
  { title: 'الإدارة', items: [{ to: '/employees', label: 'الموظفون والصلاحيات', short: 'موظفون', icon: 'userCog' }] },
  { title: 'الإعدادات', items: [
    { to: '/settings/system', label: 'إعدادات النظام', short: 'نظام', icon: 'settings' },
    { to: '/settings/account', label: 'إعدادات الحساب', short: 'حساب', icon: 'userCog' },
    { to: '/settings/backup', label: 'النسخ الاحتياطي والضبط', short: 'نسخ', icon: 'database' }
  ] }
]

const isAdmin = computed(() => auth.user?.role === 'ADMIN')
function itemPermission(to: string) {
  if (to === '/') return 'dashboard'
  if (to.startsWith('/cars')) return 'cars'
  if (to.startsWith('/customers')) return 'customers'
  if (to.startsWith('/sales')) return 'sales'
  if (to.startsWith('/installments')) return 'installments'
  if (to.startsWith('/invoices')) return 'invoices'
  if (to.startsWith('/expenses')) return 'expenses'
  if (to.startsWith('/accounts')) return 'accounts'
  if (to.startsWith('/reports')) return 'reports'
  if (to.startsWith('/employees')) return 'employees'
  if (to.startsWith('/settings')) return 'settings'
  return 'dashboard'
}
const visibleMenu = computed(() => menu.map(g => ({ ...g, items: g.items.filter((i: any) => isAdmin.value || auth.can(itemPermission(i.to))) })).filter(g => g.items.length))
const flat = computed(() => visibleMenu.value.flatMap(g => g.items))
const mobilePrimaryMenu = computed(() => flat.value.filter((i:any) => ['/', '/cars', '/customers', '/sales', '/installments', '/invoices'].includes(i.to)).slice(0, 6))
const mobileBottomMenu = computed(() => {
  const preferred = ['/', '/cars', '/customers', '/sales', '/installments']
  return preferred.map(p => flat.value.find((x:any) => x.to === p)).filter(Boolean) as any[]
})
const isMobileHeaderReady = computed(() => auth.user && mobilePrimaryMenu.value.length > 0)
const pageTitle = computed(() => flat.value.find((i:any) => route.path === i.to || route.path.startsWith(i.to + '/'))?.label || 'AutoDealer Pro')
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  auth.user = null
  auth.initialized = true
  await navigateTo('/login', { replace: true })
}
</script>
