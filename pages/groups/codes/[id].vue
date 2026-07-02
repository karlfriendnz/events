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
const tm = useTermsMemberships()
const policy = useOrgFieldPolicy()
const toast = useToast()

// Code details (name / colour / parent / term) — edited here, not on the list.
const PALETTE = ['#1E2157', '#2563EB', '#0f766e', '#059669', '#9333ea', '#EC4899', '#c2410c', '#be123c', '#8B5CF6', '#64748b']
const terms = ref<any[]>([])
const detail = reactive<{ name: string; color: string; parent_id: string | null; term_id: string | null }>({ name: '', color: PALETTE[0], parent_id: null, term_id: null })
const savingDetail = ref(false)
// Valid parents = every code except this one + its descendants (no cycles).
const parentOptions = computed(() => {
  const banned = new Set<string>([codeId])
  let added = true
  while (added) { added = false; for (const c of codes.value) if (c.parent_id && banned.has(c.parent_id) && !banned.has(c.id)) { banned.add(c.id); added = true } }
  return codes.value.filter(c => !banned.has(c.id))
})

const loading = ref(true)
const codes = ref<GroupCode[]>([])
const codesById = computed(() => Object.fromEntries(codes.value.map(c => [c.id, c])) as Record<string, GroupCode>)
const code = computed<GroupCode | null>(() => codesById.value[codeId] ?? null)
const lineage = computed(() => code.value ? codeLineage(code.value) : null)

const personTypeOptions = ref<{ label: string; value: string }[]>([])
const memberType = ref<string | null>(null)

// One master-detail role list: this code's OWN roles (editable) + inherited +
// default roles (read-only). Rendered by <RolePermissions>.
interface RoleItem { _uid: number; groupKey: string; editable: boolean; id?: string; key: string; label: string; capabilities: string[] }
let ruid = 1
const roleItems = ref<RoleItem[]>([])
const allDefs = ref<CodeRoleDef[]>([])
const staff = ref<CodeStaff[]>([])
const savingMember = ref(false)
const savingOwn = ref(false)
const hasInherited = computed(() => roleItems.value.some(r => r.groupKey === 'inherited'))
const roleGroups = computed(() => [
  { key: 'own', label: `This code — ${code.value?.name ?? ''}`, addable: true },
  ...(hasInherited.value ? [{ key: 'inherited', label: 'Inherited from parent codes', note: 'Set on a parent code — edit it there.' }] : []),
  { key: 'default', label: 'Default (all codes)', note: 'Applies to every code — edit on the Default roles page.' },
])

// Effective roles (defaults + own + inherited) to assign people to.
const effectiveRoles = computed(() => code.value ? cr.rolesForCode(code.value, codesById.value, allDefs.value) : [])
const staffOnCode = computed(() => code.value ? cr.staffForCode(code.value, codesById.value, staff.value, codes.value) : [])
const staffForRole = (roleKey: string) => staffOnCode.value.filter(s => s.role_key === roleKey)
const personName = (s: any) => `${s.person?.first_name ?? ''} ${s.person?.last_name ?? ''}`.trim() || s.person?.email || 'Person'

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [loadedCodes, types, defs, staffRows, loadedTerms] = await Promise.all([
    gc.loadCodes(),
    policy.resolvePersonTypes(orgId.value),
    cr.ensureDefaults(),
    cr.loadStaff(),
    tm.loadTerms(),
  ])
  codes.value = loadedCodes
  allDefs.value = defs
  staff.value = staffRows
  terms.value = loadedTerms ?? []
  personTypeOptions.value = (types ?? []).filter((t: any) => (t.kind ?? 'person') === 'person').map((t: any) => ({ label: t.label, value: t.key }))
  memberType.value = code.value?.member_type_key ?? null
  if (code.value) Object.assign(detail, { name: code.value.name, color: code.value.color || PALETTE[0], parent_id: code.value.parent_id, term_id: code.value.term_id })

  const ln = lineage.value
  const chain = code.value ? cr.lineageChain(code.value, codesById.value).filter(l => l !== ln) : []
  const chainSet = new Set(chain)
  const mk = (d: CodeRoleDef, groupKey: string, editable: boolean): RoleItem =>
    ({ _uid: ruid++, groupKey, editable, id: d.id, key: d.key, label: d.label, capabilities: [...(d.capabilities ?? [])] })
  roleItems.value = [
    ...defs.filter(d => d.code_lineage_id === ln).map(d => mk(d, 'own', true)),
    ...defs.filter(d => d.code_lineage_id && chainSet.has(d.code_lineage_id)).map(d => mk(d, 'inherited', false)),
    ...defs.filter(d => d.code_lineage_id == null).map(d => mk(d, 'default', false)),
  ]
  loading.value = false
}

