<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <div class="card p-6">
      <h2 class="text-xl font-black mb-5">معلومات المعرض</h2>
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
          <FormField label="شعار المعرض" hint="اختياري، يظهر في البروفايل والفواتير">
            <input class="input" type="file" accept="image/*" @change="onLogo">
          </FormField>
          <img v-if="form.logoUrl" :src="form.logoUrl" class="h-24 w-24 rounded-2xl object-cover border" style="border-color:var(--border)">
          <button class="btn-primary btn" :disabled="busy" @click="save">{{busy?'جاري الحفظ':'حفظ الإعدادات'}}</button>
        </div>
      </div>
    </div>
    <div class="card p-6">
      <h2 class="text-xl font-black mb-5">نظام الدولار فقط</h2>
      <div class="grid gap-3 text-muted leading-8">
        <p>كل الأسعار والمبيعات والمشتريات والأقساط والفواتير تظهر بالدولار فقط.</p>
        <p>أي مبلغ جديد تدخله داخل النظام يتم حفظه واعتماده بالدولار تلقائياً.</p>
        <p>لا توجد حاجة لإدخال عملة أو سعر صرف داخل النظام.</p>
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
const { data, pending, refresh } = useFetch<any>('/api/settings', { default: () => ({ dealerName:'AutoDealer Pro', phone:'', address:'', usdToIqdRate:1, logoUrl:'' }) })
const form=reactive<any>({dealerName:'AutoDealer Pro',phone:'',address:'',usdToIqdRate:1,logoUrl:''})
const busy=ref(false); const message=ref(''); const messageType=ref<'ok'|'error'>('ok')
watch(data,(v)=>{ if(v) Object.assign(form, v, { usdToIqdRate: 1 }) }, { immediate:true })
function notify(t:string,type:'ok'|'error'='ok'){message.value=t;messageType.value=type;setTimeout(()=>message.value='',3000)}
function onLogo(e:any){const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>form.logoUrl=String(r.result); r.readAsDataURL(f)}
async function save(){
  busy.value=true
  try{
    form.usdToIqdRate = 1
    await $fetch('/api/settings',{method:'POST',body:form})
    await refresh()
    notify('تم حفظ الإعدادات')
  }catch(e:any){notify(e?.data?.message||'تعذر حفظ الإعدادات','error')}
  finally{busy.value=false}
}
</script>
