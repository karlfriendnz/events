<template>
  <div class="space-y-5">
    <!-- Details card -->
    <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

      <!-- Date row (accordion) -->
      <div>
        <div class="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors cursor-pointer"
          @click="open !== 'date' && (open = 'date')">
          <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0">Date</span>
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="text-sm" :class="dateDisplay ? 'text-gray-700' : 'text-gray-400'">{{ dateDisplay || '—' }}</span>
            <span v-if="repeatBadge"
              class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EFF6FF] text-primary border border-primary/15 shrink-0">
              <i class="pi pi-sync text-[9px]" />
              {{ repeatBadge }}
            </span>
            <span v-if="(exdates?.length ?? 0) > 0"
              v-tooltip.top="{ value: skippedTooltip, escape: false }"
              class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 shrink-0 cursor-help">
              <i class="pi pi-calendar-times text-[9px]" />
              {{ exdates!.length }} skipped
            </span>
          </div>
          <i v-if="open !== 'date'" class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 !hidden sm:!block" />
        </div>
        <div v-if="open === 'date'" class="border-t border-gray-100" @click.stop>
          <DateTimeEditor
            :startDate="startDate" :endDate="endDate"
            :startTime="startTime" :endTime="endTime"
            :isAllDay="isAllDay" :repeat="repeat"
            :exdates="exdates"
            :minStartDate="twoWeeksAgo"
            :minEndDate="startDate ?? twoWeeksAgo"
            rowPadding="px-4 sm:px-6 py-4"
            labelWidth="w-full sm:w-28"
            @update:startDate="$emit('update:startDate', $event)"
            @update:endDate="$emit('update:endDate', $event)"
            @update:startTime="$emit('update:startTime', $event)"
            @update:endTime="$emit('update:endTime', $event)"
            @update:isAllDay="$emit('update:isAllDay', $event)"
            @update:repeat="$emit('update:repeat', $event)"
            @update:exdates="$emit('update:exdates', $event)"
          />
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
            <Button label="Cancel" size="small" severity="secondary" text @click.stop="open = null" />
            <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'date'"
              @click.stop="save('date')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
        </div>
      </div>

      <!-- Sign Up row (accordion) -->
      <div>
        <div class="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors cursor-pointer"
          @click="open !== 'signup' && (open = 'signup')">
          <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0">Sign Up</span>
          <span class="text-sm flex-1" :class="signupDisplay ? 'text-gray-700' : 'text-gray-400'">{{ signupDisplay || '—' }}</span>
          <i v-if="open !== 'signup'" class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 !hidden sm:!block" />
        </div>
        <div v-if="open === 'signup'" class="border-t border-gray-100 px-4 sm:px-6 py-4 space-y-3" @click.stop>
          <div class="grid sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-medium text-gray-500">Opens</span>
              <DatePicker :modelValue="regOpenAt" showTime hourFormat="12" dateFormat="dd/mm/yy" placeholder="No open date"
                fluid class="w-full" @update:modelValue="$emit('update:regOpenAt', $event)" />
            </div>
            <div class="flex flex-col gap-1.5">
              <span class="text-xs font-medium text-gray-500">Closes</span>
              <DatePicker :modelValue="regCloseAt" showTime hourFormat="12" dateFormat="dd/mm/yy" placeholder="No close date"
                fluid class="w-full" @update:modelValue="$emit('update:regCloseAt', $event)" />
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <Button label="Cancel" size="small" severity="secondary" text @click.stop="open = null" />
            <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'signup'"
              @click.stop="save('signup')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
        </div>
      </div>

      <!-- Location row (accordion) -->
      <div v-if="showLocation">
        <div class="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors cursor-pointer"
          @click="open !== 'location' && (open = 'location')">
          <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0">Location</span>
          <span class="text-sm flex-1" :class="locationSummary ? 'text-gray-700' : 'text-gray-400'">{{ locationSummary || '—' }}</span>
          <i v-if="open !== 'location'" class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 !hidden sm:!block" />
        </div>
        <div v-if="open === 'location'" class="border-t border-gray-100 px-4 sm:pl-40 sm:pr-6 pb-5 pt-4 space-y-3" @click.stop>
          <LocationEditor
            :modelValue="locations"
            :startAt="locationStartAt"
            :endAt="locationEndAt"
            :excludeEventId="eventId"
            @update:modelValue="$emit('update:locations', $event)"
            @update:summary="locationSummary = $event" />
          <div class="flex justify-end gap-2">
            <Button label="Cancel" size="small" severity="secondary" text @click.stop="open = null" />
            <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'location'"
              @click.stop="save('location')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
        </div>
      </div>

      <!-- Category row (inline edit) -->
      <div class="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors"
        :class="open !== 'category' && 'cursor-pointer'"
        @click="open !== 'category' && (open = 'category')">
        <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0">Category</span>
        <template v-if="open === 'category'">
          <div class="flex-1 w-full flex flex-col sm:flex-row sm:items-center gap-2 min-w-0" @click.stop>
            <MultiSelect :modelValue="categoryIds" :options="categories" option-label="name" option-value="id"
              placeholder="Select categories" class="flex-1 w-full min-w-0" display="chip"
              @update:modelValue="$emit('update:categoryIds', $event)">
              <template #chip="{ value }">
                <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  :style="{ background: categories.find(c => c.id === value)?.color ?? '#1E2157' }">
                  {{ categories.find(c => c.id === value)?.name }}
                </div>
              </template>
            </MultiSelect>
            <div class="flex gap-2 justify-end shrink-0">
              <Button icon="pi pi-plus" size="small" severity="secondary" outlined v-tooltip.top="'New category'" @click.stop="$emit('new-category')" />
              <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'category'"
                @click.stop="save('category')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="flex-1 flex flex-wrap gap-1.5 min-w-0">
            <span v-if="categoryIds?.length" v-for="id in categoryIds" :key="id"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
              :style="{ background: categories.find(c => c.id === id)?.color ?? '#1E2157' }">
              {{ categories.find(c => c.id === id)?.name }}
            </span>
            <span v-else class="text-sm text-gray-400">—</span>
          </div>
          <i class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 !hidden sm:!block" />
        </template>
      </div>

      <!-- Description row (inline edit) -->
      <div class="flex flex-col sm:flex-row sm:items-start px-4 sm:px-6 py-4 gap-1 sm:gap-6 group hover:bg-gray-50/50 transition-colors"
        :class="open !== 'description' && 'cursor-pointer'"
        @click="open !== 'description' && (open = 'description')">
        <span class="text-sm font-semibold text-gray-700 w-full sm:w-28 shrink-0 sm:pt-1">Description</span>
        <template v-if="open === 'description'">
          <div class="flex-1 flex flex-col gap-3 min-w-0" @click.stop>
            <Textarea :modelValue="description" placeholder="Add a description…" auto-resize rows="3" class="w-full text-sm"
              @update:modelValue="$emit('update:description', $event)" />
            <div class="flex justify-end">
              <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'description'"
                @click.stop="save('description')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </template>
        <template v-else>
          <span class="text-sm flex-1 line-clamp-2" :class="description ? 'text-gray-700' : 'text-gray-400'">{{ description || '—' }}</span>
          <i class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 mt-1 !hidden sm:!block" />
        </template>
      </div>

    </div>

    <!-- Fees -->
    <div>
      <div class="mb-3">
        <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Base Fees</h2>
        <p class="text-xs text-gray-400 mt-0.5">Optional. Applied to everyone regardless of session. Any session-specific fees are charged on top of this.</p>
      </div>
      <div v-if="feesLoading" class="py-4 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
      <FeeLineItemsTable v-else :modelValue="feeLineItems"
        @update:modelValue="v => { $emit('update:feeLineItems', v); $emit('fees-change', v) }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { rruleToSummary } from '~/composables/useRepeatOptions'

