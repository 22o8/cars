<script setup lang="ts">
import type { Transaction } from '~/types'
import { workStageDefs } from '~/utils/stages'

const route = useRoute(); const router = useRouter()
const { transactions, currentStage, completeMany, update, setStage, canComplete, stageRoleMap } = useTransactions()
const { currentUser, can } = useAuth(); const { saveFile } = useFileStore()
const q = ref(''), stage = ref(String(route.query.stage || '')), selected = ref<string[]>([]), toast = ref('')
const extraStages = computed(() => {
  const extras = [['veterinary','فحص البيطرة'],['agriculture','فحص الزراعة']] as const
  return extras.filter(([key]) => transactions.value.some(t => t.stages.some(s => s.key===key)))
})
const stageOptions = computed(() => [...workStageDefs, ...extraStages])
watch(stage, v => { selected.value=[]; router.replace({ query: v ? { stage:v } : {} }) })

const filtered = computed(() => transactions.value.filter(t => {
  const hay=[t.serial,t.companyName,t.companyCode,t.driverName,t.vehicleNumber,t.goods,t.unifiedProcedureNo,t.declarationNo].join(' ').toLowerCase()
  if(q.value && !hay.includes(q.value.toLowerCase())) return false
  if(stage.value && currentStage(t)?.key !== stage.value) return false
  return !t.deliveredAt
}))
const activeStageLabel = computed(() => stageOptions.value.find(([k])=>k===stage.value)?.[1] || 'كل المعاملات الجارية')
const canFinishStage = computed(() => !stage.value || can(stageRoleMap[stage.value] || ['admin']))
function notify(s:string){toast.value=s;setTimeout(()=>toast.value='',2300)}
function toggleAll(e:Event){ const checked=(e.target as HTMLInputElement).checked; selected.value=checked?filtered.value.map(t=>t.id):[] }
function bulkComplete(){
  if(!stage.value) return alert('اختر مرحلة أولاً')
  if(stage.value==='archive') return alert('الأرشفة تحتاج ملف السكنر والقيم لكل معاملة')
  if(!canFinishStage.value) return alert('لا تملك صلاحية إكمال هذه المرحلة')
  const list=transactions.value.filter(t=>selected.value.includes(t.id))
  const result=completeMany(list,stage.value)
  selected.value=[]
  notify(`تم إكمال ${result.completed.length} معاملة${result.failed.length?`، وتعذر ${result.failed.length}`:''}`)
}
function saveInline(tx:Transaction, label='تحديث بيانات المعاملة'){ update(tx,label); notify('تم الحفظ') }
async function uploadScan(tx:Transaction,e:Event){
  const input=e.target as HTMLInputElement; const files=Array.from(input.files||[]); if(!files.length)return
  for(const f of files){ const id='file_'+crypto.randomUUID(); await saveFile(id,f); tx.attachments.unshift({id,name:f.name,mime:f.type,size:f.size,category:'scan',createdAt:new Date().toISOString(),uploadedBy:currentUser.value.name}) }
  update(tx,`رفع سكنر المعاملة (${files.length} ملف)`); input.value=''; notify('تم رفع السكنر')
}
function archiveNow(tx:Transaction){
  if(!can(stageRoleMap.archive)) return alert('لا تملك صلاحية الأرشفة')
  const err=canComplete(tx,'archive'); if(err)return alert(err)
  update(tx,'حفظ القيم المالية للأرشفة'); setStage(tx,'archive','done'); notify('تمت الأرشفة وانتقلت المعاملة للأرشيف')
}
function fmt(n:number){return new Intl.NumberFormat('ar-IQ').format(Number(n||0))}
</script>

<template>
<div class="page-head"><div><h1>ساحة العمل</h1><p>معالجة عدة معاملات حسب المرحلة الحالية</p></div><NuxtLink to="/transactions/new" class="btn primary">+ معاملة جديدة</NuxtLink></div>

