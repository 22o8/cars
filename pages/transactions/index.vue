<script setup lang="ts">
import type { Transaction } from '~/types'
import { workStageDefs, roleStageMap, stageLabel } from '~/utils/stages'

const route = useRoute(); const router = useRouter()
const { transactions, currentStage, completeMany, update, setStage, canComplete, stageRoleMap } = useTransactions()
const { currentUser, can } = useAuth()
const { saveFile, openFile } = useFileStore()
const q = ref(''), selected = ref<string[]>([]), toast = ref('')
const isAdmin = computed(()=>currentUser.value.role==='admin')
const ownStage = computed(()=>roleStageMap[currentUser.value.role] || '')
const stage = ref(isAdmin.value ? String(route.query.stage || '') : ownStage.value)

const extraStages = computed(() => {
  const extras = [['veterinary','فحص البيطرة'],['agriculture','فحص الزراعة']] as const
  return extras.filter(([key]) => transactions.value.some(t => t.stages.some(s => s.key===key)))
})
const allOptions = computed(() => [...workStageDefs, ...extraStages.value].filter(([k])=>!['asycuda','archive'].includes(k)))
const stageOptions = computed(() => isAdmin.value ? allOptions.value : allOptions.value.filter(([k])=>k===ownStage.value))
const ownStageKeys = computed(() => currentUser.value.role==='checks' ? ['checks','veterinary','agriculture'] : [ownStage.value].filter(Boolean))

watch(()=>currentUser.value.role,()=>{ stage.value=isAdmin.value?String(route.query.stage||''):ownStage.value; selected.value=[] })
watch(stage, v => {
  if(!isAdmin.value && v!==ownStage.value){ stage.value=ownStage.value; return }
  selected.value=[]
  router.replace({ query: v ? { stage:v } : {} })
})

const filtered = computed(() => transactions.value.filter(t => {
  const hay=[t.serial,t.companyName,t.companyCode,t.driverName,t.vehicleNumber,t.goods,t.unifiedProcedureNo,t.declarationNo].join(' ').toLowerCase()
  if(q.value && !hay.includes(q.value.toLowerCase())) return false
  const ck=currentStage(t)?.key || ''
  if(isAdmin.value){ if(stage.value && ck !== stage.value) return false }
  else if(!ownStageKeys.value.includes(ck)) return false
  return !t.deliveredAt
}))
const activeStageLabel = computed(() => isAdmin.value ? (stageOptions.value.find(([k])=>k===stage.value)?.[1] || 'كل المعاملات الجارية') : useAuth().roleLabels[currentUser.value.role])
const canFinishStage = computed(() => isAdmin.value ? (!!stage.value && can(stageRoleMap[stage.value] || ['admin'])) : true)
function notify(s:string){toast.value=s;setTimeout(()=>toast.value='',2300)}
function toggleAll(e:Event){ const checked=(e.target as HTMLInputElement).checked; selected.value=checked?filtered.value.map(t=>t.id):[] }
const scanStageKeys=['inspection','customs','checks','veterinary','agriculture','audit','cashier','completion','computer','transport']
function canUploadStage(t:Transaction){return scanStageKeys.includes(currentStage(t)?.key||'')}
function scanFilesFor(t:Transaction, key?:string){ return t.attachments.filter(a=>a.category==='stage-scan' && a.stageKey===(key || currentStage(t)?.key)) }
async function uploadStageScan(tx:Transaction,e:Event){
  const input=e.target as HTMLInputElement
  const files=Array.from(input.files||[])
  if(!files.length)return
  const key=currentStage(tx)?.key
  if(!key)return
  tx.attachments=tx.attachments.filter(a=>a.category!=='merged')
  for(const f of files){
    const id='file_'+crypto.randomUUID()
    await saveFile(id,f)
    tx.attachments.push({id,name:f.name,mime:f.type,size:f.size,category:'stage-scan',stageKey:key,createdAt:new Date().toISOString(),uploadedBy:currentUser.value.name})
  }
  update(tx,`رفع مستندات ${stageLabel(key)} (${files.length} ملف)`)
  input.value=''
  notify(`تم ربط ${files.length} ملف بالمعاملة ${tx.serial}`)
}
function bulkComplete(){
  if(isAdmin.value){
    if(!stage.value) return alert('اختر مرحلة أولاً')
    if(!canFinishStage.value) return alert('لا تملك صلاحية إكمال هذه المرحلة')
    const list=transactions.value.filter(t=>selected.value.includes(t.id))
    const result=completeMany(list,stage.value);selected.value=[]
    notify(`تم إكمال ${result.completed.length} معاملة${result.failed.length?`، وتعذر ${result.failed.length}`:''}`)
    return
  }
  const list=transactions.value.filter(t=>selected.value.includes(t.id));let completed=0,failed=0
  for(const tx of list){
    const s=currentStage(tx)
    if(!s || !ownStageKeys.value.includes(s.key) || !can(stageRoleMap[s.key]||['admin'])){failed++;continue}
    const err=canComplete(tx,s.key);if(err){failed++;continue}
    setStage(tx,s.key,'done');completed++
  }
  selected.value=[];notify(`تم إكمال ${completed} معاملة${failed?`، وتعذر ${failed}`:''}`)
}
function completeOne(tx:Transaction){
  const s=currentStage(tx);if(!s)return
  if(!can(stageRoleMap[s.key]||['admin']))return alert('لا تملك صلاحية إكمال هذه المرحلة')
  const err=canComplete(tx,s.key);if(err)return alert(err)
  setStage(tx,s.key,'done');selected.value=selected.value.filter(id=>id!==tx.id);notify(`تمت ${s.label}`)
}
function saveInline(tx:Transaction, label='تحديث بيانات المعاملة'){ update(tx,label); notify('تم الحفظ') }
</script>

