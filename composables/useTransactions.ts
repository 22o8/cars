import type { Company, Transaction, Activity, StageStatus } from '~/types'
import { makeStages, stageRoleMap } from '~/utils/stages'

const STORAGE_KEY = 'tarabil.customs.v1'

function now() { return new Date().toISOString() }
function rid(prefix = '') { return prefix + Math.random().toString(36).slice(2, 10) }

export function useTransactions() {
  const transactions = useState<Transaction[]>('transactions', () => [])
  const companies = useState<Company[]>('companies', () => [
    { id: 'c1', name: 'شركة لميس لصناعة المنظفات', code: '' },
    { id: 'c2', name: 'شركة عين الفرات للتجارة العامة والنقل العام', code: '' },
    { id: 'c3', name: 'شركة الساعة الذهبية للتجارة العامة المحدودة', code: '74002598' }
  ])
  const initialized = useState<boolean>('dbInitialized', () => false)
  const { currentUser } = useAuth()

  function load() {
    if (!import.meta.client || initialized.value) return
    initialized.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      transactions.value = data.transactions || []
      companies.value = data.companies || companies.value
    } catch {}
  }
  function persist() {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions: transactions.value, companies: companies.value }))
  }
  function addActivity(tx: Transaction, action: string, details = '') {
    tx.activities.unshift({ id: rid('a_'), at: now(), userId: currentUser.value.id, userName: currentUser.value.name, action, details } as Activity)
    tx.updatedAt = now()
  }
  function nextSerial() {
    const y = new Date().getFullYear()
    const nums = transactions.value.filter(t => t.serial.startsWith(String(y))).map(t => Number(t.serial.split('-')[1] || 0))
    return `${y}-${String((Math.max(0, ...nums) + 1)).padStart(5, '0')}`
  }
  function create(input: Partial<Transaction>) {
    const company = companies.value.find(c => c.id === input.companyId)
    const tx: Transaction = {
      id: rid('t_'), serial: nextSerial(), createdAt: now(), updatedAt: now(),
      companyId: company?.id || '', companyName: company?.name || '', companyCode: company?.code || '',
      driverName: input.driverName || '', vehicleNumber: input.vehicleNumber || '', goods: input.goods || '',
      unifiedProcedureNo: input.unifiedProcedureNo || '', declarationNo: '', manifestNo: '', notes: input.notes || '',
      needsVeterinary: !!input.needsVeterinary, needsAgriculture: !!input.needsAgriculture,
      stages: makeStages(!!input.needsVeterinary, !!input.needsAgriculture), attachments: [], activities: [],
      finance: { invoiceValue: 0, currency: 'USD', customsValueIqd: 0, tax: 0, customsFees: 0, declarationFee: 0, otherFees: 0, otherFeesNote: '' }
    }
    addActivity(tx, 'إنشاء المعاملة')
    transactions.value.unshift(tx)
    persist()
    return tx
  }
  function update(tx: Transaction, action = 'تحديث بيانات المعاملة') {
    addActivity(tx, action)
    persist()
  }
  function canComplete(tx: Transaction, key: string) {
    if (key === 'unified' && !tx.unifiedProcedureNo.trim()) return 'أدخل رقم الإجراء الموحد أولاً'
    if (key === 'manifest' && !tx.manifestNo.trim()) return 'أدخل رقم المانيفست أولاً'
    if (key === 'archive' && !tx.attachments.some(a => a.category === 'final')) return 'ارفع ملف المعاملة النهائي PDF أولاً'
    return ''
  }
  function setStage(tx: Transaction, key: string, status: StageStatus, note = '') {
    const stage = tx.stages.find(s => s.key === key)
    if (!stage) return
    stage.status = status
    stage.note = note
    if (status === 'done') {
      stage.completedAt = now(); stage.completedBy = currentUser.value.name
      const idx = tx.stages.findIndex(s => s.key === key)
      const next = tx.stages[idx + 1]
      if (next && next.status === 'pending') next.status = 'active'
      if (key === 'delivery') tx.deliveredAt = now()
      addActivity(tx, `إكمال مرحلة: ${stage.label}`, note)
    } else if (status === 'blocked') addActivity(tx, `إيقاف مرحلة: ${stage.label}`, note)
    else addActivity(tx, `تغيير حالة: ${stage.label}`, note)
    persist()
  }
  function currentStage(tx: Transaction) {
    return tx.stages.find(s => s.status === 'active') || tx.stages.find(s => s.status === 'pending') || tx.stages[tx.stages.length - 1]
  }
  function totalFees(tx: Transaction) {
    const f = tx.finance
    return Number(f.tax || 0) + Number(f.customsFees || 0) + Number(f.declarationFee || 0) + Number(f.otherFees || 0)
  }
  function addCompany(name: string, code: string) {
    companies.value.push({ id: rid('c_'), name, code }); persist()
  }
  function removeCompany(id: string) { companies.value = companies.value.filter(c => c.id !== id); persist() }
  function resetDemo() { transactions.value = []; persist() }
  load()
  return { transactions, companies, create, update, persist, setStage, currentStage, totalFees, canComplete, stageRoleMap, addCompany, removeCompany, resetDemo }
}
