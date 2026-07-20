<!--
  Time-of-day picker — a two-column wheel (hours | minutes) in a popover, matching the
  reference design: scroll each column, the selected value highlights, Cancel / Ok
  confirm. Quick to land on the common :00/:15/:30/:45 slots, and every minute is there
  so any custom time is one click away. v-model is a Date carrying the chosen H:M (the
  calendar day is preserved from the current value), so it drops into DateTimeEditor's
  separate date + time model unchanged.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: Date | null
  placeholder?: string
  disabled?: boolean
  // Minute granularity of the wheel (1 = every minute, so custom times work; the
  // common quarter-hours are still easy to land on).
  stepMinutes?: number
}>(), { stepMinutes: 1 })

const emit = defineEmits<{ (e: 'update:modelValue', v: Date | null): void }>()

const op = ref()
const hourColRef = ref<HTMLElement>()
const minColRef = ref<HTMLElement>()

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = computed(() => {
  const step = Math.max(1, Math.floor(props.stepMinutes || 1))
  const out: number[] = []
  for (let m = 0; m < 60; m += step) out.push(m)
  return out
})

const selHour = ref<number | null>(null)
const selMin = ref<number | null>(null)

function pad(n: number) { return String(n).padStart(2, '0') }
// The chosen time reads back in friendly 12-hour form with AM/PM (e.g. "9:00 AM");
// the wheel columns stay 24-hour so every hour is one scroll.
const display = computed(() =>
  props.modelValue ? props.modelValue.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

// The trigger is ALSO a real text input — you can TYPE the time ("9:30", "930",
// "9:30pm", "21:15") instead of scrolling. `text` mirrors the display; commitText
// parses whatever was typed on blur/Enter.
const text = ref('')
watch(display, v => { text.value = v }, { immediate: true })
function parseTyped(raw: string): Date | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  const m = s.match(/^(\d{1,2})[:. ]?(\d{2})?\s*(a\.?m\.?|p\.?m\.?|a|p)?$/)
  if (!m) return null
  let h = parseInt(m[1], 10); const min = m[2] ? parseInt(m[2], 10) : 0
  if (min > 59) return null
  const ap = m[3]?.[0]
  if (ap === 'p' && h < 12) h += 12
  if (ap === 'a' && h === 12) h = 0
  if (h > 23) return null
  const base = props.modelValue ? new Date(props.modelValue) : new Date()
  base.setHours(h, min, 0, 0)
  return base
}
function commitText() {
  const raw = text.value
  if (!raw.trim()) { if (props.modelValue) emit('update:modelValue', null); return }
  const d = parseTyped(raw)
  if (d) emit('update:modelValue', d)   // the watch reformats `text`
  else text.value = display.value        // invalid → revert to last good value
}

function toggle(e: Event) {
  if (props.disabled) return
  const d = props.modelValue
  selHour.value = d ? d.getHours() : 9
  // Snap the seeded minute to the nearest available step so it highlights a real row.
  const rawMin = d ? d.getMinutes() : 0
  const step = Math.max(1, Math.floor(props.stepMinutes || 1))
  selMin.value = Math.round(rawMin / step) * step % 60
  op.value?.toggle(e)
}

function scrollToSel(col: HTMLElement | undefined, val: number | null, list: number[]) {
  if (!col || val == null) return
  const idx = list.indexOf(val)
  const item = col.children[idx] as HTMLElement | undefined
  if (item) col.scrollTop = item.offsetTop - col.clientHeight / 2 + item.clientHeight / 2
}
function onShow() {
  nextTick(() => {
    scrollToSel(hourColRef.value, selHour.value, hours)
    scrollToSel(minColRef.value, selMin.value, minutes.value)
  })
}

function ok() {
  const base = props.modelValue ? new Date(props.modelValue) : new Date()
  base.setHours(selHour.value ?? 0, selMin.value ?? 0, 0, 0)
  emit('update:modelValue', base)
  op.value?.hide()
}
function cancel() { op.value?.hide() }
</script>

