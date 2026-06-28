<!--
  PROTOTYPE · Field editor used by the people-types / entity-types Fields tabs.
  OWN fields are fully editable (label, type, dropdown options, required).
  INHERITED (NSO) fields are READ-ONLY — the club can see them but cannot change
  their values/options; the dropdown option list is locked to what the NSO set.
-->
<script setup lang="ts">
const props = defineProps<{ field: any }>()
const emit = defineEmits<{ (e: 'saved'): void; (e: 'deleted'): void; (e: 'close'): void }>()
const db = useDb()
const toast = useToast()

const TYPES = [
  { label: 'Short text', value: 'text' }, { label: 'Long text', value: 'textarea' },
  { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' },
  { label: 'Number', value: 'number' }, { label: 'Date', value: 'date' },
  { label: 'Dropdown', value: 'select' }, { label: 'Checkbox', value: 'checkbox' },
]
const locked = computed(() => !!props.field.inherited)
const f = reactive({
  label: props.field.label,
  field_type: props.field.field_type,
  is_required: props.field.is_required,
  optionsText: (props.field.options || []).join('\n'),
})
const saving = ref(false)

async function save() {
  if (locked.value || !f.label.trim()) return
  saving.value = true
  await (db.from as any)('field_definitions').update({
    label: f.label.trim(), field_type: f.field_type, is_required: f.is_required,
    options: f.field_type === 'select' ? f.optionsText.split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
  }).eq('id', props.field.id)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Field saved', life: 1800 })
  emit('saved')
}
async function remove() {
  if (locked.value) return
  if (!confirm(`Delete the "${props.field.label}" field?`)) return
  await (db.from as any)('field_definitions').delete().eq('id', props.field.id)
  emit('deleted')
}
</script>

<template>
  <div class="card p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-800">{{ locked ? 'View field' : 'Edit field' }}</h3>
      <button class="text-gray-400 hover:text-gray-600" @click="emit('close')"><i class="pi pi-times text-sm" /></button>
    </div>

    <div v-if="locked" class="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-800">
      <i class="pi pi-lock mr-1" />Managed by {{ props.field.ownerName || 'your governing body' }} — read-only. The values can't be changed here.
    </div>

    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-gray-600">Label</label>
      <InputText v-model="f.label" :disabled="locked" />
    </div>

    <div class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-gray-600">Input type</label>
      <Select v-model="f.field_type" :options="TYPES" optionLabel="label" optionValue="value" class="w-full" :disabled="locked" />
    </div>

    <!-- dropdown options -->
    <div v-if="f.field_type === 'select'" class="flex flex-col gap-1.5">
      <label class="text-xs font-medium text-gray-600">Dropdown values</label>
      <textarea v-if="!locked" v-model="f.optionsText" rows="3"
        class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
        placeholder="One value per line" />
      <div v-else class="flex flex-wrap gap-1.5">
        <span v-for="(o, i) in (props.field.options || [])" :key="i" class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ o }}</span>
        <span v-if="!(props.field.options || []).length" class="text-xs text-gray-400">No values set.</span>
        <p class="w-full text-[11px] text-gray-400 mt-1"><i class="pi pi-lock text-[10px] mr-1" />Set by {{ props.field.ownerName || 'the governing body' }} — locked.</p>
      </div>
    </div>

    <label class="flex items-center gap-2" :class="locked ? 'opacity-60' : 'cursor-pointer'">
      <input type="checkbox" v-model="f.is_required" class="w-4 h-4 accent-primary" :disabled="locked" />
      <span class="text-sm">Always required</span>
    </label>

    <div v-if="!locked" class="flex items-center justify-between pt-1 border-t border-gray-100">
      <button class="text-sm text-red-600 hover:underline" @click="remove">Delete field</button>
      <Button label="Save" size="small" :loading="saving" :disabled="!f.label.trim()" @click="save" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
    </div>
  </div>
</template>
