<!--
  ProfileDashboard — the club-configurable member overview.

  ONE renderer, TWO contexts:
    • Settings builder (pages/settings/profile-dashboard.vue) — editable=true, fed a
      DEMO bundle, lets the club drag/resize/add/remove widgets and pick which fields
      each field-driven widget shows. Saves the layout to organisations.profile_dashboard.
    • Profile tab (pages/people/[id].vue) — editable=false, fed the REAL person bundle.

  Layout machinery (registry + reconcile + grid edit mode + save-fold) is cloned from
  pages/dashboard.vue so adding a widget needs no migration. Config item shape:
    { key, enabled, x, y, w, h, settings? }   settings = { fields:[], message, flagField }
-->
<script setup lang="ts">
import { GridLayout, GridItem } from 'grid-layout-plus'

interface WidgetDef {
  key: string; label: string; description: string
  x: number; y: number; w: number; h: number; minW: number; minH: number
  configurable?: 'fields' | 'alert'
  defaultFields?: string[]
}
interface CfgItem { key: string; enabled: boolean; x: number; y: number; w: number; h: number; settings?: any }

// Registry — default slot/size per widget, roughly mirroring the mock's zones on a 12-col grid.
const PROFILE_WIDGETS: WidgetDef[] = [
  { key: 'identity',      label: 'Profile card',        description: 'Photo + chosen key fields',           x: 0, y: 0,  w: 3, h: 7, minW: 2, minH: 4, configurable: 'fields', defaultFields: ['membership_type', 'dob', 'gender'] },
  { key: 'flags',         label: 'Flags',               description: 'Highlighted fields (e.g. Asthma)',     x: 0, y: 7,  w: 3, h: 3, minW: 2, minH: 2, configurable: 'fields', defaultFields: [] },
  { key: 'alert',         label: 'Alert banner',        description: 'Warning shown when a field is set',    x: 3, y: 0,  w: 9, h: 1, minW: 4, minH: 1, configurable: 'alert' },
  { key: 'info',          label: 'Info',                description: 'Label / value grid of fields',         x: 3, y: 1,  w: 9, h: 3, minW: 4, minH: 2, configurable: 'fields', defaultFields: ['email', 'phone', 'dob', 'gender'] },
  { key: 'membership',    label: 'Membership',          description: 'Groups, role and expiry',              x: 3, y: 4,  w: 5, h: 3, minW: 3, minH: 2 },
  { key: 'financials',    label: 'Financials',          description: 'Invoices and amounts',                 x: 3, y: 7,  w: 5, h: 4, minW: 3, minH: 2 },
  { key: 'communication', label: 'Communication',       description: 'Emails sent (event-level)',            x: 8, y: 4,  w: 4, h: 4, minW: 3, minH: 2 },
  { key: 'parents',       label: 'Parents / caregivers',description: 'Linked contacts',                      x: 3, y: 11, w: 9, h: 3, minW: 4, minH: 2 },
  { key: 'notes',         label: 'Notes',               description: 'Staff notes feed',                     x: 9, y: 0,  w: 3, h: 8, minW: 2, minH: 4 },
  { key: 'activity',      label: 'Activity',            description: 'Events invited to / attended',         x: 3, y: 14, w: 9, h: 4, minW: 4, minH: 2 },
]
const defById = Object.fromEntries(PROFILE_WIDGETS.map(w => [w.key, w]))

const props = withDefaults(defineProps<{
  modelValue: CfgItem[] | null
  data: any            // { person, memberships, financials, communications, parents, activity, notes }
  fields: any[]        // catalogue [{ key, label, source:'core'|'custom', field_type }]
  editable?: boolean
  liveNotes?: boolean  // true on the real profile → Notes create/delete enabled
}>(), { editable: false, liveNotes: false })

const emit = defineEmits<{
  (e: 'update:modelValue', v: CfgItem[]): void
  (e: 'save', v: CfgItem[]): void
  (e: 'add-note', payload: { body: string; links: NoteLink[] }): void
  (e: 'delete-note', id: string): void
}>()

const fieldByKey = computed(() => Object.fromEntries((props.fields ?? []).map(f => [f.key, f])))

// ── Config + grid model ──
const config = ref<CfgItem[]>([])
const layout = ref<any[]>([])

