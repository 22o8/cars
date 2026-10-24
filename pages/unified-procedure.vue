<script setup lang="ts">
import type { Transaction } from '~/types'

type CloudJob = {
  id:string
  kind?:'execute'|'test'|'test_navigation'
  status:'pending'|'processing'|'needs_review'|'cancelling'|'done'|'failed'|'cancelled'
  companyCode:string
  companyName?:string
  whatsappNumber:string
  serial?:string
  requestedAt:string
  startedAt?:string
  finishedAt?:string
  unifiedProcedureNo?:string
  whatsappSent?:boolean
  screenshotTaken?:boolean
  screenshotName?:string
  error?:string
  statusCode?:string
  message?:string
  cancelRequested?:boolean
  attempts:number
  review?:{ id:string; state:string; title:string; message:string; createdAt:string; screenshotMime?:string; screenshotAvailable?:boolean; decision?:string }
}

const { transactions, companies, currentStage, update, setStage } = useTransactions()
const mobilePin = ref('')
const companyCode = ref('')
const companyName = ref('')
const whatsappNumber = ref('')
const sending = ref(false)
const jobs = ref<CloudJob[]>([])
const loadingJobs = ref(false)
const agentOnline = ref(false)
const lastSeen = ref('')
const deviceId = ref('')
const errorMessage = ref('')
const agentState = ref<'checking'|'ONLINE'|'OFFLINE'|'AUTH_ERROR'|'SERVER_ERROR'|'AGENT_ERROR'>('checking')
const successMessage = ref('')
let timer:any = null

const localQueue = computed(() => transactions.value.filter(t => currentStage(t)?.key === 'unified'))

function headers(){ return { 'X-Tarabil-Mobile-Pin': mobilePin.value.trim() } }
function cleanPhone(v:string){ return v.replace(/\D/g,'') }
function savePrefs(){
  if(!import.meta.client) return
  sessionStorage.setItem('tarabil.mobile.pin', mobilePin.value)
  localStorage.removeItem('tarabil.mobile.pin')
  localStorage.setItem('tarabil.mobile.whatsapp', whatsappNumber.value)
}
function showError(e:any){
  errorMessage.value = e?.data?.statusMessage || 'تعذر تنفيذ الطلب؛ تحقق من رمز الدخول والاتصال'
  setTimeout(()=>errorMessage.value='', 4500)
}
function statusLabel(s:CloudJob['status']){
  return { pending:'بانتظار الجهاز', processing:'جاري التنفيذ على الأسيكودا', needs_review:'بانتظار قرارك', cancelling:'جاري الإيقاف', done:'مكتمل', failed:'فشل', cancelled:'تم الإيقاف' }[s]
}
function jobError(job:CloudJob){
  if(job.statusCode === 'unknown_popup') return 'ظهرت نافذة غير معروفة داخل ASYCUDA'
  if(job.statusCode === 'manual_intervention_required') return 'تحتاج العملية إلى تدخل يدوي على جهاز المكتب'
  return 'تعذر الوصول إلى شاشة رقم الإجراء الموحد؛ راجع تشخيص الجهاز'
}
function statusClass(s:CloudJob['status']){ return `cloud-${s}` }
function fmt(iso?:string){ if(!iso) return ''; try { return new Date(iso).toLocaleString('ar-IQ') } catch { return iso } }

async function submitCloud(payload?:Partial<CloudJob>){
  if(!mobilePin.value.trim()) return showError(new Error('أدخل رمز دخول الهاتف أولاً'))
  const code = String(payload?.companyCode || companyCode.value).trim()
  const phone = cleanPhone(String(payload?.whatsappNumber || whatsappNumber.value))
  if(!code) return showError(new Error('أدخل رمز الشركة'))

  sending.value = true
  errorMessage.value = ''
  try{
    const res:any = await $fetch('/api/unified/create', {
      method:'POST', headers:headers(),
      body:{
        companyCode:code,
        companyName:String(payload?.companyName || companyName.value || ''),
        whatsappNumber:phone,
        serial:String(payload?.serial || '')
      }
    })
    successMessage.value = 'تم إرسال الطلب إلى جهاز الأسيكودا ✓'
    setTimeout(()=>successMessage.value='', 3000)
    if(!payload){ companyCode.value=''; companyName.value='' }
    await refreshAll()
    return res?.job
  }catch(e:any){ showError(e) }
  finally{ sending.value=false; savePrefs() }
}


