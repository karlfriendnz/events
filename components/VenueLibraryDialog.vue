<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)"
    modal :show-header="false" :dismissable-mask="true"
    :style="{ width: 'min(880px, 95vw)' }"
    :content-style="{ padding: 0 }"
    :pt="{ root: { class: 'venue-lib-dialog' } }">

    <div class="flex flex-col sm:flex-row min-h-[540px]">

      <!-- Left: venue type list -->
      <aside class="w-full sm:w-60 shrink-0 border-r border-gray-100 bg-gray-50/40 sm:py-5 py-3">
        <div class="px-5 pt-1 pb-4">
          <p class="text-base font-bold text-gray-900 leading-tight">Venue library</p>
          <p class="text-xs text-gray-400 mt-0.5">Pick a starting point</p>
        </div>
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-5 pb-2">Sport</p>
        <div class="px-2">
          <button v-for="t in LIBRARY" :key="t.type" type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
            :class="selectedType === t.type
              ? 'bg-white text-primary ring-1 ring-primary/15 shadow-sm'
              : 'text-gray-700 hover:bg-white/70'"
            @click="selectType(t.type)">
            <span class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 transition-colors"
              :class="selectedType === t.type ? 'bg-primary/8' : 'bg-white ring-1 ring-gray-100'">
              <span>{{ t.icon }}</span>
            </span>
            <span class="text-sm font-medium tracking-tight">{{ t.name }}</span>
          </button>
        </div>
        <div class="border-t border-gray-100 mt-3 pt-3 px-2">
          <button type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
            :class="selectedType === 'custom'
              ? 'bg-white text-primary ring-1 ring-primary/15 shadow-sm'
              : 'text-gray-700 hover:bg-white/70'"
            @click="selectType('custom')">
            <span class="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 transition-colors"
              :class="selectedType === 'custom' ? 'bg-primary/8' : 'bg-white ring-1 ring-gray-100'">✏️</span>
            <span class="text-sm font-medium tracking-tight">Custom</span>
          </button>
        </div>
      </aside>

      <!-- Right: workbench -->
      <main class="flex-1 flex flex-col min-w-0">
        <!-- Hero header -->
        <header class="px-7 pt-7 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold text-primary uppercase tracking-[0.18em]">
              {{ selectedType === 'custom' ? 'Custom' : 'Template' }}
            </p>
            <h2 class="text-xl font-bold text-gray-900 mt-1 tracking-tight">{{ selectedTypeData?.name ?? 'Pick a venue type' }}</h2>
            <p class="text-sm text-gray-500 mt-0.5">
              {{ selectedType === 'custom'
                  ? 'Empty parent — sub-venues to be added by hand later.'
                  : 'Choose how this venue is laid out before drafting.' }}
            </p>
          </div>
          <button type="button" aria-label="Close"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            @click="$emit('update:visible', false)">
            <i class="pi pi-times text-xs" />
          </button>
        </header>

        <div class="flex-1 px-7 py-5 overflow-y-auto">
          <!-- Custom empty state -->
          <div v-if="selectedType === 'custom'" class="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-4 py-10 text-center">
            <div class="w-10 h-10 mx-auto rounded-full bg-white ring-1 ring-gray-200 flex items-center justify-center mb-2">
              <i class="pi pi-pencil text-gray-400 text-sm" />
            </div>
            <p class="text-sm text-gray-500">Custom venue — no sub-venues will be created.</p>
          </div>

          <template v-else-if="selectedTypeData">
            <!-- Mode tabs (underline style — cleaner than pills) -->
            <div class="flex items-center gap-6 border-b border-gray-100 px-3 sm:px-7 overflow-x-auto no-scrollbar mb-6">
              <button type="button"
                class="relative py-2 text-sm font-semibold transition-colors"
                :class="mode === 'siblings' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'"
                @click="mode = 'siblings'">
                Multiple {{ baseName.toLowerCase() }}s
                <span v-if="mode === 'siblings'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />
              </button>
              <button type="button"
                class="relative py-2 text-sm font-semibold transition-colors"
                :class="mode === 'configurations' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'"
                @click="mode = 'configurations'">
                Configurations
                <span v-if="mode === 'configurations'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />
              </button>
            </div>

            <!-- ── MODE 1: bulk siblings ── -->
            <div v-if="mode === 'siblings'" class="space-y-5">
              <p class="text-sm text-gray-600 leading-relaxed">
                Pick this when the venue contains multiple identical {{ baseName.toLowerCase() }}s — e.g. {{ selectedTypeData.siblingExample }}
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1.5 block">How many?</label>
                  <InputNumber v-model="count" :min="1" :max="50" show-buttons button-layout="horizontal"
                    decrement-button-class="!h-9 !w-9" increment-button-class="!h-9 !w-9"
                    input-class="!h-9 !w-12 !text-center !text-sm !font-semibold" class="w-full" />
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-600 mb-1.5 block flex items-center gap-1">
                    Base name
                    <span class="text-gray-300 font-normal">— suffixed 1, 2, 3 …</span>
                  </label>
                  <input v-model="baseName" type="text"
                    class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow" />
                </div>
              </div>

              <!-- Live tile preview -->
              <div>
                <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-2">Preview</p>
                <div class="rounded-xl border border-gray-100 bg-gray-50/40 p-3">
                  <div class="grid gap-2"
                    :style="{ gridTemplateColumns: `repeat(${Math.min(count, 6)}, minmax(0, 1fr))` }">
                    <div v-for="i in Math.min(count, 12)" :key="i"
                      class="rounded-lg bg-white ring-1 ring-gray-100 px-3 py-2 flex items-center gap-2 text-xs">
                      <span class="w-1.5 h-1.5 rounded-full"
                        :class="i === 1 ? 'bg-amber-400' : 'bg-gray-300'" />
                      <span class="font-medium text-gray-700 truncate">{{ baseName }} {{ i }}</span>
                    </div>
                    <div v-if="count > 12"
                      class="rounded-lg bg-white/60 ring-1 ring-dashed ring-gray-200 px-3 py-2 text-xs text-gray-400 flex items-center justify-center">
                      +{{ count - 12 }} more
                    </div>
                  </div>
                  <p v-if="count > 1" class="text-[11px] text-gray-500 mt-2.5 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {{ baseName }}&nbsp;1 is the master — edits cascade to the linked siblings.
                  </p>
                </div>
              </div>
            </div>

            <!-- ── MODE 2: configurations ── -->
            <div v-else class="space-y-5">
              <p class="text-sm text-gray-600 leading-relaxed">
                Pick this when one venue can be configured in different ways at different times — e.g. {{ selectedTypeData.configurationsExample }}
              </p>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button v-for="d in selectedTypeData.divisions" :key="d.key" type="button"
                  class="group relative flex flex-col items-stretch gap-2 rounded-xl border bg-white p-3 text-left transition-all"
                  :class="isLayoutPicked(d.key)
                    ? 'border-primary ring-2 ring-primary/15 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'"
                  @click="toggleLayout(d.key)">
                  <span class="absolute top-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                    :class="isLayoutPicked(d.key) ? 'bg-primary text-white' : 'bg-white ring-1 ring-gray-200 text-transparent'">
                    <i class="pi pi-check text-[9px]" />
                  </span>
                  <DivisionDiagram :sections="d.sections" :regions="d.regions"
                    :orientation="d.orientation ?? (selectedType === 'pool' ? 'rows' : 'cols')"
                    :court-type="selectedType"
                    class="aspect-[5/3]" />
                  <p class="text-sm font-semibold text-gray-800 tracking-tight">{{ d.name }}</p>
                </button>
              </div>

              <!-- Output summary -->
              <div class="rounded-xl bg-gray-50/60 border border-gray-100 px-4 py-3 text-sm">
                <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-1.5">Output</p>
                <p v-if="!resolvedChildren.length" class="text-gray-500">
                  Just the parent venue — no sub-venues needed for the picked layouts.
                </p>
                <p v-else class="text-gray-700 leading-relaxed">
                  <span class="font-semibold text-gray-900">{{ resolvedChildren.length }} sub-{{ resolvedChildren.length === 1 ? 'venue' : 'venues' }}:</span>
                  <span class="text-gray-500">{{ resolvedChildren.join(' · ') }}</span>
                </p>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <footer class="border-t border-gray-100 bg-gray-50/40 px-7 py-3.5 flex items-center justify-between gap-3">
          <button type="button"
            class="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors px-2 py-1.5"
            @click="$emit('update:visible', false)">Cancel</button>
          <button type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all"
            :class="applyDisabled
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary hover:bg-[#161A45] hover:shadow-md'"
            :disabled="applyDisabled"
            @click="apply">
            <span>{{ footerButtonLabel }}</span>
            <i class="pi pi-arrow-right text-[11px]" />
          </button>
        </footer>
      </main>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'apply', payload: {
    type: string
    division: string | null
    /** Key of the resolved (finest) layout — saved as the venue's
     *  configuration so modes can later require it (e.g. 'halves'). */
    configKey: string | null
    /** Human-readable label for that configuration (e.g. 'Halves'). */
    configName: string | null
    children: string[]
    count: number
    baseName: string
  }): void
}>()

