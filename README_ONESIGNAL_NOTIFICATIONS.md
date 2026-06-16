# إشعارات OneSignal في AutoDealer Pro

تم استبدال نظام Web Push اليدوي بنظام OneSignal لأنه أكثر ثباتاً واحترافية على الهاتف.

## متغيرات Vercel المطلوبة

أضف هذه القيم في Vercel > Project Settings > Environment Variables:

```env
NUXT_PUBLIC_ONESIGNAL_APP_ID=ضع App ID من OneSignal
ONESIGNAL_REST_API_KEY=ضع REST API Key من OneSignal
INSTALLMENT_ALERT_REPEAT_MINUTES=5
```

## مكان تعديل مدة تكرار الإشعار

1. في Vercel:
```env
INSTALLMENT_ALERT_REPEAT_MINUTES=5
```

2. في ملف جدولة Vercel:
```json
vercel.json
"schedule": "*/5 * * * *"
```

إذا تريد كل 10 دقائق:
```json
"schedule": "*/10 * * * *"
```
و:
```env
INSTALLMENT_ALERT_REPEAT_MINUTES=10
```

## آلية العمل

- المستخدم يضغط تفعيل الإشعارات من النظام.
- OneSignal يطلب صلاحية الإشعارات من المتصفح.
- النظام يربط جهاز المستخدم بحسابه عن طريق External User ID.
- Cron في Vercel يفتح:
```txt
/api/cron/installment-alerts
```
كل 5 دقائق.
- السيرفر يبحث عن الأقساط المستحقة أو المتأخرة.
- يرسل الإشعار إلى المدير والمحاسب وأي موظف لديه صلاحية الأقساط.

## ملاحظات مهمة

- يجب أن يكون الموقع على HTTPS.
- على iPhone يفضل تثبيت الموقع على الشاشة الرئيسية حتى تعمل إشعارات PWA بشكل أفضل.
- إذا أردت إرسال التنبيه لكل الأجهزة المشتركة بغض النظر عن المستخدم:
```env
ONESIGNAL_SEND_TO_ALL=true
```
