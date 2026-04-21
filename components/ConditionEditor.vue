<template>
  <div class="space-y-2">

    <div v-if="modelValue.length" class="space-y-1.5">
      <div v-for="(cond, idx) in modelValue" :key="cond.id"
        class="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 h-10">

        <!-- Type label -->
        <span class="text-xs font-medium text-gray-500 w-24 shrink-0">
          {{ conditionOptions.find(c => c.value === cond.type)?.label }}
        </span>
        <div class="w-px h-4 bg-gray-200 shrink-0" />

        <!-- Age -->
        <template v-if="cond.type === 'age'">
          <Select v-model="cond.op"
            :options="[{label:'is between',value:'between'},{label:'equals',value:'eq'},{label:'greater than',value:'gt'},{label:'less than',value:'lt'}]"
            option-label="label" option-value="value" size="small" class="w-40 shrink-0"
            @update:model-value="emit('update:modelValue', [...modelValue])" />
          <input v-model.number="cond.val1" type="number" min="0" placeholder="0"
            class="w-16 shrink-0 h-7 px-2 text-sm text-gray-800 border border-gray-200 rounded-md outline-none focus:border-[#1E2157] focus:ring-1 focus:ring-[#1E2157]/20 bg-white"
            @input="emit('update:modelValue', [...modelValue])" />
          <span v-if="cond.op === 'between'" class="text-xs text-gray-400 shrink-0">and</span>
          <input v-if="cond.op === 'between'" v-model.number="cond.val2" type="number" min="0" placeholder="0"
            class="w-16 shrink-0 h-7 px-2 text-sm text-gray-800 border border-gray-200 rounded-md outline-none focus:border-[#1E2157] focus:ring-1 focus:ring-[#1E2157]/20 bg-white"
            @input="emit('update:modelValue', [...modelValue])" />
        </template>

        <!-- Gender -->
        <template v-else-if="cond.type === 'gender'">
          <Select v-model="cond.val1"
            :options="[{label:'Male',value:'male'},{label:'Female',value:'female'},{label:'Non-binary',value:'non_binary'}]"
            option-label="label" option-value="value" size="small" class="w-40 shrink-0"
            @update:model-value="emit('update:modelValue', [...modelValue])" />
        </template>

        <!-- Member type -->
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
            class="w-64 shrink-0 [&_.p-multiselect-label-container]:h-[30px] [&_.p-multiselect-label-container]:flex [&_.p-multiselect-label-container]:items-center [&_.p-multiselect-label]:py-0"
            @update:model-value="emit('update:modelValue', [...modelValue])" />
        </template>

        <!-- Person type -->
        <template v-else-if="cond.type === 'person_type'">
          <MultiSelect
            v-model="cond.val1"
            :options="[{label:'Member',value:'member'},{label:'Guest',value:'guest'},{label:'Public',value:'public'}]"
            option-label="label"
            option-value="value"
            size="small"
            placeholder="Select types…"
            display="chip"
            :max-selected-labels="3"
            class="w-56 shrink-0 [&_.p-multiselect-label-container]:h-[30px] [&_.p-multiselect-label-container]:flex [&_.p-multiselect-label-container]:items-center [&_.p-multiselect-label]:py-0"
            @update:model-value="emit('update:modelValue', [...modelValue])" />
        </template>

        <!-- Booking date -->
        <template v-else-if="cond.type === 'booking_date'">
          <Select v-model="cond.op"
            :options="[{label:'is between',value:'between'},{label:'before',value:'lt'},{label:'after',value:'gt'}]"
            option-label="label" option-value="value" size="small" class="w-36 shrink-0"
            @update:model-value="emit('update:modelValue', [...modelValue])" />
          <DatePicker v-model="cond.val1" size="small" placeholder="Date" date-format="dd/mm/yy"
            class="w-32 shrink-0 [&_.p-inputtext]:py-0 [&_.p-inputtext]:h-[30px] [&_.p-datepicker-input-icon-container]:self-center"
            @update:model-value="emit('update:modelValue', [...modelValue])" />
          <span v-if="cond.op === 'between'" class="text-xs text-gray-400 shrink-0">and</span>
          <DatePicker v-if="cond.op === 'between'" v-model="cond.val2" size="small" placeholder="Date" date-format="dd/mm/yy"
            class="w-32 shrink-0 [&_.p-inputtext]:py-0 [&_.p-inputtext]:h-[30px] [&_.p-datepicker-input-icon-container]:self-center"
            @update:model-value="emit('update:modelValue', [...modelValue])" />
        </template>

        <!-- Remove -->
        <button type="button"
          class="ml-auto w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
          @click="remove(idx)">
          <i class="pi pi-times text-xs" />
        </button>
      </div>
    </div>

    <!-- Add condition -->
    <div>
      <Button
        :ref="el => addBtn = el"
        label="Add Condition"
        icon="pi pi-plus"
        size="small"
        severity="secondary"
        outlined
        @click="e => menu?.toggle(e)" />
      <Menu
        :ref="el => menu = el"
        :model="conditionOptions.map(o => ({ label: o.label, command: () => add(o.value) }))"
        :popup="true" />
    </div>

  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
export interface EligibilityCondition {
  id: string
  type: string
  op?: string
  val1?: any
  val2?: any
}

const props = defineProps<{
  modelValue: EligibilityCondition[]
}>()

const emit = defineEmits<{
  'update:modelValue': [EligibilityCondition[]]
}>()

const conditionOptions = [
  { label: 'Age', value: 'age' },
  { label: 'Gender', value: 'gender' },
  { label: 'Member type', value: 'member_type' },
  { label: 'Person type', value: 'person_type' },
  { label: 'Booking date', value: 'booking_date' },
]

const addBtn = ref<any>(null)
const menu = ref<any>(null)

function add(type: string) {
  emit('update:modelValue', [
    ...props.modelValue,
    { id: crypto.randomUUID(), type, op: 'between', val1: null, val2: null },
  ])
}

function remove(idx: number) {
  const next = [...props.modelValue]
  next.splice(idx, 1)
  emit('update:modelValue', next)
}

const db = useDb()
const allMemberGroups = ref<{ id: string; name: string }[]>([])

onMounted(async () => {
  const { data } = await db.from('member_groups').select('id, name').eq('org_id', orgId.value).order('name')
  allMemberGroups.value = data ?? []
})
</script>
