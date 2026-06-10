import { oneSignalConfigured, oneSignalAppId } from '../../utils/onesignal'

export default defineEventHandler(async () => ({
  provider: 'onesignal',
  appId: oneSignalAppId(),
  configured: oneSignalConfigured()
}))
