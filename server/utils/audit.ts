import { prisma } from './db'
export async function audit(userName: string, action: string, entity: string, entityId?: string, details?: string) {
  await prisma.auditLog.create({ data: { userName, action, entity, entityId, details } }).catch(() => {})
}
