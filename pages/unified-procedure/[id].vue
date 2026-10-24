<script setup lang="ts">
const route = useRoute()
const id = String(route.params.id || '')
const mobilePin = ref('')
const pinDraft = ref('')
const job = ref<any>(null)
const loading = ref(true)
const busy = ref(false)
const errorMessage = ref('')
const reviewScreenshotUrl = ref('')
const finalScreenshotUrl = ref('')
const historyScreenshotUrl = ref('')
const historyScreenshotTitle = ref('')
let timer:any = null

function headers(){ return { 'X-Tarabil-Mobile-Pin': mobilePin.value.trim() } }
function fmt(iso?:string){ if(!iso) return ''; try { return new Date(iso).toLocaleString('ar-IQ') } catch { return iso } }
function statusLabel(s?:string){ return ({pending:'بانتظار الجهاز',processing:'جاري التنفيذ',needs_review:'بانتظار قرارك',cancelling:'جاري الإيقاف',done:'مكتمل',failed:'فشل',cancelled:'تم الإيقاف'} as any)[s || ''] || s || '' }
function reviewStateLabel(s?:string){
  const map:any={NOTIFICATIONS_POPUP:'نافذة إشعارات',NOTIFICATIONS_PAGE:'صفحة الإشعارات/الرسائل',OTHER_PAGE_OPEN:'صفحة أخرى مفتوحة',PREDECLARATION_OPEN:'بيان مسبق مفتوح',DECLARATION_OPEN:'بيان مفتوح',UNKNOWN_POPUP:'نافذة غير معروفة',MANUAL_INTERVENTION:'شاشة تحتاج مراجعة',UNKNOWN_SCREEN:'شاشة غير متوقعة'}
  return map[s || ''] || s || 'شاشة غير متوقعة'
}
async function unlockDetails(){
  const pin = pinDraft.value.trim()
  if(!pin){ errorMessage.value='أدخل رمز دخول الهاتف'; return }
  mobilePin.value=pin
  if(import.meta.client) sessionStorage.setItem('tarabil.mobile.pin', pin)
  loading.value=true
  await refresh()
}

async function loadScreenshots(){
  if(import.meta.server || !job.value || !mobilePin.value) return
  async function fetchShot(url:string, oldUrl:string){
    const r = await fetch(url, { headers:headers(), cache:'no-store' })
    if(!r.ok) throw new Error('shot')
    const blob = await r.blob()
    if(oldUrl) URL.revokeObjectURL(oldUrl)
    return URL.createObjectURL(blob)
  }
  if(job.value?.review?.id && job.value.review.screenshotAvailable){
    try{
      const mime=job.value.review.screenshotMime || 'image/jpeg'
      reviewScreenshotUrl.value = await fetchShot(`/api/unified/jobs/${id}/screenshot?reviewId=${encodeURIComponent(job.value.review.id)}&mime=${encodeURIComponent(mime)}`, reviewScreenshotUrl.value)
    }catch{ reviewScreenshotUrl.value='' }
  }else if(reviewScreenshotUrl.value){ URL.revokeObjectURL(reviewScreenshotUrl.value); reviewScreenshotUrl.value='' }
  if(job.value?.screenshotAvailable){
    try{
      const mime=job.value.screenshotMime || 'image/jpeg'
      finalScreenshotUrl.value = await fetchShot(`/api/unified/jobs/${id}/screenshot?mime=${encodeURIComponent(mime)}`, finalScreenshotUrl.value)
    }catch{ finalScreenshotUrl.value='' }
  }
}

async function refresh(){
  if(!mobilePin.value){ loading.value=false; return }
  try{
    const res:any = await $fetch(`/api/unified/jobs/${id}`, { headers:headers(), query:{t:Date.now()} })
    const oldReview = job.value?.review?.id
    job.value = res.job
    if(oldReview !== job.value?.review?.id || !reviewScreenshotUrl.value || (!finalScreenshotUrl.value && job.value?.screenshotAvailable)) await loadScreenshots()
    errorMessage.value=''
  }catch(e:any){ errorMessage.value=e?.data?.statusMessage || 'تعذر تحميل الطلب' }
  finally{ loading.value=false }
}
async function showHistoryScreenshot(r:any){
  if(!r?.id || !r?.screenshotAvailable) return
  try{
    const mime=r.screenshotMime || 'image/jpeg'
    const response=await fetch(`/api/unified/jobs/${id}/screenshot?reviewId=${encodeURIComponent(r.id)}&mime=${encodeURIComponent(mime)}`, {headers:headers(),cache:'no-store'})
    if(!response.ok) throw new Error('shot')
    const blob=await response.blob()
    if(historyScreenshotUrl.value) URL.revokeObjectURL(historyScreenshotUrl.value)
    historyScreenshotUrl.value=URL.createObjectURL(blob)
    historyScreenshotTitle.value=reviewStateLabel(r.state)
  }catch{ errorMessage.value='تعذر تحميل صورة المراجعة السابقة' }
}
function closeHistoryScreenshot(){
  if(historyScreenshotUrl.value) URL.revokeObjectURL(historyScreenshotUrl.value)
  historyScreenshotUrl.value=''; historyScreenshotTitle.value=''
}

