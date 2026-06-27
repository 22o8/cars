declare global {
  interface Window {
    OneSignalDeferred?: any[]
    OneSignal?: any
    __adpOneSignalReady?: boolean
    __adpOneSignalInitPromise?: Promise<boolean>
  }
}

function loadOneSignalSdk() {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById('onesignal-sdk')) return resolve()
    const script = document.createElement('script')
    script.id = 'onesignal-sdk'
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('تعذر تحميل OneSignal SDK'))
    document.head.appendChild(script)
  })
}

async function waitForOneSignalRegistration() {
  if (!('serviceWorker' in navigator)) return false
  try {
    await navigator.serviceWorker.ready
    const registrations = await navigator.serviceWorker.getRegistrations()
    return registrations.some((reg) => {
      const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
      return scriptUrl.includes('OneSignalSDKWorker.js') || scriptUrl.includes('OneSignalSDKUpdaterWorker.js')
    })
  } catch {
    return false
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const appId = config.public.oneSignalAppId as string

  async function initOneSignal() {
    if (!process.client || !appId || window.__adpOneSignalReady) return Boolean(window.__adpOneSignalReady)
    if (window.__adpOneSignalInitPromise) return window.__adpOneSignalInitPromise
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return false

    window.__adpOneSignalInitPromise = (async () => {
      try {
        await loadOneSignalSdk()
        window.OneSignalDeferred = window.OneSignalDeferred || []

        return await new Promise<boolean>((resolve) => {
          window.OneSignalDeferred!.push(async function (OneSignal: any) {
            try {
              await OneSignal.init({
                appId,
                allowLocalhostAsSecureOrigin: true,
                serviceWorkerPath: '/OneSignalSDKWorker.js',
                serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
                serviceWorkerParam: { scope: '/' },
                notifyButton: { enable: false },
                promptOptions: {
                  slidedown: {
                    prompts: [
                      {
                        type: 'push',
                        autoPrompt: false,
                        text: {
                          actionMessage: 'فعّل إشعارات الأقساط والتنبيهات المهمة على هذا الجهاز.',
                          acceptButton: 'تفعيل',
                          cancelButton: 'لاحقاً'
                        }
                      }
                    ]
                  }
                }
              })

              await waitForOneSignalRegistration()
              window.__adpOneSignalReady = true
              resolve(true)
            } catch (e) {
              console.error('OneSignal init failed', e)
              window.__adpOneSignalInitPromise = undefined
              resolve(false)
            }
          })
        })
      } catch (e) {
        console.error('OneSignal SDK load failed', e)
        window.__adpOneSignalInitPromise = undefined
        return false
      }
    })()

    return window.__adpOneSignalInitPromise
  }

  async function loginOneSignalUser(userId?: string | null) {
    if (!userId) return false
    const ready = await initOneSignal()
    if (!ready) return false
    return await new Promise<boolean>((resolve) => {
      window.OneSignalDeferred = window.OneSignalDeferred || []
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        try {
          await OneSignal.login(userId)
          resolve(true)
        } catch (e) {
          console.error('OneSignal login failed', e)
          resolve(false)
        }
      })
    })
  }

  async function requestOneSignalPermission(userId?: string | null) {
    const ready = await initOneSignal()
    if (!ready) return { ok: false, reason: 'not-ready' }

    return await new Promise<{ ok: boolean; permission?: string; reason?: string }>((resolve) => {
      window.OneSignalDeferred = window.OneSignalDeferred || []
      window.OneSignalDeferred.push(async function (OneSignal: any) {
        try {
          if (userId) await OneSignal.login(userId)

          if (OneSignal.Slidedown?.promptPush) {
            await OneSignal.Slidedown.promptPush()
          } else if (OneSignal.Notifications?.requestPermission) {
            await OneSignal.Notifications.requestPermission()
          }

          const permission = Notification.permission
          resolve({ ok: permission === 'granted', permission })
        } catch (e) {
          console.error('OneSignal permission failed', e)
          resolve({ ok: false, reason: 'permission-error' })
        }
      })
    })
  }

  async function logoutOneSignalUser() {
    if (!window.__adpOneSignalReady) return
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try { await OneSignal.logout() } catch {}
    })
  }

  return {
    provide: {
      oneSignal: {
        init: initOneSignal,
        login: loginOneSignalUser,
        requestPermission: requestOneSignalPermission,
        logout: logoutOneSignalUser,
        configured: Boolean(appId)
      }
    }
  }
})
