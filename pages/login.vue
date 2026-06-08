<template>
  <div class="min-h-screen grid lg:grid-cols-2 bg-slate-950">
    <div class="relative hidden overflow-hidden lg:flex flex-col justify-center p-16 text-white bg-[radial-gradient(circle_at_30%_20%,rgba(47,125,246,.35),transparent_35%),linear-gradient(135deg,#07111f,#10244a)]">
      <div class="absolute inset-0 opacity-20" style="background-image: linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px); background-size: 46px 46px"></div>
      <div class="relative max-w-xl">
        <div class="mb-6 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-blue-100">نظام ويب احترافي لإدارة معارض السيارات</div>
        <h1 class="text-6xl font-black tracking-tight mb-5">AutoDealer Pro</h1>
        <p class="text-xl leading-9 text-slate-300">إدارة السيارات والعملاء والمبيعات والأقساط والفواتير والتقارير من الهاتف والحاسوب عبر نظام PWA متكامل.</p>
      </div>
    </div>
    <div class="flex items-center justify-center p-6 bg-slate-100">
      <form class="w-full max-w-md rounded-[2rem] border border-white bg-white p-8 shadow-2xl" @submit.prevent="login">
        <div class="mb-8 text-center">
          <div class="mx-auto mb-4 h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-600 to-slate-950"></div>
          <h2 class="text-3xl font-black text-slate-950">تسجيل الدخول</h2>
          <p class="mt-2 text-slate-500">ادخل بيانات حسابك للمتابعة</p>
        </div>
        <label class="block mb-4"><span class="font-bold text-slate-700">اسم المستخدم</span><input v-model="username" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-600" /></label>
        <label class="block mb-6"><span class="font-bold text-slate-700">كلمة المرور</span><input v-model="password" type="password" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-600" /></label>
        <p v-if="error" class="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-center font-bold text-red-600">{{ error }}</p>
        <button class="w-full rounded-2xl bg-blue-600 px-5 py-4 font-black text-white hover:bg-blue-700">دخول</button>
        <p class="mt-5 text-center text-xs text-slate-400">الحساب الافتراضي: admin / admin123</p>
      </form>
    </div>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ layout: false })
const auth=useAuthStore(); const username=ref('admin'); const password=ref('admin123'); const error=ref('')
async function login(){ error.value=''; try{ await auth.login(username.value,password.value); await navigateTo('/') }catch(e:any){ error.value=e?.statusMessage || e?.data?.message || 'فشل تسجيل الدخول' } }
</script>
