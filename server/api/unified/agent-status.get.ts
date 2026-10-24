import { redisCommand } from '../../utils/redis'
import { requireMobilePin } from '../../utils/security'
import { agentSeenKey } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')
  requireMobilePin(event)
  const cfg = useRuntimeConfig(event)
  const deviceId = String(cfg.agentDeviceId || 'asycuda-office-1')
  const raw = await redisCommand(event, ['GET', agentSeenKey(deviceId)])
  const metaRaw = await redisCommand(event, ['GET', `${agentSeenKey(deviceId)}:meta`])
  const lastSeen = raw ? String(raw) : ''
  const age = lastSeen ? Date.now() - new Date(lastSeen).getTime() : Number.POSITIVE_INFINITY
  const online = Number.isFinite(age) && age >= 0 && age < 45000
  let meta:any = {}
  try { meta = metaRaw ? JSON.parse(String(metaRaw)) : {} } catch {}
  return { ok: true, deviceId, lastSeen, online, state: online ? 'ONLINE' : 'OFFLINE', version: meta.version || '', capabilities: meta.capabilities || [] }
})
