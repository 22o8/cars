<template>
  <section class="page-pad fast-fade">
    <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-3xl font-black">سجل العمليات والتدقيق</h1>
        <p class="text-muted mt-2">كل تعديل وحذف وإضافة مهمّة يظهر هنا لمتابعة الموظفين وحماية بيانات المعرض.</p>
      </div>
      <button class="btn-primary btn" @click="refresh">تحديث السجل</button>
    </div>
    <div class="grid gap-4 lg:grid-cols-4 mb-6">
      <div class="card p-5 stat-card"><p class="text-muted">إجمالي العمليات المعروضة</p><b class="stat-value">{{ rows.length }}</b></div>
      <div class="card p-5 stat-card"><p class="text-muted">عمليات اليوم</p><b class="stat-value text-blue-500">{{ todayCount }}</b></div>
      <div class="card p-5 stat-card"><p class="text-muted">عمليات حذف</p><b class="stat-value text-red-500">{{ deleteCount }}</b></div>
      <div class="card p-5 stat-card"><p class="text-muted">عمليات مالية</p><b class="stat-value text-emerald-500">{{ moneyCount }}</b></div>
    </div>
    <div class="card overflow-x-auto">
      <table class="table">
        <thead><tr><th>التاريخ</th><th>المستخدم</th><th>العملية</th><th>القسم</th><th>التفاصيل</th></tr></thead>
        <tbody>
          <tr v-for="x in rows" :key="x.id">
            <td>{{ dateTimeText(x.createdAt) }}</td>
            <td class="font-black">{{ x.userName }}</td>
            <td>{{ x.action }}</td>
            <td>{{ x.entity }}</td>
            <td class="max-w-xl whitespace-normal text-muted">{{ x.details || '-' }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="5" class="py-8 text-center text-muted">لا توجد عمليات مسجلة بعد.</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts">
const { data, refresh } = useFetch<any[]>('/api/audit-logs', { default: () => [] })
const rows = computed(() => data.value || [])
const today = new Date().toISOString().slice(0, 10)
const todayCount = computed(() => rows.value.filter(x => String(x.createdAt).slice(0, 10) === today).length)
const deleteCount = computed(() => rows.value.filter(x => String(x.action || '').includes('حذف')).length)
const moneyCount = computed(() => rows.value.filter(x => ['Sale','Payment','Invoice','Expense','CashboxTransaction','Installment'].includes(x.entity)).length)
</script>
