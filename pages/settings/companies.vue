<script setup lang="ts">
const { companies, addCompany, updateCompany, removeCompany, syncStatus, lastSyncAt, refreshCloud } = useTransactions()
const { currentUser } = useAuth()
const name = ref(''), code = ref('')
function add(){ if(!name.value.trim()) return; addCompany(name.value.trim(), code.value.trim()); name.value=''; code.value='' }
const syncLabel = computed(() => ({ idle:'تهيئة المزامنة', syncing:'جاري المزامنة...', online:'متزامن مع جميع الأجهزة', offline:'غير متصل — التغييرات محفوظة محلياً', error:'تعذر المزامنة السحابية' }[syncStatus.value] || ''))
</script>
<template>
  <div class="page-head">
    <div><h1>الشركات والرموز</h1><p>قاعدة مركزية مشتركة — أي تعديل يظهر على جميع الأجهزة تلقائياً</p></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span class="pill">{{syncLabel}}</span>
      <small v-if="lastSyncAt" class="muted">آخر مزامنة: {{new Date(lastSyncAt).toLocaleTimeString('ar-IQ')}}</small>
      <button class="btn ghost" @click="refreshCloud">تحديث الآن</button>
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="table-wrap"><table class="table" style="min-width:600px">
        <thead><tr><th>اسم الشركة</th><th>رمز الشركة</th><th></th></tr></thead>
        <tbody><tr v-for="c in companies" :key="c.id">
          <td><input v-model="c.name" class="input" @change="updateCompany(c)"></td>
          <td><input v-model="c.code" class="input" placeholder="رمز الشركة" @change="updateCompany(c)"></td>
          <td><button v-if="currentUser.role==='admin'" class="btn danger" @click="removeCompany(c.id)">حذف</button></td>
        </tr></tbody>
      </table></div>
    </div>
    <div class="card"><h3>إضافة شركة</h3>
      <div class="field"><label>اسم الشركة</label><input v-model="name" class="input"></div>
      <div class="field" style="margin-top:10px"><label>رمز الشركة</label><input v-model="code" class="input"></div>
      <button class="btn primary" style="margin-top:14px" @click="add">إضافة</button>
    </div>
  </div>
</template>