// Narrow screens: VIEW-ONLY, widgets stack full-width in order (editing desktop-only).
const isNarrow = ref(false)
function updateNarrow() { if (import.meta.client) isNarrow.value = window.innerWidth < 768 }
onMounted(updateNarrow)
if (import.meta.client) {
  window.addEventListener('resize', updateNarrow)
  onBeforeUnmount(() => window.removeEventListener('resize', updateNarrow))
}
const displayLayout = computed(() => {
  if (!isNarrow.value) return layout.value
  const sorted = [...layout.value].sort((a, b) => (a.y - b.y) || (a.x - b.x))
  let y = 0
  return sorted.map(it => { const o = { ...it, x: 0, w: 12, y }; y += (it.h || 1); return o })
})

function defaultConfig(): CfgItem[] {
  return PROFILE_WIDGETS.map(w => ({ key: w.key, enabled: true, x: w.x, y: w.y, w: w.w, h: w.h, settings: w.defaultFields ? { fields: [...w.defaultFields] } : {} }))
}
function reconcile(saved: any): CfgItem[] {
  const valid = new Set(PROFILE_WIDGETS.map(w => w.key))
  const out: CfgItem[] = []
  const seen = new Set<string>()
  for (const it of Array.isArray(saved) ? saved : []) {
    if (it && valid.has(it.key) && !seen.has(it.key)) {
      const d = defById[it.key]
      out.push({
        key: it.key, enabled: it.enabled !== false,
        x: Number.isFinite(it.x) ? it.x : d.x, y: Number.isFinite(it.y) ? it.y : d.y,
        w: Number.isFinite(it.w) ? it.w : d.w, h: Number.isFinite(it.h) ? it.h : d.h,
        settings: it.settings ?? (d.defaultFields ? { fields: [...d.defaultFields] } : {}),
      })
      seen.add(it.key)
    }
  }
  for (const w of PROFILE_WIDGETS) if (!seen.has(w.key)) out.push({ key: w.key, enabled: true, x: w.x, y: w.y, w: w.w, h: w.h, settings: w.defaultFields ? { fields: [...w.defaultFields] } : {} })
  // Notes is a permanent, non-configurable component — always present.
  const notes = out.find(o => o.key === 'notes'); if (notes) notes.enabled = true
  return out
}
function rebuildLayout() {
  layout.value = config.value.filter(c => c.enabled).map(c => {
    const d = defById[c.key]
    return { i: c.key, x: c.x, y: c.y, w: c.w, h: c.h, minW: d.minW, minH: d.minH }
  })
}
function hydrate() {
  config.value = props.modelValue && props.modelValue.length ? reconcile(props.modelValue) : defaultConfig()
  rebuildLayout()
}
watch(() => props.modelValue, hydrate, { immediate: true })

const hiddenWidgets = computed(() => config.value.filter(c => !c.enabled))
function cfgFor(key: string) { return config.value.find(c => c.key === key) }

// ── Edit mode (builder only) ──
const editing = ref(false)
const saving = ref(false)
const selectedKey = ref<string | null>(null)
function startEdit() { editing.value = true }
function cancelEdit() { editing.value = false; selectedKey.value = null; hydrate() }
function removeWidget(key: string) {
  if (key === 'notes') return // Notes is a permanent component — can't be hidden.
  const c = cfgFor(key); if (c) c.enabled = false
  layout.value = layout.value.filter(l => l.i !== key)
  if (selectedKey.value === key) selectedKey.value = null
}
function addWidget(key: string) {
  const c = cfgFor(key); if (!c) return
  c.enabled = true
  const d = defById[key]
  const maxY = layout.value.reduce((m, l) => Math.max(m, l.y + l.h), 0)
  layout.value.push({ i: key, x: 0, y: maxY, w: d.w, h: d.h, minW: d.minW, minH: d.minH })
}
function saveLayout() {
  saving.value = true
  const byKey = Object.fromEntries(layout.value.map(l => [l.i, l]))
  const next: CfgItem[] = config.value.map(c => {
    const l = byKey[c.key]
    return l ? { key: c.key, enabled: true, x: l.x, y: l.y, w: l.w, h: l.h, settings: c.settings ?? {} } : { ...c, enabled: false }
  })
  config.value = next
  emit('update:modelValue', next)
  emit('save', next)
  saving.value = false; editing.value = false; selectedKey.value = null
}
function resetLayout() { config.value = defaultConfig(); rebuildLayout(); selectedKey.value = null }

