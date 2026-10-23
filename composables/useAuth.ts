import type { Role, User } from '~/types'
import { roleStageMap } from '~/utils/stages'

const roleLabels: Record<Role, string> = {
  admin: 'مدير النظام', unified: 'موظف رقم الإجراء الموحد', asycuda: 'موظف السكودة', inspection: 'موظف الكشف', customs: 'الأمور الكمركية',
  checks: 'موظف الفحص والتتبع', audit: 'التدقيق', cashier: 'الصندوق', completion: 'الإنجاز', computer: 'الحاسبة',
  transport: 'النقل البري', archive: 'التفريغ والأرشفة', delivery: 'التسليم', viewer: 'مشاهدة فقط'
}

export function useAuth() {
  const users = useState<User[]>('users', () => [
    { id: 'u1', name: 'مسؤول النظام', role: 'admin', active: true },
    { id: 'u2', name: 'موظف رقم الإجراء الموحد', role: 'unified', active: true },
    { id: 'u3', name: 'موظف السكودة', role: 'asycuda', active: true },
    { id: 'u4', name: 'موظف الكشف', role: 'inspection', active: true },
    { id: 'u5', name: 'موظف الأمور الكمركية', role: 'customs', active: true },
    { id: 'u6', name: 'موظف الفحص والتتبع', role: 'checks', active: true },
    { id: 'u7', name: 'موظف التدقيق', role: 'audit', active: true },
    { id: 'u8', name: 'موظف الصندوق', role: 'cashier', active: true },
    { id: 'u9', name: 'موظف الإنجاز', role: 'completion', active: true },
    { id: 'u10', name: 'موظف الحاسبة', role: 'computer', active: true },
    { id: 'u11', name: 'موظف النقل البري', role: 'transport', active: true },
    { id: 'u12', name: 'موظف الأرشفة', role: 'archive', active: true },
    { id: 'u13', name: 'موظف التسليم', role: 'delivery', active: true }
  ])
  const currentUserId = useCookie<string>('tarabil.currentUser', { default: () => 'u1', sameSite: 'lax' })
  const currentUser = computed(() => users.value.find(u => u.id === currentUserId.value) || users.value[0])
  const can = (roles: string[]) => roles.includes(currentUser.value.role)

  function homePath(role: Role = currentUser.value.role) {
    if (role === 'admin' || role === 'viewer') return '/'
    if (role === 'unified') return '/unified-procedure'
    if (role === 'asycuda') return '/asycuda'
    if (role === 'archive') return '/archive'
    const stage = roleStageMap[role]
    return stage ? `/transactions?stage=${stage}` : '/'
  }

  return { users, currentUserId, currentUser, can, roleLabels, homePath }
}
