<script setup lang="ts">
const { companies, addCompany, updateCompany, removeCompany, syncStatus, lastSyncAt, refreshCloud } = useTransactions()
const { currentUser } = useAuth()
const name = ref(''), code = ref('')
function add(){ if(!name.value.trim()) return; addCompany(name.value.trim(), code.value.trim()); name.value=''; code.value='' }
const syncLabel = computed(() => ({ idle:'تهيئة المزامنة', syncing:'جاري المزامنة...', online:'متزامن مع جميع الأجهزة', offline:'غير متصل — التغييرات محفوظة محلياً', error:'تعذر المزامنة السحابية' }[syncStatus.value] || ''))
</script>
<template>
  <section class="work-hero companies-hero">
    <div><span class="eyebrow">قاعدة موحدة</span><h1>الشركات والرموز</h1><p>أي إضافة أو تعديل هنا يتزامن تلقائياً مع الهاتف والحاسبة وجميع الأجهزة.</p></div>
    <div class="sync-card" :class="`sync-${syncStatus}`"><span class="sync-led"></span><div><b>{{syncLabel}}</b><small v-if="lastSyncAt">آخر مزامنة {{new Date(lastSyncAt).toLocaleTimeString('ar-IQ')}}</small></div><button class="btn mini ghost" @click="refreshCloud">تحديث الآن</button></div>
  </section>

  <section class="companies-layout">
    <article class="card card-v2 company-add-card"><div class="card-kicker"><span class="step-number">+</span><div><small>شركة جديدة</small><h2>إضافة إلى القاعدة</h2></div></div><div class="field"><label>اسم الشركة</label><input v-model="name" class="input input-lg" placeholder="اسم الشركة الكامل"></div><div class="field"><label>رمز الشركة</label><input v-model="code" class="input input-lg code-input" inputmode="numeric" placeholder="رمز ASYCUDA"></div><button class="btn primary btn-wide" :disabled="!name.trim()" @click="add">إضافة الشركة</button></article>

    <article class="card card-v2 companies-list-card"><div class="section-title section-title-v2"><div><span class="eyebrow">القاعدة الحالية</span><h2>الشركات المسجلة</h2></div><span class="soft-chip">{{companies.length}} شركة</span></div><div class="company-list-v2"><div v-for="c in companies" :key="c.id" class="company-row-v2"><div class="company-avatar">{{c.name?.slice(0,1) || 'ش'}}</div><div class="field company-name-field"><label>اسم الشركة</label><input v-model="c.name" class="input" @change="updateCompany(c)"></div><div class="field company-code-field"><label>رمز الشركة</label><input v-model="c.code" class="input code-input" placeholder="رمز الشركة" @change="updateCompany(c)"></div><button v-if="currentUser.role==='admin'" class="btn danger mini" @click="removeCompany(c.id)">حذف</button></div><div v-if="!companies.length" class="empty empty-v2"><b>لا توجد شركات بعد</b><span>أضف أول شركة من النموذج المجاور.</span></div></div></article>
  </section>
</template>
