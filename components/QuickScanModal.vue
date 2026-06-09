<template>
  <ClientOnly>
    <div v-if="modelValue" class="scan-overlay" @click.self="close">
      <div class="scan-sheet card">
        <div class="scan-head">
          <div>
            <h3 class="text-2xl font-black">{{ title }}</h3>
            <p class="text-muted mt-1 text-sm">{{ subtitle }}</p>
          </div>
          <button class="btn-secondary btn py-2" @click="close">إغلاق</button>
        </div>

        <div v-if="message" class="mb-3 rounded-2xl border p-3 text-sm font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">
          {{ message }}
        </div>

        <div class="scan-grid">
          <div class="scan-camera card p-3">
            <video v-show="cameraOn" ref="videoRef" class="scan-video" playsinline autoplay muted></video>
            <div v-if="!cameraOn && !snapshot" class="scan-placeholder">
              <div class="scan-lens"></div>
              <b>الفحص السريع</b>
              <span>افتح الكاميرا وصوّر السنوية أو الهوية بوضوح داخل الإطار.</span>
            </div>
            <img v-if="snapshot" :src="snapshot" class="scan-video object-cover" alt="snapshot">
          </div>

          <div class="space-y-3">
            <button class="btn-primary btn w-full" @click="startCamera">فتح الكاميرا</button>
            <button class="btn-secondary btn w-full" :disabled="!cameraOn" @click="capture">التقاط وفحص</button>
            <FormField label="رفع صورة للفحص" hint="بديل للكاميرا عند استخدام الحاسوب أو إذا لم تعمل الكاميرا">
              <input class="input" type="file" accept="image/*" capture="environment" @change="onFile">
            </FormField>
            <FormField label="نص مستخرج اختياري" hint="إذا كانت الصورة لا تحتوي QR/Barcode، الصق النص هنا ليملأ النظام الحقول تلقائياً">
              <textarea v-model="rawText" class="input min-h-[120px]" placeholder="مثال: الاسم: محمد ... رقم اللوحة: بغداد ..."></textarea>
            </FormField>
            <button class="btn-secondary btn w-full" @click="parseManual">تحليل النص</button>
          </div>
        </div>

        <div class="mt-5 card p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h4 class="text-lg font-black">النتائج المقترحة</h4>
            <span class="text-muted text-xs">يمكن تعديلها قبل إدخالها إلى النموذج</span>
          </div>
          <div class="form-grid">
            <FormField v-for="field in visibleFields" :key="field.key" :label="field.label">
              <input v-model="draft[field.key]" class="input" :placeholder="field.label">
            </FormField>
          </div>
          <div class="mt-4 flex flex-col gap-2 sm:flex-row">
            <button class="btn-primary btn" @click="apply">إدخال المعلومات إلى النموذج</button>
            <button class="btn-secondary btn" @click="clearScan">مسح الفحص</button>
          </div>
        </div>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue:boolean, type:'car'|'customer' }>()
const emit = defineEmits<{ (e:'update:modelValue', v:boolean):void, (e:'apply', payload:any):void }>()
const videoRef = ref<HTMLVideoElement|null>(null)
const stream = ref<MediaStream|null>(null)
const cameraOn = ref(false)
const snapshot = ref('')
const rawText = ref('')
const message = ref('')
const messageType = ref<'ok'|'error'>('ok')
const draft = reactive<any>({})

const title = computed(()=> props.type === 'car' ? 'فحص سريع للسيارة' : 'فحص سريع لهوية العميل')
const subtitle = computed(()=> props.type === 'car'
  ? 'يفتح الكاميرا ويفحص السنوية أو QR/Barcode إن وجد، ثم يملأ بيانات السيارة.'
  : 'يفتح الكاميرا ويفحص هوية العميل أو QR/Barcode إن وجد، ثم يملأ بيانات العميل.')
const fields = computed(()=> props.type === 'car'
  ? [
      {key:'brand',label:'شركة السيارة'}, {key:'model',label:'اسم السيارة أو النوع'}, {key:'year',label:'سنة الصنع'}, {key:'color',label:'اللون'},
      {key:'plateNumber',label:'رقم اللوحة'}, {key:'vinNumber',label:'رقم الشاصي'}, {key:'mileage',label:'العداد'}, {key:'description',label:'ملاحظات'}
    ]
  : [
      {key:'fullName',label:'اسم العميل'}, {key:'phone',label:'رقم الهاتف'}, {key:'phone2',label:'رقم هاتف إضافي'}, {key:'address',label:'العنوان'}, {key:'notes',label:'ملاحظات'}
    ])
const visibleFields = computed(()=>fields.value)

watch(()=>props.modelValue, (v)=>{ if(!v) stopCamera(); else clearDraft() })
onBeforeUnmount(stopCamera)

