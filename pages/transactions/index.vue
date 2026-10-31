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
const openTransactions = computed(()=>transactions.value.filter(t=>!t.deliveredAt))
const blockedCount = computed(()=>openTransactions.value.filter(t=>t.stages.some(s=>s.status==='blocked')).length)
const withFilesCount = computed(()=>openTransactions.value.filter(t=>t.attachments.some(a=>a.category==='stage-scan')).length)

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
function stageCount(key:string){ return openTransactions.value.filter(t=>currentStage(t)?.key===key).length }
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
<section class="ops-page">
  <header class="ops-header">
    <div>
      <div class="eyebrow">العمليات اليومية</div>
      <h1>{{isAdmin?'ساحة العمل':activeStageLabel}}</h1>
      <p>{{isAdmin?'صورة تشغيلية موحدة لكل المعاملات الجارية والأقسام.':'قائمة عمل القسم الحالية — ارفع المستندات المطلوبة ثم سلّم المعاملة للمرحلة التالية.'}}</p>
    </div>
    <div class="ops-header-actions">
      <div class="search-field"><span>⌕</span><input v-model="q" placeholder="بحث بالمعاملة، الشركة، السائق أو السيارة"></div>
      <NuxtLink v-if="isAdmin" to="/transactions/new" class="btn primary">معاملة جديدة</NuxtLink>
    </div>
  </header>

  <div class="ops-summary">
    <article><span>المعاملات الجارية</span><strong>{{openTransactions.length}}</strong><small>غير مسلّمة بعد</small></article>
    <article><span>{{isAdmin?'المعروض الآن':'قائمة القسم'}}</span><strong>{{filtered.length}}</strong><small>{{activeStageLabel}}</small></article>
    <article><span>مرفقات الأقسام</span><strong>{{withFilesCount}}</strong><small>معاملة تحتوي أوراقاً</small></article>
    <article :class="{attention:blockedCount}"><span>متوقفة</span><strong>{{blockedCount}}</strong><small>تحتاج مراجعة</small></article>
  </div>

  <div v-if="isAdmin" class="stage-switcher" aria-label="فلترة حسب المرحلة">
    <button class="stage-switch" :class="{active:!stage}" @click="stage=''">
      <span>الكل</span><b>{{openTransactions.length}}</b>
    </button>
    <button v-for="s in stageOptions" :key="s[0]" class="stage-switch" :class="{active:stage===s[0]}" @click="stage=s[0]">
      <span>{{s[1]}}</span><b>{{stageCount(s[0])}}</b>
    </button>
  </div>

  <section class="card ops-list-card">
    <div class="ops-list-head">
      <div><h2>{{activeStageLabel}}</h2><p>{{filtered.length}} معاملة ضمن العرض الحالي</p></div>
      <div class="bulk-actions" v-if="stage || !isAdmin">
        <label class="select-all"><input type="checkbox" @change="toggleAll"><span>تحديد الظاهر</span></label>
        <button class="btn primary" :disabled="!selected.length || !canFinishStage" @click="bulkComplete">إكمال المحدد <b v-if="selected.length">{{selected.length}}</b></button>
      </div>
    </div>

    <template v-if="!isAdmin">
      <div class="department-queue department-queue-v3">
        <article v-for="t in filtered" :key="t.id" class="department-row department-row-v3">
          <div class="department-check"><input v-model="selected" type="checkbox" :value="t.id"></div>
          <div class="department-main department-main-v3">
            <div class="tx-line"><b>{{t.serial}}</b><span class="stage-name-inline">{{currentStage(t)?.label}}</span></div>
            <strong>{{t.companyName}}</strong>
            <small>{{t.driverName}} · {{t.vehicleNumber}}</small>
            <small class="goods-line">{{t.goods}}</small>
          </div>
          <div class="department-files department-files-v3" v-if="canUploadStage(t)">
            <div class="file-count"><span>مستندات القسم</span><b>{{scanFilesFor(t).length}}</b></div>
            <label class="btn ghost scan-btn">رفع ملفات<input type="file" multiple accept="application/pdf,image/*" hidden @change="uploadStageScan(t,$event)"></label>
            <div v-if="scanFilesFor(t).length" class="mini-files"><button v-for="a in scanFilesFor(t)" :key="a.id" class="link-file" @click="openFile(a.id)">{{a.name}}</button></div>
          </div>
          <div v-else class="department-files department-files-v3"><small>لا توجد أوراق مطلوبة من هذا القسم</small></div>
          <div class="department-action"><button class="btn primary" @click="completeOne(t)">تم {{currentStage(t)?.label}}</button></div>
        </article>
        <div v-if="!filtered.length" class="empty-state"><b>لا توجد معاملات في هذا القسم</b><span>ستظهر هنا تلقائياً عند وصول معاملة إلى هذه المرحلة.</span></div>
      </div>
    </template>

    <template v-else>
      <div class="desktop-table table-shell">
        <table class="table ops-table"><thead><tr><th v-if="stage"><input type="checkbox" @change="toggleAll"></th><th>المعاملة</th><th>الشركة</th><th>السائق / السيارة</th><th>البضاعة</th><th v-if="stage==='unified'">رقم الإجراء</th><th v-if="!stage">المرحلة</th><th>الملفات</th><th></th></tr></thead><tbody>
          <tr v-for="t in filtered" :key="t.id">
            <td v-if="stage"><input v-model="selected" type="checkbox" :value="t.id"></td>
            <td><NuxtLink class="tx-number-link" :to="`/transactions/${t.id}`">{{t.serial}}</NuxtLink><small>{{new Date(t.createdAt).toLocaleDateString('ar-IQ')}}</small></td>
            <td><b class="cell-primary">{{t.companyName}}</b><small v-if="t.companyCode">{{t.companyCode}}</small></td>
            <td><b class="cell-primary">{{t.driverName}}</b><small>{{t.vehicleNumber}}</small></td>
            <td class="goods-cell">{{t.goods}}</td>
            <td v-if="stage==='unified'"><div class="inline-edit"><input v-model="t.unifiedProcedureNo" class="input compact" placeholder="رقم الإجراء"><button class="btn mini" @click="saveInline(t,'إضافة رقم الإجراء الموحد')">حفظ</button></div></td>
            <td v-if="!stage"><div class="stage-cell"><StatusBadge :status="currentStage(t)?.status||'done'"/><span>{{currentStage(t)?.label}}</span></div></td>
            <td><span class="file-count-pill">{{t.attachments.filter(a=>a.category==='stage-scan').length}}</span></td>
            <td><NuxtLink class="btn ghost mini" :to="`/transactions/${t.id}`">التفاصيل</NuxtLink></td>
          </tr>
          <tr v-if="!filtered.length"><td :colspan="10"><div class="empty-state compact"><b>لا توجد نتائج</b><span>غيّر المرحلة أو عبارة البحث.</span></div></td></tr>
        </tbody></table>
      </div>

      <div class="mobile-cards ops-mobile-list">
        <article v-for="t in filtered" :key="t.id" class="ops-mobile-card">
          <div class="ops-mobile-top"><div><b>{{t.serial}}</b><small>{{t.companyName}}</small></div><StatusBadge :status="currentStage(t)?.status||'done'"/></div>
          <div class="ops-mobile-data"><span><small>السائق</small><b>{{t.driverName}}</b></span><span><small>السيارة</small><b>{{t.vehicleNumber}}</b></span></div>
          <p>{{t.goods}}</p>
          <div class="ops-mobile-foot"><span>{{currentStage(t)?.label}}</span><NuxtLink :to="`/transactions/${t.id}`">فتح المعاملة</NuxtLink></div>
        </article>
        <div v-if="!filtered.length" class="empty-state"><b>لا توجد نتائج</b><span>غيّر الفلتر أو عبارة البحث.</span></div>
      </div>
    </template>
  </section>
  <div v-if="toast" class="toast">{{toast}}</div>
</section>
</template>
