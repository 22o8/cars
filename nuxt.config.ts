export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
      title: 'نظام تتبع معاملات طريبيل',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0f766e' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ]
    }
  },
  runtimeConfig: {
    redisUrl: process.env.UPSTASH_REDIS_REST_URL || '',
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    agentDeviceId: process.env.TARABIL_AGENT_DEVICE_ID || 'asycuda-office-1',
    agentDeviceToken: process.env.TARABIL_AGENT_DEVICE_TOKEN || '',
    mobilePin: process.env.TARABIL_MOBILE_PIN || ''
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2024-11-01'
})
