<!-- Dashboard widget: carry-over from last term into the current one -->
<script setup lang="ts">
const { ensureTerms, t } = useTerms()
void ensureTerms()
const ret = useRetention()

const loading = ref(true)
const snap = ref<{ pct: number; from: string; to: string; nNew: number; total: number } | null>(null)

async function load() {
  loading.value = true
  try {
    const data = await ret.loadData()
    const today = new Date().toISOString().slice(0, 10)
    const withPeople = (data.terms ?? []).filter((tr: any) => [...data.memberTerms.values()].some((set: any) => set.has(tr.id)))
    const sorted = withPeople.sort((a: any, b: any) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
    const currentIdx = sorted.findIndex((tr: any) => (tr.start_date ?? '') <= today && (tr.end_date ?? '') >= today)
    const bIdx = currentIdx >= 0 ? currentIdx : sorted.length - 1
    if (bIdx < 1) { snap.value = null; loading.value = false; return }
    const A = sorted[bIdx - 1], B = sorted[bIdx]
    const r = ret.compute(data, A.id, B.id)
    const transferred = r.segments.find((s: any) => s.key === 'transferred')?.count ?? r.people.filter((p: any) => p.status === 'transferred').length
    snap.value = {
      pct: r.countA ? Math.round((transferred / r.countA) * 100) : 0,
      from: A.name, to: B.name,
      nNew: r.people.filter((p: any) => p.status === 'new').length,
      total: r.countB,
    }
  } catch { snap.value = null }
  loading.value = false
}
onMounted(load)
</script>

<template>
  <NuxtLink to="/groups/retention" class="card h-full p-0 overflow-hidden flex items-stretch hover:shadow-md transition-all">
    <div class="w-12 md:w-16 shrink-0 flex items-center justify-center text-white"
      :style="{ backgroundColor: (snap?.pct ?? 0) >= 80 ? '#10B981' : (snap?.pct ?? 0) >= 60 ? '#D97706' : '#DC2626' }">
      <i class="pi pi-heart text-base md:text-xl" />
    </div>
    <div class="min-w-0 flex-1 px-3 md:px-4 flex flex-col justify-center">
      <p class="text-xl md:text-3xl font-bold text-gray-900 leading-none">{{ loading ? '…' : (snap ? snap.pct + '%' : '—') }}</p>
      <p class="text-[11px] md:text-sm font-medium text-gray-600 mt-0.5 md:mt-1.5">Retention</p>
      <p class="hidden md:block text-[11px] text-gray-400 truncate">{{ snap ? `${snap.from} → ${snap.to} · ${snap.nNew} new` : 'Needs two terms of members' }}</p>
    </div>
  </NuxtLink>
</template>
