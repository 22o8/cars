<template>
  <ClientOnly>
    <div v-if="modelValue" class="scan-overlay" @click.self="close">
      <div class="scan-sheet card">
        <div class="scan-head">
          <div>
            <h3 class="scan-title">{{ title }}</h3>
            <p class="text-muted mt-1 text-sm">{{ subtitle }}</p>
          </div>
          <button class="btn-secondary btn py-2" @click="close">إغلاق</button>
        </div>

        <div v-if="message" class="scan-message" :class="messageType==='error'?'error':'ok'">
          {{ message }}
        </div>

        <div v-if="ocrProgress" class="scan-ocr-progress">
          <span>{{ ocrProgress }}</span>
          <div class="scan-ocr-bar"><i :style="{ width: ocrPercent + '%' }"></i></div>
        </div>

        <div class="scan-progress">
          <button class="scan-step" :class="side==='front'?'active':''" @click="selectSide('front')">
            <span>{{ images.front ? 'تم' : '1' }}</span>
            {{ frontLabel }}
          </button>
          <button class="scan-step" :class="side==='back'?'active':''" @click="selectSide('back')">
            <span>{{ images.back ? 'تم' : '2' }}</span>
            {{ backLabel }}
          </button>
        </div>

        <div class="scan-layout">
          <div class="scan-camera card">
            <div class="scan-frame">
              <video v-show="cameraOn && !currentImage" ref="videoRef" class="scan-video" playsinline autoplay muted></video>
              <img v-if="currentImage" :src="currentImage" class="scan-video object-cover" alt="snapshot">

              <div v-if="!cameraOn && !currentImage" class="scan-placeholder">
                <div class="scan-lens"></div>
                <b>{{ side === 'front' ? frontLabel : backLabel }}</b>
                <span>ضع المستمسك داخل الإطار، واجعل الحواف الأربعة ظاهرة والكتابة واضحة.</span>
              </div>

              <div class="scan-guide">
                <div class="scan-card-outline"></div>
                <div class="scan-line" :class="autoMode && cameraOn && !currentImage ? 'move':''"></div>
              </div>

              <div v-if="countdown > 0 && cameraOn && !currentImage" class="scan-countdown">
                {{ countdown }}
              </div>

              <div class="scan-status-bar">
                <b>{{ side === 'front' ? frontLabel : backLabel }}</b>
                <span>{{ statusText }}</span>
              </div>
            </div>

            <div class="scan-thumbs">
              <button class="scan-thumb" :class="images.front?'done':''" @click="selectSide('front')">
                <img v-if="images.front" :src="images.front" alt="front">
                <span v-else>{{ frontLabel }}</span>
              </button>
              <button class="scan-thumb" :class="images.back?'done':''" @click="selectSide('back')">
                <img v-if="images.back" :src="images.back" alt="back">
                <span v-else>{{ backLabel }}</span>
              </button>
            </div>
          </div>

          <div class="scan-tools">
            <button class="btn-primary btn w-full" :disabled="analyzing" @click="startSmartScan">فحص الآن</button>
            <button class="btn-secondary btn w-full" :disabled="!cameraOn || countdown > 0 || analyzing" @click="captureAndAnalyze">التقاط وتحليل {{ side === 'front' ? frontLabel : backLabel }}</button>
            <button class="btn-secondary btn w-full" :disabled="(!images.front && !images.back) || analyzing" @click="analyzeSavedImages">تحليل الصور المحفوظة OCR مجاني</button>

            <label class="scan-toggle">
              <input v-model="autoMode" type="checkbox">
              <span>التقاط تلقائي بعد ثبات الصورة</span>
            </label>

            <FormField :label="`رفع صورة ${side === 'front' ? frontLabel : backLabel}`" hint="بديل للكاميرا عند الحاجة">
              <input class="input" type="file" accept="image/*" capture="environment" @change="onFile">
            </FormField>

            <FormField label="نص إضافي أو تعديل يدوي" hint="النص المقروء يظهر هنا تلقائياً، ويمكن تعديله يدوياً عند الحاجة">
              <textarea v-model="rawText" class="input min-h-[110px]" placeholder="الاسم، الرقم الوطني، رقم اللوحة، رقم الشاصي، تاريخ النفاذ..."></textarea>
            </FormField>
            <button class="btn-secondary btn w-full" @click="parseManual">تحليل النص اليدوي</button>
          </div>
        </div>

        <div class="scan-results card">
          <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h4 class="text-lg font-black">النتائج المقترحة</h4>
            <span class="text-muted text-xs">راجع البيانات قبل إدخالها للنموذج</span>
          </div>
          <div class="form-grid">
            <FormField v-for="field in visibleFields" :key="field.key" :label="field.label">
              <input v-model="draft[field.key]" class="input" :placeholder="field.label">
            </FormField>
          </div>
          <div class="mt-4 flex flex-col gap-2 sm:flex-row">
            <button class="btn-primary btn" @click="apply">إدخال المعلومات وحفظ الصور</button>
            <button class="btn-secondary btn" @click="retakeCurrent">إعادة تصوير الحالية</button>
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
const autoMode = ref(true)
const countdown = ref(0)
const countdownTimer = ref<any>(null)
const analyzing = ref(false)
const ocrProgress = ref('')
const ocrPercent = ref(0)
const ocrCache = reactive<Record<string, string>>({})

