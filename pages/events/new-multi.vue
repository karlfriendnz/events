<template>
  <WizardShell
    v-model="step"
    :steps="WIZARD_STEPS"
    :title="wizardTitle"
    :can-next="canNext"
    :saving="saving"
    :full-bleed="step === 3"
    finish-label="Create programme"
    @finish="createEvent"
    @close="navigateTo('/events')">

    <!-- ── Live summary rail ── -->
    <template #summary>
      <div class="p-5 space-y-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Programme</p>
          <p class="text-lg font-semibold mt-1" :class="form.title.trim() ? 'text-gray-900' : 'text-gray-400'">
            {{ form.title.trim() || 'Untitled programme' }}
          </p>
        </div>

        <div class="border-t border-gray-100 pt-3 space-y-3">
          <div class="flex items-start gap-2">
            <i class="pi pi-calendar text-xs mt-1 shrink-0" :class="form.startDate ? 'text-primary' : 'text-gray-300'" />
            <div class="min-w-0">
              <p class="text-sm" :class="form.startDate ? 'text-gray-800' : 'text-gray-400'">{{ summaryWhen }}</p>
              <p v-if="form.exdates.length" class="text-xs text-red-500 mt-0.5">{{ form.exdates.length }} date{{ form.exdates.length !== 1 ? 's' : '' }} skipped</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <i class="pi pi-clock text-xs mt-1 shrink-0" :class="sessionDays.length ? 'text-primary' : 'text-gray-300'" />
            <p class="text-sm" :class="sessionDays.length ? 'text-gray-800' : 'text-gray-400'">
              {{ sessionDays.length ? `${sessionDays.length} day${sessionDays.length !== 1 ? 's' : ''} in the programme` : 'No days yet' }}
            </p>
          </div>
          <div class="flex items-start gap-2">
            <i class="pi pi-user-plus text-xs mt-1 shrink-0" :class="form.regOpen ? 'text-primary' : 'text-gray-300'" />
            <p class="text-sm" :class="form.regOpen ? 'text-gray-800' : 'text-gray-400'">{{ summarySignup }}</p>
          </div>
        </div>

        <div class="border-t border-gray-100 pt-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Sessions per day</p>
          <div v-if="namedTemplates.length" class="space-y-1.5">
            <div v-for="t in namedTemplates" :key="t.name" class="flex items-center justify-between gap-2 text-sm">
              <span class="text-gray-800 truncate">{{ t.name }}</span>
              <span class="text-xs text-gray-400 shrink-0">{{ fmtTimeShort(t.startTime) }}–{{ fmtTimeShort(t.endTime) }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 text-xs font-semibold text-gray-800 mt-1 pt-2 border-t border-gray-100">
              <span>Total sessions</span><span>{{ totalSessions }}</span>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400">No session templates yet</p>
        </div>
      </div>
    </template>

    <!-- ── Step 1 · Event details ── -->
    <div v-show="step === 0" class="space-y-6">

        <!-- Event Details -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 class="text-sm font-semibold text-gray-700">Event Details</h2>
          </div>
          <div class="px-5 py-4 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-center gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700">Event Name <span class="text-red-400">*</span></label>
              <InputText v-model="form.title" placeholder="e.g. Easter Holiday Programme" class="w-full" autofocus />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-center gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700">Age Limit</label>
              <div class="flex items-center gap-2">
                <InputNumber v-model="form.ageMin" :min="0" :max="120" placeholder="Min" class="w-24" inputClass="w-24" />
                <span class="text-sm text-gray-400">to</span>
                <InputNumber v-model="form.ageMax" :min="0" :max="120" placeholder="Max" class="w-24" inputClass="w-24" />
                <span class="text-sm text-gray-500">years</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dates -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 class="text-sm font-semibold text-gray-700">Dates</h2>
          </div>
          <div class="px-5 py-4 space-y-4">
            <!-- Programme date range — same layout as the event wizard's date rows -->
            <DateTimeEditor
              v-model:startDate="form.startDate"
              v-model:endDate="form.endDate"
              :start-time="null"
              :end-time="null"
              :show-time="false"
              :show-all-day="false"
              :show-repeat="false"
              :min-start-date="today"
              :min-end-date="form.startDate ?? today"
              label="Programme dates"
              required
              label-width="w-[160px]"
              row-padding="px-0 py-2" />
            <!-- Weekends / public holidays: their own rows below the dates -->
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-center gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700">Weekends</label>
              <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <Checkbox v-model="form.includeWeekends" :binary="true" />
                Include weekends
              </label>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-center gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700">Public holidays</label>
              <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <Checkbox v-model="form.excludePublicHolidays" :binary="true" />
                Exclude public holidays
              </label>
            </div>
            <!-- Skip specific dates — same design as the event wizard (RecurrenceExclusions) -->
            <div class="grid grid-cols-1 sm:grid-cols-[160px_1fr] sm:items-start gap-1.5 sm:gap-4">
              <label class="text-sm font-medium text-gray-700 sm:pt-2">Skip dates</label>
              <div class="min-w-0 space-y-2">
                <button type="button"
                  class="inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition-colors disabled:opacity-50"
                  :class="form.exdates.length ? 'border-primary/40 bg-primary/5 text-primary' : 'border-gray-300 text-gray-600 hover:border-gray-400'"
                  :disabled="!form.startDate || !form.endDate"
                  @click="skipDatesOpen = true">
                  <i class="pi pi-calendar-times text-xs" />
                  {{ form.exdates.length ? `${form.exdates.length} skipped` : 'Skip dates' }}
                </button>
                <div v-if="form.exdates.length" class="flex flex-wrap items-center gap-1">
                  <span class="text-[11px] text-gray-500 mr-1">Skipped:</span>
                  <span v-for="key in sortedExdates" :key="key"
                    class="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-600 rounded-full pl-2 pr-1 py-0.5">
                    {{ formatSkipDate(key) }}
                    <button type="button" class="hover:text-red-500" @click="form.exdates = form.exdates.filter(k => k !== key)"><i class="pi pi-times text-[9px]" /></button>
                  </span>
                  <button type="button" class="text-[11px] text-gray-400 hover:text-gray-700 ml-1" @click="form.exdates = []">Clear all</button>
                </div>
              </div>
            </div>
            <!-- Day count preview -->
            <div v-if="sessionDays.length > 0" class="grid grid-cols-[160px_1fr] items-center gap-4">
              <div />
              <p class="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <i class="pi pi-calendar-clock mr-1.5" />
                <strong>{{ sessionDays.length }}</strong> day{{ sessionDays.length !== 1 ? 's' : '' }} in programme
                <span v-if="!form.includeWeekends" class="text-green-600"> (weekdays only)</span>
                <span v-if="form.excludePublicHolidays" class="text-green-600"> (excl. public holidays)</span>
              </p>
            </div>
            <!-- Signup open / close — same layout as the wizard's sign-up window -->
            <DateTimeEditor
              v-model:startDate="regOpenDate"
              v-model:startTime="regOpenTime"
              v-model:endDate="regCloseDate"
              v-model:endTime="regCloseTime"
              :show-all-day="false"
              :show-repeat="false"
              :min-start-date="today"
              :min-end-date="regOpenDate ?? today"
              label="Signup dates"
              start-label="Opens"
              end-label="Closes"
              label-width="w-[160px]"
              row-padding="px-0 py-2" />
          </div>
        </div>
    </div>

    <!-- ── Step 2 · Session details ── -->
    <div v-show="step === 1" class="space-y-6">

        <!-- Session Templates — each carries its own location (per daily session) -->
        <BulkSessionTemplates
          :modelValue="templates"
          :daysCount="sessionDays.length"
          show-location
          show-fees
          layout="panels"
          @update:modelValue="v => { templates.splice(0, templates.length, ...v) }" />
    </div>

    <!-- ── Step 3 · Discounts (the shared <EventDiscountDialog> system) ── -->
    <div v-show="step === 2" class="space-y-6">
      <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-gray-700">Discounts</p>
            <p class="text-xs text-gray-500 mt-0.5">Early bird, members only, siblings, promo codes — set who qualifies. Optional.</p>
          </div>
          <Button label="Add discount" icon="pi pi-plus" size="small" severity="secondary" outlined @click="openDiscount" />
        </div>
        <div v-if="!form.discounts.length" class="text-center py-6 text-sm text-gray-400">
          No discounts — everyone pays the full session fee.
        </div>
        <div v-else class="space-y-2">
          <div v-for="(d, idx) in form.discounts" :key="d.id"
            class="border border-gray-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-semibold text-gray-800">{{ d.name || 'Untitled discount' }}</span>
                <span class="shrink-0 font-semibold text-primary text-sm">{{ discountAmountLabel(d) }}</span>
              </div>
              <div class="flex flex-wrap gap-1 mt-1.5">
                <span v-for="(c, ci) in d.conditions.filter(x => x.key)" :key="ci"
                  class="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-primary/8 text-primary">{{ conditionLabel(c) }}</span>
                <span v-if="!d.conditions.filter(x => x.key).length" class="text-xs text-gray-400 italic">Always applied</span>
              </div>
              <p class="text-xs text-gray-500 mt-1.5">{{ discountSummary(d) }}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <Button icon="pi pi-pencil" text size="small" severity="secondary" @click="editDiscount(idx)" />
              <Button icon="pi pi-trash" text size="small" severity="danger" @click="form.discounts.splice(idx, 1)" />
            </div>
          </div>
        </div>
      </div>

      <!-- One-discount-only setting (same as the advanced editor) -->
      <div class="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3.5">
        <div>
          <p class="text-sm font-medium text-gray-700">Limit to one discount per registration</p>
          <p class="text-xs text-gray-400 mt-0.5">When multiple rules match, only the best discount is applied.</p>
        </div>
        <ToggleSwitch v-model="discountSettings.one_discount_only" />
      </div>
    </div>

    <!-- ── Step 4 · Registration form (the shared <FormDesigner>) ── -->
    <!-- FormDesigner uses an absolutely-positioned two-panel layout, so it needs a
         DEFINITE height or it collapses to nothing. The WizardShell wraps steps in a
         padded max-width scroll block, so give this step a real height + cancel that
         padding so the designer fills the body edge-to-edge. -->
    <div v-show="step === 3" class="flex-1 min-h-0 flex flex-col rounded-xl border border-gray-200 overflow-hidden bg-white">
      <div v-if="!draftEventId" class="flex-1 flex items-center justify-center text-sm text-gray-400">
        Preparing the form…
      </div>
      <FormDesigner v-else :event-id="draftEventId" :org-id="orgId"
        :sessions="wizardSessions" :fee-line-items="wizardFeeLineItems" :discounts="form.discounts"
        :discount-settings="discountSettings" :age-min="form.ageMin" :age-max="form.ageMax"
        embedded class="flex flex-col flex-1 min-h-0" />
    </div>

    <!-- ── Step 5 · Summary ── -->
    <div v-show="step === 4" class="space-y-6">
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 class="text-sm font-semibold text-gray-700">Review your programme</h2>
        </div>
        <div class="p-5 space-y-5">
          <div>
            <p class="text-lg font-semibold text-gray-900">{{ form.title.trim() || 'Untitled programme' }}</p>
            <p class="text-sm text-gray-500 mt-0.5">
              {{ summaryWhen }} · {{ sessionDays.length }} day{{ sessionDays.length !== 1 ? 's' : '' }}<span v-if="form.exdates.length"> ({{ form.exdates.length }} skipped)</span>
            </p>
            <p class="text-sm text-gray-500">{{ summarySignup }}</p>
          </div>

          <div class="border-t border-gray-100 pt-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Sessions per day</p>
            <div class="space-y-1.5">
              <div v-for="t in namedTemplates" :key="t.name" class="flex items-center justify-between gap-3 text-sm">
                <span class="text-gray-800 truncate">{{ t.name }}</span>
                <span class="text-gray-500 shrink-0">{{ fmtTimeShort(t.startTime) }}–{{ fmtTimeShort(t.endTime) }} · {{ feeLabel(t.fees) }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between gap-3 text-sm font-semibold text-gray-800 mt-2 pt-2 border-t border-gray-100">
              <span>Total sessions to create</span><span>{{ totalSessions }}</span>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Discounts</p>
            <div v-if="form.discounts.length" class="space-y-1.5">
              <div v-for="d in form.discounts" :key="d.id" class="flex items-center justify-between gap-3 text-sm">
                <span class="text-gray-800 truncate">{{ d.name || 'Untitled discount' }}</span>
                <span class="text-primary font-medium shrink-0">{{ discountAmountLabel(d) }}</span>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">No discounts</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Shared event-discount modal (template picker → rule editor) -->
    <EventDiscountDialog v-model:visible="discountFlowOpen" :edit="discountEditDraft" :currency-symbol="currencySymbol" @save="onDiscountSave" />

    <!-- Skip-dates calendar (opened from the Programme dates on step 1; teleports) -->
    <Dialog v-model:visible="skipDatesOpen" modal header="Skip dates" :style="{ width: '95vw', maxWidth: '480px' }" :pt="{ content: { class: 'p-4' } }">
      <RecurrenceExclusions
        :model-value="form.exdates"
        :rrule="dailyRule"
        :base-date="form.startDate"
        :range-end="form.endDate"
        @update:model-value="(v: string[]) => form.exdates = v" />
      <template #footer>
        <Button label="Done" size="small" @click="skipDatesOpen = false" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>
  </WizardShell>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { ref, reactive, computed } from 'vue'

import type { LocationEntry } from '~/composables/useLocation'
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { makeDiscountDraft, defaultProgrammeDiscounts, type DiscountDraft } from '~/composables/useEventDiscounts'

const db = useDb()
const route = useRoute()
const toast = useToast()

const saving = ref(false)

// An event can't be in the past — the programme can't start before today.
const today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()

// A draft event is created on open so the shared <FormDesigner> (same builder as
// the other wizards) has an id to bind to; createEvent UPDATES it at the end.
const draftEventId = ref<string | null>(null)
async function ensureDraft() {
  if (draftEventId.value) return
  const { data } = await (db.from as any)('events').insert({
    org_id: orgId.value,
    style: 'ADVANCED',
    created_via: 'multi',
    status: 'DRAFT',
    is_programme: route.query.programme === '1',
    title: (route.query.name as string)?.trim() || 'Untitled programme',
  }).select('id').single()
  draftEventId.value = data?.id ?? null
}

// Parse optional date from calendar click
function parseDateParam(p: string | null) {
  if (!p) return null
  const d = new Date(p)
  return isNaN(d.getTime()) ? null : d
}

const NZ_PUBLIC_HOLIDAYS_2025_2026 = [
  '2025-04-18','2025-04-19','2025-04-20','2025-04-21','2025-04-25',
  '2025-06-02','2025-10-27','2025-12-25','2025-12-26',
  '2026-01-01','2026-01-02','2026-02-06','2026-04-03','2026-04-04',
  '2026-04-05','2026-04-06','2026-04-27','2026-06-01','2026-10-26',
  '2026-12-25','2026-12-26',
]

const form = reactive({
  title: (route.query.name as string) ?? '',
  ageMin: null as number | null,
  ageMax: null as number | null,
  startDate: parseDateParam(route.query.date as string ?? null),
  endDate: parseDateParam(route.query.endDate as string ?? null),
  includeWeekends: false,
  excludePublicHolidays: true,
  exdates: [] as string[],           // YYYY-MM-DD, same model as the wizard's Skip-dates
  regOpen: null as Date | null,
  regClose: null as Date | null,
  // Holiday-programme default discounts (Full day / Full week) — pre-seeded so the
  // club just adjusts the amount or removes them.
  discounts: defaultProgrammeDiscounts().map(d => ({ ...makeDiscountDraft(), ...d, id: crypto.randomUUID() })) as WizardDiscount[],
})

// Local Y-M-D so a skipped date matches the loop day regardless of timezone.
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const excludedYmd = computed(() => new Set(form.exdates))
// A daily rule across the range so <RecurrenceExclusions> treats every programme
// day as a skippable occurrence (the calendar the event wizard uses).
const dailyRule = 'FREQ=DAILY'
const skipDatesOpen = ref(false)
const sortedExdates = computed(() => [...form.exdates].sort())
// A skipped-date chip reads "24th Jul 2026" (ordinal day + short month + year).
function ordinalDay(n: number) {
  const v = n % 100
  const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}
function formatSkipDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return `${ordinalDay(d)} ${new Date(y, m - 1, d).toLocaleDateString('en-AU', { month: 'short' })} ${y}`
}

// <DateTimeEditor> models date + time separately; the sign-up window is stored
// as two single date-times. Split on read, merge on write (same as the wizard).
function withDate(base: Date | null, d: Date | null): Date | null {
  if (!d) return null
  const out = base ? new Date(base) : new Date(d)
  out.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
  if (!base) out.setHours(0, 0, 0, 0)
  return out
}
function withTime(base: Date | null, t: Date | null): Date | null {
  if (!t) return null
  const out = base ? new Date(base) : new Date()
  out.setHours(t.getHours(), t.getMinutes(), 0, 0)
  return out
}
function combineDT(date: Date | null, time: Date | null): Date | null {
  if (!date) return null
  const out = new Date(date)
  if (time) out.setHours(time.getHours(), time.getMinutes(), 0, 0)
  else out.setHours(0, 0, 0, 0)
  return out
}
const regOpenDate = computed({ get: () => form.regOpen, set: (v: Date | null) => { form.regOpen = withDate(form.regOpen, v) } })
const regOpenTime = computed({ get: () => form.regOpen, set: (v: Date | null) => { form.regOpen = withTime(form.regOpen, v) } })
const regCloseDate = computed({ get: () => form.regClose, set: (v: Date | null) => { form.regClose = withDate(form.regClose, v) } })
const regCloseTime = computed({ get: () => form.regClose, set: (v: Date | null) => { form.regClose = withTime(form.regClose, v) } })

function makeTime(h: number, m = 0) {
  const d = new Date(); d.setHours(h, m, 0, 0); return d
}
function emptyLoc(): LocationEntry {
  return { type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] }
}

