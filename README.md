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

## v6.5 guided calibration
If the agent reports missing login/navigation calibration, stop the agent and run `local-agent/calibrate-agent.bat`. Choose option `1` for a safe test-only calibration. The wizard now clicks each recorded navigation point immediately so the next ASYCUDA menu can actually appear. Run `check-calibration.bat` to verify `TEST READY: YES` before pressing the web test button.
