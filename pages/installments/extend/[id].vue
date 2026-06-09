<template>
  <section class="page-pad fast-fade">
    <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-3xl font-black">تمديد مدة الدفعات</h1>
        <p class="text-muted mt-2">صفحة مستقلة لضمان ظهور كل خيارات التمديد كاملة على الحاسوب والهاتف بدون قص.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary btn" @click="navigateTo('/installments')">رجوع إلى الأقساط</button>
        <button class="btn-primary btn" :disabled="busy || !installment" @click="submitExtend">حفظ تمديد المدة</button>
      </div>
    </div>

    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">
      {{ message }}
    </div>

    <div v-if="pending" class="card p-8 text-center text-muted">جاري تحميل بيانات القسط...</div>

    <div v-else-if="!installment" class="card p-8 text-center">
      <h2 class="text-2xl font-black mb-2">القسط غير موجود</h2>
      <p class="text-muted mb-4">قد يكون القسط محذوفاً أو الرابط غير صحيح.</p>
      <button class="btn-primary btn" @click="navigateTo('/installments')">العودة إلى صفحة الأقساط</button>
    </div>

    <div v-else class="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div class="card p-5 md:p-7">
        <div class="mb-6 rounded-3xl border border-[var(--border)] bg-[var(--soft)] p-5">
          <p class="text-muted mb-2">سيتم الحفاظ على ترتيب الدفعات وتواريخها، مع تأخير المدة المختارة فقط.</p>
          <div class="grid gap-3 md:grid-cols-2">
            <div><span class="text-muted">العميل</span><div class="text-xl font-black">{{ installment.sale.customer.fullName }}</div></div>
            <div><span class="text-muted">السيارة</span><div class="text-xl font-black">{{ installment.sale.car.brand }} {{ installment.sale.car.model }}</div></div>
            <div><span class="text-muted">رقم القسط</span><div class="text-xl font-black">{{ installment.installmentNumber }}</div></div>
            <div><span class="text-muted">الاستحقاق الحالي</span><div class="text-xl font-black">{{ dateText(installment.dueDate) }}</div></div>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <FormField label="تمديد بالأشهر" hint="اكتب عدد الأشهر، ويمكن تركه صفر">
            <input v-model.number="extendMonths" type="number" min="0" max="60" class="input">
          </FormField>
          <FormField label="تمديد بالأيام" hint="اكتب عدد الأيام، ويمكن تركه صفر">
            <input v-model.number="extendDays" type="number" min="0" max="365" class="input">
          </FormField>
        </div>

        <div class="mt-4 grid gap-4">
          <FormField label="نطاق التمديد" hint="اختر هل تريد تمديد هذا القسط فقط أو كل الدفعات المتبقية بعده">
            <select v-model="extendApplyTo" class="input">
              <option value="remaining">هذا القسط وكل الدفعات المتبقية</option>
              <option value="current">هذا القسط فقط</option>
            </select>
          </FormField>
          <FormField label="سبب التمديد" hint="اختياري، يظهر في سجل العمليات">
            <textarea v-model="extendNotes" class="input min-h-[120px] resize-y" placeholder="مثال: طلب العميل تمديد موعد السداد"></textarea>
          </FormField>
        </div>

        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <button class="btn-primary btn flex-1" :disabled="busy" @click="submitExtend">حفظ تمديد المدة</button>
          <button class="btn-secondary btn flex-1" @click="navigateTo('/installments')">إلغاء</button>
        </div>
      </div>

      <aside class="card p-5 h-fit">
        <h2 class="text-2xl font-black mb-4">معاينة التمديد</h2>
        <div class="space-y-3 text-sm">
          <div class="soft-card p-4"><div class="text-muted">مدة التمديد</div><b>{{ extendMonths || 0 }} شهر / {{ extendDays || 0 }} يوم</b></div>
          <div class="soft-card p-4"><div class="text-muted">النطاق</div><b>{{ extendApplyTo === 'remaining' ? 'هذا القسط وكل المتبقي' : 'هذا القسط فقط' }}</b></div>
          <div class="soft-card p-4"><div class="text-muted">المبلغ</div><b>{{ money(installment.amount, installment.sale.currency) }}</b></div>
          <div class="soft-card p-4"><div class="text-muted">المتبقي</div><b class="text-amber-500">{{ money(remain(installment), installment.sale.currency) }}</b></div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const id = computed(() => String(route.params.id || ''))
const { data, pending, refresh } = useFetch<any[]>('/api/installments', { default: () => [] })
const installment = computed(() => (data.value || []).find((x:any) => x.id === id.value))
const extendMonths = ref(0)
const extendDays = ref(0)
const extendApplyTo = ref<'remaining'|'current'>('remaining')
const extendNotes = ref('')
const busy = ref(false)
const message = ref('')
const messageType = ref<'ok'|'error'>('ok')

function notify(text:string, type:'ok'|'error'='ok') {
  message.value = text
  messageType.value = type
  setTimeout(() => { message.value = '' }, 4000)
}
function remain(i:any){ return Math.max(Number(i.amount||0)-Number(i.paidAmount||0),0) }
async function submitExtend(){
  if(!installment.value) return
  if(Number(extendMonths.value)<=0 && Number(extendDays.value)<=0) return notify('اختر مدة تمديد صحيحة', 'error')
  busy.value = true
  try {
    const res:any = await $fetch(`/api/installments/${installment.value.id}/extend`, {
      method:'POST',
      body:{ months:Number(extendMonths.value||0), days:Number(extendDays.value||0), applyTo:extendApplyTo.value, notes:extendNotes.value }
    })
    await refresh()
    notify(`تم تمديد ${res.updated || 0} دفعة بانتظام`)
    setTimeout(() => navigateTo('/installments'), 900)
  } catch(e:any) {
    notify(e?.data?.message || 'تعذر تمديد المدة', 'error')
  } finally {
    busy.value = false
  }
}
</script>
