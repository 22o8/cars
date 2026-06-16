# ملاحظات النسخة المعدلة

## الإشعارات
- الإرسال الآن يعتمد على OneSignal فقط حتى لا يصير تعارض بين VAPID وOneSignal.
- زر تفعيل الإشعارات لا يعمل Refresh ولا يبدّل الثيم.
- إذا OneSignal يرجع `id` بدون `recipients`، يعتبر النظام الإرسال ناجحاً ويعرض `sent: 1` لأن هذا السلوك ظهر عندك والإشعار كان يصل للهاتف.
- عند تسديد قسط يتم إرسال إشعار فوري عبر `server/api/installments/[id]/pay.post.ts`.
- عند وجود قسط مستحق/متأخر يتم إرسال إشعار عبر `server/api/cron/installment-alerts.get.ts`.

## قيم Vercel المطلوبة
ضعها في Vercel Environment Variables وليس في GitHub:

NUXT_PUBLIC_SITE_URL=https://cars-wa9g.vercel.app
NUXT_PUBLIC_ONESIGNAL_APP_ID=79fbc8fe-def9-488e-af32-9a7c00ab5e3f
ONESIGNAL_REST_API_KEY=ضع_المفتاح_الكامل_بدون_نجوم
ONESIGNAL_STRICT_USER_TARGETING=false
INSTALLMENT_ALERT_REPEAT_MINUTES=1440
NOTIFICATION_DELIVERY_KEEP_DAYS=30

## Cron على Vercel Hobby
يجب أن يكون يومياً فقط مثل:

0 8 * * *

ولا تستخدم */5 أو */10 على Hobby.

## اختبار سريع
1. افتح الموقع.
2. اضغط تفعيل الإشعارات واسمح من المتصفح.
3. افتح: /api/onesignal/test
4. افتح: /api/cron/installment-alerts
5. سدّد قسطاً من صفحة الأقساط وتأكد من ظهور إشعار التسديد.

## أيقونة التطبيق و Add to Home Screen
تم ضبط اسم التطبيق إلى: نظام إدارة المعرض
وتمت إضافة favicon.ico وأيقونات PNG للـ PWA.
بعد الرفع افتح الموقع من الهاتف واضغط من المتصفح: Add to Home Screen.
