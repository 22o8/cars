<template>
  <section class="page-pad">
    <div class="dashboard-hero mb-8 overflow-hidden rounded-[2rem] border p-5 lg:p-7" style="border-color: var(--border); background: radial-gradient(circle at 12% 20%, rgba(47,125,246,.18), transparent 32%), var(--panel)">
      <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex items-center gap-4">
          <img v-if="auth.user?.profileImage" :src="auth.user.profileImage" class="h-20 w-20 rounded-[1.5rem] object-cover shadow-2xl" alt="صورة صاحب الحساب" />
          <div v-else class="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-blue-600 to-slate-950 text-3xl font-black text-white shadow-2xl">{{ userInitial }}</div>
          <div>
            <p class="mb-1 text-sm font-bold text-muted">مرحباً بعودتك</p>
            <h1 class="text-3xl font-black lg:text-5xl">{{ auth.user?.fullName || 'مدير النظام' }}</h1>
            <p class="mt-2 text-muted">نظرة عامة حقيقية على أداء المعرض، المبيعات، الأقساط، والتنبيهات.</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="btn-primary btn" @click="refresh">تحديث البيانات</button>
          <button class="btn-secondary btn" @click="requestNotifications">تفعيل الإشعارات</button>
          <NuxtLink to="/settings/account" class="btn-secondary btn">تعديل البروفايل</NuxtLink>
          <NuxtLink to="/reports" class="btn-secondary btn">تصدير التقارير</NuxtLink>
        </div>
      </div>
    </div>

    <div v-if="notificationHint" class="mb-6 rounded-3xl border border-blue-400/40 bg-blue-500/10 p-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="font-black text-blue-500">فعّل إشعارات الأقساط</h2>
          <p class="mt-1 text-sm text-muted">حتى تصلك تنبيهات موعد التسديد والمتأخرات على الجهاز مثل أنظمة العمل الاحترافية.</p>
        </div>
        <button class="btn-primary btn" @click="requestNotifications">السماح بالإشعارات</button>
      </div>
    </div>

    <div class="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
      <div v-for="s in stats" :key="s.label" class="card p-5">
        <p class="text-sm font-bold text-muted">{{ s.label }}</p>
        <h3 class="stat-value mt-3" :class="s.class">{{ s.value }}</h3>
        <p class="mt-2 text-xs text-muted">{{ s.caption }}</p>
      </div>
    </div>

    <div v-if="data?.overdue" class="mb-6 rounded-3xl border border-amber-400/50 bg-amber-500/10 p-5 font-bold text-amber-700 dark:text-amber-300">
      لديك {{ data.overdue }} قسط مستحق أو متأخر. راجع صفحة الأقساط والدفعات.
    </div>

    <div class="grid xl:grid-cols-3 gap-6">
      <div class="card p-6 xl:col-span-2">
        <div class="mb-5 flex items-center justify-between">
          <h2 class="text-xl font-black">المبيعات والأرباح حسب الأشهر</h2>
          <div class="text-sm text-muted">آخر 6 أشهر</div>
        </div>
        <div v-if="!chartHasData" class="soft-card flex h-80 items-center justify-center text-muted">لا توجد بيانات كافية لعرض الرسم البياني</div>
        <svg v-else viewBox="0 0 760 310" class="h-80 w-full overflow-visible">
          <g stroke="currentColor" class="text-slate-300 dark:text-slate-700" stroke-width="1">
            <line v-for="y in [50,110,170,230,290]" :key="y" x1="30" :y1="y" x2="730" :y2="y" />
          </g>
          <polyline :points="salesPoints" fill="none" stroke="#2f7df6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
          <polyline :points="profitPoints" fill="none" stroke="#3ddc84" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
          <g v-for="(m,i) in chart" :key="m.label">
            <text :x="x(i)" y="307" text-anchor="middle" class="fill-current text-xs text-muted">{{ m.label }}</text>
          </g>
        </svg>
      </div>

      <div class="card p-6">
        <h2 class="text-xl font-black mb-5">آخر العمليات</h2>
        <div v-if="!data?.latestOps?.length" class="soft-card p-6 text-center text-muted">لا توجد عمليات بعد</div>
        <div v-for="op in data?.latestOps" :key="op.id" class="mb-3 rounded-2xl border p-4" style="border-color: var(--border); background: var(--panel-2)">
          <div class="font-black">{{ op.action }}</div>
          <div class="mt-1 text-sm text-muted">{{ op.userName }} - {{ op.details || op.entity }}</div>
          <div class="mt-2 text-xs text-muted">{{ dateTimeText(op.createdAt) }}</div>
        </div>
      </div>
    </div>

    <div class="mt-6 grid xl:grid-cols-3 gap-6">
      <div class="card p-6">
        <h2 class="text-xl font-black mb-5">آخر المبيعات</h2>
        <div v-if="!data?.latestSales?.length" class="soft-card p-6 text-center text-muted">لا توجد مبيعات بعد</div>
        <div v-for="s in data?.latestSales" :key="s.id" class="mb-3 flex items-center justify-between rounded-2xl border p-4" style="border-color: var(--border); background: var(--panel-2)">
          <div>
            <div class="font-black">{{ s.customer?.fullName }}</div>
            <div class="text-sm text-muted">{{ s.car?.brand }} {{ s.car?.model }}</div>
          </div>
          <div class="font-black text-blue-500">{{ money(s.salePrice, s.currency) }}</div>
        </div>
      </div>
      <div class="card p-6">
        <h2 class="text-xl font-black mb-5">المبيعات حسب الحالة</h2>
        <div class="grid gap-3">
          <div class="soft-card p-4 flex justify-between"><span>المباعة</span><b>{{ data?.salesCount || 0 }}</b></div>
          <div class="soft-card p-4 flex justify-between"><span>المتاحة</span><b>{{ data?.availableCars || 0 }}</b></div>
          <div class="soft-card p-4 flex justify-between"><span>الديون المتبقية</span><b class="text-amber-500">{{ money(data?.debtIqd || 0, 'IQD') }}</b></div>
        </div>
      </div>
      <div class="card p-6">
        <h2 class="text-xl font-black mb-5">إجراءات سريعة</h2>
        <div class="grid gap-3">
          <NuxtLink to="/cars" class="btn-secondary btn justify-between">إضافة سيارة جديدة</NuxtLink>
          <NuxtLink to="/customers" class="btn-secondary btn justify-between">إضافة عميل جديد</NuxtLink>
          <NuxtLink to="/sales" class="btn-secondary btn justify-between">تنفيذ بيع جديد</NuxtLink>
          <NuxtLink to="/invoices" class="btn-secondary btn justify-between">إنشاء فاتورة</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
