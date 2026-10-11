<script setup lang="ts">
const {transactions,archiveGrandTotal}=useTransactions(); const {openFile}=useFileStore()
const q=ref(''),from=ref(''),to=ref('')
const allArchived=computed(()=>transactions.value.filter(t=>t.stages.find(s=>s.key==='archive')?.status==='done'))
const archived=computed(()=>allArchived.value.filter(t=>{
  const d=(t.archivedAt||t.updatedAt||t.createdAt).slice(0,10)
  const hay=[t.serial,t.companyName,t.driverName,t.vehicleNumber,t.declarationNo,t.unifiedProcedureNo].join(' ').toLowerCase()
  return (!q.value||hay.includes(q.value.toLowerCase()))&&(!from.value||d>=from.value)&&(!to.value||d<=to.value)
}))
function sums(list:any[]){return list.reduce((a,t)=>{a.price+=Number(t.finance.invoiceValue||0);a.tax+=Number(t.finance.tax||0);a.fees+=Number(t.finance.customsFees||0);a.total+=archiveGrandTotal(t);return a},{price:0,tax:0,fees:0,total:0})}
const filteredSums=computed(()=>sums(archived.value)); const allSums=computed(()=>sums(allArchived.value))
const daily=computed(()=>{const m:Record<string,any>={};for(const t of archived.value){const d=(t.archivedAt||t.updatedAt||t.createdAt).slice(0,10);if(!m[d])m[d]={count:0,price:0,tax:0,fees:0,total:0};m[d].count++;m[d].price+=Number(t.finance.invoiceValue||0);m[d].tax+=Number(t.finance.tax||0);m[d].fees+=Number(t.finance.customsFees||0);m[d].total+=archiveGrandTotal(t)}return Object.entries(m).sort((a,b)=>b[0].localeCompare(a[0]))})
function fmt(n:number){return new Intl.NumberFormat('ar-IQ').format(Number(n||0))}
</script>
<template>
<div class="page-head"><div><h1>الأرشيف</h1><p>المعاملات المرفوعة بالسكنر والقيم المالية</p></div></div>
<div class="card" style="margin-bottom:16px"><div class="filters"><input v-model="q" class="input" placeholder="بحث: شركة، سيارة، سائق، إجراء، بيان" style="min-width:300px"><input v-model="from" type="date" class="input"><input v-model="to" type="date" class="input"><button class="btn" @click="q='';from='';to=''">مسح</button></div></div>
<div class="grid stats archive-stats"><div class="stat"><small>عدد النتائج</small><strong>{{archived.length}}</strong></div><div class="stat"><small>الأسعار ضمن النتائج</small><strong>{{fmt(filteredSums.price)}} د.ع</strong></div><div class="stat"><small>الضريبة ضمن النتائج</small><strong>{{fmt(filteredSums.tax)}} د.ع</strong></div><div class="stat"><small>الرسوم ضمن النتائج</small><strong>{{fmt(filteredSums.fees)}} د.ع</strong></div><div class="stat highlight"><small>إجمالي النتائج</small><strong>{{fmt(filteredSums.total)}} د.ع</strong></div><div class="stat"><small>الإجمالي لجميع التواريخ</small><strong>{{fmt(allSums.total)}} د.ع</strong></div></div>

<div class="card" style="margin-bottom:16px"><h3>الإجمالي حسب تاريخ الأرشفة</h3><div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>عدد المعاملات</th><th>الأسعار</th><th>الضريبة</th><th>الرسوم</th><th>الإجمالي</th></tr></thead><tbody><tr v-for="r in daily" :key="r[0]"><td>{{r[0]}}</td><td>{{r[1].count}}</td><td>{{fmt(r[1].price)}}</td><td>{{fmt(r[1].tax)}}</td><td>{{fmt(r[1].fees)}}</td><td><b>{{fmt(r[1].total)}}</b></td></tr><tr v-if="!daily.length"><td colspan="6" class="empty">لا توجد بيانات</td></tr></tbody></table></div></div>

<div class="card"><h3>المعاملات المؤرشفة</h3><div class="table-wrap"><table class="table"><thead><tr><th>المعاملة</th><th>تاريخ الأرشفة</th><th>الشركة</th><th>السيارة</th><th>البيان</th><th>الأسعار</th><th>الضريبة</th><th>الرسوم</th><th>الإجمالي</th><th>السكنر</th></tr></thead><tbody><tr v-for="t in archived" :key="t.id"><td><NuxtLink class="link" :to="`/transactions/${t.id}`">{{t.serial}}</NuxtLink></td><td>{{new Date(t.archivedAt||t.updatedAt).toLocaleDateString('ar-IQ')}}</td><td>{{t.companyName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.declarationNo||'—'}}</td><td>{{fmt(t.finance.invoiceValue)}}</td><td>{{fmt(t.finance.tax)}}</td><td>{{fmt(t.finance.customsFees)}}</td><td><b>{{fmt(archiveGrandTotal(t))}}</b></td><td><button v-if="t.attachments.find(a=>a.category==='scan')" class="btn ghost mini" @click="openFile(t.attachments.find(a=>a.category==='scan')!.id)">فتح</button><span v-else>—</span></td></tr><tr v-if="!archived.length"><td colspan="10" class="empty">لا توجد معاملات مؤرشفة ضمن البحث</td></tr></tbody></table></div></div>
</template>
