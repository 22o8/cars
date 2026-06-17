<template>
  <section class="page-pad">
    <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-2xl font-black md:text-3xl">سجلات البيع والشراء</h1>
        <p class="mt-1 text-sm text-muted">قائمتان منفصلتان لكل السيارات المباعة والمشتراة مع الواصل والباقي والموعد.</p>
      </div>
      <NuxtLink to="/" class="btn-primary btn justify-center">تنفيذ سريع</NuxtLink>
    </div>

    <div class="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="card p-4"><div class="text-xs font-bold text-muted">عدد المبيعات</div><div class="mt-2 text-lg font-black">{{ data?.latestSales?.length || 0 }}</div></div>
      <div class="card p-4"><div class="text-xs font-bold text-muted">عدد المشتريات</div><div class="mt-2 text-lg font-black">{{ data?.latestPurchases?.length || 0 }}</div></div>
      <div class="card p-4"><div class="text-xs font-bold text-muted">باقي البيع</div><div class="mt-2 text-lg font-black text-amber-500">{{ money(data?.debtIqd || 0, 'IQD') }}</div></div>
      <div class="card p-4"><div class="text-xs font-bold text-muted">باقي الشراء</div><div class="mt-2 text-lg font-black text-amber-500">{{ money(data?.purchaseDebtIqd || 0, 'IQD') }}</div></div>
    </div>

    <div class="grid gap-5 xl:grid-cols-2">
      <div class="card p-4 md:p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-black">السيارات التي تم بيعها</h2>
            <p class="text-sm text-muted">كل عمليات البيع مع الواصل والباقي.</p>
          </div>
          <NuxtLink to="/sales" class="btn-secondary btn py-2 text-xs">صفحة البيع</NuxtLink>
        </div>
        <div v-if="!data?.latestSales?.length" class="soft-card p-6 text-center text-muted">لا توجد عمليات بيع بعد</div>
        <div v-for="s in data?.latestSales" :key="s.id" class="history-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-black">{{ s.car?.brand }} {{ s.car?.model }}</div>
              <div class="mt-1 text-sm text-muted">العميل: {{ s.customer?.fullName || '-' }} <span v-if="s.customer?.phone">- {{ s.customer.phone }}</span></div>
              <div class="mt-1 text-xs text-muted">تاريخ البيع: {{ dateText(s.saleDate) }} <span v-if="nextInstallment(s)">- موعد القسط: {{ dateText(nextInstallment(s)?.dueDate) }}</span></div>
            </div>
            <span class="rounded-xl bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-500">بيع</span>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div class="soft-card p-3"><span class="text-muted">القيمة</span><b class="block">{{ money(s.salePrice, s.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الواصل</span><b class="block text-emerald-500">{{ money(s.paidAmount, s.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الباقي</span><b class="block text-amber-500">{{ money(s.remainingAmount, s.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الحالة</span><b class="block">{{ Number(s.remainingAmount) > 0 ? 'عليه قسط' : 'مسدد' }}</b></div>
          </div>
        </div>
      </div>

      <div class="card p-4 md:p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-black">السيارات التي تم شراؤها</h2>
            <p class="text-sm text-muted">كل عمليات الشراء مع الواصل والباقي.</p>
          </div>
          <NuxtLink to="/purchases" class="btn-secondary btn py-2 text-xs">صفحة الشراء</NuxtLink>
        </div>
        <div v-if="!data?.latestPurchases?.length" class="soft-card p-6 text-center text-muted">لا توجد عمليات شراء بعد</div>
        <div v-for="p in data?.latestPurchases" :key="p.id" class="history-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-black">{{ p.carName }}</div>
              <div class="mt-1 text-sm text-muted">صاحب السيارة: {{ p.sellerName || '-' }} <span v-if="p.sellerPhone">- {{ p.sellerPhone }}</span></div>
              <div class="mt-1 text-xs text-muted">من تاريخ: {{ dateText(p.fromDate) }} - موعد التسديد: {{ p.dueDate ? dateText(p.dueDate) : '-' }}</div>
            </div>
            <span class="rounded-xl bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500">شراء</span>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div class="soft-card p-3"><span class="text-muted">سعر السيارة</span><b class="block">{{ money(p.totalAmount, p.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الواصل</span><b class="block text-emerald-500">{{ money(p.paidAmount, p.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الباقي</span><b class="block text-amber-500">{{ money(p.remainingAmount, p.currency) }}</b></div>
            <div class="soft-card p-3"><span class="text-muted">الحالة</span><b class="block">{{ purchaseStatus(p.status) }}</b></div>
          </div>
          <div v-if="Array.isArray(p.imageUrls) && p.imageUrls.length" class="mt-3 flex gap-2 overflow-x-auto">
            <img v-for="(img, i) in p.imageUrls" :key="i" :src="img" class="h-16 w-20 rounded-xl border object-cover" style="border-color: var(--border)" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { data, refresh } = useLazyFetch<any>('/api/dashboard')
onMounted(() => refresh())
function nextInstallment(s: any) { return Array.isArray(s?.installments) ? s.installments.find((i: any) => i.status !== 'PAID') : null }
function purchaseStatus(s: string) { return ({ OPEN: 'مفتوح', PAID: 'مدفوع', LATE: 'متأخر' } as any)[s] || s || '-' }
</script>

<style scoped>
.history-card { margin-bottom:.75rem; border:1px solid var(--border); background:var(--panel-2); border-radius:1.25rem; padding:1rem; }
@media (max-width: 640px) { .history-card { padding:.85rem; } }
</style>
