<script setup lang="ts">
const { transactions, currentStage, update, setStage, canComplete, completeMany } = useTransactions()
const q = ref('')
const selected = ref<string[]>([])
const toast = ref('')

const queue = computed(() => transactions.value.filter(t => {
  if (currentStage(t)?.key !== 'asycuda') return false
  if (!q.value) return true
  const hay = [t.serial,t.companyName,t.companyCode,t.driverName,t.vehicleNumber,t.goods,t.unifiedProcedureNo,t.declarationNo].join(' ').toLowerCase()
  return hay.includes(q.value.toLowerCase())
}))

function notify(s:string){ toast.value=s; setTimeout(()=>toast.value='',2200) }
async function copy(value:string,label='القيمة'){
  if(!value) return notify(`${label} فارغ`)
  try { await navigator.clipboard.writeText(value); notify(`تم نسخ ${label}`) }
  catch { notify('تعذر النسخ') }
}
async function copyAll(t:any){
  const text = [
    `الشركة: ${t.companyName}`,
    `رمز الشركة: ${t.companyCode || ''}`,
    `رقم الإجراء الموحد: ${t.unifiedProcedureNo || ''}`,
    `السائق: ${t.driverName}`,
    `رقم السيارة: ${t.vehicleNumber}`,
    `البضاعة: ${t.goods}`
  ].join('\n')
  await copy(text,'بيانات المعاملة')
}
function save(t:any){ update(t,'حفظ بيانات السكودة'); notify('تم الحفظ') }
function finish(t:any){
  const err=canComplete(t,'asycuda'); if(err)return alert(err)
  setStage(t,'asycuda','done'); selected.value=selected.value.filter(id=>id!==t.id); notify('تمت السكودة وانتقلت المعاملة')
}
function toggleAll(e:Event){ selected.value=(e.target as HTMLInputElement).checked?queue.value.map(t=>t.id):[] }
function finishSelected(){
  const list=transactions.value.filter(t=>selected.value.includes(t.id))
  const r=completeMany(list,'asycuda'); selected.value=[]
  if(r.failed.length) notify(`تم ${r.completed.length}، وتعذر ${r.failed.length} لعدم إدخال رقم البيان`)
  else notify(`تم إكمال ${r.completed.length} معاملة`)
}
</script>

<template>
  <section class="work-hero">
    <div><span class="eyebrow">مساحة الموظف</span><h1>السكودة</h1><p>أسرع شاشة لإدخال رقم البيان ونسخ بيانات المعاملة إلى ASYCUDA.</p></div>
    <div class="work-hero-actions"><div class="search-box"><span>⌕</span><input v-model="q" class="input" placeholder="بحث سريع"></div><button class="btn primary" :disabled="!selected.length" @click="finishSelected">✓ إكمال المحدد <b>{{selected.length}}</b></button></div>
  </section>

  <section class="mini-metrics"><article><span class="metric-symbol">A</span><div><small>بانتظار السكودة</small><b>{{queue.length}}</b></div></article><article><span class="metric-symbol">✓</span><div><small>المحدد الآن</small><b>{{selected.length}}</b></div></article></section>

  <section class="card card-v2 asycuda-card asycuda-card-v2">
    <div class="list-toolbar"><label class="check-all"><input type="checkbox" @change="toggleAll"><span>تحديد الكل الظاهر</span></label><span class="soft-chip">{{queue.length}} معاملة</span></div>
    <div class="asycuda-list asycuda-list-v2">
      <article v-for="t in queue" :key="t.id" class="asycuda-row asycuda-row-v2">
        <div class="asycuda-check"><input v-model="selected" type="checkbox" :value="t.id"></div>
        <div class="asycuda-id"><b>{{t.serial}}</b><strong>{{t.companyName}}</strong><small>{{t.vehicleNumber}}</small></div>
        <div class="quick-data quick-data-v2">
          <button class="copy-field" @click="copy(t.companyCode,'رمز الشركة')"><small>رمز الشركة</small><b>{{t.companyCode||'—'}}</b><span>نسخ</span></button>
          <button class="copy-field important-copy" @click="copy(t.unifiedProcedureNo,'رقم الإجراء')"><small>رقم الإجراء</small><b>{{t.unifiedProcedureNo||'—'}}</b><span>نسخ</span></button>
          <button class="copy-field" @click="copy(t.driverName,'اسم السائق')"><small>السائق</small><b>{{t.driverName}}</b><span>نسخ</span></button>
          <button class="copy-field" @click="copy(t.vehicleNumber,'رقم السيارة')"><small>السيارة</small><b>{{t.vehicleNumber}}</b><span>نسخ</span></button>
          <button class="copy-field wide-copy" @click="copy(t.goods,'البضاعة')"><small>البضاعة</small><b>{{t.goods}}</b><span>نسخ</span></button>
        </div>
        <div class="asycuda-declaration declaration-v2"><label>رقم البيان</label><input v-model="t.declarationNo" class="input input-lg" placeholder="أدخل رقم البيان"><div><button class="btn mini ghost" @click="copyAll(t)">نسخ الكل</button><button class="btn mini" @click="save(t)">حفظ</button><button class="btn primary mini" @click="finish(t)">تمت السكودة ✓</button></div></div>
      </article>
      <div v-if="!queue.length" class="empty empty-v2"><b>لا توجد معاملات بانتظار السكودة</b><span>أي معاملة تصل لهذه المرحلة ستظهر هنا تلقائياً.</span></div>
    </div>
  </section>
  <div v-if="toast" class="toast">{{toast}}</div>
</template>
