export default defineEventHandler(async (event) => {
  deleteCookie(event, 'adp_token', { path: '/' })
  return { ok: true }
})
