<template>
  <div class="space-y-3">
    <p class="text-xs text-gray-400">
      Sellable units for this session — e.g. a table of 10, a lane, a court.
      Bookers select one or more units when registering.
    </p>

    <div v-if="modelValue.length" class="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
      <div v-for="addon in modelValue" :key="addon.id" class="bg-white">

        <!-- Collapsed header -->
        <button type="button"
          class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
          @click="toggle(addon.id)">
          <i :class="`pi pi-chevron-${expanded[addon.id] ? 'up' : 'down'} text-gray-400 text-xs shrink-0`" />
          <span class="flex-1 text-sm font-medium text-gray-800 truncate">
            {{ addon.name || 'Unnamed add-on' }}
          </span>
          <div class="flex items-center gap-3 shrink-0 text-xs text-gray-400">
            <span v-if="addon.seats_per_unit">{{ addon.seats_per_unit }} seats/unit</span>
            <span v-if="addon.qty_available != null" class="font-medium text-gray-600">{{ addon.qty_available }} available</span>
            <span class="font-semibold tabular-nums"
              :class="parseFloat(feeTotal(addon.fees)) > 0 ? 'text-gray-800' : 'text-gray-300'">
              ${{ feeTotal(addon.fees) }}
            </span>
          </div>
          <button type="button" class="text-gray-300 hover:text-red-400 transition-colors ml-1"
            @click.stop="remove(addon.id)">
            <i class="pi pi-times text-xs" />
          </button>
        </button>

        <!-- Expanded editor -->
        <div v-if="expanded[addon.id]" class="border-t border-gray-100">

          <!-- Fields -->
          <div class="px-4 py-4 space-y-3">
            <div class="flex gap-3 flex-wrap">
              <div class="flex-1 min-w-40 flex flex-col gap-1">
                <label class="text-xs font-medium text-gray-500">Name</label>
                <input :value="addon.name" type="text" placeholder="e.g. Table, Lane, Court"
                  class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 transition"
                  @input="patch(addon.id, 'name', ($event.target as HTMLInputElement).value)" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-gray-500">Qty available</label>
                <input :value="addon.qty_available ?? ''" type="number" min="1" placeholder="e.g. 15"
                  class="w-28 h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 transition"
                  @input="patch(addon.id, 'qty_available', parseInt(($event.target as HTMLInputElement).value) || null)" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-medium text-gray-500">Seats per unit <span class="font-normal text-gray-400">(optional)</span></label>
                <input :value="addon.seats_per_unit ?? ''" type="number" min="1" placeholder="e.g. 10"
                  class="w-28 h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 transition"
                  @input="patch(addon.id, 'seats_per_unit', parseInt(($event.target as HTMLInputElement).value) || null)" />
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-500">Description <span class="font-normal text-gray-400">(shown to bookers)</span></label>
              <input :value="addon.description" type="text" placeholder="e.g. Round table seating 10 guests"
                class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 transition"
                @input="patch(addon.id, 'description', ($event.target as HTMLInputElement).value)" />
            </div>
          </div>

          <!-- Fee line items -->
          <div class="border-t border-gray-100">
            <FeeLineItemsTable
              flush
              :modelValue="addon.fees"
              @update:modelValue="patch(addon.id, 'fees', $event)" />
          </div>
        </div>
      </div>
    </div>

    <button type="button"
      class="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors py-1"
      @click="add">
      <i class="pi pi-plus text-xs" />
      Add add-on
    </button>
  </div>
</template>

<script setup lang="ts">
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { feeTotal } from '~/composables/useFeeGroups'

export interface SessionAddon {
  id: string
  name: string
  description: string
  qty_available: number | null
  seats_per_unit: number | null
  fees: FeeLineItem[]
}

const props = defineProps<{ modelValue: SessionAddon[] }>()
const emit = defineEmits<{ 'update:modelValue': [SessionAddon[]] }>()

const expanded = reactive<Record<string, boolean>>({})

function toggle(id: string) { expanded[id] = !expanded[id] }

function add() {
  const id = crypto.randomUUID()
  expanded[id] = true
  emit('update:modelValue', [
    ...props.modelValue,
    { id, name: '', description: '', qty_available: null, seats_per_unit: null, fees: [] },
  ])
}

function remove(id: string) {
  delete expanded[id]
  emit('update:modelValue', props.modelValue.filter(a => a.id !== id))
}

function patch(id: string, field: keyof SessionAddon, value: any) {
  emit('update:modelValue', props.modelValue.map(a => a.id === id ? { ...a, [field]: value } : a))
}
</script>
