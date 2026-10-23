import type { H3Event } from 'h3'

export async function redisCommand(event: H3Event, command: (string | number)[]) {
  const cfg = useRuntimeConfig(event)
  if (!cfg.redisUrl || !cfg.redisToken) {
    throw createError({ statusCode: 503, statusMessage: 'Cloud queue is not configured. Add Upstash Redis environment variables.' })
  }
  const r = await fetch(String(cfg.redisUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.redisToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(15000)
  })
  if (!r.ok) {
    throw createError({ statusCode: 502, statusMessage: 'تعذر الاتصال بخدمة قائمة الانتظار' })
  }
  const payload = await r.json() as { result?: any; error?: string }
  if (payload.error) throw createError({ statusCode: 502, statusMessage: 'تعذر تنفيذ طلب قائمة الانتظار' })
  return payload.result
}

export async function setJson(event: H3Event, key: string, value: unknown, ttlSeconds = 604800) {
  return redisCommand(event, ['SET', key, JSON.stringify(value), 'EX', ttlSeconds])
}

export async function getJson<T>(event: H3Event, key: string): Promise<T | null> {
  const raw = await redisCommand(event, ['GET', key])
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}
