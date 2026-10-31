export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(async (registration) => {
    try { await registration.update() } catch {}
  }).catch(() => {})
})
