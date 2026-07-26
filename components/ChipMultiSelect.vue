<script setup lang="ts">
// MultiSelect whose selected values render as small chips on a single line,
// collapsing any that don't fit into a "+N more" chip (width-aware).
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: any[]
  options: any[]
  optionLabel?: string
  optionValue?: string
  placeholder?: string
  // Grouped options (e.g. classes under their code). When set, `options` is a
  // list of groups and the flat option list is derived from their children.
  optionGroupLabel?: string
  optionGroupChildren?: string
  /**
   * SYSTEM RULE — a search box only appears once a list is long enough to need one
   * (see SEARCH_THRESHOLD below). Leave this UNSET and the component decides; pass
   * true/false only to force it for a specific list.
   */
  filter?: boolean
  disabled?: boolean
  /** Field on an option that marks it unpickable (PrimeVue's optionDisabled). */
  optionDisabled?: string
  /** The header select-all. On by default — it's a system-wide affordance. */
  showToggleAll?: boolean
  /**
   * Field on an option holding a colour — renders a small dot on each chip.
   *
   * For things whose colour IS their identity (an event category, a class code,
   * a calendar): with the dropdown closed the chips are all you can see, so
   * dropping the colour there makes the picker the one place in the app that
   * doesn't recognise them by it.
   *
   * Opt-in and additive: unset means no dot, so every existing consumer is
   * untouched. The dot only ever ADDS to a chip — chip size, weight and fill
   * stay the system-wide ones (main.css), which is the rule this must not break.
   */
  chipColorField?: string
}>(), {
  optionLabel: 'label',
  optionValue: 'key',
  placeholder: 'Select…',
  // filter deliberately has NO default — undefined means "decide from the count".
  disabled: false,
  showToggleAll: true,
})

// Chips resolve against the FLAT option list — with grouped options the labels
// live one level down, inside each group's children.
const flatOptions = computed<any[]>(() => {
  if (!props.optionGroupChildren) return props.options ?? []
  return (props.options ?? []).flatMap((g: any) => g[props.optionGroupChildren!] ?? [])
})

// SYSTEM RULE — searching a handful of options is noise; only show the filter box
// once the list is long enough that scanning it stops being instant.
const SEARCH_THRESHOLD = 10
const showFilter = computed(() => props.filter ?? flatOptions.value.length > SEARCH_THRESHOLD)

const emit = defineEmits<{ (e: 'update:modelValue', v: any[]): void }>()

const selectedOpts = computed(() =>
  (props.modelValue ?? []).map(v => flatOptions.value.find(o => keyOf(o) === v) ?? v)
)
// Options may be plain strings/numbers (no optionLabel/optionValue given) — a
// raw MultiSelect handles that, so this must too or the chips render blank.
const isPrimitive = (o: any) => o === null || typeof o !== 'object'
const labelOf = (o: any) => (isPrimitive(o) ? String(o) : o[props.optionLabel!])
const keyOf = (o: any) => (isPrimitive(o) ? o : o[props.optionValue!])
/**
 * The chip's colour dot, or null for no dot. Blank/missing colours fall back to
 * a neutral grey rather than black — an option that simply has no colour set
 * shouldn't read as a deliberate black one.
 */
const colorOf = (o: any): string | null => {
  if (!props.chipColorField || isPrimitive(o)) return null
  return o[props.chipColorField] || '#cbd5e1'
}

function remove(o: any) {
  emit('update:modelValue', (props.modelValue ?? []).filter(v => v !== keyOf(o)))
}

const wrap = ref<HTMLElement | null>(null)
const measure = ref<HTMLElement | null>(null)
const moreEl = ref<HTMLElement | null>(null)
const visibleCount = ref<number>(99)
const hiddenCount = computed(() => Math.max(0, selectedOpts.value.length - visibleCount.value))
const visibleOpts = computed(() => selectedOpts.value.slice(0, visibleCount.value))

