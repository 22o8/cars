<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

interface Expense {
  id: string
  title: string
  amount: number
}

interface Vehicle {
  id: string
  driverName: string
  vehicleNumber: string
}

interface TransportRecord {
  id: string
  driverName: string
  vehicleNumber: string
  sender: string
  recipient: string
  goods: string
  date: string
  multiVehicle?: boolean
  vehicles?: Vehicle[]
  expenses: Expense[]
  fees: number
  receivedAmount?: number
  paymentDate?: string
  note: string
  createdAt: string
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'transport-ledger-records-v1'
const makeId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(16).slice(2)}`
const today = () => new Date().toISOString().slice(0, 10)

const form = reactive({
  multiVehicle: false,
  driverName: '',
  vehicleNumber: '',
  sender: '',
  recipient: '',
  goods: '',
  date: today(),
  fees: 0,
  receivedAmount: 0,
  paymentDate: today(),
  note: ''
})

const expenses = ref<Expense[]>([{ id: makeId(), title: '', amount: 0 }])
const vehicles = ref<Vehicle[]>([
  { id: makeId(), driverName: '', vehicleNumber: '' },
  { id: makeId(), driverName: '', vehicleNumber: '' }
])
const records = ref<TransportRecord[]>([])
const editingId = ref<string | null>(null)
const notification = ref('')
const installPrompt = ref<InstallPromptEvent | null>(null)
const canInstall = ref(false)
const formError = ref('')
const printMode = ref<'record' | 'statement'>('record')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let webMcpLifecycle: AbortController | undefined

const requiredFields = computed(() => [
  form.sender,
  form.recipient,
  form.goods,
  form.date
])

const expensesTotal = computed(() => expenses.value.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
const grandTotal = computed(() => expensesTotal.value + (Number(form.fees) || 0))
const receivedAmount = computed(() => Number(form.receivedAmount) || 0)
const remainingAmount = computed(() => Math.max(grandTotal.value - receivedAmount.value, 0))
const paymentStatus = computed(() => {
  if (receivedAmount.value <= 0) return { label: 'غير مستلم', className: 'unpaid' }
  if (receivedAmount.value < grandTotal.value) return { label: 'استلام جزئي', className: 'partial' }
  return { label: 'مستلم بالكامل', className: 'paid' }
})

const recordTotal = (record: TransportRecord) => record.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number(record.fees || 0)
const recordReceived = (record: TransportRecord) => Number(record.receivedAmount || 0)
const recordRemaining = (record: TransportRecord) => Math.max(recordTotal(record) - recordReceived(record), 0)
const recordPaymentStatus = (record: TransportRecord) => {
  const received = recordReceived(record)
  if (received <= 0) return { label: 'غير مستلم', className: 'unpaid' }
  if (received < recordTotal(record)) return { label: 'جزئي', className: 'partial' }
  return { label: 'مستلم', className: 'paid' }
}
const statementTotal = computed(() => records.value.reduce((sum, record) => sum + recordTotal(record), 0))
const statementReceived = computed(() => records.value.reduce((sum, record) => sum + recordReceived(record), 0))
const statementRemaining = computed(() => records.value.reduce((sum, record) => sum + recordRemaining(record), 0))

const formatMoney = (value: number) => new Intl.NumberFormat('ar-IQ', {
  maximumFractionDigits: 0
}).format(value || 0)

const formatDate = (value: string) => value
  ? new Intl.DateTimeFormat('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${value}T12:00:00`))
  : '—'

const showNotice = (message: string) => {
  notification.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notification.value = '' }, 2800)
}

const persistRecords = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.value))
}

const addExpense = () => {
  expenses.value.push({ id: makeId(), title: '', amount: 0 })
  nextTick(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-expense-title]')
    inputs.item(inputs.length - 1)?.focus()
  })
}

const toggleMultiVehicle = () => {
  form.multiVehicle = !form.multiVehicle
  if (form.multiVehicle) {
    vehicles.value = [
      { id: makeId(), driverName: form.driverName, vehicleNumber: form.vehicleNumber },
      { id: makeId(), driverName: '', vehicleNumber: '' }
    ]
  } else {
    const firstVehicle = vehicles.value[0]
    form.driverName = firstVehicle?.driverName || ''
    form.vehicleNumber = firstVehicle?.vehicleNumber || ''
  }
  formError.value = ''
}

