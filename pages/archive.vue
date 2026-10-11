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
  persist()
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
<div class="page-head"><div><h1>الأرشفة</h1><p>سكنر الأرشفة والقيم — ملفات الأقسام تُجمع تلقائياً في ملف PDF واحد</p></div></div>

<div class="card" style="margin-bottom:16px"><div class="section-title"><div><h3 style="margin:0">بانتظار الأرشفة</h3><small class="muted">{{pending.length}} معاملة</small></div></div>
  <div class="archive-work-list">
    <div v-for="t in pending" :key="t.id" class="archive-work-row archive-work-row-v4">
      <div class="work-id"><b>{{t.serial}}</b><small>{{t.companyName}} — {{t.vehicleNumber}}</small><span class="source-files-badge">ملفات الأقسام: {{priorScans(t).length}}</span><small v-if="priorScans(t).length" class="muted">{{scanSummary(t)}}</small></div>
      <div class="field"><label>الأسعار / قيمة البضاعة</label><input v-model.number="t.finance.invoiceValue" type="number" class="input"></div>
      <div class="field"><label>الضريبة</label><input v-model.number="t.finance.tax" type="number" class="input"></div>
      <div class="field"><label>الرسوم</label><input v-model.number="t.finance.customsFees" type="number" class="input"></div>
      <div class="archive-total"><small>الإجمالي</small><b>{{fmt(archiveGrandTotal(t))}} د.ع</b></div>
      <div class="archive-scan-actions"><label class="btn scan-btn">رفع سكنر الأرشفة<input type="file" multiple accept="application/pdf,image/*" hidden @change="uploadScan(t,$event)"></label><span class="pill">{{archiveScans(t).length}} ملف</span></div>
      <button class="btn primary" :disabled="busy===t.id" @click="archiveNow(t)">{{busy===t.id?'جاري التجميع...':'أرشفة وتجميع PDF'}}</button>
    </div>
    <div v-if="!pending.length" class="empty">لا توجد معاملات بانتظار الأرشفة</div>
  </div>
</div>

<div class="card" style="margin-bottom:16px"><div class="section-title"><h3 style="margin:0">الأرشيف والبحث</h3></div><div class="filters"><input v-model="q" class="input" placeholder="بحث: شركة، سيارة، سائق، إجراء، بيان" style="min-width:300px"><input v-model="from" type="date" class="input"><input v-model="to" type="date" class="input"><button class="btn" @click="q='';from='';to=''">مسح</button></div></div>
<div class="grid stats archive-stats"><div class="stat"><small>عدد النتائج</small><strong>{{archived.length}}</strong></div><div class="stat"><small>الأسعار ضمن النتائج</small><strong>{{fmt(filteredSums.price)}} د.ع</strong></div><div class="stat"><small>الضريبة ضمن النتائج</small><strong>{{fmt(filteredSums.tax)}} د.ع</strong></div><div class="stat"><small>الرسوم ضمن النتائج</small><strong>{{fmt(filteredSums.fees)}} د.ع</strong></div><div class="stat highlight"><small>إجمالي النتائج</small><strong>{{fmt(filteredSums.total)}} د.ع</strong></div><div class="stat"><small>الإجمالي لجميع التواريخ</small><strong>{{fmt(allSums.total)}} د.ع</strong></div></div>

<div class="card" style="margin-bottom:16px"><h3>الإجمالي حسب تاريخ الأرشفة</h3><div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>عدد المعاملات</th><th>الأسعار</th><th>الضريبة</th><th>الرسوم</th><th>الإجمالي</th></tr></thead><tbody><tr v-for="r in daily" :key="r[0]"><td>{{r[0]}}</td><td>{{r[1].count}}</td><td>{{fmt(r[1].price)}}</td><td>{{fmt(r[1].tax)}}</td><td>{{fmt(r[1].fees)}}</td><td><b>{{fmt(r[1].total)}}</b></td></tr><tr v-if="!daily.length"><td colspan="6" class="empty">لا توجد بيانات</td></tr></tbody></table></div></div>

<div class="card"><h3>المعاملات المؤرشفة</h3><div class="table-wrap"><table class="table"><thead><tr><th>المعاملة</th><th>تاريخ الأرشفة</th><th>الشركة</th><th>السيارة</th><th>البيان</th><th>الأسعار</th><th>الضريبة</th><th>الرسوم</th><th>الإجمالي</th><th>الملف الموحد</th></tr></thead><tbody><tr v-for="t in archived" :key="t.id"><td><b>{{t.serial}}</b></td><td>{{new Date(t.archivedAt||t.updatedAt).toLocaleDateString('ar-IQ')}}</td><td>{{t.companyName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.declarationNo||'—'}}</td><td>{{fmt(t.finance.invoiceValue)}}</td><td>{{fmt(t.finance.tax)}}</td><td>{{fmt(t.finance.customsFees)}}</td><td><b>{{fmt(archiveGrandTotal(t))}}</b></td><td><div class="file-actions"><button class="btn ghost mini" :disabled="busy===t.id" @click="openMerged(t)">فتح</button><button v-if="mergedFile(t)" class="btn ghost mini" @click="downloadMerged(t)">تنزيل</button></div></td></tr><tr v-if="!archived.length"><td colspan="10" class="empty">لا توجد معاملات مؤرشفة ضمن البحث</td></tr></tbody></table></div></div>
<div v-if="toast" class="toast">{{toast}}</div>
</template>