// ── Per-widget field config ──
const selectedCfg = computed(() => selectedKey.value ? cfgFor(selectedKey.value) : null)
const selectedDef = computed(() => selectedKey.value ? defById[selectedKey.value] : null)
function selectableFields(def: WidgetDef) {
  if (!def) return props.fields ?? []
  if (def.key === 'flags' || def.key === 'alert') {
    // flags/alert favour booleans + custom fields, but allow any
    return props.fields ?? []
  }
  return props.fields ?? []
}
function ensureSettings(c: CfgItem) { if (!c.settings) c.settings = {} ; if (!c.settings.fields) c.settings.fields = [] }
function fieldChecked(c: CfgItem, key: string) { return !!(c.settings?.fields || []).includes(key) }
function toggleField(c: CfgItem, key: string) {
  ensureSettings(c)
  const arr = c.settings.fields as string[]
  const i = arr.indexOf(key)
  if (i >= 0) arr.splice(i, 1); else arr.push(key)
}

// ── Value lookup / formatting ──
const GENDER_LABEL: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', NON_BINARY: 'Non-binary', UNSPECIFIED: 'Unspecified' }
function rawValue(person: any, key: string) {
  const f = fieldByKey.value[key]
  if (!f) return person?.[key]
  return f.source === 'core' ? person?.[key] : person?.custom_fields?.[key]
}
function fmtValue(person: any, key: string) {
  const f = fieldByKey.value[key]
  let v = rawValue(person, key)
  if (v === null || v === undefined || v === '') return '—'
  if (key === 'gender') return GENDER_LABEL[v] || v
  if (f?.field_type === 'date' || key === 'dob') {
    const d = v instanceof Date ? v : new Date(v)
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  if (f?.field_type === 'checkbox' || typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}
function isTruthy(person: any, key: string) {
  const v = rawValue(person, key)
  return !(v === null || v === undefined || v === '' || v === false || v === 0)
}
function labelFor(key: string) { return fieldByKey.value[key]?.label ?? key }

const person = computed(() => props.data?.person ?? {})
const initials = computed(() => `${(person.value.first_name || '').charAt(0)}${(person.value.last_name || '').charAt(0)}`.toUpperCase() || '?')

function visibleFields(key: string): string[] {
  const c = cfgFor(key)
  return (c?.settings?.fields as string[]) || defById[key]?.defaultFields || []
}

// alert
const alertActive = computed(() => {
  const c = cfgFor('alert'); const fk = c?.settings?.flagField
  return fk ? isTruthy(person.value, fk) : false
})
const alertMessage = computed(() => cfgFor('alert')?.settings?.message || 'This member has an active flag.')

// On a real profile the alert cell only occupies the grid when it actually has a
// banner to show (no empty placeholder). In the builder it's always shown so it
// stays configurable.
function applyAlertVisibility() {
  if (props.editable) return
  const has = layout.value.some(l => l.i === 'alert')
  const c = cfgFor('alert')
  if (alertActive.value && c?.enabled && !has) {
    const d = defById['alert']
    layout.value = [...layout.value, { i: 'alert', x: c.x, y: c.y, w: c.w, h: c.h, minW: d.minW, minH: d.minH }]
  } else if (!alertActive.value && has) {
    layout.value = layout.value.filter(l => l.i !== 'alert')
  }
}
watch([alertActive, () => props.data], applyAlertVisibility, { immediate: true })

// flags that are "on"
const activeFlags = computed(() => visibleFields('flags').filter(k => isTruthy(person.value, k)))

// notes
type NoteLink = { type: string; id: string; label: string }
const notesTab = ref<'notes' | 'activity'>('notes')
const newNoteBody = ref('')
const newNoteLinks = ref<NoteLink[]>([])
// Things a note can connect to — sourced from the person's related entities.
const connectOptions = computed<NoteLink[]>(() => {
  const out: NoteLink[] = []
  for (const a of (props.data?.activity || [])) {
    if (a.event_id) out.push({ type: 'event', id: a.event_id, label: a.title || 'Event' })
  }
  for (const m of (props.data?.memberships || [])) {
    if (m.id) out.push({ type: 'group', id: m.id, label: m.group || 'Group' })
  }
  return out
})
const connectIcon = (type: string) => type === 'group' ? 'pi-users' : type === 'booking' ? 'pi-bookmark' : 'pi-calendar'
function submitNote() {
  const body = newNoteBody.value.trim(); if (!body) return
  emit('add-note', { body, links: [...newNoteLinks.value] })
  newNoteBody.value = ''; newNoteLinks.value = []
}
function fmtDateTime(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })
}
function titleCase(s: string) { return (s || '').charAt(0) + (s || '').slice(1).toLowerCase() }
function statusSeverity(s: string) {
  return ({ CONFIRMED: 'bg-emerald-50 text-emerald-600', SENT: 'bg-emerald-50 text-emerald-600', DECLINED: 'bg-red-50 text-red-500', PENDING: 'bg-amber-50 text-amber-600' } as any)[s] || 'bg-gray-100 text-gray-500'
}
</script>