<template>
<div class="page-head"><div><h1>{{isAdmin?'ساحة العمل':activeStageLabel}}</h1><p>{{isAdmin?'متابعة جميع الأقسام':'المعاملات الخاصة بقسمك فقط — ارفع الأوراق ثم أكمل العمل'}}</p></div><NuxtLink v-if="isAdmin" to="/transactions/new" class="btn primary">+ معاملة جديدة</NuxtLink></div>

<div v-if="isAdmin" class="queue-tabs">
  <button class="queue-tab" :class="{active:!stage}" @click="stage=''">الكل <b>{{transactions.filter(t=>!t.deliveredAt).length}}</b></button>
  <button v-for="s in stageOptions" :key="s[0]" class="queue-tab" :class="{active:stage===s[0]}" @click="stage=s[0]">{{s[1]}} <b>{{transactions.filter(t=>!t.deliveredAt && currentStage(t)?.key===s[0]).length}}</b></button>
</div>

<div class="card">
  <div class="section-title"><div><h3 style="margin:0">{{activeStageLabel}}</h3><small class="muted">{{filtered.length}} معاملة</small></div><div class="right-actions"><input v-model="q" class="input compact" placeholder="بحث سريع"><button v-if="(stage || !isAdmin)" class="btn primary" :disabled="!selected.length || !canFinishStage" @click="bulkComplete">✓ إكمال المحدد ({{selected.length}})</button></div></div>

  <template v-if="!isAdmin">
    <div class="stage-select-all"><label><input type="checkbox" @change="toggleAll"> تحديد كل المعاملات الظاهرة</label></div>
    <div class="department-queue">
      <article v-for="t in filtered" :key="t.id" class="department-row">
        <div class="department-check"><input v-model="selected" type="checkbox" :value="t.id"></div>
        <div class="department-main"><b>{{t.serial}}</b><strong>{{t.companyName}}</strong><small>{{t.driverName}} — {{t.vehicleNumber}} — {{t.goods}}</small><span v-if="currentStage(t)?.key!=='inspection' && currentUser.role==='checks'" class="pill">{{currentStage(t)?.label}}</span></div>
        <div v-if="canUploadStage(t)" class="department-files">
          <small>أوراق هذا القسم</small>
          <div class="file-inline">
            <label class="btn scan-btn">رفع سكنر<input type="file" multiple accept="application/pdf,image/*" hidden @change="uploadStageScan(t,$event)"></label>
            <span class="pill">{{scanFilesFor(t).length}} ملف</span>
          </div>
          <div v-if="scanFilesFor(t).length" class="mini-files"><button v-for="a in scanFilesFor(t)" :key="a.id" class="link-file" @click="openFile(a.id)">{{a.name}}</button></div>
        </div>
        <div v-else class="department-files"><small>لا توجد أوراق مطلوبة من هذا القسم</small></div>
        <div class="department-action"><button class="btn primary" @click="completeOne(t)">تم {{currentStage(t)?.label}} ✓</button></div>
      </article>
      <div v-if="!filtered.length" class="empty">لا توجد معاملات في قسمك حالياً</div>
    </div>
  </template>

  <template v-else>
    <div class="table-wrap"><table class="table work-table"><thead><tr><th v-if="stage"><input type="checkbox" @change="toggleAll"></th><th>المعاملة</th><th>الشركة</th><th>السائق</th><th>السيارة</th><th>البضاعة</th><th v-if="stage==='unified'">رقم الإجراء</th><th v-if="!stage">المرحلة</th><th>ملفات القسم</th><th></th></tr></thead><tbody>
      <tr v-for="t in filtered" :key="t.id">
        <td v-if="stage"><input v-model="selected" type="checkbox" :value="t.id"></td>
        <td><b>{{t.serial}}</b></td><td>{{t.companyName}}</td><td>{{t.driverName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.goods}}</td>
        <td v-if="stage==='unified'"><div class="inline-edit"><input v-model="t.unifiedProcedureNo" class="input compact" placeholder="رقم الإجراء"><button class="btn mini" @click="saveInline(t,'إضافة رقم الإجراء الموحد')">حفظ</button></div></td>
        <td v-if="!stage"><StatusBadge :status="currentStage(t)?.status||'done'"/> {{currentStage(t)?.label}}</td>
        <td><span class="pill">{{t.attachments.filter(a=>a.category==='stage-scan').length}}</span></td>
        <td><NuxtLink class="btn ghost mini" :to="`/transactions/${t.id}`">فتح</NuxtLink></td>
      </tr><tr v-if="!filtered.length"><td :colspan="10" class="empty">لا توجد معاملات في هذا القسم</td></tr>
    </tbody></table></div>
  </template>
</div>
<div v-if="toast" class="toast">{{toast}}</div>
</template>
