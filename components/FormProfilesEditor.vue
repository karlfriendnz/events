<!--
  Reusable "Who is registering" editor. Declares which subject types a form
  collects (people — child / parent / coach / emergency contact — AND entities —
  Team / Company / School) and how many of each (per-form min/max limits).

  Subject types resolve org + inherited via useOrgFieldPolicy().resolvePersonTypes
  so NSO-defined types flow down to clubs. Each subject type carries its own field
  structure elsewhere (field_definitions keyed by `target`), surfaced as per-type
  blocks in the form preview.

  v-model is the profiles array: { key, label, min, max, kind }[].
  Used by the events forms tab and <FormBuilder> so every form surface shares one
  registration-shape editor.
-->
<script setup lang="ts">
const props = defineProps<{
  modelValue: { key: string; label: string; min: number; max: number | null; kind?: string; selectsOptions?: boolean }[]
  orgId?: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [typeof props.modelValue] }>()

const _org = useOrg()
const { resolvePersonTypes } = useOrgFieldPolicy()
const types = ref<{ key: string; label: string; kind: string; min_count: number; max_count: number | null }[]>([])
const effectiveOrgId = computed(() => props.orgId ?? _org.orgId.value)
watch(effectiveOrgId, async (id) => {
  types.value = id ? await resolvePersonTypes(id) : []
}, { immediate: true })

const profiles = computed({
  get: () => props.modelValue ?? [],
  set: (v) => emit('update:modelValue', v),
})
const personTypes = computed(() => types.value.filter(t => (t.kind || 'person') === 'person'))
const entityTypes = computed(() => types.value.filter(t => t.kind === 'entity'))
const unusedPeople = computed(() => personTypes.value.filter(t => !profiles.value.some(p => p.key === t.key)))
const unusedEntities = computed(() => entityTypes.value.filter(t => !profiles.value.some(p => p.key === t.key)))
function typeKind(key: string) { return types.value.find(t => t.key === key)?.kind || 'person' }
function iconFor(key: string) { return typeKind(key) === 'entity' ? 'pi-building' : 'pi-user' }

function addProfile(key: string) {
  const t = types.value.find(x => x.key === key)
  if (!t || profiles.value.some(p => p.key === key)) return
  // First subject added defaults to the chooser so "who picks sessions/fees" is never undefined.
  const selectsOptions = profiles.value.length === 0
  emit('update:modelValue', [...profiles.value, { key: t.key, label: t.label, min: t.min_count ?? 1, max: t.max_count ?? null, kind: t.kind, selectsOptions }])
}
function removeProfile(i: number) {
  const next = profiles.value.slice(); next.splice(i, 1); emit('update:modelValue', next)
}
function patchProfile(i: number, patch: Partial<{ min: number; max: number | null; selectsOptions: boolean }>) {
  const next = profiles.value.slice(); next[i] = { ...next[i], ...patch }; emit('update:modelValue', next)
}

// ── Quick-start presets (shared with the events forms tab) ───────────────────
function applyPreset(preset: { roles: any[] }) {
  emit('update:modelValue', resolvePreset(types.value, preset))
}
</script>

<template>
  <div class="space-y-4">
    <!-- Quick start -->
    <div class="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick start — who is this form for?</p>
      <Select :modelValue="null" :options="PROFILE_PRESETS" option-label="label" data-key="id"
        placeholder="Choose a starting point…" class="w-full" @update:modelValue="applyPreset">
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <i :class="['pi', option.icon, 'text-[#1ab4e8]']" />
            <span class="text-sm font-medium">{{ option.label }}</span>
          </div>
        </template>
      </Select>
      <p class="text-[11px] text-gray-400 mt-2">Pick a starting point, then fine-tune below — or build it up by hand.</p>
    </div>

    <!-- Profiles -->
    <div v-if="!profiles.length" class="text-sm text-gray-400 italic py-2 text-center">
      No one added yet — pick a quick-start above or add who this form registers.
    </div>
    <div v-for="(p, i) in profiles" :key="p.key" class="border border-gray-200 rounded-xl px-3 py-2.5 bg-white">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          :class="(p.kind || typeKind(p.key)) === 'entity' ? 'bg-violet-50' : 'bg-blue-50'">
          <i :class="['pi', iconFor(p.key), 'text-[11px]', (p.kind || typeKind(p.key)) === 'entity' ? 'text-violet-500' : 'text-[#1ab4e8]']" />
        </div>
        <span class="flex-1 min-w-0 font-semibold text-sm text-gray-800 truncate">{{ p.label }}</span>
        <span v-if="(p.kind || typeKind(p.key)) === 'entity'" class="text-[9px] font-bold uppercase tracking-wide text-violet-500 bg-violet-50 rounded px-1.5 py-0.5 shrink-0">Entity</span>
        <button type="button" class="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0" @click="removeProfile(i)">
          <i class="pi pi-trash text-xs" />
        </button>
      </div>
      <div class="flex items-center gap-3 mt-2 pl-8">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Min</span>
          <InputNumber :modelValue="p.min" :min="0" :input-class="'!w-12 !py-1 !px-2 text-center text-sm'" @update:modelValue="v => patchProfile(i, { min: v ?? 0 })" />
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Max</span>
          <InputNumber :modelValue="p.max" :min="0" placeholder="∞" :input-class="'!w-12 !py-1 !px-2 text-center text-sm'" @update:modelValue="v => patchProfile(i, { max: v })" />
        </div>
      </div>
      <button type="button"
        class="mt-2 ml-8 inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
        :class="p.selectsOptions ? 'text-[#0e43a3]' : 'text-gray-400 hover:text-gray-600'"
        @click="patchProfile(i, { selectsOptions: !p.selectsOptions })">
        <i :class="['pi', p.selectsOptions ? 'pi-check-circle' : 'pi-circle', 'text-[12px]']" />
        Chooses sessions &amp; fees
      </button>
    </div>

    <!-- Add people -->
    <div v-if="unusedPeople.length" class="pt-1">
      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Add a person</p>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="t in unusedPeople" :key="t.key" type="button"
          class="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:border-primary hover:bg-blue-50/40 transition-all"
          @click="addProfile(t.key)">+ {{ t.label }}</button>
      </div>
    </div>

    <!-- Add entities -->
    <div v-if="unusedEntities.length" class="pt-1">
      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Add an entity</p>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="t in unusedEntities" :key="t.key" type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:border-violet-400 hover:bg-violet-50/40 transition-all"
          @click="addProfile(t.key)"><i class="pi pi-building text-violet-400 text-[11px]" />{{ t.label }}</button>
      </div>
    </div>

    <p v-if="!types.length" class="text-xs text-gray-400">No subject types defined yet — create them in Settings → Fields → Person Types.</p>
  </div>
</template>
