import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { audit } from '../../utils/audit'
export default defineEventHandler(async(event)=>{ const user=await requireUser(event); const item=await prisma.backupLog.create({data:{title:`نسخة احتياطية ${new Date().toLocaleDateString('ar-IQ')}`, status:'مسجلة', notes:'تم تسجيل طلب النسخ الاحتياطي. في Vercel/Neon يتم الاعتماد على نسخ قاعدة البيانات من لوحة Neon.'}}); await audit(user.fullName,'إنشاء سجل نسخة احتياطية','BackupLog',item.id,item.title); return item })
