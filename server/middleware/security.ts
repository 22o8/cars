export default defineEventHandler((event) => {
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'x-frame-options', 'DENY')
  setHeader(event, 'referrer-policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'permissions-policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()')
  setHeader(event, 'x-dns-prefetch-control', 'off')
  if (process.env.NODE_ENV === 'production') {
    setHeader(event, 'strict-transport-security', 'max-age=31536000; includeSubDomains; preload')
  }
})
