<template>
  <div class="space-y-5">
    <!-- Registration type tabs -->
    <div class="flex border-b border-gray-200">
      <button
        v-for="type in modelValue" :key="type.id"
        type="button"
        class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
        :class="activeTypeId === type.id
          ? 'border-[#1E2157] text-[#1E2157]'
          : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTypeId = type.id">
        {{ type.label }}
      </button>
    </div>

    <template v-for="type in modelValue" :key="type.id">
      <div v-if="activeTypeId === type.id" class="space-y-4">

        <!-- Master inherit controls (per tab) -->
        <div v-if="masterFeeTypes" class="flex items-center justify-between">
          <div v-if="otherTypes(type).length" class="flex items-center gap-2">
            <span class="text-xs text-gray-400">Copy settings from:</span>
            <button
              v-for="other in otherTypes(type)" :key="other.id"
              type="button"
              class="text-xs text-[#1E2157] hover:underline font-medium"
              @click="copyFrom(type, other)">
              {{ other.label }}
            </button>
          </div>
          <div v-else />
          <button v-if="type._locked" type="button"
            class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0"
            @click="setLocked(type, false)">
            <i class="pi pi-lock text-[9px] mr-0.5" />Inherited from master
          </button>
          <button v-else type="button"
            class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0"
            :class="differsFromMaster(type) ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'"
            @click="pullFromMaster(type)">
            <i class="pi pi-crown text-[9px] mr-0.5" />Pull from master
          </button>
        </div>

        <!-- Copy from another type (no master) -->
        <div v-else-if="otherTypes(type).length" class="flex items-center gap-2">
          <span class="text-xs text-gray-400">Copy settings from:</span>
          <button
            v-for="other in otherTypes(type)" :key="other.id"
            type="button"
            class="text-xs text-[#1E2157] hover:underline font-medium"
            @click="copyFrom(type, other)">
            {{ other.label }}
          </button>
        </div>

        <!-- Question card -->
        <div class="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100"
          :class="{ 'opacity-50 pointer-events-none': type._locked }">

          <!-- Are [type] charged? -->
          <div class="flex items-center justify-between px-4 py-3">
            <span class="text-sm font-medium text-gray-800">Are {{ typeName(type) }}s charged for this {{ context ?? 'session' }}?</span>
            <YesNoToggle :value="type.is_charged" @update="v => update(type, 'is_charged', v)" />
          </div>

          <template v-if="type.is_charged">
            <!-- Are all charged equally? -->
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-sm font-medium text-gray-800">Are all {{ typeName(type) }}s charged equally?</span>
              <YesNoToggle :value="type.all_charged_equally" @update="v => update(type, 'all_charged_equally', v)" />
            </div>

            <!-- Equal fee table -->
            <div v-if="type.all_charged_equally" class="px-4 py-3 bg-gray-50/60">
              <FeeLineItemsTable
                :model-value="type.base_fees"
                @update:model-value="v => update(type, 'base_fees', v)" />
            </div>
          </template>
        </div>

        <!-- Fee Groups section -->
        <template v-if="type.is_charged && !type.all_charged_equally">
          <div class="space-y-3" :class="{ 'opacity-50 pointer-events-none': type._locked }">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-gray-900">Fee Groups</h3>
                <p class="text-xs text-gray-500 mt-0.5">Create different fee structures for different groups of attendees</p>
              </div>
              <Button label="Add Group" icon="pi pi-plus" size="small" @click="addGroup(type)" style="background:#1E2157;border-color:#1E2157" />
            </div>

            <div v-if="!type.groups?.length" class="py-10 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white">
              <i class="pi pi-users text-2xl mb-2 block text-gray-300" />
              No fee groups yet — click "Add Group" to create one
            </div>

            <div v-for="(group, gIdx) in type.groups" :key="group.id"
              class="bg-white border border-gray-200 rounded-xl overflow-hidden">

              <!-- Group header row -->
              <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                <InputText
                  :value="group.name"
                  placeholder="Group name (e.g. Children, Concession)"
                  size="small"
                  class="flex-1 !border-0 !bg-transparent !shadow-none !ring-0 font-medium text-gray-800 placeholder:font-normal"
                  @input="group.name = ($event.target as HTMLInputElement).value" />
                <div class="flex items-center gap-0.5 shrink-0">
                  <button type="button"
                    class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                    :disabled="gIdx === 0"
                    @click="moveGroup(type, gIdx, -1)">
                    <i class="pi pi-chevron-up text-xs" />
                  </button>
                  <button type="button"
                    class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                    :disabled="gIdx === type.groups.length - 1"
                    @click="moveGroup(type, gIdx, 1)">
                    <i class="pi pi-chevron-down text-xs" />
                  </button>
                  <button type="button"
                    class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                    v-tooltip.top="'Duplicate'"
                    @click="duplicateGroup(type, gIdx)">
                    <i class="pi pi-copy text-xs" />
                  </button>
                  <button type="button"
                    class="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    @click="type.groups.splice(gIdx, 1)">
                    <i class="pi pi-times text-xs" />
                  </button>
                </div>
              </div>

              <!-- Group body -->
              <div class="divide-y divide-gray-100">

                <!-- Conditions -->
                <div class="px-4 py-3 space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-gray-700 uppercase tracking-wide">Conditions</span>
                    <span class="text-xs text-gray-400">Attendees must meet the following criteria</span>
                  </div>

                  <div v-if="(group as any).conditions?.length" class="space-y-1">
                    <div v-for="(cond, cIdx) in (group as any).conditions" :key="cIdx"
                      class="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 h-10">
                      <span class="text-xs font-medium text-gray-500 w-24 shrink-0">
                        {{ conditionOptions.find(c => c.value === cond.type)?.label }}
                      </span>
                      <div class="w-px h-4 bg-gray-200 shrink-0" />
                      <template v-if="cond.type === 'age'">
                        <Select v-model="cond.op" :options="[{label:'is between',value:'between'},{label:'equals',value:'eq'},{label:'greater than',value:'gt'},{label:'less than',value:'lt'}]" option-label="label" option-value="value" size="small" class="w-40 shrink-0" />
                        <input v-model.number="cond.val1" type="number" min="0" placeholder="0" class="w-16 shrink-0 h-7 px-2 text-sm text-gray-800 border border-gray-200 rounded-md outline-none focus:border-[#1E2157] focus:ring-1 focus:ring-[#1E2157]/20 bg-white" />
                        <span v-if="cond.op === 'between'" class="text-xs text-gray-400 shrink-0">and</span>
                        <input v-if="cond.op === 'between'" v-model.number="cond.val2" type="number" min="0" placeholder="0" class="w-16 shrink-0 h-7 px-2 text-sm text-gray-800 border border-gray-200 rounded-md outline-none focus:border-[#1E2157] focus:ring-1 focus:ring-[#1E2157]/20 bg-white" />
                      </template>
                      <template v-else-if="cond.type === 'gender'">
                        <Select v-model="cond.val1" :options="[{label:'Male',value:'male'},{label:'Female',value:'female'},{label:'Non-binary',value:'non_binary'}]" option-label="label" option-value="value" size="small" class="w-40 shrink-0" />
                      </template>
                      <template v-else-if="cond.type === 'booking_date'">
                        <Select v-model="cond.op" :options="[{label:'is between',value:'between'},{label:'before',value:'lt'},{label:'after',value:'gt'}]" option-label="label" option-value="value" size="small" class="w-40 shrink-0" />
                        <DatePicker v-model="cond.val1" size="small" placeholder="Date" date-format="dd/mm/yy" class="w-32 shrink-0 [&_.p-inputtext]:py-0 [&_.p-inputtext]:h-[30px] [&_.p-datepicker-input-icon-container]:self-center" />
                        <span v-if="cond.op === 'between'" class="text-xs text-gray-400 shrink-0">and</span>
                        <DatePicker v-if="cond.op === 'between'" v-model="cond.val2" size="small" placeholder="Date" date-format="dd/mm/yy" class="w-32 shrink-0 [&_.p-inputtext]:py-0 [&_.p-inputtext]:h-[30px] [&_.p-datepicker-input-icon-container]:self-center" />
                      </template>
                      <template v-else-if="cond.type === 'member_type'">
                        <MultiSelect
                          v-model="cond.val1"
                          :options="allMemberGroups"
                          option-label="name"
                          option-value="id"
                          size="small"
                          placeholder="Select groups…"
                          display="chip"
                          :max-selected-labels="2"
                          class="w-64 shrink-0 [&_.p-multiselect-label-container]:h-[30px] [&_.p-multiselect-label-container]:flex [&_.p-multiselect-label-container]:items-center [&_.p-multiselect-label]:py-0" />
                      </template>
                      <button type="button"
                        class="ml-auto w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        @click="(group as any).conditions.splice(cIdx, 1)">
                        <i class="pi pi-times text-xs" />
                      </button>
                    </div>
                  </div>

                  <!-- Add condition button + popup menu -->
                  <div>
                    <Button
                      :ref="el => addConditionBtns[group.id] = el"
                      label="Add Condition"
                      icon="pi pi-plus"
                      size="small"
                      severity="secondary"
                      outlined
                      @click="e => toggleConditionMenu(group.id, e)" />
                    <Menu
                      :ref="el => conditionMenus[group.id] = el"
                      :model="conditionOptions.map(o => ({ label: o.label, command: () => addCondition(group, o.value) }))"
                      :popup="true" />
                  </div>
                </div>

                <!-- Group fees -->
                <div class="px-4 py-3">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fees for this group</p>
                  <FeeLineItemsTable v-model="group.fees" />
                </div>

              </div>
            </div>
          </div>
        </template>

      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { RegistrationTypeFees, FeeGroup } from '~/composables/useFeeGroups'

