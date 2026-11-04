import { timingSafeEqual } from 'node:crypto'
export default defineEventHandler(event => {
  const cfg=useRuntimeConfig(event)
  const q=getQuery(event)
  const expected=String(cfg.whatsappVerifyToken || '')
  const actual=String(q['hub.verify_token'] || '')
  if (!expected || q['hub.mode']!=='subscribe' || Buffer.byteLength(expected)!==Buffer.byteLength(actual) || !timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))
    throw createError({statusCode:403,statusMessage:'verification failed'})
  setHeader(event,'Content-Type','text/plain')
  return String(q['hub.challenge'] || '')
})
