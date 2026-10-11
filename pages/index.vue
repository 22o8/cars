<script setup lang="ts">
const { transactions, currentStage, archiveGrandTotal } = useTransactions()
const today = computed(() => new Date().toISOString().slice(0,10))
const todays = computed(() => transactions.value.filter(t => t.createdAt.slice(0,10) === today.value))
const active = computed(() => transactions.value.filter(t => !t.deliveredAt))
const archivedToday = computed(() => transactions.value.filter(t => t.archivedAt?.slice(0,10)===today.value))
const doneToday = computed(() => todays.value.filter(t => !!t.deliveredAt).length)
const todayTotal = computed(() => archivedToday.value.reduce((s,t)=>s+archiveGrandTotal(t),0))
const allArchiveTotal = computed(() => transactions.value.filter(t=>t.archivedAt).reduce((s,t)=>s+archiveGrandTotal(t),0))
const stageCounts = computed(() => {
  const m:Record<string,{key:string,label:string,count:number}> = {}
  active.value.forEach(t => { const s=currentStage(t); if(!s)return; if(!m[s.key])m[s.key]={key:s.key,label:s.label,count:0}; m[s.key].count++ })
  return Object.values(m).sort((a,b)=>b.count-a.count)
})
const recent = computed(() => active.value.slice(0,10))
function fmt(n:number){return new Intl.NumberFormat('ar-IQ').format(n)}
function stageLink(key:string){ if(key==='asycuda') return '/asycuda'; if(key==='archive') return '/archive'; return `/transactions?stage=${key}` }
</script>
<template>
<div class="page-head"><div><h1>لوحة المتابعة</h1><p>كل المعاملات الجارية في مكان واحد</p></div><NuxtLink to="/transactions/new" class="btn primary">+ معاملة جديدة</NuxtLink></div>
<div class="grid stats"><div class="stat"><small>معاملات اليوم</small><strong>{{todays.length}}</strong></div><div class="stat"><small>معاملات جارية</small><strong>{{active.length}}</strong></div><div class="stat"><small>تم التسليم اليوم</small><strong>{{doneToday}}</strong></div><div class="stat"><small>إجمالي أرشفة اليوم</small><strong class="money">{{fmt(todayTotal)}} د.ع</strong></div></div>
<div class="card" style="margin-bottom:16px"><div class="section-title"><h3>أماكن المعاملات الآن</h3><span class="pill">إجمالي الأرشيف: {{fmt(allArchiveTotal)}} د.ع</span></div><div class="stage-cards"><NuxtLink v-for="s in stageCounts" :key="s.key" class="stage-card stage-link" :to="stageLink(s.key)"><small>{{s.label}}</small><strong>{{s.count}}</strong></NuxtLink><div v-if="!stageCounts.length" class="empty">لا توجد معاملات جارية</div></div></div>
<div class="card"><div class="section-title"><h3>المعاملات الجارية</h3><NuxtLink class="link" to="/transactions">فتح ساحة العمل</NuxtLink></div><div class="table-wrap"><table class="table"><thead><tr><th>المعاملة</th><th>الشركة</th><th>السائق</th><th>السيارة</th><th>البضاعة</th><th>المكان الحالي</th><th></th></tr></thead><tbody><tr v-for="t in recent" :key="t.id"><td>{{t.serial}}</td><td>{{t.companyName}}</td><td>{{t.driverName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.goods}}</td><td><StatusBadge :status="currentStage(t)?.status || 'done'"/> {{currentStage(t)?.label}}</td><td><NuxtLink class="link" :to="`/transactions/${t.id}`">فتح</NuxtLink></td></tr><tr v-if="!recent.length"><td colspan="7" class="empty">لا توجد معاملات جارية</td></tr></tbody></table></div></div>
</template>
