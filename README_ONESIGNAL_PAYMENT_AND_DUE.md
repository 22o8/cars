# فحص إشعارات OneSignal بعد التعديل

تم ضبط الإشعارات لتعمل فقط في حالتين:

1. عند تسديد قسط من صفحة الأقساط.
2. عند وجود قسط مستحق أو متأخر عبر Cron اليومي `/api/cron/installment-alerts`.

## مهم جداً

لا تضع القيم السرية داخل `.env.example` أو GitHub. ضعها فقط في Vercel Environment Variables:

```env
NUXT_PUBLIC_SITE_URL=https://cars-wa9g.vercel.app
NUXT_PUBLIC_ONESIGNAL_APP_ID=79fbc8fe-def9-488e-af32-9a7c00ab5e3f
ONESIGNAL_REST_API_KEY=ضع_المفتاح_الكامل_من_OneSignal
ONESIGNAL_STRICT_USER_TARGETING=false
INSTALLMENT_ALERT_REPEAT_MINUTES=1440
NOTIFICATION_DELIVERY_KEEP_DAYS=30
```

## طريقة التأكد

1. ارفع الملفات إلى GitHub.
2. انتظر Vercel Deploy جديد Ready.
3. افتح الموقع واضغط تفعيل الإشعارات ووافق من المتصفح.
4. افتح OneSignal → Audience → Subscriptions وتأكد أن الجهاز Subscribed.
5. من صفحة الأقساط اضغط تسديد على أي قسط. يجب أن يصل إشعار بعنوان: `تم تسديد قسط بالكامل` أو `تم تسجيل دفعة على قسط`.
6. لاختبار الأقساط المتأخرة افتح:
   `https://cars-wa9g.vercel.app/api/cron/installment-alerts`

إذا كان الرد يحتوي `sent` أكبر من 0 فهذا يعني أن OneSignal أرسل الإشعار.

## ماذا تم إصلاحه

- حذف إرسال الحقل `url` مع `web_url` حتى لا يظهر خطأ OneSignal:
  `Remove url field when setting app_url or web_url`.
- جعل رابط الإشعار كاملاً يبدأ بـ `https://`.
- تعطيل الفحص المحلي المتكرر داخل المتصفح حتى لا يسبب إزعاجاً أو تحديثات/تنبيهات متكررة.
- إضافة إشعار عند تسديد القسط مباشرة من API التسديد.
