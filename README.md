# Tarabil Customs Flow / ASYCUDA Agent v8.4 Clean Stable

هذه النسخة تجمع نظام Vercel الحالي مع Local Agent مثبت بشكل نظيف وقابل للتحديث.

أهم إصلاحات v8.4:

- فشل الطلب لم يعد يجعل الجهاز نفسه يظهر `AGENT_ERROR`.
- `restart-agent.bat` أصبح Restart حقيقياً للنسخة الموجودة في الذاكرة.
- إضافة `reset-agent.bat` لبداية نظيفة بالكامل.
- `install-agent.bat` يعيد بناء بيئتي 64-bit و32-bit ويضبط Java Access Bridge تلقائياً.
- `install-autostart.bat` يعتمد Task Scheduler ويبدأ بعد دخول Windows.
- `update-agent.bat` هو المسار الوحيد المطلوب للتحديثات المستقبلية.
- Java Security Warning لديها fallback يعتمد على أبعاد النافذة الحية بعد التحقق من `asy.mof.gov.iq`.
- Java Access Bridge DLL يتم اكتشافه ديناميكياً بدلاً من تثبيت مسار JRE محدد داخل الكود.

راجع `local-agent/CLEAN-INSTALL-AR.md` للخطوات.