const addVehicle = () => {
  vehicles.value.push({ id: makeId(), driverName: '', vehicleNumber: '' })
}

const removeVehicle = (id: string) => {
  if (vehicles.value.length <= 2) return
  vehicles.value = vehicles.value.filter(vehicle => vehicle.id !== id)
}

const removeExpense = (id: string) => {
  if (expenses.value.length === 1) {
    expenses.value[0] = { id: makeId(), title: '', amount: 0 }
    return
  }
  expenses.value = expenses.value.filter(item => item.id !== id)
}

const resetForm = () => {
  Object.assign(form, {
    multiVehicle: false,
    driverName: '',
    vehicleNumber: '',
    sender: '',
    recipient: '',
    goods: '',
    date: today(),
    fees: 0,
    receivedAmount: 0,
    paymentDate: today(),
    note: ''
  })
  expenses.value = [{ id: makeId(), title: '', amount: 0 }]
  vehicles.value = [
    { id: makeId(), driverName: '', vehicleNumber: '' },
    { id: makeId(), driverName: '', vehicleNumber: '' }
  ]
  editingId.value = null
  formError.value = ''
}

const validateForm = () => {
  const selectedVehicles = form.multiVehicle
    ? vehicles.value.filter(vehicle => vehicle.driverName.trim() || vehicle.vehicleNumber.trim())
    : [{ driverName: form.driverName, vehicleNumber: form.vehicleNumber }]

  if (requiredFields.value.some(value => !String(value).trim()) || selectedVehicles.length === 0) {
    formError.value = 'يرجى إكمال الحقول الأساسية قبل الحفظ.'
    return false
  }
  if (selectedVehicles.some(vehicle => !vehicle.driverName.trim() || !vehicle.vehicleNumber.trim())) {
    formError.value = 'يرجى كتابة اسم السائق ورقم السيارة لكل سيارة مضافة.'
    return false
  }
  if (expenses.value.some(item => Number(item.amount) < 0) || Number(form.fees) < 0 || Number(form.receivedAmount) < 0) {
    formError.value = 'لا يمكن إدخال مبالغ سالبة.'
    return false
  }
  formError.value = ''
  return true
}

const createRecord = (id = makeId()): TransportRecord => {
  const selectedVehicles: Vehicle[] = form.multiVehicle
    ? vehicles.value
        .filter(vehicle => vehicle.driverName.trim() || vehicle.vehicleNumber.trim())
        .map(vehicle => ({ ...vehicle, driverName: vehicle.driverName.trim(), vehicleNumber: vehicle.vehicleNumber.trim() }))
    : [{ id: makeId(), driverName: form.driverName.trim(), vehicleNumber: form.vehicleNumber.trim() }]
  const primaryVehicle = selectedVehicles[0]

  return {
  id,
  driverName: primaryVehicle.driverName,
  vehicleNumber: primaryVehicle.vehicleNumber,
  sender: form.sender.trim(),
  recipient: form.recipient.trim(),
  goods: form.goods.trim(),
  date: form.date,
  multiVehicle: form.multiVehicle,
  vehicles: selectedVehicles,
  expenses: expenses.value
    .filter(item => item.title.trim() || Number(item.amount) > 0)
    .map(item => ({ ...item, title: item.title.trim(), amount: Number(item.amount) || 0 })),
  fees: Number(form.fees) || 0,
  receivedAmount: Number(form.receivedAmount) || 0,
  paymentDate: Number(form.receivedAmount) > 0 ? form.paymentDate : '',
  note: form.note.trim(),
  createdAt: new Date().toISOString()
  }
}