<template>
  <div>
    <!-- toolbar (builder only) -->
    <div v-if="editable" class="flex items-center justify-between mb-3">
      <div v-if="editing" class="text-xs text-gray-400"><i class="pi pi-arrows-alt mr-1" />Drag to move · drag the corner to resize · click the gear to configure a widget.</div>
      <div v-else class="text-xs text-gray-400">This layout applies to every member profile.</div>
      <div class="flex items-center gap-2">
        <template v-if="editing">
          <button class="text-xs px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-800" @click="resetLayout">Reset</button>
          <button class="text-xs px-2.5 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 border border-gray-200" @click="cancelEdit">Cancel</button>
          <button class="text-xs px-3 py-1.5 rounded-lg text-white" style="background:#1E2157" :disabled="saving" @click="saveLayout">
            <i v-if="saving" class="pi pi-spin pi-spinner text-[10px] mr-1" />Save layout
          </button>
        </template>
        <button v-else class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:text-gray-900" @click="startEdit">
          <i class="pi pi-sliders-h text-xs" />Customise layout
        </button>
      </div>
    </div>

    <!-- add-widget tray -->
    <div v-if="editable && editing && hiddenWidgets.length" class="mb-4 flex flex-wrap items-center gap-2">
      <span class="text-xs text-gray-400">Add widget:</span>
      <button v-for="hw in hiddenWidgets" :key="hw.key" type="button"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-dashed border-gray-300 text-gray-600 hover:border-primary hover:text-primary transition-colors"
        @click="addWidget(hw.key)">
        <i class="pi pi-plus text-[10px]" />{{ defById[hw.key].label }}
      </button>
    </div>

    <GridLayout
      :layout="displayLayout" @update:layout="v => { if (!isNarrow) layout = v }"
      :col-num="12" :row-height="56" :margin="[16, 16]"
      :is-draggable="editable && editing && !isNarrow" :is-resizable="editable && editing && !isNarrow"
      :is-bounded="false" :vertical-compact="true" :use-css-transforms="true"
      :style="{ marginLeft: '-16px', marginRight: '-16px' }"
      :class="editable && editing ? 'is-editing' : ''">
      <GridItem v-for="item in displayLayout" :key="item.i"
        :i="item.i" :x="item.x" :y="item.y" :w="item.w" :h="item.h" :min-w="item.minW" :min-h="item.minH"
        :static="item.i === 'notes'">
        <div class="relative h-full w-full overflow-hidden rounded-xl"
          :class="editable && editing ? (selectedKey === item.i ? 'ring-2 ring-primary' : 'ring-2 ring-primary/20') : ''">
          <!-- edit controls -->
          <div v-if="editable && editing" class="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
            <button v-if="defById[item.i].configurable" type="button"
              class="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-primary"
              title="Configure" @click="selectedKey = selectedKey === item.i ? null : item.i">
              <i class="pi pi-cog text-xs" />
            </button>
            <button v-if="item.i !== 'notes'" type="button"
              class="w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500"
              title="Hide widget" @click="removeWidget(item.i)">
              <i class="pi pi-times text-xs" />
            </button>
          </div>

          <div class="h-full w-full overflow-auto" :class="editable && editing ? 'pointer-events-none select-none' : ''">

            <!-- IDENTITY -->
            <div v-if="item.i === 'identity'" class="card h-full p-5 flex flex-col items-center text-center">
              <div class="w-24 h-24 rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center text-2xl font-semibold mb-3 shrink-0">
                <img v-if="person.photo_url" :src="person.photo_url" class="w-full h-full object-cover" />
                <span v-else>{{ initials }}</span>
              </div>
              <p class="font-semibold text-gray-900">{{ person.first_name }} {{ person.last_name }}</p>
              <div class="mt-4 w-full space-y-3 text-left">
                <div v-for="k in visibleFields('identity')" :key="k">
                  <p class="text-xs font-semibold text-gray-700">{{ labelFor(k) }}</p>
                  <p class="text-sm text-gray-600">{{ fmtValue(person, k) }}</p>
                </div>
              </div>
            </div>

            <!-- FLAGS -->
            <div v-else-if="item.i === 'flags'" class="card h-full p-5">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Flags</p>
              <div v-if="!visibleFields('flags').length" class="text-sm text-gray-400">Configure which fields appear here.</div>
              <ul v-else class="space-y-2.5">
                <li v-for="k in visibleFields('flags')" :key="k" class="flex items-center gap-2 text-sm"
                  :class="isTruthy(person, k) ? 'text-gray-800' : 'text-gray-300'">
                  <i class="pi pi-bolt text-xs" :class="isTruthy(person, k) ? 'text-amber-500' : 'text-gray-300'" />
                  <span>{{ labelFor(k) }}<span v-if="fieldByKey[k]?.field_type !== 'checkbox' && isTruthy(person, k)" class="text-gray-500">: {{ fmtValue(person, k) }}</span></span>
                </li>
              </ul>
            </div>

            <!-- ALERT -->
            <div v-else-if="item.i === 'alert'" class="h-full flex items-center">
              <div v-if="alertActive" class="w-full rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-2.5">{{ alertMessage }}</div>
              <div v-else-if="editable" class="w-full rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs px-4 py-2.5">
                Alert banner — shows when the configured field is set.
              </div>
            </div>

            <!-- INFO -->
            <AppCard v-else-if="item.i === 'info'" title="Info" class="h-full">
              <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                <div v-for="k in visibleFields('info')" :key="k" class="flex items-baseline justify-between gap-3 border-b border-gray-50 pb-2">
                  <span class="text-xs font-semibold text-gray-700 shrink-0">{{ labelFor(k) }}</span>
                  <span class="text-sm text-gray-600 text-right truncate">{{ fmtValue(person, k) }}</span>
                </div>
                <div v-if="!visibleFields('info').length" class="text-sm text-gray-400">Configure which fields appear here.</div>
              </div>
            </AppCard>

            <!-- MEMBERSHIP -->
            <AppCard v-else-if="item.i === 'membership'" title="Membership" class="h-full">
              <div class="p-4">
                <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead><tr class="text-left text-xs text-gray-400"><th class="font-semibold pb-2">Group</th><th class="font-semibold pb-2">Role</th><th class="font-semibold pb-2">Expiry</th></tr></thead>
                  <tbody>
                    <tr v-for="(m, i) in (data.memberships || [])" :key="i" class="border-t border-gray-50">
                      <td class="py-1.5 flex items-center gap-2"><span class="w-2 h-2 rounded-full" :style="{ background: m.color || '#94a3b8' }" />{{ m.group }}</td>
                      <td class="py-1.5 text-gray-500">{{ m.role || '—' }}</td>
                      <td class="py-1.5 text-gray-500">{{ m.expiry || '—' }}</td>
                    </tr>
                    <tr v-if="!(data.memberships || []).length"><td colspan="3" class="py-3 text-gray-400 text-center">Not in any groups.</td></tr>
                  </tbody>
                </table>
                </div>
              </div>
            </AppCard>

            <!-- FINANCIALS -->
            <AppCard v-else-if="item.i === 'financials'" title="Financials" class="h-full">
              <div class="p-4">
                <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead><tr class="text-left text-xs text-gray-400"><th class="font-semibold pb-2">Invoice #</th><th class="font-semibold pb-2 text-right">Amount</th><th class="font-semibold pb-2 text-right">Status</th></tr></thead>
                  <tbody>
                    <tr v-for="(f, i) in (data.financials || [])" :key="i" class="border-t border-gray-50">
                      <td class="py-1.5">{{ f.invoice }}</td>
                      <td class="py-1.5 text-right tabular-nums">{{ f.amount }}</td>
                      <td class="py-1.5 text-right"><span class="text-[10px] uppercase px-1.5 py-0.5 rounded-full" :class="statusSeverity(f.status)">{{ titleCase(f.status || '') }}</span></td>
                    </tr>
                    <tr v-if="!(data.financials || []).length"><td colspan="3" class="py-3 text-gray-400 text-center">No invoices yet.</td></tr>
                  </tbody>
                </table>
                </div>
              </div>
            </AppCard>

            <!-- COMMUNICATION -->
            <AppCard v-else-if="item.i === 'communication'" title="Communication" class="h-full">
              <div class="p-4">
                <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead><tr class="text-left text-xs text-gray-400"><th class="font-semibold pb-2">Date</th><th class="font-semibold pb-2">Subject</th><th class="font-semibold pb-2 text-right">Status</th></tr></thead>
                  <tbody>
                    <tr v-for="(c, i) in (data.communications || [])" :key="i" class="border-t border-gray-50">
                      <td class="py-1.5 text-gray-500 whitespace-nowrap">{{ c.date }}</td>
                      <td class="py-1.5 truncate">{{ c.subject }}</td>
                      <td class="py-1.5 text-right text-gray-500">{{ titleCase(c.status || '') }}</td>
                    </tr>
                    <tr v-if="!(data.communications || []).length"><td colspan="3" class="py-3 text-gray-400 text-center">No emails yet.</td></tr>
                  </tbody>
                </table>
                </div>
              </div>
            </AppCard>

            <!-- PARENTS / CAREGIVERS -->
            <AppCard v-else-if="item.i === 'parents'" title="Parents / caregivers" class="h-full">
              <div class="p-4">
                <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead><tr class="text-left text-xs text-gray-400"><th class="font-semibold pb-2">Name</th><th class="font-semibold pb-2">Phone</th><th class="font-semibold pb-2">Email</th><th class="font-semibold pb-2">Relationship</th></tr></thead>
                  <tbody>
                    <tr v-for="(p, i) in (data.parents || [])" :key="i" class="border-t border-gray-50">
                      <td class="py-1.5">{{ p.name }}</td><td class="py-1.5 text-gray-500">{{ p.phone }}</td><td class="py-1.5 text-gray-500">{{ p.email }}</td><td class="py-1.5 text-gray-500">{{ p.relationship }}</td>
                    </tr>
                    <tr v-if="!(data.parents || []).length"><td colspan="4" class="py-3 text-gray-400 text-center">No caregivers linked yet.</td></tr>
                  </tbody>
                </table>
                </div>
              </div>
            </AppCard>

            <!-- NOTES -->
            <div v-else-if="item.i === 'notes'" class="card h-full flex flex-col overflow-hidden">
              <!-- Notes / Activity tabs -->
              <div class="flex items-center gap-1 px-3 pt-1.5 border-b border-gray-100 shrink-0">
                <button type="button" class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
                  :class="notesTab === 'notes' ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-800'"
                  @click="notesTab = 'notes'">Notes</button>
                <button type="button" class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
                  :class="notesTab === 'activity' ? 'border-[#1E2157] text-[#1E2157]' : 'border-transparent text-gray-500 hover:text-gray-800'"
                  @click="notesTab = 'activity'">Activity</button>
              </div>

              <!-- NOTES tab -->
              <div v-if="notesTab === 'notes'" class="p-4 flex flex-col flex-1 min-h-0">
                <div v-if="liveNotes" class="mb-3 space-y-2">
                  <Textarea v-model="newNoteBody" rows="2" autoResize placeholder="Add a note…" class="w-full text-sm" />
                  <div class="flex items-center gap-2">
                    <MultiSelect v-model="newNoteLinks" :options="connectOptions" optionLabel="label" dataKey="id"
                      display="chip" :showToggleAll="false" placeholder="Connect to…" class="flex-1 text-xs" filter>
                      <template #option="{ option }">
                        <span class="flex items-center gap-2"><i class="pi text-xs text-gray-400" :class="connectIcon(option.type)" />{{ option.label }}</span>
                      </template>
                    </MultiSelect>
                    <Button label="Add" size="small" :disabled="!newNoteBody.trim()" style="background:#1E2157;border-color:#1E2157" @click="submitNote" />
                  </div>
                </div>
                <div class="flex-1 overflow-auto space-y-3">
                  <div v-for="n in (data.notes || [])" :key="n.id" class="group">
                    <p class="text-sm text-gray-700">{{ n.body }}</p>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                      <span class="text-[11px] text-gray-400">{{ fmtDateTime(n.created_at) }}</span>
                      <span v-if="n.author_name" class="text-[11px] text-gray-400">· {{ n.author_name }}</span>
                      <span v-for="l in (n.links || [])" :key="l.id" class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"><i class="pi text-[9px]" :class="connectIcon(l.type)" />{{ l.label }}</span>
                      <button v-if="liveNotes" class="text-[11px] text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-auto" @click="emit('delete-note', n.id)"><i class="pi pi-trash" /></button>
                    </div>
                  </div>
                  <div v-if="!(data.notes || []).length" class="text-sm text-gray-400 text-center py-4">No notes yet.</div>
                </div>
              </div>

              <!-- ACTIVITY tab — the rich activity feed -->
              <div v-else class="flex-1 overflow-auto p-4">
                <ActivityFeed :items="data.activityFeed || []" />
              </div>
            </div>

            <!-- ACTIVITY -->
            <AppCard v-else-if="item.i === 'activity'" title="Activity" class="h-full">
              <div class="p-4">
                <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead><tr class="text-left text-xs text-gray-400"><th class="font-semibold pb-2">Event</th><th class="font-semibold pb-2">Date</th><th class="font-semibold pb-2">Status</th><th class="font-semibold pb-2 text-center">Attended</th></tr></thead>
                  <tbody>
                    <tr v-for="(a, i) in (data.activity || [])" :key="i" class="border-t border-gray-50">
                      <td class="py-1.5 font-medium text-gray-700">{{ a.title }}</td>
                      <td class="py-1.5 text-gray-500 whitespace-nowrap">{{ a.start_at ? fmtDateTime(a.start_at) : '—' }}</td>
                      <td class="py-1.5 text-gray-500">{{ titleCase(a.status || '') }}</td>
                      <td class="py-1.5 text-center"><i v-if="a.attended" class="pi pi-check-circle text-green-500" /><span v-else class="text-gray-300">—</span></td>
                    </tr>
                    <tr v-if="!(data.activity || []).length"><td colspan="4" class="py-3 text-gray-400 text-center">No activity yet.</td></tr>
                  </tbody>
                </table>
                </div>
              </div>
            </AppCard>

          </div>
        </div>
      </GridItem>
    </GridLayout>

    <!-- per-widget config panel (builder) -->
    <div v-if="editable && editing && selectedCfg && selectedDef" class="card p-4 mt-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-800">Configure: {{ selectedDef.label }}</h3>
        <button class="text-gray-400 hover:text-gray-700" @click="selectedKey = null"><i class="pi pi-times text-sm" /></button>
      </div>

      <!-- field picker -->
      <template v-if="selectedDef.configurable === 'fields'">
        <p class="text-xs text-gray-400 mb-2">Choose which fields this widget shows.</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          <label v-for="f in selectableFields(selectedDef)" :key="f.key"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer"
            :class="fieldChecked(selectedCfg, f.key) ? 'border-primary bg-primary/5 text-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'">
            <Checkbox :modelValue="fieldChecked(selectedCfg, f.key)" :binary="true" @update:modelValue="toggleField(selectedCfg, f.key)" />
            <span class="truncate">{{ f.label }}<span v-if="f.source === 'custom'" class="text-[10px] text-gray-400"> · custom</span></span>
          </label>
          <p v-if="!selectableFields(selectedDef).length" class="text-sm text-gray-400 col-span-full">No fields available.</p>
        </div>
      </template>

      <!-- alert config -->
      <template v-else-if="selectedDef.configurable === 'alert'">
        <div class="space-y-3">
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Show this banner when this field is set</label>
            <Select :modelValue="selectedCfg.settings?.flagField || null"
              :options="props.fields" optionLabel="label" optionValue="key" placeholder="Pick a field" class="w-full" showClear
              @update:modelValue="v => { ensureSettings(selectedCfg); selectedCfg.settings.flagField = v }" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Banner message</label>
            <InputText :modelValue="selectedCfg.settings?.message || ''" class="w-full" placeholder="e.g. This member has outstanding payments."
              @update:modelValue="v => { ensureSettings(selectedCfg); selectedCfg.settings.message = v }" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.is-editing :deep(.vgl-item) { cursor: grab; }
.is-editing :deep(.vgl-item--resizing),
.is-editing :deep(.vgl-item--dragging) { cursor: grabbing; z-index: 30; }
:deep(.vgl-item__resizer) { z-index: 20; }
</style>
