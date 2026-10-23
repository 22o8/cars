export default defineEventHandler(() => { throw createError({ statusCode: 410, statusMessage: 'Use /api/agent/complete' }) })
