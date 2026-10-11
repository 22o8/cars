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
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2024-11-01'
})
