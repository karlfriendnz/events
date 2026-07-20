<!--
  MEMBERSHIPS BOARD (migration 240) — the club's membership passes, built on
  the group engine (member_groups kind='membership'). Each row opens the group
  detail page in membership mode (/groups/:id — no timetable, plus the
  "This membership includes" entitlements card).
-->
<script setup lang="ts">
import { isMembershipGroup } from '~/composables/useMemberships'

const { orgId } = useOrg()
const gc = useGroupCodes()
const gf = useGroupFees()
const wl = useWaitlists()
const ms = useMemberships()
const groupsApi = useGroupsApi()
const { ensureTerms, t } = useTerms()
void ensureTerms()
useBreadcrumbs([{ label: 'Memberships' }])

const loading = ref(true)
interface Row {
  id: string; name: string; color: string | null; capacity: number | null
  codeId: string | null; sortOrder: number; locationIds: string[]
  members: number; feeLabel: string | null; feeCount: number
  waitlistId: string | null; waiting: number; included: number
}
const rows = ref<Row[]>([])
const codesById = ref<Record<string, any>>({})
// Board sections: one per PROGRAMME (code) that holds memberships — the
// umbrella ("Senior Membership") over its tiers (Annual / Monthly) — plus a
// plain section for standalone memberships.
// Location lens: a membership shows if it's sold everywhere (no locations) or
// at the active site.
const { activeLocationId: lensId, activeLocation: lensLocation } = useActiveLocation()
const lensHintName = computed(() => lensLocation.value?.name ?? null)
// A membership shows if it's sold everywhere (no locations) or at the active
// site. Shared by the desktop sections AND the mobile card list.
const visibleRows = computed(() => rows.value.filter(r => !lensId.value || !r.locationIds.length || r.locationIds.includes(lensId.value)))
const sections = computed(() => {
  const byCode: Record<string, Row[]> = {}
  const loose: Row[] = []
  for (const r of visibleRows.value) (r.codeId ? (byCode[r.codeId] ??= []).push(r) : loose.push(r))
  const out = Object.entries(byCode).map(([codeId, list]) => ({
    codeId, name: codesById.value[codeId]?.name ?? 'Programme', color: codesById.value[codeId]?.color ?? null, list,
  })).sort((a, b) => a.name.localeCompare(b.name))
  return { grouped: out, loose }
})

async function load() {
  if (!orgId.value) return
  loading.value = true
  // Membership-kind groups + all-org membership refs + entitlements + waitlist counts
  // + codes — all via the seam (member_groups/memberships are the groups seam's).
  const [allGroups, mems, ents, wlCounts, codes] = await Promise.all([
    groupsApi.list(orgId.value),
    groupsApi.membershipsByOrg(orgId.value),
    ms.loadAllEntitlements(),
    wl.entryCounts(),
    gc.loadCodes(),
  ])
  const groups = allGroups
    .filter(g => isMembershipGroup(g))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))
  codesById.value = Object.fromEntries((codes ?? []).map((c: any) => [c.id, c]))
  const memGroupIds = new Set(groups.map(g => g.id))
  const memberCounts: Record<string, number> = {}
  for (const m of mems) if (memGroupIds.has(m.groupId)) memberCounts[m.groupId] = (memberCounts[m.groupId] || 0) + 1
  // Each membership's fee options (per-group, in parallel).
  const feeLists = await Promise.all(groups.map(g => gf.loadFeeOptions(g.id)))
  const feesByGroup: Record<string, any[]> = {}
  groups.forEach((g, i) => { feesByGroup[g.id] = feeLists[i] })
  const entCounts: Record<string, number> = {}
  for (const e of ents) entCounts[e.membership_group_id] = (entCounts[e.membership_group_id] || 0) + 1
  rows.value = groups.map((g) => {
    const fees = feesByGroup[g.id] ?? []
    return {
      id: g.id, name: g.name, color: g.color, capacity: g.capacity, codeId: g.codeId ?? null, sortOrder: g.sortOrder ?? 0, locationIds: g.locationIds ?? [],
      members: memberCounts[g.id] ?? 0,
      feeLabel: fees.length === 1 ? gf.priceLabel(fees[0]) : fees.length > 1 ? `${fees.length} options` : null,
      feeCount: fees.length,
      waitlistId: g.waitlistId, waiting: g.waitlistId ? (wlCounts[g.waitlistId] ?? 0) : 0,
      included: entCounts[g.id] ?? 0,
    }
  })
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })

