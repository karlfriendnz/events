<!-- Dashboard widget: outstanding money across registrations -->
<script setup lang="ts">
const { orgId } = useOrg()
const financesApi = useFinancesApi()

const loading = ref(true)
const owed = ref(0)
const owing = ref(0)
async function load() {
  if (!orgId.value) return
  loading.value = true
  // Org-wide outstanding rollup on the seam (Σ max(0, total − paid) + count owing).
  const { owed: sum, count } = await financesApi.outstandingByOrg(orgId.value)
  owed.value = sum
  owing.value = count
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })
const fmt = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n)
</script>

<template>
  <NuxtLink to="/finances" class="card h-full p-0 overflow-hidden flex items-stretch hover:shadow-md transition-all">
    <div class="w-12 md:w-16 shrink-0 flex items-center justify-center text-white" :style="{ backgroundColor: owed > 0 ? '#DC2626' : '#10B981' }">
      <i class="pi pi-wallet text-base md:text-xl" />
    </div>
    <div class="min-w-0 flex-1 px-3 md:px-4 flex flex-col justify-center">
      <p class="text-xl md:text-3xl font-bold text-gray-900 leading-none">{{ loading ? '…' : fmt(owed) }}</p>
      <p class="text-[11px] md:text-sm font-medium text-gray-600 mt-0.5 md:mt-1.5">Outstanding</p>
      <p class="hidden md:block text-[11px] text-gray-400 truncate">{{ owing }} unpaid registration{{ owing === 1 ? '' : 's' }}</p>
    </div>
  </NuxtLink>
</template>
