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
import type { CodeRoleDef, CodeStaff } from '~/composables/useCodeRoles'

const route = useRoute()
const codeId = route.params.id as string
const { orgId } = useOrg()
const db = useDb()
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
const inheritedRoles = ref<(CodeRoleDef & { fromLabel: string })[]>([])
const allDefs = ref<CodeRoleDef[]>([])
const staff = ref<CodeStaff[]>([])
const savingMember = ref(false)
const savingOwn = ref(false)
// Org-wide default roles are read-only here — edited on /groups/codes/default-roles.
const defaultRolesRO = computed(() => allDefs.value.filter(d => d.code_lineage_id == null))

// Effective roles (defaults + own + inherited) to assign people to.
const effectiveRoles = computed(() => code.value ? cr.rolesForCode(code.value, codesById.value, allDefs.value) : [])
const staffOnCode = computed(() => code.value ? cr.staffForCode(code.value, codesById.value, staff.value, codes.value) : [])
const staffForRole = (roleKey: string) => staffOnCode.value.filter(s => s.role_key === roleKey)
const personName = (s: any) => `${s.person?.first_name ?? ''} ${s.person?.last_name ?? ''}`.trim() || s.person?.email || 'Person'

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [loadedCodes, types, defs, staffRows] = await Promise.all([
    gc.loadCodes(),
    policy.resolvePersonTypes(orgId.value),
    cr.ensureDefaults(),
    cr.loadStaff(),
  ])
  codes.value = loadedCodes
  allDefs.value = defs
  staff.value = staffRows
  personTypeOptions.value = (types ?? []).filter((t: any) => (t.kind ?? 'person') === 'person').map((t: any) => ({ label: t.label, value: t.key }))
  memberType.value = code.value?.member_type_key ?? null

  const ln = lineage.value
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

