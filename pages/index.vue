<template>
  <section class="page-pad mobile-dashboard simple-dashboard">
    <div class="simple-hero mb-4 rounded-[1.4rem] border p-4 md:p-6">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <img v-if="auth.user?.profileImage" :src="auth.user.profileImage" class="h-14 w-14 rounded-2xl object-cover shadow-xl" alt="صورة الحساب" />
          <div v-else class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-slate-950 text-2xl font-black text-white shadow-xl">{{ userInitial }}</div>
          <div>
            <p class="text-xs font-bold text-muted">مرحباً بك</p>
            <h1 class="text-2xl font-black md:text-3xl">{{ auth.user?.fullName || 'مدير النظام' }}</h1>
          </div>
        </div>
        <button class="btn-secondary btn hidden md:inline-flex" @click="refreshAll">تحديث</button>
      </div>
    </div>

    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType === 'error' ? 'border-red-500/40 text-red-500' : 'border-emerald-500/40 text-emerald-500'">
      {{ message }}
    </div>

    <div class="simple-stats mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="card p-4"><div class="text-xs font-bold text-muted">باقي مبيعات</div><div class="mt-2 text-lg font-black text-amber-500">{{ money(data?.debtIqd || 0, 'IQD') }}</div></div>
      <div class="card p-4"><div class="text-xs font-bold text-muted">باقي مشتريات</div><div class="mt-2 text-lg font-black text-amber-500">{{ money(data?.purchaseDebtIqd || 0, 'IQD') }}</div></div>
      <div class="card p-4"><div class="text-xs font-bold text-muted">واصل مبيعات</div><div class="mt-2 text-lg font-black text-emerald-500">{{ money(data?.totalPaidIqd || 0, 'IQD') }}</div></div>
      <div class="card p-4"><div class="text-xs font-bold text-muted">واصل مشتريات</div><div class="mt-2 text-lg font-black text-emerald-500">{{ money(data?.totalPurchasePaidIqd || 0, 'IQD') }}</div></div>
    </div>

    <div class="simple-actions mb-4 grid grid-cols-2 gap-3">
      <button class="quick-action" :class="mode === 'purchase' ? 'quick-action-active purchase' : ''" @click="mode = 'purchase'">
        <span class="quick-action-icon">شراء</span>
        <b>شراء سيارة</b>
        <small>سعر كلي، واصل، مدة</small>
      </button>
      <button class="quick-action" :class="mode === 'sale' ? 'quick-action-active sale' : ''" @click="mode = 'sale'">
        <span class="quick-action-icon">بيع</span>
        <b>بيع سيارة</b>
        <small>واصل، باقي، موعد</small>
      </button>
    </div>

    <div class="simple-form-card card mb-5 overflow-hidden p-4 md:p-5">
      <div class="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 class="text-xl font-black">{{ mode === 'purchase' ? 'تنفيذ شراء سريع' : 'تنفيذ بيع سريع' }}</h2>
          <p class="text-sm text-muted">أدخل المعلومات الأساسية فقط، والباقي يحسب تلقائياً.</p>
        </div>
        <NuxtLink to="/records" class="btn-secondary btn py-2 text-xs">السجلات</NuxtLink>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <FormField :label="mode === 'sale' ? 'اسم العميل' : 'اسم صاحب السيارة'" hint="الاسم الأساسي للعملية">
          <input v-model.trim="quick.ownerName" class="input" :placeholder="mode === 'sale' ? 'اسم العميل' : 'اسم صاحب السيارة'" />
        </FormField>
        <FormField label="اسم السيارة" hint="مثال: كامري 2020 أو كيا سبورتج">
          <input v-model.trim="quick.carName" class="input" placeholder="اسم السيارة" />
        </FormField>

        <template v-if="mode === 'purchase'">
          <FormField label="سعر السيارة الكلي" hint="السعر المتفق عليه للشراء">
            <input v-model.number="quick.totalAmount" type="number" min="0" class="input" placeholder="سعر السيارة الكلي" />
          </FormField>
          <FormField label="الواصل حالياً" hint="المبلغ المدفوع الآن">
            <input v-model.number="quick.paidAmount" type="number" min="0" class="input" placeholder="الواصل" />
          </FormField>
          <FormField label="المتبقي تلقائياً" hint="سعر السيارة ناقص الواصل">
            <input :value="purchaseRemaining" readonly class="input bg-slate-500/10" />
          </FormField>
        </template>

        <template v-else>
          <FormField label="الواصل" hint="المبلغ الذي استلمته الآن">
            <input v-model.number="quick.paidAmount" type="number" min="0" class="input" placeholder="الواصل" />
          </FormField>
          <FormField label="الباقي" hint="المبلغ المتبقي على العميل">
            <input v-model.number="quick.remainingAmount" type="number" min="0" class="input" placeholder="الباقي" />
          </FormField>
        </template>

        <FormField label="المدة" hint="اختر أيام أو أشهر ثم اكتب الرقم">
          <div class="grid grid-cols-2 gap-2">
            <select v-model="quick.durationUnit" class="input">
              <option value="DAYS">أيام</option>
              <option value="MONTHS">أشهر</option>
            </select>
            <input v-model.number="quick.durationValue" type="number" min="0" class="input" :placeholder="quick.durationUnit === 'DAYS' ? 'مثال: 60' : 'مثال: 3'" />
          </div>
        </FormField>
        <FormField label="من تاريخ" hint="يبدأ منه حساب التسديد">
          <input v-model="quick.fromDate" type="date" class="input" />
        </FormField>
        <FormField label="رقم الهاتف" hint="اختياري">
          <input v-model.trim="quick.phone" class="input" placeholder="اختياري" />
        </FormField>
        <FormField label="العملة" hint="عملة العملية">
          <select v-model="quick.currency" class="input">
            <option value="IQD">دينار عراقي</option>
            <option value="USD">دولار</option>
          </select>
        </FormField>
        <FormField label="المستمسكات أو الصور" hint="اختياري، التقاط صورة أو رفع ملف">
          <input type="file" accept="image/*" capture="environment" multiple class="input" @change="onQuickFiles" />
        </FormField>
        <FormField label="ملاحظات" hint="اختياري">
          <input v-model.trim="quick.notes" class="input" placeholder="ملاحظة مختصرة" />
        </FormField>
      </div>

      <div v-if="quickImages.length" class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <img v-for="(img, idx) in quickImages" :key="idx" :src="img" class="h-28 w-full rounded-2xl border object-cover" style="border-color: var(--border)" />
      </div>

      <div class="mt-5 grid gap-3 md:grid-cols-4">
        <div class="soft-card p-4"><span class="text-sm text-muted">إجمالي العملية</span><b class="mt-1 block">{{ money(totalQuick, quick.currency) }}</b></div>
        <div class="soft-card p-4"><span class="text-sm text-muted">الواصل</span><b class="mt-1 block text-emerald-500">{{ money(quick.paidAmount, quick.currency) }}</b></div>
        <div class="soft-card p-4"><span class="text-sm text-muted">الباقي</span><b class="mt-1 block text-amber-500">{{ money(mode === 'purchase' ? purchaseRemaining : quick.remainingAmount, quick.currency) }}</b></div>
        <div class="soft-card p-4"><span class="text-sm text-muted">موعد التسديد</span><b class="mt-1 block">{{ quickDueText }}</b></div>
      </div>

      <button class="btn-primary btn mt-5 w-full justify-center py-4 text-base" :disabled="saving" @click="submitQuick">
        {{ saving ? 'جاري التنفيذ' : mode === 'sale' ? 'تنفيذ بيع سيارة' : 'تنفيذ شراء سيارة' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const { data, refresh } = useLazyFetch<any>('/api/dashboard')
const mode = ref<'sale' | 'purchase'>('purchase')
const saving = ref(false)
const message = ref('')
const messageType = ref<'ok' | 'error'>('ok')
const today = new Date().toISOString().slice(0, 10)
const quickImages = ref<string[]>([])

const quick = reactive({ ownerName: '', carName: '', totalAmount: 0, paidAmount: 0, remainingAmount: 0, durationUnit: 'DAYS' as 'DAYS' | 'MONTHS', durationValue: 0, fromDate: today, phone: '', currency: 'IQD' as 'IQD' | 'USD', notes: '' })

const userInitial = computed(() => (auth.user?.fullName || auth.user?.username || 'م').trim().slice(0, 1))
const purchaseRemaining = computed(() => Math.max(Number(quick.totalAmount || 0) - Number(quick.paidAmount || 0), 0))
const totalQuick = computed(() => mode.value === 'purchase' ? Number(quick.totalAmount || 0) : Number(quick.paidAmount || 0) + Number(quick.remainingAmount || 0))
const quickDueText = computed(() => dateText(calculateDueDate()))

function notify(text: string, type: 'ok' | 'error' = 'ok') { message.value = text; messageType.value = type; setTimeout(() => { message.value = '' }, 3500) }
function calculateDueDate() { const d = quick.fromDate ? new Date(quick.fromDate) : new Date(); const value = Math.max(0, Number(quick.durationValue || 0)); if (quick.durationUnit === 'MONTHS') d.setMonth(d.getMonth() + value); else d.setDate(d.getDate() + value); return d }
function fileToData(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) }) }
async function onQuickFiles(event: any) { quickImages.value = []; for (const file of Array.from(event.target.files || []) as File[]) quickImages.value.push(await fileToData(file)) }
function resetQuick() { Object.assign(quick, { ownerName: '', carName: '', totalAmount: 0, paidAmount: 0, remainingAmount: 0, durationUnit: 'DAYS', durationValue: 0, fromDate: today, phone: '', currency: 'IQD', notes: '' }); quickImages.value = [] }
async function refreshAll() { await refresh() }

