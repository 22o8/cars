<template>
  <section class="page-pad fast-fade">
    <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><h1 class="text-3xl font-black">الأقساط والدفعات</h1><p class="text-muted mt-2">متابعة الأقساط المستحقة والمتأخرة وتسجيل دفعة كاملة أو جزئية، وكل دفعة ترتبط بالمبيعات والخزنة والفواتير.</p></div>
      <div class="flex flex-wrap gap-2"><button class="btn-primary btn" @click="refresh">تحديث البيانات</button></div>
    </div>
    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">{{message}}</div>
    <div class="grid gap-4 lg:grid-cols-4 mb-6">
      <div class="card p-5 stat-card"><p class="text-muted">إجمالي الأقساط</p><b class="stat-value">{{ data?.length || 0 }}</b></div>
      <div class="card p-5 stat-card"><p class="text-muted">غير المسددة</p><b class="stat-value text-amber-500">{{ pending }}</b></div>
      <div class="card p-5 stat-card"><p class="text-muted">المتأخرة</p><b class="stat-value text-red-500">{{ late }}</b></div>
      <div class="card p-5 stat-card"><p class="text-muted">المسددة</p><b class="stat-value text-emerald-500">{{ paid }}</b></div>
    </div>
    <div class="card overflow-x-auto">
      <table class="table"><thead><tr><th>العميل</th><th>السيارة</th><th>رقم القسط</th><th>المبلغ</th><th>المدفوع</th><th>المتبقي</th><th>الاستحقاق</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>
        <tr v-for="i in rows" :key="i.id"><td class="font-black">{{i.sale.customer.fullName}}</td><td>{{i.sale.car.brand}} {{i.sale.car.model}}</td><td>{{i.installmentNumber}}</td><td>{{money(i.amount,i.sale.currency)}}</td><td>{{money(i.paidAmount,i.sale.currency)}}</td><td class="font-black text-amber-500">{{money(remain(i),i.sale.currency)}}</td><td>{{dateText(i.dueDate)}}</td><td><span class="badge">{{status(i.status)}}</span></td><td><div class="action-bar"><button v-if="i.status !== 'PAID'" class="btn-primary btn py-2" @click="openPay(i)">تسديد</button><NuxtLink class="btn-secondary btn py-2" :to="`/sales?sale=${i.saleId}`">العقد</NuxtLink></div></td></tr>
        <tr v-if="!rows.length"><td colspan="9" class="text-center text-muted py-8">لا توجد أقساط مسجلة حالياً. أنشئ بيع أقساط من صفحة المبيعات حتى تظهر هنا.</td></tr>
      </tbody></table>
    </div>
    <div v-if="selected" class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" @click.self="selected=null">
      <div class="card w-full max-w-xl p-6"><div class="mb-4 flex items-center justify-between"><h3 class="text-2xl font-black">تسديد قسط</h3><button class="btn-secondary btn" @click="selected=null">إغلاق</button></div>
        <div class="grid gap-4"><div class="soft-card p-4"><div class="text-muted">المتبقي على هذا القسط</div><b class="text-xl text-amber-500">{{money(remain(selected), selected.sale.currency)}}</b></div><FormField label="مبلغ التسديد" hint="اكتب مبلغاً جزئياً أو اتركه مساوياً للمتبقي للتسديد الكامل"><input v-model.number="payAmount" type="number" class="input"></FormField><FormField label="ملاحظات الدفعة" hint="اختياري"><input v-model="payNotes" class="input" placeholder="مثال: تم الدفع نقداً"></FormField><button class="btn-primary btn" :disabled="busy" @click="submitPay">حفظ الدفعة وربطها بالخزنة</button></div>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
const { data, refresh } = useFetch<any[]>('/api/installments', { default: () => [] })
const rows = computed(()=>data.value || [])
const pending=computed(()=>rows.value.filter(i=>i.status!=='PAID').length); const paid=computed(()=>rows.value.filter(i=>i.status==='PAID').length); const late=computed(()=>rows.value.filter(i=>i.status!=='PAID'&&new Date(i.dueDate)<new Date()).length)
const selected=ref<any|null>(null); const payAmount=ref(0); const payNotes=ref(''); const busy=ref(false); const message=ref(''); const messageType=ref<'ok'|'error'>('ok')
function notify(t:string,type:'ok'|'error'='ok'){ message.value=t; messageType.value=type; setTimeout(()=>message.value='',3500) }
function remain(i:any){ return Math.max(Number(i.amount||0)-Number(i.paidAmount||0),0) }
function openPay(i:any){ selected.value=i; payAmount.value=remain(i); payNotes.value='' }
async function submitPay(){ if(!selected.value) return; if(payAmount.value<=0) return notify('اكتب مبلغ تسديد صحيح','error'); busy.value=true; try{ await $fetch(`/api/installments/${selected.value.id}/pay`, { method:'POST', body:{amount:Number(payAmount.value), notes:payNotes.value} }); selected.value=null; await refresh(); notify('تم تسجيل الدفعة وتحديث القسط والخزنة والفاتورة') }catch(e:any){ notify(e?.data?.message||'تعذر تسجيل الدفعة','error') }finally{ busy.value=false } }
function status(s:string){return {PENDING:'معلق',PARTIAL:'مدفوع جزئياً',PAID:'مدفوع',LATE:'متأخر'}[s]||s}
</script>
