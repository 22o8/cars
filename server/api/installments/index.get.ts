import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { syncInstallments } from '../../utils/installments'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'installments')
  await syncInstallments(prisma)

  return prisma.installment.findMany({
    include: {
      sale: {
        include: {
          customer: true,
          car: true
        }
      }
    },
    orderBy: [
      { status: 'asc' },
      { dueDate: 'asc' },
      { installmentNumber: 'asc' }
    ]
  })
})
