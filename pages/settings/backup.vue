<template>
  <section class="page-pad fast-fade">
    <div class="mb-6"><h1 class="text-3xl font-black">النسخ الاحتياطي والضبط</h1><p class="text-muted mt-2">تنزيل نسخة احتياطية، استعادة البيانات، أو إعادة ضبط المصنع بشكل آمن.</p></div>
    <SettingsTabs />
    <div v-if="message" class="mb-4 rounded-2xl border p-4 font-bold" :class="messageType==='error'?'border-red-500/40 text-red-500':'border-emerald-500/40 text-emerald-500'">{{message}}</div>
    <div class="grid gap-6 xl:grid-cols-4">
      <div class="card p-6"><h2 class="text-xl font-black mb-4">تنزيل نسخة احتياطية</h2><p class="text-muted mb-4">ينزل ملف JSON يحتوي بيانات السيارات والعملاء والمبيعات والأقساط والفواتير والخزنة والإعدادات.</p><button class="btn-primary btn w-full" @click="downloadBackup">تنزيل النسخة الآن</button></div>
      <div class="card p-6"><h2 class="text-xl font-black mb-4">استعادة نسخة احتياطية</h2><p class="text-muted mb-4">اختر ملف JSON تم تنزيله من النظام. يفضل تنزيل نسخة جديدة قبل الاستعادة.</p><FormField label="ملف النسخة الاحتياطية" hint="صيغة JSON فقط"><input class="input" type="file" accept="application/json,.json" @change="onBackupFile"></FormField><button class="btn-secondary btn w-full mt-4" :disabled="!backupFile || busy" @click="restoreBackup">استعادة البيانات</button></div>
      <div class="card p-6"><h2 class="text-xl font-black mb-4 text-red-400">إعادة ضبط المصنع</h2><p class="text-muted mb-4">يمسح كل البيانات التشغيلية ويرجع النظام جديد، مع إبقاء حساب المدير والإعدادات الأساسية.</p><FormField label="رمز التأكيد" hint="اكتب RESET-AUTODEALER بالضبط"><input v-model="confirmCode" class="input" placeholder="RESET-AUTODEALER"></FormField><button class="btn-danger btn mt-4 w-full" :disabled="busy" @click="factoryReset">مسح كل البيانات</button></div>
      <div class="card p-6"><h2 class="text-xl font-black mb-4">فحص جاهزية الإنتاج</h2><p class="text-muted mb-4">يفحص ربط الجداول الأساسية ويعرض عدد السجلات للتأكد أن النظام مربوط بالكامل.</p><button class="btn-secondary btn w-full" :disabled="busy" @click="verifySystem">فحص النظام الآن</button><NuxtLink to="/audit-logs" class="btn-primary btn w-full mt-3">فتح سجل العمليات</NuxtLink></div>
    </div>
    <div v-if="verifyResult" class="mt-6 rounded-2xl border p-4" style="border-color:var(--border); background:var(--panel-2)"><b>نتيجة الفحص:</b><pre class="mt-3 overflow-x-auto text-sm text-muted">{{ JSON.stringify(verifyResult.counts, null, 2) }}</pre></div>
    <div class="grid gap-6 lg:grid-cols-2 mt-6">
      <div class="card p-6"><h2 class="text-xl font-black mb-4">معلومات التشغيل</h2><div class="space-y-3 text-muted leading-8"><p>النظام يعمل كتطبيق PWA على الهاتف والحاسوب.</p><p>قاعدة البيانات PostgreSQL مربوطة عبر Neon.</p><p>لا ترفع ملف .env إلى GitHub لأنه يحتوي بيانات الاتصال السرية.</p><p>إعادة ضبط المصنع لا تحذف حساب المدير حتى تستطيع الدخول بعد المسح.</p></div></div>
      <div class="card overflow-x-auto"><table class="table"><thead><tr><th>العنوان</th><th>الحالة</th><th>ملاحظات</th><th>التاريخ</th></tr></thead><tbody><tr v-for="x in data" :key="x.id"><td class="font-black">{{x.title}}</td><td>{{x.status}}</td><td>{{x.notes}}</td><td>{{dateTimeText(x.createdAt)}}</td></tr><tr v-if="!data.length"><td colspan="4" class="py-8 text-center text-muted">لا توجد سجلات نسخ احتياطي بعد.</td></tr></tbody></table></div>
    </div>
  </section>
</template>
<script setup lang="ts">
const {data,refresh}=useFetch<any[]>('/api/backups',{default:()=>[]}); const confirmCode=ref(''); const message=ref(''); const messageType=ref<'ok'|'error'>('ok'); const busy=ref(false); const backupFile=ref<any|null>(null); const verifyResult=ref<any|null>(null)
function notify(t:string,type:'ok'|'error'='ok'){message.value=t;messageType.value=type;setTimeout(()=>message.value='',4500)}
function downloadBackup(){ window.open('/api/backups/export','_blank') }
function onBackupFile(e:any){ backupFile.value=e.target.files?.[0] || null }
async function restoreBackup(){ if(!backupFile.value) return; if(!confirm('هل تريد استعادة النسخة؟')) return; busy.value=true; try{ const text=await backupFile.value.text(); await $fetch('/api/backups/import',{method:'POST',body:{data:JSON.parse(text)}}); await refresh(); notify('تمت استعادة البيانات') }catch(e:any){ notify(e?.data?.message||'فشل استعادة النسخة','error') }finally{ busy.value=false } }
async function verifySystem(){ busy.value=true; try{ verifyResult.value=await $fetch('/api/backups/verify'); notify('تم فحص النظام بنجاح') }catch(e:any){notify(e?.data?.message||'فشل فحص النظام','error')}finally{busy.value=false} }
async function factoryReset(){ if(confirmCode.value!=='RESET-AUTODEALER') return notify('رمز التأكيد غير صحيح','error'); if(!confirm('هل أنت متأكد؟ سيتم حذف كل البيانات التشغيلية.')) return; busy.value=true; try{ await $fetch('/api/settings/reset',{method:'POST',body:{confirm:confirmCode.value}}); confirmCode.value=''; await refresh(); notify('تم مسح البيانات وإرجاع النظام جديد') }catch(e:any){notify(e?.data?.message||'فشل مسح البيانات','error')}finally{busy.value=false} }
</script>
