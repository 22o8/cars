<template>
  <section class="page-pad fast-fade">
    <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-3xl font-black">شراء السيارات</h1>
        <p class="text-muted mt-2">سجل السيارات التي يشتريها المعرض، مع الواصل والباقي والمدة وتاريخ الاستحقاق.</p>
      </div>
      <button class="btn-secondary btn" @click="refresh">تحديث البيانات</button>
    </div>

    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">
      {{ message }}
    </div>

    <div class="card p-5 mb-6">
      <h2 class="mb-4 text-xl font-black">{{ editingId ? 'تعديل عملية شراء' : 'إضافة عملية شراء سيارة' }}</h2>
      <div class="form-grid">
        <FormField label="اسم البائع" hint="الشخص أو الجهة التي تم شراء السيارة منها">
          <input v-model.trim="form.sellerName" class="input" placeholder="اسم البائع">
        </FormField>
        <FormField label="رقم هاتف البائع" hint="اختياري، يفيد في المتابعة">
          <input v-model.trim="form.sellerPhone" class="input" placeholder="رقم الهاتف">
        </FormField>
        <FormField label="اسم السيارة" hint="مثال: تويوتا كامري 2020">
          <input v-model.trim="form.carName" class="input" placeholder="اسم السيارة">
        </FormField>
        <FormField label="الشركة" hint="اختياري، مثال: تويوتا">
          <input v-model.trim="form.brand" class="input" placeholder="الشركة">
        </FormField>
        <FormField label="النوع" hint="اختياري، مثال: كامري">
          <input v-model.trim="form.model" class="input" placeholder="النوع">
        </FormField>
        <FormField label="الموديل" hint="سنة الصنع إن توفرت">
          <input v-model.number="form.year" type="number" class="input" placeholder="2024">
        </FormField>
        <FormField label="مبلغ الشراء الكلي" hint="قيمة شراء السيارة المتفق عليها">
          <input v-model.number="form.totalAmount" type="number" min="0" class="input" placeholder="المبلغ الكلي">
        </FormField>
        <FormField label="الواصل" hint="المبلغ الذي تم دفعه للبائع فعلاً">
          <input v-model.number="form.paidAmount" type="number" min="0" class="input" placeholder="الواصل">
        </FormField>
        <FormField label="الباقي" hint="يحسب تلقائياً من المبلغ الكلي ناقص الواصل">
          <input :value="remaining" readonly class="input bg-slate-500/10" placeholder="الباقي">
        </FormField>
        <FormField label="العملة" hint="عملة عملية الشراء">
          <select v-model="form.currency" class="input"><option value="IQD">دينار عراقي</option><option value="USD">دولار</option></select>
        </FormField>
        <FormField label="من تاريخ" hint="تاريخ بداية الاتفاق أو تاريخ الشراء">
          <input v-model="form.fromDate" type="date" class="input">
        </FormField>
        <FormField label="المدة بالأيام" hint="إذا يوجد باقي، اكتب مدة تسديد الباقي بالأيام">
          <input v-model.number="form.durationDays" type="number" min="0" class="input" placeholder="مثال: 30">
        </FormField>
        <FormField label="تاريخ الاستحقاق" hint="يحسب تلقائياً من تاريخ البداية + المدة">
          <input :value="dueDateText" readonly class="input bg-slate-500/10" placeholder="تاريخ الاستحقاق">
        </FormField>
        <FormField label="إضافة السيارة للمخزن" hint="عند التفعيل يتم إنشاء السيارة تلقائياً في إدارة السيارات">
          <select v-model="form.createCar" class="input"><option :value="true">نعم، أضفها للمخزن</option><option :value="false">لا، سجل الشراء فقط</option></select>
        </FormField>
        <FormField label="صور السيارة أو العقد" hint="يمكن رفع أكثر من صورة للشراء أو السيارة">
          <input class="input" type="file" accept="image/*" multiple @change="onImages">
        </FormField>
        <FormField label="ملاحظات" hint="أي تفاصيل تخص عملية الشراء">
          <input v-model.trim="form.notes" class="input" placeholder="ملاحظات">
        </FormField>
      </div>

      <div v-if="images.length" class="mt-5 grid gap-3 md:grid-cols-4">
        <img v-for="(img,i) in images" :key="i" :src="img" class="h-32 w-full rounded-2xl object-cover border" style="border-color:var(--border)">
      </div>

      <div class="mt-5 grid gap-3 lg:grid-cols-4">
        <div class="soft-card p-4"><div class="text-muted text-sm">مبلغ الشراء</div><b>{{ money(form.totalAmount, form.currency) }}</b></div>
        <div class="soft-card p-4"><div class="text-muted text-sm">الواصل</div><b class="text-emerald-500">{{ money(form.paidAmount, form.currency) }}</b></div>
        <div class="soft-card p-4"><div class="text-muted text-sm">الباقي</div><b class="text-amber-500">{{ money(remaining, form.currency) }}</b></div>
        <div class="soft-card p-4"><div class="text-muted text-sm">الاستحقاق</div><b>{{ dueDateText || '-' }}</b></div>
      </div>

      <div class="mt-5 flex flex-col gap-2 sm:flex-row">
        <button class="btn-primary btn" :disabled="busy" @click="save">{{ busy ? 'جاري الحفظ' : editingId ? 'حفظ التعديل' : 'تسجيل شراء السيارة' }}</button>
        <button v-if="editingId" class="btn-secondary btn" @click="reset">إلغاء التعديل</button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-4 mb-6">
      <div class="card p-4"><div class="text-muted text-sm">عمليات الشراء</div><b class="text-2xl">{{ purchases.length }}</b></div>
      <div class="card p-4"><div class="text-muted text-sm">إجمالي الشراء</div><b class="text-2xl">{{ money(totalAmount, 'IQD') }}</b></div>
      <div class="card p-4"><div class="text-muted text-sm">إجمالي الواصل</div><b class="text-2xl text-emerald-500">{{ money(totalPaid, 'IQD') }}</b></div>
      <div class="card p-4"><div class="text-muted text-sm">ديون الشراء</div><b class="text-2xl text-amber-500">{{ money(totalRemaining, 'IQD') }}</b></div>
    </div>

    <div class="card overflow-x-auto">
      <table class="table">
        <thead><tr><th>البائع</th><th>السيارة</th><th>الواصل</th><th>الباقي</th><th>من تاريخ</th><th>الاستحقاق</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          <tr v-for="p in purchases" :key="p.id">
            <td class="font-black">{{ p.sellerName }}<div class="text-xs text-muted">{{ p.sellerPhone || '-' }}</div></td>
            <td>{{ p.carName }}<div class="text-xs text-muted">{{ [p.brand,p.model,p.year].filter(Boolean).join(' ') }}</div></td>
            <td>{{ money(p.paidAmount,p.currency) }}</td>
            <td class="font-black text-amber-500">{{ money(p.remainingAmount,p.currency) }}</td>
            <td>{{ dateText(p.fromDate) }}</td>
            <td>{{ p.dueDate ? dateText(p.dueDate) : '-' }}</td>
            <td><span class="badge">{{ status(p.status) }}</span></td>
            <td><div class="action-bar"><button v-if="Number(p.remainingAmount || 0) > 0" class="btn-primary btn py-2" @click="pay(p)">تسديد</button><button class="btn-secondary btn py-2" @click="edit(p)">تعديل</button><button class="btn-danger btn py-2" @click="remove(p)">حذف</button></div></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
