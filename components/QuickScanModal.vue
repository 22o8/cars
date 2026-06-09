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

        <div class="scan-steps">
          <button class="scan-step" :class="side==='front'?'active':''" @click="side='front'">{{ frontLabel }}</button>
          <button class="scan-step" :class="side==='back'?'active':''" @click="side='back'">{{ backLabel }}</button>
        </div>

        <div class="scan-grid">
          <div class="scan-camera card p-3">
            <div class="scan-frame">
              <video v-show="cameraOn && !currentImage" ref="videoRef" class="scan-video" playsinline autoplay muted></video>
              <img v-if="currentImage" :src="currentImage" class="scan-video object-cover" alt="snapshot">
              <div v-if="!cameraOn && !currentImage" class="scan-placeholder">
                <div class="scan-lens"></div>
                <b>{{ side === 'front' ? frontLabel : backLabel }}</b>
                <span>ضع المستمسك داخل الإطار، اجعل الضوء واضحاً، وتجنب اللمعان والاهتزاز.</span>
              </div>
              <div class="scan-corners"></div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2">
              <div class="scan-thumb" :class="images.front?'done':''" @click="side='front'">
                <img v-if="images.front" :src="images.front" alt="front">
                <span v-else>{{ frontLabel }}</span>
              </div>
              <div class="scan-thumb" :class="images.back?'done':''" @click="side='back'">
                <img v-if="images.back" :src="images.back" alt="back">
                <span v-else>{{ backLabel }}</span>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <button class="btn-primary btn w-full" @click="startCamera">فتح الكاميرا الآن</button>
            <button class="btn-secondary btn w-full" :disabled="!cameraOn" @click="capture">التقاط {{ side === 'front' ? frontLabel : backLabel }}</button>
            <button class="btn-secondary btn w-full" :disabled="!images.front && !images.back" @click="scanSavedImages">إعادة تحليل الصور</button>

            <FormField :label="`رفع صورة ${side === 'front' ? frontLabel : backLabel}`" hint="بديل للكاميرا، ويُحفظ مع مستمسكات العميل أو صور السيارة">
              <input class="input" type="file" accept="image/*" capture="environment" @change="onFile">
            </FormField>

            <FormField label="النص المقروء من الرمز أو المدخل يدوياً" hint="إذا كان المستمسك لا يحتوي رمزاً واضحاً، الصق النص أو عدّل النتائج المقترحة قبل الإدخال">
              <textarea v-model="rawText" class="input min-h-[120px]" placeholder="الاسم، الرقم الوطني، رقم اللوحة، رقم الشاصي، تاريخ النفاذ..."></textarea>
            </FormField>
            <button class="btn-secondary btn w-full" @click="parseManual">تحليل النص</button>
          </div>
        </div>

        <div class="mt-5 card p-4">
          <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h4 class="text-lg font-black">النتائج المقترحة</h4>
            <span class="text-muted text-xs">راجع البيانات ثم أدخلها إلى النموذج</span>
          </div>
          <div class="form-grid">
            <FormField v-for="field in visibleFields" :key="field.key" :label="field.label">
              <input v-model="draft[field.key]" class="input" :placeholder="field.label">
            </FormField>
          </div>
          <div class="mt-4 flex flex-col gap-2 sm:flex-row">
            <button class="btn-primary btn" @click="apply">إدخال المعلومات وحفظ صور المستمسكات</button>
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
const side = ref<'front'|'back'>('front')
const images = reactive<{front:string, back:string}>({ front:'', back:'' })
const rawText = ref('')
const message = ref('')
const messageType = ref<'ok'|'error'>('ok')
const draft = reactive<any>({})

const title = computed(()=> props.type === 'car' ? 'فحص سريع للسنوية' : 'فحص سريع لهوية العميل')
const subtitle = computed(()=> props.type === 'car'
  ? 'يفتح الكاميرا مباشرة، يلتقط وجه وظهر السنوية، يحاول قراءة QR/Barcode/MRZ، ويحفظ الصور مع السيارة.'
  : 'يفتح الكاميرا مباشرة، يلتقط وجه وظهر الهوية، يحاول قراءة الرمز أو النص المتاح، ويحفظ الصور داخل ملف العميل.')
