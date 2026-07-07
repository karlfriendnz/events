<!--
  MEMBERSHIPS BOARD (migration 240) — the club's membership passes, built on
  the group engine (member_groups kind='membership'). Each row opens the group
  detail page in membership mode (/groups/:id — no timetable, plus the
  "This membership includes" entitlements card).
-->
<script setup lang="ts">
import { isMembershipGroup } from '~/composables/useMemberships'

const db = useDb()
const { orgId } = useOrg()
const gc = useGroupCodes()
const gf = useGroupFees()
const wl = useWaitlists()
const ms = useMemberships()
const { ensureTerms, t } = useTerms()
void ensureTerms()
useBreadcrumbs([{ label: 'Memberships' }])

const loading = ref(true)
interface Row {
  id: string; name: string; color: string | null; capacity: number | null
  codeId: string | null
  members: number; feeLabel: string | null; feeCount: number
  waitlistId: string | null; waiting: number; included: number
}
const rows = ref<Row[]>([])
const codesById = ref<Record<string, any>>({})
// Board sections: one per PROGRAMME (code) that holds memberships — the
// umbrella ("Senior Membership") over its tiers (Annual / Monthly) — plus a
// plain section for standalone memberships.
const sections = computed(() => {
  const byCode: Record<string, Row[]> = {}
  const loose: Row[] = []
  for (const r of rows.value) (r.codeId ? (byCode[r.codeId] ??= []).push(r) : loose.push(r))
  const out = Object.entries(byCode).map(([codeId, list]) => ({
    codeId, name: codesById.value[codeId]?.name ?? 'Programme', color: codesById.value[codeId]?.color ?? null, list,
  })).sort((a, b) => a.name.localeCompare(b.name))
  return { grouped: out, loose }
})

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [{ data: groups }, { data: mems }, { data: feeOpts }, ents, wlCounts, codes] = await Promise.all([
    (db.from as any)('member_groups').select('id, name, color, capacity, waitlist_id, kind, code_id').eq('org_id', orgId.value).eq('kind', 'membership').order('name'),
    (db.from as any)('member_group_memberships').select('group_id, group:member_groups!inner(org_id, kind)').eq('group.org_id', orgId.value).eq('group.kind', 'membership'),
    (db.from as any)('group_fee_options').select('id, group_id, name, fee_type, period_unit, period_count, instalment_count, session_count, prorata, items:group_fee_option_items(amount)').eq('org_id', orgId.value),
    ms.loadAllEntitlements(),
    wl.entryCounts(),
    gc.loadCodes(),
  ])
  codesById.value = Object.fromEntries((codes ?? []).map((c: any) => [c.id, c]))
  const memberCounts: Record<string, number> = {}
  for (const m of (mems ?? [])) memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1
  const feesByGroup: Record<string, any[]> = {}
  for (const f of (feeOpts ?? [])) (feesByGroup[f.group_id] ??= []).push(f)
  const entCounts: Record<string, number> = {}
  for (const e of ents) entCounts[e.membership_group_id] = (entCounts[e.membership_group_id] || 0) + 1
  rows.value = (groups ?? []).map((g: any) => {
    const fees = feesByGroup[g.id] ?? []
    return {
      id: g.id, name: g.name, color: g.color, capacity: g.capacity, codeId: g.code_id ?? null,
      members: memberCounts[g.id] ?? 0,
      feeLabel: fees.length === 1 ? gf.priceLabel(fees[0]) : fees.length > 1 ? `${fees.length} options` : null,
      feeCount: fees.length,
      waitlistId: g.waitlist_id, waiting: g.waitlist_id ? (wlCounts[g.waitlist_id] ?? 0) : 0,
      included: entCounts[g.id] ?? 0,
    }
  })
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })

