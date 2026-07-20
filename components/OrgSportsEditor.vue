<!--
  Affiliation editor (multi-sport clubs). Lists the sports a club runs and
  connects each to a governing body (NSO). The club can OVERRIDE the displayed
  name (e.g. call Cricket "Cricky") while the canonical sport — seeded from the
  governing body's default_sport_name — is what matches disciplines. One sport is
  the PRIMARY: source of inherited terminology/branding, mirrored to
  organisations.parent_id so existing single-chain inheritance keeps working.

  Persists to org_sports (migrations 148 + 149). Self-contained; dropped into
  Settings → General.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const { orgId } = useOrg()
const toast = useToast()
const affApi = useAffiliationsApi()
const orgsApi = useOrganisationsApi()

interface Row {
  id: string | null            // null = unsaved
  sport: string                // canonical (matches disciplines.sport)
  display_name: string         // club's label override; '' = use canonical
  nso_org_id: string | null
  is_primary: boolean
  sort_order: number
  // Affiliation is a HANDSHAKE (mig 273): picking a body REQUESTS it. Nothing
  // inherits until they approve — org_sport_ancestors filters on this.
  affiliation_status: AffiliationStatus
  _wasBody: string | null      // the body as last saved; changing it re-requests
}

const rows = ref<Row[]>([])
const governingOrgs = ref<{ id: string; name: string; org_level: string; default_sport_name: string | null; _label: string }[]>([])
const loading = ref(true)
const saving = ref(false)
let removedIds: string[] = []

async function load() {
  if (!orgId.value) return
  loading.value = true
  removedIds = []
  const [sports, bodies] = await Promise.all([
    affApi.orgSports(orgId.value),
    affApi.governingBodies(orgId.value),
  ])
  rows.value = sports.map(r => ({
    id: r.id, sport: r.sport, display_name: r.displayName ?? '', nso_org_id: r.nsoOrgId, is_primary: !!r.isPrimary, sort_order: r.sortOrder ?? 0,
    affiliation_status: (r.affiliationStatus ?? 'pending') as AffiliationStatus, _wasBody: r.nsoOrgId,
  }))
  // Only governing bodies (a club can't govern another org).
  governingOrgs.value = bodies
    .filter(o => isGoverningBody(o.orgLevel))
    .map(o => ({ id: o.id, name: o.name, org_level: o.orgLevel, default_sport_name: o.defaultSportName, _label: `${o.name} · ${orgLevelLabel(o.orgLevel)}` }))
  loading.value = false
}

function addRow() {
  rows.value.push({ id: null, sport: '', display_name: '', nso_org_id: null, is_primary: rows.value.length === 0, sort_order: rows.value.length, affiliation_status: 'pending', _wasBody: null })
}
function removeRow(i: number) {
  const r = rows.value[i]
  if (r.id) removedIds.push(r.id)
  rows.value.splice(i, 1)
  if (r.is_primary && rows.value.length && !rows.value.some(x => x.is_primary)) rows.value[0].is_primary = true
}
function setPrimary(i: number) {
  rows.value.forEach((r, idx) => { r.is_primary = idx === i })
}

// Connecting a body seeds the canonical sport from its default name — or, when the
// body has none set, from the body's own NAME (never leave it blank, or the row has
// no canonical value and save() silently drops it). Also seeds the display name if
// the club hasn't typed one yet.
function onConnect(r: Row) {
  const body = governingOrgs.value.find(o => o.id === r.nso_org_id)
  const seed = body?.default_sport_name?.trim() || body?.name?.trim() || ''
  if (seed) {
    r.sport = seed
    if (!r.display_name.trim()) r.display_name = seed
  }
}
// The connected body's name — the last-resort canonical value so a row that has a
// body chosen is NEVER filtered out on save (a blank sport used to drop it silently).
const bodyNameOf = (r: Row) => governingOrgs.value.find(o => o.id === r.nso_org_id)?.name?.trim() || ''
// The canonical sport: from the connected body (typed sport → display → body name),
// else the club's own typed name.
const canonicalOf = (r: Row) => (r.nso_org_id ? (r.sport || r.display_name || bodyNameOf(r)) : (r.display_name || r.sport)).trim()
// Show the governed-as hint when the local label differs from the canonical sport.
const governedHint = (r: Row) => (r.nso_org_id && canonicalOf(r) && r.display_name.trim() && canonicalOf(r) !== r.display_name.trim()) ? canonicalOf(r) : ''

