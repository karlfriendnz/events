<!--
  Connects an event/group to a SPORT, then (if that sport is governed by an NSO)
  to that NSO's disciplines — so it rolls up for cross-club reporting.

  Sport-first model (org_sports, migration 148). Visibility rules:
    • Sport picker shows only when the club runs MULTIPLE sports. One sport →
      auto-selected and hidden. Zero → nothing to do.
    • Discipline picker shows only when the chosen sport is CONNECTED to an NSO.
      A club can operate standalone (sport with no governing body) — then there
      are simply no disciplines to pick.

  Disciplines are sourced from the sport's full governing chain (the connected
  body + its ancestors) via the org_sport_ancestors RPC. Auto-saves to
  member_group_disciplines / event_disciplines.
-->
<script setup lang="ts">
const props = defineProps<{ entityType: 'group' | 'event'; entityId: string }>()
const db = useDb()
const { orgId } = useOrg()

const joinTable = props.entityType === 'group' ? 'member_group_disciplines' : 'event_disciplines'
const fk = props.entityType === 'group' ? 'group_id' : 'event_id'

interface Disc { id: string; name: string; sport: string | null; nso: string }
const orgSports = ref<{ sport: string; nso_org_id: string | null }[]>([])
const allDisciplines = ref<Disc[]>([])          // every discipline reachable across the club's connected sports
const selectedSport = ref<string | null>(null)
const selected = ref<string[]>([])              // linked discipline ids for the chosen sport
const loading = ref(true)
const saving = ref(false)

const showSportPicker = computed(() => orgSports.value.length > 1)
const currentSport = computed(() => orgSports.value.find(s => s.sport === selectedSport.value) || null)
const isConnected = computed(() => !!currentSport.value?.nso_org_id)
const sportDisciplines = computed(() => allDisciplines.value.filter(d => d.sport === selectedSport.value))
const sportById = computed(() => Object.fromEntries(allDisciplines.value.map(d => [d.id, d.sport])))

async function load() {
  loading.value = true
  // 1. The club's sports + which are connected to a governing body.
  const { data: sportsData } = await (db.from as any)('org_sports')
    .select('sport, nso_org_id').eq('org_id', orgId.value).order('sort_order')
  orgSports.value = sportsData ?? []

  // 2. Every governing body reachable from the club's connected sports, then
  //    that whole set's disciplines.
  const { data: anc } = await (db.rpc as any)('org_sport_ancestors', { p_org: orgId.value, p_sport: null })
  const govIds = (anc ?? []).map((a: any) => a.id)
  if (govIds.length) {
    const { data: discs } = await (db.from as any)('disciplines')
      .select('id, name, sport, organisations(name)').in('org_id', govIds).order('sport').order('sort_order').order('name')
    allDisciplines.value = (discs ?? []).map((d: any) => ({ id: d.id, name: d.name, sport: d.sport, nso: d.organisations?.name ?? '' }))
  } else {
    allDisciplines.value = []
  }

  // 3. Existing links → derive the chosen sport from them; else auto-pick the sole sport.
  const { data: links } = await (db.from as any)(joinTable).select('discipline_id').eq(fk, props.entityId)
  const linkedIds = (links ?? []).map((l: any) => l.discipline_id)
  selectedSport.value = (linkedIds.length && sportById.value[linkedIds[0]])
    || (orgSports.value.length === 1 ? orgSports.value[0].sport : null)
  selected.value = linkedIds
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

// Switching sport drops any disciplines from the previous sport (an event/group
// is one sport) and re-seeds from existing links for the new sport.
function onSportChange() {
  const keep = new Set(sportDisciplines.value.map(d => d.id))
  selected.value = selected.value.filter(id => keep.has(id))
  save()
}

watch(() => props.entityId, (v) => { if (v) load() }, { immediate: true })
</script>

<template>
  <div v-if="!loading && orgSports.length">
    <!-- Sport picker — only when there's a choice to make -->
    <div v-if="showSportPicker" class="mb-2">
      <Select v-model="selectedSport" :options="orgSports" option-label="sport" option-value="sport"
        placeholder="Choose a sport" class="w-full" @change="onSportChange" />
    </div>

    <!-- Discipline picker — only when the sport is connected to a governing body -->
    <template v-if="selectedSport && isConnected">
      <MultiSelect v-model="selected" :options="sportDisciplines" option-label="name" option-value="id" filter
        :placeholder="sportDisciplines.length ? 'Link to disciplines' : 'No disciplines defined yet'"
        :disabled="!sportDisciplines.length" class="w-full" :max-selected-labels="4" @hide="save">
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">{{ option.nso }}</span>
            <span>{{ option.name }}</span>
          </div>
        </template>
      </MultiSelect>
      <p class="text-xs text-surface-400 mt-1">
        Maps this {{ entityType }} to <span class="font-medium">{{ selectedSport }}</span> disciplines so it rolls up for cross-club reporting.
        <span v-if="saving" class="text-primary">· saving…</span>
      </p>
    </template>

    <!-- Standalone: sport with no governing body -->
    <p v-else-if="selectedSport && !isConnected" class="text-xs text-surface-400">
      <span class="font-medium">{{ selectedSport }}</span> isn't connected to a governing body, so there are no disciplines to link. Connect it in <NuxtLink to="/settings" class="text-primary hover:underline">Settings → Sports</NuxtLink> to enable cross-club reporting.
    </p>
  </div>
</template>