// ── New membership ──
const showCreate = ref(false)
const creating = ref(false)
const PALETTE = ['#1E2157', '#0f766e', '#9333ea', '#c2410c', '#0369a1', '#be123c', '#15803d', '#4338ca']
const newMs = reactive({ name: '', color: PALETTE[0] })
async function create() {
  if (!newMs.name.trim()) return
  creating.value = true
  const { data, error } = await (db.from as any)('member_groups')
    .insert({ org_id: orgId.value, name: newMs.name.trim(), color: newMs.color, kind: 'membership' })
    .select('id').single()
  creating.value = false
  if (error) return
  showCreate.value = false
  newMs.name = ''
  if (data?.id) navigateTo(`/memberships/${data.id}`)
}
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4">
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm text-gray-500 max-w-2xl">A membership is a pass people hold — with its own fee options, capacity, waitlist and management — that can <strong>include access to {{ t('group', true, true) }}, programmes and {{ t('event', true, true) }}</strong>. Per-{{ t('group', false, true) }} money stays on each {{ t('group', false, true) }}; memberships are for access that spans more than one.</p>
      <Button label="New membership" icon="pi pi-plus" size="small" class="shrink-0"
        style="background:#1E2157;border-color:#1E2157" @click="showCreate = true" />
    </div>

    <div v-if="loading" class="card p-16 text-center text-gray-400 text-sm">
      <i class="pi pi-spin pi-spinner text-2xl mb-2 block" /> Loading…
    </div>

    <div v-else-if="!rows.length" class="card p-12 text-center text-sm text-gray-500">
      <i class="pi pi-id-card text-3xl text-gray-300 mb-3 block" />
      <p class="font-semibold text-gray-700 mb-1">No memberships yet</p>
      <p class="max-w-md mx-auto">Create one, set how people pay (one-off, monthly, yearly…), then choose what it includes — whole programmes, single {{ t('group', true, true) }}, or {{ t('event', true, true) }}.</p>
    </div>

    <!-- Desktop table -->
    <div v-else class="card p-0 overflow-hidden hidden md:block">
      <table class="w-full text-sm">
        <colgroup><col /><col class="w-36" /><col class="w-52" /><col class="w-32" /><col class="w-40" /></colgroup>
        <thead>
          <tr class="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <th class="px-4 sm:px-5 py-2.5">Membership</th>
            <th class="px-3 py-2.5">Members</th>
            <th class="px-3 py-2.5">Price</th>
            <th class="px-3 py-2.5">Waitlist</th>
            <th class="px-3 py-2.5">Includes</th>
          </tr>
        </thead>
        <tbody v-for="sec in sections.grouped" :key="sec.codeId" class="divide-y divide-gray-100 border-b border-gray-100">
          <!-- Programme umbrella row — click for the everyone-across-tiers report -->
          <tr class="bg-gray-50/70 hover:bg-gray-100 cursor-pointer" @click="navigateTo(`/memberships/programme/${sec.codeId}`)">
            <td class="px-4 sm:px-5 py-2" colspan="5">
              <span class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: sec.color || '#94a3b8' }" />
                <span class="text-xs font-bold uppercase tracking-wide text-gray-500">{{ sec.name }}</span>
                <span class="text-xs text-gray-400">· {{ sec.list.reduce((a, r) => a + r.members, 0) }} member{{ sec.list.reduce((a, r) => a + r.members, 0) === 1 ? '' : 's' }} across {{ sec.list.length }} tier{{ sec.list.length === 1 ? '' : 's' }}</span>
                <span class="ml-auto text-xs text-primary font-medium">View everyone →</span>
              </span>
            </td>
          </tr>
          <tr v-for="r in sec.list" :key="r.id" class="hover:bg-gray-50 cursor-pointer" @click="navigateTo(`/memberships/${r.id}`)">
            <td class="px-4 sm:px-5 py-3">
              <span class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: r.color || '#94a3b8' }" />
                <span class="font-semibold text-gray-900">{{ r.name }}</span>
              </span>
            </td>
            <td class="px-3 py-3 num">{{ r.members }}<span v-if="r.capacity" class="text-gray-400"> / {{ r.capacity }}</span></td>
            <td class="px-3 py-3">
              <span v-if="r.feeLabel" class="text-gray-700">{{ r.feeLabel }}</span>
              <span v-else class="text-red-500 text-xs">No fee yet</span>
            </td>
            <td class="px-3 py-3">
              <span v-if="r.waitlistId" class="text-gray-700">{{ r.waiting }} waiting</span>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="px-3 py-3">
              <span v-if="r.included" class="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{{ r.included }} thing{{ r.included === 1 ? '' : 's' }} included</span>
              <span v-else class="text-xs text-gray-400">Nothing connected</span>
            </td>
          </tr>
        </tbody>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="r in sections.loose" :key="r.id" class="hover:bg-gray-50 cursor-pointer" @click="navigateTo(`/memberships/${r.id}`)">
            <td class="px-4 sm:px-5 py-3">
              <span class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: r.color || '#94a3b8' }" />
                <span class="font-semibold text-gray-900">{{ r.name }}</span>
              </span>
            </td>
            <td class="px-3 py-3 num">{{ r.members }}<span v-if="r.capacity" class="text-gray-400"> / {{ r.capacity }}</span></td>
            <td class="px-3 py-3">
              <span v-if="r.feeLabel" class="text-gray-700">{{ r.feeLabel }}</span>
              <span v-else class="text-red-500 text-xs">No fee yet</span>
            </td>
            <td class="px-3 py-3">
              <span v-if="r.waitlistId" class="text-gray-700">{{ r.waiting }} waiting</span>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="px-3 py-3">
              <span v-if="r.included" class="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{{ r.included }} thing{{ r.included === 1 ? '' : 's' }} included</span>
              <span v-else class="text-xs text-gray-400">Nothing connected</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile cards -->
    <div v-if="!loading && rows.length" class="md:hidden bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      <NuxtLink v-for="r in rows" :key="r.id" :to="`/memberships/${r.id}`" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: r.color || '#94a3b8' }" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 truncate">{{ r.name }}</p>
          <p class="text-xs text-gray-500 truncate">{{ r.members }} member{{ r.members === 1 ? '' : 's' }}<span v-if="r.feeLabel"> · {{ r.feeLabel }}</span><span v-if="r.included"> · {{ r.included }} included</span></p>
        </div>
        <i class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
      </NuxtLink>
    </div>

    <!-- New membership -->
    <Dialog v-model:visible="showCreate" modal header="New membership" :style="{ width: '95vw', maxWidth: '440px' }">
      <div class="space-y-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Name</label>
          <InputText v-model="newMs.name" placeholder="e.g. Senior Membership" class="w-full" autofocus @keyup.enter="create" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-700 mr-1">Colour</span>
          <button v-for="c in PALETTE" :key="c" type="button" @click="newMs.color = c"
            class="w-6 h-6 rounded-full border-2 transition"
            :class="newMs.color === c ? 'border-gray-800 scale-110' : 'border-transparent'"
            :style="{ background: c }" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showCreate = false" />
        <Button label="Create" :loading="creating" :disabled="!newMs.name.trim()"
          style="background:#1E2157;border-color:#1E2157" @click="create" />
      </template>
    </Dialog>
  </div>
</template>