interface Category { id: string; name: string; color?: string }
interface Location { [key: string]: any }

const props = withDefaults(defineProps<{
  startDate?: Date | null
  endDate?: Date | null
  startTime?: Date | null
  endTime?: Date | null
  isAllDay?: boolean
  repeat?: string
  exdates?: string[]
  locations?: Location[]
  categoryIds?: string[]
  categories?: Category[]
  description?: string
  feeLineItems?: FeeLineItem[]
  savingField?: string | null
  feesLoading?: boolean
  showLocation?: boolean
  regOpenAt?: Date | null
  regCloseAt?: Date | null
  eventId?: string | null
}>(), {
  startDate: null, endDate: null, startTime: null, endTime: null,
  isAllDay: false, repeat: '', locations: () => [], categoryIds: () => [],
  categories: () => [], description: '', feeLineItems: () => [],
  savingField: null, feesLoading: false, showLocation: true,
  regOpenAt: null, regCloseAt: null, eventId: null,
})

const emit = defineEmits<{
  'update:startDate': [Date | null]
  'update:endDate': [Date | null]
  'update:startTime': [Date | null]
  'update:endTime': [Date | null]
  'update:isAllDay': [boolean]
  'update:repeat': [string]
  'update:exdates': [string[]]
  'update:locations': [Location[]]
  'update:categoryIds': [string[]]
  'update:description': [string]
  'update:feeLineItems': [FeeLineItem[]]
  'update:regOpenAt': [Date | null]
  'update:regCloseAt': [Date | null]
  'save': [field: string]
  'fees-change': [FeeLineItem[]]
  'new-category': []
}>()