interface Region { x: number; y: number; w: number; h: number }
interface Division {
  key: string
  name: string
  sections: number
  children: string[]
  orientation?: 'cols' | 'rows' | 'grid'
  regions?: Region[]
}
interface VenueType {
  type: string
  name: string
  icon: string
  noun: string
  /** Sentence shown under the "Multiple X" tab, sport-specific. */
  siblingExample: string
  /** Sentence shown under the "Configurations" tab, sport-specific. */
  configurationsExample: string
  divisions: Division[]
}

function quarters(): string[] { return ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'] }
function halves(): string[] { return ['Half A', 'Half B'] }
function nLanes(n: number): string[] { return Array.from({ length: n }, (_, i) => `Lane ${i + 1}`) }
function nNets(n: number): string[] { return Array.from({ length: n }, (_, i) => `Net ${i + 1}`) }
function nCourts(n: number): string[] { return Array.from({ length: n }, (_, i) => `Court ${i + 1}`) }

const LIBRARY: VenueType[] = [
  {
    type: 'football', name: 'Football Field', icon: '⚽', noun: 'Field',
    siblingExample: 'a sports complex with Field 1–4 inside.',
    configurationsExample: 'a pitch used as a full field, halves, thirds, or several mini-pitches at training time.',
    divisions: [
      { key: 'full',         name: 'Full field',         sections: 1, children: [] },
      { key: 'halves',       name: 'Halves',             sections: 2, children: halves() },
      { key: 'thirds',       name: 'Thirds',             sections: 3, children: ['Third 1', 'Third 2', 'Third 3'] },
      { key: 'quads',        name: 'Quarters (strips)',  sections: 4, children: quarters(), orientation: 'cols' },
      { key: 'quads-grid',   name: 'Quarters (2×2)',     sections: 4, children: quarters(), orientation: 'grid' },
      { key: 'mini-6',       name: '6 mini-pitches',     sections: 6, children: Array.from({ length: 6 }, (_, i) => `Mini ${i + 1}`), orientation: 'grid' },
    ],
  },
  {
    type: 'basketball', name: 'Basketball Court', icon: '🏀', noun: 'Court',
    siblingExample: 'a multi-court arena with Court 1–4 inside.',
    configurationsExample: 'a court played at full size, in halves, or split into perpendicular cross-courts for training.',
    divisions: [
      { key: 'full',         name: 'Full court',         sections: 1, children: [] },
      { key: 'halves',       name: 'Halves',             sections: 2, children: halves() },
      { key: 'cross-courts', name: 'Cross-courts',       sections: 2, children: ['Cross-court A', 'Cross-court B'] },
      { key: 'quads',        name: 'Quarters (strips)',  sections: 4, children: quarters(), orientation: 'cols' },
      { key: 'quads-grid',   name: 'Quarters (2×2)',     sections: 4, children: quarters(), orientation: 'grid' },
    ],
  },
  {
    type: 'netball', name: 'Netball Court', icon: '🥎', noun: 'Court',
    siblingExample: 'a netball centre with Court 1–4 inside.',
    configurationsExample: 'a court used at full size, halved, or split into the three thirds for training.',
    divisions: [
      { key: 'full',   name: 'Full court', sections: 1, children: [] },
      { key: 'halves', name: 'Halves',     sections: 2, children: halves() },
      { key: 'thirds', name: 'Thirds',     sections: 3, children: ['Goal Third (Attack)', 'Centre Third', 'Goal Third (Defence)'] },
    ],
  },
  {
    type: 'tennis', name: 'Tennis Court', icon: '🎾', noun: 'Court',
    siblingExample: 'a Tennis Courts complex with Court 1–4 inside.',
    configurationsExample: 'a court played full, in halves for mini-tennis, or in quarters for kids coaching.',
    divisions: [
      { key: 'full',       name: 'Full court',         sections: 1, children: [] },
      { key: 'halves',     name: 'Halves',             sections: 2, children: halves() },
      { key: 'quads',      name: 'Quarters (strips)',  sections: 4, children: quarters(), orientation: 'cols' },
      { key: 'quads-grid', name: 'Quarters (2×2)',     sections: 4, children: quarters(), orientation: 'grid' },
    ],
  },
  {
    type: 'squash', name: 'Squash Court', icon: '🟥', noun: 'Court',
    siblingExample: 'a club with Court 1–4 inside.',
    configurationsExample: 'a single court — squash courts aren’t typically subdivided.',
    divisions: [
      { key: 'full', name: 'Full court', sections: 1, children: [] },
    ],
  },
  {
    type: 'pool', name: 'Swimming Pool', icon: '🏊', noun: 'Pool',
    siblingExample: 'an aquatics centre with Pool 1–2 inside (e.g. a competition pool and a learn-to-swim pool).',
    configurationsExample: 'a pool used as full open water, split into lap swim and open swim, or set up as 4–10 lanes for squad training.',
    divisions: [
      { key: 'full',     name: 'Full pool',         sections: 1, children: [] },
      { key: 'lap-open', name: 'Lap + open',        sections: 2, children: ['Lap area', 'Open swim area'] },
      { key: 'lanes-4',  name: '4 lanes',           sections: 4, children: nLanes(4) },
      { key: 'lanes-6',  name: '6 lanes',           sections: 6, children: nLanes(6) },
      { key: 'lanes-8',  name: '8 lanes',           sections: 8, children: nLanes(8) },
      { key: 'lanes-10', name: '10 lanes',          sections: 10, children: nLanes(10) },
    ],
  },
  {
    type: 'cricket', name: 'Cricket Nets', icon: '🏏', noun: 'Net',
    siblingExample: 'a club with two separate net facilities.',
    configurationsExample: 'a nets facility set up as a single net or split into 4–8 parallel practice lanes.',
    divisions: [
      { key: 'single', name: 'Single net', sections: 1, children: [] },
      { key: 'nets-4', name: '4 nets',     sections: 4, children: nNets(4), orientation: 'rows' },
      { key: 'nets-6', name: '6 nets',     sections: 6, children: nNets(6), orientation: 'rows' },
      { key: 'nets-8', name: '8 nets',     sections: 8, children: nNets(8), orientation: 'rows' },
    ],
  },
  {
    type: 'hall', name: 'Sports Hall', icon: '🏛️', noun: 'Hall',
    siblingExample: 'a leisure centre with Hall 1–2 inside.',
    configurationsExample: 'a hall used as one big space, halved, or laid out as 4–8 badminton courts.',
    divisions: [
      { key: 'full',       name: 'Full hall',           sections: 1, children: [] },
      { key: 'halves',     name: 'Halves',              sections: 2, children: halves() },
      { key: 'thirds',     name: 'Thirds',              sections: 3, children: ['Third 1', 'Third 2', 'Third 3'] },
      { key: 'quads',      name: 'Quarters (strips)',   sections: 4, children: quarters(), orientation: 'cols' },
      { key: 'quads-grid', name: 'Quarters (2×2)',      sections: 4, children: quarters(), orientation: 'grid' },
      { key: 'bad-4',      name: '4 badminton courts',  sections: 4, children: nCourts(4), orientation: 'grid' },
      { key: 'bad-6',      name: '6 badminton courts',  sections: 6, children: nCourts(6), orientation: 'grid' },
      { key: 'bad-8',      name: '8 badminton courts',  sections: 8, children: nCourts(8), orientation: 'grid' },
    ],
  },
  {
    type: 'studio', name: 'Studio', icon: '🪞', noun: 'Studio',
    siblingExample: 'a fitness centre with Studio 1–3 inside.',
    configurationsExample: 'a studio used at full size, or halved when two classes run side-by-side.',
    divisions: [
      { key: 'full',   name: 'Full studio', sections: 1, children: [] },
      { key: 'halves', name: 'Halves',      sections: 2, children: halves() },
    ],
  },
  {
    type: 'generic', name: 'Generic Space', icon: '⬜', noun: 'Space',
    siblingExample: 'a building with Space 1–4 inside.',
    configurationsExample: 'a space used as a whole, halved, in thirds, or quartered for parallel use.',
    divisions: [
      { key: 'full',       name: 'Full space',         sections: 1, children: [] },
      { key: 'halves',     name: 'Halves',             sections: 2, children: halves() },
      { key: 'thirds',     name: 'Thirds',             sections: 3, children: ['Third 1', 'Third 2', 'Third 3'] },
      { key: 'quads',      name: 'Quarters (strips)',  sections: 4, children: quarters(), orientation: 'cols' },
      { key: 'quads-grid', name: 'Quarters (2×2)',     sections: 4, children: quarters(), orientation: 'grid' },
    ],
  },
]

const selectedType = ref<string | null>('tennis')
const mode = ref<'siblings' | 'configurations'>('siblings')
const pickedLayouts = ref<Set<string>>(new Set(['full', 'halves']))
const count = ref(4)
const baseName = ref('Court')

const selectedTypeData = computed<VenueType | undefined>(() =>
  LIBRARY.find(t => t.type === selectedType.value),
)

function selectType(t: string) {
  selectedType.value = t
  const next = new Set<string>()
  if (t !== 'custom') {
    const t0 = LIBRARY.find(x => x.type === t)
    if (t0) {
      next.add(t0.divisions[0]?.key ?? '')
      const second = t0.divisions.find(d => d.sections > 1)
      if (second) next.add(second.key)
      baseName.value = t0.noun
    }
  } else {
    baseName.value = 'Sub-venue'
  }
  pickedLayouts.value = next
}

function isLayoutPicked(key: string): boolean { return pickedLayouts.value.has(key) }
function toggleLayout(key: string) {
  const next = new Set(pickedLayouts.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  pickedLayouts.value = next
}

const resolvedChildren = computed<string[]>(() => {
  if (!selectedTypeData.value) return []
  const picked = selectedTypeData.value.divisions.filter(d => pickedLayouts.value.has(d.key))
  if (!picked.length) return []
  const finest = picked.reduce((max, d) => d.sections > max.sections ? d : max, picked[0])
  return [...finest.children]
})

const footerButtonLabel = computed(() => {
  if (selectedType.value === 'custom') return 'Create empty venue'
  if (mode.value === 'siblings') {
    const n = Math.max(1, Math.min(count.value, 50))
    const noun = (baseName.value || 'sub-venue').toLowerCase()
    return n === 1 ? `Create 1 ${noun}` : `Create ${n} ${noun}s`
  }
  return 'Apply configurations'
})

const applyDisabled = computed(() =>
  !selectedType.value
  || (selectedType.value !== 'custom' && mode.value === 'configurations' && pickedLayouts.value.size === 0),
)

// The "finest" picked layout is what actually gets created as children — it
// also becomes the saved configuration name so modes can later require it.
const finestPicked = computed<Division | null>(() => {
  if (!selectedTypeData.value) return null
  const picked = selectedTypeData.value.divisions.filter(d => pickedLayouts.value.has(d.key))
  if (!picked.length) return null
  return picked.reduce((max, d) => d.sections > max.sections ? d : max, picked[0])
})

function apply() {
  if (!selectedType.value) return
  const safeCount = Math.max(1, Math.min(count.value, 50))
  const safeName = (baseName.value || 'Item').trim() || 'Item'
  if (selectedType.value === 'custom') {
    emit('apply', { type: 'custom', division: null, configKey: null, configName: null, children: [], count: 1, baseName: safeName })
    return
  }
  if (!selectedTypeData.value) return
  if (mode.value === 'siblings') {
    emit('apply', {
      type: selectedTypeData.value.type,
      division: null,
      configKey: null,
      configName: null,
      children: [],
      count: safeCount, baseName: safeName,
    })
  } else {
    const finest = finestPicked.value
    emit('apply', {
      type: selectedTypeData.value.type,
      division: [...pickedLayouts.value].sort().join(','),
      configKey: finest?.key ?? null,
      configName: finest?.name ?? null,
      children: resolvedChildren.value,
      count: 1, baseName: safeName,
    })
  }
}
</script>
