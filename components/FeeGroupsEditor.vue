<template>
  <div class="space-y-4">

    <!-- Master inherit -->
    <div v-if="masterFeesConfig" class="flex justify-end">
      <button type="button"
        class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors"
        :class="differsFromMaster ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'"
        @click="pullFromMaster">
        <i class="pi pi-crown text-[9px] mr-0.5" />Pull from master
      </button>
    </div>

    <!-- Top-level questions -->
    <div class="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">

      <!-- Are people charged? -->
      <div class="flex items-center justify-between px-4 py-3">
        <span class="text-sm font-medium text-gray-800">Are people charged for this {{ context ?? 'session' }}?</span>
        <YesNoToggle :value="modelValue.is_charged" @update="v => emit('update:modelValue', { ...modelValue, is_charged: v })" />
      </div>

      <template v-if="modelValue.is_charged">
        <!-- Are all charged equally? -->
        <div class="flex items-center justify-between px-4 py-3">
          <span class="text-sm font-medium text-gray-800">Are all people charged equally?</span>
          <YesNoToggle :value="modelValue.all_charged_equally" @update="v => emit('update:modelValue', { ...modelValue, all_charged_equally: v })" />
        </div>

        <!-- Equal fee table -->
        <div v-if="modelValue.all_charged_equally" class="px-4 py-4 bg-gray-50/60">
          <FeeLineItemsTable
            :model-value="modelValue.base_fees"
            @update:model-value="v => emit('update:modelValue', { ...modelValue, base_fees: v })" />
        </div>
      </template>

    </div>

    <!-- Fee groups (per person type) -->
    <template v-if="modelValue.is_charged && !modelValue.all_charged_equally">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-900">Fee Groups</h3>
            <p class="text-xs text-gray-500 mt-0.5">Set different fees per person type</p>
          </div>
          <Button label="Add Group" icon="pi pi-plus" size="small" @click="addGroup" style="background:#1E2157;border-color:#1E2157" />
        </div>

        <div v-if="!modelValue.groups?.length" class="py-10 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
          <i class="pi pi-users text-2xl mb-2 block text-gray-300" />
          No fee groups — click "Add Group" to create one
        </div>

        <div v-for="(group, gIdx) in modelValue.groups" :key="group.id"
          class="bg-white border border-gray-200 rounded-xl overflow-hidden">

          <!-- Group header -->
          <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
            <Select
              :model-value="group.person_type"
              :options="PERSON_TYPES"
              option-label="label"
              option-value="value"
              size="small"
              placeholder="Select person type…"
              class="w-48"
              @update:model-value="v => updateGroup(gIdx, 'person_type', v)" />
            <div class="flex-1" />
            <button type="button"
              class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              @click="removeGroup(gIdx)">
              <i class="pi pi-times text-xs" />
            </button>
          </div>

          <!-- Fee table -->
          <div class="px-4 py-3">
            <FeeLineItemsTable
              :model-value="group.fees"
              @update:model-value="v => updateGroup(gIdx, 'fees', v)" />
          </div>

        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import type { SessionFeesConfig, PersonTypeFeeGroup } from '~/composables/useFeeGroups'
import { PERSON_TYPES } from '~/composables/useFeeGroups'

const props = defineProps<{
  modelValue: SessionFeesConfig
  context?: string
  masterFeesConfig?: SessionFeesConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [SessionFeesConfig]
}>()

function addGroup() {
  const newGroup: PersonTypeFeeGroup = { id: crypto.randomUUID(), person_type: '', fees: [] }
  emit('update:modelValue', { ...props.modelValue, groups: [...(props.modelValue.groups ?? []), newGroup] })
}

function removeGroup(idx: number) {
  const groups = [...props.modelValue.groups]
  groups.splice(idx, 1)
  emit('update:modelValue', { ...props.modelValue, groups })
}

function updateGroup(idx: number, field: keyof PersonTypeFeeGroup, value: any) {
  const groups = props.modelValue.groups.map((g, i) => i === idx ? { ...g, [field]: value } : g)
  emit('update:modelValue', { ...props.modelValue, groups })
}

const differsFromMaster = computed(() => {
  if (!props.masterFeesConfig) return false
  return JSON.stringify(props.modelValue) !== JSON.stringify(props.masterFeesConfig)
})

function pullFromMaster() {
  if (props.masterFeesConfig) {
    emit('update:modelValue', JSON.parse(JSON.stringify(props.masterFeesConfig)))
  }
}
</script>