const open = ref<string | null>(null)
const locationSummary = ref('')

function buildDateTimeISO(date: Date | null | undefined, time: Date | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (time) { d.setHours(time.getHours(), time.getMinutes(), 0, 0) }
  else { d.setHours(0, 0, 0, 0) }
  return d.toISOString()
}

const locationStartAt = computed(() => buildDateTimeISO(props.startDate, props.startTime))
const locationEndAt = computed(() => buildDateTimeISO(props.endDate ?? props.startDate, props.endTime))

const twoWeeksAgo = new Date()
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
twoWeeksAgo.setHours(0, 0, 0, 0)

const dateDisplay = computed(() => {
  if (!props.startDate) return ''
  const fmt = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtTime = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
  let s = fmt(props.startDate)
  if (!props.isAllDay && props.startTime) s += `, ${fmtTime(props.startTime as Date)}`
  if (props.endDate || (!props.isAllDay && props.endTime)) {
    s += ' → '
    if (props.endDate && props.endDate.toDateString() !== props.startDate!.toDateString()) s += fmt(props.endDate)
    if (!props.isAllDay && props.endTime) s += `, ${fmtTime(props.endTime as Date)}`
  }
  return s
})

const repeatBadge = computed(() => {
  if (!props.repeat || props.repeat === 'NONE') return ''
  const fmtDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  return rruleToSummary(props.repeat, fmtDate).replace(/^Repeats /, '')
})

const skippedTooltip = computed(() => {
  const list = (props.exdates ?? []).slice().sort()
  if (!list.length) return ''
  return list.map(key => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  }).join('<br>')
})

const signupDisplay = computed(() => {
  const fmt = (d: Date) => d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  if (props.regOpenAt && props.regCloseAt) return `${fmt(props.regOpenAt)} → ${fmt(props.regCloseAt)}`
  if (props.regOpenAt) return `Opens ${fmt(props.regOpenAt)}`
  if (props.regCloseAt) return `Closes ${fmt(props.regCloseAt)}`
  return ''
})

function save(field: string) {
  open.value = null
  emit('save', field)
}
</script>
