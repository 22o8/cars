import type { Role, User } from '~/types'

const roleLabels: Record<Role, string> = {
  admin: 'مدير النظام', asycuda: 'موظف السكودة', inspection: 'موظف الكشف', customs: 'الأمور الكمركية',
  radiation: 'الإشعاعي', audit: 'التدقيق', cashier: 'الصندوق', completion: 'الإنجاز', computer: 'الحاسبة',
  transport: 'النقل البري', archive: 'التفريغ والأرشفة', delivery: 'التسليم', viewer: 'مشاهدة فقط'
}

export function useAuth() {
  const users = useState<User[]>('users', () => [
    { id: 'u1', name: 'مسؤول النظام', role: 'admin', active: true },
    { id: 'u2', name: 'موظف السكودة', role: 'asycuda', active: true },
    { id: 'u3', name: 'موظف الكشف', role: 'inspection', active: true },
    { id: 'u4', name: 'موظف الإشعاعي', role: 'radiation', active: true },
    { id: 'u5', name: 'موظف الأرشفة', role: 'archive', active: true }
  ])
  const currentUserId = useState<string>('currentUserId', () => 'u1')
  const currentUser = computed(() => users.value.find(u => u.id === currentUserId.value) || users.value[0])
  const can = (roles: string[]) => roles.includes(currentUser.value.role)
  return { users, currentUserId, currentUser, can, roleLabels }
}
