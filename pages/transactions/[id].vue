<script setup lang="ts">
import { stageLabel } from '~/utils/stages'
const route=useRoute()
const { transactions, update, setStage, currentStage, canComplete, stageRoleMap, archiveGrandTotal, persist }=useTransactions()
const { currentUser, can }=useAuth(); const { saveFile, openFile, downloadFile, mergeToPdf }=useFileStore()
const tx=computed(()=>transactions.value.find(t=>t.id===route.params.id)); const note=ref(''); const toast=ref(''); const merging=ref(false)
const current=computed(()=>tx.value?currentStage(tx.value):null)
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
    persist();notify('تم تجميع كل أوراق المعاملة في PDF واحد');if(openAfter)await openFile(id)
  }finally{merging.value=false}
}
async function openMerged(){if(mergedFile.value)await openFile(mergedFile.value.id);else await rebuildMerged(true)}
async function downloadMerged(){if(!mergedFile.value)await rebuildMerged(false);if(mergedFile.value)await downloadFile(mergedFile.value.id,mergedFile.value.name)}
</script>

<template>
<div v-if="tx">
  <div class="page-head"><div><h1>معاملة {{tx.serial}}</h1><p>{{tx.companyName}} — {{tx.vehicleNumber}}</p></div><div class="right-actions"><button class="btn" @click="saveBasics">حفظ</button><NuxtLink to="/transactions" class="btn ghost">رجوع لساحة العمل</NuxtLink></div></div>

  <div class="card" style="margin-bottom:16px"><StageTimeline :tx="tx"/><div class="progressbar"><span :style="{width:(tx.stages.filter(s=>s.status==='done').length/tx.stages.length*100)+'%'}"></span></div></div>

  <div class="two-col-simple">
    <div class="card stage-focus">
      <div class="section-title"><div><small class="muted">المرحلة الحالية</small><h2 style="margin:3px 0 0">{{current?.label || 'مكتملة'}}</h2></div><StatusBadge v-if="current" :status="current.status"/></div>

      <template v-if="current?.key==='unified'">
        <div class="field"><label>رقم الإجراء الموحد</label><input v-model="tx.unifiedProcedureNo" class="input big-input" placeholder="أدخل رقم الإجراء الموحد"></div>
      </template>

      <template v-else-if="current?.key==='asycuda'">
        <div class="field"><label>رقم البيان</label><input v-model="tx.declarationNo" class="input big-input" placeholder="رقم البيان بعد إكمال السكودة"></div>
      </template>

      <template v-else-if="current?.key==='archive'">
        <div class="archive-box">
          <div class="form-grid three"><div class="field"><label>الأسعار / قيمة البضاعة (د.ع)</label><input v-model.number="tx.finance.invoiceValue" type="number" class="input"></div><div class="field"><label>الضريبة (د.ع)</label><input v-model.number="tx.finance.tax" type="number" class="input"></div><div class="field"><label>الرسوم (د.ع)</label><input v-model.number="tx.finance.customsFees" type="number" class="input"></div></div>
          <div class="total-box simple-total"><small>الإجمالي</small><strong>{{fmt(archiveGrandTotal(tx))}} د.ع</strong></div>
          <div class="scan-zone"><label class="btn primary">رفع السكنر<input type="file" multiple accept="application/pdf,image/*" hidden @change="uploadScan"></label><span>{{tx.attachments.filter(a=>a.category==='archive-scan').length}} ملف مرفوع</span></div>
          <div v-if="tx.attachments.some(a=>a.category==='archive-scan')" class="scan-files"><button v-for="a in tx.attachments.filter(a=>a.category==='archive-scan')" :key="a.id" class="btn ghost mini" @click="openFile(a.id)">{{a.name}}</button></div>
        </div>
      </template>

      <template v-else-if="current?.key==='delivery'">
        <p class="stage-message">المعاملة جاهزة للتسليم. بعد التسليم أكد إكمال المرحلة.</p>
      </template>

      <template v-else>
        <p class="stage-message">أكمل عمل هذا القسم ثم اضغط «إكمال المرحلة» لنقل المعاملة تلقائياً للقسم التالي.</p>
      </template>

      <div v-if="current && current.status!=='done'" class="field" style="margin-top:16px"><label>ملاحظة (اختياري)</label><textarea v-model="note" class="input" rows="2"></textarea></div>
      <div v-if="current && current.status!=='done'" class="stage-actions"><button class="btn danger" :disabled="!allowed()" @click="block">إيقاف</button><button class="btn primary large" :disabled="!allowed()" @click="complete">✓ إكمال {{current.label}}</button></div>
    </div>

    <div class="card"><h3>بيانات المعاملة</h3><div class="compact-details"><div><small>الشركة</small><b>{{tx.companyName}}</b></div><div><small>رمز الشركة</small><b>{{tx.companyCode||'—'}}</b></div><div><small>السائق</small><input v-model="tx.driverName" class="input compact"></div><div><small>رقم السيارة</small><input v-model="tx.vehicleNumber" class="input compact"></div><div><small>البضاعة</small><input v-model="tx.goods" class="input compact"></div><div><small>الإجراء الموحد</small><b>{{tx.unifiedProcedureNo||'—'}}</b></div><div><small>رقم البيان</small><b>{{tx.declarationNo||'—'}}</b></div></div></div>
  </div>

  <div class="card details-card transaction-files-card">
    <div class="section-title"><div><h3 style="margin:0">ملفات المعاملة</h3><small class="muted">كل ما رفعته الأقسام مرتب حسب رحلة المعاملة</small></div><div class="right-actions"><button class="btn primary" :disabled="merging" @click="openMerged">{{merging?'جاري التجميع...':'فتح الملف الموحد'}}</button><button class="btn ghost" :disabled="merging || !scanGroups.length" @click="rebuildMerged(false)">إعادة التجميع</button><button v-if="mergedFile" class="btn ghost" @click="downloadMerged">تنزيل PDF</button></div></div>
    <div v-if="scanGroups.length" class="scan-groups">
      <section v-for="g in scanGroups" :key="g.key" class="scan-group"><div class="scan-group-title"><b>{{g.label}}</b><span class="pill">{{g.files.length}} ملف</span></div><div class="scan-group-files"><button v-for="a in g.files" :key="a.id" class="scan-file-card" @click="openFile(a.id)"><span>📄</span><div><b>{{a.name}}</b><small>{{a.uploadedBy}} — {{new Date(a.createdAt).toLocaleString('ar-IQ')}}</small></div></button></div></section>
    </div>
    <div v-else class="empty">لم تُرفع ملفات من الأقسام بعد</div>
  </div>

  <details class="card details-card"><summary>سجل الحركة</summary><ul class="activity"><li v-for="a in tx.activities" :key="a.id"><b>{{a.action}}</b><small>{{a.userName}} — {{new Date(a.at).toLocaleString('ar-IQ')}}</small><small v-if="a.details">{{a.details}}</small></li></ul></details>
  <div v-if="toast" class="toast">{{toast}}</div>
</div>
<div v-else class="empty">المعاملة غير موجودة</div>
</template>