const title = computed(()=> props.type === 'car' ? 'فحص سريع للسنوية' : 'فحص سريع لهوية العميل')
const subtitle = computed(()=> props.type === 'car'
  ? 'صوّر وجه وظهر السنوية. سيتم استخراج: A رقم اللوحة، D.1 الشركة، D.3 النوع، R اللون، P.5 الشاصي، 11 الموديل.'
  : 'صوّر وجه وظهر الهوية. سيتم استخراج الاسم الثلاثي والرقم الوطني أو رقم الهوية فقط، مع حفظ صور الوجه والظهر.')
const frontLabel = computed(()=> props.type === 'car' ? 'وجه السنوية' : 'وجه الهوية')
const backLabel = computed(()=> props.type === 'car' ? 'ظهر السنوية' : 'ظهر الهوية')
const currentImage = computed(()=> side.value === 'front' ? images.front : images.back)
const statusText = computed(()=> {
  if (analyzing.value) return ocrProgress.value || 'جاري تحليل الصورة واستخراج البيانات...'
  if (countdown.value > 0) return 'ثبّت المستمسك داخل الإطار، سيتم الالتقاط تلقائياً'
  if (currentImage.value) return 'تم حفظ هذه الجهة'
  if (cameraOn.value) return 'قرّب المستمسك واجعل الكتابة واضحة'
  return 'اضغط فحص الآن لفتح الكاميرا'
})

const fields = computed(()=> props.type === 'car'
  ? [
      {key:'plateNumber',label:'A رقم لوحة السيارة'},
      {key:'brand',label:'D.1 شركة السيارة'},
      {key:'model',label:'D.3 اسم السيارة أو النوع'},
      {key:'color',label:'R لون السيارة'},
      {key:'vinNumber',label:'P.5 رقم الشاصي'},
      {key:'year',label:'11 موديل السيارة'},
      {key:'description',label:'نص السنوية وصور المستمسك'}
    ]
  : [
      {key:'fullName',label:'الاسم الثلاثي'},
      {key:'nationalId',label:'الرقم الوطني أو رقم الهوية'},
      {key:'notes',label:'نص الهوية وصور المستمسك'}
    ])
const visibleFields = computed(()=>fields.value)

