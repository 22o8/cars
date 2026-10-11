<script setup lang="ts">
const { transactions, currentStage } = useTransactions()
const q=ref(''), from=ref(''), to=ref(''), stage=ref('')
const filtered=computed(()=>transactions.value.filter(t=>{
  const hay=[t.serial,t.companyName,t.companyCode,t.driverName,t.vehicleNumber,t.goods,t.unifiedProcedureNo,t.declarationNo,t.manifestNo].join(' ').toLowerCase()
  if(q.value && !hay.includes(q.value.toLowerCase())) return false
  const d=t.createdAt.slice(0,10); if(from.value&&d<from.value)return false;if(to.value&&d>to.value)return false
  if(stage.value && currentStage(t)?.key!==stage.value)return false
  return true
}))
</script>
<template><div class="page-head"><div><h1>المعاملات</h1><p>بحث وتتبع جميع المعاملات</p></div><NuxtLink to="/transactions/new" class="btn primary">+ معاملة جديدة</NuxtLink></div>
<div class="card"><div class="filters"><input v-model="q" class="input" style="min-width:260px" placeholder="بحث: شركة، سائق، سيارة، إجراء، بيان، مانيفست"><input v-model="from" type="date" class="input"><input v-model="to" type="date" class="input"><select v-model="stage" class="input"><option value="">كل المراحل</option><option value="asycuda">السكودة</option><option value="inspection">الكشف</option><option value="radiation">الإشعاعي</option><option value="audit">التدقيق</option><option value="cashier">الصندوق</option><option value="transport">النقل البري</option><option value="archive">الأرشفة</option></select></div>
<div class="table-wrap"><table class="table"><thead><tr><th>رقم</th><th>التاريخ</th><th>الشركة</th><th>السائق</th><th>السيارة</th><th>البضاعة</th><th>الإجراء الموحد</th><th>الحالة</th><th></th></tr></thead><tbody><tr v-for="t in filtered" :key="t.id"><td>{{t.serial}}</td><td>{{new Date(t.createdAt).toLocaleDateString('ar-IQ')}}</td><td>{{t.companyName}}</td><td>{{t.driverName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.goods}}</td><td>{{t.unifiedProcedureNo||'—'}}</td><td><StatusBadge :status="currentStage(t)?.status||'done'"/> {{currentStage(t)?.label}}</td><td><NuxtLink class="link" :to="`/transactions/${t.id}`">فتح</NuxtLink></td></tr><tr v-if="!filtered.length"><td colspan="9" class="empty">لا توجد نتائج</td></tr></tbody></table></div></div></template>
