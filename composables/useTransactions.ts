import type { Company, Transaction, Activity, StageStatus, StageEntry } from '~/types'
import { makeStages, stageRoleMap } from '~/utils/stages'

const STORAGE_KEY = 'tarabil.customs.v5.cloud'
const OLD_STORAGE_KEYS = ['tarabil.customs.v4', 'tarabil.customs.v2', 'tarabil.customs.v1']
const DEFAULT_COMPANIES: Company[] = [
  { id: 'c1', name: 'شركة لميس لصناعة المنظفات', code: '' },
  { id: 'c2', name: 'شركة عين الفرات للتجارة العامة والنقل العام', code: '' },
  { id: 'c3', name: 'شركة الساعة الذهبية للتجارة العامة المحدودة', code: '74002598' }
]

function now() { return new Date().toISOString() }
function rid(prefix = '') { return prefix + Math.random().toString(36).slice(2, 10) }

export function useTransactions() {
  const transactions = useState<Transaction[]>('transactions', () => [])
  const companies = useState<Company[]>('companies', () => DEFAULT_COMPANIES.map(c => ({ ...c })))
  const initialized = useState<boolean>('dbInitializedV5', () => false)
  const cloudStarted = useState<boolean>('cloudSyncStartedV1', () => false)
  const cloudRevision = useState<number>('cloudRevisionV1', () => -1)
  const syncStatus = useState<'idle'|'syncing'|'online'|'offline'|'error'>('cloudSyncStatusV1', () => 'idle')
  const lastSyncAt = useState<string>('cloudLastSyncAtV1', () => '')
  const writeCount = useState<number>('cloudWriteCountV1', () => 0)
  const { currentUser } = useAuth()

  function normalizeStages(old: any[], vet = false, agri = false): StageEntry[] {
    const fresh = makeStages(vet, agri)
    if (!Array.isArray(old) || !old.length) return fresh
    const byKey = new Map(old.map((s: any) => [s.key, s]))
    return fresh.map((s, index) => {
      const prev: any = byKey.get(s.key)
      if (prev) return { ...s, status: prev.status, completedAt: prev.completedAt, completedBy: prev.completedBy, note: prev.note }
      const laterKeys = fresh.slice(index + 1).map(x => x.key)
      const passed = old.some((x: any) => laterKeys.includes(x.key) && ['active','done','blocked'].includes(x.status))
      return passed ? { ...s, status: 'done', completedAt: rawDateFromOld(old), completedBy: 'ترحيل النظام' } : s
    })
  }

  function rawDateFromOld(old: any[]) { return old.find((s:any)=>s.completedAt)?.completedAt || now() }

  function normalizeTransaction(raw: any): Transaction {
    const oldFinance = raw.finance || {}
    const tx: Transaction = {
      id: raw.id || rid('t_'), serial: raw.serial || '', createdAt: raw.createdAt || now(), updatedAt: raw.updatedAt || now(),
      companyId: raw.companyId || '', companyName: raw.companyName || '', companyCode: raw.companyCode || '',
      driverName: raw.driverName || '', vehicleNumber: raw.vehicleNumber || '', goods: raw.goods || '',
      unifiedProcedureNo: raw.unifiedProcedureNo || '', declarationNo: raw.declarationNo || '', notes: raw.notes || '',
      needsVeterinary: !!raw.needsVeterinary, needsAgriculture: !!raw.needsAgriculture,
      stages: normalizeStages(raw.stages, !!raw.needsVeterinary, !!raw.needsAgriculture),
      attachments: Array.isArray(raw.attachments) ? raw.attachments.map((a:any) => ({ ...a, stageKey: a.stageKey || (a.category === 'scan' ? 'archive' : undefined), category: a.category === 'scan' ? 'archive-scan' : a.category })) : [],
      activities: Array.isArray(raw.activities) ? raw.activities : [],
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

  function normalizeCompany(raw: any): Company {
    return { id: String(raw?.id || rid('c_')), name: String(raw?.name || ''), code: String(raw?.code || ''), notes: raw?.notes, updatedAt: raw?.updatedAt || now() }
  }

  function saveLocal() {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions: transactions.value, companies: companies.value }))
  }

  function loadLocal() {
    if (!import.meta.client || initialized.value) return
    initialized.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || OLD_STORAGE_KEYS.map(k => localStorage.getItem(k)).find(Boolean)
      if (!raw) return
      const data = JSON.parse(raw)
      transactions.value = (data.transactions || []).map(normalizeTransaction)
      companies.value = (data.companies || companies.value).map(normalizeCompany)
      saveLocal()
    } catch {}
  }

  async function cloudWrite<T>(fn: () => Promise<T>) {
    if (!import.meta.client) return undefined
    writeCount.value++
    syncStatus.value = 'syncing'
    try {
      const result = await fn()
      syncStatus.value = 'online'
      lastSyncAt.value = now()
      return result
    } catch (e) {
      syncStatus.value = navigator.onLine ? 'error' : 'offline'
      console.warn('[Tarabil Sync] write failed', e)
      return undefined
    } finally { writeCount.value = Math.max(0, writeCount.value - 1) }
  }

  async function pushCompany(company: Company) {
    if (!import.meta.client) return
    const w = window as any
    w.__tarabilCompanyWriteQueues ||= {}
    const payload = JSON.parse(JSON.stringify(company))
    const previous: Promise<any> = w.__tarabilCompanyWriteQueues[company.id] || Promise.resolve()
    const task = previous.catch(()=>{}).then(() => cloudWrite(() => $fetch('/api/sync/company', { method:'POST', body:payload })))
    w.__tarabilCompanyWriteQueues[company.id] = task
    await task
  }

  async function pushTransaction(tx: Transaction) {
    if (!import.meta.client) return
    const w = window as any
    w.__tarabilTxWriteQueues ||= {}
    const payload = JSON.parse(JSON.stringify(tx))
    const previous: Promise<any> = w.__tarabilTxWriteQueues[tx.id] || Promise.resolve()
    const task = previous.catch(()=>{}).then(() => cloudWrite(() => $fetch('/api/sync/transaction', { method:'POST', body:payload })))
    w.__tarabilTxWriteQueues[tx.id] = task
    await task
  }

  async function pullCloud(force = false) {
    if (!import.meta.client || writeCount.value > 0) return
    try {
      if (!force && cloudRevision.value >= 0) {
        const rr:any = await $fetch('/api/sync/revision', { cache: 'no-store' as any })
        const revision = Number(rr?.revision || 0)
        if (revision === cloudRevision.value) {
          syncStatus.value = 'online'; lastSyncAt.value = now(); return
        }
      }
      syncStatus.value = 'syncing'
      const data:any = await $fetch('/api/sync/state', { cache: 'no-store' as any })
      const remoteCompanies = Array.isArray(data?.companies) ? data.companies.map(normalizeCompany) : []
      const remoteTransactions = Array.isArray(data?.transactions) ? data.transactions.map(normalizeTransaction) : []
      companies.value = remoteCompanies.sort((a:Company,b:Company)=>a.name.localeCompare(b.name,'ar'))
      transactions.value = remoteTransactions.sort((a:Transaction,b:Transaction)=>b.createdAt.localeCompare(a.createdAt))
      cloudRevision.value = Number(data?.revision || 0)
      saveLocal()
      syncStatus.value = 'online'
      lastSyncAt.value = now()
    } catch (e) {
      syncStatus.value = navigator.onLine ? 'error' : 'offline'
      console.warn('[Tarabil Sync] pull failed', e)
    }
  }

  async function bootstrapCloud() {
    if (!import.meta.client) return
    try {
      syncStatus.value = 'syncing'
      const data:any = await $fetch('/api/sync/bootstrap', { method: 'POST', body: { companies: companies.value, transactions: transactions.value } })
      if (Array.isArray(data?.companies) && data.companies.length) companies.value = data.companies.map(normalizeCompany).sort((a:Company,b:Company)=>a.name.localeCompare(b.name,'ar'))
      if (Array.isArray(data?.transactions)) transactions.value = data.transactions.map(normalizeTransaction).sort((a:Transaction,b:Transaction)=>b.createdAt.localeCompare(a.createdAt))
      cloudRevision.value = Number(data?.revision || 0)
      saveLocal(); syncStatus.value = 'online'; lastSyncAt.value = now()
    } catch (e) {
      syncStatus.value = navigator.onLine ? 'error' : 'offline'
      console.warn('[Tarabil Sync] bootstrap failed', e)
    }
  }

  function startCloudSync() {
    if (!import.meta.client || cloudStarted.value) return
    cloudStarted.value = true
    void bootstrapCloud()
    const w = window as any
    if (!w.__tarabilCloudSyncTimer) w.__tarabilCloudSyncTimer = setInterval(() => { void pullCloud(false) }, 1500)
    window.addEventListener('focus', () => { void pullCloud(true) })
    window.addEventListener('online', () => { void pullCloud(true) })
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void pullCloud(true) })
  }

  // Compatibility helper. For transaction changes pass the transaction so only that record is synced.
  function persist(tx?: Transaction) {
    saveLocal()
    if (tx) { tx.updatedAt = now(); void pushTransaction(tx) }
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
    transactions.value.unshift(tx); saveLocal(); void pushTransaction(tx)
    return tx
  }

  function update(tx: Transaction, action = 'تحديث بيانات المعاملة') {
    addActivity(tx, action); saveLocal(); void pushTransaction(tx)
  }

  function canComplete(tx: Transaction, key: string) {
    if (key === 'unified' && !tx.unifiedProcedureNo.trim()) return 'أدخل رقم الإجراء الموحد أولاً'
    if (key === 'asycuda' && !tx.declarationNo.trim()) return 'أدخل رقم البيان أولاً'
    if (key === 'archive' && !tx.attachments.some(a => a.category === 'archive-scan')) return 'ارفع سكنر الأرشفة أولاً'
    return ''
  }

  function setStage(tx: Transaction, key: string, status: StageStatus, note = '') {
    const stage = tx.stages.find(s => s.key === key)
    if (!stage) return
    stage.status = status; stage.note = note
    if (status === 'done') {
      stage.completedAt = now(); stage.completedBy = currentUser.value.name
      const idx = tx.stages.findIndex(s => s.key === key); const next = tx.stages[idx + 1]
      if (next && next.status === 'pending') next.status = 'active'
      if (key === 'archive') tx.archivedAt = stage.completedAt
      if (key === 'delivery') tx.deliveredAt = stage.completedAt
      addActivity(tx, `إكمال مرحلة: ${stage.label}`, note)
    } else if (status === 'blocked') addActivity(tx, `إيقاف مرحلة: ${stage.label}`, note)
    else addActivity(tx, `تغيير حالة: ${stage.label}`, note)
    tx.updatedAt = now(); saveLocal(); void pushTransaction(tx)
  }

  function currentStage(tx: Transaction) { return tx.stages.find(s => s.status === 'active') || tx.stages.find(s => s.status === 'blocked') || tx.stages.find(s => s.status === 'pending') || tx.stages[tx.stages.length - 1] }
  function totalFees(tx: Transaction) { return Number(tx.finance.tax || 0) + Number(tx.finance.customsFees || 0) }
  function archiveGrandTotal(tx: Transaction) { return Number(tx.finance.invoiceValue || 0) + Number(tx.finance.tax || 0) + Number(tx.finance.customsFees || 0) }

  function completeMany(list: Transaction[], key: string) {
    const completed: Transaction[] = [], failed: { tx: Transaction; reason: string }[] = []
    for (const tx of list) {
      const stage = tx.stages.find(s => s.key === key)
      if (!stage || stage.status !== 'active') { failed.push({ tx, reason: 'المعاملة ليست في هذه المرحلة' }); continue }
      const err = canComplete(tx, key); if (err) { failed.push({ tx, reason: err }); continue }
      setStage(tx, key, 'done'); completed.push(tx)
    }
    saveLocal(); return { completed, failed }
  }

  function addCompany(name: string, code: string) {
    const company: Company = { id: rid('c_'), name, code, updatedAt: now() }
    companies.value.push(company); saveLocal(); void pushCompany(company); return company
  }

  function updateCompany(company: Company) {
    company.name = String(company.name || '').trim(); company.code = String(company.code || '').trim(); company.updatedAt = now()
    saveLocal(); void pushCompany(company)
  }

  function removeCompany(id: string) {
    companies.value = companies.value.filter(c => c.id !== id); saveLocal()
    void cloudWrite(() => $fetch(`/api/sync/company/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  }

  function resetDemo() {
    transactions.value = []; saveLocal()
    void cloudWrite(() => $fetch('/api/sync/transactions-reset', { method: 'POST' }))
  }

  loadLocal(); startCloudSync()
  return {
    transactions, companies, create, update, persist, setStage, currentStage, totalFees, archiveGrandTotal,
    completeMany, canComplete, stageRoleMap, addCompany, updateCompany, removeCompany, resetDemo,
    syncStatus, lastSyncAt, refreshCloud: () => pullCloud(true)
  }
}
