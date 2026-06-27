<template>
  <main class="login-shell min-h-screen overflow-hidden bg-slate-950 text-slate-950" dir="rtl">
    <section class="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
      <div class="relative hidden lg:flex flex-col items-center justify-center overflow-hidden p-12 text-center text-white">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(47,125,246,.42),transparent_34%),radial-gradient(circle_at_82%_72%,rgba(20,184,166,.22),transparent_30%),linear-gradient(135deg,#06101f,#10295a)]"></div>
        <div class="absolute inset-0 opacity-[.18]" style="background-image: linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px); background-size: 42px 42px"></div>

        <div class="relative z-10 flex max-w-2xl flex-col items-center gap-7">
          <div class="flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur">
            <span class="h-10 w-10 rounded-2xl bg-blue-400 shadow-[0_0_34px_rgba(96,165,250,.9)]"></span>
          </div>

          <div>
            <h1 class="text-3xl font-black tracking-tight">AutoDealer Pro</h1>
            <p class="mt-2 text-sm font-bold text-blue-100/80">نظام إدارة معارض السيارات</p>
          </div>

          <span class="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-black text-blue-100 shadow-xl backdrop-blur">PWA Secure</span>

          <p class="inline-flex rounded-full border border-white/15 bg-white/10 px-6 py-3 text-base font-black leading-8 text-blue-100 backdrop-blur">منصة احترافية للسيارات والعملاء والأقساط والفواتير</p>

          <h2 class="text-5xl font-black leading-tight tracking-tight xl:text-6xl">إدارة معرضك من مكان واحد.</h2>
        </div>
      </div>

      <div class="relative flex items-center justify-center bg-slate-100 p-5 lg:p-10">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_70%_12%,rgba(37,99,235,.10),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(20,184,166,.10),transparent_32%)]"></div>
        <form class="relative w-full max-w-[470px] rounded-[2rem] border border-white bg-white/95 p-6 shadow-[0_28px_90px_rgba(15,23,42,.16)] backdrop-blur lg:p-9" @submit.prevent="login">
          <div class="mb-8 text-center">
            <div class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-blue-600 via-blue-700 to-slate-950 shadow-[0_18px_45px_rgba(37,99,235,.35)]">
              <span class="h-8 w-8 rounded-xl bg-white/85"></span>
            </div>
            <h2 class="text-3xl font-black text-slate-950 lg:text-4xl">تسجيل الدخول</h2>
            <p class="mt-3 text-sm leading-7 text-slate-500">أدخل بيانات حسابك للمتابعة إلى لوحة التحكم</p>
          </div>

          <div class="space-y-5">
            <label class="block">
              <span class="mb-2 block text-sm font-black text-slate-700">اسم المستخدم</span>
              <input v-model.trim="username" autocomplete="username" class="login-input" placeholder="اكتب اسم المستخدم" :disabled="loading" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm font-black text-slate-700">كلمة المرور</span>
              <input v-model="password" autocomplete="current-password" type="password" class="login-input" placeholder="اكتب كلمة المرور" :disabled="loading" />
            </label>
          </div>

          <div class="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>الدخول محمي بمحاولة محدودة لكل جهاز</span>
            <span class="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">جلسة آمنة</span>
          </div>

          <p v-if="error" class="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600">{{ error }}</p>
          <button class="mt-6 w-full rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-5 py-4 font-black text-white shadow-[0_16px_35px_rgba(37,99,235,.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60" :disabled="loading || !username || !password">
            {{ loading ? 'جاري التحقق...' : 'دخول آمن' }}
          </button>
          <p class="mt-5 text-center text-xs leading-6 text-slate-400">لا تشارك بيانات الدخول مع أي شخص. لكل موظف حساب وصلاحياته الخاصة.</p>
        </form>
      </div>
    </section>
  </main>
</template>
<script setup lang="ts">
definePageMeta({ layout: false })
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
async function login(){
  if (loading.value) return
  error.value=''
  loading.value = true
  try{
    await auth.login(username.value,password.value)
    await navigateTo('/')
  }catch(e:any){
    error.value=e?.data?.message || e?.statusMessage || 'فشل تسجيل الدخول'
  } finally {
    loading.value = false
  }
}
</script>
