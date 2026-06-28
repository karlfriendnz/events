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
}>(), {
  optionLabel: 'label',
  optionValue: 'key',
  placeholder: 'Select…',
})

const emit = defineEmits<{ (e: 'update:modelValue', v: any[]): void }>()

const selectedOpts = computed(() =>
  (props.modelValue ?? []).map(v => props.options.find(o => o[props.optionValue!] === v) ?? { [props.optionValue!]: v, [props.optionLabel!]: v })
)
const labelOf = (o: any) => o[props.optionLabel!]
const keyOf = (o: any) => o[props.optionValue!]

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
    :placeholder="placeholder" :showToggleAll="false" class="w-full">
    <template #value="sp">
      <span v-if="!sp.value || sp.value.length === 0" class="text-sm text-gray-400">{{ placeholder }}</span>
      <div v-else class="relative w-full min-w-0">
        <!-- invisible measuring row (intrinsic widths) -->
        <div ref="measure" class="absolute invisible flex gap-1 pointer-events-none whitespace-nowrap" aria-hidden="true">
          <span v-for="o in selectedOpts" :key="'m-' + keyOf(o)" class="chip-ms">{{ labelOf(o) }}<i class="pi pi-times-circle chip-ms-x" /></span>
          <span ref="moreEl" class="chip-ms chip-ms-more">+9 more</span>
        </div>
        <!-- visible row -->
        <div ref="wrap" class="flex flex-nowrap items-center gap-1 overflow-hidden w-full">
          <span v-for="o in visibleOpts" :key="keyOf(o)" class="chip-ms">
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
