# فحص إشعارات OneSignal

1. ضع القيم الحقيقية في Vercel Environment Variables فقط، وليس داخل GitHub:

```env
NUXT_PUBLIC_ONESIGNAL_APP_ID=79fbc8fe-def9-488e-af32-9a7c00ab5e3f
ONESIGNAL_REST_API_KEY=os_v2_app_...
INSTALLMENT_ALERT_REPEAT_MINUTES=1440
ONESIGNAL_STRICT_USER_TARGETING=false
NOTIFICATION_DELIVERY_KEEP_DAYS=30
```

2. اعمل Redeploy بعد تعديل المتغيرات.

3. افحص الإعداد:

```txt
https://cars-wa9g.vercel.app/api/onesignal/config
```

4. اختبر إرسال إشعار يدوي بعد تسجيل الدخول:

```txt
https://cars-wa9g.vercel.app/api/onesignal/test
```

5. اختبر تنبيه الأقساط المستحقة:

```txt
https://cars-wa9g.vercel.app/api/cron/installment-alerts
```

إذا ظهر status 403 من OneSignal فالمفتاح REST API Key غير صحيح أو ناقص أو ليس مفتاح نفس التطبيق.
