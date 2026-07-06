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
const { ensureTerms, t } = useTerms()
void ensureTerms()

// Code details (name / colour / parent / term) — edited here, not on the list.
const PALETTE = ['#1E2157', '#2563EB', '#0f766e', '#059669', '#9333ea', '#EC4899', '#c2410c', '#be123c', '#8B5CF6', '#64748b']
const terms = ref<any[]>([])
const detail = reactive<{ name: string; color: string; parent_id: string | null; term_id: string | null }>({ name: '', color: PALETTE[0], parent_id: null, term_id: null })
const savingAll = ref(false)
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
// This code's OWN per-role minimums (people per group). Keyed by role key.
const roleMins = ref<Record<string, number>>({})
function setRoleMin(key: string, v: number | null | undefined) {
  if (!key) return
  if (typeof v === 'number' && v > 0) roleMins.value[key] = v
  else delete roleMins.value[key]
}
// The minimum for a role INHERITED from parent codes (this code's own value
// aside) — shown as a hint so the user sees what they'd be overriding.
function inheritedMin(key: string): number | null {
  if (!code.value) return null
  return gc.effectiveRoleMins({ code_id: code.value.parent_id }, codesById.value)[key] ?? null
}
// Member POSITIONS (Captain, Wing…) — this code's own catalogue (editable) plus a
// read-only view of positions inherited from parent codes (migration 216).
const positions = ref<string[]>([])
const newPosition = ref('')
const newPositionMin = ref<number | null>(null)
// This code's own per-position minimums (people per group). Keyed by position.
const positionMins = ref<Record<string, number>>({})
const inheritedPositions = computed(() => code.value
  ? gc.effectivePositions({ code_id: code.value.parent_id }, codesById.value)
  : [])
// Every position available on THIS code (own + inherited + org defaults), for the
// minimum-per-position table — with where each one comes from.
const effectivePositionRows = computed(() => {
  const rows: { name: string; own: boolean }[] = []
  const seen = new Set<string>()
  for (const p of positions.value) { const k = p.toLowerCase(); if (!seen.has(k)) { seen.add(k); rows.push({ name: p, own: true }) } }
  for (const p of inheritedPositions.value) { const k = p.toLowerCase(); if (!seen.has(k)) { seen.add(k); rows.push({ name: p, own: false }) } }
  return rows
})
function addPosition() {
  const n = newPosition.value.trim()
  if (n && !positions.value.some(p => p.toLowerCase() === n.toLowerCase())
        && !inheritedPositions.value.some(p => p.toLowerCase() === n.toLowerCase())) {
    positions.value.push(n)
    if (typeof newPositionMin.value === 'number' && newPositionMin.value > 0) positionMins.value[n] = newPositionMin.value
  }
  newPosition.value = ''
  newPositionMin.value = null
}
function removePosition(i: number) {
  const removed = positions.value.splice(i, 1)[0]
  if (removed) delete positionMins.value[removed]
}
function setPositionMin(name: string, v: number | null | undefined) {
  if (typeof v === 'number' && v > 0) positionMins.value[name] = v
  else delete positionMins.value[name]
}
// A position's minimum INHERITED from parent codes (this code's own aside).
function inheritedPositionMin(name: string): number | null {
  if (!code.value) return null
  return gc.effectivePositionMins({ code_id: code.value.parent_id }, codesById.value)[name] ?? null
}
const hasInherited = computed(() => roleItems.value.some(r => r.groupKey === 'inherited'))
const roleGroups = computed(() => [
  { key: 'own', label: `This ${t('code', false, true)}`, addable: true },
  ...(hasInherited.value ? [{ key: 'inherited', label: `Inherited from parent ${t('code', true, true)}`, note: `Set on a parent ${t('code', false, true)} — edit it there.` }] : []),
  { key: 'default', label: `Default (all ${t('code', true, true)})`, note: `Applies to every ${t('code', false, true)} — edit on the Default roles page.` },
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
    // Only THIS club's own person types (not inherited from an NSO/parent org).
    policy.loadOrgTypes(orgId.value),
    cr.ensureDefaults(),
    cr.loadStaff(),
    tm.loadTerms(),
    gc.loadDefaultPositions(true),
  ])
  codes.value = loadedCodes
  allDefs.value = defs
  staff.value = staffRows
  terms.value = loadedTerms ?? []
  personTypeOptions.value = (types ?? []).filter((t: any) => (t.kind ?? 'person') === 'person').map((t: any) => ({ label: t.label, value: t.key }))
  memberType.value = code.value?.member_type_key ?? null
  roleMins.value = { ...(code.value?.role_minimums || {}) }
  positions.value = [...(code.value?.member_positions || [])]
  positionMins.value = { ...(code.value?.position_minimums || {}) }
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

function addOwnRole(groupKey: string) {
  if (groupKey !== 'own') return
  roleItems.value.push({ _uid: ruid++, groupKey: 'own', editable: true, key: '', label: 'New role', capabilities: [] })
}
function removeOwnRole(role: RoleItem) { roleItems.value = roleItems.value.filter(r => r._uid !== role._uid) }

