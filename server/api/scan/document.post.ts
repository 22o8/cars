import { z } from 'zod'
import { requirePermission } from '../../utils/auth'

const schema = z.object({
  type: z.enum(['car','customer']),
  frontImage: z.string().optional().default(''),
  backImage: z.string().optional().default(''),
  barcodeText: z.string().optional().default('')
})

function safeJson(text: string) {
  const cleaned = String(text || '').trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim()
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (!m) return {}
  try { return JSON.parse(m[0]) } catch { return {} }
}

function sanitizeFields(type: 'car'|'customer', input: any) {
  const allowed = type === 'car'
    ? ['brand','model','year','color','plateNumber','vinNumber','mileage','description']
    : ['fullName','nationalId','phone','phone2','address','notes']
  const out: Record<string, string> = {}
  for (const key of allowed) {
    const value = input?.[key]
    if (value !== undefined && value !== null && String(value).trim()) out[key] = String(value).trim()
  }
  return out
}

export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  await requirePermission(event, body.type === 'car' ? 'cars' : 'customers')

  const config = useRuntimeConfig()
  const apiKey = process.env.OPENAI_API_KEY || (config as any).openaiApiKey
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini'

  if (!apiKey) {
    return {
      usedAI: false,
      message: 'لم يتم ربط AI Vision بعد. تم حفظ الصور ومحاولة قراءة الرمز فقط. أضف OPENAI_API_KEY لقراءة النصوص بدقة أعلى.',
      fields: {},
      rawText: body.barcodeText || ''
    }
  }

  const prompt = body.type === 'car'
    ? `اقرأ صور سنوية/إجازة تسجيل مركبة عراقية من الوجه والظهر. استخرج فقط البيانات المتاحة بدون تخمين. أعد JSON فقط بهذه المفاتيح: brand, model, year, color, plateNumber, vinNumber, mileage, description. إذا لم يظهر حقل اتركه فارغاً. ضع النص المهم غير المصنف في description.`
    : `اقرأ صور بطاقة/هوية عراقية من الوجه والظهر. استخرج فقط البيانات المتاحة بدون تخمين. أعد JSON فقط بهذه المفاتيح: fullName, nationalId, phone, phone2, address, notes. إذا لم يظهر حقل اتركه فارغاً. ضع النص المهم غير المصنف في notes.`

  const content: any[] = [{ type: 'input_text', text: `${prompt}\nنص رمز مقروء إن وجد:\n${body.barcodeText || ''}` }]
  if (body.frontImage) content.push({ type: 'input_image', image_url: body.frontImage })
  if (body.backImage) content.push({ type: 'input_image', image_url: body.backImage })

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: [{ role: 'user', content }], temperature: 0 })
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw createError({ statusCode: 502, message: `فشل AI Vision: ${txt.slice(0, 220)}` })
    }
    const data: any = await res.json()
    const outputText = data.output_text || data.output?.flatMap((o:any)=>o.content || []).map((c:any)=>c.text || '').join('\n') || ''
    const parsed = safeJson(outputText)
    return { usedAI: true, message: 'تم تحليل الصور بالذكاء الاصطناعي. راجع الحقول قبل الحفظ.', fields: sanitizeFields(body.type, parsed), rawText: outputText }
  } catch (e: any) {
    return { usedAI: false, message: e?.message || 'تعذر تحليل الصور بالذكاء الاصطناعي حالياً.', fields: {}, rawText: body.barcodeText || '' }
  }
})
