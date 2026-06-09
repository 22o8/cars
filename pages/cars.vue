<template>
  <section class="page-pad fast-fade">
    <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><h1 class="text-3xl font-black">السيارات والمخزن</h1><p class="text-muted mt-2">إضافة وتعديل السيارات مع الأسعار والصور والحالة، وكل شيء مربوط بالمبيعات والفواتير.</p></div>
      <button class="btn-secondary btn" @click="refresh">تحديث البيانات</button>
    </div>
    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">{{message}}</div>
    <div class="card p-5 mb-6">
      <h2 class="mb-4 text-xl font-black">{{ editingId ? 'تعديل بيانات السيارة' : 'إضافة سيارة جديدة' }}</h2>
      <div class="form-grid">
        <FormField label="شركة السيارة" hint="مثال: تويوتا، هيونداي، كيا"><input v-model.trim="form.brand" class="input" placeholder="اكتب شركة السيارة"></FormField>
        <FormField label="اسم السيارة او النوع" hint="مثال: كامري، لاندكروز، توسان"><input v-model.trim="form.model" class="input" placeholder="اكتب اسم السيارة او النوع"></FormField>
        <FormField label="سنة الصنع" hint="مثال: 2024"><input v-model.number="form.year" type="number" class="input" placeholder="سنة السيارة"></FormField>
        <FormField label="لون السيارة" hint="مثال: أبيض، أسود، رصاصي"><input v-model.trim="form.color" class="input" placeholder="لون السيارة"></FormField>
        <FormField label="سعر الشراء" hint="المبلغ الذي دخلت به السيارة إلى المعرض"><input v-model.number="form.purchasePrice" type="number" class="input" placeholder="سعر الشراء"></FormField>
        <FormField label="سعر البيع المطلوب" hint="السعر الذي تريد عرضه للبيع"><input v-model.number="form.salePrice" type="number" class="input" placeholder="سعر البيع"></FormField>
        <FormField label="عملة السعر" hint="تستخدم في المبيعات والفواتير"><select v-model="form.currency" class="input"><option value="IQD">دينار عراقي</option><option value="USD">دولار</option></select></FormField>
        <FormField label="حالة السيارة" hint="تتحكم بظهور السيارة في صفحة المبيعات"><select v-model="form.status" class="input"><option value="AVAILABLE">متوفرة للبيع</option><option value="RESERVED">محجوزة</option><option value="SOLD">مباعة</option><option value="MAINTENANCE">صيانة</option><option value="ARCHIVED">مؤرشفة</option></select></FormField>
        <FormField label="رقم اللوحة" hint="اختياري"><input v-model.trim="form.plateNumber" class="input" placeholder="رقم اللوحة"></FormField>
        <FormField label="رقم الشاصي" hint="مهم للتمييز بين السيارات"><input v-model.trim="form.vinNumber" class="input" placeholder="رقم الشاصي"></FormField>
        <FormField label="عداد السيارة" hint="عدد الكيلومترات"><input v-model.number="form.mileage" type="number" class="input" placeholder="العداد"></FormField>
        <FormField label="وصف وملاحظات" hint="أي ملاحظات عن السيارة"><input v-model.trim="form.description" class="input" placeholder="ملاحظات السيارة"></FormField>
        <FormField label="صور السيارة" hint="يمكن رفع أكثر من صورة، وتظهر في ملف السيارة"><input class="input" type="file" accept="image/*" multiple @change="onImages"></FormField>
        <div class="form-field justify-end"><span class="form-label">الإجراء</span><button class="btn-primary btn" :disabled="busy" @click="save">{{busy?'جاري الحفظ': editingId ? 'حفظ التعديل' : 'إضافة السيارة'}}</button><button v-if="editingId" class="btn-secondary btn mt-2" @click="cancelEdit">إلغاء التعديل</button></div>
      </div>
      <div v-if="images.length" class="mt-5 grid gap-3 md:grid-cols-4"><img v-for="(img,i) in images" :key="i" :src="img" class="h-32 w-full rounded-2xl object-cover border" style="border-color:var(--border)"></div>
    </div>
    <div class="grid gap-4 md:grid-cols-4 mb-6">
      <div class="card p-4"><div class="text-muted text-sm">إجمالي السيارات</div><b class="text-2xl">{{ cars.length }}</b></div>
      <div class="card p-4"><div class="text-muted text-sm">المتوفرة</div><b class="text-2xl text-emerald-500">{{ cars.filter(c=>c.status==='AVAILABLE').length }}</b></div>
      <div class="card p-4"><div class="text-muted text-sm">المباعة</div><b class="text-2xl text-blue-500">{{ cars.filter(c=>c.status==='SOLD').length }}</b></div>
      <div class="card p-4"><div class="text-muted text-sm">المحجوزة/الصيانة</div><b class="text-2xl text-amber-500">{{ cars.filter(c=>['RESERVED','MAINTENANCE'].includes(c.status)).length }}</b></div>
    </div>
    <div class="card overflow-x-auto"><table class="table"><thead><tr><th>الصورة</th><th>السيارة</th><th>السنة</th><th>اللون</th><th>سعر الشراء</th><th>سعر البيع</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody><tr v-for="c in cars" :key="c.id"><td><img v-if="firstImage(c)" :src="firstImage(c)" class="h-14 w-20 rounded-xl object-cover"><span v-else class="text-muted">لا توجد</span></td><td class="font-black">{{c.brand}} {{c.model}}<div class="text-xs text-muted">{{c.plateNumber || c.vinNumber || ''}}</div></td><td>{{c.year}}</td><td>{{c.color || '-'}}</td><td>{{money(c.purchasePrice,c.currency)}}</td><td>{{money(c.salePrice,c.currency)}}</td><td><span class="badge">{{status(c.status)}}</span></td><td><div class="action-bar"><button class="btn-secondary btn py-2" @click="edit(c)">تعديل</button><button class="btn-danger btn py-2" @click="remove(c)">حذف</button></div></td></tr></tbody></table></div>
  </section>
