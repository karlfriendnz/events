<template>
  <Dialog :visible="modelValue" @update:visible="$emit('update:modelValue', $event)"
    header="Choose a venue template"
    modal :style="{ width: '720px' }" :draggable="false" :closable="true">

    <div class="flex gap-6" style="min-height:520px">

      <!-- Left: venue type list -->
      <div class="w-44 shrink-0 flex flex-col gap-1">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Venue type</p>
        <button v-for="t in VENUE_TEMPLATES" :key="t.key"
          type="button"
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-colors"
          :class="!isCustomMode && selectedType?.key === t.key
            ? 'bg-[#1E2157] text-white'
            : 'text-gray-700 hover:bg-gray-100'"
          @click="selectType(t)">
          <span class="text-base leading-none">{{ t.emoji }}</span>
          <span class="font-medium leading-tight">{{ t.label }}</span>
        </button>

        <!-- Custom option -->
        <div class="mt-2 pt-2 border-t border-gray-100">
          <button type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-colors"
            :class="isCustomMode ? 'bg-[#1E2157] text-white' : 'text-gray-700 hover:bg-gray-100'"
            @click="selectCustom">
            <span class="text-base leading-none">✏️</span>
            <span class="font-medium leading-tight">Custom</span>
          </button>
        </div>
      </div>

      <!-- Divider -->
      <div class="w-px bg-gray-100 shrink-0" />

      <!-- Right panel -->
      <div class="flex-1 min-w-0 flex flex-col gap-3">

        <!-- Custom mode -->
        <template v-if="isCustomMode">
          <div>
            <p class="text-sm font-semibold text-gray-800">Custom layout</p>
            <p class="text-xs text-gray-400 mt-0.5">Define your own sections — the system will generate booking layouts from them</p>
          </div>

          <!-- Section name entry -->
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sections</label>
            <div class="flex flex-wrap gap-2 p-3 rounded-xl border-2 border-gray-200 focus-within:border-[#1E2157] min-h-[48px] bg-white">
              <span v-for="(sec, i) in customSections" :key="i"
                class="flex items-center gap-1 bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-sm">
                {{ sec }}
                <button type="button" class="text-indigo-400 hover:text-red-500 ml-0.5" @click="customSections.splice(i, 1)">
                  <i class="pi pi-times text-xs" />
                </button>
              </span>
              <input
                v-model="customSectionInput"
                type="text"
                placeholder="Type a section name, press Enter…"
                class="flex-1 min-w-32 text-sm bg-transparent border-0 outline-none placeholder-gray-400"
                @keydown.enter.prevent="addCustomSection"
                @keydown.comma.prevent="addCustomSection" />
            </div>
            <p class="text-xs text-gray-400">e.g. "North Half", "South Half" — or "Lane 1", "Lane 2", "Lane 3"</p>
          </div>

          <!-- Generated layouts list -->
          <template v-if="customSections.length">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Layouts generated ({{ buildCustomLayouts(customSections).length }})
            </label>
            <div class="flex flex-col gap-1 overflow-y-auto">
              <div v-for="layout in buildCustomLayouts(customSections)" :key="layout.name"
                class="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
                <i class="pi pi-calendar text-indigo-400 text-xs" />
                <span class="text-sm text-indigo-800 font-medium">{{ layout.name }}</span>
                <span class="text-xs text-indigo-400 ml-auto">{{ layout.sections.join(', ') }}</span>
              </div>
            </div>
          </template>

          <div v-if="!customSections.length" class="flex-1 flex items-center justify-center text-gray-400 text-sm text-center">
            <div>
              <i class="pi pi-plus-circle text-3xl block mb-2 text-gray-300" />
              Add section names above to define your layout
            </div>
          </div>
        </template>

        <!-- Library mode -->
        <template v-else>
          <div v-if="!selectedType" class="flex-1 flex items-center justify-center text-gray-400 text-sm text-center">
            Select a venue type
          </div>
          <template v-else>
            <div>
              <p class="text-sm font-semibold text-gray-800">{{ selectedType.label }}</p>
              <p class="text-xs text-gray-400 mt-0.5">Select one or more division types</p>
            </div>
            <div class="grid grid-cols-2 gap-2 overflow-y-auto">
              <button v-for="div in selectedType.divisions" :key="div.key"
                type="button"
                class="relative flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all"
                :class="isSelectedDivision(div.key)
                  ? isIncompatible(div.key)
                    ? 'border-amber-400 bg-amber-50 shadow-sm'
                    : 'border-[#1E2157] bg-[#1E2157]/5 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'"
                @click="toggleDivision(div)">

                <!-- Checkbox / warning (top-right) -->
                <div class="absolute top-2 right-2 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors"
                  :class="isSelectedDivision(div.key)
                    ? isIncompatible(div.key) ? 'border-amber-400 bg-amber-400' : 'border-[#1E2157] bg-[#1E2157]'
                    : 'border-gray-300 bg-white'">
                  <i v-if="isSelectedDivision(div.key) && isIncompatible(div.key)" class="pi pi-exclamation-triangle text-white" style="font-size:9px" />
                  <i v-else-if="isSelectedDivision(div.key)" class="pi pi-check text-white" style="font-size:9px" />
                </div>

                <!-- Diagram -->
                <div class="w-full rounded-lg overflow-hidden" style="aspect-ratio:3/1.6">
                  <SpaceDiagram
                    :sections="div.sections"
                    :space-type="selectedType.space_type"
                    :hovered-sections="isSelectedDivision(div.key) && !isIncompatible(div.key) ? div.sections : []"
                  />
                </div>

                <!-- Label -->
                <p class="text-sm font-semibold leading-tight"
                  :class="isSelectedDivision(div.key) ? isIncompatible(div.key) ? 'text-amber-600' : 'text-[#1E2157]' : 'text-gray-700'">
                  {{ div.label }}
                </p>
                <p v-if="isIncompatible(div.key)" class="text-[10px] text-amber-600 -mt-1.5">Can't combine with current selection</p>
              </button>
            </div>

            <!-- Info bar -->
            <div v-if="incompatibleDivisions.length" class="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-start gap-1.5">
              <i class="pi pi-exclamation-triangle mt-0.5 shrink-0" />
              <span>
                <strong>{{ incompatibleDivisions.map(d => d.label).join(' + ') }}</strong>
                will be added as independent layouts. Bookings across these divisions won't automatically block each other — manage those conflicts manually.
              </span>
            </div>
            <div v-else-if="selectedDivisionKeys.size > 1 && effectiveDivision" class="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
              <i class="pi pi-info-circle mr-1" />
              <template v-if="isLcmBase">
                Using <strong>{{ effectiveDivision.label }}</strong> as base so all selected divisions can coexist
              </template>
              <template v-else>
                Using <strong>{{ effectiveDivision.label }}</strong> as base (finest granularity selected)
              </template>
            </div>
          </template>
        </template>

      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <p v-if="isCustomMode && customSections.length" class="text-sm text-gray-500">
          <span class="font-medium text-gray-800">Custom</span>
          — {{ customSections.length }} sections,
          {{ buildCustomLayouts(customSections).length }} layouts
        </p>
        <p v-else-if="!isCustomMode && selectedDivisionKeys.size > 0" class="text-sm text-gray-500">
          <span class="font-medium text-gray-800">{{ selectedType?.label }}</span>
          — {{ effectiveDivision?.sections.length }} sections,
          {{ allLayouts.length }} layout{{ allLayouts.length !== 1 ? 's' : '' }}
        </p>
        <div v-else />
        <div class="flex gap-2">
          <Button label="Cancel" severity="secondary" text @click="$emit('update:modelValue', false)" />
          <Button label="Apply template" icon="pi pi-check"
            :disabled="isCustomMode ? !customSections.length : selectedDivisionKeys.size === 0"
            style="background:#1E2157;border-color:#1E2157"
            @click="apply" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { VENUE_TEMPLATES, generateLayouts, type VenueTemplate, type Division, type GeneratedLayout } from '~/data/venueTemplates'

