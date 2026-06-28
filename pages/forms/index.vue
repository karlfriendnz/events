<template>
  <div class="p-3 sm:p-6 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Forms</h1>
        <p class="text-sm text-gray-500 mt-0.5">Reusable question forms for events and booking modes.</p>
      </div>
      <Button label="New form" icon="pi pi-plus" size="small"
        @click="navigateTo('/forms/new')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
    </div>

    <div v-if="loading" class="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
      <i class="pi pi-spin pi-spinner text-2xl" />
    </div>

    <div v-else-if="!forms.length"
      class="bg-white rounded-xl border-2 border-dashed border-primary/20 py-14 text-center">
      <div class="w-14 h-14 mx-auto rounded-full bg-[#EFF6FF] flex items-center justify-center mb-3">
        <i class="pi pi-list text-xl text-primary" />
      </div>
      <h3 class="text-base font-semibold text-gray-900 mb-1">No forms yet</h3>
      <p class="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
        Build a form once and reuse it across events and modes.
      </p>
      <Button label="Create your first form" icon="pi pi-plus"
        @click="navigateTo('/forms/new')" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
    </div>

    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div v-for="(f, i) in forms" :key="f.id"
        class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer group"
        :class="i > 0 && 'border-t border-gray-100'"
        @click="navigateTo(`/forms/${f.id}`)">
        <div class="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
          <i class="pi pi-list text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 truncate">{{ f.name }}</p>
          <p class="text-xs text-gray-500 mt-0.5">
            {{ f.field_count }} {{ f.field_count === 1 ? 'field' : 'fields' }}
            <span v-if="f.usage_count" class="text-gray-400">· in use by {{ f.usage_count }}</span>
          </p>
        </div>
        <i class="pi pi-chevron-right text-gray-300 text-xs group-hover:text-primary" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const db = useDb()
const { orgId } = useOrg()

const forms = ref<{ id: string; name: string; field_count: number; usage_count: number }[]>([])
const loading = ref(true)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const { data: rawForms } = await (db.from as any)('registration_forms')
    .select('id, name')
    .eq('org_id', orgId.value)
    .order('name')
  if (!rawForms?.length) { forms.value = []; loading.value = false; return }
  const ids = rawForms.map((f: any) => f.id)
  const [{ data: fields }, { data: modes }, { data: events }] = await Promise.all([
    (db.from as any)('form_fields').select('form_id').in('form_id', ids),
    (db.from as any)('activity_modes').select('form_id').in('form_id', ids),
    (db.from as any)('events').select('form_id').in('form_id', ids),
  ])
  const fieldCounts: Record<string, number> = {}
  for (const f of fields ?? []) fieldCounts[f.form_id] = (fieldCounts[f.form_id] ?? 0) + 1
  const usageCounts: Record<string, number> = {}
  for (const r of [...(modes ?? []), ...(events ?? [])]) {
    if (r.form_id) usageCounts[r.form_id] = (usageCounts[r.form_id] ?? 0) + 1
  }
  forms.value = rawForms.map((f: any) => ({
    ...f,
    field_count: fieldCounts[f.id] ?? 0,
    usage_count: usageCounts[f.id] ?? 0,
  }))
  loading.value = false
}

watch(orgId, () => load(), { immediate: true })
</script>
