# فحص OneSignal بعد التعديل

تم تعديل الإرسال ليجرب الشرائح بهذا الترتيب:

1. Total Subscriptions
2. Subscribed Users
3. All

سبب التعديل: في OneSignal الجديد قد تكون الشريحة الافتراضية باسم Total Subscriptions، وليس Subscribed Users.

بعد الرفع على GitHub ونجاح Vercel Deploy:

1. تأكد من Vercel Environment Variables:
   - NUXT_PUBLIC_ONESIGNAL_APP_ID
   - ONESIGNAL_REST_API_KEY
   - ONESIGNAL_STRICT_USER_TARGETING=false
   - INSTALLMENT_ALERT_REPEAT_MINUTES=1440

2. افتح الموقع وفعّل الإشعارات من جهاز واحد على الأقل.

3. جرّب الرابط:
   /api/cron/installment-alerts

النجاح يكون عندما يظهر sent أكبر من 0.

إذا بقي sent=0 افتح تفاصيل attempts في الرد لمعرفة أي Segment تم تجربته.
