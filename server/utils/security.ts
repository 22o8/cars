import type { H3Event } from 'h3'

export function requireMobilePin(event: H3Event) {
  const cfg = useRuntimeConfig(event)
  const expected = String(cfg.mobilePin || '')
  if (!expected) throw createError({ statusCode: 503, statusMessage: 'TARABIL_MOBILE_PIN is not configured.' })
  const received = String(getHeader(event, 'x-tarabil-mobile-pin') || '')
  if (!received || received !== expected) throw createError({ statusCode: 401, statusMessage: 'رمز دخول الهاتف غير صحيح.' })
}

export function requireAgent(event: H3Event) {
  const cfg = useRuntimeConfig(event)
  const expectedId = String(cfg.agentDeviceId || '')
  const expectedToken = String(cfg.agentDeviceToken || '')
  if (!expectedId || !expectedToken) throw createError({ statusCode: 503, statusMessage: 'Agent credentials are not configured.' })
  const deviceId = String(getHeader(event, 'x-tarabil-device-id') || '')
  const auth = String(getHeader(event, 'authorization') || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (deviceId !== expectedId || token !== expectedToken) throw createError({ statusCode: 401, statusMessage: 'agent unauthorized' })
  return deviceId
}
