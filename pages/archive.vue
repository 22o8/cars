<script setup lang="ts">
import type { Transaction } from '~/types'
import { stageLabel } from '~/utils/stages'

const {transactions,archiveGrandTotal,currentStage,update,setStage,canComplete,stageRoleMap,persist}=useTransactions()
const {currentUser,can}=useAuth(); const {saveFile,openFile,downloadFile,mergeToPdf}=useFileStore()
const q=ref(''),from=ref(''),to=ref(''),toast=ref(''),busy=ref<string>('')
const pending=computed(()=>transactions.value.filter(t=>currentStage(t)?.key==='archive'))
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
function notify(s:string){toast.value=s;setTimeout(()=>toast.value='',2600)}
function sourceScans(tx:Transaction){return tx.attachments.filter(a=>['stage-scan','archive-scan'].includes(a.category))}
function priorScans(tx:Transaction){return tx.attachments.filter(a=>a.category==='stage-scan')}
function archiveScans(tx:Transaction){return tx.attachments.filter(a=>a.category==='archive-scan')}
function mergedFile(tx:Transaction){return tx.attachments.find(a=>a.category==='merged')}
function scanSummary(tx:Transaction){
  const counts:Record<string,number>={}
  for(const a of priorScans(tx)){const k=a.stageKey||'other';counts[k]=(counts[k]||0)+1}
  return Object.entries(counts).map(([k,v])=>`${stageLabel(k)}: ${v}`).join(' • ')
}
async function uploadScan(tx:Transaction,e:Event){
  const input=e.target as HTMLInputElement;const files=Array.from(input.files||[]);if(!files.length)return
  tx.attachments=tx.attachments.filter(a=>a.category!=='merged')
  for(const f of files){const id='file_'+crypto.randomUUID();await saveFile(id,f);tx.attachments.push({id,name:f.name,mime:f.type,size:f.size,category:'archive-scan',stageKey:'archive',createdAt:new Date().toISOString(),uploadedBy:currentUser.value.name})}
  update(tx,`رفع سكنر الأرشفة (${files.length} ملف)`);input.value='';notify('تم رفع السكنر')
}
function orderedSourceIds(tx:Transaction){
  const order=tx.stages.map(s=>s.key)
  return sourceScans(tx).slice().sort((a,b)=>{
    const ai=order.indexOf(a.stageKey||'archive'),bi=order.indexOf(b.stageKey||'archive')
    if(ai!==bi)return ai-bi
    return a.createdAt.localeCompare(b.createdAt)
  }).map(a=>a.id)
}
async function buildMerged(tx:Transaction){
  const ids=orderedSourceIds(tx)
  if(!ids.length)throw new Error('لا توجد ملفات للدمج')
  const pdf=await mergeToPdf(ids)
  const id=`merged_${tx.id}`
  await saveFile(id,pdf)
  tx.attachments=tx.attachments.filter(a=>a.category!=='merged')
  tx.attachments.push({id,name:`${tx.serial}-ملف-المعاملة-الموحد.pdf`,mime:'application/pdf',size:pdf.size,category:'merged',stageKey:'archive',createdAt:new Date().toISOString(),uploadedBy:currentUser.value.name})
  persist(tx)
  return id
}
async function archiveNow(tx:Transaction){
  if(!can(stageRoleMap.archive))return alert('لا تملك صلاحية الأرشفة')
  const err=canComplete(tx,'archive');if(err)return alert(err)
  busy.value=tx.id
  try{
    await buildMerged(tx)
    update(tx,'حفظ قيم الأرشفة وتجميع ملفات الأقسام في PDF موحد')
    setStage(tx,'archive','done');notify('تمت الأرشفة وتجهيز الملف الموحد')
  }catch(e:any){alert(e?.message||'تعذر إنشاء الملف الموحد')}
  finally{busy.value=''}
}
async function openMerged(tx:Transaction){
  let m=mergedFile(tx)
  if(!m){busy.value=tx.id;try{const id=await buildMerged(tx);await openFile(id)}finally{busy.value=''};return}
  await openFile(m.id)
}
async function downloadMerged(tx:Transaction){const m=mergedFile(tx);if(m)await downloadFile(m.id,m.name)}
</script>

