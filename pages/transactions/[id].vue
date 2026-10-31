<script setup lang="ts">
import { stageLabel } from '~/utils/stages'
const route=useRoute()
const { transactions, update, setStage, currentStage, canComplete, stageRoleMap, archiveGrandTotal, persist }=useTransactions()
const { currentUser, can }=useAuth(); const { saveFile, openFile, downloadFile, mergeToPdf }=useFileStore()
const tx=computed(()=>transactions.value.find(t=>t.id===route.params.id)); const note=ref(''); const toast=ref(''); const merging=ref(false)
const current=computed(()=>tx.value?currentStage(tx.value):null)
const doneStages=computed(()=>tx.value?tx.value.stages.filter(s=>s.status==='done').length:0)
const progressPct=computed(()=>tx.value?Math.round(doneStages.value/Math.max(tx.value.stages.length,1)*100):0)
const fileCount=computed(()=>tx.value?tx.value.attachments.filter(a=>['stage-scan','archive-scan'].includes(a.category)).length:0)
function notify(s:string){toast.value=s;setTimeout(()=>toast.value='',2200)}
function allowed(){return current.value ? can(stageRoleMap[current.value.key]||['admin']) : false}
function saveBasics(){if(!tx.value)return;update(tx.value,'تحديث بيانات المعاملة');notify('تم الحفظ')}
async function complete(){if(!tx.value||!current.value)return;const err=canComplete(tx.value,current.value.key);if(err)return alert(err);if(!allowed())return alert('لا تملك صلاحية إكمال هذه المرحلة');if(current.value.key==='archive')await rebuildMerged(false);setStage(tx.value,current.value.key,'done',note.value);note.value='';notify('تم إكمال المرحلة')}
function block(){if(!tx.value||!current.value)return;if(!allowed())return alert('لا تملك الصلاحية');if(!note.value.trim())return alert('اكتب سبب الإيقاف');setStage(tx.value,current.value.key,'blocked',note.value);notify('تم إيقاف المرحلة')}
async function uploadScan(e:Event){if(!tx.value)return;const input=e.target as HTMLInputElement;const files=Array.from(input.files||[]);if(!files.length)return;tx.value.attachments=tx.value.attachments.filter(a=>a.category!=='merged');for(const f of files){const id='file_'+crypto.randomUUID();await saveFile(id,f);tx.value.attachments.push({id,name:f.name,mime:f.type,size:f.size,category:'archive-scan',stageKey:'archive',createdAt:new Date().toISOString(),uploadedBy:currentUser.value.name})}update(tx.value,`رفع سكنر الأرشفة (${files.length} ملف)`);input.value='';notify('تم رفع السكنر')}
function fmt(n:number){return new Intl.NumberFormat('ar-IQ').format(Number(n||0))}
const scanGroups=computed(()=>{
  if(!tx.value)return []
  const files=tx.value.attachments.filter(a=>['stage-scan','archive-scan'].includes(a.category))
  return tx.value.stages.map(s=>({key:s.key,label:s.label,files:files.filter(a=>(a.stageKey||'archive')===s.key)})).filter(g=>g.files.length)
})
const mergedFile=computed(()=>tx.value?.attachments.find(a=>a.category==='merged'))
function orderedIds(){
  if(!tx.value)return []
  const order=tx.value.stages.map(s=>s.key)
  return tx.value.attachments.filter(a=>['stage-scan','archive-scan'].includes(a.category)).slice().sort((a,b)=>{
    const ai=order.indexOf(a.stageKey||'archive'),bi=order.indexOf(b.stageKey||'archive')
    if(ai!==bi)return ai-bi
    return a.createdAt.localeCompare(b.createdAt)
  }).map(a=>a.id)
}
async function rebuildMerged(openAfter=true){
  if(!tx.value)return
  const ids=orderedIds();if(!ids.length)return alert('لا توجد ملفات مرفوعة لهذه المعاملة')
  merging.value=true
  try{
    const pdf=await mergeToPdf(ids);const id=`merged_${tx.value.id}`;await saveFile(id,pdf)
    tx.value.attachments=tx.value.attachments.filter(a=>a.category!=='merged')
    tx.value.attachments.push({id,name:`${tx.value.serial}-ملف-المعاملة-الموحد.pdf`,mime:'application/pdf',size:pdf.size,category:'merged',stageKey:'archive',createdAt:new Date().toISOString(),uploadedBy:currentUser.value.name})
    persist(tx.value);notify('تم تجميع كل أوراق المعاملة في PDF واحد');if(openAfter)await openFile(id)
  }finally{merging.value=false}
}
async function openMerged(){if(mergedFile.value)await openFile(mergedFile.value.id);else await rebuildMerged(true)}
async function downloadMerged(){if(!mergedFile.value)await rebuildMerged(false);if(mergedFile.value)await downloadFile(mergedFile.value.id,mergedFile.value.name)}
</script>

