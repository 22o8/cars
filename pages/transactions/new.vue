<script setup lang="ts">
const { companies, create } = useTransactions(); const router=useRouter()
const form=reactive({companyId:'',driverName:'',vehicleNumber:'',goods:'',unifiedProcedureNo:'',notes:'',needsVeterinary:false,needsAgriculture:false})
function submit(){if(!form.companyId||!form.driverName||!form.vehicleNumber||!form.goods)return alert('أكمل الحقول الأساسية');const tx=create(form);router.push(`/transactions/${tx.id}`)}
</script>
<template><div class="page-head"><div><h1>إنشاء معاملة جديدة</h1><p>البيانات الأولية عند دخول السائق</p></div></div><form class="card" @submit.prevent="submit"><div class="form-grid">
<div class="field wide"><label>الشركة *</label><select v-model="form.companyId" class="input"><option value="">اختر الشركة</option><option v-for="c in companies" :key="c.id" :value="c.id">{{c.name}} {{c.code?`— ${c.code}`:''}}</option></select></div>
<div class="field"><label>رقم الإجراء الموحد</label><input v-model="form.unifiedProcedureNo" class="input" placeholder="يمكن إضافته لاحقاً"></div>
<div class="field"><label>اسم السائق *</label><input v-model="form.driverName" class="input"></div><div class="field"><label>رقم السيارة *</label><input v-model="form.vehicleNumber" class="input"></div><div class="field"><label>البضاعة *</label><input v-model="form.goods" class="input" placeholder="مثال: منظفات"></div>
<div class="field full"><label>فحوص إضافية</label><div class="checks"><label><input v-model="form.needsVeterinary" type="checkbox"> فحص بيطرة</label><label><input v-model="form.needsAgriculture" type="checkbox"> فحص زراعة</label><span class="pill">الإشعاعي أساسي ويضاف تلقائياً</span></div></div>
<div class="field full"><label>ملاحظات</label><textarea v-model="form.notes" class="input" rows="3"></textarea></div></div><div style="margin-top:18px;display:flex;gap:8px"><button class="btn primary" type="submit">حفظ وفتح المعاملة</button><NuxtLink to="/transactions" class="btn ghost">إلغاء</NuxtLink></div></form></template>
