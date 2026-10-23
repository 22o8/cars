<script setup lang="ts">
import type { Transaction } from '~/types'

const { transactions, currentStage, update, setStage, canComplete } = useTransactions()
const q = ref('')
const toast = ref('')
const busy = ref<Record<string, boolean>>({})
const screenshots = ref<Record<string, string>>({})
const statuses = ref<Record<string, string>>({})
const phoneByTx = ref<Record<string, string>>({})
const defaultWhatsApp = ref('')
const agentUrl = ref('http://127.0.0.1:8765')
const agentKey = ref('')
const agentOnline = ref(false)
const agentVersion = ref('')

const queue = computed(() => transactions.value.filter(t => {
  if (currentStage(t)?.key !== 'unified') return false
  if (!q.value) return true
  const hay = [t.serial, t.companyName, t.companyCode, t.driverName, t.vehicleNumber, t.goods].join(' ').toLowerCase()
  return hay.includes(q.value.toLowerCase())
}))

function notify(s:string){ toast.value=s; setTimeout(()=>toast.value='',2400) }
function targetPhone(t:Transaction){ return phoneByTx.value[t.id] || defaultWhatsApp.value }
function headers(){ return { 'Content-Type': 'application/json', 'X-Tarabil-Agent-Key': agentKey.value } }

async function checkAgent(){
  try{
    const r = await fetch(`${agentUrl.value}/health`, { headers: { 'X-Tarabil-Agent-Key': agentKey.value } })
    if(!r.ok) throw new Error()
    const data = await r.json()
    agentOnline.value = true
    agentVersion.value = data.version || ''
  }catch{
    agentOnline.value = false
    agentVersion.value = ''
  }
}

async function runAutomation(t:Transaction){
  if(!t.companyCode?.trim()) return alert('رمز الشركة غير موجود. أضفه أولاً من صفحة الشركات.')
  const phone = targetPhone(t).trim()
  if(!phone) return alert('حدد رقم واتساب الذي تريد إرسال الصورة إليه.')
  if(!agentKey.value.trim()) return alert('أدخل مفتاح الربط المحلي الموجود في برنامج التحكم على جهازك.')
  busy.value[t.id] = true
  statuses.value[t.id] = 'جاري فتح الأسيكودا وتنفيذ الإجراء...'
  try{
    const r = await fetch(`${agentUrl.value}/run-unified`, {
      method:'POST', headers: headers(),
      body: JSON.stringify({
        transactionId: t.id,
        serial: t.serial,
        companyName: t.companyName,
        companyCode: t.companyCode,
        whatsappNumber: phone
      })
    })
    const data = await r.json().catch(()=>({}))
    if(!r.ok || !data.ok) throw new Error(data.error || 'فشل التنفيذ')
    if(data.unifiedProcedureNo){ t.unifiedProcedureNo = String(data.unifiedProcedureNo).trim(); update(t,'استلام رقم الإجراء من برنامج التحكم المحلي') }
    if(data.screenshotBase64) screenshots.value[t.id] = `data:image/png;base64,${data.screenshotBase64}`
    statuses.value[t.id] = data.whatsappSent ? 'تم التنفيذ وإرسال الصورة إلى واتساب ✓' : 'تم التنفيذ وحفظ لقطة الشاشة ✓'
    notify(`اكتمل تنفيذ ${t.serial}`)
  }catch(e:any){
    statuses.value[t.id] = e?.message || 'تعذر الاتصال ببرنامج التحكم المحلي'
    notify(statuses.value[t.id])
  }finally{ busy.value[t.id] = false }
}

function saveAndFinish(t:Transaction){
  const err = canComplete(t,'unified')
  if(err) return alert(err)
  update(t,'حفظ رقم الإجراء الموحد')
  setStage(t,'unified','done')
  notify('تم حفظ رقم الإجراء وانتقلت المعاملة إلى السكودة')
}

