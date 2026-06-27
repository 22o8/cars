import type { PrismaClient } from '@prisma/client'

export function n(value: any): number {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num : 0
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export async function getUsdRate(prisma: PrismaClient): Promise<number> {
  await prisma.dealerSetting.upsert({
    where: { id: 1 },
    update: { usdToIqdRate: 1 },
    create: { id: 1, dealerName: 'AutoDealer Pro', usdToIqdRate: 1 }
  })
  return 1
}

export function toIqd(amount: any, currency: string | null | undefined, usdRate: number): number {
  return n(amount)
}

export function sumIqd(items: any[], amountKey: string, usdRate: number, filter?: (item: any) => boolean): number {
  return roundMoney(items.reduce((total, item) => {
    if (filter && !filter(item)) return total
    return total + n(item?.[amountKey])
  }, 0))
}
