import { redisCommand } from '../../utils/redis'
import { requireMobilePin } from '../../utils/security'
import { agentSeenKey } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const cfg = useRuntimeConfig(event)
  const deviceId = String(cfg.agentDeviceId || 'asycuda-office-1')
  const raw = await redisCommand(event, ['GET', agentSeenKey(deviceId)])
  const lastSeen = raw ? String(raw) : ''
  const age = lastSeen ? Date.now() - new Date(lastSeen).getTime() : Number.POSITIVE_INFINITY
  return { ok: true, deviceId, lastSeen, online: Number.isFinite(age) && age < 15000 }
})
