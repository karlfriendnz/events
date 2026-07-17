<!--
  Connects an event/group to the disciplines of the club's governing bodies — so
  it rolls up for cross-club reporting.

  ONE field. Every discipline the club can reach (across all of its connected
  sports, org_sports migration 148) is listed in a single MultiSelect, grouped
  under the GOVERNING BODY that owns it. The sport is IMPLIED by what you pick —
  there is no separate sport picker to narrow the list first.

  A club can operate standalone (a sport with no governing body) — then there are
  simply no disciplines to link, and we say so.

  Disciplines are sourced from each sport's full governing chain (the connected
  body + its ancestors) via the org_sport_ancestors RPC. Auto-saves to
  member_group_disciplines / event_disciplines.
-->
<script setup lang="ts">
const props = defineProps<{ entityType: 'group' | 'event'; entityId: string }>()
const db = useDb()
const { orgId } = useOrg()

const joinTable = props.entityType === 'group' ? 'member_group_disciplines' : 'event_disciplines'
const fk = props.entityType === 'group' ? 'group_id' : 'event_id'

interface Disc { id: string; name: string; parent_id: string | null; sort_order: number; nso: string }
const orgSports = ref<{ sport: string; nso_org_id: string | null }[]>([])
const allDisciplines = ref<Disc[]>([])          // every discipline reachable across the club's connected sports
const selected = ref<string[]>([])              // linked discipline ids
const loading = ref(true)
const saving = ref(false)

const connectedSports = computed(() => orgSports.value.filter(s => s.nso_org_id))
/** This org authors disciplines of its own — i.e. it IS a governing body, linking
 *  its own groups/events. Changes what an empty picker should tell you. */
const ownsDisciplines = ref(false)

async function load() {
  loading.value = true
  // Steps 1, 2 and the existing-links lookup are all independent (keyed only by
  // org + entity, both known upfront), so fire them together instead of chaining
  // three serial round-trips. Only the disciplines fetch depends on step 2.
  const [sportsRes, ancRes, linksRes] = await Promise.all([
    // 1. The club's sports + which are connected to a governing body.
    (db.from as any)('org_sports')
      .select('sport, nso_org_id').eq('org_id', orgId.value).order('sort_order'),
    // 2. Every governing body reachable from the club's connected sports.
    (db.rpc as any)('org_sport_ancestors', { p_org: orgId.value, p_sport: null }),
    // 3. Existing links.
    (db.from as any)(joinTable).select('discipline_id').eq(fk, props.entityId),
  ])
  orgSports.value = sportsRes?.data ?? []

  // Disciplines this org can reach: the governing bodies ABOVE it (step 2), plus
  // its OWN.
  //
  // Its own matters because a governing body runs groups and events too, and it is
  // affiliated to nobody — so it has no org_sports rows, resolves no ancestors, and
  // was being told to "connect a sport to a governing body" while looking at the
  // very disciplines it had just authored. A club owns no disciplines, so including
  // itself costs a club nothing.
  const govIds = [...new Set([orgId.value, ...(ancRes?.data ?? []).map((a: any) => a.id)])].filter(Boolean)
  if (govIds.length) {
    const { data: discs } = await (db.from as any)('disciplines')
      .select('id, name, parent_id, sort_order, applies_to, org_id, organisations(name)').in('org_id', govIds).order('sort_order').order('name')
    // A discipline shows here only when it's scoped to this context (event/group)
    // or scoped to nothing at all (applies everywhere). Its ANCESTORS are always
    // kept so a shown child never dangles without its parent in the tree.
    const rows = (discs ?? [])
    const inContext = (d: any) => !d.applies_to || !d.applies_to.length || d.applies_to.includes(props.entityType)
    const keep = new Set<string>()
    for (const d of rows) if (inContext(d)) keep.add(d.id)
    const byId = new Map(rows.map((d: any) => [d.id, d]))
    for (const d of rows) if (keep.has(d.id)) {
      let p = d.parent_id
      while (p && byId.has(p) && !keep.has(p)) { keep.add(p); p = (byId.get(p) as any).parent_id }
    }
    // Measured BEFORE the applies_to filter: "you author disciplines but none apply
    // to a group" and "you author none" are different problems and must not read the
    // same.
    ownsDisciplines.value = rows.some((d: any) => d.org_id === orgId.value)
    allDisciplines.value = rows.filter((d: any) => keep.has(d.id))
      .map((d: any) => ({ id: d.id, name: d.name, parent_id: d.parent_id ?? null, sort_order: d.sort_order ?? 0, nso: d.organisations?.name ?? '' }))
  } else {
    allDisciplines.value = []
    ownsDisciplines.value = false
  }

  selected.value = (linksRes?.data ?? []).map((l: any) => l.discipline_id)
  loading.value = false
}

async function save() {
  saving.value = true
  await (db.from as any)(joinTable).delete().eq(fk, props.entityId)
  if (selected.value.length) {
    await (db.from as any)(joinTable).insert(selected.value.map(id => ({ [fk]: props.entityId, discipline_id: id })))
  }
  saving.value = false
}

