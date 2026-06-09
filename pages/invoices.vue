<template>
  <section class="page-pad fast-fade">
    <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><h1 class="text-3xl font-black">الفواتير والسندات</h1><p class="text-muted mt-2">إنشاء وطباعة وحفظ فواتير البيع وسندات القبض والصرف، مع إمكانية طباعة كل الفواتير دفعة واحدة.</p></div>
      <div class="flex flex-wrap gap-2"><button class="btn-secondary btn" @click="openAllPrint">طباعة كل الفواتير</button><button class="btn-primary btn" @click="refresh">تحديث</button></div>
    </div>
    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">{{message}}</div>
    <div class="card p-5 mb-6"><h2 class="mb-4 text-xl font-black">إنشاء فاتورة أو سند</h2><div class="form-grid">
      <FormField label="نوع المستند" hint="اختر هل هو فاتورة بيع، سند قبض، سند صرف، أو فاتورة قسط"><select v-model="form.invoiceType" class="input"><option>فاتورة بيع سيارة</option><option>سند قبض</option><option>سند صرف</option><option>فاتورة قسط</option><option>فاتورة قديمة</option></select></FormField>
      <FormField label="اسم العميل أو الجهة" hint="الاسم الذي سيظهر على الفاتورة"><input v-model.trim="form.customerName" class="input" placeholder="اسم العميل أو الجهة"></FormField>
      <FormField label="رقم الهاتف" hint="اختياري"><input v-model.trim="form.customerPhone" class="input" placeholder="رقم الهاتف"></FormField>
      <FormField label="العنوان أو السبب" hint="مثال: قبض دفعة سيارة، مصروف صيانة، بيع سيارة"><input v-model.trim="form.title" class="input" placeholder="سبب الفاتورة"></FormField>
      <FormField label="المبلغ" hint="قيمة الفاتورة أو السند"><input v-model.number="form.amount" type="number" class="input" placeholder="0"></FormField>
      <FormField label="العملة" hint="عملة المبلغ"><select v-model="form.currency" class="input"><option value="IQD">دينار عراقي</option><option value="USD">دولار</option></select></FormField>
      <FormField label="ملاحظات" hint="اختياري"><input v-model.trim="form.notes" class="input" placeholder="ملاحظات"></FormField>
      <div class="form-field justify-end"><span class="form-label">الإجراء</span><button class="btn-primary btn" :disabled="busy" @click="save">{{busy?'جاري الحفظ':'حفظ الفاتورة'}}</button></div>
    </div></div>
    <div class="card overflow-x-auto"><table class="table"><thead><tr><th>رقم الفاتورة</th><th>النوع</th><th>العميل</th><th>العنوان</th><th>المبلغ</th><th>التاريخ</th><th>الإجراءات</th></tr></thead><tbody>
      <tr v-for="i in data" :key="i.id"><td class="font-black">{{i.invoiceNumber}}</td><td>{{i.invoiceType}}</td><td>{{i.customerName}}</td><td>{{i.title}}</td><td>{{money(i.amount,i.currency)}}</td><td>{{dateText(i.invoiceDate)}}</td><td><div class="action-bar"><button class="btn-secondary btn py-2" @click="openInvoice(i,'html')">عرض/طباعة</button><button class="btn-secondary btn py-2" @click="openInvoice(i,'html')">PDF</button><button class="btn-primary btn py-2" @click="openInvoice(i,'word')">Word</button></div></td></tr>
      <tr v-if="!data?.length"><td colspan="7" class="text-center text-muted py-8">لا توجد فواتير بعد.</td></tr>
    </tbody></table></div>
  </section>
</template>
<script setup lang="ts">
const { data, refresh } = useLazyFetch<any[]>('/api/invoices', { default: () => [] })
const form=reactive({invoiceType:'سند قبض', customerName:'', customerPhone:'', title:'', amount:0, currency:'IQD', notes:''})
const busy=ref(false); const message=ref(''); const messageType=ref<'ok'|'error'>('ok')
function notify(t:string,type:'ok'|'error'='ok'){message.value=t;messageType.value=type;setTimeout(()=>message.value='',3500)}
async function save(){ if(!form.customerName||!form.title||!form.amount) return notify('أكمل اسم العميل والعنوان والمبلغ','error'); busy.value=true; try{ await $fetch('/api/invoices',{method:'POST',body:form}); Object.assign(form,{invoiceType:'سند قبض', customerName:'', customerPhone:'', title:'', amount:0, currency:'IQD', notes:''}); await refresh(); notify('تم حفظ الفاتورة') }catch(e:any){notify(e?.data?.message||'تعذر حفظ الفاتورة','error')}finally{busy.value=false} }
function openInvoice(i:any,type:'html'|'word'){ window.open(`/api/invoices/${i.id}/document?type=${type}`,'_blank') }
function openAllPrint(){ window.open('/api/invoices/print-all','_blank') }
</script>
