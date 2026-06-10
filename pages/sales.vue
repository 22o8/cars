<template>
  <section class="page-pad fast-fade">
    <div class="mb-6">
      <h1 class="text-3xl font-black">المبيعات والمراوسة</h1>
      <p class="text-muted mt-2">أنشئ بيع نقدي أو أقساط أو مراوسة، وسيتم حساب المدفوع والمتبقي وإنشاء السجل تلقائياً.</p>
    </div>

    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">
      {{ message }}
    </div>

    <div class="card p-5 mb-6">
      <h2 class="mb-4 text-xl font-black">بيانات البيع الأساسية</h2>
      <div class="form-grid">
        <FormField label="العميل" hint="اختر العميل الذي سيتم تسجيل العقد باسمه">
          <select v-model="form.customerId" class="input">
            <option value="">اختر العميل</option>
            <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.fullName }} - {{ c.phone }}</option>
          </select>
        </FormField>

        <FormField label="السيارة المباعة" hint="تظهر فقط السيارات المتوفرة للبيع">
          <select v-model="form.carId" class="input">
            <option value="">اختر السيارة</option>
            <option v-for="c in availableCars" :key="c.id" :value="c.id">{{ c.brand }} {{ c.model }} - {{ money(c.salePrice,c.currency) }}</option>
          </select>
        </FormField>

        <FormField label="نوع البيع" hint="حدد طريقة البيع المعتمدة">
          <select v-model="form.saleType" class="input">
            <option value="CASH">نقدي</option>
            <option value="INSTALLMENT">أقساط</option>
            <option value="TRADE_IN">مراوسة</option>
          </select>
        </FormField>

        <FormField label="سعر البيع النهائي" hint="المبلغ النهائي المتفق عليه مع العميل">
          <input v-model.number="form.salePrice" type="number" min="0" class="input" placeholder="سعر البيع">
        </FormField>

        <FormField label="الدفعة النقدية الأولى" hint="المبلغ الذي دفعه العميل الآن نقداً">
          <input v-model.number="form.firstPayment" type="number" min="0" class="input" placeholder="الدفعة الأولى">
        </FormField>

        <FormField label="العملة" hint="عملة البيع لهذا العقد">
          <select v-model="form.currency" class="input">
            <option value="IQD">دينار عراقي</option>
            <option value="USD">دولار</option>
          </select>
        </FormField>
      </div>

      <div v-if="form.saleType === 'TRADE_IN'" class="mt-5 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 class="mb-3 text-lg font-black text-amber-400">بيانات سيارة المراوسة</h3>
        <div class="form-grid">
          <FormField label="شركة سيارة المراوسة" hint="مثال: تويوتا">
            <input v-model.trim="form.tradeInBrand" class="input" placeholder="الشركة">
          </FormField>
          <FormField label="نوع / موديل المراوسة" hint="مثال: كورولا">
            <input v-model.trim="form.tradeInModel" class="input" placeholder="النوع">
          </FormField>
          <FormField label="سنة المراوسة" hint="اختياري">
            <input v-model.number="form.tradeInYear" type="number" min="1950" class="input" placeholder="السنة">
          </FormField>
          <FormField label="قيمة المراوسة" hint="تُحسب كدفعة ضمن البيع">
            <input v-model.number="form.tradeInValue" type="number" min="0" class="input" placeholder="قيمة السيارة الداخلة بالمراوسة">
          </FormField>
          <FormField label="ملاحظات المراوسة" hint="اختياري">
            <input v-model.trim="form.tradeInNotes" class="input" placeholder="ملاحظات عن حالة السيارة">
          </FormField>
        </div>
      </div>

      <div v-if="form.saleType !== 'CASH'" class="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h3 class="mb-3 text-lg font-black">جدولة الأقساط</h3>
        <div class="form-grid">
          <FormField label="عدد الأقساط" hint="عدد الدفعات التي سيتم توزيع المتبقي عليها">
            <input v-model.number="form.installmentsCount" type="number" min="1" class="input" placeholder="عدد الأقساط">
          </FormField>
          <FormField label="الفترة بين الأقساط بالأيام" hint="مثال: 30 يعني قسط كل شهر تقريباً">
            <input v-model.number="form.intervalDays" type="number" min="1" class="input" placeholder="30">
          </FormField>
          <FormField label="تاريخ أول قسط" hint="إذا جعلته اليوم سيصل تنبيه فور تنفيذ البيع">
            <input v-model="form.firstDueDate" type="date" class="input">
          </FormField>
          <FormField label="ملاحظات العقد" hint="اختياري">
            <input v-model.trim="form.notes" class="input" placeholder="ملاحظات">
          </FormField>
        </div>
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-4">
        <div class="soft-card p-4"><div class="text-muted text-sm">سعر البيع</div><b>{{ money(form.salePrice, form.currency) }}</b></div>
        <div class="soft-card p-4"><div class="text-muted text-sm">الدفعة النقدية</div><b>{{ money(form.firstPayment, form.currency) }}</b></div>
        <div v-if="form.saleType === 'TRADE_IN'" class="soft-card p-4"><div class="text-muted text-sm">قيمة المراوسة</div><b class="text-amber-500">{{ money(form.tradeInValue, form.currency) }}</b></div>
        <div class="soft-card p-4"><div class="text-muted text-sm">المتبقي على العميل</div><b class="text-amber-500">{{ money(remaining, form.currency) }}</b></div>
      </div>

      <button class="btn-primary btn mt-4 w-full lg:w-auto" :disabled="busy" @click="sell">
        {{ busy ? 'جاري تنفيذ البيع' : 'تنفيذ البيع وإنشاء السجل' }}
      </button>
    </div>

    <div class="card overflow-x-auto">
      <table class="table">
        <thead><tr><th>العميل</th><th>السيارة</th><th>نوع البيع</th><th>السعر</th><th>المدفوع</th><th>المتبقي</th><th>التاريخ</th></tr></thead>
        <tbody>
          <tr v-for="s in sales" :key="s.id">
            <td class="font-black">{{ s.customer.fullName }}</td>
            <td>{{ s.car.brand }} {{ s.car.model }}</td>
            <td>{{ saleType(s.saleType) }}</td>
            <td>{{ money(s.salePrice,s.currency) }}</td>
            <td>{{ money(s.paidAmount,s.currency) }}</td>
            <td class="font-black text-amber-500">{{ money(s.remainingAmount,s.currency) }}</td>
            <td>{{ dateText(s.saleDate) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
const { data: cars, refresh: refreshCars } = useLazyFetch<any[]>('/api/cars', { default: () => [] })
const { data: customers } = useLazyFetch<any[]>('/api/customers', { default: () => [] })
const { data: sales, refresh } = useLazyFetch<any[]>('/api/sales', { default: () => [] })

const emptyForm = () => ({
  customerId: '',
  carId: '',
  saleType: 'CASH',
  salePrice: 0,
  firstPayment: 0,
  currency: 'IQD',
  installmentsCount: 1,
  intervalDays: 30,
  firstDueDate: '',
  notes: '',
  tradeInBrand: '',
  tradeInModel: '',
  tradeInYear: null as number | null,
  tradeInValue: 0,
  tradeInNotes: ''
})

const form = reactive(emptyForm())
const busy = ref(false)
const message = ref('')
const messageType = ref<'ok'|'error'>('ok')

const availableCars = computed(() => cars.value?.filter(c => c.status === 'AVAILABLE') || [])
const tradeValue = computed(() => form.saleType === 'TRADE_IN' ? Number(form.tradeInValue || 0) : 0)
const paidNow = computed(() => Math.min(Number(form.firstPayment || 0) + tradeValue.value, Number(form.salePrice || 0)))
const remaining = computed(() => Math.max(Number(form.salePrice || 0) - paidNow.value, 0))

function notify(t: string, type: 'ok'|'error' = 'ok') {
  message.value = t
  messageType.value = type
  setTimeout(() => { message.value = '' }, 3500)
}

watch(() => form.carId, () => {
  const car = availableCars.value.find((c: any) => c.id === form.carId)
  if (car) {
    form.salePrice = Number(car.salePrice)
    form.currency = car.currency
  }
})

watch(() => form.saleType, (type) => {
  if (type === 'CASH') {
    form.installmentsCount = 0
    form.firstDueDate = ''
  } else if (!form.installmentsCount || form.installmentsCount < 1) {
    form.installmentsCount = 1
  }
})

async function sell() {
  if (!form.customerId || !form.carId || !form.salePrice) return notify('اختر العميل والسيارة واكتب سعر البيع', 'error')
  if (form.saleType === 'TRADE_IN' && Number(form.tradeInValue || 0) <= 0) return notify('اكتب قيمة سيارة المراوسة حتى تُحسب ضمن البيع', 'error')
  if (form.saleType !== 'CASH' && remaining.value > 0 && Number(form.installmentsCount || 0) <= 0) return notify('اكتب عدد الأقساط لتوزيع المتبقي', 'error')

  busy.value = true
  try {
    const res: any = await $fetch('/api/sales', { method: 'POST', body: { ...form } })
    Object.assign(form, emptyForm())
    await Promise.all([refresh(), refreshCars()])
    const sent = Number(res?.notification?.sent || 0)
    notify(sent > 0 ? `تم تنفيذ البيع وإرسال تنبيه القسط (${sent})` : 'تم تنفيذ البيع وإنشاء الفاتورة')
  } catch (e: any) {
    notify(e?.data?.message || 'تعذر تنفيذ البيع', 'error')
  } finally {
    busy.value = false
  }
}

function saleType(t: string) {
  return { CASH: 'نقدي', INSTALLMENT: 'أقساط', TRADE_IN: 'مراوسة' }[t] || t
}
</script>