<template>
<section class="archive-page-v3">
  <header class="ops-header archive-header-v3">
    <div><div class="eyebrow">إدارة السجلات</div><h1>الأرشفة</h1><p>استكمال ملف المعاملة، تثبيت القيم المالية، وتجميع مستندات الأقسام في PDF موحد.</p></div>
    <div class="archive-header-meta"><span>بانتظار الأرشفة</span><strong>{{pending.length}}</strong></div>
  </header>

  <div class="archive-kpis-v3">
    <article><span>المعاملات المؤرشفة</span><strong>{{allArchived.length}}</strong><small>إجمالي السجل</small></article>
    <article><span>قيمة النتائج</span><strong>{{fmt(filteredSums.price)}}</strong><small>د.ع</small></article>
    <article><span>الضريبة والرسوم</span><strong>{{fmt(filteredSums.tax+filteredSums.fees)}}</strong><small>د.ع</small></article>
    <article class="total"><span>الإجمالي التراكمي</span><strong>{{fmt(allSums.total)}}</strong><small>د.ع</small></article>
  </div>

  <section class="card archive-intake-card">
    <div class="section-title archive-section-head"><div><h2>قائمة الأرشفة الحالية</h2><p>{{pending.length}} معاملة وصلت إلى المرحلة الأخيرة وتنتظر الإغلاق.</p></div></div>
    <div class="archive-work-list archive-work-list-v3">
      <article v-for="t in pending" :key="t.id" class="archive-item-v3">
        <header><div><b>{{t.serial}}</b><span>{{t.companyName}}</span><small>{{t.vehicleNumber}} · {{t.driverName}}</small></div><div class="archive-item-files"><span>ملفات الأقسام</span><strong>{{priorScans(t).length}}</strong></div></header>
        <div v-if="priorScans(t).length" class="archive-source-summary">{{scanSummary(t)}}</div>
        <div class="archive-input-grid"><div class="field"><label>قيمة البضاعة</label><div class="money-input"><input v-model.number="t.finance.invoiceValue" type="number" class="input"><span>د.ع</span></div></div><div class="field"><label>الضريبة</label><div class="money-input"><input v-model.number="t.finance.tax" type="number" class="input"><span>د.ع</span></div></div><div class="field"><label>الرسوم</label><div class="money-input"><input v-model.number="t.finance.customsFees" type="number" class="input"><span>د.ع</span></div></div></div>
        <div class="archive-item-footer"><div class="archive-item-total"><span>الإجمالي</span><strong>{{fmt(archiveGrandTotal(t))}} <small>د.ع</small></strong></div><div class="archive-upload"><label class="btn ghost">رفع سكنر الأرشفة<input type="file" multiple accept="application/pdf,image/*" hidden @change="uploadScan(t,$event)"></label><span>{{archiveScans(t).length}} ملف</span></div><button class="btn primary" :disabled="busy===t.id" @click="archiveNow(t)">{{busy===t.id?'جاري التجميع...':'أرشفة وإغلاق المعاملة'}}</button></div>
      </article>
      <div v-if="!pending.length" class="empty-state"><b>لا توجد معاملات بانتظار الأرشفة</b><span>المعاملات الجديدة تظهر هنا تلقائياً بعد وصولها لهذه المرحلة.</span></div>
    </div>
  </section>

  <section class="card archive-search-card">
    <div class="archive-search-head"><div><h2>السجل المؤرشف</h2><p>بحث موحد حسب الشركة، المركبة، السائق، رقم البيان أو الإجراء.</p></div><button class="btn ghost mini" @click="q='';from='';to=''">مسح الفلاتر</button></div>
    <div class="archive-filters-v3"><div class="search-field archive-search-field"><span>⌕</span><input v-model="q" placeholder="اكتب للبحث في الأرشيف"></div><div class="date-filter"><label>من</label><input v-model="from" type="date" class="input"></div><div class="date-filter"><label>إلى</label><input v-model="to" type="date" class="input"></div></div>
    <div class="archive-result-summary"><span>النتائج <b>{{archived.length}}</b></span><span>القيمة <b>{{fmt(filteredSums.price)}} د.ع</b></span><span>الضريبة <b>{{fmt(filteredSums.tax)}} د.ع</b></span><span>الرسوم <b>{{fmt(filteredSums.fees)}} د.ع</b></span><span class="strong">الإجمالي <b>{{fmt(filteredSums.total)}} د.ع</b></span></div>
  </section>

  <div class="archive-data-grid">
    <section class="card archive-daily-card"><div class="card-title-line"><h3>الإجمالي حسب التاريخ</h3><span>{{daily.length}} يوم</span></div><div class="table-shell desktop-table"><table class="table archive-table-v3"><thead><tr><th>التاريخ</th><th>المعاملات</th><th>القيمة</th><th>الضريبة</th><th>الرسوم</th><th>الإجمالي</th></tr></thead><tbody><tr v-for="r in daily" :key="r[0]"><td><b>{{r[0]}}</b></td><td>{{r[1].count}}</td><td>{{fmt(r[1].price)}}</td><td>{{fmt(r[1].tax)}}</td><td>{{fmt(r[1].fees)}}</td><td><b>{{fmt(r[1].total)}}</b></td></tr><tr v-if="!daily.length"><td colspan="6"><div class="empty-state compact"><b>لا توجد بيانات</b></div></td></tr></tbody></table></div><div class="mobile-cards archive-day-cards"><article v-for="r in daily" :key="r[0]"><div><b>{{r[0]}}</b><span>{{r[1].count}} معاملة</span></div><strong>{{fmt(r[1].total)}} <small>د.ع</small></strong></article></div></section>

    <section class="card archive-records-card"><div class="card-title-line"><h3>المعاملات المؤرشفة</h3><span>{{archived.length}} نتيجة</span></div><div class="table-shell desktop-table"><table class="table archive-table-v3 records"><thead><tr><th>المعاملة</th><th>التاريخ</th><th>الشركة / السيارة</th><th>البيان</th><th>القيمة</th><th>الإجمالي</th><th>الملف</th></tr></thead><tbody><tr v-for="t in archived" :key="t.id"><td><b>{{t.serial}}</b></td><td>{{new Date(t.archivedAt||t.updatedAt).toLocaleDateString('ar-IQ')}}</td><td><b class="cell-primary">{{t.companyName}}</b><small>{{t.vehicleNumber}}</small></td><td>{{t.declarationNo||'—'}}</td><td>{{fmt(t.finance.invoiceValue)}}</td><td><b>{{fmt(archiveGrandTotal(t))}}</b></td><td><div class="file-actions"><button class="btn ghost mini" :disabled="busy===t.id" @click="openMerged(t)">فتح</button><button v-if="mergedFile(t)" class="btn ghost mini" @click="downloadMerged(t)">تنزيل</button></div></td></tr><tr v-if="!archived.length"><td colspan="7"><div class="empty-state compact"><b>لا توجد معاملات ضمن البحث</b></div></td></tr></tbody></table></div>
      <div class="mobile-cards archive-record-cards"><article v-for="t in archived" :key="t.id"><div class="archive-record-top"><div><b>{{t.serial}}</b><small>{{t.companyName}}</small></div><strong>{{fmt(archiveGrandTotal(t))}} <small>د.ع</small></strong></div><div class="archive-record-data"><span>{{t.vehicleNumber}}</span><span>{{t.declarationNo||'بدون بيان'}}</span><span>{{new Date(t.archivedAt||t.updatedAt).toLocaleDateString('ar-IQ')}}</span></div><div class="archive-record-actions"><button class="btn ghost" @click="openMerged(t)">فتح الملف</button><button v-if="mergedFile(t)" class="btn ghost" @click="downloadMerged(t)">تنزيل</button></div></article></div>
    </section>
  </div>
  <div v-if="toast" class="toast">{{toast}}</div>
</section>
</template>
