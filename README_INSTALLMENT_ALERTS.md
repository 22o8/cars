# تنبيهات الأقساط كل 5 دقائق

تم ضبط النظام حتى يفحص الأقساط المستحقة والمتأخرة ويرسل Push Notification كل 5 دقائق.

## مكان تعديل مدة التكرار مستقبلاً

### 1) إشعارات الهاتف خارج البرنامج عبر Vercel Cron
في Vercel أضف أو عدّل Environment Variable:

```env
INSTALLMENT_ALERT_REPEAT_MINUTES=5
```

ثم افتح ملف:

```txt
vercel.json
```

ستجد:

```json
{ "path": "/api/cron/installment-alerts", "schedule": "*/5 * * * *" }
```

لتغييرها إلى 10 دقائق مثلاً:

```json
{ "path": "/api/cron/installment-alerts", "schedule": "*/10 * * * *" }
```

### 2) التنبيه الاحتياطي داخل المتصفح عندما يكون البرنامج مفتوحاً
افتح ملف:

```txt
layouts/default.vue
```

وابحث عن:

```ts
const INSTALLMENT_ALERT_REPEAT_MS = 5 * 60 * 1000
```

غيّر الرقم 5 إلى المدة التي تريدها بالدقائق.

## كيف يعمل النظام

- يبحث عن كل قسط حالته ليست PAID وتاريخ استحقاقه أقل أو يساوي تاريخ اليوم.
- يرسل إشعار لكل مستخدم فعال لديه اشتراك Push.
- يعيد إرسال إشعار نفس القسط كل فترة محددة، افتراضياً كل 5 دقائق.
- يحفظ سجل إرسال حتى لا يرسل أكثر من مرة داخل نفس فترة الخمس دقائق.

## ملفات مهمة

```txt
server/utils/push.ts
server/api/cron/installment-alerts.get.ts
vercel.json
layouts/default.vue
public/push-handler.js
```

## ملاحظات تشغيل

تأكد من وجود هذه المتغيرات في Vercel:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your@email.com
INSTALLMENT_ALERT_REPEAT_MINUTES=5
```
