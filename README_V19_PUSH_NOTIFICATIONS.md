# AutoDealer Pro V19 - Push Notifications

هذه النسخة تضيف إشعارات Push حقيقية للأقساط المستحقة والمتأخرة.

## التشغيل

```powershell
npm install
npx prisma db push
npm run dev
```

## مفاتيح الإشعارات

أنشئ مفاتيح VAPID:

```powershell
npm run push:keys
```

أضف القيم في Vercel Environment Variables:

- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT

ثم أعد Deploy.

## كيف تعمل الإشعارات خارج البرنامج؟

1. المستخدم يسجل دخول.
2. يضغط تفعيل الإشعارات.
3. المتصفح يطلب السماح.
4. الجهاز يشترك في Push Subscription ويتم حفظه في قاعدة البيانات.
5. Vercel Cron يستدعي `/api/cron/installment-alerts` يومياً الساعة 7:00 UTC على خطة Vercel المجانية. إذا أردت كل ساعة أو كل 30 دقيقة تحتاج Vercel Pro أو خدمة Cron خارجية تستدعي نفس الرابط.
6. إذا يوجد قسط مستحق أو متأخر، يصل إشعار للجهاز حتى خارج الصفحة.

ملاحظة: على iPhone يجب فتح الموقع من Safari ثم Add to Home Screen حتى تعمل إشعارات PWA.
