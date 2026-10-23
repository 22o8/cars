export type UnifiedJobStatus = 'pending' | 'processing' | 'done' | 'failed'
export type UnifiedJobMode = 'create' | 'test'
export interface UnifiedCloudJob {
  id: string
  status: UnifiedJobStatus
  mode: UnifiedJobMode
  deviceId: string
  companyCode?: string
  companyName?: string
  whatsappNumber?: string
  serial?: string
  requestedAt: string
  startedAt?: string
  finishedAt?: string
  unifiedProcedureNo?: string
  whatsappSent?: boolean
  screenshotCaptured?: boolean
  error?: string
  attempts: number
}

export const queueKey = (deviceId: string) => `tarabil:unified:queue:${deviceId}`
export const jobKey = (id: string) => `tarabil:unified:job:${id}`
export const recentKey = 'tarabil:unified:recent'
export const agentSeenKey = (deviceId: string) => `tarabil:agent:lastseen:${deviceId}`
