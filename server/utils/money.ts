import type { PrismaClient } from '@prisma/client'

export function n(value: any): number {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num : 0
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export async function getUsdRate(prisma: PrismaClient): Promise<number> {
  const setting = await prisma.dealerSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, dealerName: 'AutoDealer Pro' }
  })
  const rate = n(setting.usdToIqdRate)
  return rate > 0 ? rate : 1310
}

export function toIqd(amount: any, currency: string | null | undefined, usdRate: number): number {
  const value = n(amount)
  return currency === 'USD' ? value * usdRate : value
}

export function sumIqd(items: any[], amountKey: string, usdRate: number, filter?: (item: any) => boolean): number {
  return roundMoney(items.reduce((total, item) => {
    if (filter && !filter(item)) return total
    return total + toIqd(item?.[amountKey], item?.currency, usdRate)
  }, 0))
}