const frontLabel = computed(()=> props.type === 'car' ? 'وجه السنوية' : 'وجه الهوية')
const backLabel = computed(()=> props.type === 'car' ? 'ظهر السنوية' : 'ظهر الهوية')
const currentImage = computed(()=> side.value === 'front' ? images.front : images.back)
const fields = computed(()=> props.type === 'car'
  ? [
      {key:'brand',label:'شركة السيارة'}, {key:'model',label:'اسم السيارة أو النوع'}, {key:'year',label:'سنة الصنع'}, {key:'color',label:'اللون'},
      {key:'plateNumber',label:'رقم اللوحة'}, {key:'vinNumber',label:'رقم الشاصي'}, {key:'mileage',label:'العداد'}, {key:'description',label:'ملاحظات'}
    ]
  : [
      {key:'fullName',label:'اسم العميل'}, {key:'nationalId',label:'الرقم الوطني أو رقم الهوية'}, {key:'phone',label:'رقم الهاتف'},
      {key:'phone2',label:'رقم هاتف إضافي'}, {key:'address',label:'العنوان'}, {key:'notes',label:'ملاحظات'}
    ])
const visibleFields = computed(()=>fields.value)

watch(()=>props.modelValue, async (v)=>{
  if(!v) stopCamera()
  else {
    clearDraft()
    await nextTick()
    await startCamera()
  }
})
watch(side, async ()=>{
  if(props.modelValue && !currentImage.value) await startCamera()
})
onBeforeUnmount(stopCamera)

function notify(t:string,type:'ok'|'error'='ok'){
  message.value=t
  messageType.value=type
  setTimeout(()=>{ if(message.value===t) message.value='' },4200)
}
function close(){ emit('update:modelValue', false) }
function clearDraft(){
  for (const f of fields.value) draft[f.key]=''
  rawText.value=''
  images.front=''
  images.back=''
  side.value='front'
}
function clearScan(){ clearDraft(); notify('تم مسح نتيجة الفحص') }
function stopCamera(){ stream.value?.getTracks().forEach(t=>t.stop()); stream.value=null; cameraOn.value=false }

async function startCamera(){
  try{
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('camera-not-supported')
    stopCamera()
    stream.value = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1920 }, height:{ ideal:1080 }, focusMode: 'continuous' } as any,
      audio:false
    })
    if(videoRef.value){ videoRef.value.srcObject = stream.value; await videoRef.value.play() }
    cameraOn.value = true
    notify('تم تشغيل الكاميرا. صوّر الوجه ثم الظهر للحصول على بيانات أكمل.')
  }catch(e){
    notify('تعذر فتح الكاميرا. تأكد من فتح الموقع عبر HTTPS ومن السماح للكاميرا، أو استخدم رفع صورة.', 'error')
  }
}

function imageToCanvas(src:string){
  return new Promise<HTMLCanvasElement>((resolve,reject)=>{
    const img = new Image()
    img.onload = ()=>{ const c=document.createElement('canvas'); c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height; c.getContext('2d')!.drawImage(img,0,0); resolve(c) }
    img.onerror = reject
    img.src = src
  })
}

function enhanceCanvas(source:HTMLCanvasElement){
  const maxW = 1600
  const scale = Math.min(1, maxW / source.width)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(source.width * scale))
  c.height = Math.max(1, Math.round(source.height * scale))
  const ctx = c.getContext('2d')!
  ctx.filter = 'contrast(1.16) saturate(1.06) brightness(1.04)'
  ctx.drawImage(source,0,0,c.width,c.height)
  return c
}

async function capture(){
  if(!videoRef.value) return
  const video = videoRef.value
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 1920
  canvas.height = video.videoHeight || 1080
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video,0,0,canvas.width,canvas.height)
  const optimized = enhanceCanvas(canvas)
  const data = optimized.toDataURL('image/jpeg', .9)
  if(side.value === 'front') images.front = data
  else images.back = data
  await analyzeCanvas(optimized)
  if(side.value === 'front' && !images.back){ side.value = 'back'; notify('تم حفظ الوجه. الآن صوّر الظهر لإكمال البيانات.') }
  else notify('تم حفظ الصورة وتحليلها. راجع النتائج المقترحة.')
}