function notify(t:string,type:'ok'|'error'='ok'){ message.value=t; messageType.value=type; setTimeout(()=>message.value='',3500) }
function close(){ emit('update:modelValue', false) }
function clearDraft(){ for (const f of fields.value) draft[f.key]=''; rawText.value=''; snapshot.value='' }
function clearScan(){ clearDraft(); notify('تم مسح نتيجة الفحص') }
function stopCamera(){ stream.value?.getTracks().forEach(t=>t.stop()); stream.value=null; cameraOn.value=false }
async function startCamera(){
  try{
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('camera-not-supported')
    stopCamera()
    stream.value = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false })
    if(videoRef.value){ videoRef.value.srcObject = stream.value; await videoRef.value.play() }
    cameraOn.value = true
    notify('تم تشغيل الكاميرا')
  }catch(e){ notify('تعذر فتح الكاميرا. تأكد من السماح للمتصفح باستخدام الكاميرا أو استخدم رفع صورة.', 'error') }
}
async function capture(){
  if(!videoRef.value) return
  const video = videoRef.value
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 1280
  canvas.height = video.videoHeight || 720
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video,0,0,canvas.width,canvas.height)
  snapshot.value = canvas.toDataURL('image/jpeg', .88)
  await tryBarcode(canvas)
  stopCamera()
}
function fileToData(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(file)})}
async function onFile(e:any){
  const file = e.target.files?.[0]
  if(!file) return
  snapshot.value = await fileToData(file)
  const img = new Image()
  img.onload = async ()=>{ const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; c.getContext('2d')!.drawImage(img,0,0); await tryBarcode(c) }
  img.src = snapshot.value
}
async function tryBarcode(canvas:HTMLCanvasElement){
  try{
    const AnyWindow:any = window as any
    if(!AnyWindow.BarcodeDetector){ notify('تم حفظ الصورة. المتصفح لا يدعم قراءة QR/Barcode تلقائياً، يمكنك إدخال النص أو تعديل الحقول يدوياً.','error'); return }
    const detector = new AnyWindow.BarcodeDetector({ formats:['qr_code','code_128','code_39','ean_13','pdf417','aztec','data_matrix'] })
    const codes = await detector.detect(canvas)
    if(!codes?.length){ notify('لم يتم العثور على QR/Barcode واضح. جرّب تقريب الكاميرا أو الصق النص المستخرج.','error'); return }
    rawText.value = codes.map((c:any)=>c.rawValue).filter(Boolean).join('\n')
    parseText(rawText.value)
    notify('تم قراءة الرمز وتعبئة الحقول المقترحة')
  }catch(e){ notify('تعذر تحليل الرمز من الصورة، يمكنك تعبئة الحقول يدوياً داخل النتائج.','error') }
}
function parseManual(){ parseText(rawText.value); notify('تم تحليل النص المتاح') }
function normalize(t:string){ return String(t||'').replace(/\r/g,'\n').replace(/[：]/g,':').trim() }
function valueAfter(text:string, labels:string[]){
  for(const label of labels){
    const re = new RegExp(`${label}\\s*[:：-]?\\s*([^\\n|،,]+)`, 'i')
    const m = text.match(re)
    if(m?.[1]) return m[1].trim()
  }
  return ''
}
function firstYear(text:string){ return text.match(/\b(19[8-9]\d|20[0-4]\d)\b/)?.[1] || '' }
function parseText(input:string){
  const t = normalize(input)
  if(props.type==='car'){
    draft.brand = valueAfter(t,['الشركة','شركة السيارة','الماركة','brand','make']) || draft.brand
    draft.model = valueAfter(t,['الموديل','النوع','اسم السيارة','model','vehicle']) || draft.model
    draft.year = valueAfter(t,['السنة','سنة الصنع','year']) || firstYear(t) || draft.year
    draft.color = valueAfter(t,['اللون','color']) || draft.color
    draft.plateNumber = valueAfter(t,['رقم اللوحة','اللوحة','plate','plate number']) || draft.plateNumber
    draft.vinNumber = valueAfter(t,['رقم الشاصي','الشاصي','vin','vin number','chassis']) || draft.vinNumber
    draft.mileage = valueAfter(t,['العداد','الممشى','mileage','odometer']) || draft.mileage
    draft.description = t ? `تم الفحص السريع: ${t.slice(0,220)}` : draft.description
  } else {
    draft.fullName = valueAfter(t,['الاسم الكامل','اسم العميل','الاسم','name','full name']) || draft.fullName
    draft.phone = valueAfter(t,['الهاتف','رقم الهاتف','phone','mobile']) || draft.phone
    draft.phone2 = valueAfter(t,['هاتف ثاني','رقم إضافي','phone2']) || draft.phone2
    draft.address = valueAfter(t,['العنوان','السكن','address']) || draft.address
    draft.notes = t ? `تم الفحص السريع: ${t.slice(0,220)}` : draft.notes
  }
}
function apply(){
  const payload:any = { fields:{}, image:snapshot.value, rawText:rawText.value }
  for(const f of fields.value){ if(draft[f.key] !== undefined && String(draft[f.key]||'').trim() !== '') payload.fields[f.key] = draft[f.key] }
  emit('apply', payload)
  notify('تم إدخال المعلومات إلى النموذج')
  setTimeout(close, 450)
}
</script>

<style scoped>
.scan-overlay{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:18px}
.scan-sheet{width:min(980px,100%);max-height:92vh;overflow:auto;padding:22px}
.scan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}
.scan-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
.scan-video{width:100%;height:360px;border-radius:22px;background:#020817;border:1px solid var(--border)}
.scan-placeholder{height:360px;border-radius:22px;border:1px dashed var(--border);display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted)}
.scan-placeholder b{font-size:1.3rem;color:var(--text)}
.scan-placeholder span{max-width:320px}
.scan-lens{width:72px;height:72px;border-radius:24px;border:2px solid rgba(59,130,246,.7);box-shadow:0 0 35px rgba(59,130,246,.35)}
@media (max-width: 780px){.scan-overlay{align-items:end;padding:0}.scan-sheet{width:100%;max-height:94vh;border-radius:28px 28px 0 0;padding:16px}.scan-grid{grid-template-columns:1fr}.scan-head{align-items:center}.scan-video,.scan-placeholder{height:260px}}
</style>