// One Save for the whole page — details + member type + this code's own roles.
// (Assigning people saves instantly and isn't part of this.)
async function saveAll() {
  if (!code.value || !detail.name.trim()) return
  savingAll.value = true
  // Keep only positive minimums so an empty map means "inherit / no minimum".
  const mins: Record<string, number> = {}
  for (const [k, v] of Object.entries(roleMins.value)) if (typeof v === 'number' && v > 0) mins[k] = v
  const posMins: Record<string, number> = {}
  for (const [k, v] of Object.entries(positionMins.value)) if (typeof v === 'number' && v > 0) posMins[k] = v
  await gc.updateCode(code.value.id, {
    name: detail.name.trim(), color: detail.color, parent_id: detail.parent_id, term_id: detail.term_id,
    member_type_key: memberType.value || null, role_minimums: mins,
    member_positions: positions.value.map(p => p.trim()).filter(Boolean),
    position_minimums: posMins,
  })
  if (lineage.value) {
    const own = roleItems.value.filter(r => r.groupKey === 'own' && r.label.trim())
    await cr.saveRolesForScope(lineage.value, own.map((r, i) => ({
      code_lineage_id: lineage.value, key: r.key || cr.slug(r.label), label: r.label.trim(), capabilities: r.capabilities, sort_order: i,
    })))
  }
  savingAll.value = false
  await load()
  toast.add({ severity: 'success', summary: 'Saved', life: 1600 })
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
        <i class="pi pi-arrow-left text-xs" /> Organise {{ t('code', true, true) }}
      </NuxtLink>
      <div class="flex items-center gap-2 mt-2">
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: code?.color || '#94a3b8' }" />
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">{{ code?.name || t('code') }}</h1>
        <span class="text-xs text-gray-400">settings</span>
        <Button v-if="code" label="Save" class="ml-auto shrink-0" :disabled="savingAll || !detail.name.trim()"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveAll" />
      </div>
    </div>

    <div v-if="loading" class="card p-6 text-sm text-gray-400">Loading…</div>
    <div v-else-if="!code" class="card p-6 text-sm text-gray-500">This {{ t('code', false, true) }} no longer exists.</div>

    <template v-else>
      <!-- DETAILS -->
      <AppCard title="Details" :description="`Name, colour, where this ${t('code', false, true)} sits and the ${t('member', false, true)} type it captures.`">
        <div class="p-4 sm:p-5 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Name</label>
              <InputText v-model="detail.name" placeholder="e.g. Step 6" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">{{ t('member') }} type</label>
              <Select v-model="memberType" :options="personTypeOptions" optionLabel="label" optionValue="value"
                :placeholder="`Choose a ${t('member', false, true)} type`" class="w-full" showClear filter />
              <p class="text-[11px] text-gray-400">The type of {{ t('member', false, true) }} in this {{ t('code', false, true) }}'s {{ t('group', true, true) }} — drives their custom fields.</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Parent {{ t('code', false, true) }}</label>
              <Select v-model="detail.parent_id" :options="parentOptions" option-label="name" option-value="id"
                placeholder="None (top level)" show-clear filter class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">{{ t('term') }}</label>
              <Select v-model="detail.term_id" :options="terms" option-label="name" option-value="id"
                :placeholder="`No ${t('term', false, true)}`" show-clear class="w-full" />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-600 mr-1">Colour</span>
            <button v-for="c in PALETTE" :key="c" type="button" @click="detail.color = c"
              class="w-6 h-6 rounded-full border-2 transition"
              :class="detail.color === c ? 'border-gray-800 scale-110' : 'border-transparent'"
              :style="{ background: c }" />
          </div>
        </div>
      </AppCard>

      <!-- MEMBER POSITIONS — labels (Captain, Wing…) with no permissions -->
      <AppCard :title="`${t('member')} positions`" :description="`Positions a ${t('member', false, true)} can hold in these ${t('group', true, true)} (Captain, Vice, Wing…). These are labels — no permissions. Set an optional minimum per ${t('group', false, true)} (e.g. 2 Wings). Available when you add a ${t('member', false, true)} to a ${t('group', false, true)}.`">
        <div class="overflow-hidden">
          <!-- two columns: Position | Minimum per group -->
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-xs text-gray-500 border-y border-gray-100">
                <th class="text-left px-4 sm:px-5 py-2 font-medium">Position</th>
                <th class="text-left px-4 py-2 font-medium w-40">Minimum per {{ t('group', false, true) }}</th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in effectivePositionRows" :key="row.name" class="border-b border-gray-50 hover:bg-gray-50/60">
                <td class="px-4 sm:px-5 py-2 align-middle">
                  <span class="text-gray-800 inline-flex items-center gap-1.5">
                    {{ row.name }}
                    <span v-if="!row.own" class="text-[9px] text-gray-400 inline-flex items-center gap-0.5"><i class="pi pi-lock text-[8px]" />inherited</span>
                  </span>
                </td>
                <td class="px-4 py-2 align-middle">
                  <InputNumber :modelValue="positionMins[row.name] ?? null" :min="0" :max="99" showButtons buttonLayout="horizontal"
                    :placeholder="inheritedPositionMin(row.name) != null ? String(inheritedPositionMin(row.name)) : 'None'"
                    class="w-32" :inputStyle="{ width: '3.5rem' }"
                    @update:modelValue="v => setPositionMin(row.name, v)" />
                </td>
                <td class="px-3 py-2 text-center align-middle">
                  <button v-if="row.own" type="button" class="text-gray-300 hover:text-red-500" title="Remove position"
                    @click="removePosition(positions.indexOf(row.name))"><i class="pi pi-trash text-sm" /></button>
                </td>
              </tr>
              <!-- add row: two fields (name + minimum) -->
              <tr class="bg-gray-50/40">
                <td class="px-4 sm:px-5 py-2.5 align-middle">
                  <InputText v-model="newPosition" placeholder="Add a position (e.g. Captain)" class="w-full" @keydown.enter.prevent="addPosition" />
                </td>
                <td class="px-4 py-2.5 align-middle">
                  <InputNumber v-model="newPositionMin" :min="0" :max="99" showButtons buttonLayout="horizontal"
                    placeholder="None" class="w-32" :inputStyle="{ width: '3.5rem' }" @keydown.enter.prevent="addPosition" />
                </td>
                <td class="px-3 py-2.5 text-center align-middle">
                  <Button icon="pi pi-plus" text rounded size="small" :disabled="!newPosition.trim()" title="Add position" @click="addPosition" />
                </td>
              </tr>
              <tr v-if="!effectivePositionRows.length && !newPosition">
                <td colspan="3" class="px-4 sm:px-5 py-3 text-xs text-gray-400">No positions yet — add one above.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppCard>

      <!-- STAFF ROLES — this code's own (editable) + inherited + default (read-only) -->
      <AppCard title="Staff roles" :description="`This ${t('code', false, true)}'s own roles (apply to its sub-${t('code', true, true)} + ${t('group', true, true)}), plus inherited & default roles (read-only).`">
        <template #header-action>
          <NuxtLink to="/groups/codes/default-roles" class="text-xs font-semibold text-primary hover:underline whitespace-nowrap">Edit default roles →</NuxtLink>
        </template>
        <div class="p-4 sm:p-5">
        <RolePermissions :groups="roleGroups" :roles="roleItems" :caps="cr.CODE_CAPABILITIES" @add="addOwnRole" @remove="removeOwnRole">
          <template #role-meta="{ role }">
            <div class="px-4 py-3 border-b border-gray-100 bg-gray-50/40">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-800">Minimum per {{ t('group', false, true) }}</p>
                  <p class="text-[11px] text-gray-400 leading-snug">
                    How many people should hold this role in each {{ t('group', false, true) }} in this {{ t('code', false, true) }}.
                    <template v-if="role.key && inheritedMin(role.key) != null && roleMins[role.key] == null">
                      Inherited: <span class="font-medium text-gray-500">{{ inheritedMin(role.key) }}</span> (from a parent {{ t('code', false, true) }}).
                    </template>
                  </p>
                </div>
                <InputNumber v-if="role.key" :modelValue="roleMins[role.key] ?? null" :min="0" :max="99" showButtons
                  :placeholder="inheritedMin(role.key) != null ? String(inheritedMin(role.key)) : 'None'"
                  class="w-28 shrink-0" :inputStyle="{ width: '5rem' }"
                  @update:modelValue="v => setRoleMin(role.key, v)" />
                <span v-else class="text-[11px] text-gray-400 shrink-0">Save the role first</span>
              </div>
            </div>
          </template>
          <template #role-footer="{ role }">
            <div class="card p-4">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-gray-800">People in this role</span>
                <button v-if="role.key" type="button" class="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1" @click="openAssign(role.key)">
                  <i class="pi pi-user-plus text-[10px]" /> Assign
                </button>
              </div>
              <p v-if="!role.key" class="text-xs text-gray-400 mt-2">Save this role first, then assign people to it.</p>
              <template v-else>
                <div v-if="staffForRole(role.key).length" class="flex flex-wrap gap-1.5 mt-2">
                  <span v-for="s in staffForRole(role.key)" :key="s.id"
                    class="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 rounded-full pl-2.5 pr-1 py-1">
                    {{ personName(s) }}
                    <span v-if="s.scope === 'inherited'" class="text-[9px] text-gray-400">· {{ s.fromLabel }}</span>
                    <button v-if="s.scope === 'own'" type="button" class="text-gray-400 hover:text-red-500" title="Remove" @click="unassign(s)"><i class="pi pi-times-circle text-xs" /></button>
                  </span>
                </div>
                <p v-else class="text-xs text-gray-400 mt-2">No one assigned.</p>
              </template>
            </div>
          </template>
        </RolePermissions>
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