function recompute() {
  const c = wrap.value
  const m = measure.value
  if (!c || !m) return
  const avail = c.clientWidth
  const gap = 4
  const chips = Array.from(m.children) as HTMLElement[]
  const widths = chips.map(el => el.offsetWidth)
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1)
  if (total <= avail) { visibleCount.value = widths.length; return }
  const reserve = (moreEl.value?.offsetWidth ?? 56) + gap
  let used = 0
  let count = 0
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i] + (i > 0 ? gap : 0)
    if (used + w + reserve <= avail) { used += w; count++ } else break
  }
  visibleCount.value = count
}

let ro: ResizeObserver | null = null
function schedule() { nextTick(() => recompute()) }
watch(() => props.modelValue, schedule, { deep: true })
onMounted(() => {
  schedule()
  ro = new ResizeObserver(() => recompute())
  if (wrap.value) ro.observe(wrap.value)
})
onBeforeUnmount(() => { ro?.disconnect(); ro = null })
</script>

<template>
  <MultiSelect
    :modelValue="modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
    :options="options" :optionLabel="optionLabel" :optionValue="optionValue"
    :optionGroupLabel="optionGroupLabel" :optionGroupChildren="optionGroupChildren"
    :filter="showFilter" :disabled="disabled" :optionDisabled="optionDisabled"
    :placeholder="placeholder" :showToggleAll="showToggleAll" class="w-full">
    <!-- Let hosts own the group header (e.g. click a code to select all its classes). -->
    <template v-if="$slots.optiongroup" #optiongroup="sp">
      <slot name="optiongroup" v-bind="sp" />
    </template>
    <!-- …and the option row (e.g. a discipline indented under its parent). -->
    <template v-if="$slots.option" #option="sp">
      <slot name="option" v-bind="sp" />
    </template>
    <template #value="sp">
      <span v-if="!sp.value || sp.value.length === 0" class="text-sm text-gray-400">{{ placeholder }}</span>
      <div v-else class="relative w-full min-w-0">
        <!-- invisible measuring row (intrinsic widths) -->
        <div ref="measure" class="absolute invisible flex gap-1 pointer-events-none whitespace-nowrap" aria-hidden="true">
          <!-- The dot is measured too. This row is what decides how many chips
               fit; if it renders anything narrower than the visible one, the
               count comes out too high and the chips overflow their box. -->
          <span v-for="o in selectedOpts" :key="'m-' + keyOf(o)" class="chip-ms"><span
            v-if="colorOf(o)" class="chip-ms-dot" />{{ labelOf(o) }}<i class="pi pi-times-circle chip-ms-x" /></span>
          <span ref="moreEl" class="chip-ms chip-ms-more">+9 more</span>
        </div>
        <!-- visible row -->
        <div ref="wrap" class="flex flex-nowrap items-center gap-1 overflow-hidden w-full">
          <span v-for="o in visibleOpts" :key="keyOf(o)" class="chip-ms">
            <span v-if="colorOf(o)" class="chip-ms-dot" :style="{ background: colorOf(o) }" />
            {{ labelOf(o) }}
            <i class="pi pi-times-circle chip-ms-x" @mousedown.stop.prevent @click.stop="remove(o)" />
          </span>
          <span v-if="hiddenCount > 0" class="chip-ms chip-ms-more">+{{ hiddenCount }} more</span>
        </div>
      </div>
    </template>
  </MultiSelect>
</template>

<style scoped>
.chip-ms {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex: 0 0 auto;
  padding: 0.0625rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.25rem;
  border-radius: 9999px;
  background: #f1f5f9;
  color: #334155;
  white-space: nowrap;
}
/* Opt-in colour dot (chipColorField). Sized in em so it tracks the chip's own
   font size — the chip itself stays exactly the system-wide size and fill. */
.chip-ms-dot {
  flex: 0 0 auto;
  width: 0.5em;
  height: 0.5em;
  border-radius: 9999px;
}
.chip-ms-x {
  font-size: 0.75rem;
  cursor: pointer;
  color: #94a3b8;
}
.chip-ms-x:hover { color: #475569; }
.chip-ms-more {
  background: #e2e8f0;
  color: #475569;
  font-weight: 600;
}
</style>
