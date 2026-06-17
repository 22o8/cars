<template>
  <div class="min-h-screen app-bg">
    <aside
      v-if="auth.user"
      class="desktop-sidebar fixed inset-y-0 right-0 z-30 hidden w-[300px] flex-col border-l text-white lg:flex"
      style="background: linear-gradient(180deg, var(--sidebar), var(--sidebar-2)); border-color: var(--border)"
    >
      <div class="px-6 py-6 border-b" style="border-color: var(--border)">
        <div class="text-2xl font-black tracking-tight">نظام إدارة المعرض</div>
        <div class="mt-2 text-xs text-slate-400">واجهة بسيطة لإدارة البيع والشراء</div>
        <div v-if="auth.user" class="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <img v-if="auth.user.profileImage" :src="auth.user.profileImage" class="h-12 w-12 rounded-2xl object-cover" alt="صورة المستخدم" />
          <div v-else class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/25 text-lg font-black text-white">{{ userInitial }}</div>
          <div class="min-w-0">
            <div class="truncate text-sm font-black text-white">{{ auth.user.fullName }}</div>
            <div class="truncate text-xs text-slate-400">{{ roleLabel }}</div>
          </div>
        </div>
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
              <p class="truncate text-xs text-muted lg:text-sm">مرحباً بك، {{ auth.user.fullName }} - {{ roleLabel }}</p>
            </div>
            <div class="flex items-center gap-2 lg:hidden">
              <img v-if="auth.user.profileImage" :src="auth.user.profileImage" class="h-10 w-10 rounded-2xl object-cover" alt="صورة المستخدم" />
              <button class="btn-primary btn shrink-0 px-4 py-2" @click="showMobileMenu = true">
                <IconLine name="menu" />
                <span>القائمة</span>
              </button>
            </div>
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
          <div class="flex items-center gap-3">
            <img v-if="auth.user.profileImage" :src="auth.user.profileImage" class="h-12 w-12 rounded-2xl object-cover" alt="صورة المستخدم" />
            <div v-else class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/25 text-lg font-black text-white">{{ userInitial }}</div>
            <div>
              <div class="text-xl font-black">نظام إدارة المعرض</div>
              <div class="mt-1 text-xs text-slate-400">{{ auth.user.fullName }} - {{ roleLabel }}</div>
            </div>
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
const { $oneSignal } = useNuxtApp() as any
const showMobileMenu = ref(false)
const canInstall = ref(false)
const deferredPrompt = ref<any>(null)
const notificationStatus = ref<'unsupported' | 'default' | 'granted' | 'denied'>('default')
let notificationTimer: any = null
let lastNotifiedKey = ''
// مكان تعديل تكرار تنبيه الأقساط داخل المتصفح: 5 دقائق.
// إذا تريد تغييره مستقبلاً عدّل الرقم هنا، وغيّر أيضاً INSTALLMENT_ALERT_REPEAT_MINUTES في Vercel للـ Push خارج البرنامج.
const INSTALLMENT_ALERT_REPEAT_MS = 5 * 60 * 1000

onMounted(async () => {
  initTheme()
  notificationStatus.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission as any
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as any)
  if (auth.user?.id) await $oneSignal?.login(auth.user.id)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as any)
  if (notificationTimer) clearInterval(notificationTimer)
})