async function submitTest(){
  if(!mobilePin.value.trim()) return showError(new Error('أدخل رمز دخول الهاتف أولاً'))
  sending.value = true
  errorMessage.value = ''
  try{
    await $fetch('/api/unified/test', { method:'POST', headers:headers() })
    successMessage.value = 'تم إرسال اختبار آمن للجهاز — لن يتم إنشاء أي إجراء موحد'
    setTimeout(()=>successMessage.value='', 4000)
    await refreshAll()
  }catch(e:any){ showError(e) }
  finally{ sending.value=false; savePrefs() }
}

async function submitTransaction(t:Transaction){
  if(!t.companyCode?.trim()) return showError(new Error('رمز الشركة غير مضاف لهذه المعاملة'))
  const phone = cleanPhone(whatsappNumber.value)
  if(!phone) return showError(new Error('أدخل رقم واتساب الافتراضي أعلى الصفحة'))
  await submitCloud({ companyCode:t.companyCode, companyName:t.companyName, whatsappNumber:phone, serial:t.serial })
}

async function refreshJobs(){
  if(!mobilePin.value.trim()) return
  loadingJobs.value = true
  try{
    const res:any = await $fetch('/api/unified/recent', { headers:headers() })
    jobs.value = res.jobs || []
    syncLocalTransactions()
  }catch(e:any){
    if(e?.statusCode === 401 || e?.response?.status === 401) showError(e)
  }finally{ loadingJobs.value=false }
}

async function refreshAgent(){
  if(!mobilePin.value.trim()){ agentOnline.value=false; agentState.value='AUTH_ERROR'; return }
  try{
    const res:any = await $fetch('/api/unified/agent-status', { headers:headers(), query:{ t:Date.now() } })
    agentOnline.value = !!res.online
    agentState.value = res.state || (res.online ? 'ONLINE' : 'OFFLINE')
    lastSeen.value = res.lastSeen || ''
    deviceId.value = res.deviceId || ''
  }catch(e:any){
    agentOnline.value=false
    const sc = e?.statusCode || e?.response?.status
    agentState.value = sc===401 ? 'AUTH_ERROR' : 'SERVER_ERROR'
  }
}

async function refreshAll(){ await Promise.all([refreshJobs(), refreshAgent()]) }

async function retry(job:CloudJob){
  try{
    await $fetch(`/api/unified/jobs/${job.id}/retry`, { method:'POST', headers:headers() })
    await refreshAll()
  }catch(e:any){ showError(e) }
}

async function cancelJob(job:CloudJob){
  try{
    await $fetch(`/api/unified/jobs/${job.id}/cancel`, { method:'POST', headers:headers() })
    successMessage.value = job.status==='pending' ? 'تم إلغاء الطلب' : 'تم إرسال أمر الإيقاف إلى جهاز الأسيكودا'
    setTimeout(()=>successMessage.value='', 3000)
    await refreshAll()
  }catch(e:any){ showError(e) }
}

async function deleteJob(job:CloudJob){
  if(import.meta.client && !confirm('حذف هذا الطلب من القائمة؟')) return
  try{
    const res:any = await $fetch(`/api/unified/jobs/${job.id}/delete`, { method:'DELETE', headers:headers() })
    successMessage.value = res?.stopping ? 'جاري إيقاف الطلب وسيُحذف تلقائياً' : 'تم حذف الطلب'
    setTimeout(()=>successMessage.value='', 3000)
    await refreshAll()
  }catch(e:any){ showError(e) }
}

async function cancelAll(){
  if(import.meta.client && !confirm('إيقاف جميع الطلبات المنتظرة أو الجارية؟')) return
  try{
    const res:any = await $fetch('/api/unified/jobs/cancel-all', { method:'POST', headers:headers() })
    successMessage.value = `تم إرسال الإيقاف إلى ${res?.stopped || 0} طلب`
    setTimeout(()=>successMessage.value='', 3000)
    await refreshAll()
  }catch(e:any){ showError(e) }
}

async function clearAll(){
  if(import.meta.client && !confirm('حذف قائمة الطلبات؟ الطلب الجاري سيُوقف أولاً ثم يُحذف تلقائياً.')) return
  try{
    const res:any = await $fetch('/api/unified/jobs/clear', { method:'DELETE', headers:headers() })
    successMessage.value = `تم حذف ${res?.deleted || 0} طلب${res?.stopping ? `، وجاري إيقاف ${res.stopping}` : ''}`
    setTimeout(()=>successMessage.value='', 3500)
    await refreshAll()
  }catch(e:any){ showError(e) }
}

