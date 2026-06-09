export default defineNuxtPlugin(() => {
  const routes = ['/', '/cars', '/customers', '/sales', '/installments', '/invoices', '/expenses', '/accounts', '/reports', '/employees', '/settings/system']
  const warm = () => routes.forEach((r) => prefetchComponents(r).catch(() => {}))
  if ('requestIdleCallback' in window) (window as any).requestIdleCallback(warm)
  else setTimeout(warm, 900)
})
