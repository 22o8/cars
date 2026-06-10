export default defineNuxtConfig({
  compatibilityDate: '2026-06-08',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  experimental: { payloadExtraction: false },
  app: {
    pageTransition: false,
    layoutTransition: false,
    head: {
      title: 'نظام إدارة المعرض',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
        { name: 'theme-color', content: '#07111f' }
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
      ]
    }
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
    public: {
      appName: 'نظام إدارة المعرض',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      oneSignalAppId: process.env.NUXT_PUBLIC_ONESIGNAL_APP_ID || ''
    }
  },
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit', 'pinia']
    }
  },
  nitro: {
    compressPublicAssets: true,
    routeRules: {
      '/api/**': { headers: { 'cache-control': 'no-store' } },
      '/icons/**': { headers: { 'cache-control': 'public,max-age=31536000,immutable' } }
    }
  },
  pwa: {
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      name: 'نظام إدارة المعرض',
      short_name: 'إدارة المعرض',
      description: 'نظام إدارة المعرض للسيارات والأقساط والعملاء',
      theme_color: '#07111f',
      background_color: '#07111f',
      display: 'standalone',
      orientation: 'portrait-primary',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: { navigateFallback: '/', globPatterns: ['**/*.{js,css,html,svg,png,ico}'] }
  }
})
