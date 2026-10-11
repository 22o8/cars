import type { StageEntry } from '~/types'

export const baseStageDefs = [
  ['created', 'إنشاء المعاملة'],
  ['unified', 'رقم الإجراء الموحد'],
  ['asycuda', 'السكودة'],
  ['inspection', 'الكشف والتواقيع'],
  ['customs', 'الأمور الكمركية'],
  ['audit', 'التدقيق'],
  ['cashier', 'الصندوق'],
  ['completion', 'الإنجاز'],
  ['computer', 'الحاسبة'],
  ['transport', 'النقل البري'],
  ['archive', 'التفريغ والأرشفة'],
  ['delivery', 'التسليم']
] as const

export const workStageDefs = baseStageDefs.filter(([key]) => !['created'].includes(key))

export function makeStages(vet = false, agri = false): StageEntry[] {
  const list = baseStageDefs.map(([key, label], idx) => ({
    key, label, status: idx === 0 ? 'done' : idx === 1 ? 'active' : 'pending'
  } as StageEntry))
  const customsIndex = list.findIndex(s => s.key === 'customs')
  const extras: StageEntry[] = []
  if (vet) extras.push({ key: 'veterinary', label: 'فحص البيطرة', status: 'pending' })
  if (agri) extras.push({ key: 'agriculture', label: 'فحص الزراعة', status: 'pending' })
  list.splice(customsIndex + 1, 0, ...extras)
  return list
}

export const stageRoleMap: Record<string, string[]> = {
  unified: ['admin', 'asycuda'],
  asycuda: ['admin', 'asycuda'],
  inspection: ['admin', 'inspection'],
  customs: ['admin', 'customs'],
  veterinary: ['admin', 'inspection'],
  agriculture: ['admin', 'inspection'],
  audit: ['admin', 'audit'],
  cashier: ['admin', 'cashier'],
  completion: ['admin', 'completion'],
  computer: ['admin', 'computer'],
  transport: ['admin', 'transport'],
  archive: ['admin', 'archive'],
  delivery: ['admin', 'delivery']
}
