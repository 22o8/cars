# إصلاح PWA / OneSignal

تم تعديل النسخة لإزالة تعارض Workbox القديم مع OneSignal:

- إيقاف تسجيل Service Worker الخاص بـ @vite-pwa/nuxt حتى لا يظهر خطأ non-precached-url.
- إضافة manifest.webmanifest يدوي حتى يبقى التطبيق قابل للتثبيت.
- إبقاء OneSignal Worker كعامل الخدمة الأساسي للإشعارات.
- إضافة plugin ينظف Service Worker وكاش Workbox القديم تلقائياً بعد أول تشغيل.

بعد رفع النسخة على Vercel، إذا بقيت أخطاء قديمة في المتصفح، سوِ Reload مرتين أو من DevTools > Application > Service Workers اضغط Unregister للـ sw.js القديم مرة واحدة.
