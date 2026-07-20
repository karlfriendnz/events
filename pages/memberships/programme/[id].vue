<!--
  MEMBERSHIP PROGRAMME REPORT — the umbrella view ("Senior Membership"): every
  person holding ANY membership tier under this programme (code), one row per
  person with their tier(s). Reached by clicking the programme header on the
  memberships board.
-->
<script setup lang="ts">
import { isMembershipGroup } from '~/composables/useMemberships'
const { orgId } = useOrg()
const gc = useGroupCodes()
const groupsApi = useGroupsApi()
const peopleApi = usePeopleApi()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const route = useRoute()

const code = ref<any>(null)
const tiers = ref<{ id: string; name: string; color: string | null }[]>([])
const loading = ref(true)
const search = ref('')

useBreadcrumbs([
  { label: 'Memberships', to: '/memberships' },
  { label: computed(() => code.value?.name || '…') },
])

interface PersonRow {
  id: string; name: string; email: string | null; phone: string | null
  tiers: { name: string; color: string | null; membershipId: string }[]
}
const people = ref<PersonRow[]>([])

async function load() {
  if (!orgId.value) return
  loading.value = true
  const codes = await gc.loadCodes()
  code.value = codes.find((c: any) => c.id === route.params.id) ?? null
  // The programme's memberships = membership-kind groups on this code or any
  // code in its subtree (an umbrella can nest).
  const subtree = new Set<string>([route.params.id as string])
  let grew = true
  while (grew) {
    grew = false
    for (const c of codes) if (c.parent_id && subtree.has(c.parent_id) && !subtree.has(c.id)) { subtree.add(c.id); grew = true }
  }
  // Membership-kind groups on this code or anywhere in its subtree (via the seam).
  const groups = (await groupsApi.groupsByCodeIds([...subtree])).filter(g => isMembershipGroup(g))
  tiers.value = groups.map(g => ({ id: g.id, name: g.name, color: g.color }))
  if (!tiers.value.length) { people.value = []; loading.value = false; return }
  const tierIds = new Set(tiers.value.map(g => g.id))
  // Every org membership ref (person↔group) filtered to this umbrella's tiers, joined
  // to the person directory in memory (both via the seam).
  const [allMems, persons] = await Promise.all([
    groupsApi.membershipsByOrg(orgId.value),
    peopleApi.list(orgId.value),
  ])
  const personById: Record<string, any> = {}
  for (const p of persons) personById[p.id] = p
  const byPerson: Record<string, PersonRow> = {}
  for (const m of allMems) {
    if (!tierIds.has(m.groupId)) continue
    const p = personById[m.personId]
    if (!p) continue
    const row = (byPerson[p.id] ??= { id: p.id, name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), email: p.email, phone: p.phone, tiers: [] })
    const tier = tiers.value.find(g => g.id === m.groupId)
    if (tier && !row.tiers.some(x => x.membershipId === tier.id)) row.tiers.push({ name: tier.name, color: tier.color, membershipId: tier.id })
  }
  people.value = Object.values(byPerson).sort((a, b) => a.name.localeCompare(b.name))
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return people.value
  return people.value.filter(p =>
    p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)
    || p.tiers.some(x => x.name.toLowerCase().includes(q)))
})

function exportCsv() {
  const rows = [['Name', 'Membership', 'Email', 'Phone'],
    ...filtered.value.map(p => [p.name, p.tiers.map(x => x.name).join('; '), p.email ?? '', p.phone ?? ''])]
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `${code.value?.name ?? 'memberships'}-members.csv`
  a.click()
}
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4">
    <!-- Toolbar: tiers of this umbrella + search + export -->
    <div class="flex flex-wrap items-center gap-2">
      <NuxtLink v-for="g in tiers" :key="g.id" :to="`/memberships/${g.id}`"
        class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 hover:border-primary text-gray-700">
        <span class="w-2 h-2 rounded-full" :style="{ background: g.color || '#94a3b8' }" />{{ g.name }}
      </NuxtLink>
      <span class="relative ml-auto w-full sm:w-64 order-last sm:order-none">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
        <InputText v-model="search" placeholder="Search people…" class="w-full !pl-8" size="small" />
      </span>
      <Button label="Export" icon="pi pi-download" size="small" text @click="exportCsv" />
    </div>

    <div v-if="loading" class="card p-16 text-center text-gray-400 text-sm">
      <i class="pi pi-spin pi-spinner text-2xl mb-2 block" /> Loading…
    </div>

    <div v-else-if="!people.length" class="card p-12 text-center text-sm text-gray-400">
      Nobody holds a membership in this programme yet.
    </div>

    <div v-else class="card p-0 overflow-hidden">
      <div class="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-800">Everyone in {{ code?.name }}</h3>
        <span class="text-xs text-gray-400">{{ filtered.length }} {{ filtered.length === 1 ? 'person' : 'people' }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <colgroup><col class="w-72" /><col class="w-56" /><col /><col class="w-40" /></colgroup>
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th class="px-4 sm:px-5 py-2.5">Person</th>
              <th class="px-3 py-2.5">Membership</th>
              <th class="px-3 py-2.5">Email</th>
              <th class="px-3 py-2.5">Phone</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="p in filtered" :key="p.id" class="hover:bg-gray-50">
              <td class="px-4 sm:px-5 py-2.5">
                <NuxtLink :to="`/people/${p.id}`" class="flex items-center gap-2.5 text-primary hover:underline">
                  <span class="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold inline-flex items-center justify-center shrink-0">{{ p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() }}</span>
                  {{ p.name }}
                </NuxtLink>
              </td>
              <td class="px-3 py-2.5">
                <span class="flex flex-wrap gap-1">
                  <span v-for="x in p.tiers" :key="x.membershipId" class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    <span class="w-1.5 h-1.5 rounded-full" :style="{ background: x.color || '#94a3b8' }" />{{ x.name }}
                  </span>
                </span>
              </td>
              <td class="px-3 py-2.5 text-gray-500">{{ p.email || '—' }}</td>
              <td class="px-3 py-2.5 text-gray-500">{{ p.phone || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
