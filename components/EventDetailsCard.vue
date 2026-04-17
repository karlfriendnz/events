<template>
  <div class="space-y-5">
    <!-- Details card -->
    <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

      <!-- Date row (accordion) -->
      <div>
        <div class="flex items-center px-6 py-4 gap-6 group hover:bg-gray-50/50 transition-colors cursor-pointer"
          @click="open !== 'date' && (open = 'date')">
          <span class="text-sm font-semibold text-gray-700 w-28 shrink-0">Date</span>
          <span class="text-sm flex-1" :class="dateDisplay ? 'text-gray-700' : 'text-gray-400'">{{ dateDisplay || '—' }}</span>
          <i v-if="open !== 'date'" class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
        </div>
        <div v-if="open === 'date'" class="border-t border-gray-100" @click.stop>
          <DateTimeEditor
            :startDate="startDate" :endDate="endDate"
            :startTime="startTime" :endTime="endTime"
            :isAllDay="isAllDay" :repeat="repeat"
            :minStartDate="twoWeeksAgo"
            :minEndDate="startDate ?? twoWeeksAgo"
            rowPadding="px-6 py-4"
            labelWidth="w-28"
            @update:startDate="$emit('update:startDate', $event)"
            @update:endDate="$emit('update:endDate', $event)"
            @update:startTime="$emit('update:startTime', $event)"
            @update:endTime="$emit('update:endTime', $event)"
            @update:isAllDay="$emit('update:isAllDay', $event)"
            @update:repeat="$emit('update:repeat', $event)"
          />
          <div class="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
            <Button label="Cancel" size="small" severity="secondary" text @click.stop="open = null" />
            <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'date'"
              @click.stop="save('date')" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>
      </div>

      <!-- Location row (accordion) -->
      <div v-if="showLocation">
        <div class="flex items-center px-6 py-4 gap-6 group hover:bg-gray-50/50 transition-colors cursor-pointer"
          @click="open !== 'location' && (open = 'location')">
          <span class="text-sm font-semibold text-gray-700 w-28 shrink-0">Location</span>
          <span class="text-sm flex-1" :class="locationSummary ? 'text-gray-700' : 'text-gray-400'">{{ locationSummary || '—' }}</span>
          <i v-if="open !== 'location'" class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
        </div>
        <div v-if="open === 'location'" class="border-t border-gray-100 pl-40 pr-6 pb-5 pt-4 space-y-3" @click.stop>
          <LocationEditor :modelValue="locations" @update:modelValue="$emit('update:locations', $event)" @update:summary="locationSummary = $event" />
          <div class="flex justify-end gap-2">
            <Button label="Cancel" size="small" severity="secondary" text @click.stop="open = null" />
            <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'location'"
              @click.stop="save('location')" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>
      </div>

      <!-- Category row (inline) -->
      <div class="px-6 py-4 flex items-start gap-6">
        <span class="text-sm font-semibold text-gray-700 w-28 shrink-0 pt-2">Category</span>
        <div class="flex-1 flex gap-2 min-w-0">
          <MultiSelect :modelValue="categoryIds" :options="categories" option-label="name" option-value="id"
            placeholder="Select categories" class="flex-1" display="chip"
            @update:modelValue="$emit('update:categoryIds', $event)">
            <template #chip="{ value }">
              <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                :style="{ background: categories.find(c => c.id === value)?.color ?? '#1E2157' }">
                {{ categories.find(c => c.id === value)?.name }}
              </div>
            </template>
          </MultiSelect>
          <Button icon="pi pi-plus" size="small" severity="secondary" outlined v-tooltip.top="'New category'" @click="$emit('new-category')" />
        </div>
        <Button v-if="savingField !== undefined" label="Save" icon="pi pi-check" size="small"
          :loading="savingField === 'category'"
          @click="save('category')" style="background:#1E2157;border-color:#1E2157" />
      </div>

      <!-- Description row (inline) -->
      <div class="px-6 py-4 flex items-start gap-6">
        <span class="text-sm font-semibold text-gray-700 w-28 shrink-0 pt-1">Description</span>
        <div class="flex-1 flex flex-col gap-3 min-w-0">
          <Textarea :modelValue="description" placeholder="Add a description…" auto-resize rows="3" class="w-full text-sm"
            @update:modelValue="$emit('update:description', $event)" />
          <div v-if="savingField !== undefined" class="flex justify-end">
            <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'description'"
              @click="save('description')" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>
      </div>

    </div>

    <!-- Fees -->
    <div>
      <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Fees</h2>
      <div v-if="feesLoading" class="py-4 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
      <FeeLineItemsTable v-else :modelValue="feeLineItems"
        @update:modelValue="v => { $emit('update:feeLineItems', v); $emit('fees-change', v) }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeeLineItem } from '~/composables/useFeeGroups'

interface Category { id: string; name: string; color?: string }
interface Location { [key: string]: any }

const props = withDefaults(defineProps<{
  startDate?: Date | null
  endDate?: Date | null
  startTime?: Date | null
  endTime?: Date | null
  isAllDay?: boolean
  repeat?: string
  locations?: Location[]
  categoryIds?: string[]
  categories?: Category[]
  description?: string
  feeLineItems?: FeeLineItem[]
  savingField?: string | null
  feesLoading?: boolean
  showLocation?: boolean
}>(), {
  startDate: null, endDate: null, startTime: null, endTime: null,
  isAllDay: false, repeat: '', locations: () => [], categoryIds: () => [],
  categories: () => [], description: '', feeLineItems: () => [],
  savingField: null, feesLoading: false, showLocation: true,
})

const emit = defineEmits<{
  'update:startDate': [Date | null]
  'update:endDate': [Date | null]
  'update:startTime': [Date | null]
  'update:endTime': [Date | null]
  'update:isAllDay': [boolean]
  'update:repeat': [string]
  'update:locations': [Location[]]
  'update:categoryIds': [string[]]
  'update:description': [string]
  'update:feeLineItems': [FeeLineItem[]]
  'save': [field: string]
  'fees-change': [FeeLineItem[]]
  'new-category': []
}>()

const open = ref<string | null>(null)
const locationSummary = ref('')

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

function save(field: string) {
  open.value = null
  emit('save', field)
}
</script>
