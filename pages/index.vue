<template>
  <section class="page-pad mobile-dashboard">
    <div class="dashboard-hero mb-5 rounded-[2rem] border p-4 md:p-6" style="border-color: var(--border); background: radial-gradient(circle at 12% 20%, rgba(47,125,246,.18), transparent 32%), var(--panel)">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <img v-if="auth.user?.profileImage" :src="auth.user.profileImage" class="h-14 w-14 rounded-2xl object-cover shadow-xl" alt="صورة الحساب" />
          <div v-else class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-slate-950 text-2xl font-black text-white shadow-xl">{{ userInitial }}</div>
          <div>
            <p class="text-xs font-bold text-muted">نظام إدارة المعرض</p>
            <h1 class="text-xl font-black md:text-3xl">أهلاً {{ auth.user?.fullName || 'مدير النظام' }}</h1>
          </div>
        </div>
        <button class="btn-secondary btn hidden md:inline-flex" @click="refreshAll">تحديث</button>
      </div>
    </div>

    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType === 'error' ? 'border-red-500/40 text-red-500' : 'border-emerald-500/40 text-emerald-500'">
      {{ message }}
    </div>

    <div class="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="card p-4">
        <div class="text-xs font-bold text-muted">باقي مبيعات</div>
        <div class="mt-2 text-lg font-black text-amber-500">{{ money(data?.debtIqd || 0, 'IQD') }}</div>
      </div>
      <div class="card p-4">
        <div class="text-xs font-bold text-muted">باقي مشتريات</div>
        <div class="mt-2 text-lg font-black text-amber-500">{{ money(data?.purchaseDebtIqd || 0, 'IQD') }}</div>
      </div>
      <div class="card p-4">
        <div class="text-xs font-bold text-muted">الواصل مبيعات</div>
        <div class="mt-2 text-lg font-black text-emerald-500">{{ money(data?.totalPaidIqd || 0, 'IQD') }}</div>
      </div>
      <div class="card p-4">
        <div class="text-xs font-bold text-muted">الواصل مشتريات</div>
        <div class="mt-2 text-lg font-black text-emerald-500">{{ money(data?.totalPurchasePaidIqd || 0, 'IQD') }}</div>
      </div>
    </div>

    <div class="card mb-5 overflow-hidden p-4 md:p-5">
      <div class="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 class="text-xl font-black">التنفيذ السريع</h2>
          <p class="text-sm text-muted">بيع أو شراء سيارة بأقل عدد من الحقول.</p>
        </div>
        <div class="rounded-2xl border p-1" style="border-color: var(--border); background: var(--panel-2)">
          <button class="rounded-xl px-4 py-2 text-sm font-black transition" :class="mode === 'sale' ? 'bg-blue-600 text-white' : 'text-muted'" @click="mode = 'sale'">بيع سيارة</button>
          <button class="rounded-xl px-4 py-2 text-sm font-black transition" :class="mode === 'purchase' ? 'bg-emerald-600 text-white' : 'text-muted'" @click="mode = 'purchase'">شراء سيارة</button>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <FormField :label="mode === 'sale' ? 'اسم العميل' : 'اسم صاحب السيارة'" hint="اكتب الاسم الذي سيتم حفظ العملية عليه">
          <input v-model.trim="quick.ownerName" class="input" :placeholder="mode === 'sale' ? 'اسم العميل' : 'اسم صاحب السيارة'" />
        </FormField>
        <FormField label="اسم السيارة" hint="مثال: كامري 2020 أو كيا سبورتج">
          <input v-model.trim="quick.carName" class="input" placeholder="اسم السيارة" />
        </FormField>
        <FormField label="الواصل" hint="المبلغ الذي تم استلامه أو دفعه الآن">
          <input v-model.number="quick.paidAmount" type="number" min="0" class="input" placeholder="الواصل" />
        </FormField>
        <FormField label="الباقي" hint="المبلغ المتبقي على الطرف الآخر أو عليك">
          <input v-model.number="quick.remainingAmount" type="number" min="0" class="input" placeholder="الباقي" />
        </FormField>
        <FormField label="المدة" hint="اختر نوع المدة ثم اكتب الرقم">
          <div class="grid grid-cols-2 gap-2">
            <select v-model="quick.durationUnit" class="input">
              <option value="DAYS">أيام</option>
              <option value="MONTHS">أشهر</option>
            </select>
            <input v-model.number="quick.durationValue" type="number" min="0" class="input" :placeholder="quick.durationUnit === 'DAYS' ? 'مثال: 60' : 'مثال: 3'" />
          </div>
        </FormField>
        <FormField label="من تاريخ" hint="يبدأ منه حساب مدة التسديد">
          <input v-model="quick.fromDate" type="date" class="input" />
        </FormField>
        <FormField label="رقم الهاتف" hint="اختياري للمتابعة لاحقاً">
          <input v-model.trim="quick.phone" class="input" placeholder="اختياري" />
        </FormField>
        <FormField label="العملة" hint="عملة العملية">
          <select v-model="quick.currency" class="input">
            <option value="IQD">دينار عراقي</option>
            <option value="USD">دولار</option>
          </select>
        </FormField>
        <FormField label="المستمسكات أو صور السيارة" hint="اختياري، يمكن التقاط صورة من الهاتف أو رفع صورة">
          <input type="file" accept="image/*" capture="environment" multiple class="input" @change="onQuickFiles" />
        </FormField>
        <FormField label="ملاحظات" hint="اختياري">
          <input v-model.trim="quick.notes" class="input" placeholder="أي ملاحظة مختصرة" />
        </FormField>
      </div>

      <div v-if="quickImages.length" class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <img v-for="(img, idx) in quickImages" :key="idx" :src="img" class="h-28 w-full rounded-2xl border object-cover" style="border-color: var(--border)" />
      </div>

      <div class="mt-5 grid gap-3 md:grid-cols-4">
        <div class="soft-card p-4"><span class="text-sm text-muted">إجمالي العملية</span><b class="mt-1 block">{{ money(totalQuick, quick.currency) }}</b></div>
        <div class="soft-card p-4"><span class="text-sm text-muted">الواصل</span><b class="mt-1 block text-emerald-500">{{ money(quick.paidAmount, quick.currency) }}</b></div>
        <div class="soft-card p-4"><span class="text-sm text-muted">الباقي</span><b class="mt-1 block text-amber-500">{{ money(quick.remainingAmount, quick.currency) }}</b></div>
        <div class="soft-card p-4"><span class="text-sm text-muted">موعد التسديد</span><b class="mt-1 block">{{ quickDueText }}</b></div>
      </div>

      <button class="btn-primary btn mt-5 w-full justify-center py-4 text-base" :disabled="saving" @click="submitQuick">
        {{ saving ? 'جاري تنفيذ العملية' : mode === 'sale' ? 'تنفيذ بيع سيارة' : 'تنفيذ شراء سيارة' }}
      </button>
    </div>

    <div class="grid gap-5 xl:grid-cols-2">
      <div class="card p-4 md:p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-black">السيارات التي تم بيعها</h2>
            <p class="text-sm text-muted">السجل المختصر مع الواصل والباقي.</p>
          </div>
          <NuxtLink to="/sales" class="btn-secondary btn py-2 text-xs">كل البيع</NuxtLink>
        </div>
        <div v-if="!data?.latestSales?.length" class="soft-card p-6 text-center text-muted">لا توجد عمليات بيع بعد</div>
        <div v-for="s in data?.latestSales" :key="s.id" class="history-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-black">{{ s.car?.brand }} {{ s.car?.model }}</div>
              <div class="mt-1 text-sm text-muted">{{ s.customer?.fullName }} - {{ dateText(s.saleDate) }}</div>
            </div>
            <span class="rounded-xl bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-500">بيع</span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div class="soft-card p-3"><span class="text-muted">القيمة</span><b class="block">{{ money(s.salePrice, s.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الواصل</span><b class="block text-emerald-500">{{ money(s.paidAmount, s.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الباقي</span><b class="block text-amber-500">{{ money(s.remainingAmount, s.currency) }}</b></div>
          </div>
        </div>
      </div>

      <div class="card p-4 md:p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-black">السيارات التي تم شراؤها</h2>
            <p class="text-sm text-muted">السجل المختصر مع الواصل والباقي.</p>
          </div>
          <NuxtLink to="/purchases" class="btn-secondary btn py-2 text-xs">كل الشراء</NuxtLink>
        </div>
        <div v-if="!data?.latestPurchases?.length" class="soft-card p-6 text-center text-muted">لا توجد عمليات شراء بعد</div>
        <div v-for="p in data?.latestPurchases" :key="p.id" class="history-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-black">{{ p.carName }}</div>
              <div class="mt-1 text-sm text-muted">{{ p.sellerName }} - {{ dateText(p.fromDate) }}</div>
            </div>
            <span class="rounded-xl bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500">شراء</span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div class="soft-card p-3"><span class="text-muted">القيمة</span><b class="block">{{ money(p.totalAmount, p.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الواصل</span><b class="block text-emerald-500">{{ money(p.paidAmount, p.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الباقي</span><b class="block text-amber-500">{{ money(p.remainingAmount, p.currency) }}</b></div>
          </div>
          <div class="mt-3 text-xs text-muted">موعد التسديد: {{ dateText(p.dueDate) }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const { data, refresh } = useLazyFetch<any>('/api/dashboard')
const mode = ref<'sale' | 'purchase'>('sale')
const saving = ref(false)
const message = ref('')
const messageType = ref<'ok' | 'error'>('ok')
const today = new Date().toISOString().slice(0, 10)
const quickImages = ref<string[]>([])

const quick = reactive({
  ownerName: '',
  carName: '',
  paidAmount: 0,
  remainingAmount: 0,
  durationUnit: 'DAYS' as 'DAYS' | 'MONTHS',
  durationValue: 0,
  fromDate: today,
  phone: '',
  currency: 'IQD' as 'IQD' | 'USD',
  notes: ''
})

const userInitial = computed(() => (auth.user?.fullName || auth.user?.username || 'م').trim().slice(0, 1))
const totalQuick = computed(() => Number(quick.paidAmount || 0) + Number(quick.remainingAmount || 0))
const quickDueText = computed(() => dateText(calculateDueDate()))

function notify(text: string, type: 'ok' | 'error' = 'ok') {
  message.value = text
  messageType.value = type
  setTimeout(() => { message.value = '' }, 3500)
}

function calculateDueDate() {
  const d = quick.fromDate ? new Date(quick.fromDate) : new Date()
  const value = Math.max(0, Number(quick.durationValue || 0))
  if (quick.durationUnit === 'MONTHS') d.setMonth(d.getMonth() + value)
  else d.setDate(d.getDate() + value)
  return d
}

function fileToData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function onQuickFiles(event: any) {
  quickImages.value = []
  for (const file of Array.from(event.target.files || []) as File[]) quickImages.value.push(await fileToData(file))
}

function resetQuick() {
  Object.assign(quick, {
    ownerName: '', carName: '', paidAmount: 0, remainingAmount: 0, durationUnit: 'DAYS', durationValue: 0, fromDate: today, phone: '', currency: 'IQD', notes: ''
  })
  quickImages.value = []
}

async function refreshAll() {
  await refresh()
}

async function submitQuick() {
  if (!quick.ownerName || !quick.carName) return notify('اكتب الاسم واسم السيارة أولاً', 'error')
  if (totalQuick.value <= 0) return notify('اكتب الواصل أو الباقي حتى يتم تنفيذ العملية', 'error')
  saving.value = true
  try {
    const body = {
      carName: quick.carName,
      paidAmount: Number(quick.paidAmount || 0),
      remainingAmount: Number(quick.remainingAmount || 0),
      currency: quick.currency,
      durationUnit: quick.durationUnit,
      durationValue: Number(quick.durationValue || 0),
      fromDate: quick.fromDate,
      documentImages: quickImages.value,
      notes: quick.notes
    }
    if (mode.value === 'sale') {
      await $fetch('/api/quick/sale', { method: 'POST', body: { ...body, customerName: quick.ownerName, customerPhone: quick.phone } })
      notify('تم تنفيذ بيع السيارة وتحديث سجل المبيعات')
    } else {
      await $fetch('/api/quick/purchase', { method: 'POST', body: { ...body, sellerName: quick.ownerName, sellerPhone: quick.phone, createCar: true } })
      notify('تم تنفيذ شراء السيارة وإضافتها للمخزن')
    }
    resetQuick()
    await refresh()
  } catch (error: any) {
    notify(error?.data?.message || 'تعذر تنفيذ العملية', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.history-card {
  margin-bottom: .75rem;
  border: 1px solid var(--border);
  background: var(--panel-2);
  border-radius: 1.25rem;
  padding: 1rem;
}
@media (max-width: 640px) {
  .mobile-dashboard :deep(.form-field) { gap: .35rem; }
  .mobile-dashboard :deep(.input) { min-height: 48px; font-size: 16px; }
  .history-card { padding: .85rem; }
}
</style>
