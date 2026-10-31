# إصلاح واجهة الحاسبة V3.1

- تثبيت Desktop shell صراحةً عند عرض أكبر من 760px.
- منع Service Worker من تخزين صفحات HTML أو Nuxt chunks القديمة.
- تحديث Service Worker بدون الاعتماد على HTTP cache.
- Boot Recovery مبكر: إذا بقيت الصفحة بيضاء، ينظف Tarabil caches وService Workers القديمة مرة واحدة ثم يعيد التحميل.
- إذا فشل التشغيل حتى بعد التنظيف، تظهر شاشة تشخيص بدل الصفحة البيضاء.
- تصميم الهاتف V3 لم يتغير.
- local-agent لم يتم تعديله.
