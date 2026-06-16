<!--
  Reusable "Create New" field panel — same UI + field types as the FormBuilder's
  custom-field creator, so fields are created consistently everywhere. Emits
  `add` with { label, type, placeholder, required, options }.
-->
<script setup lang="ts">
const props = defineProps<{ personTypes?: { key: string; label: string }[] }>()
const emit = defineEmits<{ add: [{ label: string; type: string; placeholder: string; required: boolean; options: string[]; target: string }] }>()

// Same list/values as components/FormBuilder.vue
const fieldTypes = [
  { label: 'Short Text', value: 'text' },
  { label: 'Long Text', value: 'textarea' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Dropdown', value: 'select' },
  { label: 'Checkbox', value: 'checkbox' },
]

const f = reactive({ label: '', type: 'text', placeholder: '', required: true, optionsText: '', target: 'member' })
watchEffect(() => { if (props.personTypes?.length && !props.personTypes.some(t => t.key === f.target)) f.target = props.personTypes[0].key })

function add() {
  if (!f.label.trim()) return
  emit('add', {
    label: f.label.trim(),
    type: f.type,
    placeholder: f.placeholder.trim(),
    required: f.required,
    options: f.type === 'select' ? f.optionsText.split('\n').map(s => s.trim()).filter(Boolean) : [],
    target: f.target,
  })
  f.label = ''; f.placeholder = ''; f.optionsText = ''; f.type = 'text'; f.required = true
}
</script>

<template>
  <div class="px-4 pt-4 pb-3">
    <div v-if="(personTypes || []).length" class="mb-3">
      <label class="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Capturing data about</label>
      <Select v-model="f.target" :options="personTypes" option-label="label" option-value="key" class="w-full" />
    </div>
    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Custom field</p>
    <input v-model="f.label" type="text" placeholder="Field label e.g. Preferred Name"
      class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] mb-3" />
    <div class="grid grid-cols-2 gap-1.5 mb-3">
      <button v-for="ft in fieldTypes" :key="ft.value" type="button"
        class="px-3 py-2 rounded-lg border text-xs font-semibold transition-colors"
        :class="f.type === ft.value ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'"
        @click="f.type = ft.value">{{ ft.label }}</button>
    </div>
    <textarea v-if="f.type === 'select'" v-model="f.optionsText" rows="3"
      placeholder="Dropdown options, one per line"
      class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] mb-3" />
    <input v-else v-model="f.placeholder" type="text" placeholder="Placeholder text (optional)"
      class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] mb-3" />
    <label class="flex items-center gap-2 cursor-pointer mb-3">
      <input type="checkbox" v-model="f.required" class="w-4 h-4 accent-[#1E2157]" />
      <span class="text-xs font-medium text-gray-600">Required</span>
    </label>
    <button type="button"
      class="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50"
      :class="f.label.trim() ? 'bg-[#1ab4e8] hover:bg-[#16a0d0]' : 'bg-[#1ab4e8]/60 cursor-not-allowed'"
      :disabled="!f.label.trim()" @click="add">
      Add Field
    </button>
  </div>
</template>
