<script setup lang="ts">
const {users,roleLabels,currentUser}=useAuth()
</script>
<template><div class="page-head"><div><h1>المستخدمون والصلاحيات</h1><p>كل مرحلة مرتبطة بصلاحية وظيفية مستقلة</p></div></div><div class="card"><div class="table-wrap"><table class="table" style="min-width:650px"><thead><tr><th>المستخدم</th><th>الدور</th><th>الحالة</th></tr></thead><tbody><tr v-for="u in users" :key="u.id"><td>{{u.name}} <span v-if="u.id===currentUser.id" class="pill">الحالي</span></td><td>{{roleLabels[u.role]}}</td><td><StatusBadge :status="u.active?'done':'blocked'"/></td></tr></tbody></table></div></div></template>
