import { getCurrentUser, userPermissions } from '../../utils/auth'
export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)
  return { user: user ? { id: user.id, fullName: user.fullName, username: user.username, role: user.role, active: user.active, profileImage: user.profileImage, permissions: userPermissions(user) } : null }
})