function fileToData(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(file)})}
async function onFile(e:any){
  const file = e.target.files?.[0]
  if(!file) return
  const data = await fileToData(file)
  if(side.value === 'front') images.front = data
  else images.back = data
  const canvas = await imageToCanvas(data)
  await analyzeCanvas(enhanceCanvas(canvas))
  notify('تم رفع الصورة وتحليلها')
}

async function scanSavedImages(){
  let found = false
  for (const img of [images.front, images.back].filter(Boolean)) {
    const c = await imageToCanvas(img)
    const ok = await analyzeCanvas(enhanceCanvas(c), false)
    found = found || ok
  }
  parseText(rawText.value)
  notify(found ? 'تم تحليل الصور المتوفرة' : 'تم حفظ الصور. إذا لم تظهر البيانات، عدّل النتائج يدوياً أو أعد التصوير بوضوح.', found ? 'ok' : 'error')
}

async function analyzeCanvas(canvas:HTMLCanvasElement, showMessage=true){
  const texts:string[] = []
  const codeText = await readBarcode(canvas)
  if(codeText) texts.push(codeText)

  const mrzText = readVisualMrzHint(canvas)
  if(mrzText) texts.push(mrzText)

  if(texts.length){
    rawText.value = [rawText.value, ...texts].filter(Boolean).join('\n').trim()
    parseText(rawText.value)
    if(showMessage) notify('تمت قراءة رمز أو سطر آلي من المستمسك')
    return true
  }
  if(showMessage) notify('لم يتم العثور على رمز واضح. أعد التصوير قريباً وبإضاءة قوية، أو اكتب البيانات في النتائج المقترحة.', 'error')
  return false
}

async function readBarcode(canvas:HTMLCanvasElement){
  try{
    const AnyWindow:any = window as any
    if(!AnyWindow.BarcodeDetector) return ''
    const detector = new AnyWindow.BarcodeDetector({ formats:['qr_code','code_128','code_39','ean_13','pdf417','aztec','data_matrix','itf','codabar'] })
    const codes = await detector.detect(canvas)
    return codes?.map((c:any)=>c.rawValue).filter(Boolean).join('\n') || ''
  }catch(e){ return '' }
}

function readVisualMrzHint(_canvas:HTMLCanvasElement){
  // لا يوجد OCR مدمج في كل المتصفحات. هذه الدالة تبقي مسار التحليل آمناً،
  // والقراءة الفعلية تتم من QR/Barcode أو النص المدخل يدوياً.
  return ''
}

