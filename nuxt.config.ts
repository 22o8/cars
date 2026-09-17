export default defineNuxtConfig({
  compatibilityDate: '2026-09-17',
  devtools: { enabled: false },
  css: ['~/assets/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
      title: 'سجل النقل والمصروفات',
      meta: [
        { name: 'description', content: 'نظام مبسط لتسجيل بيانات النقل والصرفيات والرسوم' },
        { name: 'theme-color', content: '#12304a' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ]
    }
  }
})
