<!-- Dashboard widget: where each term sequence is right now + next-term readiness -->
<script setup lang="ts">
const { ensureTerms, t } = useTerms()
void ensureTerms()
import { termSignupOpen } from '~/composables/useTermsMemberships'
const tm = useTermsMemberships()
const tr = useTermRollover()

const loading = ref(true)
const rows = ref<{ set: string; term: string; state: string; stateClass: string; days: string }[]>([])
const readiness = ref<string | null>(null)

async function load() {
  loading.value = true
  const [terms, sets] = await Promise.all([tm.loadTerms(), tm.loadTermSets()])
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const seqs: { key: string | null; name: string }[] = [{ key: null, name: `Main ${t('term', true, true)}` }, ...sets.map((s: any) => ({ key: s.id, name: s.name }))]
  const out: typeof rows.value = []
  for (const seq of seqs) {
    const seqTerms = terms.filter((x: any) => (x.set_id ?? null) === seq.key && x.start_date && x.end_date)
    if (!seqTerms.length) continue
    const current = seqTerms.find((x: any) => x.start_date <= today.toISOString().slice(0, 10) && x.end_date >= today.toISOString().slice(0, 10))
    if (current) {
      const daysLeft = Math.ceil((new Date(current.end_date).getTime() - today.getTime()) / 86400000)
      const signup = termSignupOpen(current) ? 'Sign-ups open' : 'Sign-ups closed'
      out.push({ set: seq.name, term: current.name, state: signup, stateClass: signup === 'Sign-ups open' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500', days: `${daysLeft}d left` })
    } else {
      const next = seqTerms.filter((x: any) => x.start_date > today.toISOString().slice(0, 10)).sort((a: any, b: any) => a.start_date.localeCompare(b.start_date))[0]
      if (next) {
        const inDays = Math.ceil((new Date(next.start_date).getTime() - today.getTime()) / 86400000)
        out.push({ set: seq.name, term: next.name, state: 'Starts soon', stateClass: 'bg-sky-50 text-sky-700', days: `in ${inDays}d` })
      }
    }
  }
  rows.value = out
  try {
    const nudge = await tr.rolloverNudge()
    readiness.value = nudge ? `${nudge.total - nudge.remaining} of ${nudge.total} ${t('group', true, true)} rolled into the next ${t('term', false, true)}` : null
  } catch { readiness.value = null }
  loading.value = false
}
onMounted(load)
</script>

<template>
  <AppCard :title="`Season pulse`" class="h-full">
    <template #header-action>
      <NuxtLink to="/settings/terms" class="text-xs font-medium text-primary hover:underline">{{ t('term', true) }} →</NuxtLink>
    </template>
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <p v-else-if="!rows.length" class="text-sm text-gray-400 py-3 text-center">No {{ t('term', true, true) }} with dates yet.</p>
      <template v-else>
        <ul class="divide-y divide-gray-50">
          <li v-for="(r, i) in rows" :key="i" class="py-2 flex items-center gap-2 text-sm">
            <span class="text-xs text-gray-400 w-28 shrink-0 truncate">{{ r.set }}</span>
            <span class="font-medium text-gray-800 truncate">{{ r.term }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0" :class="r.stateClass">{{ r.state }}</span>
            <span class="ml-auto text-xs text-gray-400 shrink-0">{{ r.days }}</span>
          </li>
        </ul>
        <p v-if="readiness" class="text-xs mt-2 px-3 py-2 rounded-lg" style="background:#EAF1FE;color:#2563EB">{{ readiness }} — <NuxtLink to="/groups/rollover" class="underline font-medium">roll over →</NuxtLink></p>
      </template>
    </div>
  </AppCard>
</template>
