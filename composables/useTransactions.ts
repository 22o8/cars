import type { Company, Transaction, Activity, StageStatus, StageEntry } from '~/types'
import { makeStages, stageRoleMap } from '~/utils/stages'

const STORAGE_KEY = 'tarabil.customs.v2'
const OLD_STORAGE_KEY = 'tarabil.customs.v1'

function now() { return new Date().toISOString() }
function rid(prefix = '') { return prefix + Math.random().toString(36).slice(2, 10) }

export function useTransactions() {
  const transactions = useState<Transaction[]>('transactions', () => [])
  const companies = useState<Company[]>('companies', () => [
    { id: 'c1', name: 'شركة لميس لصناعة المنظفات', code: '' },
    { id: 'c2', name: 'شركة عين الفرات للتجارة العامة والنقل العام', code: '' },
    { id: 'c3', name: 'شركة الساعة الذهبية للتجارة العامة المحدودة', code: '74002598' }
  ])
  const initialized = useState<boolean>('dbInitializedV2', () => false)
  const { currentUser } = useAuth()

  function normalizeStages(old: any[], vet = false, agri = false): StageEntry[] {
    const fresh = makeStages(vet, agri)
    if (!Array.isArray(old) || !old.length) return fresh
    const byKey = new Map(old.map((s: any) => [s.key, s]))
    return fresh.map(s => {
      const prev: any = byKey.get(s.key)
      return prev ? { ...s, status: prev.status, completedAt: prev.completedAt, completedBy: prev.completedBy, note: prev.note } : s
    })
  }

  function normalizeTransaction(raw: any): Transaction {
    const oldFinance = raw.finance || {}
    const tx: Transaction = {
      id: raw.id || rid('t_'), serial: raw.serial || '', createdAt: raw.createdAt || now(), updatedAt: raw.updatedAt || now(),
      companyId: raw.companyId || '', companyName: raw.companyName || '', companyCode: raw.companyCode || '',
      driverName: raw.driverName || '', vehicleNumber: raw.vehicleNumber || '', goods: raw.goods || '',
      unifiedProcedureNo: raw.unifiedProcedureNo || '', declarationNo: raw.declarationNo || '', notes: raw.notes || '',
      needsVeterinary: !!raw.needsVeterinary, needsAgriculture: !!raw.needsAgriculture,
      stages: normalizeStages(raw.stages, !!raw.needsVeterinary, !!raw.needsAgriculture),
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [], activities: Array.isArray(raw.activities) ? raw.activities : [],
      finance: {
        invoiceValue: Number(oldFinance.invoiceValue || oldFinance.customsValueIqd || 0),
        tax: Number(oldFinance.tax || 0),
        customsFees: Number(oldFinance.customsFees || oldFinance.declarationFee || 0) + Number(oldFinance.otherFees || 0)
      },
      archivedAt: raw.archivedAt,
      deliveredAt: raw.deliveredAt
    }
    const archiveStage = tx.stages.find(s => s.key === 'archive')
    if (!tx.archivedAt && archiveStage?.status === 'done') tx.archivedAt = archiveStage.completedAt || tx.updatedAt
    return tx
  }

  function load() {
    if (!import.meta.client || initialized.value) return
    initialized.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      transactions.value = (data.transactions || []).map(normalizeTransaction)
      companies.value = data.companies || companies.value
      persist()
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
      unifiedProcedureNo: input.unifiedProcedureNo || '', declarationNo: '', notes: input.notes || '',
      needsVeterinary: !!input.needsVeterinary, needsAgriculture: !!input.needsAgriculture,
      stages: makeStages(!!input.needsVeterinary, !!input.needsAgriculture), attachments: [], activities: [],
      finance: { invoiceValue: 0, tax: 0, customsFees: 0 }
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
    if (key === 'archive' && !tx.attachments.some(a => a.category === 'scan')) return 'ارفع ملف السكنر أولاً'
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
      if (key === 'archive') tx.archivedAt = stage.completedAt
      if (key === 'delivery') tx.deliveredAt = stage.completedAt
      addActivity(tx, `إكمال مرحلة: ${stage.label}`, note)
    } else if (status === 'blocked') addActivity(tx, `إيقاف مرحلة: ${stage.label}`, note)
    else addActivity(tx, `تغيير حالة: ${stage.label}`, note)
    persist()
  }

  function currentStage(tx: Transaction) {
    return tx.stages.find(s => s.status === 'active') || tx.stages.find(s => s.status === 'blocked') || tx.stages.find(s => s.status === 'pending') || tx.stages[tx.stages.length - 1]
  }

  function totalFees(tx: Transaction) {
    return Number(tx.finance.tax || 0) + Number(tx.finance.customsFees || 0)
  }

  function archiveGrandTotal(tx: Transaction) {
    return Number(tx.finance.invoiceValue || 0) + Number(tx.finance.tax || 0) + Number(tx.finance.customsFees || 0)
  }

  function completeMany(list: Transaction[], key: string) {
    const completed: Transaction[] = []
    const failed: { tx: Transaction; reason: string }[] = []
    for (const tx of list) {
      const stage = tx.stages.find(s => s.key === key)
      if (!stage || stage.status !== 'active') { failed.push({ tx, reason: 'المعاملة ليست في هذه المرحلة' }); continue }
      const err = canComplete(tx, key)
      if (err) { failed.push({ tx, reason: err }); continue }
      setStage(tx, key, 'done')
      completed.push(tx)
    }
    persist()
    return { completed, failed }
  }

  function addCompany(name: string, code: string) { companies.value.push({ id: rid('c_'), name, code }); persist() }
  function removeCompany(id: string) { companies.value = companies.value.filter(c => c.id !== id); persist() }
  function resetDemo() { transactions.value = []; persist() }

  load()
  return { transactions, companies, create, update, persist, setStage, currentStage, totalFees, archiveGrandTotal, completeMany, canComplete, stageRoleMap, addCompany, removeCompany, resetDemo }
}
