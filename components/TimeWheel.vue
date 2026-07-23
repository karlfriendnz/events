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
  // Earliest allowed time-of-day (its clock time is the floor). The host passes
  // `now` when the picked date is today, so a today event can't be set in the past.
  minTime?: Date | null
}>(), { stepMinutes: 1, minTime: null })

// Floor as minutes-from-midnight (or null = no floor). Only the clock time matters.
const minMins = computed(() => props.minTime ? props.minTime.getHours() * 60 + props.minTime.getMinutes() : null)
function hour24(h12: number) { return (h12 % 12) + (selMeridiem.value === 'PM' ? 12 : 0) }
function hourDisabled(h12: number) { return minMins.value != null && hour24(h12) * 60 + 59 < minMins.value }
function minDisabled(m: number) { return minMins.value != null && selHour.value != null && hour24(selHour.value) * 60 + m < minMins.value }
const amDisabled = computed(() => minMins.value != null && minMins.value >= 12 * 60)  // now is PM → AM is fully past

const emit = defineEmits<{ (e: 'update:modelValue', v: Date | null): void }>()

const op = ref()
const triggerRef = ref<HTMLElement>()
const hourColRef = ref<HTMLElement>()
const minColRef = ref<HTMLElement>()

// 12-hour wheel (12, 1, 2 … 11) with a separate AM/PM selector — the display + typed
// input are both 12-hour, so the wheel matches.
const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const minutes = computed(() => {
  const step = Math.max(1, Math.floor(props.stepMinutes || 1))
  const out: number[] = []
  for (let m = 0; m < 60; m += step) out.push(m)
  return out
})

const selHour = ref<number | null>(null)   // 1..12
const selMin = ref<number | null>(null)
const selMeridiem = ref<'AM' | 'PM'>('AM')

