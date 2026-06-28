<!--
  Settings → Dashboard defaults. Lists each user type (permission group / role)
  plus an "All users" fallback, showing whether a custom default dashboard is set.
  "Edit" opens /dashboard?editTemplate=<userType> in template-edit mode; "Reset"
  deletes the role's template (so it falls back down the chain). Templates live in
  dashboard_templates (org_id, user_type, config) — migration 164.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const user = useSupabaseUser()
const toast = useToast()
const { can, unrestricted } = useCan()
const isAdmin = computed(() => ((user.value as any)?.app_metadata?.role === 'super_admin') || unrestricted.value || can('settings', 'update'))

interface Row { value: string; label: string; hasTemplate: boolean }
const rows = ref<Row[]>([])
const loading = ref(true)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [{ data: core }, { data: local }, { data: tpls }] = await Promise.all([
    (db.from as any)('permission_groups').select('id, name, sort_order').eq('is_core', true).order('sort_order'),
    (db.from as any)('permission_groups').select('id, name, sort_order, source_group_id').eq('org_id', orgId.value).order('sort_order'),
    (db.from as any)('dashboard_templates').select('user_type').eq('org_id', orgId.value),
  ])
  const withTpl = new Set((tpls ?? []).map((t: any) => t.user_type))
  const list: Row[] = [{ value: '_default', label: 'All users', hasTemplate: withTpl.has('_default') }]
  for (const c of core ?? []) list.push({ value: c.id, label: c.name, hasTemplate: withTpl.has(c.id) })
  for (const g of local ?? []) if (!g.source_group_id) list.push({ value: g.id, label: g.name, hasTemplate: withTpl.has(g.id) })
  rows.value = list
  loading.value = false
}

function edit(r: Row) { navigateTo({ path: '/dashboard', query: { editTemplate: r.value } }) }
async function reset(r: Row) {
  await (db.from as any)('dashboard_templates').delete().eq('org_id', orgId.value).eq('user_type', r.value)
  toast.add({ severity: 'success', summary: `Reset ${r.label} to the standard default`, life: 2000 })
  await load()
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6">
      <SettingsNav />
      <div class="flex-1 min-w-0">
        <div class="mb-4">
          <h1 class="text-xl font-semibold text-gray-900">Dashboard defaults</h1>
          <p class="text-sm text-gray-500">Set the starting dashboard each type of user sees. People can still personalise their own; the most specific default wins (their role → All users → the system default).</p>
        </div>

        <div v-if="!isAdmin" class="card p-8 text-center text-gray-400 text-sm">You don't have permission to manage dashboard defaults.</div>

        <div v-else class="card p-0 overflow-hidden max-w-2xl">
          <div class="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-2.5 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <span>User type</span><span>Default</span><span></span>
          </div>
          <div v-if="loading" class="p-5 text-sm text-gray-400">Loading…</div>
          <div v-for="r in rows" :key="r.value"
            class="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
            <span class="text-sm font-medium text-gray-800">{{ r.label }}</span>
            <span class="text-xs" :class="r.hasTemplate ? 'text-emerald-600 font-medium' : 'text-gray-400'">
              {{ r.hasTemplate ? 'Custom' : 'Standard' }}
            </span>
            <div class="flex items-center gap-3 justify-end">
              <button v-if="r.hasTemplate" type="button" class="text-xs text-gray-400 hover:text-red-500" @click="reset(r)">Reset</button>
              <button type="button" class="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1" @click="edit(r)">Edit <i class="pi pi-arrow-right text-[10px]" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