watch(()=>props.modelValue, async (v)=>{
  if(!v) stopCamera()
  else {
    clearDraft()
    await nextTick()
    await startSmartScan()
  }
})
watch(side, async ()=>{
  clearCountdown()
  if(props.modelValue && !currentImage.value && cameraOn.value && autoMode.value) startCountdown()
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
  clearCountdown()
}
function clearScan(){ clearDraft(); notify('تم مسح نتيجة الفحص') }
function stopCamera(){ clearCountdown(); stream.value?.getTracks().forEach(t=>t.stop()); stream.value=null; cameraOn.value=false }
function clearCountdown(){ if(countdownTimer.value) clearInterval(countdownTimer.value); countdownTimer.value=null; countdown.value=0 }
function selectSide(v:'front'|'back'){ side.value = v }
function retakeCurrent(){ if(side.value==='front') images.front=''; else images.back=''; if(cameraOn.value && autoMode.value) startCountdown() }

async function startSmartScan(){
  await startCamera()
  if(cameraOn.value && autoMode.value && !currentImage.value) startCountdown()
}

function startCountdown(){
  clearCountdown()
  countdown.value = 3
  countdownTimer.value = setInterval(async()=>{
    countdown.value--
    if(countdown.value <= 0){ clearCountdown(); await captureAndAnalyze() }
  }, 900)
}

async function startCamera(){
  try{
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('camera-not-supported')
    if(cameraOn.value && stream.value) return
    stopCamera()
    stream.value = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1920 }, height:{ ideal:1080 }, advanced:[{ focusMode:'continuous' }] } as any,
      audio:false
    })
    if(videoRef.value){ videoRef.value.srcObject = stream.value; await videoRef.value.play() }
    cameraOn.value = true
    notify('تم تشغيل الكاميرا. صوّر الوجه ثم الظهر للحصول على بيانات أكمل.')
  }catch(e){
    notify('تعذر فتح الكاميرا. تأكد من السماح للكاميرا ومن فتح الموقع عبر HTTPS، أو استخدم رفع صورة.', 'error')
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

function cropDocumentArea(source:HTMLCanvasElement){
  // قص منتصف الصورة تقريباً حتى تكون القراءة أسرع وأوضح إذا كان المستمسك داخل الإطار.
  const w = source.width, h = source.height
  const cropW = Math.round(w * 0.88)
  const cropH = Math.round(h * 0.62)
  const sx = Math.round((w - cropW) / 2)
  const sy = Math.round((h - cropH) / 2)
  const c = document.createElement('canvas')
  c.width = cropW
  c.height = cropH
  c.getContext('2d')!.drawImage(source, sx, sy, cropW, cropH, 0, 0, cropW, cropH)
  return c
}

function enhanceCanvas(source:HTMLCanvasElement){
  const cropped = cropDocumentArea(source)
  const maxW = 2200
  const scale = Math.min(2.2, Math.max(1.25, maxW / cropped.width))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(cropped.width * scale))
  c.height = Math.max(1, Math.round(cropped.height * scale))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = 'contrast(1.38) saturate(1.02) brightness(1.12)'
  ctx.drawImage(cropped,0,0,c.width,c.height)

  // تحسين مجاني للـ OCR: تحويل رمادي + زيادة التباين دون حذف ألوان المستمسك من الصورة المحفوظة.
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]
    const v = Math.max(0, Math.min(255, (g - 118) * 1.55 + 128))
    d[i] = d[i+1] = d[i+2] = v
  }
  ctx.putImageData(img, 0, 0)
  return c
}

async function captureAndAnalyze(){
  if(!videoRef.value || analyzing.value) return
  const video = videoRef.value
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 1920
  canvas.height = video.videoHeight || 1080
  canvas.getContext('2d')!.drawImage(video,0,0,canvas.width,canvas.height)
  const optimized = enhanceCanvas(canvas)
  const data = optimized.toDataURL('image/jpeg', .9)
  if(side.value === 'front') images.front = data
  else images.back = data
  await analyzeSavedImages(true)
  if(side.value === 'front' && !images.back){
    side.value = 'back'
    notify('تم حفظ الوجه. الآن ثبّت الظهر داخل الإطار وسيتم الالتقاط تلقائياً.')
    if(autoMode.value) startCountdown()
  } else {
    notify('تم حفظ الصورة وتحليلها. راجع النتائج المقترحة.')
  }
}

function fileToData(file:File){return new Promise<string>((resolve,reject)=>{const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(file)})}
async function onFile(e:any){
  const file = e.target.files?.[0]
  if(!file) return
  const data = await fileToData(file)
  const canvas = await imageToCanvas(data)
  const optimized = enhanceCanvas(canvas)
  const finalData = optimized.toDataURL('image/jpeg', .9)
  if(side.value === 'front') images.front = finalData
  else images.back = finalData
  await analyzeSavedImages(true)
  notify('تم رفع الصورة وتحليلها')
}