</template>
<script setup lang="ts">
const { data: carsData, refresh } = useLazyFetch<any[]>('/api/cars', { default: () => [] })
const cars = computed(()=>carsData.value || [])
const empty={brand:'',model:'',year:new Date().getFullYear(),color:'',purchasePrice:0,salePrice:0,currency:'IQD',status:'AVAILABLE',plateNumber:'',vinNumber:'',mileage:0,description:''}
const form=reactive<any>({...empty}); const images=ref<string[]>([]); const editingId=ref(''); const busy=ref(false); const message=ref(''); const messageType=ref<'ok'|'error'>('ok')
function notify(t:string,type:'ok'|'error'='ok'){ message.value=t; messageType.value=type; setTimeout(()=>message.value='',3500) }
function fileToData(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(file)})}
async function onImages(e:any){ images.value=[]; for(const f of Array.from(e.target.files||[]) as File[]) images.value.push(await fileToData(f)) }
function reset(){ Object.assign(form,{...empty,year:new Date().getFullYear()}); images.value=[]; editingId.value='' }
async function save(){ if(!form.brand||!form.model) return notify('اكتب شركة السيارة والموديل أولاً','error'); busy.value=true; try{ const body={...form,imageUrls:images.value}; if(editingId.value) await $fetch(`/api/cars/${editingId.value}`,{method:'PATCH',body}); else await $fetch('/api/cars',{method:'POST',body}); const wasEditing=!!editingId.value; reset(); await refresh(); notify(wasEditing?'تم تعديل السيارة':'تمت إضافة السيارة') }catch(e:any){ notify(e?.data?.message||'تعذر حفظ السيارة','error') }finally{busy.value=false} }
function edit(c:any){ editingId.value=c.id; Object.assign(form,{brand:c.brand,model:c.model,year:c.year,color:c.color||'',purchasePrice:Number(c.purchasePrice||0),salePrice:Number(c.salePrice||0),currency:c.currency,status:c.status,plateNumber:c.plateNumber||'',vinNumber:c.vinNumber||'',mileage:c.mileage||0,description:c.description||''}); images.value=Array.isArray(c.imageUrls)?[...c.imageUrls]:[]; window.scrollTo({top:0,behavior:'smooth'}) }
function cancelEdit(){ reset() }
async function remove(c:any){ if(!confirm('هل تريد حذف السيارة؟')) return; try{ await $fetch(`/api/cars/${c.id}`,{method:'DELETE'}); await refresh(); notify('تم حذف السيارة') }catch(e:any){ notify(e?.data?.message||'تعذر حذف السيارة','error') } }
function status(s:string){return {AVAILABLE:'متوفرة',RESERVED:'محجوزة',SOLD:'مباعة',MAINTENANCE:'صيانة',ARCHIVED:'مؤرشفة'}[s]||s}
function firstImage(c:any){ return Array.isArray(c.imageUrls) && c.imageUrls.length ? c.imageUrls[0] : '' }
</script>