const props = defineProps<{
  modelValue: boolean
  currentSections?: string[]
  currentLayouts?: any[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  apply: [result: { space_type: string; sections: string[]; layouts: GeneratedLayout[] }]
}>()

const selectedType         = ref<VenueTemplate | null>(null)
const selectedDivisionKeys = ref<Set<string>>(new Set())
const isCustomMode         = ref(false)
const customSections       = ref<string[]>([])
const customSectionInput   = ref('')

// Map division key → group name produced by generateLayouts
const DIVISION_KEY_TO_GROUP: Record<string, string> = {
  halves: 'Half', thirds: 'Third', quarters: 'Quarter', sixths: 'Sixth', eighths: 'Eighth',
}

function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return a }
function lcm(a: number, b: number): number { return (a * b) / gcd(a, b) }

// Base division: LCM of selected section counts → find matching template division.
const effectiveDivision = computed<Division | null>(() => {
  if (!selectedType.value || selectedDivisionKeys.value.size === 0) return null
  const selected = selectedType.value.divisions.filter(d => selectedDivisionKeys.value.has(d.key))
  if (selected.length === 1) return selected[0]

  const counts = selected.map(d => d.sections.length).filter(c => c > 1)
  if (counts.length) {
    const target = counts.reduce(lcm)
    const exact = selectedType.value.divisions.find(d => d.sections.length === target)
    if (exact) return exact
  }

  return selected.reduce((finest, d) => d.sections.length > finest.sections.length ? d : finest, selected[0])
})

