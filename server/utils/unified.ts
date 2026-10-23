export type UnifiedJobStatus = 'pending' | 'processing' | 'done' | 'failed'
export type UnifiedJobKind = 'execute' | 'test'

export interface UnifiedCloudJob {
  id: string
  kind: UnifiedJobKind
  status: UnifiedJobStatus
  deviceId: string
  companyCode: string
  companyName?: string
  whatsappNumber: string
  serial?: string
  requestedAt: string
  startedAt?: string
  finishedAt?: string
  unifiedProcedureNo?: string
  whatsappSent?: boolean
  screenshotTaken?: boolean
  screenshotName?: string
  error?: string
  attempts: number
}

export const queueKey = (deviceId: string) => `tarabil:unified:queue:${deviceId}`
export const jobKey = (id: string) => `tarabil:unified:job:${id}`
export const recentKey = 'tarabil:unified:recent'
export const agentSeenKey = (deviceId: string) => `tarabil:agent:lastseen:${deviceId}`
