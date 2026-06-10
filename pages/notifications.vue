<template>
  <section class="page-pad fast-fade">
    <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-3xl font-black">الإشعارات</h1>
        <p class="text-muted mt-2">تنبيهات الأقساط المستحقة والمتأخرة على الهاتف والحاسوب حتى خارج البرنامج عند تفعيل Push وCron.</p>
      </div>
      <div class="action-bar">
        <button class="btn-primary btn" @click="requestNotifications">تفعيل إشعارات الجهاز</button>
        <button class="btn-secondary btn" @click="testPush">تجربة إشعار خارجي</button>
        <button class="btn-secondary btn" @click="refresh">تحديث</button>
      </div>
    </div>

    <div class="mb-5 grid gap-4 lg:grid-cols-3">
      <div class="card p-5">
        <h2 class="text-xl font-black mb-2">حالة الجهاز</h2>
        <p class="text-muted leading-8">{{ permissionText }}</p>
      </div>
      <div class="card p-5">
        <h2 class="text-xl font-black mb-2">حالة Push</h2>
        <p class="text-muted leading-8">{{ pushText }}</p>
      </div>
      <div class="card p-5">
        <h2 class="text-xl font-black mb-2">تنبيهات خارج البرنامج</h2>
        <p class="text-muted leading-8">لكي تصل الإشعارات خارج الصفحة، يجب تفعيل OneSignal على الجهاز وتشغيل Vercel Cron يومياً لتنبيهات الأقساط.</p>
      </div>
    </div>

    <div class="grid gap-4">
      <div v-for="n in data" :key="n.title" class="card p-5">
        <div class="flex items-center justify-between gap-3"><h3 class="font-black">{{ n.title }}</h3><span class="badge">{{ n.type === 'warning' ? 'تنبيه' : 'معلومة' }}</span></div>
        <p class="mt-2 text-muted">{{ n.body }}</p>
      </div>
      <div v-if="!data?.length" class="card p-8 text-center text-muted">لا توجد إشعارات حالياً.</div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { data, refresh } = useFetch<any[]>('/api/notifications', { default: () => [] })
const permission = ref('default')
const pushConfigured = ref(false)
const subscribed = ref(false)

onMounted(async () => {
  permission.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  const oneSignal: any = useNuxtApp().$oneSignal
  pushConfigured.value = Boolean(oneSignal?.configured)
  subscribed.value = permission.value === 'granted'
})

const permissionText = computed(() => {
  if (permission.value === 'granted') return 'الإشعارات مسموحة على هذا الجهاز.'
  if (permission.value === 'denied') return 'الإشعارات محظورة من المتصفح. افتح إعدادات الموقع واسمح بالإشعارات.'
  if (permission.value === 'unsupported') return 'هذا المتصفح لا يدعم إشعارات الويب.'
  return 'الإشعارات غير مفعلة بعد. اضغط زر التفعيل واسمح للمتصفح.'
})
const pushText = computed(() => {
  if (!pushConfigured.value) return 'OneSignal غير مضبوط في Vercel.'
  if (subscribed.value) return 'الجهاز مشترك في إشعارات OneSignal.'
  return 'OneSignal موجود، لكن الجهاز لم يسمح بالإشعارات بعد.'
})
function urlBase64ToUint8Array(base64String: string) { const padding = '='.repeat((4 - base64String.length % 4) % 4); const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/'); const rawData = window.atob(base64); const outputArray = new Uint8Array(rawData.length); for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i); return outputArray }
async function requestNotifications() {
  if (typeof Notification === 'undefined') { permission.value = 'unsupported'; alert('هذا المتصفح لا يدعم إشعارات الويب'); return }
  const nuxt = useNuxtApp()
  const oneSignal: any = nuxt.$oneSignal
  if (!oneSignal?.configured) { alert('أضف NUXT_PUBLIC_ONESIGNAL_APP_ID في Vercel ثم أعد النشر.'); return }
  const result = await oneSignal.requestPermission('admin')
  permission.value = result?.permission || Notification.permission
  subscribed.value = permission.value === 'granted'
  pushConfigured.value = true
  if (subscribed.value) alert('تم تفعيل إشعارات OneSignal على هذا الجهاز بنجاح')
}
async function testPush() {
  await $fetch('/api/onesignal/test', { credentials: 'include' })
    .then(() => alert('تم إرسال إشعار تجريبي عبر OneSignal'))
    .catch((e:any)=>alert(e?.data?.message || 'تعذر إرسال الإشعار التجريبي'))
}
</script>
