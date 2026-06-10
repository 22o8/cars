# OneSignal - تشغيل إشعارات الأقساط

## متغيرات Vercel المطلوبة

ضع هذه القيم في Vercel > Project > Settings > Environment Variables:

```env
NUXT_PUBLIC_ONESIGNAL_APP_ID=79fbc8fe-def9-488e-af32-9a7c00ab5e3f
ONESIGNAL_REST_API_KEY=ضع_المفتاح_الجديد_هنا
INSTALLMENT_ALERT_REPEAT_MINUTES=5
```

للتشغيل اليومي بعد التجربة:

```env
INSTALLMENT_ALERT_REPEAT_MINUTES=1440
```

## مكان تعديل التكرار

1. من Vercel:

```env
INSTALLMENT_ALERT_REPEAT_MINUTES=5
```

2. من cron:

`vercel.json`

```json
{ "path": "/api/cron/installment-alerts", "schedule": "*/5 * * * *" }
```

## اختبار الإشعارات

بعد النشر:

1. افتح الموقع وسجل دخول.
2. اضغط زر تفعيل الإشعارات.
3. تأكد في OneSignal > Audience > Subscriptions أن الجهاز Subscribed.
4. افتح هذا الرابط وأنت مسجل دخول:

```txt
https://YOUR_DOMAIN/api/onesignal/test
```

أو من داخل الموقع اضغط تفعيل الإشعارات، سيصل إشعار اختبار.

## سبب مشكلة No recipients

كانت النسخة السابقة ترسل إلى `include_external_user_ids` باستخدام id من قاعدة البيانات، بينما جهازك في OneSignal كان مسجلاً بـ External ID مختلف. لذلك تم تعديل النسخة الحالية لتُرسل افتراضياً إلى كل الأجهزة المشتركة `Subscribed Users`، وهذا هو الأنسب لمعرض واحد.

إذا تريد مستقبلاً إرسال التنبيه فقط لموظفين محددين، يمكن تفعيل:

```env
ONESIGNAL_STRICT_USER_TARGETING=true
```

لكن يجب وقتها أن يكون External ID في OneSignal مطابقاً لـ User.id داخل قاعدة البيانات.
