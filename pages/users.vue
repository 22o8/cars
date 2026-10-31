<script setup lang="ts">
const {users,roleLabels,currentUser}=useAuth()
</script>
<template>
  <section class="work-hero"><div><span class="eyebrow">إدارة الوصول</span><h1>المستخدمون والصلاحيات</h1><p>كل موظف يرى فقط المرحلة المرتبطة بدوره داخل النظام.</p></div><span class="soft-chip">{{users.length}} مستخدم</span></section>
  <section class="user-grid"><article v-for="u in users" :key="u.id" class="card card-v2 user-card-v2" :class="{current:u.id===currentUser.id}"><div class="user-card-top"><div class="user-avatar-lg">{{u.name?.slice(0,1) || 'م'}}</div><div><b>{{u.name}}</b><small>{{roleLabels[u.role]}}</small></div><span v-if="u.id===currentUser.id" class="current-chip">الحالي</span></div><div class="user-card-status"><span :class="u.active?'on':'off'"></span><b>{{u.active?'نشط':'غير نشط'}}</b></div></article></section>
</template>
