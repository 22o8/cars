export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchUser()
  }

  if (to.path !== '/login' && !auth.user) {
    return navigateTo('/login', { replace: true })
  }

  if (to.path === '/login' && auth.user) {
    return navigateTo('/', { replace: true })
  }

  const permissionByPrefix: Record<string, string> = {
    '/cars': 'cars',
    '/customers': 'customers',
    '/sales': 'sales',
    '/installments': 'installments',
    '/invoices': 'invoices',
    '/payments': 'invoices',
    '/expenses': 'expenses',
    '/accounts': 'accounts',
    '/reports': 'reports',
    '/statistics': 'reports',
    '/employees': 'employees',
    '/settings': 'settings',
    '/audit-logs': 'settings'
  }

  const needed = Object.entries(permissionByPrefix).find(([p]) => to.path.startsWith(p))?.[1]
  if (needed && !auth.can(needed)) return navigateTo('/', { replace: true })
})