async function analyzeSavedImages(useApi=true){
  analyzing.value = true
  ocrProgress.value = 'تهيئة الفحص المجاني...'
  ocrPercent.value = 5
  try {
    const imgs = [images.front, images.back].filter(Boolean)
    let mergedText = ''

    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i]
      const c = await imageToCanvas(img)
      ocrProgress.value = `فحص الرموز ${i + 1} من ${imgs.length}`
      ocrPercent.value = Math.max(8, Math.round((i / Math.max(1, imgs.length)) * 20))
      const code = await readBarcode(c)
      if(code) mergedText += '\n' + code

      const ocr = await readTextWithFreeOcr(img, i)
      if (ocr) mergedText += '\n' + ocr
    }

    if (mergedText.trim()) rawText.value = normalize(`${rawText.value}\n${mergedText}`)

    // لا نعتمد على OpenAI هنا إلا إذا كان مربوطاً، والتحليل المحلي المجاني يبقى أساسياً.
    if(useApi && imgs.length){
      try{
        const result:any = await $fetch('/api/scan/document', { method:'POST', body:{ type: props.type, frontImage: images.front || '', backImage: images.back || '', barcodeText: rawText.value || '' } })
        if(result?.rawText) rawText.value = normalize(`${rawText.value}\n${result.rawText}`)
        if(result?.fields) Object.assign(draft, cleanReturnedFields(result.fields))
        if(result?.usedAI && result?.message) notify(result.message, 'ok')
      } catch(e:any){
        // تجاهل فشل API حتى يبقى OCR المجاني يعمل دائماً.
      }
    }

    parseText(rawText.value)
    ensureUsefulFallback(rawText.value)
    const filled = Object.values(draft).filter(v => String(v || '').trim()).length
    if (filled > 1) notify('تمت قراءة البيانات المتاحة مجاناً. راجع النتائج ثم احفظها.')
    else notify('تم حفظ الصور. القراءة المجانية تحتاج صورة أوضح؛ قرب المستمسك وكرر الفحص أو عدّل النص يدوياً.', 'error')
  } finally {
    analyzing.value = false
    setTimeout(()=>{ ocrProgress.value=''; ocrPercent.value=0 }, 600)
  }
}

async function readTextWithFreeOcr(image:string, index:number){
  try{
    if (ocrCache[image]) return ocrCache[image]
    ocrProgress.value = `قراءة النص OCR مجاني ${index + 1}`
    ocrPercent.value = Math.min(85, 25 + index * 25)

    const mod:any = await import('tesseract.js')
    const recognize = mod.recognize || mod.default?.recognize
    if (!recognize) return ''

    const result = await recognize(image, 'ara+eng', {
      logger: (m:any) => {
        if (m?.status) ocrProgress.value = `OCR: ${arabicOcrStatus(m.status)}`
        if (typeof m?.progress === 'number') ocrPercent.value = Math.max(12, Math.min(95, Math.round(m.progress * 100)))
      }
    })
    const text = normalize(result?.data?.text || '')
    ocrCache[image] = text
    return text
  }catch(e){
    return ''
  }
}

function arabicOcrStatus(s:string){
  const map:any = {
    'loading tesseract core': 'تحميل محرك القراءة',
    'initializing tesseract': 'تهيئة المحرك',
    'loading language traineddata': 'تحميل العربية والإنجليزية',
    'initializing api': 'تهيئة القراءة',
    'recognizing text': 'قراءة النص من المستمسك'
  }
  return map[s] || s
}

