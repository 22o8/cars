import { roleStageMap } from '~/utils/stages'

export default defineNuxtRouteMiddleware((to) => {
  const { currentUser, homePath } = useAuth()
  const role = currentUser.value.role
  if (role === 'admin') return

  if (role === 'asycuda') {
    if (to.path !== '/asycuda') return navigateTo('/asycuda')
    return
  }
  if (role === 'archive') {
    if (to.path !== '/archive') return navigateTo('/archive')
    return
  }
  const stage = roleStageMap[role]
  if (stage) {
    if (to.path !== '/transactions' || String(to.query.stage || '') !== stage) {
      return navigateTo({ path: '/transactions', query: { stage } })
    }
    return
  }
  if (to.path !== '/') return navigateTo(homePath())
})