const isLcmBase = computed(() =>
  selectedDivisionKeys.value.size > 1 &&
  !!effectiveDivision.value &&
  !selectedDivisionKeys.value.has(effectiveDivision.value.key)
)

const selectedGroups = computed(() => {
  const s = new Set<string>()
  for (const key of selectedDivisionKeys.value) {
    const g = DIVISION_KEY_TO_GROUP[key]
    if (g) s.add(g)
  }
  return s
})

const allLayouts = computed<GeneratedLayout[]>(() => {
  if (!effectiveDivision.value) return []
  const base = generateLayouts(effectiveDivision.value.sections)
  if (selectedDivisionKeys.value.size <= 1) return base

  const compatible = base.filter(l => !l.group || selectedGroups.value.has(l.group))
  const extra: GeneratedLayout[] = []
  for (const div of incompatibleDivisions.value) {
    const g = DIVISION_KEY_TO_GROUP[div.key]
    if (!g) continue
    for (const l of generateLayouts(div.sections)) {
      if (l.group === g) extra.push(l)
    }
  }
  return [...compatible, ...extra]
})

const achievableGroups = computed(() => {
  const s = new Set<string>()
  for (const l of generateLayouts(effectiveDivision.value?.sections ?? [])) if (l.group) s.add(l.group)
  return s
})

const incompatibleDivisions = computed(() => {
  if (!selectedType.value || selectedDivisionKeys.value.size <= 1) return []
  return selectedType.value.divisions.filter(d => {
    if (!selectedDivisionKeys.value.has(d.key)) return false
    const g = DIVISION_KEY_TO_GROUP[d.key]
    return g && !achievableGroups.value.has(g)
  })
})

function isIncompatible(key: string) {
  return incompatibleDivisions.value.some(d => d.key === key)
}

function isSelectedDivision(key: string) {
  return selectedDivisionKeys.value.has(key)
}

function selectType(t: VenueTemplate) {
  selectedType.value = t
  selectedDivisionKeys.value = new Set()
  isCustomMode.value = false
}

function selectCustom() {
  selectedType.value = null
  selectedDivisionKeys.value = new Set()
  isCustomMode.value = true
}

function toggleDivision(div: Division) {
  const next = new Set(selectedDivisionKeys.value)
  if (next.has(div.key)) next.delete(div.key)
  else next.add(div.key)
  selectedDivisionKeys.value = next
}

function buildCustomLayouts(sections: string[]): GeneratedLayout[] {
  if (!sections.length) return []
  const result: GeneratedLayout[] = []
  if (sections.length > 1) result.push({ name: 'Full', sections: [...sections] })
  for (const sec of sections) result.push({ name: sec, sections: [sec] })
  return result
}

function addCustomSection() {
  const v = customSectionInput.value.trim().replace(/,$/, '')
  if (v && !customSections.value.includes(v)) customSections.value.push(v)
  customSectionInput.value = ''
}

function apply() {
  const hasCurrent = (props.currentSections?.length ?? 0) > 0 || (props.currentLayouts?.length ?? 0) > 0
  if (hasCurrent && !confirm('This will replace existing sections and layouts. Continue?')) return

  if (isCustomMode.value) {
    if (customSectionInput.value.trim()) addCustomSection()
    if (!customSections.value.length) return
    emit('apply', {
      space_type: 'generic',
      sections: [...customSections.value],
      layouts: buildCustomLayouts(customSections.value),
    })
  } else {
    if (!selectedType.value || !effectiveDivision.value) return
    emit('apply', {
      space_type: selectedType.value.space_type,
      sections: [...effectiveDivision.value.sections],
      layouts: allLayouts.value,
    })
  }
  emit('update:modelValue', false)
}

// Reset on open
watch(() => props.modelValue, (open) => {
  if (open) {
    selectedType.value         = null
    selectedDivisionKeys.value = new Set()
    isCustomMode.value         = false
    customSections.value       = []
    customSectionInput.value   = ''
  }
})
</script>
