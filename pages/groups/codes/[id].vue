<!--
  Code settings (/groups/codes/:id) — per-code configuration:
   • Member user type (drives which custom fields members in this code get)
   • Staff roles + permissions: org-wide DEFAULT roles (Manager/Coach…) that every
     code gets, this code's OWN extra roles (cascade to its sub-codes + groups),
     and a read-only view of roles inherited from parent codes.
  Roles are keyed by code LINEAGE so they survive rename + term rollover.
-->
<script setup lang="ts">
import type { GroupCode } from '~/composables/useGroupCodes'
import type { CodeRoleDef } from '~/composables/useCodeRoles'

const route = useRoute()
const codeId = route.params.id as string
const { orgId } = useOrg()
const gc = useGroupCodes()
const cr = useCodeRoles()
const policy = useOrgFieldPolicy()
const toast = useToast()

const loading = ref(true)
const codes = ref<GroupCode[]>([])
const codesById = computed(() => Object.fromEntries(codes.value.map(c => [c.id, c])) as Record<string, GroupCode>)
const code = computed<GroupCode | null>(() => codesById.value[codeId] ?? null)
const lineage = computed(() => code.value ? codeLineage(code.value) : null)

const personTypeOptions = ref<{ label: string; value: string }[]>([])
const memberType = ref<string | null>(null)

const ownRoles = ref<CodeRoleDef[]>([])
const defaultRoles = ref<CodeRoleDef[]>([])
const inheritedRoles = ref<(CodeRoleDef & { fromLabel: string })[]>([])
const savingMember = ref(false)
const savingOwn = ref(false)
const savingDefault = ref(false)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [loadedCodes, types, defs] = await Promise.all([
    gc.loadCodes(),
    policy.resolvePersonTypes(orgId.value),
    cr.ensureDefaults(),
  ])
  codes.value = loadedCodes
  personTypeOptions.value = (types ?? []).filter((t: any) => (t.kind ?? 'person') === 'person').map((t: any) => ({ label: t.label, value: t.key }))
  memberType.value = code.value?.member_type_key ?? null

  const ln = lineage.value
  defaultRoles.value = clone(defs.filter(d => d.code_lineage_id == null))
  ownRoles.value = clone(defs.filter(d => d.code_lineage_id === ln))
  // ancestor lineages (excluding this code's own) → inherited, read-only.
  const chain = code.value ? cr.lineageChain(code.value, codesById.value).filter(l => l !== ln) : []
  const chainSet = new Set(chain)
  const labelForLineage = (l: string) => codes.value.find(c => codeLineage(c) === l)?.name ?? 'Parent'
  inheritedRoles.value = defs.filter(d => d.code_lineage_id && chainSet.has(d.code_lineage_id))
    .map(d => ({ ...d, fromLabel: labelForLineage(d.code_lineage_id!) }))
  loading.value = false
}
const clone = (list: CodeRoleDef[]) => list.map(r => ({ ...r, capabilities: [...(r.capabilities ?? [])] }))

async function saveMemberType() {
  if (!code.value) return
  savingMember.value = true
  await gc.updateCode(code.value.id, { member_type_key: memberType.value || null })
  savingMember.value = false
  toast.add({ severity: 'success', summary: 'Member type saved', life: 1600 })
}

function addRole(list: Ref<CodeRoleDef[]>, codeLineageId: string | null) {
  list.value.push({ code_lineage_id: codeLineageId, key: '', label: '', capabilities: [], sort_order: list.value.length })
}
function removeRole(list: Ref<CodeRoleDef[]>, i: number) { list.value.splice(i, 1) }
function toggleCap(role: CodeRoleDef, capKey: string, on: boolean) {
  const set = new Set(role.capabilities)
  on ? set.add(capKey) : set.delete(capKey)
  role.capabilities = [...set]
}
function roleRuns(role: CodeRoleDef) {
  // "manages" if it can add people or create groups (umbrella signal for the badge)
  return role.capabilities.includes('add_people') || role.capabilities.includes('create_groups')
}

