export default defineNuxtPlugin(() => {
  if (!process.client || !('serviceWorker' in navigator)) return

  const cleanupOldWorkbox = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const reg of registrations) {
        const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || ''
        const isOldWorkbox = scriptUrl.endsWith('/sw.js') || scriptUrl.includes('/workbox-')
        const isOneSignal = scriptUrl.includes('OneSignalSDKWorker.js') || scriptUrl.includes('OneSignalSDKUpdaterWorker.js')
        if (isOldWorkbox && !isOneSignal) await reg.unregister()
      }

      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.filter((name) => /workbox|precache|vite-pwa/i.test(name)).map((name) => caches.delete(name)))
      }
    } catch (e) {
      console.warn('Old PWA worker cleanup skipped', e)
    }
  }

  if (document.readyState === 'complete') cleanupOldWorkbox()
  else window.addEventListener('load', cleanupOldWorkbox, { once: true })
})