function pad(n: number) { return String(n).padStart(2, '0') }
// The chosen time reads back in friendly 12-hour form with lowercase am/pm (e.g.
// "8:00 am") — built by hand so the am/pm is always shown (some locales drop it).
const display = computed(() => {
  const d = props.modelValue
  if (!d) return ''
  const h24 = d.getHours()
  const mer = h24 >= 12 ? 'pm' : 'am'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${mer}`
})

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
  if (d) {
    // Typed a past time on a today event → clamp forward to the earliest allowed.
    if (minMins.value != null && d.getHours() * 60 + d.getMinutes() < minMins.value) {
      d.setHours(Math.floor(minMins.value / 60), minMins.value % 60, 0, 0)
    }
    emit('update:modelValue', d)   // the watch reformats `text`
  } else text.value = display.value  // invalid → revert to last good value
}

const panelOpen = ref(false)
function seedSelection() {
  const d = props.modelValue
  const h24 = d ? d.getHours() : 9
  selMeridiem.value = h24 >= 12 ? 'PM' : 'AM'
  selHour.value = h24 % 12 === 0 ? 12 : h24 % 12
  // Snap the seeded minute to the nearest available step so it highlights a real row.
  const rawMin = d ? d.getMinutes() : 0
  const step = Math.max(1, Math.floor(props.stepMinutes || 1))
  selMin.value = Math.round(rawMin / step) * step % 60
  // Opening on a past time (today event) → seed to the earliest allowed instead.
  if (minMins.value != null && hour24(selHour.value ?? 0) * 60 + (selMin.value ?? 0) < minMins.value) {
    const mm = minMins.value
    const h24 = Math.floor(mm / 60)
    selMeridiem.value = h24 >= 12 ? 'PM' : 'AM'
    selHour.value = h24 % 12 === 0 ? 12 : h24 % 12
    selMin.value = Math.round((mm % 60) / step) * step % 60
  }
}
// Clicking ANYWHERE on the box opens the wheel (anchored under the whole field, not
// the clock, so it drops straight below left-aligned). Already open → leave it (so
// clicking into the text to position the cursor while typing doesn't close it).
function openPanel(e: Event) {
  if (props.disabled || panelOpen.value) return
  seedSelection()
  op.value?.show(e, triggerRef.value)
}
// The clock icon toggles (open/close).
function toggle(e: Event) {
  if (props.disabled) return
  seedSelection()
  op.value?.toggle(e, triggerRef.value)
}

// Centre the selected value on the middle line, the rest spilling above/below it.
function scrollToSel(col: HTMLElement | undefined, val: number | null, list: number[], smooth = false) {
  if (!col || val == null) return
  const idx = list.indexOf(val)
  const item = col.children[idx] as HTMLElement | undefined
  if (item) col.scrollTo({ top: item.offsetTop - col.clientHeight / 2 + item.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' })
}
function onShow() {
  nextTick(() => {
    scrollToSel(hourColRef.value, selHour.value, hours)
    scrollToSel(minColRef.value, selMin.value, minutes.value)
  })
}
// Picking a value re-centres its column so the selection is always on the middle line
// (e.g. choosing :15 slides it to centre, :13/:14 above, :16… below).
watch(selHour, () => { if (panelOpen.value) nextTick(() => scrollToSel(hourColRef.value, selHour.value, hours, true)) })
watch(selMin, () => { if (panelOpen.value) nextTick(() => scrollToSel(minColRef.value, selMin.value, minutes.value, true)) })

function ok() {
  const base = props.modelValue ? new Date(props.modelValue) : new Date()
  const h12 = selHour.value ?? 12
  const h24 = (h12 % 12) + (selMeridiem.value === 'PM' ? 12 : 0)
  let mins = h24 * 60 + (selMin.value ?? 0)
  if (minMins.value != null && mins < minMins.value) mins = minMins.value   // never in the past
  base.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  emit('update:modelValue', base)
  op.value?.hide()
}
function cancel() { op.value?.hide() }

// Programmatic open — lets a parent (DateTimeEditor's date→time→date→time auto-advance)
// pop this wheel. Anchors to the trigger, so no real click event is needed.
function open() {
  if (props.disabled || panelOpen.value) return
  seedSelection()
  op.value?.show({ currentTarget: triggerRef.value } as any, triggerRef.value)
}
defineExpose({ open })
</script>

<template>
  <div class="ts-wrap">
    <div ref="triggerRef" class="ts-trigger" :class="{ 'ts-disabled': disabled }" @click="openPanel">
      <input type="text" class="ts-input" :value="text" :placeholder="placeholder || '--:--'" :disabled="disabled"
        @input="text = ($event.target as HTMLInputElement).value"
        @keydown.enter.prevent="commitText"
        @blur="commitText" />
      <button type="button" class="ts-clock" :disabled="disabled" tabindex="-1" @click.stop="toggle"><i class="pi pi-clock" /></button>
    </div>

    <Popover ref="op" @show="panelOpen = true; onShow()" @hide="panelOpen = false">
      <div class="ts-panel">
        <div class="ts-cols">
          <div ref="hourColRef" class="ts-col">
            <button v-for="h in hours" :key="'h' + h" type="button" class="ts-item"
              :class="{ 'ts-sel': selHour === h, 'ts-past': hourDisabled(h) }" :disabled="hourDisabled(h)"
              @click="!hourDisabled(h) && (selHour = h)">{{ pad(h) }}</button>
          </div>
          <div class="ts-colon">:</div>
          <div ref="minColRef" class="ts-col">
            <button v-for="m in minutes" :key="'m' + m" type="button" class="ts-item"
              :class="{ 'ts-sel': selMin === m, 'ts-past': minDisabled(m) }" :disabled="minDisabled(m)"
              @click="!minDisabled(m) && (selMin = m)">{{ pad(m) }}</button>
          </div>
          <!-- AM / PM — a fixed pair, not a wheel. The SELECTED one rides the centre
               line (AM by default; picking PM slides the pair up a row so PM lands on
               it). AM is disabled once now is past midday. -->
          <div class="ts-ampm" :class="{ 'ts-ampm-pm': selMeridiem === 'PM' }">
            <button type="button" class="ts-ampm-btn" :class="{ 'ts-sel': selMeridiem === 'AM', 'ts-past': amDisabled }" :disabled="amDisabled" @click="!amDisabled && (selMeridiem = 'AM')">AM</button>
            <button type="button" class="ts-ampm-btn" :class="{ 'ts-sel': selMeridiem === 'PM' }" @click="selMeridiem = 'PM'">PM</button>
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

/* One row height + one end-padding shared by the wheels AND the AM/PM pair, so every
   column's first row sits on the same line. --ts-pad + half a row = the snap centre. */
.ts-panel { width: 236px; padding: 2px 0 0; --ts-row: 30px; --ts-pad: 68px; }
.ts-cols { display: flex; align-items: stretch; }
.ts-colon { display: flex; align-items: center; font-weight: 700; font-size: 16px; color: #cbd5e1; padding: 0 1px; }
/* Top-aligned so AM's row (not the AM/PM gap) sits on the selected centre line.
   Selecting PM slides the whole pair up exactly one row (row height + gap) so PM
   takes the centre line and AM moves above it. */
.ts-ampm { display: flex; flex-direction: column; justify-content: flex-start; gap: 2px; padding: var(--ts-pad) 4px var(--ts-pad) 8px; transition: transform .18s ease; }
.ts-ampm.ts-ampm-pm { transform: translateY(calc(-1 * (var(--ts-row) + 2px))); }
.ts-ampm-btn {
  height: var(--ts-row); display: flex; align-items: center; justify-content: center;
  padding: 0 .7rem; border-radius: 8px; font-size: 13px; font-weight: 600; letter-spacing: .03em;
  color: #1E2157; background: #f3f4f6; border: none; cursor: pointer; transition: background .12s, color .12s;
}
.ts-ampm-btn:hover:not(.ts-sel) { background: #e5e7eb; }
.ts-col {
  flex: 1; height: 168px; overflow-y: auto; scroll-snap-type: y mandatory;
  display: flex; flex-direction: column; gap: 2px; padding: var(--ts-pad) 6px;
  scrollbar-width: none;
}
.ts-col::-webkit-scrollbar { width: 0; height: 0; }
.ts-item {
  scroll-snap-align: center; flex: 0 0 auto; height: var(--ts-row);
  display: flex; align-items: center; justify-content: center; border-radius: 8px;
  font-size: 15px; font-variant-numeric: tabular-nums; color: #1E2157; background: transparent; border: none; cursor: pointer;
  transition: background .12s, color .12s;
}
.ts-item:hover:not(.ts-sel):not(.ts-past) { background: #f3f4f6; }
.ts-past { opacity: .28; cursor: not-allowed; }
.ts-ampm-btn.ts-past { opacity: .35; cursor: not-allowed; }
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