function addRole() {
  ownRoles.value.push({ code_lineage_id: lineage.value, key: '', label: '', capabilities: [], sort_order: ownRoles.value.length })
}
function removeRole(i: number) { ownRoles.value.splice(i, 1) }
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
// Assign a person to a role (at this code's lineage).
const assignOpen = ref(false)
const assignRoleKey = ref<string>('')
const personQuery = ref<any>('')
const personResults = ref<any[]>([])
function openAssign(roleKey: string) { assignRoleKey.value = roleKey; personQuery.value = ''; personResults.value = []; assignOpen.value = true }
async function searchPersons(e: { query: string }) {
  const q = (e.query || '').trim()
  if (!q || !orgId.value) { personResults.value = []; return }
  const { data } = await (db.from as any)('persons')
    .select('id, first_name, last_name, email')
    .eq('org_id', orgId.value)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(20)
  personResults.value = (data ?? []).map((p: any) => ({ ...p, label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email }))
}
async function pickPerson(p: any) {
  if (!p?.id || !lineage.value) return
  await cr.assignStaff(lineage.value, p.id, assignRoleKey.value)
  assignOpen.value = false
  staff.value = await cr.loadStaff()
  toast.add({ severity: 'success', summary: 'Assigned', life: 1400 })
}
async function unassign(s: any) {
  await cr.removeStaff(s.id)
  staff.value = staff.value.filter(x => x.id !== s.id)
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
        <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
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
        <div class="p-4 sm:p-5">
          <RoleMatrix :roles="ownRoles" :caps="cr.CODE_CAPABILITIES" empty="No code-specific roles yet — the default roles below still apply."
            @add="addRole" @remove="removeRole" @toggle="(r, c, v) => toggleCap(r, c, v)" :runs="roleRuns" />
        </div>
      </AppCard>

      <!-- INHERITED -->
      <AppCard v-if="inheritedRoles.length" title="Inherited from parent codes" description="Roles set on a parent code — edit them on that code.">
        <div class="p-4 sm:p-5 space-y-2">
          <div v-for="r in inheritedRoles" :key="r.id" class="flex items-center gap-2 flex-wrap border border-gray-100 rounded-lg px-3 py-2">
            <span class="font-medium text-gray-700 text-sm">{{ r.label }}</span>
            <span class="text-[11px] text-gray-400">from {{ r.fromLabel }}</span>
            <div class="flex flex-wrap gap-1 ml-auto">
              <span v-for="cap in r.capabilities" :key="cap" class="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{{ cr.CODE_CAPABILITIES.find(c => c.key === cap)?.label || cap }}</span>
            </div>
          </div>
        </div>
      </AppCard>

      <!-- PEOPLE IN ROLES -->
      <AppCard title="People in roles" description="Assign staff to each role. Assignments cascade to this code's sub-codes and groups.">
        <div class="p-4 sm:p-5 space-y-3">
          <div v-for="r in effectiveRoles" :key="r.key" class="border border-gray-100 rounded-lg p-3">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-gray-800 text-sm">{{ r.label }}</span>
              <button type="button" class="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1" @click="openAssign(r.key)">
                <i class="pi pi-user-plus text-[10px]" /> Assign
              </button>
            </div>
            <div v-if="staffForRole(r.key).length" class="flex flex-wrap gap-1.5 mt-2">
              <span v-for="s in staffForRole(r.key)" :key="s.id"
                class="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 rounded-full pl-2.5 pr-1 py-1">
                {{ personName(s) }}
                <span v-if="s.scope === 'inherited'" class="text-[9px] text-gray-400">· {{ s.fromLabel }}</span>
                <button v-if="s.scope === 'own'" type="button" class="text-gray-400 hover:text-red-500" title="Remove" @click="unassign(s)"><i class="pi pi-times-circle text-xs" /></button>
              </span>
            </div>
            <p v-else class="text-xs text-gray-400 mt-1.5">No one assigned.</p>
          </div>
          <div v-if="!effectiveRoles.length" class="text-sm text-gray-400">Add roles above first.</div>
        </div>
      </AppCard>

      <!-- DEFAULT ROLES (all codes) — read-only; edited on the shared page -->
      <AppCard title="Default roles (all codes)" description="These apply to every code. Edit them on the shared Default roles page.">
        <template #header-action>
          <NuxtLink to="/groups/codes/default-roles" class="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
            Edit default roles <i class="pi pi-arrow-right text-[9px]" />
          </NuxtLink>
        </template>
        <div class="p-4 sm:p-5 space-y-2">
          <div v-for="r in defaultRolesRO" :key="r.id" class="flex items-center gap-2 flex-wrap border border-gray-100 rounded-lg px-3 py-2">
            <span class="font-medium text-gray-700 text-sm">{{ r.label }}</span>
            <div class="flex flex-wrap gap-1 ml-auto">
              <span v-for="cap in r.capabilities" :key="cap" class="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{{ cr.CODE_CAPABILITIES.find(c => c.key === cap)?.label || cap }}</span>
              <span v-if="!r.capabilities.length" class="text-[10px] text-gray-300">no permissions</span>
            </div>
          </div>
          <div v-if="!defaultRolesRO.length" class="text-sm text-gray-400">No default roles.</div>
        </div>
      </AppCard>
    </template>

    <!-- Assign person to a role -->
    <Dialog v-model:visible="assignOpen" modal :style="{ width: '95vw', maxWidth: '440px' }"
      :header="`Assign to ${effectiveRoles.find(r => r.key === assignRoleKey)?.label || 'role'}`">
      <label class="text-xs font-medium text-gray-600">Person</label>
      <AutoComplete v-model="personQuery" :suggestions="personResults" optionLabel="label" class="w-full mt-1"
        placeholder="Search people…" @complete="searchPersons" @option-select="e => pickPerson(e.value)" dropdown />
      <template #footer>
        <Button label="Close" text @click="assignOpen = false" />
      </template>
    </Dialog>
  </div>
</template>
