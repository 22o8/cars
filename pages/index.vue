<script setup lang="ts">
const { transactions, currentStage, totalFees } = useTransactions()
const today = computed(() => new Date().toISOString().slice(0,10))
const todays = computed(() => transactions.value.filter(t => t.createdAt.slice(0,10) === today.value))
const doneToday = computed(() => todays.value.filter(t => !!t.deliveredAt).length)
const activeToday = computed(() => todays.value.length - doneToday.value)
const todayFees = computed(() => todays.value.reduce((s,t)=>s+totalFees(t),0))
const allFees = computed(() => transactions.value.reduce((s,t)=>s+totalFees(t),0))
const stageCounts = computed(() => {
  const m:any = {}
  todays.value.forEach(t => { const s=currentStage(t); m[s?.label||'مكتملة']=(m[s?.label||'مكتملة']||0)+1 })
  return Object.entries(m).sort((a:any,b:any)=>b[1]-a[1])
})
const recent = computed(() => transactions.value.slice(0,8))
function fmt(n:number){return new Intl.NumberFormat('ar-IQ').format(n)}
</script>
<template>
  <div class="page-head"><div><h1>لوحة المتابعة</h1><p>الحالة المباشرة للمعاملات من السكودة إلى التسليم</p></div><NuxtLink to="/transactions/new" class="btn primary">+ معاملة جديدة</NuxtLink></div>
  <div class="grid stats">
    <div class="stat"><small>معاملات اليوم</small><strong>{{todays.length}}</strong></div>
    <div class="stat"><small>قيد الإنجاز اليوم</small><strong>{{activeToday}}</strong></div>
    <div class="stat"><small>مكتملة اليوم</small><strong>{{doneToday}}</strong></div>
    <div class="stat"><small>رسوم وضرائب اليوم</small><strong class="money">{{fmt(todayFees)}} د.ع</strong></div>
  </div>
  <div class="card" style="margin-bottom:16px"><div class="section-title"><h3>التوزيع الحالي لمعاملات اليوم</h3><span class="pill">الإجمالي التراكمي: {{fmt(allFees)}} د.ع</span></div><div class="stage-cards"><div v-for="s in stageCounts" :key="String(s[0])" class="stage-card"><small>{{s[0]}}</small><strong>{{s[1]}}</strong></div><div v-if="!stageCounts.length" class="empty">لا توجد معاملات اليوم</div></div></div>
  <div class="card"><div class="section-title"><h3>آخر المعاملات</h3><NuxtLink class="link" to="/transactions">عرض الجميع</NuxtLink></div><div class="table-wrap"><table class="table"><thead><tr><th>المعاملة</th><th>الشركة</th><th>السائق</th><th>السيارة</th><th>البضاعة</th><th>المرحلة الحالية</th><th></th></tr></thead><tbody><tr v-for="t in recent" :key="t.id"><td>{{t.serial}}</td><td>{{t.companyName}}</td><td>{{t.driverName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.goods}}</td><td><StatusBadge :status="currentStage(t)?.status || 'done'"/> {{currentStage(t)?.label}}</td><td><NuxtLink class="link" :to="`/transactions/${t.id}`">فتح</NuxtLink></td></tr><tr v-if="!recent.length"><td colspan="7" class="empty">ابدأ بإنشاء أول معاملة</td></tr></tbody></table></div></div>
</template>