// ── Drag ordering — the /groups/codes pattern (native HTML5, platform
// standard): drop near a row's top/bottom edge = reorder; drop ON a programme
// row = move the membership under that umbrella. ──
const dragRow = ref<Row | null>(null)
const dropMark = ref<{ id: string; pos: 'before' | 'after' | 'inside' } | null>(null)
const dropProgramme = ref<string | null>(null)
function onRowDragStart(r: Row, e: DragEvent) {
  dragRow.value = r
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id) }
}
function onRowDragOver(e: DragEvent, r: Row) {
  if (!dragRow.value || dragRow.value.id === r.id) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = (e.clientY - rect.top) / rect.height
  // Middle band = nest UNDER this membership (same umbrella); edges = reorder.
  dropMark.value = { id: r.id, pos: y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside' }
  dropProgramme.value = null
}
function onProgrammeDragOver(codeId: string) {
  if (!dragRow.value) return
  dropProgramme.value = codeId
  dropMark.value = null
}
function resetDrag() { dragRow.value = null; dropMark.value = null; dropProgramme.value = null }
async function persistList(list: Row[], codeId: string | null, moved: Row) {
  const updates: any[] = []
  list.forEach((row, idx) => {
    const patch: Record<string, any> = {}
    if (row.sortOrder !== idx) { row.sortOrder = idx; patch.sortOrder = idx }
    if (row.id === moved.id && row.codeId !== codeId) { row.codeId = codeId; patch.codeId = codeId }
    if (Object.keys(patch).length) updates.push(groupsApi.update(row.id, patch))
  })
  await Promise.all(updates)
  rows.value = [...rows.value].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))
}
async function onRowDrop(target: Row) {
  const g = dragRow.value
  const pos = dropMark.value?.id === target.id ? dropMark.value.pos : 'after'
  resetDrag()
  if (!g || g.id === target.id) return
  if (pos === 'inside') {
    if (target.codeId) {
      // Join the target's umbrella (append at the end of its tiers)
      const list = (sections.value.grouped.find(sec => sec.codeId === target.codeId)?.list ?? []).filter(r => r.id !== g.id)
      list.push(g)
      await persistList(list, target.codeId, g)
    } else {
      // Neither has an umbrella yet — name a new programme to hold both
      nestPair.value = { dragged: g, target }
      nestName.value = ''
      nestOpen.value = true
    }
    return
  }
  const codeId = target.codeId
  const list = (codeId ? (sections.value.grouped.find(sec => sec.codeId === codeId)?.list ?? []) : sections.value.loose).filter(r => r.id !== g.id)
  const at = list.indexOf(target) + (pos === 'after' ? 1 : 0)
  list.splice(at, 0, g)
  await persistList(list, codeId, g)
}
async function onProgrammeDrop(codeId: string) {
  const g = dragRow.value
  resetDrag()
  if (!g) return
  const list = (sections.value.grouped.find(sec => sec.codeId === codeId)?.list ?? []).filter(r => r.id !== g.id)
  list.push(g)
  await persistList(list, codeId, g)
}

// ── Nest two standalone memberships under a NEW programme (middle-band drop) ──
const nestOpen = ref(false)
const nestName = ref('')
const nestPair = ref<{ dragged: Row; target: Row } | null>(null)
const nesting = ref(false)
async function confirmNest() {
  if (!nestPair.value || !nestName.value.trim()) return
  nesting.value = true
  const code = await gc.createCode({ name: nestName.value.trim(), color: nestPair.value.target.color ?? '#1E2157', term_id: null, parent_id: null })
  if (code) {
    await Promise.all([
      groupsApi.update(nestPair.value.target.id, { codeId: code.id, sortOrder: 0 }),
      groupsApi.update(nestPair.value.dragged.id, { codeId: code.id, sortOrder: 1 }),
    ])
  }
  nesting.value = false
  nestOpen.value = false
  nestPair.value = null
  await load()
}