function syncLocalTransactions(){
  for(const job of jobs.value){
    if(job.status !== 'done' || !job.unifiedProcedureNo || !job.serial) continue
    const tx = transactions.value.find(t => t.serial === job.serial)
    if(!tx || tx.unifiedProcedureNo) continue
    tx.unifiedProcedureNo = job.unifiedProcedureNo
    update(tx, 'استلام رقم الإجراء الموحد من جهاز الأسيكودا البعيد')
    const stage = tx.stages.find(s=>s.key==='unified')
    if(stage?.status === 'active') setStage(tx,'unified','done')
  }
}

function chooseCompany(id:string){
  const c = companies.value.find(x=>x.id===id)
  if(!c) return
  companyName.value = c.name
  companyCode.value = c.code
}

onMounted(async()=>{
  mobilePin.value = sessionStorage.getItem('tarabil.mobile.pin') || ''
  localStorage.removeItem('tarabil.mobile.pin')
  whatsappNumber.value = localStorage.getItem('tarabil.mobile.whatsapp') || ''
  await refreshAll()
  timer = setInterval(refreshAll, 3500)
})
onBeforeUnmount(()=>{ if(timer) clearInterval(timer) })
watch([mobilePin, whatsappNumber], savePrefs)
</script>

<template>
  <div class="page-head unified-head">
    <div><h1>رقم الإجراء الموحد</h1><p>أرسل الطلب من الهاتف، وجهاز الأسيكودا في المكتب ينفذه تلقائياً</p></div>
    <div class="agent-state" :class="agentOnline?'online':'offline'">
      <span></span>
      <template v-if="agentState==='ONLINE'">جهاز الأسيكودا متصل</template>
      <template v-else-if="agentState==='AUTH_ERROR'">رمز دخول الهاتف مطلوب أو غير صحيح</template>
      <template v-else-if="agentState==='SERVER_ERROR'">تعذر فحص حالة الجهاز</template>
      <template v-else-if="agentState==='AGENT_ERROR'">خطأ في برنامج الجهاز</template>
      <template v-else-if="agentState==='checking'">جاري فحص الاتصال</template>
      <template v-else>جهاز الأسيكودا غير متصل</template>
      <small v-if="lastSeen">آخر اتصال: {{fmt(lastSeen)}}</small>
    </div>
  </div>

  <div v-if="errorMessage" class="notice danger">{{errorMessage}}</div>
  <div v-if="successMessage" class="notice success">{{successMessage}}</div>

  <section class="card">
    <div class="field"><label>PIN — رمز دخول الهاتف</label><input v-model="mobilePin" class="input" type="password" inputmode="numeric" autocomplete="off"></div>
    <h3>اختبار التنقل الآمن</h3>
    <p>يفتح شاشة رقم الإجراء الموحد ويلتقط صورة فقط، دون رمز شركة أو واتساب ودون إنشاء إجراء.</p>
    <button class="btn primary" :disabled="sending" @click="submitTest">للتجربة</button>
  </section>
  <section class="card mobile-unified-card">
    <h3>التنفيذ الحقيقي</h3>
    <p>غير مفعّل لحين اكتمال اختبار التنقل والموافقة على إنشاء إجراء حقيقي.</p>
    <div class="mobile-form-grid">
      <div class="field"><label>شركة محفوظة — اختياري</label><select class="input" @change="chooseCompany(($event.target as HTMLSelectElement).value)"><option value="">اختر الشركة</option><option v-for="c in companies" :key="c.id" :value="c.id">{{c.name}}</option></select></div>
      <div class="field"><label>رمز الشركة</label><input v-model="companyCode" class="input" inputmode="numeric" placeholder="7400XXXX"></div>
      <div class="field"><label>رقم واتساب</label><input v-model="whatsappNumber" class="input" inputmode="tel" placeholder="9647XXXXXXXXX"></div>
      <div class="field optional-company"><label>اسم الشركة — اختياري</label><input v-model="companyName" class="input" placeholder="يظهر في رسالة واتساب"></div>
      <button class="btn primary big-mobile-action" :disabled="true" @click="submitCloud()">{{sending?'جاري الإرسال...':'إرسال إلى جهاز الأسيكودا'}}</button>
    </div>
  </section>

  <section v-if="localQueue.length" class="card">
    <div class="section-title"><div><h3 style="margin:0">معاملات النظام بانتظار الإجراء</h3><small class="muted">اضغط إرسال بدون إعادة كتابة رمز الشركة</small></div></div>
    <div class="quick-tx-list">
      <article v-for="t in localQueue" :key="t.id" class="quick-tx-row">
        <div><b>{{t.serial}}</b><strong>{{t.companyName}}</strong><small>{{t.companyCode || 'رمز الشركة غير مضاف'}} — {{t.vehicleNumber}}</small></div>
        <button class="btn primary" :disabled="true" @click="submitTransaction(t)">إرسال للجهاز</button>
      </article>
    </div>
  </section>

  <section class="card cloud-jobs-card">
    <div class="section-title">
      <div><h3 style="margin:0">آخر الطلبات</h3><small class="muted">تتحدث تلقائياً كل عدة ثواني</small></div>
      <div class="right-actions">
        <button class="btn mini danger" :disabled="loadingJobs || !jobs.some(j=>['pending','processing','needs_review','cancelling'].includes(j.status))" @click="cancelAll">إيقاف الكل</button>
        <button class="btn mini ghost" :disabled="loadingJobs || !jobs.length" @click="clearAll">حذف الطلبات</button>
        <button class="btn mini ghost" :disabled="loadingJobs" @click="refreshAll">تحديث</button>
      </div>
    </div>

    <div v-if="!mobilePin" class="empty">أدخل رمز دخول الهاتف حتى تظهر الطلبات.</div>
    <div v-else-if="!jobs.length && !loadingJobs" class="empty">لا توجد طلبات حتى الآن.</div>
    <div v-else class="cloud-job-list">
      <article v-for="job in jobs" :key="job.id" class="cloud-job-row">
        <div class="cloud-job-main">
          <template v-if="(job.kind==='test' || job.kind==='test_navigation')">
            <b>اختبار الاتصال بالأسيكودا</b>
            <small>يفتح الأسيكودا ويصل إلى صفحة رقم الإجراء الموحد ويلتقط Screenshot فقط.</small>
          </template>
          <template v-else>
            <b>{{job.companyName || `شركة ${job.companyCode}`}}</b>
            <small>رمز الشركة: {{job.companyCode}} · واتساب: {{job.whatsappNumber}}</small>
            <small v-if="job.serial">المعاملة: {{job.serial}}</small>
          </template>
        </div>
        <div class="cloud-job-state" :class="statusClass(job.status)">{{statusLabel(job.status)}}</div>
        <div class="cloud-job-result">
          <template v-if="job.status==='done' && (job.kind==='test' || job.kind==='test_navigation')">
            <small>نتيجة الاختبار</small><b>نجح الاختبار — لم يتم إنشاء أي إجراء موحد</b>
            <span v-if="job.screenshotTaken">تم أخذ Screenshot على جهاز الأسيكودا<span v-if="job.screenshotName">: {{job.screenshotName}}</span></span>
          </template>
          <template v-else-if="job.status==='done'">
            <small>رقم الإجراء</small><b>{{job.unifiedProcedureNo || 'تم التنفيذ — راجع الصورة المرسلة'}}</b>
            <span>{{job.whatsappSent?'تم إرسال الصورة إلى واتساب ✓':'تم التنفيذ بدون إرسال واتساب'}}</span>
          </template>
          <template v-else-if="job.status==='cancelled'">
            <small>الحالة</small><b>تم إيقاف الطلب بواسطة المستخدم</b>
          </template>
          <template v-else-if="job.status==='failed'">
            <small>سبب الفشل</small><b class="danger-text">{{jobError(job)}}</b>
          </template>
          <template v-else-if="job.status==='needs_review'"><small>تحتاج قرارك</small><b>{{job.review?.title || 'ظهرت شاشة تحتاج مراجعة'}}</b><span>{{job.review?.message || 'افتح تفاصيل الطلب لمشاهدة الصورة واتخاذ القرار.'}}</span></template>
          <template v-else-if="job.status==='cancelling'"><small>الحالة</small><span>بانتظار توقف الـAgent بأمان...</span></template>
          <template v-else><small>وقت الطلب</small><span>{{fmt(job.requestedAt)}}</span></template>
        </div>
        <div class="cloud-job-actions">
          <NuxtLink class="btn primary" :to="`/unified-procedure/${job.id}`">فتح التفاصيل</NuxtLink>
          <button v-if="job.status==='pending' || job.status==='processing' || job.status==='needs_review' || job.status==='cancelling'" class="btn danger" :disabled="job.status==='cancelling'" @click="cancelJob(job)">{{job.status==='cancelling'?'جاري الإيقاف...':'إيقاف'}}</button>
          <button v-if="job.status==='failed' && (job.kind==='test' || job.kind==='test_navigation')" class="btn ghost" @click="retry(job)">إعادة المحاولة</button>
          <button class="btn ghost" @click="deleteJob(job)">حذف</button>
        </div>
      </article>
    </div>
  </section>
</template>
