<!-- Dashboard widget: staff shortfalls — role minimums + classes with no staff -->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const gc = useGroupCodes()
const scoped = useScopedRoles()

const loading = ref(true)
const shortfalls = ref<{ label: string; n: number }[]>([])
const noStaff = ref(0)

async function load() {
  if (!orgId.value) return
  loading.value = true
  await scoped.loadRoleDefs()
  const [codes, { data: gs }, { data: mems }] = await Promise.all([
    gc.loadCodes(),
    (db.from as any)('member_groups').select('id, code_id').eq('org_id', orgId.value).neq('kind', 'membership'),
    (db.from as any)('member_group_memberships').select('group_id, roles, role, group:member_groups!inner(org_id)').eq('group.org_id', orgId.value),
  ])
  const codesById: Record<string, any> = Object.fromEntries((codes ?? []).map((c: any) => [c.id, c]))
  const staffByGroup: Record<string, string[]> = {}
  for (const m of (mems ?? [])) {
    const roles = ((m.roles?.length ? m.roles : [m.role]) as string[]).filter(Boolean).map(r => r.toLowerCase())
    if (roles.length && scoped.isStaff('group', roles)) (staffByGroup[m.group_id] ??= []).push(...roles)
  }
  const short: Record<string, number> = {}
  let none = 0
  for (const g of (gs ?? [])) {
    const mins = gc.effectiveRoleMins(g, codesById)
    const have = staffByGroup[g.id] ?? []
    if (!have.length && Object.keys(mins).length) none++
    for (const [roleKey, min] of Object.entries(mins)) {
      const holders = have.filter(r => r === roleKey).length
      if (holders < (min as number)) short[roleKey] = (short[roleKey] ?? 0) + ((min as number) - holders)
    }
  }
  shortfalls.value = Object.entries(short).map(([k, n]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), n })).sort((a, b) => b.n - a.n)
  noStaff.value = none
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })
const allGood = computed(() => !shortfalls.value.length && !noStaff.value)
</script>

<template>
  <AppCard title="Staff coverage" class="h-full">
    <template #header-action>
      <NuxtLink to="/groups/codes" class="text-xs font-medium text-primary hover:underline">Roles →</NuxtLink>
    </template>
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <p v-else-if="allGood" class="text-sm text-emerald-700 py-3 text-center"><i class="pi pi-check-circle mr-1" />Every {{ t('group', false, true) }} meets its staff minimums.</p>
      <template v-else>
        <ul class="divide-y divide-gray-50">
          <li v-for="s in shortfalls.slice(0, 4)" :key="s.label" class="py-1.5 flex items-center gap-2 text-sm">
            <i class="pi pi-shield text-amber-500 text-xs" />
            <span class="text-gray-800">Needs <b class="font-semibold">{{ s.n }}</b> more {{ s.label }}{{ s.n === 1 ? '' : 's' }}</span>
          </li>
          <li v-if="noStaff" class="py-1.5 flex items-center gap-2 text-sm">
            <i class="pi pi-exclamation-circle text-amber-500 text-xs" />
            <span class="text-gray-800"><b class="font-semibold">{{ noStaff }}</b> {{ noStaff === 1 ? t('group', false, true) : t('group', true, true) }} with no staff at all</span>
          </li>
        </ul>
      </template>
    </div>
  </AppCard>
</template>