const auth = useAuthStore()
const { data, refresh } = useLazyFetch<any>('/api/dashboard')
const stats = computed(() => [
  { label:'العملاء', value:data.value?.customers || 0, caption:'إجمالي العملاء', class:'' },
  { label:'المبيعات اليوم', value:data.value?.salesToday || 0, caption:'عملية بيع', class:'' },
  { label:'السيارات المتاحة', value:data.value?.availableCars || 0, caption:'سيارة متاحة', class:'' },
  { label:'إجمالي المبيعات', value:money(data.value?.totalSalesIqd || 0,'IQD'), caption:'بالدينار العراقي', class:'text-blue-500' },
  { label:'صافي الربح', value:money(data.value?.netProfitIqd || 0,'IQD'), caption:'بعد المصروفات', class:'text-emerald-500' }
])
const chart = computed(() => data.value?.chart || [])
const chartHasData = computed(() => chart.value.some((m:any) => Number(m.sales) > 0 || Number(m.profit) > 0))
const maxVal = computed(() => Math.max(1, ...chart.value.flatMap((m:any)=>[Number(m.sales||0), Number(m.profit||0)])))
function x(i:number){ return 55 + i * (650 / Math.max(chart.value.length - 1, 1)) }
function y(v:number){ return 290 - (Number(v||0) / maxVal.value) * 240 }
const salesPoints = computed(() => chart.value.map((m:any,i:number)=>`${x(i)},${y(m.sales)}`).join(' '))
const profitPoints = computed(() => chart.value.map((m:any,i:number)=>`${x(i)},${y(m.profit)}`).join(' '))
const userInitial = computed(() => (auth.user?.fullName || auth.user?.username || 'م').trim().slice(0, 1))
const notificationHint = ref(false)
onMounted(() => {
  notificationHint.value = typeof Notification !== 'undefined' && Notification.permission === 'default'
})
async function requestNotifications() {
  if (typeof Notification === 'undefined') return alert('المتصفح لا يدعم الإشعارات على هذا الجهاز')
  const nuxt = useNuxtApp()
  const oneSignal: any = nuxt.$oneSignal
  const userId = auth.user?.id || auth.user?.username || 'admin'
  const result = await oneSignal?.requestPermission?.(String(userId))
  const granted = result?.permission === 'granted' || Notification.permission === 'granted'
  notificationHint.value = !granted
  if (granted) alert('تم تفعيل الإشعارات على هذا الجهاز بنجاح')
  else alert('لم يتم السماح بالإشعارات. افتح إعدادات الموقع وفعّل Notifications.')
}
</script>