async function decide(action:'dismiss_and_resume'|'keep_and_stop'|'resume'|'stop'){
  busy.value=true
  try{
    await $fetch(`/api/unified/jobs/${id}/review-decision`, { method:'POST', headers:headers(), body:{action} })
    await refresh()
  }catch(e:any){ errorMessage.value=e?.data?.statusMessage || 'تعذر إرسال القرار' }
  finally{ busy.value=false }
}
async function cancel(){
  busy.value=true
  try{ await $fetch(`/api/unified/jobs/${id}/cancel`, {method:'POST',headers:headers()}); await refresh() }
  catch(e:any){ errorMessage.value=e?.data?.statusMessage || 'تعذر إيقاف الطلب' }
  finally{ busy.value=false }
}
async function retry(){
  busy.value=true
  try{ await $fetch(`/api/unified/jobs/${id}/retry`, {method:'POST',headers:headers()}); await refresh() }
  catch(e:any){ errorMessage.value=e?.data?.statusMessage || 'تعذر إعادة المحاولة' }
  finally{ busy.value=false }
}
async function remove(){
  if(import.meta.client && !confirm('حذف هذا الطلب؟')) return
  try{ await $fetch(`/api/unified/jobs/${id}/delete`, {method:'DELETE',headers:headers()}); await navigateTo('/unified-procedure') }
  catch(e:any){ errorMessage.value=e?.data?.statusMessage || 'تعذر حذف الطلب' }
}

onMounted(async()=>{
  mobilePin.value=sessionStorage.getItem('tarabil.mobile.pin') || ''
  pinDraft.value=mobilePin.value
  await refresh()
  timer=setInterval(refresh,3000)
})
onBeforeUnmount(()=>{ if(timer) clearInterval(timer); if(reviewScreenshotUrl.value) URL.revokeObjectURL(reviewScreenshotUrl.value); if(finalScreenshotUrl.value) URL.revokeObjectURL(finalScreenshotUrl.value); if(historyScreenshotUrl.value) URL.revokeObjectURL(historyScreenshotUrl.value) })
</script>