const props = defineProps<{
  modelValue: RegistrationTypeFees[]
  context?: string
  masterFeeTypes?: RegistrationTypeFees[]
}>()

const emit = defineEmits<{
  'update:modelValue': [RegistrationTypeFees[]]
}>()

const activeTypeId = ref(props.modelValue[0]?.id ?? '')

watch(() => props.modelValue, v => {
  if (v.length && !v.find(t => t.id === activeTypeId.value)) {
    activeTypeId.value = v[0].id
  }
})

function typeName(type: RegistrationTypeFees): string {
  return type.label.replace(/ Fees?$/i, '').toLowerCase()
}

function update(type: RegistrationTypeFees, field: keyof RegistrationTypeFees, value: any) {
  emit('update:modelValue', props.modelValue.map(t => t.id === type.id ? { ...t, [field]: value } : t))
}

function addGroup(type: RegistrationTypeFees) {
  const newGroup = { id: crypto.randomUUID(), name: '', fees: [], conditions: [] }
  update(type, 'groups', [...(type.groups ?? []), newGroup])
}

function moveGroup(type: RegistrationTypeFees, idx: number, dir: -1 | 1) {
  const groups = [...type.groups]
  const target = idx + dir
  if (target < 0 || target >= groups.length) return
  ;[groups[idx], groups[target]] = [groups[target], groups[idx]]
  update(type, 'groups', groups)
}

