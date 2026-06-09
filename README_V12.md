# AutoDealer Pro V12

تم إصلاح:
- خطأ No entry found in rollupOptions.input عبر تنظيف ملفات Nuxt المؤقتة تلقائياً عند التشغيل.
- عرض صفحات الإعدادات الداخلية system/account/backup عبر NuxtPage الصحيح.
- منع صفحة الإعدادات من الظهور فارغة بسبب Hydration أو تحميل البيانات.

التشغيل:

npm install
npx prisma db push
npm run dev

ملاحظة: لا ترفع ملف .env إلى GitHub.