function parseManual(){ parseText(rawText.value); notify('تم تحليل النص المتاح') }
function normalize(t:string){ return String(t||'').replace(/\r/g,'\n').replace(/[：]/g,':').replace(/\s{2,}/g,' ').trim() }
function valueAfter(text:string, labels:string[]){
  for(const label of labels){
    const re = new RegExp(`${label}\\s*[:：-]?\\s*([^\\n|،,]+)`, 'i')
    const m = text.match(re)
    if(m?.[1]) return m[1].trim()
  }
  return ''
}
function firstYear(text:string){ return text.match(/\b(19[8-9]\d|20[0-4]\d)\b/)?.[1] || '' }
function cleanDigits(v:string){ return String(v||'').replace(/[^0-9A-Za-z\/-]/g,'').trim() }
function parseMrzName(t:string){
  const line = t.split(/\n/).find(l => /[A-Z<]{12,}/.test(l)) || ''
  if(!line.includes('<<')) return ''
  const parts = line.split('<<')
  const name = parts.slice(1).join(' ').replace(/</g,' ').replace(/\s+/g,' ').trim()
  return name
}
function parseText(input:string){
  const t = normalize(input)
  const upper = t.toUpperCase()
  if(props.type==='car'){
    draft.brand = valueAfter(t,['الشركة','شركة السيارة','الماركة','brand','make','vehicle make']) || draft.brand
    draft.model = valueAfter(t,['الموديل','النوع','اسم السيارة','model','vehicle','vehicle type']) || draft.model
    draft.year = valueAfter(t,['السنة','سنة الصنع','year','model year']) || firstYear(t) || draft.year
    draft.color = valueAfter(t,['اللون','color']) || draft.color
    draft.plateNumber = valueAfter(t,['رقم اللوحة','اللوحة','plate','plate number','registration']) || draft.plateNumber
    draft.vinNumber = valueAfter(t,['رقم الشاصي','الشاصي','vin','vin number','chassis','chassis no']) || draft.vinNumber
    draft.mileage = valueAfter(t,['العداد','الممشى','mileage','odometer']) || draft.mileage
    const mrzPlate = upper.match(/[A-Z]{1,3}\d{5,}/)?.[0] || ''
    if(!draft.plateNumber && mrzPlate) draft.plateNumber = mrzPlate
    draft.description = t ? `فحص السنوية: ${t.slice(0,360)}${images.front?' | صورة الوجه محفوظة':''}${images.back?' | صورة الظهر محفوظة':''}` : draft.description
  } else {
    draft.fullName = valueAfter(t,['الاسم الكامل','اسم العميل','الاسم','name','full name','surname','given names']) || parseMrzName(upper) || draft.fullName
    draft.nationalId = valueAfter(t,['الرقم الوطني','رقم الهوية','national id','id number','document no']) || cleanDigits(t.match(/\b\d{8,12}\b/)?.[0] || '') || draft.nationalId
    draft.phone = valueAfter(t,['الهاتف','رقم الهاتف','phone','mobile']) || draft.phone
    draft.phone2 = valueAfter(t,['هاتف ثاني','رقم إضافي','phone2']) || draft.phone2
    draft.address = valueAfter(t,['العنوان','السكن','address','place of birth']) || draft.address
    draft.notes = t ? `فحص الهوية: ${t.slice(0,360)}${images.front?' | صورة الوجه محفوظة':''}${images.back?' | صورة الظهر محفوظة':''}` : draft.notes
  }
}
function apply(){
  const payload:any = { fields:{}, images:[images.front, images.back].filter(Boolean), image: images.front || images.back, rawText:rawText.value }
  for(const f of fields.value){ if(draft[f.key] !== undefined && String(draft[f.key]||'').trim() !== '') payload.fields[f.key] = draft[f.key] }
  emit('apply', payload)
  notify('تم إدخال المعلومات وحفظ الصور')
  setTimeout(close, 450)
}
</script>

<style scoped>
.scan-overlay{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.68);display:grid;place-items:center;padding:18px}
.scan-sheet{width:min(1060px,100%);max-height:92vh;overflow:auto;padding:22px}
.scan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}
.scan-steps{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.scan-step{border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:18px;padding:12px;font-weight:900;color:var(--muted)}
.scan-step.active{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;box-shadow:0 16px 35px rgba(37,99,235,.25)}
.scan-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
.scan-frame{position:relative;overflow:hidden;border-radius:24px}
.scan-video{width:100%;height:380px;border-radius:22px;background:#020817;border:1px solid var(--border)}
.scan-placeholder{height:380px;border-radius:22px;border:1px dashed var(--border);display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted)}
.scan-placeholder b{font-size:1.3rem;color:var(--text)}
.scan-placeholder span{max-width:360px}
.scan-lens{width:72px;height:72px;border-radius:24px;border:2px solid rgba(59,130,246,.7);box-shadow:0 0 35px rgba(59,130,246,.35)}
.scan-corners{pointer-events:none;position:absolute;inset:32px;border:2px solid rgba(255,255,255,.55);border-radius:18px;box-shadow:0 0 0 999px rgba(0,0,0,.12)}
.scan-thumb{height:86px;border:1px solid var(--border);border-radius:18px;display:grid;place-items:center;color:var(--muted);font-weight:900;overflow:hidden;background:rgba(255,255,255,.04);cursor:pointer}
.scan-thumb.done{border-color:rgba(16,185,129,.65)}
.scan-thumb img{width:100%;height:100%;object-fit:cover}
@media (max-width: 780px){.scan-overlay{align-items:end;padding:0}.scan-sheet{width:100%;max-height:94vh;border-radius:28px 28px 0 0;padding:16px}.scan-grid{grid-template-columns:1fr}.scan-head{align-items:center}.scan-video,.scan-placeholder{height:280px}.scan-corners{inset:22px}.scan-thumb{height:76px}}
</style>