// One discipline available in the whole club = no choice to make: carry it
// forward automatically. Runs ONCE — otherwise clearing the selection instantly
// re-added it and the user could never change their mind.
const autoPicked = ref(false)
watch(allDisciplines, discs => {
  if (loading.value || saving.value || autoPicked.value) return
  if (discs.length === 1 && selected.value.length === 0) {
    autoPicked.value = true
    selected.value = [discs[0].id]
    save()
  }
}, { immediate: true })

// One group per GOVERNING BODY (heading), its disciplines depth-ordered so a
// child sits under its parent (Seniors › Premiers › B Grade). The body is the
// heading rather than `disciplines.sport` because a body already implies its
// sport — the string was hand-typed onto every row and had to match exactly to
// group correctly, while the owning org is true by construction.
const disciplineGroups = computed(() => {
  const byBody: Record<string, Disc[]> = {}
  for (const d of allDisciplines.value) (byBody[d.nso || 'Disciplines'] ??= []).push(d)

  return Object.entries(byBody).map(([body, discs]) => {
    const ids = new Set(discs.map(d => d.id))
    const byParent: Record<string, Disc[]> = {}
    for (const d of discs) {
      // A discipline whose parent isn't in this body's set is treated as a root,
      // so it can never silently vanish from the list.
      const parent = d.parent_id && ids.has(d.parent_id) ? d.parent_id : '__root'
      ;(byParent[parent] ??= []).push(d)
    }
    const items: any[] = []
    const walk = (parent: string, depth: number) => {
      for (const d of (byParent[parent] ?? []).sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))) {
        items.push({ ...d, _depth: depth })
        walk(d.id, depth + 1)
      }
    }
    walk('__root', 0)
    return { label: body, items }
  }).filter(g => g.items.length)
})

// Changed your mind — drop every linked discipline (and don't let the
// one-discipline auto-pick immediately put it back).
function clearDisciplines() {
  autoPicked.value = true
  selected.value = []
  save()
}

watch(() => props.entityId, (v) => { if (v) load() }, { immediate: true })
</script>

<template>
  <div v-if="!loading">
    <!-- ONE picker: every discipline this org can reach, grouped by the body that
         owns them. Chips are removable and the whole thing is clearable, so a
         choice can always be undone.
         Gated on having DISCIPLINES, not on having org_sports rows: a governing
         body has none of the latter and all of the former. -->
    <template v-if="allDisciplines.length">
      <div class="flex items-center gap-2">
        <!-- <ChipMultiSelect>, not a raw MultiSelect: selected values collapse to
             "First + N more" on ONE line instead of wrapping into a growing wall
             of half-truncated chips. That's the system-wide rule for any
             multi-select that can overflow its field. -->
        <ChipMultiSelect v-model="selected" :options="disciplineGroups"
          option-label="name" option-value="id"
          option-group-label="label" option-group-children="items"
          filter placeholder="Link to disciplines" class="flex-1 min-w-0" @hide="save">
          <template #optiongroup="{ option }">
            <span class="text-xs font-bold uppercase tracking-wide text-gray-500">{{ option.label }}</span>
          </template>
          <template #option="{ option }">
            <div class="flex items-center gap-2" :style="{ paddingLeft: `${option._depth * 16}px` }">
              <i v-if="option._depth" class="pi pi-angle-right text-[10px] text-gray-300" />
              <span :class="option._depth ? 'text-gray-700' : 'font-medium text-gray-800'">{{ option.name }}</span>
            </div>
          </template>
        </ChipMultiSelect>
        <Button v-if="selected.length" icon="pi pi-times" size="small" severity="secondary" text
          v-tooltip.top="'Clear disciplines'" @click="clearDisciplines" />
      </div>
      <p class="text-xs text-surface-400 mt-1">
        {{ ownsDisciplines
          ? `Puts this ${entityType} in a discipline, so what it requires applies to the people in it.`
          : `Maps this ${entityType} to your governing body's disciplines so it rolls up for cross-club reporting.` }}
        <span v-if="saving" class="text-primary">· saving…</span>
      </p>
    </template>

    <!-- Nothing to link — three different reasons, which must not read the same. -->
    <p v-else-if="ownsDisciplines" class="text-xs text-surface-400">
      No disciplines apply to a {{ entityType }} yet. Add one in
      <NuxtLink to="/disciplines" class="text-primary hover:underline">Settings → Disciplines</NuxtLink>,
      and make sure its “where it applies” covers {{ entityType }}s.
    </p>
    <p v-else-if="!connectedSports.length" class="text-xs text-surface-400">
      None of your sports are connected to a governing body, so there are no disciplines to link. Connect one in <NuxtLink to="/settings/locations" class="text-primary hover:underline">Settings → Sports &amp; locations</NuxtLink> to enable cross-club reporting.
    </p>
    <p v-else class="text-xs text-surface-400">
      Your governing {{ connectedSports.length === 1 ? 'body hasn\'t' : 'bodies haven\'t' }} defined any disciplines that apply to a {{ entityType }} yet.
    </p>
  </div>
</template>
