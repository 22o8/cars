import { getSharedState, upsertCompany, upsertTransaction } from '../../utils/sharedState'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const companies = Array.isArray(body?.companies) ? body.companies.slice(0, 1000) : []
  const transactions = Array.isArray(body?.transactions) ? body.transactions.slice(0, 5000) : []
  for (const company of companies) await upsertCompany(event, company, true)
  for (const tx of transactions) await upsertTransaction(event, tx, true)
  return { ok: true, ...(await getSharedState(event)) }
})
