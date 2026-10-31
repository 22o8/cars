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
function stageLink(key:string){ if(key==='unified') return '/unified-procedure'; if(key==='asycuda') return '/asycuda'; if(key==='archive') return '/archive'; return `/transactions?stage=${key}` }
</script>
<template>
  <section class="dashboard-hero">
    <div>
      <span class="eyebrow">مركز العمليات</span>
      <h1>لوحة المتابعة</h1>
      <p>نظرة سريعة على حركة المعاملات اليوم، أماكنها الحالية، وما يحتاج تدخلك.</p>
    </div>
    <div class="hero-actions">
      <NuxtLink to="/transactions/new" class="btn primary btn-strong">+ معاملة جديدة</NuxtLink>
      <NuxtLink to="/unified-procedure" class="btn ghost">رقم الإجراء الموحد</NuxtLink>
    </div>
  </section>

  <section class="metric-grid">
    <article class="metric-card"><div class="metric-icon">↺</div><div><small>معاملات اليوم</small><strong>{{todays.length}}</strong><span>إجمالي ما دخل اليوم</span></div></article>
    <article class="metric-card"><div class="metric-icon">▶</div><div><small>قيد العمل الآن</small><strong>{{active.length}}</strong><span>معاملات لم تُسلّم بعد</span></div></article>
    <article class="metric-card"><div class="metric-icon">✓</div><div><small>تم التسليم اليوم</small><strong>{{doneToday}}</strong><span>اكتملت دورة العمل</span></div></article>
    <article class="metric-card metric-money"><div class="metric-icon">د.ع</div><div><small>أرشفة اليوم</small><strong>{{fmt(todayTotal)}}</strong><span>دينار عراقي</span></div></article>
  </section>

  <section class="dashboard-grid">
    <div class="card card-v2 operations-card">
      <div class="section-title section-title-v2"><div><span class="eyebrow">الحركة الحالية</span><h2>أماكن المعاملات الآن</h2></div><span class="soft-chip">إجمالي الأرشيف {{fmt(allArchiveTotal)}} د.ع</span></div>
      <div class="stage-cards stage-cards-v2">
        <NuxtLink v-for="s in stageCounts" :key="s.key" class="stage-card stage-link stage-card-v2" :to="stageLink(s.key)">
          <div class="stage-card-top"><span class="stage-dot"></span><small>{{s.label}}</small></div><strong>{{s.count}}</strong><span>فتح المرحلة ←</span>
        </NuxtLink>
        <div v-if="!stageCounts.length" class="empty empty-v2"><b>لا توجد معاملات جارية</b><span>كل المعاملات مكتملة حالياً.</span></div>
      </div>
    </div>

    <aside class="card card-v2 pulse-card">
      <span class="eyebrow">نبضة اليوم</span><h2>ملخص سريع</h2>
      <div class="pulse-row"><span>نسبة التسليم اليوم</span><b>{{todays.length ? Math.round((doneToday/todays.length)*100) : 0}}%</b></div>
      <div class="progressbar progressbar-v2"><span :style="{width:`${todays.length ? Math.round((doneToday/todays.length)*100) : 0}%`}"></span></div>
      <div class="pulse-kv"><div><small>الجارية</small><b>{{active.length}}</b></div><div><small>المؤرشفة اليوم</small><b>{{archivedToday.length}}</b></div></div>
      <NuxtLink class="btn ghost full-btn" to="/transactions">فتح ساحة العمل</NuxtLink>
    </aside>
  </section>

  <section class="card card-v2 recent-card">
    <div class="section-title section-title-v2"><div><span class="eyebrow">آخر النشاط</span><h2>المعاملات الجارية</h2></div><NuxtLink class="link action-link" to="/transactions">عرض الكل ←</NuxtLink></div>
    <div class="table-wrap desktop-table"><table class="table table-v2"><thead><tr><th>المعاملة</th><th>الشركة</th><th>السائق</th><th>السيارة</th><th>البضاعة</th><th>المكان الحالي</th><th></th></tr></thead><tbody><tr v-for="t in recent" :key="t.id"><td><b>{{t.serial}}</b></td><td>{{t.companyName}}</td><td>{{t.driverName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.goods}}</td><td><div class="current-stage"><StatusBadge :status="currentStage(t)?.status || 'done'"/> <span>{{currentStage(t)?.label}}</span></div></td><td><NuxtLink class="row-action" :to="`/transactions/${t.id}`">فتح</NuxtLink></td></tr><tr v-if="!recent.length"><td colspan="7" class="empty">لا توجد معاملات جارية</td></tr></tbody></table></div>
    <div class="mobile-cards">
      <NuxtLink v-for="t in recent" :key="t.id" :to="`/transactions/${t.id}`" class="mobile-tx-card"><div><b>{{t.serial}}</b><strong>{{t.companyName}}</strong><small>{{t.driverName}} · {{t.vehicleNumber}}</small></div><div><StatusBadge :status="currentStage(t)?.status || 'done'"/><small>{{currentStage(t)?.label}}</small></div></NuxtLink>
      <div v-if="!recent.length" class="empty">لا توجد معاملات جارية</div>
    </div>
  </section>
</template>