const templates = reactive([
  { name: 'Morning',   cost: null as number | null, startTime: makeTime(9),  endTime: makeTime(12), limit: null as number | null, location: [emptyLoc()] as LocationEntry[], fees: [] as FeeLineItem[] },
  { name: 'Afternoon', cost: null as number | null, startTime: makeTime(13), endTime: makeTime(17), limit: null as number | null, location: [emptyLoc()] as LocationEntry[], fees: [] as FeeLineItem[] },
])

// Compute all days in the programme range
const sessionDays = computed(() => {
  if (!form.startDate || !form.endDate) return []
  const days: Date[] = []
  const cur = new Date(form.startDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(form.endDate)
  end.setHours(23, 59, 59, 999)
  while (cur <= end) {
    const dow = cur.getDay()
    const iso = cur.toISOString().slice(0, 10)
    const isWeekend = dow === 0 || dow === 6
    const isHoliday = form.excludePublicHolidays && NZ_PUBLIC_HOLIDAYS_2025_2026.includes(iso)
    const isExcluded = excludedYmd.value.has(ymd(cur))
    if (!isExcluded && !isHoliday && (form.includeWeekends || !isWeekend)) days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
})

const namedTemplates = computed(() => templates.filter(t => t.name.trim()))

const totalSessions = computed(() => sessionDays.value.length * namedTemplates.value.length)

// ── Context fed to the embedded <FormDesigner> so the builder reflects the
//    programme being defined (session view / fees / discounts). Sessions are
//    SYNTHETIC previews (deterministic ids) — per-session persistence against the
//    real rows created at Finish is a follow-up (Karl: preview-only for now). ──
const wizardSessions = computed(() => {
  const out: any[] = []
  namedTemplates.value.forEach((tpl, ti) => {
    // The template's fee line items → the shape the builder's session-fee logic reads.
    const feeItems = (tpl.fees ?? []).filter(f => (f.amount ?? 0) > 0 || (f.name ?? '').trim())
    const feesConfig = feeItems.length
      ? { is_charged: true, all_charged_equally: true, base_fees: feeItems.map(f => ({ name: f.name || tpl.name, xero_code: f.xero_code ?? '', amount: f.amount ?? 0 })), groups: [] }
      : { is_charged: false, all_charged_equally: true, base_fees: [], groups: [] }
    sessionDays.value.forEach((day, di) => {
      out.push({
        id: `prev:${ti}:${di}`,
        title: tpl.name,
        start_at: combineDT(day, tpl.startTime)?.toISOString() ?? null,
        end_at: combineDT(day, tpl.endTime)?.toISOString() ?? null,
        capacity_max: tpl.limit ?? null,
        _feesConfig: feesConfig,
      })
    })
  })
  return out
})
const wizardFeeLineItems = computed(() => namedTemplates.value.flatMap(tpl => tpl.fees ?? []))

// After the real sessions exist, rewrite the form config's session-id keys
// (config.sessions + config.subjectSessions) from synthetic preview ids to real ones.
async function remapFormSessionIds(evtId: string, map: Record<string, string>) {
  if (!Object.keys(map).length) return
  const { data: ev } = await (db.from as any)('events').select('form_id').eq('id', evtId).maybeSingle()
  const formId = ev?.form_id
  if (!formId) return
  const { data: fr } = await (db.from as any)('registration_forms').select('config').eq('id', formId).maybeSingle()
  const cfg = fr?.config
  if (!cfg || typeof cfg !== 'object') return
  const remapInner = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    for (const k of Object.keys(obj)) {
      const inner = obj[k]
      if (inner && typeof inner === 'object') {
        const next: any = {}
        for (const sid of Object.keys(inner)) next[map[sid] ?? sid] = inner[sid]
        obj[k] = next
      }
    }
  }
  remapInner(cfg.sessions)                                  // { groupId: { sessionId: mode } }
  if (cfg.subjectSessions) for (const gid of Object.keys(cfg.subjectSessions)) remapInner(cfg.subjectSessions[gid])
  await (db.from as any)('registration_forms').update({ config: cfg }).eq('id', formId)
}

const canCreate = computed(() =>
  form.title.trim() !== '' &&
  form.startDate !== null &&
  form.endDate !== null &&
  sessionDays.value.length > 0 &&
  namedTemplates.value.length > 0
)

// ── Wizard chrome (shared <WizardShell>) ──
const step = ref(0)
const WIZARD_STEPS = [
  { key: 'details', label: 'Event details' },
  { key: 'sessions', label: 'Session details' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'form', label: 'Registration form' },
  { key: 'summary', label: 'Summary' },
]
const wizardTitle = computed(() => form.title.trim() || 'New programme')
const canNext = computed(() => {
  if (step.value === 0) return !!form.title.trim() && !!form.startDate && !!form.endDate
  if (step.value === 1) return namedTemplates.value.length > 0 && sessionDays.value.length > 0
  if (step.value === 2) return true               // discounts optional
  if (step.value === 3) return true               // registration form optional
  return canCreate.value                          // summary → Create
})

// ── Discounts — the SAME shared <EventDiscountDialog> + useEventDiscounts as
//    the event wizard / advanced editor. Rows persist to `discounts` at create. ──
type WizardDiscount = DiscountDraft & { id: string }
const toIsoDate = (d: Date) => new Date(d).toISOString().slice(0, 10)
const { conditionLabel } = useEventDiscounts()
// Best-discount-only policy — ON by default; persisted into the form config by
// <FormDesigner> (shared reactive), same as the advanced editor.
const discountSettings = reactive({ one_discount_only: true })
const discountFlowOpen = ref(false)
const discountEditIdx = ref<number | null>(null)
const discountEditDraft = ref<DiscountDraft | null>(null)

const orgCurrency = ref('NZD')
const money = (n: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: orgCurrency.value || 'NZD' }).format(n)
const currencySymbol = computed(() => {
  const parts = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: orgCurrency.value || 'NZD' }).formatToParts(0)
  return parts.find(p => p.type === 'currency')?.value ?? '$'
})
onMounted(async () => {
  await ensureDraft()
  const { data } = await (db.from as any)('organisations').select('currency').eq('id', orgId.value).maybeSingle()
  if (data?.currency) orgCurrency.value = data.currency
})

