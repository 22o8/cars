import type { PrismaClient } from '@prisma/client'

export async function syncInstallments(prisma: PrismaClient) {
  let created = 0
  let updatedSales = 0
  const now = new Date()

  const sales = await prisma.sale.findMany({
    include: {
      installments: true,
      payments: true,
      invoices: true,
      customer: true,
      car: true
    }
  })

  for (const sale of sales) {
    const salePrice = Number(sale.salePrice || 0)
    const paymentsTotal = sale.payments.reduce((a, p) => a + Number(p.amount || 0), 0)
    const storedPaid = Number(sale.paidAmount || 0)
    const effectivePaid = Math.max(storedPaid, paymentsTotal)
    const remaining = Math.max(salePrice - effectivePaid, 0)

    if (Math.abs(Number(sale.remainingAmount || 0) - remaining) > 0.01 || Math.abs(storedPaid - effectivePaid) > 0.01) {
      await prisma.sale.update({ where: { id: sale.id }, data: { paidAmount: effectivePaid, remainingAmount: remaining } })
      updatedSales++
    }

    const isInstallmentSale = sale.saleType === 'INSTALLMENT' || sale.saleType === 'TRADE_IN' || remaining > 0
    if (!isInstallmentSale || remaining <= 0 || sale.installments.length > 0) continue

    await prisma.installment.create({
      data: {
        saleId: sale.id,
        installmentNumber: 1,
        amount: remaining,
        paidAmount: 0,
        dueDate: now,
        status: 'PENDING'
      }
    })
    created++
  }

  await prisma.installment.updateMany({
    where: { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now } },
    data: { status: 'LATE' }
  })

  return { created, updatedSales }
}