const saveRecord = () => {
  if (!validateForm()) return
  const existingIndex = editingId.value
    ? records.value.findIndex(record => record.id === editingId.value)
    : -1
  const record = createRecord(editingId.value || undefined)

  if (existingIndex >= 0) {
    record.createdAt = records.value[existingIndex].createdAt
    records.value.splice(existingIndex, 1, record)
    showNotice('تم تحديث السجل بنجاح')
  } else {
    records.value.unshift(record)
    showNotice('تم حفظ السجل على هذا الجهاز')
  }
  persistRecords()
  resetForm()
}

const editRecord = (record: TransportRecord) => {
  const recordVehicles = record.vehicles?.length
    ? record.vehicles
    : [{ id: makeId(), driverName: record.driverName, vehicleNumber: record.vehicleNumber }]
  Object.assign(form, {
    multiVehicle: Boolean(record.multiVehicle || recordVehicles.length > 1),
    driverName: record.driverName,
    vehicleNumber: record.vehicleNumber,
    sender: record.sender,
    recipient: record.recipient,
    goods: record.goods,
    date: record.date,
    fees: record.fees,
    receivedAmount: record.receivedAmount || 0,
    paymentDate: record.paymentDate || today(),
    note: record.note
  })
  vehicles.value = recordVehicles.map(vehicle => ({ ...vehicle, id: makeId() }))
  if (vehicles.value.length === 1) vehicles.value.push({ id: makeId(), driverName: '', vehicleNumber: '' })
  expenses.value = record.expenses.length
    ? record.expenses.map(item => ({ ...item, id: makeId() }))
    : [{ id: makeId(), title: '', amount: 0 }]
  editingId.value = record.id
  formError.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const deleteRecord = (record: TransportRecord) => {
  if (!window.confirm(`حذف سجل السائق ${record.driverName}؟`)) return
  records.value = records.value.filter(item => item.id !== record.id)
  persistRecords()
  if (editingId.value === record.id) resetForm()
  showNotice('تم حذف السجل')
}

const printCurrent = async () => {
  formError.value = ''
  printMode.value = 'record'
  await nextTick()
  window.print()
}

const printRecord = async (record: TransportRecord) => {
  editRecord(record)
  printMode.value = 'record'
  await nextTick()
  window.print()
}

const printStatement = async () => {
  printMode.value = 'statement'
  await nextTick()
  window.print()
}

const installApp = async () => {
  if (!installPrompt.value) return
  await installPrompt.value.prompt()
  await installPrompt.value.userChoice
  installPrompt.value = null
  canInstall.value = false
}

const handleInstallPrompt = (event: Event) => {
  event.preventDefault()
  installPrompt.value = event as InstallPromptEvent
  canInstall.value = true
}

const registerWebMcpTools = () => {
  const context = document.modelContext
  if (!context?.registerTool) return
  webMcpLifecycle = new AbortController()

  const createTool = context.registerTool({
    name: 'create_transport_record',
    title: 'إنشاء سجل نقل',
    description: 'ينشئ سجلاً جديداً لعملية نقل ويحفظه في قائمة السجلات الظاهرة.',
    inputSchema: {
      type: 'object',
      properties: {
        driverName: { type: 'string' },
        vehicleNumber: { type: 'string' },
        sender: { type: 'string' },
        recipient: { type: 'string' },
        goods: { type: 'string' },
        date: { type: 'string', format: 'date' },
        expenses: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string' }, amount: { type: 'number', minimum: 0 } },
            required: ['title', 'amount'],
            additionalProperties: false
          }
        },
        fees: { type: 'number', minimum: 0 },
        receivedAmount: { type: 'number', minimum: 0 },
        paymentDate: { type: 'string', format: 'date' },
        note: { type: 'string' }
      },
      required: ['driverName', 'vehicleNumber', 'sender', 'recipient', 'goods', 'date'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input: unknown) {
      const data = input as Partial<TransportRecord>
      const mandatory = [data.driverName, data.vehicleNumber, data.sender, data.recipient, data.goods, data.date]
      if (mandatory.some(value => !String(value || '').trim())) throw new Error('الحقول الأساسية مطلوبة')
      const record: TransportRecord = {
        id: makeId(),
        driverName: String(data.driverName).trim(),
        vehicleNumber: String(data.vehicleNumber).trim(),
        sender: String(data.sender).trim(),
        recipient: String(data.recipient).trim(),
        goods: String(data.goods).trim(),
        date: String(data.date),
        multiVehicle: false,
        vehicles: [{ id: makeId(), driverName: String(data.driverName).trim(), vehicleNumber: String(data.vehicleNumber).trim() }],
        expenses: Array.isArray(data.expenses)
          ? data.expenses.map(item => ({ id: makeId(), title: String(item.title || ''), amount: Number(item.amount) || 0 }))
          : [],
        fees: Number(data.fees) || 0,
        receivedAmount: Number(data.receivedAmount) || 0,
        paymentDate: Number(data.receivedAmount) > 0 ? String(data.paymentDate || today()) : '',
        note: String(data.note || '').trim(),
        createdAt: new Date().toISOString()
      }
      if (record.fees < 0 || record.expenses.some(item => item.amount < 0)) throw new Error('المبالغ السالبة غير مسموحة')
      records.value.unshift(record)
      persistRecords()
      showNotice('تم إنشاء سجل جديد')
      return {
        id: record.id,
        total: record.expenses.reduce((sum, item) => sum + item.amount, 0) + record.fees
      }
    }
  }, { signal: webMcpLifecycle.signal })

  const listTool = context.registerTool({
    name: 'list_transport_records',
    title: 'عرض سجلات النقل',
    description: 'يعرض ملخص السجلات المحفوظة حالياً دون تعديلها.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      return records.value.map(record => ({
        id: record.id,
        driverName: record.driverName,
        vehicleNumber: record.vehicleNumber,
        date: record.date,
        total: recordTotal(record),
        received: recordReceived(record),
        remaining: recordRemaining(record)
      }))
    }
  }, { signal: webMcpLifecycle.signal })

  Promise.allSettled([Promise.resolve(createTool), Promise.resolve(listTool)]).catch(() => undefined)
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      records.value = (JSON.parse(saved) as TransportRecord[]).map(record => ({
        ...record,
        multiVehicle: Boolean(record.multiVehicle || (record.vehicles?.length || 0) > 1),
        vehicles: record.vehicles?.length
          ? record.vehicles
          : [{ id: makeId(), driverName: record.driverName, vehicleNumber: record.vehicleNumber }],
        receivedAmount: Number(record.receivedAmount || 0),
        paymentDate: record.paymentDate || ''
      }))
    }
  } catch {
    showNotice('تعذر قراءة السجلات المحفوظة')
  }
  window.addEventListener('beforeinstallprompt', handleInstallPrompt)
  registerWebMcpTools()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
  webMcpLifecycle?.abort()
  if (noticeTimer) clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar no-print">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M3 6h11v8h1.5l2-3H21v6h-1.1a3 3 0 0 1-5.8 0H9.9a3 3 0 0 1-5.8 0H3V6Zm14 7-1 1.5h3V13h-2ZM7 18.5A1.5 1.5 0 1 0 7 15a1.5 1.5 0 0 0 0 3.5Zm10 0a1.5 1.5 0 1 0 0-3.5 1.5 1.5 0 0 0 0 3.5Z"/></svg>
        </div>
        <div>
          <h1>سجل النقل</h1>
          <p>بيانات الشحن والمصروفات</p>
        </div>
      </div>
      <button v-if="canInstall" class="install-btn" type="button" @click="installApp">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2h14v-2"/></svg>
        تثبيت التطبيق
      </button>
    </header>

    <main class="workspace no-print">
      <section class="entry-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">سجل جديد</span>
            <h2>{{ editingId ? 'تعديل بيانات النقل' : 'بيانات عملية النقل' }}</h2>
          </div>
          <button v-if="editingId" class="text-btn" type="button" @click="resetForm">إلغاء التعديل</button>
        </div>

        <div class="transport-mode">
          <div class="mode-copy">
            <div class="mode-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M3 7h10v8h2l2-3h4v6h-2m-4 0H9m-5 0H3V7Zm3 2h3m7 5h4l-1.5-2H16v2ZM6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
            </div>
            <div>
              <strong>أكثر من سيارة نقل</strong>
              <p>شغّل هذا الخيار لإضافة عدة سيارات وسائقين إلى السجل نفسه.</p>
            </div>
          </div>
          <button
            class="switch"
            :class="{ active: form.multiVehicle }"
            type="button"
            role="switch"
            :aria-checked="form.multiVehicle"
            aria-label="أكثر من سيارة نقل"
            @click="toggleMultiVehicle"
          >
            <span />
          </button>
        </div>

        <form @submit.prevent="saveRecord">
          <div class="form-grid">
            <label v-if="!form.multiVehicle" class="field">
              <span>اسم السائق <b>*</b></span>
              <input v-model="form.driverName" type="text" placeholder="مثال: أحمد علي" autocomplete="name">
            </label>
            <label v-if="!form.multiVehicle" class="field">
              <span>رقم السيارة <b>*</b></span>
              <input v-model="form.vehicleNumber" type="text" placeholder="مثال: بغداد 12345" inputmode="text">
            </label>
            <div v-else class="vehicles-block">
              <div class="vehicles-title">
                <div>
                  <strong>السيارات والسائقون</strong>
                  <span>{{ vehicles.length }} سيارات مضافة</span>
                </div>
                <button class="add-btn" type="button" @click="addVehicle"><span aria-hidden="true">＋</span> إضافة سيارة</button>
              </div>
              <div class="vehicles-list">
                <div v-for="(vehicle, index) in vehicles" :key="vehicle.id" class="vehicle-row">
                  <span class="vehicle-number">{{ index + 1 }}</span>
                  <label class="field">
                    <span>اسم السائق <b>*</b></span>
                    <input v-model="vehicle.driverName" type="text" :placeholder="`اسم سائق السيارة ${index + 1}`">
                  </label>
                  <label class="field">
                    <span>رقم السيارة <b>*</b></span>
                    <input v-model="vehicle.vehicleNumber" type="text" :placeholder="`رقم السيارة ${index + 1}`">
                  </label>
                  <button
                    class="icon-btn danger"
                    type="button"
                    :disabled="vehicles.length <= 2"
                    :aria-label="`حذف السيارة ${index + 1}`"
                    @click="removeVehicle(vehicle.id)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>
                  </button>
                </div>
              </div>
            </div>
            <label class="field">
              <span>المرسل <b>*</b></span>
              <input v-model="form.sender" type="text" placeholder="اسم المرسل أو الشركة">
            </label>
            <label class="field">
              <span>المرسل إليه <b>*</b></span>
              <input v-model="form.recipient" type="text" placeholder="اسم المستلم أو الجهة">
            </label>
            <label class="field">
              <span>البضاعة <b>*</b></span>
              <input v-model="form.goods" type="text" placeholder="نوع أو وصف البضاعة">
            </label>
            <label class="field">
              <span>التاريخ <b>*</b></span>
              <input v-model="form.date" type="date">
            </label>
          </div>

          <div class="divider" />

          <div class="expenses-heading">
            <div>
              <h3>الصرفيات</h3>
              <p>أضف تفاصيل المبالغ المصروفة على هذه النقلة</p>
            </div>
            <button class="add-btn" type="button" @click="addExpense">
              <span aria-hidden="true">＋</span> إضافة صرفية
            </button>
          </div>

          <div class="expense-list">
            <div v-for="(expense, index) in expenses" :key="expense.id" class="expense-row">
              <span class="expense-index">{{ index + 1 }}</span>
              <label class="field expense-name">
                <span>بيان الصرف</span>
                <input v-model="expense.title" data-expense-title type="text" placeholder="وقود، تحميل، أجور طريق...">
              </label>
              <label class="field expense-amount">
                <span>المبلغ</span>
                <div class="money-input">
                  <input v-model.number="expense.amount" type="number" min="0" step="1000" inputmode="decimal">
                  <em>د.ع</em>
                </div>
              </label>
              <button class="icon-btn danger" type="button" aria-label="حذف الصرفية" @click="removeExpense(expense.id)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>
              </button>
            </div>
          </div>

          <div class="fees-note-grid">
            <label class="field">
              <span>الرسوم</span>
              <div class="money-input">
                <input v-model.number="form.fees" type="number" min="0" step="1000" inputmode="decimal">
                <em>د.ع</em>
              </div>
            </label>
            <label class="field note-field">
              <span>ملاحظة <small>اختياري</small></span>
              <textarea v-model="form.note" rows="3" placeholder="اكتب أي تفاصيل إضافية هنا..." />
            </label>
          </div>

          <div class="payment-section">
            <div class="payment-heading">
              <div>
                <span class="eyebrow">استلام المبالغ</span>
                <h3>تفاصيل المبلغ المستلم</h3>
              </div>
              <span class="payment-badge" :class="paymentStatus.className">{{ paymentStatus.label }}</span>
            </div>
            <div class="payment-grid">
              <label class="field">
                <span>المبلغ المستلم</span>
                <div class="money-input">
                  <input v-model.number="form.receivedAmount" type="number" min="0" step="1000" inputmode="decimal">
                  <em>د.ع</em>
                </div>
              </label>
              <label class="field">
                <span>تاريخ الاستلام</span>
                <input v-model="form.paymentDate" type="date" :disabled="receivedAmount <= 0">
              </label>
              <div class="remaining-card">
                <span>المبلغ المتبقي</span>
                <strong>{{ formatMoney(remainingAmount) }} <small>د.ع</small></strong>
              </div>
            </div>
          </div>

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <div class="form-actions">
            <button class="primary-btn" type="submit">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-7h8v7"/></svg>
              {{ editingId ? 'حفظ التعديلات' : 'حفظ السجل' }}
            </button>
            <button class="secondary-btn" type="button" @click="printCurrent">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4V9h16v8h-3m-10-4h10v8H7v-8Z"/></svg>
              طباعة
            </button>
            <button class="ghost-btn" type="button" @click="resetForm">تفريغ الحقول</button>
          </div>
        </form>
      </section>

      <aside class="summary-panel">
        <div class="summary-card">
          <span class="eyebrow light">ملخص المبالغ</span>
          <div class="summary-row">
            <span>مجموع الصرفيات</span>
            <strong>{{ formatMoney(expensesTotal) }} <small>د.ع</small></strong>
          </div>
          <div class="summary-row">
            <span>الرسوم</span>
            <strong>{{ formatMoney(Number(form.fees)) }} <small>د.ع</small></strong>
          </div>
          <div class="summary-row received">
            <span>المبلغ المستلم</span>
            <strong>{{ formatMoney(receivedAmount) }} <small>د.ع</small></strong>
          </div>
          <div class="summary-total">
            <span>المبلغ المتبقي</span>
            <strong>{{ formatMoney(remainingAmount) }}</strong>
            <small>{{ paymentStatus.label }} · المجموع {{ formatMoney(grandTotal) }} د.ع</small>
          </div>
        </div>
        <div class="storage-note">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s8-3.5 8-10V5l-8-3-8 3v6c0 6.5 8 10 8 10Zm-3-10 2 2 4-5"/></svg>
          <div>
            <strong>حفظ محلي وآمن</strong>
            <p>تبقى السجلات محفوظة داخل هذا الجهاز حتى عند إغلاق التطبيق.</p>
          </div>
        </div>
      </aside>
    </main>

    <section class="statement-section no-print">
      <div class="statement-header">
        <div>
          <span class="eyebrow">الكشف</span>
          <h2>الكشف المالي</h2>
          <p>ملخص المبالغ المستحقة والمستلمة لجميع عمليات النقل.</p>
        </div>
        <button class="secondary-btn" type="button" :disabled="!records.length" @click="printStatement">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4V9h16v8h-3m-10-4h10v8H7v-8Z"/></svg>
          طباعة الكشف
        </button>
      </div>
      <div class="statement-totals">
        <div><span>إجمالي المبالغ</span><strong>{{ formatMoney(statementTotal) }} <small>د.ع</small></strong></div>
        <div class="received"><span>المبالغ المستلمة</span><strong>{{ formatMoney(statementReceived) }} <small>د.ع</small></strong></div>
        <div class="remaining"><span>المبالغ المتبقية</span><strong>{{ formatMoney(statementRemaining) }} <small>د.ع</small></strong></div>
      </div>
      <div v-if="records.length" class="statement-table-wrap">
        <table class="statement-table">
          <thead><tr><th>التاريخ</th><th>السائق / السيارات</th><th>الإجمالي</th><th>المستلم</th><th>المتبقي</th><th>الحالة</th></tr></thead>
          <tbody>
            <tr v-for="record in records" :key="`statement-${record.id}`">
              <td>{{ formatDate(record.date) }}</td>
              <td><strong>{{ record.driverName }}</strong><small>{{ record.vehicles?.length || 1 }} سيارة</small></td>
              <td>{{ formatMoney(recordTotal(record)) }} د.ع</td>
              <td>{{ formatMoney(recordReceived(record)) }} د.ع</td>
              <td>{{ formatMoney(recordRemaining(record)) }} د.ع</td>
              <td><span class="payment-badge" :class="recordPaymentStatus(record).className">{{ recordPaymentStatus(record).label }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="statement-empty">احفظ أول سجل لتظهر بياناته في الكشف المالي.</div>
    </section>

    <section class="records-section no-print">
      <div class="records-header">
        <div>
          <span class="eyebrow">الأرشيف</span>
          <h2>السجلات المحفوظة</h2>
        </div>
        <span class="record-count">{{ records.length }} سجل</span>
      </div>

      <div v-if="records.length" class="records-list">
        <article v-for="record in records" :key="record.id" class="record-card">
          <div class="record-main">
            <div class="avatar" aria-hidden="true">{{ record.driverName.slice(0, 1) }}</div>
            <div>
              <h3>{{ record.driverName }}</h3>
              <p>{{ record.vehicleNumber }}<template v-if="(record.vehicles?.length || 1) > 1"> +{{ (record.vehicles?.length || 1) - 1 }} سيارة</template> · {{ record.goods }}</p>
            </div>
          </div>
          <div class="record-route">
            <span>{{ record.sender }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m5-5-5 5 5 5"/></svg>
            <span>{{ record.recipient }}</span>
          </div>
          <div class="record-meta">
            <span>{{ formatDate(record.date) }}</span>
            <strong>{{ formatMoney(recordTotal(record)) }} د.ع</strong>
            <small :class="['record-payment', recordPaymentStatus(record).className]">{{ recordPaymentStatus(record).label }} · متبقي {{ formatMoney(recordRemaining(record)) }}</small>
          </div>
          <div class="record-actions">
            <button type="button" @click="editRecord(record)">تعديل</button>
            <button type="button" @click="printRecord(record)">طباعة</button>
            <button class="delete-link" type="button" @click="deleteRecord(record)">حذف</button>
          </div>
        </article>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 3h12v18H6V3Zm3 5h6m-6 4h6m-6 4h4"/></svg>
        </div>
        <h3>لا توجد سجلات محفوظة بعد</h3>
        <p>عند حفظ أول عملية نقل ستظهر هنا.</p>
      </div>
    </section>

    <Transition name="toast">
      <div v-if="notification" class="toast no-print" role="status">
        <span aria-hidden="true">✓</span>{{ notification }}
      </div>
    </Transition>

    <section v-if="printMode === 'record'" class="print-sheet">
      <div class="print-head">
        <div>
          <h1>سجل عملية نقل</h1>
          <p>بيان السائق والشحنة والمصروفات</p>
        </div>
        <div class="print-date"><span>التاريخ</span><strong>{{ formatDate(form.date) }}</strong></div>
      </div>
      <div class="print-details">
        <div><span>اسم السائق</span><strong>{{ form.multiVehicle ? vehicles[0]?.driverName || '—' : form.driverName || '—' }}</strong></div>
        <div><span>رقم السيارة</span><strong>{{ form.multiVehicle ? vehicles[0]?.vehicleNumber || '—' : form.vehicleNumber || '—' }}</strong></div>
        <div><span>المرسل</span><strong>{{ form.sender || '—' }}</strong></div>
        <div><span>المرسل إليه</span><strong>{{ form.recipient || '—' }}</strong></div>
        <div class="wide"><span>البضاعة</span><strong>{{ form.goods || '—' }}</strong></div>
      </div>
      <table v-if="form.multiVehicle" class="print-table vehicles-print-table">
        <thead><tr><th>#</th><th>اسم السائق</th><th>رقم السيارة</th></tr></thead>
        <tbody><tr v-for="(vehicle, index) in vehicles.filter(item => item.driverName || item.vehicleNumber)" :key="vehicle.id"><td>{{ index + 1 }}</td><td>{{ vehicle.driverName }}</td><td>{{ vehicle.vehicleNumber }}</td></tr></tbody>
      </table>
      <table class="print-table">
        <thead><tr><th>#</th><th>بيان الصرف</th><th>المبلغ</th></tr></thead>
        <tbody>
          <tr v-for="(expense, index) in expenses.filter(item => item.title || item.amount)" :key="expense.id">
            <td>{{ index + 1 }}</td><td>{{ expense.title || 'صرفية' }}</td><td>{{ formatMoney(Number(expense.amount)) }} د.ع</td>
          </tr>
          <tr v-if="!expenses.some(item => item.title || item.amount)"><td colspan="3">لا توجد صرفيات</td></tr>
        </tbody>
      </table>
      <div class="print-summary">
        <div><span>مجموع الصرفيات</span><strong>{{ formatMoney(expensesTotal) }} د.ع</strong></div>
        <div><span>الرسوم</span><strong>{{ formatMoney(Number(form.fees)) }} د.ع</strong></div>
        <div><span>المجموع الكلي</span><strong>{{ formatMoney(grandTotal) }} د.ع</strong></div>
        <div><span>المبلغ المستلم</span><strong>{{ formatMoney(receivedAmount) }} د.ع</strong></div>
        <div class="final"><span>المبلغ المتبقي</span><strong>{{ formatMoney(remainingAmount) }} د.ع</strong></div>
      </div>
      <div v-if="form.note" class="print-note"><span>ملاحظة</span><p>{{ form.note }}</p></div>
      <div class="signature"><span>توقيع السائق</span><span>توقيع المسؤول</span></div>
    </section>

    <section v-if="printMode === 'statement'" class="print-sheet statement-print">
      <div class="print-head">
        <div><h1>الكشف المالي للنقل</h1><p>إجمالي المبالغ والاستلامات والمتبقي</p></div>
        <div class="print-date"><span>تاريخ الطباعة</span><strong>{{ formatDate(today()) }}</strong></div>
      </div>
      <div class="print-statement-totals">
        <div><span>الإجمالي</span><strong>{{ formatMoney(statementTotal) }} د.ع</strong></div>
        <div><span>المستلم</span><strong>{{ formatMoney(statementReceived) }} د.ع</strong></div>
        <div><span>المتبقي</span><strong>{{ formatMoney(statementRemaining) }} د.ع</strong></div>
      </div>
      <table class="print-table statement-print-table">
        <thead><tr><th>#</th><th>التاريخ</th><th>السائق / السيارة</th><th>الإجمالي</th><th>المستلم</th><th>المتبقي</th></tr></thead>
        <tbody>
          <tr v-for="(record, index) in records" :key="`print-statement-${record.id}`">
            <td>{{ index + 1 }}</td><td>{{ formatDate(record.date) }}</td><td>{{ record.driverName }} / {{ record.vehicleNumber }}<template v-if="(record.vehicles?.length || 1) > 1"> (+{{ (record.vehicles?.length || 1) - 1 }})</template></td><td>{{ formatMoney(recordTotal(record)) }}</td><td>{{ formatMoney(recordReceived(record)) }}</td><td>{{ formatMoney(recordRemaining(record)) }}</td>
          </tr>
        </tbody>
      </table>
      <div class="signature"><span>توقيع المحاسب</span><span>توقيع المسؤول</span></div>
    </section>
  </div>
</template>