<div class="queue-tabs">
  <button class="queue-tab" :class="{active:!stage}" @click="stage=''">الكل <b>{{transactions.filter(t=>!t.deliveredAt).length}}</b></button>
  <button v-for="s in stageOptions" :key="s[0]" class="queue-tab" :class="{active:stage===s[0]}" @click="stage=s[0]">{{s[1]}} <b>{{transactions.filter(t=>!t.deliveredAt && currentStage(t)?.key===s[0]).length}}</b></button>
</div>

<div class="card">
  <div class="section-title"><div><h3 style="margin:0">{{activeStageLabel}}</h3><small class="muted">{{filtered.length}} معاملة</small></div><div class="right-actions"><input v-model="q" class="input compact" placeholder="بحث سريع"><button v-if="stage && stage!=='archive'" class="btn primary" :disabled="!selected.length || !canFinishStage" @click="bulkComplete">✓ إكمال المحدد ({{selected.length}})</button></div></div>

  <template v-if="stage==='archive'">
    <div class="archive-work-list">
      <div v-for="t in filtered" :key="t.id" class="archive-work-row">
        <div class="work-id"><NuxtLink class="link" :to="`/transactions/${t.id}`">{{t.serial}}</NuxtLink><small>{{t.companyName}} — {{t.vehicleNumber}}</small></div>
        <div class="field"><label>الأسعار / قيمة البضاعة</label><input v-model.number="t.finance.invoiceValue" type="number" class="input"></div>
        <div class="field"><label>الضريبة</label><input v-model.number="t.finance.tax" type="number" class="input"></div>
        <div class="field"><label>الرسوم</label><input v-model.number="t.finance.customsFees" type="number" class="input"></div>
        <div class="archive-total"><small>الإجمالي</small><b>{{fmt(t.finance.invoiceValue+t.finance.tax+t.finance.customsFees)}} د.ع</b></div>
        <label class="btn scan-btn">رفع السكنر<input type="file" multiple accept="application/pdf,image/*" hidden @change="uploadScan(t,$event)"></label>
        <span class="pill">{{t.attachments.filter(a=>a.category==='scan').length}} ملف</span>
        <button class="btn primary" @click="archiveNow(t)">أرشفة</button>
      </div>
      <div v-if="!filtered.length" class="empty">لا توجد معاملات بانتظار الأرشفة</div>
    </div>
  </template>

  <template v-else>
    <div class="table-wrap"><table class="table work-table"><thead><tr><th v-if="stage"><input type="checkbox" @change="toggleAll"></th><th>المعاملة</th><th>الشركة</th><th>السائق</th><th>السيارة</th><th>البضاعة</th><th v-if="stage==='unified'">رقم الإجراء</th><th v-if="stage==='asycuda'">رقم البيان</th><th v-if="!stage">المرحلة</th><th></th></tr></thead><tbody>
      <tr v-for="t in filtered" :key="t.id">
        <td v-if="stage"><input v-model="selected" type="checkbox" :value="t.id"></td>
        <td><NuxtLink class="link" :to="`/transactions/${t.id}`">{{t.serial}}</NuxtLink></td><td>{{t.companyName}}</td><td>{{t.driverName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.goods}}</td>
        <td v-if="stage==='unified'"><div class="inline-edit"><input v-model="t.unifiedProcedureNo" class="input compact" placeholder="رقم الإجراء"><button class="btn mini" @click="saveInline(t,'إضافة رقم الإجراء الموحد')">حفظ</button></div></td>
        <td v-if="stage==='asycuda'"><div class="inline-edit"><input v-model="t.declarationNo" class="input compact" placeholder="رقم البيان"><button class="btn mini" @click="saveInline(t,'إضافة رقم البيان')">حفظ</button></div></td>
        <td v-if="!stage"><StatusBadge :status="currentStage(t)?.status||'done'"/> {{currentStage(t)?.label}}</td>
        <td><NuxtLink class="btn ghost mini" :to="`/transactions/${t.id}`">فتح</NuxtLink></td>
      </tr><tr v-if="!filtered.length"><td :colspan="stage?9:8" class="empty">لا توجد معاملات</td></tr>
    </tbody></table></div>
  </template>
</div>
<div v-if="toast" class="toast">{{toast}}</div>
</template>