function cleanReturnedFields(obj:any){
  const out:any = {}
  for (const f of fields.value) if(obj?.[f.key]) out[f.key] = String(obj[f.key]).trim()
  return out
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

function parseManual(){ parseText(rawText.value); ensureUsefulFallback(rawText.value); notify('تم تحليل النص المتاح') }
function normalize(t:string){
  return String(t||'')
    .replace(/\r/g,'\n')
    .replace(/[：]/g,':')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[|]+/g,' ')
    .replace(/\s{2,}/g,' ')
    .trim()
}
function valueAfter(text:string, labels:string[]){
  const lines = text.split(/\n|\r| {2,}/).map(x=>x.trim()).filter(Boolean)
  for(const label of labels){
    const re = new RegExp(`${escapeRegex(label)}\\s*[:：\\-،]?\\s*([^\\n|،,]+)`, 'i')
    const m = text.match(re)
    if(m?.[1]) return cleanupValue(m[1])
    const idx = lines.findIndex(l => l.toLowerCase().includes(label.toLowerCase()))
    if(idx >= 0 && lines[idx+1]) return cleanupValue(lines[idx+1])
  }
  return ''
}
function escapeRegex(v:string){ return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function cleanupValue(v:string){ return String(v||'').replace(/^[\s:：\-،]+|[\s:：\-،]+$/g,'').replace(/\s{2,}/g,' ').trim() }
function firstYear(text:string){ return text.match(/\b(19[8-9]\d|20[0-4]\d)\b/)?.[1] || '' }
function cleanDigits(v:string){ return String(v||'').replace(/[^0-9A-Za-z\/-]/g,'').trim() }
function parseMrzName(t:string){
  const line = t.split(/\n/).find(l => /[A-Z<]{12,}/.test(l)) || ''
  if(!line.includes('<<')) return ''
  return line.split('<<').slice(1).join(' ').replace(/</g,' ').replace(/\s+/g,' ').trim()
}
function extractLongNumbers(t:string){
  return Array.from(new Set((t.match(/\b\d{6,14}\b/g) || []).map(x=>x.trim())))
}
function extractPhone(t:string){ return t.match(/(?:\+?964|0)?7\d{9}\b/)?.[0] || '' }
function likelyEnglishName(t:string){
  const bad = /REPUBLIC|IRAQ|IDENTITY|CARD|MINISTRY|VEHICLE|REGISTRATION|LICENSE|DATE|EXPIR|BIRTH|NATIONAL|DIRECTORATE|TRAFFIC|SPECIMEN|PRIVATE/i
  const lines = t.split(/\n/).map(l=>l.trim()).filter(l => l.length >= 6 && /[A-Z]{3,}/.test(l) && !bad.test(l))
  const line = lines.find(l => /^[A-Z\s'.-]{8,}$/.test(l)) || ''
  return cleanupValue(line)
}
function likelyArabicName(t:string){
  const bad = /جمهورية|العراق|وزارة|الداخلية|البطاقة|الوطنية|هوية|تسجيل|مركبة|اجازة|المرور|مديرية|النوع|الجنس|تاريخ|اصدار|نفاذ|الرقم|محل|السكن/
  const lines = t.split(/\n/).map(l=>l.trim()).filter(l => /[\u0600-\u06FF]/.test(l) && l.length >= 7 && !bad.test(l))
  return cleanupValue(lines.find(l => l.split(/\s+/).length >= 2) || '')
}
function extractAddress(t:string){
  return valueAfter(t, ['العنوان','عنوان السكن','محل السكن','السكن','المحافظة','ناحية','قضاء','زقاق','محلة'])
}
function extractVin(t:string){ return (t.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/) || [])[0] || '' }
function extractPlate(t:string){
  const u = t.toUpperCase()
  return u.match(/\b[A-Z]{1,3}\s?\d{4,8}\b/)?.[0]?.replace(/\s+/g,'') || u.match(/\b\d{5,10}\b/)?.[0] || ''
}
function detectCarBrand(t:string){
  const u = t.toUpperCase()
  const brands = ['TOYOTA','BMW','KIA','HYUNDAI','NISSAN','CHEVROLET','FORD','MERCEDES','LEXUS','HONDA','MITSUBISHI','GMC','JEEP','DODGE','CHRYSLER','VOLKSWAGEN','AUDI','MAZDA','SUZUKI','RENAULT','PEUGEOT','RANGE ROVER','LAND ROVER']
  const found = brands.find(b => u.includes(b))
  const ar:any = {'تويوتا':'TOYOTA','بي ام':'BMW','كيا':'KIA','هونداي':'HYUNDAI','هيونداي':'HYUNDAI','نيسان':'NISSAN','شفر':'CHEVROLET','مرسيدس':'MERCEDES','لكزس':'LEXUS','هوندا':'HONDA','ميتسوبيشي':'MITSUBISHI','جمس':'GMC','جيب':'JEEP'}
  const arKey = Object.keys(ar).find(k => t.includes(k))
  return found || (arKey ? ar[arKey] : '')
}
function detectColor(t:string){
  const colors:any = {'ابيض':'أبيض','أبيض':'أبيض','اسود':'أسود','أسود':'أسود','احمر':'أحمر','أحمر':'أحمر','ازرق':'أزرق','أزرق':'أزرق','رصاصي':'رصاصي','فضي':'فضي','سلفر':'فضي','رمادي':'رمادي','اخضر':'أخضر','أخضر':'أخضر','بيج':'بيج','بني':'بني','white':'أبيض','black':'أسود','red':'أحمر','blue':'أزرق','silver':'فضي','gray':'رمادي','grey':'رمادي'}
  const lower = t.toLowerCase()
  for (const k of Object.keys(colors)) if (lower.includes(k.toLowerCase())) return colors[k]
  return ''
}

function stripNoiseLine(v:string){
  return cleanupValue(String(v||'')
    .replace(/Republic of Iraq|Ministry of Interior|Vehicle Registration License|Registration Certificate|وزارة الداخلية|جمهورية العراق|مديرية المرور|تسجيل المركبة|سنوية|خصوصي|حمل|اجرة/ig,' ')
    .replace(/\b(A|D\.?1|D\.?3|R|P\.?5|11)\b\s*[:：\-]?/ig,' '))
}
function nearbyValue(text:string, marker:string, maxChars=90){
  const re = new RegExp(`${escapeRegex(marker)}\\s*[:：\\-،]?\\s*([^\\n]{1,${maxChars}})`, 'i')
  const m = text.match(re)
  return m?.[1] ? stripNoiseLine(m[1]) : ''
}
function findByCodeLabel(text:string, labels:string[]){
  for (const label of labels) {
    const v = nearbyValue(text, label)
    if (v) return v
  }
  return ''
}
function extractIraqiVehiclePlate(text:string){
  const t = normalize(text).toUpperCase()
  const codeVal = findByCodeLabel(t, ['A.', 'A ', 'A-', 'رقم المركبة', 'رقم التسجيل', 'رقم اللوحة', 'اللوحة'])
  const fromCode = cleanDigits(codeVal).match(/[A-Z]{0,3}\d{4,10}/)?.[0]
  if (fromCode) return fromCode
  const candidates = Array.from(new Set((t.match(/\b[A-Z]{1,3}\s?\d{4,8}\b|\b\d{5,10}\b/g) || []).map(x=>x.replace(/\s+/g,''))))
  const filtered = candidates.filter(x => !/^(19|20)\d{2}$/.test(x) && x.length >= 5 && x.length <= 10)
  return filtered[0] || ''
}
function extractIraqiVin(text:string){
  const t = normalize(text).toUpperCase().replace(/\s+/g,' ')
  const codeVal = findByCodeLabel(t, ['P.5', 'P5', 'رقم الشاصي', 'رقم الهيكل', 'الشاصي', 'VIN', 'CHASSIS'])
  const fromCode = codeVal.toUpperCase().match(/[A-HJ-NPR-Z0-9]{12,20}/)?.[0]
  if (fromCode) return fromCode
  return (t.match(/\b[A-HJ-NPR-Z0-9]{12,20}\b/) || [])[0] || ''
}
function extractVehicleModelYear(text:string){
  const t = normalize(text)
  const v = findByCodeLabel(t, ['11.', '11 ', 'الموديل', 'موديل', 'سنة الصنع', 'MODEL YEAR'])
  const y = (v.match(/\b(19[8-9]\d|20[0-4]\d)\b/) || t.match(/\b(19[8-9]\d|20[0-4]\d)\b/))?.[1]
  return y || ''
}
function extractVehicleBrand(text:string){
  const t = normalize(text)
  const byCode = findByCodeLabel(t, ['D.1', 'D1', 'الشركة', 'الصنع', 'الماركة', 'MAKE'])
  const detected = detectCarBrand(`${byCode}\n${t}`)
  return detected || stripNoiseLine(byCode)
}
function extractVehicleType(text:string){
  const t = normalize(text)
  const byCode = findByCodeLabel(t, ['D.3', 'D3', 'النوع', 'الطراز', 'MODEL', 'TYPE'])
  const cleaned = stripNoiseLine(byCode).replace(/\b(TOYOTA|BMW|KIA|HYUNDAI|NISSAN|CHEVROLET|FORD|MERCEDES|LEXUS|HONDA)\b/ig,'').trim()
  if (cleaned && cleaned.length > 1) return cleaned
  const lines = t.split(/\n/).map(stripNoiseLine).filter(Boolean)
  return lines.find(l => /كامري|كورولا|لاندكروزر|النترا|سوناتا|سبورتاج|اوبتما|ماليبو|تاهو|Camry|Corolla|Land|Sportage|Elantra|Sonata/i.test(l)) || ''
}
function extractVehicleColor(text:string){
  const t = normalize(text)
  const byCode = findByCodeLabel(t, ['R.', 'R ', 'R-', 'اللون', 'COLOR'])
  return detectColor(`${byCode}\n${t}`) || stripNoiseLine(byCode)
}
function extractCustomerName(text:string){
  const t = normalize(text)
  const labeled = valueAfter(t, ['الاسم الثلاثي','الاسم الكامل','اسم المواطن','الاسم','Name','Full Name'])
  const cleanedLabeled = labeled ? stripNoiseLine(labeled) : ''
  if (cleanedLabeled && cleanedLabeled.split(/\s+/).length >= 2) return limitNameWords(cleanedLabeled)
  return limitNameWords(likelyArabicName(t) || likelyEnglishName(t) || parseMrzName(t.toUpperCase()))
}
function limitNameWords(name:string){
  const words = cleanupValue(name).split(/\s+/).filter(Boolean)
    .filter(w => !/^(جمهورية|العراق|وزارة|الداخلية|البطاقة|الوطنية|هوية|ذكر|انثى|male|female|iraq)$/i.test(w))
  return words.slice(0, 4).join(' ')
}
function extractCustomerNationalId(text:string){
  const t = normalize(text)
  const labeled = valueAfter(t, ['الرقم الوطني','الرقم التعريفي','رقم البطاقة','رقم الهوية','National ID','ID Number','Document No'])
  const labeledDigits = cleanDigits(labeled).match(/\d{6,14}/)?.[0]
  if (labeledDigits) return labeledDigits
  const nums = extractLongNumbers(t).filter(n => n.length >= 6 && n.length <= 14)
  return nums.sort((a,b)=>b.length-a.length)[0] || ''
}

function ensureUsefulFallback(t:string){
  const text = normalize(t)
  if(props.type==='car'){
    if(!draft.plateNumber) draft.plateNumber = extractIraqiVehiclePlate(text)
    if(!draft.brand) draft.brand = extractVehicleBrand(text)
    if(!draft.model) draft.model = extractVehicleType(text)
    if(!draft.color) draft.color = extractVehicleColor(text)
    if(!draft.vinNumber) draft.vinNumber = extractIraqiVin(text)
    if(!draft.year) draft.year = extractVehicleModelYear(text)
    if(!draft.description && text) draft.description = `نص السنوية المقروء: ${text.slice(0,900)}`
  }else{
    if(!draft.fullName) draft.fullName = extractCustomerName(text)
    if(!draft.nationalId) draft.nationalId = extractCustomerNationalId(text)
    if(!draft.notes && text) draft.notes = `نص الهوية المقروء: ${text.slice(0,900)}`
  }
}

function parseText(input:string){
  const t = normalize(input)
  if(props.type==='car'){
    // الحقول المطلوبة فقط من السنوية العراقية:
    // A رقم اللوحة، D.1 الشركة، D.3 النوع، R اللون، P.5 الشاصي، 11 الموديل.
    draft.plateNumber = extractIraqiVehiclePlate(t) || draft.plateNumber
    draft.brand = extractVehicleBrand(t) || draft.brand
    draft.model = extractVehicleType(t) || draft.model
    draft.color = extractVehicleColor(t) || draft.color
    draft.vinNumber = extractIraqiVin(t) || draft.vinNumber
    draft.year = extractVehicleModelYear(t) || draft.year
    const descParts = []
    if (t) descParts.push(`نص السنوية المقروء: ${t.slice(0,900)}`)
    if (images.front) descParts.push('صورة وجه السنوية محفوظة')
    if (images.back) descParts.push('صورة ظهر السنوية محفوظة')
    draft.description = descParts.join(' | ') || draft.description
  } else {
    // الحقول المطلوبة فقط من الهوية:
    // الاسم الثلاثي + الرقم الوطني أو رقم الهوية.
    draft.fullName = extractCustomerName(t) || draft.fullName
    draft.nationalId = extractCustomerNationalId(t) || draft.nationalId
    const noteParts = []
    if (t) noteParts.push(`نص الهوية المقروء: ${t.slice(0,900)}`)
    if (images.front) noteParts.push('صورة وجه الهوية محفوظة')
    if (images.back) noteParts.push('صورة ظهر الهوية محفوظة')
    draft.notes = noteParts.join(' | ') || draft.notes
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
.scan-overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:18px}
.scan-sheet{width:min(1160px,100%);max-height:94vh;overflow:auto;padding:22px}
.scan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}.scan-title{font-size:1.65rem;font-weight:950}
.scan-message{margin-bottom:12px;border-radius:18px;border:1px solid;padding:12px;font-size:.9rem;font-weight:900}.scan-ocr-progress{margin-bottom:12px;border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:18px;padding:10px 12px;color:var(--muted);font-weight:900;font-size:.85rem}.scan-ocr-bar{margin-top:8px;height:7px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.scan-ocr-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#2563eb,#22c55e);transition:width .25s ease}.scan-message.ok{border-color:rgba(16,185,129,.4);color:#10b981}.scan-message.error{border-color:rgba(239,68,68,.42);color:#ef4444}
.scan-progress{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.scan-step{display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid var(--border);background:rgba(255,255,255,.04);border-radius:18px;padding:12px;font-weight:900;color:var(--muted)}.scan-step span{width:28px;height:28px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.07);font-size:.78rem}.scan-step.active{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;box-shadow:0 16px 35px rgba(37,99,235,.25)}
.scan-layout{display:grid;grid-template-columns:1.35fr .65fr;gap:16px}.scan-camera{padding:12px}.scan-frame{position:relative;overflow:hidden;border-radius:26px;background:#020817}.scan-video{width:100%;height:min(62vh,520px);border-radius:24px;background:#020817;border:1px solid var(--border);object-fit:cover}.scan-placeholder{height:min(62vh,520px);border-radius:24px;border:1px dashed var(--border);display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted)}.scan-placeholder b{font-size:1.3rem;color:var(--text)}.scan-placeholder span{max-width:420px}.scan-lens{width:72px;height:72px;border-radius:24px;border:2px solid rgba(59,130,246,.7);box-shadow:0 0 35px rgba(59,130,246,.35)}
.scan-guide{pointer-events:none;position:absolute;inset:0}.scan-card-outline{position:absolute;left:6%;right:6%;top:17%;bottom:18%;border:3px solid rgba(255,255,255,.72);border-radius:24px;box-shadow:0 0 0 999px rgba(0,0,0,.16), inset 0 0 28px rgba(37,99,235,.12)}.scan-line{position:absolute;left:9%;right:9%;top:22%;height:3px;border-radius:999px;background:linear-gradient(90deg,transparent,#22c55e,transparent);opacity:.85}.scan-line.move{animation:scanLine 2.3s linear infinite}@keyframes scanLine{0%{top:22%}50%{top:74%}100%{top:22%}}
.scan-countdown{position:absolute;inset:0;display:grid;place-items:center;font-size:5rem;font-weight:950;color:white;text-shadow:0 8px 35px rgba(0,0,0,.65)}.scan-status-bar{position:absolute;left:18px;right:18px;bottom:18px;display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid rgba(255,255,255,.16);background:rgba(2,8,23,.72);backdrop-filter:blur(12px);border-radius:18px;padding:12px 14px;color:white}.scan-status-bar span{color:#cbd5e1;font-size:.85rem}
.scan-thumbs{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.scan-thumb{height:92px;border:1px solid var(--border);border-radius:18px;display:grid;place-items:center;color:var(--muted);font-weight:900;overflow:hidden;background:rgba(255,255,255,.04);cursor:pointer}.scan-thumb.done{border-color:rgba(16,185,129,.65)}.scan-thumb img{width:100%;height:100%;object-fit:cover}.scan-tools{display:flex;flex-direction:column;gap:12px}.scan-toggle{display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:16px;padding:12px;font-weight:900;color:var(--muted)}.scan-toggle input{width:18px;height:18px}.scan-results{margin-top:16px;padding:16px}
@media (max-width: 860px){.scan-overlay{align-items:end;padding:0}.scan-sheet{width:100%;max-height:96dvh;border-radius:28px 28px 0 0;padding:14px}.scan-head{align-items:center}.scan-title{font-size:1.35rem}.scan-layout{grid-template-columns:1fr}.scan-video,.scan-placeholder{height:62dvh;min-height:380px}.scan-card-outline{left:4%;right:4%;top:19%;bottom:19%;border-radius:20px}.scan-status-bar{left:10px;right:10px;bottom:10px;flex-direction:column;align-items:flex-start}.scan-thumb{height:76px}.scan-results{padding:12px}}
@media (max-width: 430px){.scan-video,.scan-placeholder{height:58dvh;min-height:330px}.scan-progress{grid-template-columns:1fr}.scan-tools .btn{min-height:52px}.scan-countdown{font-size:4rem}}
</style>