// ── New membership ──
const showCreate = ref(false)
const creating = ref(false)
const PALETTE = ['#1E2157', '#0f766e', '#9333ea', '#c2410c', '#0369a1', '#be123c', '#15803d', '#4338ca']
const newMs = reactive({ name: '', color: PALETTE[0] })
async function create() {
  if (!newMs.name.trim()) return
  creating.value = true
  const createLens = (useActiveLocation().activeLocationId.value ?? null)
  try {
    const g = await groupsApi.create({
      orgId: orgId.value, name: newMs.name.trim(), color: newMs.color, kind: 'membership',
      // Created under a location lens -> the membership belongs to that site; under
      // "All locations" [] spans the whole club (connect more sites later).
      locationIds: createLens ? [createLens] : [],
    })
    showCreate.value = false
    newMs.name = ''
    if (g?.id) navigateTo(`/memberships/${g.id}`)
  } catch {
    // insert failed — stay on the dialog
  } finally {
    creating.value = false
  }
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
          <!-- Programme umbrella row (hierarchy parent) — click for the everyone report -->
          <tr class="bg-gray-50/60 hover:bg-gray-100 cursor-pointer transition-shadow"
            :class="dropProgramme === sec.codeId ? 'ring-2 ring-inset ring-[var(--brand-primary)] bg-primary/5' : ''"
            @dragover.prevent="onProgrammeDragOver(sec.codeId)" @drop.prevent="onProgrammeDrop(sec.codeId)"
            @click="navigateTo(`/memberships/programme/${sec.codeId}`)">
            <td class="px-4 sm:px-5 py-2.5">
              <span class="flex items-center gap-2.5">
                <i class="pi pi-chevron-down text-[9px] text-gray-400 shrink-0" />
                <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: sec.color || '#94a3b8' }" />
                <span class="font-bold text-gray-900">{{ sec.name }}</span>
                <span class="text-xs text-gray-400 font-normal">{{ sec.list.length }} tier{{ sec.list.length === 1 ? '' : 's' }}</span>
              </span>
            </td>
            <td class="px-3 py-2.5 num font-semibold">{{ sec.list.reduce((a, r) => a + r.members, 0) }}</td>
            <td class="px-3 py-2.5 text-xs text-gray-400">by tier</td>
            <td class="px-3 py-2.5 text-gray-300">—</td>
            <td class="px-3 py-2.5"><span class="text-xs text-primary font-medium">View everyone →</span></td>
          </tr>
          <tr v-for="r in sec.list" :key="r.id" class="group hover:bg-gray-50 cursor-pointer"
            :class="dropMark?.id === r.id ? (dropMark.pos === 'before' ? 'shadow-[inset_0_2px_0_0_var(--brand-primary)]' : dropMark.pos === 'after' ? 'shadow-[inset_0_-2px_0_0_var(--brand-primary)]' : 'ring-2 ring-inset ring-[var(--brand-primary)] bg-primary/5') : ''"
            draggable="true" @dragstart="onRowDragStart(r, $event)" @dragover.prevent="onRowDragOver($event, r)"
            @drop.prevent="onRowDrop(r)" @dragend="resetDrag" @click="navigateTo(`/memberships/${r.id}`)">
            <td class="px-4 sm:px-5 py-3">
              <span class="flex items-center gap-2.5 pl-4 ml-[3px] border-l-2 border-gray-200">
                <i class="pi pi-bars text-gray-300 group-hover:text-gray-600 text-sm cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                  title="Drag to reorder — or into another programme" @click.stop />
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
          <tr v-for="r in sections.loose" :key="r.id" class="group hover:bg-gray-50 cursor-pointer"
            :class="dropMark?.id === r.id ? (dropMark.pos === 'before' ? 'shadow-[inset_0_2px_0_0_var(--brand-primary)]' : dropMark.pos === 'after' ? 'shadow-[inset_0_-2px_0_0_var(--brand-primary)]' : 'ring-2 ring-inset ring-[var(--brand-primary)] bg-primary/5') : ''"
            draggable="true" @dragstart="onRowDragStart(r, $event)" @dragover.prevent="onRowDragOver($event, r)"
            @drop.prevent="onRowDrop(r)" @dragend="resetDrag" @click="navigateTo(`/memberships/${r.id}`)">
            <td class="px-4 sm:px-5 py-3">
              <span class="flex items-center gap-2.5">
                <i class="pi pi-bars text-gray-300 group-hover:text-gray-600 text-sm cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                  title="Drag to reorder — or into a programme" @click.stop />
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
    <div v-if="!loading && visibleRows.length" class="md:hidden bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      <NuxtLink v-for="r in visibleRows" :key="r.id" :to="`/memberships/${r.id}`" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: r.color || '#94a3b8' }" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 truncate">{{ r.name }}</p>
          <p class="text-xs text-gray-500 truncate">{{ r.members }} member{{ r.members === 1 ? '' : 's' }}<span v-if="r.feeLabel"> · {{ r.feeLabel }}</span><span v-if="r.included"> · {{ r.included }} included</span></p>
        </div>
        <i class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
      </NuxtLink>
    </div>

    <!-- Nest under a new programme (middle-band drop on a standalone membership) -->
    <Dialog v-model:visible="nestOpen" modal header="Group these memberships" :style="{ width: '95vw', maxWidth: '440px' }">
      <div class="space-y-3">
        <p class="text-sm text-gray-600">
          Put <b class="font-semibold">{{ nestPair?.dragged.name }}</b> and <b class="font-semibold">{{ nestPair?.target.name }}</b>
          under one umbrella — e.g. tiers of the same membership.
        </p>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Programme name</label>
          <InputText v-model="nestName" placeholder="e.g. Senior Membership" class="w-full" autofocus @keyup.enter="confirmNest" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="nestOpen = false" />
        <Button label="Create & group" :loading="nesting" :disabled="!nestName.trim()"
          style="background:#1E2157;border-color:#1E2157" @click="confirmNest" />
      </template>
    </Dialog>

    <!-- New membership -->
    <Dialog v-model:visible="showCreate" modal header="New membership" :style="{ width: '95vw', maxWidth: '440px' }">
      <div class="space-y-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Name</label>
          <InputText v-model="newMs.name" placeholder="e.g. Senior Membership" class="w-full" autofocus @keyup.enter="create" />
        </div>
        <p v-if="lensHintName" class="text-xs rounded-lg px-3 py-2" style="background:#EAF1FE;color:#2563EB">
          Created for <b class="font-semibold">{{ lensHintName }}</b> (your current location) — you can add more locations in its Settings.
        </p>
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