async function submitQuick() {
  if (!quick.ownerName || !quick.carName) return notify('اكتب الاسم واسم السيارة أولاً', 'error')
  if (totalQuick.value <= 0) return notify(mode.value === 'purchase' ? 'اكتب سعر السيارة الكلي أولاً' : 'اكتب الواصل أو الباقي حتى يتم تنفيذ العملية', 'error')
  saving.value = true
  try {
    const body = { carName: quick.carName, totalAmount: mode.value === 'purchase' ? Number(quick.totalAmount || 0) : undefined, paidAmount: Number(quick.paidAmount || 0), remainingAmount: mode.value === 'purchase' ? purchaseRemaining.value : Number(quick.remainingAmount || 0), currency: quick.currency, durationUnit: quick.durationUnit, durationValue: Number(quick.durationValue || 0), fromDate: quick.fromDate, documentImages: quickImages.value, notes: quick.notes }
    if (mode.value === 'sale') { await $fetch('/api/quick/sale', { method: 'POST', body: { ...body, customerName: quick.ownerName, customerPhone: quick.phone } }); notify('تم تنفيذ بيع السيارة وتحديث سجل المبيعات') }
    else { await $fetch('/api/quick/purchase', { method: 'POST', body: { ...body, sellerName: quick.ownerName, sellerPhone: quick.phone, createCar: true } }); notify('تم تنفيذ شراء السيارة وإضافتها للمخزن') }
    resetQuick(); await refresh()
  } catch (error: any) { notify(error?.data?.message || 'تعذر تنفيذ العملية', 'error') }
  finally { saving.value = false }
}
</script>

<style scoped>
.quick-action { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.25rem; min-height:92px; border:1px solid var(--border); background:var(--panel); border-radius:1.5rem; padding:1rem; font-weight:900; transition:.2s ease; }
.quick-action small { color:var(--muted); font-size:.72rem; }
.quick-action-active { color:#fff; transform:translateY(-1px); box-shadow:0 14px 35px rgba(0,0,0,.22); }
.quick-action-active.purchase { background:linear-gradient(135deg,#059669,#064e3b); border-color:rgba(16,185,129,.55); }
.quick-action-active.sale { background:linear-gradient(135deg,#2563eb,#1e3a8a); border-color:rgba(59,130,246,.55); }
@media (max-width: 640px) {
  .mobile-dashboard :deep(.form-field) { gap: .35rem; }
  .mobile-dashboard :deep(.input) { min-height: 48px; font-size: 16px; }
}
</style>
