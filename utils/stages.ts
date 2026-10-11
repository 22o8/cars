import type { StageEntry } from '~/types'

export const baseStageDefs = [
  ['created', 'إنشاء المعاملة'],
  ['unified', 'رقم الإجراء الموحد'],
  ['asycuda', 'السكودة / ASYCUDA'],
  ['inspection', 'الكشف والتواقيع'],
  ['customs', 'الأمور الكمركية'],
  ['radiation', 'الإشعاعي'],
  ['audit', 'التدقيق'],
  ['cashier', 'الصندوق'],
  ['completion', 'الإنجاز'],
  ['computer', 'الحاسبة'],
  ['transport', 'النقل البري'],
  ['manifest', 'المانيفست'],
  ['archive', 'التفريغ والأرشفة'],
  ['delivery', 'التسليم للسائق']
] as const

export function makeStages(vet = false, agri = false): StageEntry[] {
  const list = baseStageDefs.map(([key, label], idx) => ({
    key,
    label,
    status: idx === 0 ? 'done' : idx === 1 ? 'active' : 'pending'
  } as StageEntry))
  const radiationIndex = list.findIndex(s => s.key === 'radiation')
  const extras: StageEntry[] = []
  if (vet) extras.push({ key: 'veterinary', label: 'فحص البيطرة', status: 'pending' })
  if (agri) extras.push({ key: 'agriculture', label: 'فحص الزراعة', status: 'pending' })
  list.splice(radiationIndex + 1, 0, ...extras)
  return list
}

export const stageRoleMap: Record<string, string[]> = {
  unified: ['admin', 'asycuda'],
  asycuda: ['admin', 'asycuda'],
  inspection: ['admin', 'inspection'],
  customs: ['admin', 'customs'],
  radiation: ['admin', 'radiation'],
  veterinary: ['admin', 'inspection'],
  agriculture: ['admin', 'inspection'],
  audit: ['admin', 'audit'],
  cashier: ['admin', 'cashier'],
  completion: ['admin', 'completion'],
  computer: ['admin', 'computer'],
  transport: ['admin', 'transport'],
  manifest: ['admin', 'transport'],
  archive: ['admin', 'archive'],
  delivery: ['admin', 'delivery']
}