onMounted(async () => {
  defaultWhatsApp.value = localStorage.getItem('tarabil.unified.whatsapp') || ''
  agentUrl.value = localStorage.getItem('tarabil.agent.url') || 'http://127.0.0.1:8765'
  agentKey.value = localStorage.getItem('tarabil.agent.key') || ''
  await checkAgent()
})
watch(defaultWhatsApp, v => { if(import.meta.client) localStorage.setItem('tarabil.unified.whatsapp', v) })
watch(agentUrl, v => { if(import.meta.client) localStorage.setItem('tarabil.agent.url', v) })
watch(agentKey, v => { if(import.meta.client) localStorage.setItem('tarabil.agent.key', v) })
</script>

<template>
  <div class="page-head">
    <div><h1>رقم الإجراء الموحد</h1><p>تنفيذ الإجراء الموحد من النظام عبر برنامج التحكم المحلي على جهازك</p></div>
    <div class="agent-state" :class="agentOnline?'online':'offline'">
      <span></span>{{agentOnline ? `برنامج التحكم متصل ${agentVersion}` : 'برنامج التحكم غير متصل'}}
      <button class="btn mini ghost" @click="checkAgent">فحص الاتصال</button>
    </div>
  </div>

  <div class="card agent-settings">
    <div class="field"><label>عنوان برنامج التحكم المحلي</label><input v-model="agentUrl" class="input" placeholder="http://127.0.0.1:8765"></div>
    <div class="field"><label>مفتاح الربط المحلي</label><input v-model="agentKey" class="input" type="password" placeholder="المفتاح يظهر بعد إعداد برنامج التحكم"></div>
    <div class="field"><label>رقم واتساب الافتراضي</label><input v-model="defaultWhatsApp" class="input" placeholder="9647XXXXXXXXX"></div>
  </div>

  <div class="card">
    <div class="section-title">
      <div><h3 style="margin:0">المعاملات بانتظار رقم الإجراء</h3><small class="muted">{{queue.length}} معاملة</small></div>
      <input v-model="q" class="input compact" placeholder="بحث بالشركة أو السيارة أو السائق">
    </div>

    <div class="unified-list">
      <article v-for="t in queue" :key="t.id" class="unified-row">
        <div class="unified-main">
          <b>{{t.serial}}</b>
          <strong>{{t.companyName}}</strong>
          <small>{{t.driverName}} — {{t.vehicleNumber}} — {{t.goods}}</small>
        </div>
        <div class="unified-company-code"><small>رمز الشركة</small><b>{{t.companyCode || 'غير مضاف'}}</b></div>
        <div class="field"><label>واتساب لهذه المعاملة</label><input v-model="phoneByTx[t.id]" class="input" :placeholder="defaultWhatsApp || '9647XXXXXXXXX'"></div>
        <button class="btn primary unified-run" :disabled="busy[t.id] || !agentOnline" @click="runAutomation(t)">{{busy[t.id]?'جاري التنفيذ...':'تشغيل الأسيكودا وإنشاء الإجراء'}}</button>
        <div class="field"><label>رقم الإجراء الناتج</label><input v-model="t.unifiedProcedureNo" class="input" placeholder="ألصق رقم الإجراء بعد ظهوره"></div>
        <button class="btn" :disabled="!t.unifiedProcedureNo" @click="saveAndFinish(t)">حفظ وإنهاء ✓</button>
        <div v-if="statuses[t.id]" class="unified-status">{{statuses[t.id]}}</div>
        <div v-if="screenshots[t.id]" class="unified-shot"><img :src="screenshots[t.id]" alt="لقطة نتيجة الإجراء"><a :href="screenshots[t.id]" :download="`${t.serial}-unified.png`" class="btn mini ghost">حفظ اللقطة</a></div>
      </article>
      <div v-if="!queue.length" class="empty">لا توجد معاملات بانتظار رقم الإجراء الموحد</div>
    </div>
  </div>
  <div v-if="toast" class="toast">{{toast}}</div>
</template>
