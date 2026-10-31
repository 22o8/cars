<script setup lang="ts">
const { companies, create } = useTransactions(); const router=useRouter()
const form=reactive({companyId:'',driverName:'',vehicleNumber:'',goods:'',unifiedProcedureNo:'',notes:'',needsVeterinary:false,needsAgriculture:false})
const selectedCompany=computed(()=>companies.value.find(c=>c.id===form.companyId))
const completeFields=computed(()=>[form.companyId,form.driverName,form.vehicleNumber,form.goods].filter(Boolean).length)
function submit(){if(!form.companyId||!form.driverName||!form.vehicleNumber||!form.goods)return alert('أكمل الحقول الأساسية');const tx=create(form);router.push(`/transactions/${tx.id}`)}
</script>
<template>
<section class="create-page">
  <header class="ops-header create-header">
    <div><div class="eyebrow">استقبال السائق</div><h1>إنشاء معاملة جديدة</h1><p>سجّل بيانات الوصول الأساسية فقط. بقية المعلومات تُستكمل تلقائياً أثناء رحلة المعاملة.</p></div>
    <NuxtLink to="/transactions" class="btn ghost">الرجوع لساحة العمل</NuxtLink>
  </header>

  <form class="create-layout" @submit.prevent="submit">
    <main class="card create-form-card">
      <div class="form-section-head"><div><span>01</span><div><h2>بيانات الشركة</h2><p>اختر الشركة المسجلة في قاعدة النظام.</p></div></div></div>
      <div class="form-grid create-grid">
        <div class="field wide"><label>الشركة <em>مطلوب</em></label><select v-model="form.companyId" class="input"><option value="">اختر الشركة</option><option v-for="c in companies" :key="c.id" :value="c.id">{{c.name}} {{c.code?`— ${c.code}`:''}}</option></select></div>
        <div class="field"><label>رقم الإجراء الموحد <span>اختياري</span></label><input v-model="form.unifiedProcedureNo" class="input" placeholder="يُضاف لاحقاً إذا لم يكن جاهزاً"></div>
      </div>

      <div class="form-divider"></div>
      <div class="form-section-head"><div><span>02</span><div><h2>بيانات السائق والحمل</h2><p>المعلومات الموجودة عند دخول السيارة للمنفذ.</p></div></div></div>
      <div class="form-grid create-grid">
        <div class="field"><label>اسم السائق <em>مطلوب</em></label><input v-model="form.driverName" class="input" autocomplete="off" placeholder="الاسم كما هو في المستند"></div>
        <div class="field"><label>رقم السيارة <em>مطلوب</em></label><input v-model="form.vehicleNumber" class="input ltr-field" autocomplete="off" placeholder="رقم المركبة"></div>
        <div class="field"><label>البضاعة <em>مطلوب</em></label><input v-model="form.goods" class="input" autocomplete="off" placeholder="وصف مختصر للبضاعة"></div>
      </div>

      <div class="form-divider"></div>
      <div class="form-section-head"><div><span>03</span><div><h2>فحوص وملاحظات</h2><p>فعّل الفحص الإضافي فقط إذا كان مطلوباً لنوع البضاعة.</p></div></div></div>
      <div class="inspection-options">
        <label :class="{checked:form.needsVeterinary}"><input v-model="form.needsVeterinary" type="checkbox"><span><b>فحص البيطرة</b><small>للبضائع الخاضعة للفحص البيطري</small></span></label>
        <label :class="{checked:form.needsAgriculture}"><input v-model="form.needsAgriculture" type="checkbox"><span><b>فحص الزراعة</b><small>للبضائع الخاضعة للفحص الزراعي</small></span></label>
      </div>
      <div class="field notes-field"><label>ملاحظات <span>اختياري</span></label><textarea v-model="form.notes" class="input" rows="3" placeholder="أي ملاحظة تساعد الأقسام التالية"></textarea></div>

      <div class="create-actions"><NuxtLink to="/transactions" class="btn ghost">إلغاء</NuxtLink><button class="btn primary large" type="submit">إنشاء المعاملة</button></div>
    </main>

    <aside class="create-aside">
      <section class="card create-summary-card">
        <div class="summary-status"><span :class="{ready:completeFields===4}"></span><div><b>{{completeFields===4?'جاهزة للإنشاء':'بيانات غير مكتملة'}}</b><small>{{completeFields}} من 4 حقول أساسية</small></div></div>
        <div class="summary-list"><div><span>الشركة</span><b>{{selectedCompany?.name || 'لم تُحدد'}}</b></div><div><span>رمز الشركة</span><b>{{selectedCompany?.code || '—'}}</b></div><div><span>السائق</span><b>{{form.driverName || '—'}}</b></div><div><span>السيارة</span><b>{{form.vehicleNumber || '—'}}</b></div><div><span>البضاعة</span><b>{{form.goods || '—'}}</b></div></div>
      </section>
      <section class="create-tip"><b>بعد الإنشاء</b><p>تظهر المعاملة مباشرة في ساحة العمل وتبدأ من أول مرحلة ضمن المسار التشغيلي المحدد.</p></section>
    </aside>
  </form>
</section>
</template>