<template>
<section v-if="tx" class="tx-detail-page">
  <header class="tx-detail-header">
    <div class="tx-title-block"><NuxtLink to="/transactions" class="back-link">← ساحة العمل</NuxtLink><div class="eyebrow">ملف المعاملة</div><h1>{{tx.serial}}</h1><p>{{tx.companyName}} · {{tx.vehicleNumber}}</p></div>
    <div class="tx-header-actions"><button class="btn ghost" @click="saveBasics">حفظ التعديلات</button><span class="updated-caption">آخر تحديث {{new Date(tx.updatedAt).toLocaleString('ar-IQ')}}</span></div>
  </header>

  <section class="tx-overview-strip">
    <div><span>المرحلة الحالية</span><strong>{{current?.label || 'مكتملة'}}</strong><StatusBadge v-if="current" :status="current.status"/></div>
    <div><span>التقدم</span><strong>{{progressPct}}%</strong><small>{{doneStages}} من {{tx.stages.length}} مراحل</small></div>
    <div><span>رقم الإجراء</span><strong>{{tx.unifiedProcedureNo||'—'}}</strong><small>الإجراء الموحد</small></div>
    <div><span>رقم البيان</span><strong>{{tx.declarationNo||'—'}}</strong><small>ASYCUDA</small></div>
    <div><span>المرفقات</span><strong>{{fileCount}}</strong><small>ملف من الأقسام</small></div>
  </section>

  <section class="card tx-progress-card">
    <div class="tx-progress-head"><div><h2>رحلة المعاملة</h2><p>المراحل مرتبة حسب مسار العمل الفعلي.</p></div><b>{{progressPct}}%</b></div>
    <div class="progressbar tx-progressbar"><span :style="{width:progressPct+'%'}"></span></div>
    <StageTimeline :tx="tx"/>
  </section>

  <div class="tx-detail-grid">
    <main class="card stage-console">
      <div class="stage-console-head"><div><small>العمل المطلوب الآن</small><h2>{{current?.label || 'المعاملة مكتملة'}}</h2></div><StatusBadge v-if="current" :status="current.status"/></div>

      <template v-if="current?.key==='unified'">
        <div class="task-callout"><b>رقم الإجراء الموحد</b><p>أدخل الرقم بعد إنشائه في نظام الإجراء الموحد ثم أكمل المرحلة.</p></div>
        <div class="field"><label>رقم الإجراء الموحد</label><input v-model="tx.unifiedProcedureNo" class="input big-input ltr-field" placeholder="أدخل الرقم"></div>
      </template>

      <template v-else-if="current?.key==='asycuda'">
        <div class="task-callout"><b>بيان ASYCUDA</b><p>بعد إنهاء السكودة، ثبّت رقم البيان هنا قبل نقل المعاملة للمرحلة التالية.</p></div>
        <div class="field"><label>رقم البيان</label><input v-model="tx.declarationNo" class="input big-input ltr-field" placeholder="رقم البيان"></div>
      </template>

      <template v-else-if="current?.key==='archive'">
        <div class="archive-box archive-box-v3">
          <div class="form-grid three"><div class="field"><label>قيمة البضاعة (د.ع)</label><input v-model.number="tx.finance.invoiceValue" type="number" class="input"></div><div class="field"><label>الضريبة (د.ع)</label><input v-model.number="tx.finance.tax" type="number" class="input"></div><div class="field"><label>الرسوم (د.ع)</label><input v-model.number="tx.finance.customsFees" type="number" class="input"></div></div>
          <div class="archive-money-total"><span>إجمالي المعاملة</span><strong>{{fmt(archiveGrandTotal(tx))}} <small>د.ع</small></strong></div>
          <div class="scan-zone scan-zone-v3"><div><b>سكنر الأرشفة</b><small>{{tx.attachments.filter(a=>a.category==='archive-scan').length}} ملف مرفوع</small></div><label class="btn primary">رفع الملفات<input type="file" multiple accept="application/pdf,image/*" hidden @change="uploadScan"></label></div>
          <div v-if="tx.attachments.some(a=>a.category==='archive-scan')" class="scan-files"><button v-for="a in tx.attachments.filter(a=>a.category==='archive-scan')" :key="a.id" class="btn ghost mini" @click="openFile(a.id)">{{a.name}}</button></div>
        </div>
      </template>

      <template v-else-if="current?.key==='delivery'">
        <div class="task-callout success"><b>جاهزة للتسليم</b><p>أكد المرحلة بعد تسليم الأوراق للسائق فعلياً.</p></div>
      </template>

      <template v-else>
        <div class="task-callout"><b>{{current?.label}}</b><p>أكمل عمل القسم وارفع الأوراق المطلوبة إن وجدت، ثم سلّم المعاملة للمرحلة التالية.</p></div>
      </template>

      <div v-if="current && current.status!=='done'" class="field stage-note"><label>ملاحظة المرحلة <span>اختياري</span></label><textarea v-model="note" class="input" rows="3" placeholder="سبب إيقاف أو ملاحظة للقسم التالي"></textarea></div>
      <div v-if="current && current.status!=='done'" class="stage-actions stage-actions-v3"><button class="btn danger" :disabled="!allowed()" @click="block">إيقاف المرحلة</button><button class="btn primary large" :disabled="!allowed()" @click="complete">إكمال {{current.label}}</button></div>
    </main>

    <aside class="tx-side-stack">
      <section class="card tx-data-card"><div class="card-title-line"><h3>بيانات المعاملة</h3><span>قابلة للتعديل</span></div><div class="compact-details tx-data-list"><div><small>الشركة</small><b>{{tx.companyName}}</b></div><div><small>رمز الشركة</small><b>{{tx.companyCode||'—'}}</b></div><div><small>السائق</small><input v-model="tx.driverName" class="input compact"></div><div><small>رقم السيارة</small><input v-model="tx.vehicleNumber" class="input compact ltr-field"></div><div><small>البضاعة</small><input v-model="tx.goods" class="input compact"></div><div><small>الإجراء الموحد</small><b class="mono-value">{{tx.unifiedProcedureNo||'—'}}</b></div><div><small>رقم البيان</small><b class="mono-value">{{tx.declarationNo||'—'}}</b></div></div></section>
      <section class="tx-note-card" v-if="tx.notes"><span>ملاحظة الاستقبال</span><p>{{tx.notes}}</p></section>
    </aside>
  </div>

  <section class="card transaction-files-card tx-files-v3">
    <div class="section-title tx-files-head"><div><h2>مستندات المعاملة</h2><p>كل ملفات الأقسام مرتبة حسب المرحلة، ويمكن دمجها في ملف PDF واحد.</p></div><div class="right-actions"><button class="btn primary" :disabled="merging" @click="openMerged">{{merging?'جاري التجميع...':'فتح الملف الموحد'}}</button><button class="btn ghost" :disabled="merging || !scanGroups.length" @click="rebuildMerged(false)">إعادة التجميع</button><button v-if="mergedFile" class="btn ghost" @click="downloadMerged">تنزيل PDF</button></div></div>
    <div v-if="scanGroups.length" class="scan-groups scan-groups-v3"><section v-for="g in scanGroups" :key="g.key" class="scan-group scan-group-v3"><div class="scan-group-title"><b>{{g.label}}</b><span>{{g.files.length}} ملف</span></div><div class="scan-group-files"><button v-for="a in g.files" :key="a.id" class="scan-file-card" @click="openFile(a.id)"><span class="doc-mark">PDF</span><div><b>{{a.name}}</b><small>{{a.uploadedBy}} · {{new Date(a.createdAt).toLocaleString('ar-IQ')}}</small></div></button></div></section></div>
    <div v-else class="empty-state"><b>لا توجد مستندات بعد</b><span>تظهر ملفات الأقسام هنا تلقائياً أثناء تقدم المعاملة.</span></div>
  </section>

  <details class="card details-card tx-activity-card"><summary>سجل الحركة <span>{{tx.activities.length}} حدث</span></summary><ul class="activity activity-v3"><li v-for="a in tx.activities" :key="a.id"><b>{{a.action}}</b><small>{{a.userName}} · {{new Date(a.at).toLocaleString('ar-IQ')}}</small><small v-if="a.details">{{a.details}}</small></li></ul></details>
  <div v-if="toast" class="toast">{{toast}}</div>
</section>
<div v-else class="empty-state page-empty"><b>المعاملة غير موجودة</b><span>قد تكون حُذفت أو لم تعد متاحة.</span></div>
</template>
