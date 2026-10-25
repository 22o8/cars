# v11 – Exact JAB Multi-window

الإصلاح الأساسي في هذه النسخة هو إزالة افتراض أن ASYCUDA يمتلك نافذة Java واحدة فقط.

عند ظهور Popup/JDialog بعنوان ASYCUDAWorld production server، يحدد الـHelper النافذة الرئيسية حسب الحجم، ثم يربط كل Java HWND التابعة لنفس PID ويقرأها كلها عبر Java Access Bridge.

هذا يعالج حالة اختفاء JAB عند ظهور نافذة الإشعارات.

أضيف أيضاً `capture-asycuda-state.bat` لتسجيل PID وHWND وعنوان/Class/Rect لكل Java window مع الشجرة الفعلية.
