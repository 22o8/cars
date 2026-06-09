import { vapidPublicKey, pushConfigured } from '../../utils/push'
export default defineEventHandler(async () => ({ publicKey: vapidPublicKey(), configured: pushConfigured() }))
