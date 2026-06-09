import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../utils/db'
import { requireUser, userPermissions } from '../utils/auth'
import { audit } from '../utils/audit'
const schema=z.object({fullName:z.string().min(1).optional(), username:z.string().trim().min(1).max(60).regex(/^[\p{L}\p{N}_.@-]+$/u).optional(), password:z.string().min(6).max(160).optional().or(z.literal('')), profileImage:z.string().nullable().optional()})
export default defineEventHandler(async(event)=>{ const user=await requireUser(event); const b=schema.parse(await readBody(event)); const data:any={}; if(b.fullName!==undefined)data.fullName=b.fullName; if(b.username!==undefined)data.username=b.username; if(b.profileImage!==undefined)data.profileImage=b.profileImage; if(b.password)data.password=await bcrypt.hash(b.password,10); const updated=await prisma.user.update({where:{id:user.id},data}); await audit(user.fullName,'تعديل بروفايل','User',user.id,'تحديث بيانات الحساب'); return {user:{id:updated.id,fullName:updated.fullName,username:updated.username,role:updated.role,profileImage:updated.profileImage,permissions:userPermissions(updated)}} })
