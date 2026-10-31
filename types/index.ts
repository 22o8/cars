export type StageStatus = 'pending' | 'active' | 'done' | 'blocked'
export type Role = 'admin' | 'unified' | 'asycuda' | 'inspection' | 'customs' | 'checks' | 'audit' | 'cashier' | 'completion' | 'computer' | 'transport' | 'archive' | 'delivery' | 'viewer'

export interface Company { id: string; name: string; code: string; notes?: string; updatedAt?: string }
export interface User { id: string; name: string; role: Role; active: boolean }
export interface Attachment {
  id: string
  name: string
  mime: string
  size: number
  category: 'stage-scan' | 'archive-scan' | 'merged' | string
  stageKey?: string
  createdAt: string
  uploadedBy: string
}
export interface Activity { id: string; at: string; userId: string; userName: string; action: string; details?: string }
export interface StageEntry { key: string; label: string; status: StageStatus; completedAt?: string; completedBy?: string; note?: string }

export interface Finance {
  invoiceValue: number
  tax: number
  customsFees: number
}

export interface Transaction {
  id: string
  serial: string
  createdAt: string
  updatedAt: string
  companyId: string
  companyName: string
  companyCode: string
  driverName: string
  vehicleNumber: string
  goods: string
  unifiedProcedureNo: string
  declarationNo: string
  notes: string
  needsVeterinary: boolean
  needsAgriculture: boolean
  stages: StageEntry[]
  attachments: Attachment[]
  activities: Activity[]
  finance: Finance
  archivedAt?: string
  deliveredAt?: string
}
