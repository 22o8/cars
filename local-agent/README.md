# Tarabil Cloud Agent — جهاز ASYCUDA

الوكيل يعمل على حاسبة Windows الموجودة عليها ASYCUDA. لا يحتاج فتح أي Port ولا Remote Desktop.

## 1) متغيرات Vercel
أضف في مشروع Vercel:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TARABIL_AGENT_DEVICE_ID=asycuda-office-1`
- `TARABIL_AGENT_DEVICE_TOKEN` قيمة سرية طويلة
- `TARABIL_MOBILE_PIN` رقم سري للهاتف

## 2) تجهيز الحاسبة
1. ثبت Python 3.11+.
2. شغّل `install-agent.bat`.
3. عند الإعداد أدخل رابط مشروع Vercel و`TARABIL_AGENT_DEVICE_TOKEN` نفسه.
4. أدخل بيانات ASYCUDA؛ تحفظ في Windows Credential Manager فقط.
5. شغّل `calibrate.py` واضبط نقاط واجهة ASYCUDA.
6. شغّل `start-agent.bat` واتركه يعمل.

## 3) من الهاتف
افتح صفحة «رقم الإجراء الموحد»، أدخل PIN، رمز الشركة، ورقم واتساب بصيغة دولية مثل `9647...` ثم اضغط إرسال.

الـAgent يفحص السيرفر كل 3 ثوانٍ تقريباً، ينفذ الطلب ويرجع النتيجة. إذا الحاسبة مطفأة، يبقى الطلب Pending حتى تشغيلها.

## الأمان
- لا توجد منافذ Inbound مفتوحة على حاسبة ASYCUDA.
- كلمة مرور ASYCUDA وWhatsApp Token وDevice Token محفوظة في Windows Credential Manager.
- نفذ التشغيل فقط على جهاز وحساب مصرح بهما من جهة العمل.

## التشغيل التلقائي في الخلفية (v6.2)
بعد التثبيت، يشغّل `install-autostart.bat` الوكيل تلقائياً مع تسجيل دخول Windows ويخفي نافذة CMD.
`start-agent-silent.bat` يعمل كـ watchdog: إذا توقف الوكيل يعيد تشغيله بعد 5 ثوانٍ.
سجل التشغيل موجود في `logs/agent.log`.
يمكن تعطيل التشغيل التلقائي بواسطة `remove-autostart.bat`.

مهم: أتمتة واجهة ASYCUDA تحتاج جلسة Windows تفاعلية. بعد إعادة تشغيل الجهاز، سيصبح الوكيل متصلاً فور تسجيل دخول مستخدم Windows. إذا بقي الجهاز على شاشة تسجيل الدخول أو كانت الجلسة غير متاحة، لا يمكن تنفيذ نقرات واجهة ASYCUDA حتى تسجيل الدخول.
