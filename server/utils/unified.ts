export type UnifiedJobStatus = 'pending' | 'processing' | 'needs_review' | 'cancelling' | 'done' | 'failed' | 'cancelled'
export type UnifiedJobKind = 'execute' | 'test' | 'test_navigation'
export type ReviewDecision = 'dismiss_and_resume' | 'keep_and_stop' | 'resume' | 'stop'

export interface UnifiedReview {
  id: string
  state: string
  title: string
  message: string
  createdAt: string
  screenshotMime?: string
  screenshotAvailable?: boolean
  metadata?: Record<string, any>
  decision?: ReviewDecision
  decisionAt?: string
  resolvedAt?: string
}

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
  screenshotMime?: string
  screenshotAvailable?: boolean
  statusCode?: string
  message?: string
  error?: string
  attempts: number
  cancelRequested?: boolean
  cancelRequestedAt?: string
  deleteAfterCancel?: boolean
  review?: UnifiedReview
  reviewHistory?: UnifiedReview[]
}

export const queueKey = (deviceId: string) => `tarabil:unified:queue:${deviceId}`
export const jobKey = (id: string) => `tarabil:unified:job:${id}`
export const recentKey = 'tarabil:unified:recent'
export const agentSeenKey = (deviceId: string) => `tarabil:agent:lastseen:${deviceId}`
export const finalScreenshotKey = (jobId: string) => `tarabil:unified:final-shot:${jobId}`
export const reviewScreenshotKey = (jobId: string, reviewId: string) => `tarabil:unified:review-shot:${jobId}:${reviewId}`
