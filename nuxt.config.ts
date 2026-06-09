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
      title: 'AutoDealer Pro - نظام إدارة معارض السيارات',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
        { name: 'theme-color', content: '#07111f' }
      ],
      link: [
        { rel: 'icon', href: '/icons/icon-192.svg' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
      ]
    }
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
    public: {
      appName: 'AutoDealer Pro',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
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
    registerType: 'autoUpdate',
    manifest: {
      name: 'AutoDealer Pro',
      short_name: 'AutoDealer',
      description: 'نظام إدارة معارض السيارات',
      theme_color: '#07111f',
      background_color: '#07111f',
      display: 'standalone',
      orientation: 'portrait-primary',
      icons: [
        { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
        { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
      ]
    },
    workbox: { navigateFallback: '/', globPatterns: ['**/*.{js,css,html,svg,png,ico}'], importScripts: ['/push-handler.js'] }
  }
})
