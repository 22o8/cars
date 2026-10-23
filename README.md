# نظام متابعة معاملات طريبيل — v6 Cloud Agent

نسخة Nuxt 3 / PWA مع تنفيذ رقم الإجراء الموحد من الهاتف عبر جهاز ASYCUDA الموجود في المكتب.

## الجديد في v6
- صفحة موبايل مبسطة لإرسال: رمز الشركة + رقم واتساب.
- Cloud Queue؛ لا يحتاج الهاتف الوصول المباشر إلى جهاز المكتب.
- جهاز ASYCUDA يسحب الطلب تلقائياً كل عدة ثوانٍ وينفذه.
- إذا الجهاز مطفأ يبقى الطلب Pending حتى يعود الجهاز للعمل.
- حالة الجهاز ظاهرة في الهاتف: متصل / غير متصل.
- حالات الطلب: بانتظار الجهاز / جاري التنفيذ / مكتمل / فشل.
- إعادة محاولة الطلبات الفاشلة من الهاتف.
- استرجاع رقم الإجراء تلقائياً عند إمكانية نسخه من واجهة ASYCUDA.
- إرسال Screenshot عبر WhatsApp Cloud API عند تفعيل التكامل.
- لا توجد منافذ Inbound مفتوحة على جهاز المكتب.

## متغيرات Vercel المطلوبة
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TARABIL_AGENT_DEVICE_ID=asycuda-office-1`
- `TARABIL_AGENT_DEVICE_TOKEN`
- `TARABIL_MOBILE_PIN`

## إعداد جهاز ASYCUDA
راجع `local-agent/README.md`.

## Vercel
- Framework: Nuxt.js
- Install: `npm install`
- Build: `npm run build`
- لا تضبط Output Directory يدوياً.

> استخدم الأتمتة فقط على جهاز وحساب ASYCUDA المصرح لك باستخدامهما من جهة العمل.


## Safe connection test
The Unified Procedure page includes a button labeled `للتجربة`. This creates a cloud job with `mode: test`. The Windows agent opens ASYCUDA, navigates only to the Unified Procedure page, captures a screenshot locally in `local-agent/screenshots`, and stops. It does not enter a company code and does not click the create/submit button.
