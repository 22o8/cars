self.addEventListener('push', function (event) {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { title: 'AutoDealer Pro', body: event.data ? event.data.text() : 'تنبيه جديد' } }
  const title = data.title || 'AutoDealer Pro'
  const options = {
    body: data.body || 'لديك تنبيه جديد في النظام',
    icon: data.icon || '/icons/icon-192.svg',
    badge: data.badge || '/icons/icon-192.svg',
    tag: data.tag || 'autodealer-pro',
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction),
    data: { url: data.url || '/installments' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification && event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil((async function () {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of allClients) {
      if ('focus' in client) {
        client.navigate(url)
        return client.focus()
      }
    }
    if (clients.openWindow) return clients.openWindow(url)
  })())
})
