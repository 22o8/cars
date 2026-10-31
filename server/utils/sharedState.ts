import type { H3Event } from 'h3'
import { redisCommand } from './redis'

export const companiesHashKey = 'tarabil:shared:companies:v1'
export const transactionsHashKey = 'tarabil:shared:transactions:v1'
export const revisionKey = 'tarabil:shared:revision:v1'

function decodeHash(raw: any): Record<string, string> {
  if (!raw) return {}
  if (Array.isArray(raw)) {
    const out: Record<string, string> = {}
    for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1])
    return out
  }
  if (typeof raw === 'object') return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]))
  return {}
}

function parseValues<T>(raw: any): T[] {
  const hash = decodeHash(raw)
  const list: T[] = []
  for (const value of Object.values(hash)) {
    try { list.push(JSON.parse(value) as T) } catch {}
  }
  return list
}

export async function getSharedState(event: H3Event) {
  const [companiesRaw, transactionsRaw, revisionRaw] = await Promise.all([
    redisCommand(event, ['HGETALL', companiesHashKey]),
    redisCommand(event, ['HGETALL', transactionsHashKey]),
    redisCommand(event, ['GET', revisionKey])
  ])
  return {
    revision: Number(revisionRaw || 0),
    companies: parseValues<any>(companiesRaw),
    transactions: parseValues<any>(transactionsRaw)
  }
}

export async function bumpRevision(event: H3Event) {
  return Number(await redisCommand(event, ['INCR', revisionKey]) || 0)
}

export async function upsertCompany(event: H3Event, company: any, onlyIfMissing = false) {
  if (!company?.id) return false
  const cmd = onlyIfMissing
    ? ['HSETNX', companiesHashKey, String(company.id), JSON.stringify(company)]
    : ['HSET', companiesHashKey, String(company.id), JSON.stringify(company)]
  const result = await redisCommand(event, cmd)
  if (!onlyIfMissing || Number(result || 0) > 0) await bumpRevision(event)
  return true
}

export async function upsertTransaction(event: H3Event, tx: any, onlyIfMissing = false) {
  if (!tx?.id) return false
  const cmd = onlyIfMissing
    ? ['HSETNX', transactionsHashKey, String(tx.id), JSON.stringify(tx)]
    : ['HSET', transactionsHashKey, String(tx.id), JSON.stringify(tx)]
  const result = await redisCommand(event, cmd)
  if (!onlyIfMissing || Number(result || 0) > 0) await bumpRevision(event)
  return true
}
