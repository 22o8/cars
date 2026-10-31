import { upsertCompany } from '../../../utils/sharedState'
export default defineEventHandler(async (event) => {
  const company = await readBody(event)
  if (!company?.id || !String(company?.name || '').trim()) throw createError({ statusCode: 400, statusMessage: 'بيانات الشركة غير مكتملة' })
  company.name = String(company.name).trim().slice(0, 220)
  company.code = String(company.code || '').trim().slice(0, 40)
  company.updatedAt = String(company.updatedAt || new Date().toISOString())
  await upsertCompany(event, company)
  return { ok: true, company }
})