<template>
  <div class="page-head"><div><h1>تفاصيل طلب الإجراء الموحد</h1><p>متابعة مباشرة لما يحدث على جهاز ASYCUDA</p></div><NuxtLink class="btn ghost" to="/unified-procedure">رجوع</NuxtLink></div>
  <div v-if="errorMessage" class="notice danger">{{errorMessage}}</div>
  <section v-if="!mobilePin" class="card pin-unlock-card">
    <h3>رمز دخول الهاتف مطلوب</h3>
    <p>أدخل نفس PIN المستخدم في صفحة رقم الإجراء الموحد لفتح تفاصيل هذا الطلب.</p>
    <div class="pin-unlock-row">
      <input v-model="pinDraft" class="input" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" @keyup.enter="unlockDetails">
      <button class="btn primary" @click="unlockDetails">فتح الطلب</button>
    </div>
  </section>
  <section v-else-if="loading" class="card"><p>جاري تحميل الطلب...</p></section>
  <template v-else-if="job">
    <section class="card detail-summary">
      <div><small>الحالة</small><b>{{statusLabel(job.status)}}</b></div>
      <div><small>نوع الطلب</small><b>{{['test','test_navigation'].includes(job.kind)?'اختبار آمن':'تنفيذ'}}</b></div>
      <div><small>وقت الطلب</small><b>{{fmt(job.requestedAt)}}</b></div>
      <div v-if="job.companyCode"><small>رمز الشركة</small><b>{{job.companyCode}}</b></div>
    </section>

    <section v-if="job.review" class="card review-card">
      <div class="review-head">
        <div><h2>{{job.review.title || 'تحتاج العملية إلى قرارك'}}</h2><p>{{reviewStateLabel(job.review.state)}} · {{fmt(job.review.createdAt)}}</p></div>
        <span class="review-pill">{{job.status==='needs_review'?'بانتظار قرار':'تم إرسال القرار'}}</span>
      </div>
      <p class="review-message">{{job.review.message}}</p>
      <div v-if="reviewScreenshotUrl" class="shot-wrap"><img :src="reviewScreenshotUrl" alt="لقطة شاشة ASYCUDA"></div>
      <div v-else class="shot-empty">لا توجد صورة متاحة لهذه الحالة.</div>
      <div v-if="job.status==='needs_review'" class="decision-actions">
        <button class="btn primary" :disabled="busy" @click="decide('dismiss_and_resume')">إلغاء الشاشة ومتابعة</button>
        <button v-if="['DECLARATION_OPEN','PREDECLARATION_OPEN'].includes(job.review.state)" class="btn ghost" :disabled="busy" @click="decide('resume')">متابعة بدون إغلاق</button>
        <button class="btn danger" :disabled="busy" @click="decide('keep_and_stop')">إبقاء الشاشة وإيقاف الطلب</button>
      </div>
    </section>

    <section v-if="job.screenshotAvailable" class="card review-card">
      <div class="review-head"><div><h2>صورة نتيجة الطلب</h2><p>الصورة النهائية المرتبطة بهذا الطلب</p></div></div>
      <div v-if="finalScreenshotUrl" class="shot-wrap"><img :src="finalScreenshotUrl" alt="نتيجة ASYCUDA"></div>
    </section>

    <section class="card">
      <h3>سجل الطلب</h3>
      <div class="history-list">
        <div><span>إنشاء الطلب</span><b>{{fmt(job.requestedAt)}}</b></div>
        <div v-if="job.startedAt"><span>بدء التنفيذ</span><b>{{fmt(job.startedAt)}}</b></div>
        <div v-for="r in (job.reviewHistory || [])" :key="r.id"><span>{{reviewStateLabel(r.state)}}</span><span class="history-review"><b>{{r.decision || 'مراجعة سابقة'}} · {{fmt(r.createdAt)}}</b><button v-if="r.screenshotAvailable" class="btn mini ghost" @click="showHistoryScreenshot(r)">عرض الصورة</button></span></div>
        <div v-if="job.finishedAt"><span>انتهاء الطلب</span><b>{{fmt(job.finishedAt)}}</b></div>
      </div>
      <div v-if="historyScreenshotUrl" class="history-shot">
        <div class="review-head"><h4>{{historyScreenshotTitle}}</h4><button class="btn mini ghost" @click="closeHistoryScreenshot">إغلاق الصورة</button></div>
        <div class="shot-wrap"><img :src="historyScreenshotUrl" alt="مراجعة سابقة"></div>
      </div>
      <div class="detail-actions">
        <button v-if="['pending','processing','needs_review','cancelling'].includes(job.status)" class="btn danger" :disabled="busy" @click="cancel">إيقاف الطلب</button>
        <button v-if="job.status==='failed' && ['test','test_navigation'].includes(job.kind)" class="btn ghost" :disabled="busy" @click="retry">إعادة المحاولة</button>
        <button class="btn ghost" :disabled="busy" @click="remove">حذف الطلب</button>
      </div>
    </section>
  </template>
</template>

<style scoped>
.detail-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}.detail-summary>div{display:flex;flex-direction:column;gap:5px}.detail-summary small,.review-head p{color:#76838b}.review-card{overflow:hidden}.review-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.review-head h2{margin:0 0 5px}.review-head p{margin:0}.review-pill{background:#fff0cc;color:#8a5b00;border-radius:999px;padding:7px 12px;font-weight:700}.review-message{font-size:1rem}.shot-wrap{background:#111;border-radius:14px;padding:8px;display:flex;justify-content:center;max-height:68vh;overflow:auto}.shot-wrap img{max-width:100%;height:auto;border-radius:9px}.shot-empty{padding:34px;text-align:center;background:#f5f7f8;border-radius:12px;color:#7a858b}.decision-actions,.detail-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.history-list{display:grid;gap:9px}.history-list>div{display:flex;justify-content:space-between;gap:15px;padding:10px 0;border-bottom:1px solid #edf0f1}.history-review{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.history-shot{margin-top:16px}.pin-unlock-row{display:flex;gap:10px;align-items:center}.pin-unlock-row .input{max-width:320px}@media(max-width:720px){.pin-unlock-row{flex-direction:column;align-items:stretch}.pin-unlock-row .input{max-width:none}.review-head,.history-list>div{flex-direction:column}.decision-actions .btn,.detail-actions .btn{width:100%}}
</style>
