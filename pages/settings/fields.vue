<!--
  Field library. Fields are first-class and created separately (using the same
  creator UI as the form builder). An org's fields are inherited by its member
  clubs. Tabs mirror the form builder: Existing Fields | Create New.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const { resolveFields } = useOrgFieldPolicy()

const TYPE_LABEL: Record<string, string> = {
  text: 'Short Text', textarea: 'Long Text', email: 'Email', phone: 'Phone',
  number: 'Number', date: 'Date', select: 'Dropdown', checkbox: 'Checkbox',
}
const tab = ref<'existing' | 'new'>('existing')
const own = ref<any[]>([])
const inherited = ref<any[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  const all = await resolveFields(orgId.value as string)
  own.value = all.filter(f => !f.inherited)
  inherited.value = all.filter(f => f.inherited)
  loading.value = false
}

async function addField(p: { label: string; type: string; placeholder: string; required: boolean; options: string[] }) {
  const { error } = await (db.from as any)('field_definitions').insert({
    org_id: orgId.value, label: p.label, field_type: p.type, is_required: p.required,
    options: p.options, help_text: p.placeholder || null, sort_order: own.value.length,
  })
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  toast.add({ severity: 'success', summary: `Field "${p.label}" created`, life: 2000 })
  tab.value = 'existing'; await load()
}
async function removeField(f: any) {
  await (db.from as any)('field_definitions').delete().eq('id', f.id); await load()
}
async function toggleRequired(f: any) {
  await (db.from as any)('field_definitions').update({ is_required: !f.is_required }).eq('id', f.id); await load()
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="mb-4">
      <h1 class="text-xl font-semibold text-gray-900">Fields</h1>
      <p class="text-sm text-gray-500">Reusable fields, created separately and inherited by your member clubs. Built with the same field types as the form builder.</p>
    </div>

    <div class="card p-0 overflow-hidden">
      <!-- Tabs -->
      <div class="grid grid-cols-2 border-b border-gray-100">
        <button type="button" class="py-3 text-sm font-semibold transition-colors"
          :class="tab === 'existing' ? 'text-[#1E2157] border-b-2 border-[#1E2157]' : 'text-gray-400 hover:text-gray-600'"
          @click="tab = 'existing'">Existing Fields</button>
        <button type="button" class="py-3 text-sm font-semibold transition-colors"
          :class="tab === 'new' ? 'text-[#1E2157] border-b-2 border-[#1E2157]' : 'text-gray-400 hover:text-gray-600'"
          @click="tab = 'new'">Create New</button>
      </div>

      <!-- Existing -->
      <div v-if="tab === 'existing'" class="p-4 space-y-4">
        <div v-if="inherited.length">
          <p class="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2"><i class="pi pi-lock mr-1" />Inherited from governing bodies</p>
          <div class="space-y-1.5">
            <div v-for="f in inherited" :key="f.id" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 text-sm">
              <span class="font-medium text-gray-800">{{ f.label }}</span>
              <span v-if="f.is_required" class="text-red-500">*</span>
              <span class="text-[10px] text-gray-400">{{ TYPE_LABEL[f.field_type] || f.field_type }}</span>
              <span class="flex-1" />
              <span class="text-[10px] text-blue-500">{{ f.ownerName }}</span>
            </div>
          </div>
        </div>
        <div>
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">This organisation's fields</p>
          <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
          <div v-else-if="!own.length" class="text-sm text-gray-400 italic py-2">No fields yet — create one.</div>
          <div v-else class="space-y-1.5">
            <div v-for="f in own" :key="f.id" class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-150 hover:bg-gray-50 text-sm">
              <span class="font-medium text-gray-800">{{ f.label }}</span>
              <button class="text-xs" :class="f.is_required ? 'text-red-500' : 'text-gray-300'" title="Toggle required" @click="toggleRequired(f)">*</button>
              <span class="text-[10px] text-gray-400">{{ TYPE_LABEL[f.field_type] || f.field_type }}</span>
              <span class="flex-1" />
              <button class="text-xs text-red-600 hover:underline" @click="removeField(f)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create New -->
      <FieldCreator v-else @add="addField" />
    </div>
  </div>
</template>
