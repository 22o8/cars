<script setup lang="ts">
import type { Transaction } from '~/types'
import { workStageDefs, roleStageMap } from '~/utils/stages'

const route = useRoute(); const router = useRouter()
const { transactions, currentStage, completeMany, update, setStage, canComplete, stageRoleMap } = useTransactions()
const { currentUser, can } = useAuth()
const q = ref(''), selected = ref<string[]>([]), toast = ref('')
const isAdmin = computed(()=>currentUser.value.role==='admin')
const ownStage = computed(()=>roleStageMap[currentUser.value.role] || '')
const stage = ref(isAdmin.value ? String(route.query.stage || '') : ownStage.value)

const extraStages = computed(() => {
  const extras = [['veterinary','فحص البيطرة'],['agriculture','فحص الزراعة']] as const
  return extras.filter(([key]) => transactions.value.some(t => t.stages.some(s => s.key===key)))
})
const allOptions = computed(() => [...workStageDefs, ...extraStages].filter(([k])=>!['asycuda','archive'].includes(k)))
const stageOptions = computed(() => isAdmin.value ? allOptions.value : allOptions.value.filter(([k])=>k===ownStage.value))
const ownStageKeys = computed(() => currentUser.value.role==='inspection' ? ['inspection','veterinary','agriculture'] : [ownStage.value].filter(Boolean))

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
const activeStageLabel = computed(() => stageOptions.value.find(([k])=>k===stage.value)?.[1] || 'كل المعاملات الجارية')
const canFinishStage = computed(() => isAdmin.value ? (!!stage.value && can(stageRoleMap[stage.value] || ['admin'])) : true)
function notify(s:string){toast.value=s;setTimeout(()=>toast.value='',2300)}
function toggleAll(e:Event){ const checked=(e.target as HTMLInputElement).checked; selected.value=checked?filtered.value.map(t=>t.id):[] }
function bulkComplete(){
  if(!stage.value) return alert('اختر مرحلة أولاً')
  if(!canFinishStage.value) return alert('لا تملك صلاحية إكمال هذه المرحلة')
  const list=transactions.value.filter(t=>selected.value.includes(t.id))
  if(isAdmin.value){
    const result=completeMany(list,stage.value)
    selected.value=[]
    notify(`تم إكمال ${result.completed.length} معاملة${result.failed.length?`، وتعذر ${result.failed.length}`:''}`)
    return
  }
  let completed=0, failed=0
  for(const tx of list){
    const s=currentStage(tx); if(!s || !ownStageKeys.value.includes(s.key) || !can(stageRoleMap[s.key]||['admin'])){failed++;continue}
    const err=canComplete(tx,s.key); if(err){failed++;continue}
    setStage(tx,s.key,'done'); completed++
  }
  selected.value=[]
  notify(`تم إكمال ${completed} معاملة${failed?`، وتعذر ${failed}`:''}`)
}
function saveInline(tx:Transaction, label='تحديث بيانات المعاملة'){ update(tx,label); notify('تم الحفظ') }
</script>

<template>
<div class="page-head"><div><h1>{{isAdmin?'ساحة العمل':activeStageLabel}}</h1><p>{{isAdmin?'متابعة ومعالجة جميع الأقسام':'تظهر لك معاملات قسمك فقط'}}</p></div><NuxtLink v-if="isAdmin" to="/transactions/new" class="btn primary">+ معاملة جديدة</NuxtLink></div>

<div v-if="isAdmin" class="queue-tabs">
  <button class="queue-tab" :class="{active:!stage}" @click="stage=''">الكل <b>{{transactions.filter(t=>!t.deliveredAt).length}}</b></button>
  <button v-for="s in stageOptions" :key="s[0]" class="queue-tab" :class="{active:stage===s[0]}" @click="stage=s[0]">{{s[1]}} <b>{{transactions.filter(t=>!t.deliveredAt && currentStage(t)?.key===s[0]).length}}</b></button>
</div>

<div class="card">
  <div class="section-title"><div><h3 style="margin:0">{{activeStageLabel}}</h3><small class="muted">{{filtered.length}} معاملة</small></div><div class="right-actions"><input v-model="q" class="input compact" placeholder="بحث سريع"><button v-if="stage" class="btn primary" :disabled="!selected.length || !canFinishStage" @click="bulkComplete">✓ إكمال المحدد ({{selected.length}})</button></div></div>

  <div class="table-wrap"><table class="table work-table"><thead><tr><th v-if="stage"><input type="checkbox" @change="toggleAll"></th><th>المعاملة</th><th>الشركة</th><th>السائق</th><th>السيارة</th><th>البضاعة</th><th v-if="stage==='unified'">رقم الإجراء</th><th v-if="!stage">المرحلة</th><th v-if="isAdmin"></th></tr></thead><tbody>
    <tr v-for="t in filtered" :key="t.id">
      <td v-if="stage"><input v-model="selected" type="checkbox" :value="t.id"></td>
      <td><b>{{t.serial}}</b></td><td>{{t.companyName}}</td><td>{{t.driverName}}</td><td>{{t.vehicleNumber}}</td><td>{{t.goods}}</td>
      <td v-if="stage==='unified'"><div class="inline-edit"><input v-model="t.unifiedProcedureNo" class="input compact" placeholder="رقم الإجراء"><button class="btn mini" @click="saveInline(t,'إضافة رقم الإجراء الموحد')">حفظ</button></div></td>
      <td v-if="!stage"><StatusBadge :status="currentStage(t)?.status||'done'"/> {{currentStage(t)?.label}}</td>
      <td v-if="isAdmin"><NuxtLink class="btn ghost mini" :to="`/transactions/${t.id}`">فتح</NuxtLink></td>
    </tr><tr v-if="!filtered.length"><td :colspan="stage?9:8" class="empty">لا توجد معاملات في هذا القسم</td></tr>
  </tbody></table></div>
</div>
<div v-if="toast" class="toast">{{toast}}</div>
</template>