watch(() => route.fullPath, () => { showMobileMenu.value = false })
watch(() => auth.user?.id, async (id) => { if (id) await $oneSignal?.login(id) })

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
  if (!$oneSignal?.configured) {
    alert('OneSignal غير مضبوط. أضف NUXT_PUBLIC_ONESIGNAL_APP_ID و ONESIGNAL_REST_API_KEY داخل Vercel ثم أعد النشر.')
    return
  }
  if (typeof Notification === 'undefined') {
    notificationStatus.value = 'unsupported'
    alert('هذا المتصفح لا يدعم إشعارات الهاتف.')
    return
  }

  const result = await $oneSignal.requestPermission(auth.user?.id)
  notificationStatus.value = Notification.permission as any

  if (result?.ok || Notification.permission === 'granted') {
    alert('تم تفعيل إشعارات الهاتف بنجاح. ستصلك التنبيهات عند تسديد قسط أو عند وجود قسط مستحق/متأخر.')
  } else if (Notification.permission === 'denied') {
    alert('الإشعارات محظورة من المتصفح. فعّلها من إعدادات الموقع.')
  } else {
    alert('لم يتم منح صلاحية الإشعارات بعد.')
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

async function subscribePushNotifications() {
  try {
    const keyInfo: any = await $fetch('/api/push/public-key', { credentials: 'include' })
    if (!keyInfo?.configured || !keyInfo?.publicKey) {
      alert('مفاتيح إشعارات Push غير مضبوطة في Vercel. أضف VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY و VAPID_SUBJECT حتى تعمل الإشعارات خارج البرنامج.')
      return false
    }
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyInfo.publicKey) })
    }
    await $fetch('/api/push/subscribe', { method: 'POST', body: sub.toJSON(), credentials: 'include' })
    return true
  } catch (e) {
    alert('تعذر تفعيل إشعارات الهاتف. تأكد أن الموقع يعمل على HTTPS وأن التطبيق مثبت أو مسموح له بالإشعارات.')
    return false
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

function startNotificationPolling(_runNow = false) {
  // تم تعطيل الفحص المحلي المتكرر حتى لا يسبب إزعاجاً أو إشعارات مكررة.
  // الإشعارات الآن ترسل من السيرفر عبر OneSignal عند تسديد القسط وعبر Cron للأقساط المستحقة/المتأخرة.
  if (notificationTimer) clearInterval(notificationTimer)
}
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

const menu = [
  { title: '', items: [
    { to: '/', label: 'التنفيذ السريع', short: 'تنفيذ', icon: 'grid' },
    { to: '/records', label: 'سجلات البيع والشراء', short: 'سجلات', icon: 'list' }
  ] },
  { title: 'إدارة السيارات', items: [
    { to: '/cars', label: 'السيارات والمخزن', short: 'سيارات', icon: 'car' }
  ]},
  { title: 'إدارة العملاء', items: [
    { to: '/customers', label: 'العملاء والمستمسكات', short: 'عملاء', icon: 'users' }
  ]},
  { title: 'إدارة المبيعات', items: [
    { to: '/sales', label: 'المبيعات والمراوسة', short: 'مبيعات', icon: 'cart' },
    { to: '/purchases', label: 'شراء السيارات', short: 'شراء', icon: 'swap' },
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
    { to: '/settings/backup', label: 'النسخ الاحتياطي والضبط', short: 'نسخ', icon: 'database' },
    { to: '/audit-logs', label: 'سجل العمليات والتدقيق', short: 'تدقيق', icon: 'list' }
  ] }
]

const isAdmin = computed(() => auth.user?.role === 'ADMIN')
function itemPermission(to: string) {
  if (to === '/') return 'dashboard'
  if (to.startsWith('/records')) return 'dashboard'
  if (to.startsWith('/cars')) return 'cars'
  if (to.startsWith('/customers')) return 'customers'
  if (to.startsWith('/sales')) return 'sales'
  if (to.startsWith('/purchases')) return 'purchases'
  if (to.startsWith('/installments')) return 'installments'
  if (to.startsWith('/invoices')) return 'invoices'
  if (to.startsWith('/expenses')) return 'expenses'
  if (to.startsWith('/accounts')) return 'accounts'
  if (to.startsWith('/reports')) return 'reports'
  if (to.startsWith('/employees')) return 'employees'
  if (to.startsWith('/settings')) return 'settings'
  if (to.startsWith('/audit-logs')) return 'settings'
  return 'dashboard'
}
const visibleMenu = computed(() => menu.map(g => ({ ...g, items: g.items.filter((i: any) => isAdmin.value || auth.can(itemPermission(i.to))) })).filter(g => g.items.length))
const flat = computed(() => visibleMenu.value.flatMap(g => g.items))
const mobilePrimaryMenu = computed(() => flat.value.filter((i:any) => ['/', '/records', '/cars', '/customers', '/sales', '/purchases', '/installments', '/invoices'].includes(i.to)).slice(0, 6))
const mobileBottomMenu = computed(() => {
  const preferred = ['/', '/records', '/sales', '/purchases', '/installments']
  return preferred.map(p => flat.value.find((x:any) => x.to === p)).filter(Boolean) as any[]
})
const isMobileHeaderReady = computed(() => auth.user && mobilePrimaryMenu.value.length > 0)
const pageTitle = computed(() => flat.value.find((i:any) => route.path === i.to || route.path.startsWith(i.to + '/'))?.label || 'نظام إدارة المعرض')
async function logout() {
  await $oneSignal?.logout?.()
  await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  auth.user = null
  auth.initialized = true
  await navigateTo('/login', { replace: true })
}
</script>
