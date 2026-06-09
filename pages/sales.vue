<template>
  <section class="page-pad fast-fade">
    <div class="mb-6"><h1 class="text-3xl font-black">المبيعات والأقساط</h1><p class="text-muted mt-2">أنشئ بيع نقدي أو أقساط أو مراوسة، وسيتم حساب المدفوع والمتبقي وإنشاء السجل تلقائياً.</p></div>
    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">{{message}}</div>
    <div class="card p-5 mb-6">
      <h2 class="mb-4 text-xl font-black">بيانات البيع الأساسية</h2>
      <div class="form-grid">
        <FormField label="العميل" hint="اختر العميل الذي سيتم تسجيل العقد باسمه"><select v-model="form.customerId" class="input"><option value="">اختر العميل</option><option v-for="c in customers" :key="c.id" :value="c.id">{{c.fullName}} - {{c.phone}}</option></select></FormField>
        <FormField label="السيارة المباعة" hint="تظهر فقط السيارات المتوفرة للبيع"><select v-model="form.carId" class="input"><option value="">اختر السيارة</option><option v-for="c in availableCars" :key="c.id" :value="c.id">{{c.brand}} {{c.model}} - {{money(c.salePrice,c.currency)}}</option></select></FormField>
        <FormField label="سعر البيع النهائي" hint="المبلغ النهائي المتفق عليه مع العميل"><input v-model.number="form.salePrice" type="number" class="input" placeholder="سعر البيع"></FormField>
        <FormField label="الدفعة الأولى" hint="المبلغ الذي دفعه العميل الآن"><input v-model.number="form.firstPayment" type="number" class="input" placeholder="الدفعة الأولى"></FormField>
        <FormField label="العملة" hint="عملة البيع لهذا العقد"><select v-model="form.currency" class="input"><option value="IQD">دينار عراقي</option><option value="USD">دولار</option></select></FormField>
        <FormField label="نوع البيع" hint="حدد طريقة البيع المعتمدة"><select v-model="form.saleType" class="input"><option value="CASH">نقدي</option><option value="INSTALLMENT">أقساط</option><option value="TRADE_IN">مراوسة</option></select></FormField>
        <FormField v-if="form.saleType!=='CASH'" label="عدد الأقساط" hint="عدد الدفعات التي سيتم توزيع المتبقي عليها"><input v-model.number="form.installmentsCount" type="number" class="input" placeholder="عدد الأقساط"></FormField>
        <FormField v-if="form.saleType!=='CASH'" label="الفترة بين الأقساط بالأيام" hint="مثال: 30 يعني قسط كل شهر تقريباً"><input v-model.number="form.intervalDays" type="number" class="input" placeholder="30"></FormField>
        <FormField v-if="form.saleType!=='CASH'" label="تاريخ أول قسط" hint="تاريخ استحقاق أول دفعة"><input v-model="form.firstDueDate" type="date" class="input"></FormField>
        <FormField label="ملاحظات العقد" hint="اختياري"><input v-model.trim="form.notes" class="input" placeholder="ملاحظات"></FormField>
      </div>
      <div class="mt-4 grid gap-3 lg:grid-cols-3"><div class="soft-card p-4"><div class="text-muted text-sm">سعر البيع</div><b>{{ money(form.salePrice, form.currency) }}</b></div><div class="soft-card p-4"><div class="text-muted text-sm">المدفوع الآن</div><b>{{ money(form.firstPayment, form.currency) }}</b></div><div class="soft-card p-4"><div class="text-muted text-sm">المتبقي على العميل</div><b class="text-amber-500">{{ money(remaining, form.currency) }}</b></div></div>
      <button class="btn-primary btn mt-4 w-full lg:w-auto" :disabled="busy" @click="sell">{{busy?'جاري تنفيذ البيع':'تنفيذ البيع وإنشاء السجل'}}</button>
    </div>
    <div class="card overflow-x-auto"><table class="table"><thead><tr><th>العميل</th><th>السيارة</th><th>نوع البيع</th><th>السعر</th><th>المدفوع</th><th>المتبقي</th><th>التاريخ</th></tr></thead><tbody><tr v-for="s in sales" :key="s.id"><td class="font-black">{{s.customer.fullName}}</td><td>{{s.car.brand}} {{s.car.model}}</td><td>{{saleType(s.saleType)}}</td><td>{{money(s.salePrice,s.currency)}}</td><td>{{money(s.paidAmount,s.currency)}}</td><td class="font-black text-amber-500">{{money(s.remainingAmount,s.currency)}}</td><td>{{dateText(s.saleDate)}}</td></tr></tbody></table></div>
  </section>
</template>
<script setup lang="ts">
const { data: cars, refresh: refreshCars }=useLazyFetch<any[]>('/api/cars',{default:()=>[]}); const { data: customers }=useLazyFetch<any[]>('/api/customers',{default:()=>[]}); const { data: sales, refresh }=useLazyFetch<any[]>('/api/sales',{default:()=>[]})
const form=reactive({customerId:'',carId:'',saleType:'CASH',salePrice:0,firstPayment:0,currency:'IQD',installmentsCount:0,intervalDays:30,firstDueDate:'',notes:''})
const busy=ref(false); const message=ref(''); const messageType=ref<'ok'|'error'>('ok')
const availableCars=computed(()=>cars.value?.filter(c=>c.status==='AVAILABLE')||[]); const remaining=computed(()=>Math.max(Number(form.salePrice||0)-Number(form.firstPayment||0),0))
function notify(t:string,type:'ok'|'error'='ok'){ message.value=t; messageType.value=type; setTimeout(()=>message.value='',3500) }
watch(()=>form.carId,()=>{ const car=availableCars.value.find((c:any)=>c.id===form.carId); if(car){ form.salePrice=Number(car.salePrice); form.currency=car.currency } })
async function sell(){ if(!form.customerId||!form.carId||!form.salePrice) return notify('اختر العميل والسيارة واكتب سعر البيع','error'); busy.value=true; try{ await $fetch('/api/sales',{method:'POST',body:form}); Object.assign(form,{customerId:'',carId:'',saleType:'CASH',salePrice:0,firstPayment:0,currency:'IQD',installmentsCount:0,intervalDays:30,firstDueDate:'',notes:''}); await Promise.all([refresh(),refreshCars()]); notify('تم تنفيذ البيع وإنشاء الفاتورة') }catch(e:any){ notify(e?.data?.message||'تعذر تنفيذ البيع','error') }finally{busy.value=false} }
function saleType(t:string){return {CASH:'نقدي',INSTALLMENT:'أقساط',TRADE_IN:'مراوسة'}[t]||t}
</script>