function openDiscount() {
  discountEditIdx.value = null
  discountEditDraft.value = null
  discountFlowOpen.value = true
}
function editDiscount(idx: number) {
  discountEditIdx.value = idx
  discountEditDraft.value = JSON.parse(JSON.stringify(form.discounts[idx]))
  discountFlowOpen.value = true
}
function onDiscountSave(draft: DiscountDraft) {
  if (discountEditIdx.value !== null) {
    const keepId = form.discounts[discountEditIdx.value].id
    form.discounts.splice(discountEditIdx.value, 1, { id: keepId, ...draft })
  } else {
    form.discounts.push({ id: crypto.randomUUID(), ...draft })
  }
  discountEditIdx.value = null
  discountEditDraft.value = null
}
function discountAmountLabel(d: WizardDiscount) {
  const v = d.modifier_value ?? 0
  if (d.modifier_type === 'REPLACE') return `${money(v)}`
  return d.modifier_type === 'PERCENT' ? `${v}% off` : `${money(v)} off`
}
function discountSummary(d: WizardDiscount) {
  const conds = d.conditions.filter(c => c.key).length
  return conds
    ? `Applies to anyone matching ${conds} ${conds === 1 ? 'condition' : 'conditions'}.`
    : 'Applies to everyone.'
}
function feeLabel(fees?: FeeLineItem[]) {
  const total = (fees ?? []).reduce((s, f) => s + (f.amount ?? 0), 0)
  return total > 0 ? money(total) : 'Free'
}

