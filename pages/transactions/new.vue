<script setup lang="ts">
const { companies, create } = useTransactions(); const router=useRouter()
const form=reactive({companyId:'',driverName:'',vehicleNumber:'',goods:'',unifiedProcedureNo:'',notes:'',needsVeterinary:false,needsAgriculture:false})
function submit(){if(!form.companyId||!form.driverName||!form.vehicleNumber||!form.goods)return alert('أكمل الحقول الأساسية');const tx=create(form);router.push(`/transactions/${tx.id}`)}
</script>
<template>
<div class="page-head"><div><h1>معاملة جديدة</h1><p>أدخل المعلومات الموجودة عند وصول السائق فقط</p></div></div>
<form class="card simple-form" @submit.prevent="submit"><div class="form-grid">
<div class="field wide"><label>الشركة *</label><select v-model="form.companyId" class="input"><option value="">اختر الشركة</option><option v-for="c in companies" :key="c.id" :value="c.id">{{c.name}} {{c.code?`— ${c.code}`:''}}</option></select></div>
<div class="field"><label>رقم الإجراء الموحد</label><input v-model="form.unifiedProcedureNo" class="input" placeholder="يمكن إدخاله لاحقاً"></div>
<div class="field"><label>اسم السائق *</label><input v-model="form.driverName" class="input"></div><div class="field"><label>رقم السيارة *</label><input v-model="form.vehicleNumber" class="input"></div><div class="field"><label>البضاعة *</label><input v-model="form.goods" class="input"></div>
<div class="field full"><label>فحوص إضافية عند الحاجة</label><div class="checks"><label><input v-model="form.needsVeterinary" type="checkbox"> بيطرة</label><label><input v-model="form.needsAgriculture" type="checkbox"> زراعة</label></div></div>
<div class="field full"><label>ملاحظات</label><textarea v-model="form.notes" class="input" rows="2"></textarea></div></div>
<div class="form-actions"><button class="btn primary large" type="submit">إنشاء المعاملة</button><NuxtLink to="/transactions" class="btn ghost">إلغاء</NuxtLink></div></form>
</template>