const { data, refresh } = useLazyFetch<any[]>('/api/purchases', { default: () => [] })
const purchases = computed(() => data.value || [])
const empty = () => ({ sellerName:'', sellerPhone:'', carName:'', brand:'', model:'', year:null as number|null, totalAmount:0, paidAmount:0, currency:'IQD', durationDays:0, fromDate:new Date().toISOString().slice(0,10), notes:'', imageUrls:[] as string[], createCar:true })
const form = reactive<any>(empty())
const images = ref<string[]>([])
const editingId = ref('')
const busy = ref(false)
const message = ref('')
const messageType = ref<'ok'|'error'>('ok')
const remaining = computed(() => Math.max(Number(form.totalAmount || 0) - Number(form.paidAmount || 0), 0))
const dueDateText = computed(() => {
  if (!form.fromDate || !Number(form.durationDays || 0)) return ''
  const d = new Date(form.fromDate)
  d.setDate(d.getDate() + Number(form.durationDays || 0))
  return d.toISOString().slice(0,10)
})
const totalAmount = computed(() => purchases.value.reduce((a,p)=>a+Number(p.totalAmount||0),0))
const totalPaid = computed(() => purchases.value.reduce((a,p)=>a+Number(p.paidAmount||0),0))
const totalRemaining = computed(() => purchases.value.reduce((a,p)=>a+Number(p.remainingAmount||0),0))
function notify(t:string,type:'ok'|'error'='ok'){ message.value=t; messageType.value=type; setTimeout(()=>message.value='',3500) }
function fileToData(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(file)})}
async function onImages(e:any){ images.value=[]; for(const f of Array.from(e.target.files||[]) as File[]) images.value.push(await fileToData(f)) }
function reset(){ Object.assign(form, empty()); images.value=[]; editingId.value='' }
async function save(){
  if(!form.sellerName || !form.carName) return notify('اكتب اسم البائع واسم السيارة', 'error')
  busy.value=true
  try{
    const body={...form, imageUrls: images.value, remainingAmount: remaining.value}
    if(editingId.value) await $fetch(`/api/purchases/${editingId.value}`, { method:'PATCH', body })
    else await $fetch('/api/purchases', { method:'POST', body })
    const wasEdit=!!editingId.value
    reset(); await refresh(); notify(wasEdit?'تم تعديل الشراء':'تم تسجيل شراء السيارة')
  }catch(e:any){ notify(e?.data?.message || 'تعذر حفظ عملية الشراء','error') }
  finally{ busy.value=false }
}
function edit(p:any){ editingId.value=p.id; Object.assign(form,{ sellerName:p.sellerName, sellerPhone:p.sellerPhone||'', carName:p.carName, brand:p.brand||'', model:p.model||'', year:p.year||null, totalAmount:Number(p.totalAmount||0), paidAmount:Number(p.paidAmount||0), currency:p.currency, durationDays:p.durationDays||0, fromDate:String(p.fromDate).slice(0,10), notes:p.notes||'', createCar:false }); images.value=Array.isArray(p.imageUrls)?[...p.imageUrls]:[]; window.scrollTo({top:0,behavior:'smooth'}) }
async function pay(p:any){ const remaining=Number(p.remainingAmount||0); if(remaining<=0) return notify('عملية الشراء مسددة بالكامل'); const value=prompt(`اكتب مبلغ التسديد أو اتركه فارغاً لتسديد الباقي كامل: ${remaining}`); if(value===null) return; const amount=value.trim()===''?remaining:Number(value); if(!Number.isFinite(amount)||amount<=0) return notify('مبلغ التسديد غير صحيح','error'); try{ const res:any=await $fetch(`/api/purchases/${p.id}/pay`,{method:'POST',body:{amount}}); await refresh(); const sent=Number(res?.notification?.sent||0); notify(sent>0?'تم التسديد وإرسال إشعار':'تم التسديد، ولم يتم إرسال إشعار') }catch(e:any){ notify(e?.data?.message||'تعذر تسديد دفعة الشراء','error') } }
async function remove(p:any){ if(!confirm('هل تريد حذف عملية الشراء؟')) return; try{ await $fetch(`/api/purchases/${p.id}`,{method:'DELETE'}); await refresh(); notify('تم حذف عملية الشراء') }catch(e:any){ notify(e?.data?.message||'تعذر حذف الشراء','error') } }
function status(s:string){ return { OPEN:'مفتوح', PAID:'مدفوع', LATE:'متأخر' }[s] || s }
</script>
