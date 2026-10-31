import { upsertTransaction } from '../../../utils/sharedState'
export default defineEventHandler(async (event) => {
  const tx = await readBody(event)
  if (!tx?.id) throw createError({ statusCode: 400, statusMessage: 'معرف المعاملة مطلوب' })
  tx.updatedAt = String(tx.updatedAt || new Date().toISOString())
  await upsertTransaction(event, tx)
  return { ok: true, transaction: tx }
})
