<template>
  <section class="page-pad fast-fade">
    <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-3xl font-black">الإشعارات</h1>
        <p class="text-muted mt-2">تنبيهات الأقساط المستحقة والمتأخرة ومتابعة مبيعات اليوم. فعّل صلاحية الإشعارات حتى تظهر على الهاتف مثل التطبيقات.</p>
      </div>
      <div class="action-bar">
        <button class="btn-primary btn" @click="requestNotifications">تفعيل إشعارات الهاتف</button>
        <button class="btn-secondary btn" @click="refresh">تحديث</button>
      </div>
    </div>

    <div class="mb-5 card p-5">
      <h2 class="text-xl font-black mb-2">حالة إشعارات الجهاز</h2>
      <p class="text-muted leading-8">{{ permissionText }}</p>
      <p class="text-muted text-sm mt-2">للحصول على أفضل تجربة على الهاتف، افتح الموقع من المتصفح واختر إضافة إلى الشاشة الرئيسية. بعدها تبقى الإشعارات أوضح وأسهل في الوصول.</p>
    </div>

    <div class="grid gap-4">
      <div v-for="n in data" :key="n.title" class="card p-5">
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-black">{{ n.title }}</h3>
          <span class="badge">{{ n.type === 'warning' ? 'تنبيه' : 'معلومة' }}</span>
        </div>
        <p class="mt-2 text-muted">{{ n.body }}</p>
      </div>
      <div v-if="!data?.length" class="card p-8 text-center text-muted">لا توجد إشعارات حالياً.</div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { data, refresh } = useFetch<any[]>('/api/notifications', { default: () => [] })
const permission = ref('default')
onMounted(() => { permission.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission })
const permissionText = computed(() => {
  if (permission.value === 'granted') return 'الإشعارات مفعلة على هذا الجهاز. سيقوم النظام بتنبيهك عند وجود قسط مستحق أو متأخر أثناء فتح التطبيق أو عند تشغيله كتطبيق PWA.'
  if (permission.value === 'denied') return 'الإشعارات محظورة من المتصفح. افتح إعدادات الموقع واسمح بالإشعارات.'
  if (permission.value === 'unsupported') return 'هذا المتصفح لا يدعم إشعارات الويب.'
  return 'الإشعارات غير مفعلة بعد. اضغط زر التفعيل واسمح للمتصفح بإرسال التنبيهات.'
})
async function requestNotifications() {
  if (typeof Notification === 'undefined') { permission.value = 'unsupported'; return }
  permission.value = await Notification.requestPermission()
  if (permission.value === 'granted') {
    new Notification('AutoDealer Pro', { body: 'تم تفعيل إشعارات النظام بنجاح', icon: '/icons/icon-192.svg', tag: 'autodealer-test' })
  }
}
</script>