function duplicateGroup(type: RegistrationTypeFees, idx: number) {
  const groups = [...type.groups]
  const copy = JSON.parse(JSON.stringify(groups[idx]))
  copy.id = crypto.randomUUID()
  copy.name = copy.name ? `${copy.name} (copy)` : ''
  groups.splice(idx + 1, 0, copy)
  update(type, 'groups', groups)
}

function otherTypes(type: RegistrationTypeFees) {
  return props.modelValue.filter(t => t.id !== type.id)
}

function setLocked(type: RegistrationTypeFees, locked: boolean) {
  emit('update:modelValue', props.modelValue.map(t => t.id === type.id ? { ...t, _locked: locked } : t))
}

function pullFromMaster(type: RegistrationTypeFees) {
  const master = props.masterFeeTypes?.find(t => t.id === type.id)
  if (!master) return
  const copy = JSON.parse(JSON.stringify(master))
  copy._locked = true
  emit('update:modelValue', props.modelValue.map(t => t.id === type.id ? copy : t))
}

function differsFromMaster(type: RegistrationTypeFees): boolean {
  const master = props.masterFeeTypes?.find(t => t.id === type.id)
  if (!master) return false
  const { _locked: _a, ...a } = type as any
  const { _locked: _b, ...b } = master as any
  return JSON.stringify(a) !== JSON.stringify(b)
}

function copyFrom(target: RegistrationTypeFees, source: RegistrationTypeFees) {
  const copy = JSON.parse(JSON.stringify(source))
  copy.id = target.id
  copy.label = target.label
  emit('update:modelValue', props.modelValue.map(t => t.id === target.id ? copy : t))
}

const conditionOptions = [
  { label: 'Age', value: 'age' },
  { label: 'Gender', value: 'gender' },
  { label: 'Booking date', value: 'booking_date' },
  { label: 'Member type', value: 'member_type' },
]

// Member groups for the member_type condition
const db = useDb()
const allMemberGroups = ref<{ id: string; name: string }[]>([])

onMounted(async () => {
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const { data } = await db.from('member_groups').select('id, name').eq('org_id', DEFAULT_ORG_ID).order('name')
  allMemberGroups.value = data ?? []
})

// Per-group popup menu refs
const addConditionBtns = reactive<Record<string, any>>({})
const conditionMenus = reactive<Record<string, any>>({})

function toggleConditionMenu(groupId: string, e: Event) {
  conditionMenus[groupId]?.toggle(e)
}

function addCondition(group: FeeGroup, type: string) {
  if (!(group as any).conditions) (group as any).conditions = []
  ;(group as any).conditions.push({ type, op: 'between', val1: null, val2: null })
}
</script>
