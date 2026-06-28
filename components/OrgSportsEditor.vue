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

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

interface Row {
  id: string | null            // null = unsaved
  sport: string                // canonical (matches disciplines.sport)
  display_name: string         // club's label override; '' = use canonical
  nso_org_id: string | null
  is_primary: boolean
  sort_order: number
}

const rows = ref<Row[]>([])
const governingOrgs = ref<{ id: string; name: string; org_level: string; default_sport_name: string | null; _label: string }[]>([])
const loading = ref(true)
const saving = ref(false)
let removedIds: string[] = []

async function load() {
  loading.value = true
  removedIds = []
  const [sportsRes, orgsRes] = await Promise.all([
    (db.from as any)('org_sports').select('id, sport, display_name, nso_org_id, is_primary, sort_order').eq('org_id', orgId.value).order('sort_order'),
    (db.from as any)('organisations').select('id, name, org_level, default_sport_name').neq('id', orgId.value).order('name'),
  ])
  rows.value = (sportsRes.data ?? []).map((r: any) => ({
    id: r.id, sport: r.sport, display_name: r.display_name ?? '', nso_org_id: r.nso_org_id, is_primary: !!r.is_primary, sort_order: r.sort_order ?? 0,
  }))
  // Only governing bodies (a club can't govern another org).
  governingOrgs.value = (orgsRes.data ?? [])
    .filter((o: any) => isGoverningBody(o.org_level))
    .map((o: any) => ({ ...o, _label: `${o.name} · ${orgLevelLabel(o.org_level)}` }))
  loading.value = false
}

function addRow() {
  rows.value.push({ id: null, sport: '', display_name: '', nso_org_id: null, is_primary: rows.value.length === 0, sort_order: rows.value.length })
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

// Connecting a body seeds the canonical sport from its default name (and the
// display name, if the club hasn't typed one yet).
function onConnect(r: Row) {
  const body = governingOrgs.value.find(o => o.id === r.nso_org_id)
  if (body?.default_sport_name) {
    r.sport = body.default_sport_name
    if (!r.display_name.trim()) r.display_name = body.default_sport_name
  }
}
// The canonical sport: from the connected body, else the club's own typed name.
const canonicalOf = (r: Row) => (r.nso_org_id ? (r.sport || r.display_name) : (r.display_name || r.sport)).trim()
// Show the governed-as hint when the local label differs from the canonical sport.
const governedHint = (r: Row) => (r.nso_org_id && canonicalOf(r) && r.display_name.trim() && canonicalOf(r) !== r.display_name.trim()) ? canonicalOf(r) : ''

async function save() {
  const clean = rows.value.filter(r => canonicalOf(r))
  if (clean.length && !clean.some(r => r.is_primary)) clean[0].is_primary = true
  saving.value = true
  try {
    if (removedIds.length) await (db.from as any)('org_sports').delete().in('id', removedIds)
    // Clear primary flags up front so the partial unique index never trips mid-upsert.
    await (db.from as any)('org_sports').update({ is_primary: false }).eq('org_id', orgId.value)
    for (const [i, r] of clean.entries()) {
      const canonical = canonicalOf(r)
      const payload = {
        org_id: orgId.value, sport: canonical,
        display_name: r.display_name.trim() && r.display_name.trim() !== canonical ? r.display_name.trim() : null,
        nso_org_id: r.nso_org_id, is_primary: false, sort_order: i,
      }
      if (r.id) await (db.from as any)('org_sports').update(payload).eq('id', r.id)
      else { const { data } = await (db.from as any)('org_sports').insert(payload).select('id').single(); if (data) r.id = data.id }
    }
    const primary = clean.find(r => r.is_primary)
    if (primary?.id) await (db.from as any)('org_sports').update({ is_primary: true }).eq('id', primary.id)
    await (db.from as any)('organisations').update({ parent_id: primary?.nso_org_id ?? null }).eq('id', orgId.value)

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
