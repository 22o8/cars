type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function clientIp(event: any) {
  return getRequestIP(event, { xForwardedFor: true }) || event.node?.req?.socket?.remoteAddress || 'unknown'
}

export function assertRateLimit(event: any, key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now()
  const id = `${clientIp(event)}:${key}`
  const current = buckets.get(id)
  if (!current || current.resetAt < now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs })
    return
  }
  current.count += 1
  if (current.count > limit) {
    const seconds = Math.ceil((current.resetAt - now) / 1000)
    throw createError({ statusCode: 429, message: `طلبات كثيرة، حاول بعد ${seconds} ثانية` })
  }
  buckets.set(id, current)
}