// ── Live summary rail (right side of the wizard) ──
const fmtDay = (d: Date | null, withYear = false) =>
  d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }) : '—'
const fmtTimeShort = (d: Date | null) =>
  d ? d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : ''
const summaryWhen = computed(() => {
  if (!form.startDate) return 'Set the programme dates'
  return `${fmtDay(form.startDate)} – ${fmtDay(form.endDate, true)}`
})
const summarySignup = computed(() => {
  if (!form.regOpen && !form.regClose) return 'Sign-up window not set'
  return `Sign-ups ${fmtDay(form.regOpen)} → ${fmtDay(form.regClose)}`
})

function buildDatetime(day: Date, timePicker: Date | null, fallbackHour = 0): string {
  const d = new Date(day)
  if (timePicker) {
    d.setHours(timePicker.getHours(), timePicker.getMinutes(), 0, 0)
  } else {
    d.setHours(fallbackHour, 0, 0, 0)
  }
  return d.toISOString()
}

// A session's location (a single LocationEntry) → the flat session location
// columns. Sessions have no locations jsonb, so we store the flat trio.
function locationCols(l?: LocationEntry) {
  return {
    location_type: (l?.type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE',
    address: l?.type === 'ADDRESS' ? (l.address || null) : null,
    meeting_link: l?.type === 'ONLINE' ? (l.meeting_link || null) : null,
  }
}

async function createEvent() {
  if (!canCreate.value) return
  saving.value = true
  try {
    // 1. Finalise the event — UPDATE the draft made on open (never write form_id
    //    here; <FormDesigner> owns it). Fall back to an insert if there's no draft.
    await ensureDraft()
    const payload = {
      org_id: orgId.value,
      title: form.title.trim(),
      status: 'DRAFT' as const,
      start_at: combineDT(form.startDate, null)!.toISOString(),
      end_at: combineDT(form.endDate, null)!.toISOString(),
      is_public: true,
      is_programme: route.query.programme === '1',
      age_min: form.ageMin ?? null,
      age_max: form.ageMax ?? null,
      // Auto-tagged from a named calendar's sole category (?category=…) when created there.
      ...(route.query.category ? { category_id: route.query.category as string } : {}),
      // Event-level location = the first session's location (each session carries its own).
      locations: namedTemplates.value[0]?.location ?? [emptyLoc()],
      ...locationCols(namedTemplates.value[0]?.location?.[0]),
    }
    let evtId: string
    if (draftEventId.value) {
      const { error } = await db.from('events').update(payload).eq('id', draftEventId.value)
      if (error) throw error
      evtId = draftEventId.value
    } else {
      const { data: evt, error: evtErr } = await db.from('events')
        .insert({ ...payload, style: 'ADVANCED', created_via: 'multi' }).select('id').single()
      if (evtErr || !evt?.id) throw evtErr ?? new Error('Failed to create event')
      evtId = evt.id
    }

    // 2. For each template, insert the first day as the master session, then
    //    bulk-insert the remaining days linked to that master.
    const days = sessionDays.value
    let sortOrder = 0
    // Fees live in their OWN table (fee_components), keyed to each session — never
    // a column on sessions/events. A session's fee = its template's line items.
    const feeRows: any[] = []
    const feeItemsFor = (tpl: any, sessionId: string) =>
      (tpl.fees ?? [])
        .filter((f: FeeLineItem) => (f.name ?? '').trim() || (f.amount ?? 0) > 0)
        .map((f: FeeLineItem, i: number) => ({
          session_id: sessionId,
          // Blank fee name defaults to the session name (e.g. "Morning").
          name: (f.name || '').trim() || tpl.name.trim() || 'Fee',
          amount: f.amount ?? 0,
          xero_code: f.xero_code || null,
          sort_order: i,
        }))

    // Maps the builder's synthetic preview session ids (prev:${ti}:${di}) to the
    // real rows, so any per-session form config the user set survives (remapped below).
    const synthToReal: Record<string, string> = {}

    for (let ti = 0; ti < namedTemplates.value.length; ti++) {
      const tpl = namedTemplates.value[ti]
      if (days.length === 0) continue

      // Insert day-1 as master
      const { data: master, error: masterErr } = await db.from('sessions').insert({
        event_id: evtId,
        title: tpl.name.trim(),
        start_at: buildDatetime(days[0], tpl.startTime, 9),
        end_at: buildDatetime(days[0], tpl.endTime, 17),
        capacity_max: tpl.limit ?? null,
        is_required: false,
        is_public: true,
        ...locationCols(tpl.location?.[0]),
        display_on_form: true,
        is_master: true,
        master_id: null,
        sort_order: sortOrder++,
      }).select('id').single()

      if (masterErr || !master?.id) throw masterErr ?? new Error('Failed to create master session')
      feeRows.push(...feeItemsFor(tpl, master.id))
      synthToReal[`prev:${ti}:0`] = master.id

      // Bulk-insert remaining days linked to master
      if (days.length > 1) {
        const linked = days.slice(1).map(day => ({
          event_id: evtId,
          title: tpl.name.trim(),
          start_at: buildDatetime(day, tpl.startTime, 9),
          end_at: buildDatetime(day, tpl.endTime, 17),
          capacity_max: tpl.limit ?? null,
          is_required: false,
          is_public: true,
          ...locationCols(tpl.location?.[0]),
          display_on_form: true,
          is_master: false,
          master_id: master.id,
          sort_order: sortOrder++,
        }))
        const { data: linkedRows, error: linkedErr } = await db.from('sessions').insert(linked).select('id')
        if (linkedErr) throw linkedErr
        ;(linkedRows ?? []).forEach((s: any, k: number) => {
          feeRows.push(...feeItemsFor(tpl, s.id))
          synthToReal[`prev:${ti}:${k + 1}`] = s.id   // day index k+1 (day 0 = master)
        })
      }
    }

    if (feeRows.length) await db.from('fee_components').insert(feeRows)

    // Remap the form's synthetic preview session ids → the real ids, so any
    // per-session choices the user set in the builder point at the real sessions.
    await remapFormSessionIds(evtId, synthToReal)

    // 3. Discounts — same shape + modal as the event wizard/advanced editor.
    const discountRows = form.discounts
      .filter(d => d.name.trim() && (d.modifier_value ?? 0) > 0)
      .map(d => ({
        event_id: evtId,
        type: 'CODE' as const,
        name: d.name.trim(),
        form_text: d.form_text?.trim() || null,
        is_active: d.is_active,
        modifier_value: d.modifier_value ?? 0,
        modifier_type: d.modifier_type,
        apply_to: d.apply_to,
        conditions: JSON.parse(JSON.stringify(d.conditions.filter(c => c.key))),
        expires_at: d.expires_type === 'custom' && d.expires_at ? toIsoDate(d.expires_at) : null,
      }))
    if (discountRows.length) await db.from('discounts').insert(discountRows)

    toast.add({ severity: 'success', summary: 'Event created', detail: `${days.length * namedTemplates.value.length} sessions generated`, life: 4000 })
    await navigateTo(`/events/${evtId}`)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.message ?? 'Something went wrong', life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>
