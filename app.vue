<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

interface Expense {
  id: string
  title: string
  amount: number
}

interface TransportRecord {
  id: string
  driverName: string
  vehicleNumber: string
  sender: string
  recipient: string
  goods: string
  date: string
  expenses: Expense[]
  fees: number
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
  driverName: '',
  vehicleNumber: '',
  sender: '',
  recipient: '',
  goods: '',
  date: today(),
  fees: 0,
  note: ''
})

const expenses = ref<Expense[]>([{ id: makeId(), title: '', amount: 0 }])
const records = ref<TransportRecord[]>([])
const editingId = ref<string | null>(null)
const notification = ref('')
const installPrompt = ref<InstallPromptEvent | null>(null)
const canInstall = ref(false)
const formError = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let webMcpLifecycle: AbortController | undefined

const requiredFields = computed(() => [
  form.driverName,
  form.vehicleNumber,
  form.sender,
  form.recipient,
  form.goods,
  form.date
])

const expensesTotal = computed(() => expenses.value.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))
const grandTotal = computed(() => expensesTotal.value + (Number(form.fees) || 0))

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

const removeExpense = (id: string) => {
  if (expenses.value.length === 1) {
    expenses.value[0] = { id: makeId(), title: '', amount: 0 }
    return
  }
  expenses.value = expenses.value.filter(item => item.id !== id)
}

const resetForm = () => {
  Object.assign(form, {
    driverName: '',
    vehicleNumber: '',
    sender: '',
    recipient: '',
    goods: '',
    date: today(),
    fees: 0,
    note: ''
  })
  expenses.value = [{ id: makeId(), title: '', amount: 0 }]
  editingId.value = null
  formError.value = ''
}

const validateForm = () => {
  if (requiredFields.value.some(value => !String(value).trim())) {
    formError.value = 'يرجى إكمال الحقول الأساسية قبل الحفظ.'
    return false
  }
  if (expenses.value.some(item => Number(item.amount) < 0) || Number(form.fees) < 0) {
    formError.value = 'لا يمكن إدخال مبالغ سالبة.'
    return false
  }
  formError.value = ''
  return true
}

const createRecord = (id = makeId()): TransportRecord => ({
  id,
  driverName: form.driverName.trim(),
  vehicleNumber: form.vehicleNumber.trim(),
  sender: form.sender.trim(),
  recipient: form.recipient.trim(),
  goods: form.goods.trim(),
  date: form.date,
  expenses: expenses.value
    .filter(item => item.title.trim() || Number(item.amount) > 0)
    .map(item => ({ ...item, title: item.title.trim(), amount: Number(item.amount) || 0 })),
  fees: Number(form.fees) || 0,
  note: form.note.trim(),
  createdAt: new Date().toISOString()
})

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
  Object.assign(form, {
    driverName: record.driverName,
    vehicleNumber: record.vehicleNumber,
    sender: record.sender,
    recipient: record.recipient,
    goods: record.goods,
    date: record.date,
    fees: record.fees,
    note: record.note
  })
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
  await nextTick()
  window.print()
}

const printRecord = async (record: TransportRecord) => {
  editRecord(record)
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
        expenses: Array.isArray(data.expenses)
          ? data.expenses.map(item => ({ id: makeId(), title: String(item.title || ''), amount: Number(item.amount) || 0 }))
          : [],
        fees: Number(data.fees) || 0,
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
        total: record.expenses.reduce((sum, item) => sum + item.amount, 0) + record.fees
      }))
    }
  }, { signal: webMcpLifecycle.signal })

  Promise.allSettled([Promise.resolve(createTool), Promise.resolve(listTool)]).catch(() => undefined)
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) records.value = JSON.parse(saved)
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

        <form @submit.prevent="saveRecord">
          <div class="form-grid">
            <label class="field">
              <span>اسم السائق <b>*</b></span>
              <input v-model="form.driverName" type="text" placeholder="مثال: أحمد علي" autocomplete="name">
            </label>
            <label class="field">
              <span>رقم السيارة <b>*</b></span>
              <input v-model="form.vehicleNumber" type="text" placeholder="مثال: بغداد 12345" inputmode="text">
            </label>
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
          <div class="summary-total">
            <span>المجموع الكلي</span>
            <strong>{{ formatMoney(grandTotal) }}</strong>
            <small>دينار عراقي</small>
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
              <p>{{ record.vehicleNumber }} · {{ record.goods }}</p>
            </div>
          </div>
          <div class="record-route">
            <span>{{ record.sender }}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m5-5-5 5 5 5"/></svg>
            <span>{{ record.recipient }}</span>
          </div>
          <div class="record-meta">
            <span>{{ formatDate(record.date) }}</span>
            <strong>{{ formatMoney(record.expenses.reduce((sum, item) => sum + item.amount, 0) + record.fees) }} د.ع</strong>
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

    <section class="print-sheet">
      <div class="print-head">
        <div>
          <h1>سجل عملية نقل</h1>
          <p>بيان السائق والشحنة والمصروفات</p>
        </div>
        <div class="print-date"><span>التاريخ</span><strong>{{ formatDate(form.date) }}</strong></div>
      </div>
      <div class="print-details">
        <div><span>اسم السائق</span><strong>{{ form.driverName || '—' }}</strong></div>
        <div><span>رقم السيارة</span><strong>{{ form.vehicleNumber || '—' }}</strong></div>
        <div><span>المرسل</span><strong>{{ form.sender || '—' }}</strong></div>
        <div><span>المرسل إليه</span><strong>{{ form.recipient || '—' }}</strong></div>
        <div class="wide"><span>البضاعة</span><strong>{{ form.goods || '—' }}</strong></div>
      </div>
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
        <div class="final"><span>المجموع الكلي</span><strong>{{ formatMoney(grandTotal) }} د.ع</strong></div>
      </div>
      <div v-if="form.note" class="print-note"><span>ملاحظة</span><p>{{ form.note }}</p></div>
      <div class="signature"><span>توقيع السائق</span><span>توقيع المسؤول</span></div>
    </section>
  </div>
</template>
