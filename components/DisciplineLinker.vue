<!--
  Links a local group or event to NSO-defined disciplines (canonical categories),
  so it rolls up for cross-club reporting. Many-to-many + multi-NSO. Auto-saves
  to member_group_disciplines / event_disciplines when the dropdown closes.
-->
<script setup lang="ts">
const props = defineProps<{ entityType: 'group' | 'event'; entityId: string }>()
const db = useDb()

const joinTable = props.entityType === 'group' ? 'member_group_disciplines' : 'event_disciplines'
const fk = props.entityType === 'group' ? 'group_id' : 'event_id'

const disciplines = ref<{ id: string; _label: string; sport: string | null; nso: string }[]>([])
const selected = ref<string[]>([])
const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  const [{ data: discs }, { data: links }] = await Promise.all([
    (db.from as any)('disciplines').select('id, name, sport, organisations(name)').order('sport').order('name'),
    (db.from as any)(joinTable).select('discipline_id').eq(fk, props.entityId),
  ])
  disciplines.value = (discs ?? []).map((d: any) => ({
    id: d.id, sport: d.sport, nso: d.organisations?.name ?? '',
    _label: `${d.organisations?.name ?? ''} · ${d.sport ?? ''} · ${d.name}`,
  }))
  selected.value = (links ?? []).map((l: any) => l.discipline_id)
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

watch(() => props.entityId, (v) => { if (v) load() }, { immediate: true })
</script>

<template>
  <div>
    <MultiSelect v-model="selected" :options="disciplines" option-label="_label" option-value="id" filter
      :placeholder="loading ? 'Loading…' : 'Link to NSO disciplines'" class="w-full" :max-selected-labels="3"
      @hide="save">
      <template #option="{ option }">
        <div class="flex items-center gap-2">
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">{{ option.nso }}</span>
          <span class="text-xs text-surface-400">{{ option.sport }}</span>
          <span>{{ option._label.split(' · ').pop() }}</span>
        </div>
      </template>
    </MultiSelect>
    <p class="text-xs text-surface-400 mt-1">
      Maps this {{ entityType }} to canonical NSO categories so it rolls up for cross-club reporting. You can link multiple NSOs.
      <span v-if="saving" class="text-[#1E2157]">· saving…</span>
    </p>
  </div>
</template>
