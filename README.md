# نظام طريبيل — ASYCUDA Pro v8.8

النسخة الحالية تضيف Interactive Review لطلبات رقم الإجراء الموحد: Screenshot داخل النظام، صفحة تفاصيل مستقلة لكل طلب، قرارات متابعة/إيقاف، سجل صور المراجعات، وصورة النتيجة النهائية.

راجع `V8.8-INTERACTIVE-REVIEW-AR.md` للتحديث.


## v9.1
Interactive review workflow wording and details-page decision guidance updated.


## v12
Exact-target interactive review and verified resume-to-unified navigation.

## v13 Production Unified Procedure
Real unified-procedure execution is enabled for explicit `execute` jobs. Test jobs remain navigation-only. The agent commits the company code with Enter, creates the procedure, uploads a review screenshot, waits for operator approval, then confirms completion and uploads final proof.


## v13.1
Visible internal frames are always reviewed; clean-main navigation uses live JAB bounds with fast double-clicks for the Unified Procedure folder and page.


## v13.2 Regression Safe Core
Security Warning, interactive review, fast navigation, and production execution are treated as mandatory core invariants.


## v13.3
Verified live login and verified procedure creation result.


## v13.4 Native Login First
Login screen fallback now detects the live small ASYCUDA login window and fills/submits credentials even when Java Access Bridge does not expose LOGIN roles correctly.

## Cloud sync update
Companies, transactions, stages, finance data and scanner files now use the configured Upstash Redis as a shared source across devices. Local browser storage is retained only as an offline/cache fallback. See `CLOUD-SYNC-AR.md`.


## UI/UX V2 — Complete
تم تحديث جميع الصفحات التشغيلية وإضافة Light/Dark theme (Light افتراضي)، مع الحفاظ على تصميم الهاتف ومزامنة البيانات الحالية. راجع `UIUX-V2-STATUS-AR.md`.