<template>
  <div class="ts-wrap">
    <div class="ts-trigger" :class="{ 'ts-disabled': disabled }">
      <input type="text" class="ts-input" :value="text" :placeholder="placeholder || '--:--'" :disabled="disabled"
        @input="text = ($event.target as HTMLInputElement).value"
        @keydown.enter.prevent="commitText"
        @blur="commitText" />
      <button type="button" class="ts-clock" :disabled="disabled" tabindex="-1" @click="toggle"><i class="pi pi-clock" /></button>
    </div>

    <Popover ref="op" @show="onShow">
      <div class="ts-panel">
        <div class="ts-cols">
          <div ref="hourColRef" class="ts-col">
            <button v-for="h in hours" :key="'h' + h" type="button" class="ts-item"
              :class="{ 'ts-sel': selHour === h }" @click="selHour = h">{{ pad(h) }}</button>
          </div>
          <div class="ts-colon">:</div>
          <div ref="minColRef" class="ts-col">
            <button v-for="m in minutes" :key="'m' + m" type="button" class="ts-item"
              :class="{ 'ts-sel': selMin === m }" @click="selMin = m">{{ pad(m) }}</button>
          </div>
        </div>
        <div class="ts-footer">
          <button type="button" class="ts-btn-text" @click="cancel">Cancel</button>
          <button type="button" class="ts-btn-ok" @click="ok">Ok</button>
        </div>
      </div>
    </Popover>
  </div>
</template>

<style scoped>
.ts-wrap { position: relative; display: block; }

.ts-trigger {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: .5rem;
  padding: .5rem .75rem; min-height: 40px; font-size: 14px; line-height: 1.4;
  background: #fff; border: 1px solid #d1d5db; border-radius: 8px; color: #1E2157; text-align: left;
  transition: border-color .15s, box-shadow .15s;
}
.ts-trigger:hover:not(.ts-disabled) { border-color: var(--brand-primary); }
.ts-trigger:focus-within { border-color: var(--brand-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 22%, transparent); }
.ts-disabled { opacity: .55; cursor: not-allowed; background: #f9fafb; }
.ts-input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent; padding: 0;
  font-size: 14px; color: #1E2157; font-variant-numeric: tabular-nums; letter-spacing: .02em;
}
.ts-input::placeholder { color: #9ca3af; letter-spacing: normal; }
.ts-clock { border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0; display: flex; align-items: center; font-size: 1rem; }
.ts-clock:hover:not(:disabled) { color: var(--brand-primary); }

.ts-panel { width: 190px; padding: 2px 0 0; }
.ts-cols { display: flex; align-items: stretch; }
.ts-colon { display: flex; align-items: center; font-weight: 700; font-size: 16px; color: #cbd5e1; padding: 0 1px; }
.ts-col {
  flex: 1; height: 168px; overflow-y: auto; scroll-snap-type: y mandatory;
  display: flex; flex-direction: column; gap: 2px; padding: 68px 6px;
  scrollbar-width: none;
}
.ts-col::-webkit-scrollbar { width: 0; height: 0; }
.ts-item {
  scroll-snap-align: center; flex: 0 0 auto; text-align: center; padding: .35rem 0; border-radius: 8px;
  font-size: 15px; font-variant-numeric: tabular-nums; color: #1E2157; background: transparent; border: none; cursor: pointer;
  transition: background .12s, color .12s;
}
.ts-item:hover:not(.ts-sel) { background: #f3f4f6; }
.ts-sel { background: var(--brand-primary); color: #fff; font-weight: 700; box-shadow: 0 1px 3px rgba(30,33,87,.35); }

.ts-footer {
  display: flex; justify-content: flex-end; gap: 1rem; align-items: center;
  padding: .5rem .75rem .3rem; margin-top: .2rem; border-top: 1px solid #f1f5f9;
}
.ts-btn-text { color: #94a3b8; font-size: 13px; font-weight: 500; background: none; border: none; cursor: pointer; padding: .2rem .3rem; }
.ts-btn-text:hover { color: #64748b; }
.ts-btn-ok { color: #64748b; font-weight: 700; font-size: 13px; background: none; border: none; cursor: pointer; padding: .2rem .3rem; }
.ts-btn-ok:hover { color: var(--brand-primary); }
</style>
