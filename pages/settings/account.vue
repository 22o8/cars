<template>
  <section class="page-pad fast-fade">
    <div class="mb-6"><h1 class="text-3xl font-black">إعدادات الحساب</h1><p class="text-muted mt-2">تعديل الاسم، اسم الدخول، كلمة المرور، وصورة البروفايل.</p></div>
    <SettingsTabs />
    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">{{message}}</div>
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="card p-6"><h2 class="text-xl font-black mb-4">بيانات المستخدم</h2><div class="grid gap-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <img v-if="form.profileImage" :src="form.profileImage" class="h-20 w-20 rounded-2xl object-cover border" style="border-color:var(--border)">
          <div v-else class="icon-box h-20 w-20">حساب</div>
          <FormField label="صورة البروفايل" hint="اختياري، تظهر أعلى النظام وداخل سجل العمليات"><input class="input" type="file" accept="image/*" @change="onImage"></FormField>
        </div>
        <FormField label="الاسم الكامل" hint="الاسم الذي يظهر في لوحة التحكم والفواتير"><input v-model="form.fullName" class="input"></FormField>
        <FormField label="اسم الدخول" hint="اسم المستخدم الخاص بتسجيل الدخول"><input v-model="form.username" class="input"></FormField>
        <FormField label="كلمة مرور جديدة" hint="اتركها فارغة إذا لا تريد تغييرها"><input v-model="form.password" type="password" class="input"></FormField>
        <button class="btn-primary btn" :disabled="busy" @click="save">{{busy?'جاري الحفظ':'حفظ بيانات الحساب'}}</button>
      </div></div>
      <div class="card p-6"><h2 class="text-xl font-black mb-4">الثيم والواجهة</h2><button class="btn-primary btn" @click="toggleTheme">تبديل الثيم الحالي</button><p class="mt-3 text-muted">الثيم الحالي: {{theme==='dark'?'داكن':'فاتح'}}</p><div class="mt-5 soft-card p-4"><b>الصلاحية الحالية:</b><p class="text-muted mt-2">{{roleName(auth.user?.role)}}</p></div><div class="mt-4 soft-card p-4"><b>الأقسام المسموحة:</b><p class="text-muted mt-2">{{allowedSections}}</p></div></div>
    </div>
  </section>
</template>
<script setup lang="ts">
const auth=useAuthStore(); const {theme,toggleTheme}=useTheme(); const message=ref(''); const messageType=ref<'ok'|'error'>('ok'); const busy=ref(false)
const form=reactive({fullName:auth.user?.fullName||'',username:auth.user?.username||'',password:'',profileImage:auth.user?.profileImage||''})
function notify(t:string,type:'ok'|'error'='ok'){message.value=t;messageType.value=type;setTimeout(()=>message.value='',3000)}
function onImage(e:any){ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>form.profileImage=String(r.result); r.readAsDataURL(f) }
function roleName(r:string){ return {ADMIN:'مدير النظام',ACCOUNTANT:'محاسب',SALES:'موظف مبيعات',VIEWER:'مشاهدة فقط'}[r] || r }
const allowedSections=computed(()=>auth.user?.role==='ADMIN'?'كل الأقسام':((auth.user?.permissions||[]).join('، ')||'حسب الصلاحية الافتراضية'))
async function save(){ busy.value=true; try{ const r:any=await $fetch('/api/profile',{method:'PATCH',body:form}); auth.user=r.user; form.password=''; notify('تم حفظ بيانات الحساب') }catch(e:any){notify(e?.data?.message||'تعذر حفظ الحساب','error')} finally{busy.value=false} }
</script>
