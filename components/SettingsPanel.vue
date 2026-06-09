<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <div class="card p-6">
      <h2 class="text-xl font-black mb-5">معلومات المعرض وسعر الصرف</h2>
      <div v-if="pending" class="soft-card p-4 text-muted">جاري تحميل الإعدادات...</div>
      <div v-else>
        <div v-if="message" class="mb-4 rounded-2xl border p-3 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">{{message}}</div>
        <div class="grid gap-4">
          <FormField label="اسم المعرض" hint="سيظهر في الفواتير والواجهة والتقارير">
            <input v-model="form.dealerName" class="input" placeholder="اسم المعرض">
          </FormField>
          <FormField label="رقم الهاتف" hint="سيظهر أعلى الفاتورة">
            <input v-model="form.phone" class="input" placeholder="رقم الهاتف">
          </FormField>
          <FormField label="عنوان المعرض" hint="العنوان الرسمي للمعرض">
            <input v-model="form.address" class="input" placeholder="العنوان">
          </FormField>

          <div class="soft-card p-4">
            <h3 class="mb-3 text-lg font-black">سعر صرف الدولار اليوم</h3>
            <p class="mb-4 text-sm text-muted">اكتب السعر بالطريقة المستخدمة في السوق: مثال 100 دولار يساوي 150,000 دينار، والنظام يحسب سعر الدولار الواحد تلقائياً ويحدّث كل التقارير والخزنة والأرباح والديون حسب هذا السعر.</p>
            <div class="grid gap-4 md:grid-cols-2">
              <FormField label="قيمة الدولار" hint="مثال: 100 دولار">
                <input v-model.number="exchange.usdAmount" type="number" min="1" class="input" placeholder="100">
              </FormField>
              <FormField label="ما يعادلها بالدينار العراقي" hint="مثال: 150000 دينار">
                <input v-model.number="exchange.iqdAmount" type="number" min="1" class="input" placeholder="150000">
              </FormField>
            </div>
            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div class="rounded-2xl border p-4" style="border-color:var(--border)">
                <div class="text-sm text-muted">سعر الدولار الواحد المعتمد</div>
                <div class="mt-1 text-2xl font-black text-emerald-400">{{ ratePreview.toLocaleString('en-US') }} د.ع</div>
              </div>
              <div class="rounded-2xl border p-4" style="border-color:var(--border)">
                <div class="text-sm text-muted">مثال تحويل 1,000 دولار</div>
                <div class="mt-1 text-2xl font-black text-blue-400">{{ Math.round(ratePreview * 1000).toLocaleString('en-US') }} د.ع</div>
              </div>
            </div>
          </div>

          <FormField label="شعار المعرض" hint="اختياري، يظهر في البروفايل والفواتير">
            <input class="input" type="file" accept="image/*" @change="onLogo">
          </FormField>
          <img v-if="form.logoUrl" :src="form.logoUrl" class="h-24 w-24 rounded-2xl object-cover border" style="border-color:var(--border)">
          <button class="btn-primary btn" :disabled="busy" @click="save">{{busy?'جاري الحفظ':'حفظ الإعدادات وتحديث سعر الصرف'}}</button>
        </div>
      </div>
    </div>
    <div class="card p-6">
      <h2 class="text-xl font-black mb-5">آلية احتساب سعر الصرف</h2>
      <div class="grid gap-3 text-muted leading-8">
        <p>عند إدخال 100 دولار = 150,000 دينار سيحسب النظام أن الدولار الواحد = 1,500 دينار.</p>
        <p>أي مبلغ مسجل بالدولار يتم تحويله في الإحصائيات والتقارير والخزنة والديون إلى الدينار حسب سعر الصرف الحالي.</p>
        <p>المبالغ الأصلية تبقى محفوظة بعملتها داخل العقود والفواتير حتى لا تضيع الدقة المحاسبية.</p>
        <p>إذا تغير سعر الصرف اليوم، غيّر هذه الخانة واضغط حفظ، وستتحدث الحسابات والتحليلات المعروضة مباشرة حسب السعر الجديد.</p>
        <p>لا ترفع ملف .env إلى GitHub لأنه يحتوي بيانات الاتصال السرية.</p>
      </div>
      <div class="mt-6 grid gap-3">
        <NuxtLink class="btn-secondary btn" to="/settings/account">إعدادات الحساب والبروفايل</NuxtLink>
        <NuxtLink class="btn-secondary btn" to="/settings/backup">النسخ الاحتياطي وإعادة ضبط المصنع</NuxtLink>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
const { data, pending, refresh } = useFetch<any>('/api/settings', { default: () => ({ dealerName:'AutoDealer Pro', phone:'', address:'', usdToIqdRate:1310, logoUrl:'' }) })
const form=reactive<any>({dealerName:'AutoDealer Pro',phone:'',address:'',usdToIqdRate:1310,logoUrl:''})
const exchange=reactive({usdAmount:100, iqdAmount:131000})
const busy=ref(false); const message=ref(''); const messageType=ref<'ok'|'error'>('ok')
const ratePreview = computed(()=>{
  const usd = Number(exchange.usdAmount || 0)
  const iqd = Number(exchange.iqdAmount || 0)
  if(!Number.isFinite(usd) || !Number.isFinite(iqd) || usd <= 0 || iqd <= 0) return Number(form.usdToIqdRate || 1310)
  return Math.round((iqd / usd) * 100) / 100
})
watch(data,(v)=>{ 
  if(v) {
    Object.assign(form, v)
    exchange.usdAmount = 100
    exchange.iqdAmount = Math.round(Number(v.usdToIqdRate || 1310) * 100)
  }
}, { immediate:true })
function notify(t:string,type:'ok'|'error'='ok'){message.value=t;messageType.value=type;setTimeout(()=>message.value='',3000)}
function onLogo(e:any){const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>form.logoUrl=String(r.result); r.readAsDataURL(f)}
async function save(){
  if(!exchange.usdAmount || !exchange.iqdAmount || exchange.usdAmount <= 0 || exchange.iqdAmount <= 0) return notify('اكتب قيمة صحيحة لسعر الصرف','error')
  busy.value=true
  try{
    form.usdToIqdRate = ratePreview.value
    await $fetch('/api/settings',{method:'POST',body:form})
    await refresh()
    notify('تم حفظ سعر الصرف وتحديث الحسابات')
  }catch(e:any){notify(e?.data?.message||'تعذر حفظ الإعدادات','error')}
  finally{busy.value=false}
}
</script>
