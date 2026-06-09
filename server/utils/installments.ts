import type { PrismaClient } from '@prisma/client'
import { n, roundMoney } from './money'

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(base.getDate() + days)
  return d
}

function calcInstallmentStatus(amount: number, paidAmount: number, dueDate: Date) {
  if (paidAmount >= amount) return 'PAID'
  if (paidAmount > 0) return 'PARTIAL'
  return dueDate < new Date() ? 'LATE' : 'PENDING'
}

export async function syncInstallments(prisma: PrismaClient) {
  let created = 0
  let updatedSales = 0
  let updatedInstallments = 0
  const now = new Date()

  const sales = await prisma.sale.findMany({
    include: {
      installments: { orderBy: { installmentNumber: 'asc' } },
      payments: true,
      invoices: true,
      customer: true,
      car: true
    }
  })

  for (const sale of sales) {
    const salePrice = roundMoney(n(sale.salePrice))
    const paymentsTotal = roundMoney(sale.payments.reduce((a, p) => a + n(p.amount), 0))
    const effectivePaid = Math.min(salePrice, Math.max(n(sale.paidAmount), paymentsTotal))
    const remaining = roundMoney(Math.max(salePrice - effectivePaid, 0))

    if (Math.abs(n(sale.remainingAmount) - remaining) > 0.01 || Math.abs(n(sale.paidAmount) - effectivePaid) > 0.01) {
      await prisma.sale.update({ where: { id: sale.id }, data: { paidAmount: effectivePaid, remainingAmount: remaining } })
      updatedSales++
    }

    // Keep installment statuses accurate on every page load.
    for (const installment of sale.installments) {
      const amount = n(installment.amount)
      const paidAmount = n(installment.paidAmount)
      const expectedStatus = calcInstallmentStatus(amount, paidAmount, installment.dueDate) as any
      const expectedPaidDate = expectedStatus === 'PAID' ? (installment.paidDate || new Date()) : null
      if (installment.status !== expectedStatus || String(installment.paidDate || '') !== String(expectedPaidDate || '')) {
        await prisma.installment.update({ where: { id: installment.id }, data: { status: expectedStatus, paidDate: expectedPaidDate } })
        updatedInstallments++
      }
    }

    const shouldHaveInstallments = remaining > 0 && (sale.saleType === 'INSTALLMENT' || sale.saleType === 'TRADE_IN' || sale.installments.length > 0)
    if (!shouldHaveInstallments) continue

    const openInstallments = sale.installments.filter(i => i.status !== 'PAID')
    const openRemaining = roundMoney(openInstallments.reduce((a, i) => a + Math.max(n(i.amount) - n(i.paidAmount), 0), 0))
    const diff = roundMoney(remaining - openRemaining)

    if (sale.installments.length === 0) {
      await prisma.installment.create({
        data: {
          saleId: sale.id,
          installmentNumber: 1,
          amount: remaining,
          paidAmount: 0,
          dueDate: now,
          status: 'LATE'
        }
      })
      created++
      continue
    }

    if (Math.abs(diff) > 0.01) {
      const lastOpen = openInstallments[openInstallments.length - 1]
      if (lastOpen) {
        const newAmount = roundMoney(Math.max(n(lastOpen.paidAmount), n(lastOpen.amount) + diff))
        await prisma.installment.update({
          where: { id: lastOpen.id },
          data: {
            amount: newAmount,
            status: calcInstallmentStatus(newAmount, n(lastOpen.paidAmount), lastOpen.dueDate) as any
          }
        })
        updatedInstallments++
      } else if (remaining > 0) {
        await prisma.installment.create({
          data: {
            saleId: sale.id,
            installmentNumber: sale.installments.length + 1,
            amount: remaining,
            paidAmount: 0,
            dueDate: addDays(now, 30),
            status: 'PENDING'
          }
        })
        created++
      }
    }
  }

  return { created, updatedSales, updatedInstallments }
}
