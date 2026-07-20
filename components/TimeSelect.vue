<!--
  A time-of-day selector that's quick for the common 15-minute slots AND accepts any
  custom time. It's an editable combobox (PrimeVue AutoComplete): click the clock to
  pick from a scrollable list of 15-minute slots, or just type — "9", "9:37", "930",
  "9:37pm", "21:15" all parse. v-model is a Date carrying the chosen H:M; the calendar
  day is preserved from the current value, so it drops into DateTimeEditor's separate
  date + time model unchanged.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: Date | null
  placeholder?: string
  disabled?: boolean
  stepMinutes?: number
}>(), { stepMinutes: 15 })

const emit = defineEmits<{ (e: 'update:modelValue', v: Date | null): void }>()

function fmt(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
function fmtMins(mins: number): string {
  return fmt(new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60))
}

const text = ref('')
watch(() => props.modelValue, v => { text.value = v ? fmt(v) : '' }, { immediate: true })

// Every slot of the day at the chosen step (default 15 min).
const allSlots = computed(() => {
  const out: string[] = []
  for (let m = 0; m < 1440; m += props.stepMinutes) out.push(fmtMins(m))
  return out
})
const suggestions = ref<string[]>([])
function onComplete(e: { query: string }) {
  const q = (e.query || '').trim().toLowerCase()
  // Opening the dropdown on an already-set field passes the full value as the query —
  // don't filter to just itself; show everything so the list stays browsable.
  const exact = allSlots.value.some(s => s.toLowerCase() === q)
  const filtered = (!q || exact) ? allSlots.value : allSlots.value.filter(s => s.toLowerCase().includes(q))
  // A typed custom time (e.g. "9:37") matches no slot — still offer the whole list.
  suggestions.value = filtered.length ? filtered : allSlots.value
}

// Parse a free-typed time. Accepts "9", "9:30", "9.30", "9 30", "930", "0930",
// "9pm", "9:30 pm", "21:15". Returns a Date on the current day (or today), or null.
function parse(raw: string): Date | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!s) return null
  const m = s.match(/^(\d{1,2})[:. ]?(\d{2})?\s*(a\.?m\.?|p\.?m\.?|a|p)?$/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  if (min > 59) return null
  const ap = m[3]?.[0]
  if (ap === 'p' && h < 12) h += 12
  if (ap === 'a' && h === 12) h = 0
  if (h > 23) return null
  const base = props.modelValue ? new Date(props.modelValue) : new Date()
  base.setHours(h, min, 0, 0)
  return base
}

function apply(raw: string) {
  const d = parse(raw)
  if (d) { emit('update:modelValue', d); text.value = fmt(d) }
}
function commit() {
  const raw = text.value
  if (!raw.trim()) { if (props.modelValue) emit('update:modelValue', null); return }
  const d = parse(raw)
  if (d) { emit('update:modelValue', d); text.value = fmt(d) }
  else text.value = props.modelValue ? fmt(props.modelValue) : ''   // invalid → revert
}

// Picking a slot is authoritative — it uses the clicked value directly, and cancels
// any pending blur-commit so a blur that fires first can't clobber the selection.
let pendingBlur: ReturnType<typeof setTimeout> | null = null
function onSelect(e: { value: string }) {
  if (pendingBlur) { clearTimeout(pendingBlur); pendingBlur = null }
  apply(e.value)
}
function onBlur() {
  if (pendingBlur) clearTimeout(pendingBlur)
  pendingBlur = setTimeout(() => { commit(); pendingBlur = null }, 150)
}
onBeforeUnmount(() => { if (pendingBlur) clearTimeout(pendingBlur) })
</script>

<template>
  <AutoComplete :model-value="text" :suggestions="suggestions" :disabled="disabled"
    :placeholder="placeholder" dropdown complete-on-focus :delay="0" fluid
    @update:model-value="text = $event" @complete="onComplete"
    @item-select="onSelect" @blur="onBlur" @keydown.enter="commit">
    <template #dropdownicon><i class="pi pi-clock" /></template>
  </AutoComplete>
</template>