async function save() {
  const clean = rows.value.filter(r => canonicalOf(r))
  if (clean.length && !clean.some(r => r.is_primary)) clean[0].is_primary = true
  saving.value = true
  try {
    for (const id of removedIds) await affApi.removeOrgSport(id)
    // Clear primary flags up front so the partial unique index never trips mid-upsert.
    await affApi.clearPrimarySports(orgId.value!)
    for (const [i, r] of clean.entries()) {
      const canonical = canonicalOf(r)
      // Picking (or changing) a body REQUESTS affiliation — it does not grant it.
      // An unchanged body keeps whatever the body already decided.
      const bodyChanged = r.nso_org_id !== r._wasBody
      const status: AffiliationStatus = !r.nso_org_id ? 'pending' : bodyChanged ? 'pending' : r.affiliation_status
      const base: any = {
        orgId: orgId.value, sport: canonical,
        displayName: r.display_name.trim() && r.display_name.trim() !== canonical ? r.display_name.trim() : null,
        nsoOrgId: r.nso_org_id, isPrimary: false, sortOrder: i,
        affiliationStatus: status,
      }
      if (r.id) {
        const patch = { ...base }
        // A body change re-requests: reset the handshake timestamps.
        if (bodyChanged && r.nso_org_id) { patch.requestedAt = new Date().toISOString(); patch.decidedAt = null; patch.decidedBy = null }
        await affApi.updateOrgSport(r.id, patch)
      } else {
        // A new row's requestedAt defaults in the DB, so create takes the base only.
        const created = await affApi.createOrgSport(base)
        r.id = created.id
      }
      r.affiliation_status = status
      r._wasBody = r.nso_org_id
    }
    const primary = clean.find(r => r.is_primary)
    if (primary?.id) await affApi.updateOrgSport(primary.id, { isPrimary: true })
    // parent_id mirrors the primary sport's body — but ONLY once they've approved.
    // Setting it from a mere request would hand the club every ancestor's fields
    // through org_ancestors, quietly routing around the approval we just added.
    // Re-parenting is a privileged, tenant-crossing op (security CRIT-3), so it has
    // its own endpoint (not the general org patch).
    const primaryBody = primary && inherits(primary) ? primary.nso_org_id : null
    await orgsApi.setParent(orgId.value, primaryBody)

    removedIds = []
    toast.add({ severity: 'success', summary: 'Affiliation saved', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: e?.message ?? String(e), life: 5000 })
  } finally {
    saving.value = false
  }
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="card p-5">
    <h2 class="text-sm font-semibold text-surface-700 mb-1">Affiliation</h2>
    <p class="text-xs text-surface-500 mb-4">Connect this club to its governing bodies. Add each sport you run and link it to the organisation (NSO / association) that governs it — events and groups then pick a sport to reach that body's disciplines. You can rename a sport locally (e.g. call Cricket "Cricky"); it still matches the governing body's disciplines. The <span class="font-medium">primary</span> sport is the source of inherited terminology and branding.</p>

    <div v-if="loading" class="text-sm text-surface-400 py-2">Loading…</div>

    <div v-else class="space-y-2">
      <div v-if="rows.length" class="hidden sm:grid grid-cols-[1.4fr_1fr_auto_auto] gap-2 px-1 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
        <span>Governing body (NSO)</span><span>Name</span><span class="text-center">Primary</span><span />
      </div>

      <div v-for="(r, i) in rows" :key="i" class="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_auto_auto] gap-2 items-start">
        <Select v-model="r.nso_org_id" :options="governingOrgs" option-label="_label" option-value="id"
          placeholder="Not connected" filter show-clear class="w-full" @change="onConnect(r)" />
        <div class="flex flex-col gap-0.5">
          <InputText v-model="r.display_name" placeholder="e.g. Cricket" class="w-full" />
          <span v-if="governedHint(r)" class="text-[10px] text-surface-400 pl-1">governed as “{{ governedHint(r) }}”</span>
          <!-- Affiliation is a handshake: the club asks, the body decides. Nothing
               of theirs applies until it says Affiliated. -->
          <span v-if="r.nso_org_id && r.id" class="text-[10px] pl-1 inline-flex items-center gap-1"
            :class="r.affiliation_status === 'approved' ? 'text-emerald-600' : r.affiliation_status === 'revoked' ? 'text-rose-600' : 'text-amber-600'">
            <i class="pi text-[9px]" :class="r.affiliation_status === 'approved' ? 'pi-check-circle' : r.affiliation_status === 'revoked' ? 'pi-times-circle' : 'pi-clock'" />
            {{ AFFILIATION_LABELS[r.affiliation_status] }}
            <span v-if="r.affiliation_status !== 'approved'" class="text-surface-400">— their fields don’t apply yet</span>
          </span>
        </div>
        <div class="flex justify-center w-16 pt-2.5">
          <button type="button" class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
            :class="r.is_primary ? 'border-primary bg-primary' : 'border-gray-300 hover:border-primary/50'"
            v-tooltip.top="'Make primary'" @click="setPrimary(i)">
            <i v-if="r.is_primary" class="pi pi-check text-white text-[8px]" />
          </button>
        </div>
        <button type="button" class="text-gray-300 hover:text-red-500 w-8 h-8 flex items-center justify-center pt-1" @click="removeRow(i)">
          <i class="pi pi-trash text-xs" />
        </button>
      </div>

      <p v-if="!rows.length" class="text-sm text-surface-400 py-1">No sports yet.</p>

      <button type="button" class="text-sm text-primary hover:underline mt-1" @click="addRow">
        <i class="pi pi-plus text-[10px] mr-1" />Add sport
      </button>
    </div>

    <div class="mt-4 flex justify-end">
      <Button label="Save Affiliation" :loading="saving" size="small" @click="save" />
    </div>
  </div>
</template>