async function saveOwn() {
  if (!lineage.value) return
  savingOwn.value = true
  await cr.saveRolesForScope(lineage.value, ownRoles.value.filter(r => r.label.trim()))
  savingOwn.value = false
  await load()
  toast.add({ severity: 'success', summary: 'Roles saved', life: 1600 })
}
async function saveDefaults() {
  savingDefault.value = true
  await cr.saveRolesForScope(null, defaultRoles.value.filter(r => r.label.trim()))
  savingDefault.value = false
  await load()
  toast.add({ severity: 'success', summary: 'Default roles saved', life: 1600 })
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto space-y-5">
    <!-- header -->
    <div>
      <NuxtLink to="/groups/codes" class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1">
        <i class="pi pi-arrow-left text-xs" /> Organise codes
      </NuxtLink>
      <div class="flex items-center gap-2 mt-2">
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: code?.color || '#94a3b8' }" />
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">{{ code?.name || 'Code' }}</h1>
        <span class="text-xs text-gray-400">settings</span>
      </div>
    </div>

    <div v-if="loading" class="card p-6 text-sm text-gray-400">Loading…</div>
    <div v-else-if="!code" class="card p-6 text-sm text-gray-500">This code no longer exists.</div>

    <template v-else>
      <!-- MEMBER TYPE -->
      <AppCard title="Member type" description="The type of person who is a MEMBER in the groups under this code. Drives which custom fields apply to them.">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <Select v-model="memberType" :options="personTypeOptions" optionLabel="label" optionValue="value"
            placeholder="Choose a member type" class="w-full sm:w-72" showClear filter />
          <Button label="Save" :disabled="savingMember" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveMemberType" />
        </div>
      </AppCard>

      <!-- ROLES FOR THIS CODE -->
      <AppCard :title="`Staff roles — ${code.name}`" description="Extra roles for this code. They apply to every group and sub-code inside it.">
        <template #header-action>
          <Button label="Save roles" size="small" :disabled="savingOwn" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveOwn" />
        </template>
        <RoleMatrix :roles="ownRoles" :caps="cr.CODE_CAPABILITIES" empty="No code-specific roles yet — the default roles below still apply."
          @add="addRole(ownRoles, lineage)" @remove="i => removeRole(ownRoles, i)" @toggle="(r, c, v) => toggleCap(r, c, v)" :runs="roleRuns" />
      </AppCard>

      <!-- INHERITED -->
      <AppCard v-if="inheritedRoles.length" title="Inherited from parent codes" description="Roles set on a parent code — edit them on that code.">
        <div class="space-y-2">
          <div v-for="r in inheritedRoles" :key="r.id" class="flex items-center gap-2 flex-wrap border border-gray-100 rounded-lg px-3 py-2">
            <span class="font-medium text-gray-700 text-sm">{{ r.label }}</span>
            <span class="text-[11px] text-gray-400">from {{ r.fromLabel }}</span>
            <div class="flex flex-wrap gap-1 ml-auto">
              <span v-for="cap in r.capabilities" :key="cap" class="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{{ cr.CODE_CAPABILITIES.find(c => c.key === cap)?.label || cap }}</span>
            </div>
          </div>
        </div>
      </AppCard>

      <!-- DEFAULT ROLES (all codes) -->
      <AppCard title="Default roles (all codes)" description="Applied to every code. Editing these changes them everywhere.">
        <template #header-action>
          <Button label="Save defaults" size="small" severity="secondary" outlined :disabled="savingDefault" @click="saveDefaults" />
        </template>
        <RoleMatrix :roles="defaultRoles" :caps="cr.CODE_CAPABILITIES" empty="No default roles."
          @add="addRole(defaultRoles, null)" @remove="i => removeRole(defaultRoles, i)" @toggle="(r, c, v) => toggleCap(r, c, v)" :runs="roleRuns" />
      </AppCard>
    </template>
  </div>
</template>