async function saveDetails() {
  if (!code.value || !detail.name.trim()) return
  savingDetail.value = true
  await gc.updateCode(code.value.id, { name: detail.name.trim(), color: detail.color, parent_id: detail.parent_id, term_id: detail.term_id })
  savingDetail.value = false
  await load()
  toast.add({ severity: 'success', summary: 'Details saved', life: 1600 })
}

async function saveMemberType() {
  if (!code.value) return
  savingMember.value = true
  await gc.updateCode(code.value.id, { member_type_key: memberType.value || null })
  savingMember.value = false
  toast.add({ severity: 'success', summary: 'Member type saved', life: 1600 })
}

function addOwnRole(groupKey: string) {
  if (groupKey !== 'own') return
  roleItems.value.push({ _uid: ruid++, groupKey: 'own', editable: true, key: '', label: 'New role', capabilities: [] })
}
function removeOwnRole(role: RoleItem) { roleItems.value = roleItems.value.filter(r => r._uid !== role._uid) }

async function saveOwn() {
  if (!lineage.value) return
  savingOwn.value = true
  const own = roleItems.value.filter(r => r.groupKey === 'own' && r.label.trim())
  await cr.saveRolesForScope(lineage.value, own.map((r, i) => ({
    code_lineage_id: lineage.value, key: r.key || cr.slug(r.label), label: r.label.trim(), capabilities: r.capabilities, sort_order: i,
  })))
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
      <!-- DETAILS -->
      <AppCard title="Details" description="Name, colour and where this code sits.">
        <div class="p-4 sm:p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Name</label>
              <InputText v-model="detail.name" placeholder="e.g. Step 6" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Parent code</label>
              <Select v-model="detail.parent_id" :options="parentOptions" option-label="name" option-value="id"
                placeholder="None (top level)" show-clear filter class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Term</label>
              <Select v-model="detail.term_id" :options="terms" option-label="name" option-value="id"
                placeholder="No term" show-clear class="w-full" />
            </div>
          </div>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-gray-600 mr-1">Colour</span>
              <button v-for="c in PALETTE" :key="c" type="button" @click="detail.color = c"
                class="w-6 h-6 rounded-full border-2 transition"
                :class="detail.color === c ? 'border-gray-800 scale-110' : 'border-transparent'"
                :style="{ background: c }" />
            </div>
            <Button label="Save" :disabled="savingDetail || !detail.name.trim()" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveDetails" />
          </div>
        </div>
      </AppCard>

      <!-- MEMBER TYPE -->
      <AppCard title="Member type" description="The type of person who is a MEMBER in the groups under this code. Drives which custom fields apply to them.">
        <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <Select v-model="memberType" :options="personTypeOptions" optionLabel="label" optionValue="value"
            placeholder="Choose a member type" class="w-full sm:w-72" showClear filter />
          <Button label="Save" :disabled="savingMember" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveMemberType" />
        </div>
      </AppCard>

      <!-- STAFF ROLES — this code's own (editable) + inherited + default (read-only) -->
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">Staff roles</h2>
            <p class="text-xs text-gray-400">This code's own roles (apply to its sub-codes + groups), plus inherited &amp; default roles (read-only).</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <NuxtLink to="/groups/codes/default-roles" class="text-xs font-semibold text-primary hover:underline whitespace-nowrap">Edit default roles →</NuxtLink>
            <Button label="Save roles" size="small" :disabled="savingOwn" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveOwn" />
          </div>
        </div>
        <RolePermissions :groups="roleGroups" :roles="roleItems" :caps="cr.CODE_CAPABILITIES" @add="addOwnRole" @remove="removeOwnRole" />
      </div>

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
