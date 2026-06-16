<!--
  Super-admin overarching dashboard. NOT club-scoped: lists every organisation
  across the whole hierarchy (Club -> Regional -> Association -> National) with
  member/event counts, and lets the super-admin "Open" any org into the normal
  club-scoped view (via <OrgSwitcher>'s fm_active_org mechanism).
  Visible only to users with app_metadata.role === 'super_admin'.
-->
<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const db = useDb()
const user = useSupabaseUser()

const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')

interface OrgRow {
  id: string; name: string; org_level: string; parent_id: string | null; logo_url: string | null
  members: number; events: number; depth: number
}

const loading = ref(true)
const orgs = ref<OrgRow[]>([])

// Roots-first depth-ordered traversal so children render indented under parents.
const orderedOrgs = computed<OrgRow[]>(() => {
  const byParent = new Map<string | null, OrgRow[]>()
  for (const o of orgs.value) {
    const k = o.parent_id && orgs.value.some(x => x.id === o.parent_id) ? o.parent_id : null
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(o)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => orgLevelRank(b.org_level) - orgLevelRank(a.org_level) || a.name.localeCompare(b.name))
  }
  const out: OrgRow[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const o of byParent.get(parent) ?? []) {
      out.push({ ...o, depth })
      walk(o.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

const totals = computed(() => ({
  orgs: orgs.value.length,
  members: orgs.value.reduce((s, o) => s + o.members, 0),
  events: orgs.value.reduce((s, o) => s + o.events, 0),
  byLevel: (ORG_LEVELS as readonly string[]).map(l => ({
    level: l, label: orgLevelLabel(l), count: orgs.value.filter(o => o.org_level === l).length,
  })).filter(x => x.count > 0),
}))

async function load() {
  loading.value = true
  const [{ data: orgData }, { data: personRows }, { data: eventRows }] = await Promise.all([
    (db.from as any)('organisations').select('id, name, org_level, parent_id, logo_url').order('name'),
    (db.from as any)('persons').select('org_id'),
    (db.from as any)('events').select('org_id'),
  ])
  const memberBy: Record<string, number> = {}
  for (const p of personRows ?? []) memberBy[p.org_id] = (memberBy[p.org_id] ?? 0) + 1
  const eventBy: Record<string, number> = {}
  for (const e of eventRows ?? []) eventBy[e.org_id] = (eventBy[e.org_id] ?? 0) + 1
  orgs.value = (orgData ?? []).map((o: any) => ({
    ...o,
    members: memberBy[o.id] ?? 0,
    events: eventBy[o.id] ?? 0,
    depth: 0,
  }))
  loading.value = false
}

function openOrg(id: string) {
  persistActiveOrg(id) // per-tab (sessionStorage) + last-used — so Open switches THIS tab
  window.location.href = '/events'
}

onMounted(() => {
  if (!isSuper.value) { navigateTo('/'); return }
  load()
})
</script>

<template>
  <div v-if="isSuper" class="p-6 md:p-8 max-w-6xl mx-auto space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">All Organisations</h1>
        <p class="text-sm text-gray-500">Super-admin overview across every organisation — not scoped to a single club.</p>
      </div>
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="card p-4">
        <p class="text-xs text-gray-500">Organisations</p>
        <p class="text-2xl font-bold text-[#1E2157]">{{ totals.orgs }}</p>
        <p class="text-[11px] text-gray-400 mt-0.5">
          <span v-for="(b, i) in totals.byLevel" :key="b.level">{{ i ? ' · ' : '' }}{{ b.count }} {{ b.label }}</span>
        </p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">Members (all orgs)</p>
        <p class="text-2xl font-bold text-[#1E2157]">{{ totals.members }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">Events (all orgs)</p>
        <p class="text-2xl font-bold text-[#1E2157]">{{ totals.events }}</p>
      </div>
      <div class="card p-4 flex flex-col justify-center">
        <p class="text-xs text-gray-500">Use the switcher (top bar)</p>
        <p class="text-[11px] text-gray-400">to drop into any org's club view.</p>
      </div>
    </div>

    <!-- Hierarchy -->
    <div class="card p-0 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100">
        <h2 class="text-sm font-semibold text-gray-700">Organisation hierarchy</h2>
      </div>
      <div v-if="loading" class="p-6 text-sm text-gray-400">Loading…</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-gray-500 border-b border-gray-100">
            <th class="px-5 py-2 font-medium">Organisation</th>
            <th class="px-3 py-2 font-medium">Level</th>
            <th class="px-3 py-2 font-medium text-right">Members</th>
            <th class="px-3 py-2 font-medium text-right">Events</th>
            <th class="px-5 py-2 font-medium text-right"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orderedOrgs" :key="o.id" class="border-b border-gray-50 hover:bg-gray-50/60">
            <td class="px-5 py-2.5">
              <span :style="{ paddingLeft: (o.depth * 18) + 'px' }" class="inline-flex items-center gap-2">
                <i v-if="o.depth > 0" class="pi pi-angle-right text-gray-300 text-xs" />
                <span class="font-medium text-gray-800">{{ o.name }}</span>
              </span>
            </td>
            <td class="px-3 py-2.5">
              <span class="px-2 py-0.5 rounded text-[11px] bg-surface-100 text-surface-700">{{ orgLevelLabel(o.org_level) }}</span>
            </td>
            <td class="px-3 py-2.5 text-right tabular-nums text-gray-700">{{ o.members }}</td>
            <td class="px-3 py-2.5 text-right tabular-nums text-gray-700">{{ o.events }}</td>
            <td class="px-5 py-2.5 text-right">
              <button type="button" class="text-xs font-medium text-[#1E2157] hover:underline" @click="openOrg(o.id)">Open →</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
