# AutoDealer Pro - Production Checklist

هذه النسخة تحتوي تحسينات Production مهمة:

- حماية Headers أساسية على كل الطلبات.
- Rate Limit قابل للاستخدام في API.
- Push Notifications حقيقية عبر VAPID و Service Worker.
- Cron يومي لإشعارات الأقساط المستحقة.
- Cron يومي لفحص النسخ الاحتياطي وحالة الجداول.
- سجل عمليات Audit Log مع صفحة مراجعة داخل النظام.
- فحص جاهزية الإنتاج من صفحة النسخ الاحتياطي.
- صلاحيات صفحات من الواجهة والسيرفر.
- Backup Export / Import / Factory Reset.
- Responsive محسّن للهاتف.

## متغيرات Vercel المطلوبة

DATABASE_URL=postgresql://...
JWT_SECRET=ضع_قيمة_طويلة_عشوائية
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your@email.com
CRON_SECRET=اختياري_لحماية_كرونات_الفحص

## أوامر النشر

Build Command:

npx prisma generate && npm run build

Output Directory:

اتركه فارغاً.

Install Command:

npm install

## بعد رفع نسخة جديدة

npx prisma db push
npm run db:seed

داخل Vercel اعمل Redeploy بدون Cache عند تغيير package-lock.json.
