<template>
  <div class="p-3 sm:p-6 min-h-full">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6">
    <SettingsNav />
    <div class="flex-1 min-w-0">
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Forms</h1>
        <p class="text-sm text-gray-500 mt-0.5">Build a form once, connect it to whatever it registers people into — classes, events, booking modes.</p>
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
        Build a form once and reuse it across classes, events and modes.
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
            <span v-if="f.target_count" class="text-emerald-600">· {{ f.target_count }} connected</span>
            <span v-if="f.usage_count" class="text-gray-400">· in use by {{ f.usage_count }}</span>
          </p>
        </div>
        <Button icon="pi pi-link" :label="f.target_count ? 'Connections' : 'Connect'" size="small" text
          class="shrink-0 !hidden sm:!inline-flex" @click.stop="openConnections(f)" />
        <button type="button" class="sm:hidden shrink-0 text-gray-400 hover:text-primary" @click.stop="openConnections(f)">
          <i class="pi pi-link" />
        </button>
        <button type="button" class="shrink-0 text-gray-300 hover:text-red-500 transition-colors px-1"
          v-tooltip.top="'Delete form'" @click.stop="deleteForm(f)">
          <i class="pi pi-trash text-sm" />
        </button>
        <i class="pi pi-chevron-right text-gray-300 text-xs group-hover:text-primary" />
      </div>
    </div>

    <!-- Connections: which programmes/classes this form registers people into + its public link -->
    <FormConnectionsDialog v-model:visible="connOpen" :form-id="connForm?.id ?? null" :form-name="connForm?.name"
      @saved="onConnectionsSaved" />
    <Toast />
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const formsApi = useFormsApi()
const { orgId } = useOrg()

const forms = ref<{ id: string; name: string; field_count: number; usage_count: number; target_count: number }[]>([])
const loading = ref(true)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const rawForms = await formsApi.list(orgId.value as string)
  if (!rawForms.length) { forms.value = []; loading.value = false; return }
  // Per-form usage tallies (fields / in-use / connections) — computed server-side.
  const usage = await formsApi.usage(orgId.value as string)
  // Designer-shaped forms keep their fields in config.groupFields (not form_fields).
  const designerFieldCount = (cfg: any) => {
    if (!cfg?.groupFields) return 0
    return Object.values(cfg.groupFields as Record<string, any[]>)
      .reduce((n, list) => n + (Array.isArray(list) ? list.filter((x: any) => !['section', 'image', 'textblock', 'button', 'tabs'].includes(x.field_type)).length : 0), 0)
  }
  forms.value = [...rawForms]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({
      id: f.id,
      name: f.name,
      field_count: (usage[f.id]?.fieldCount ?? 0) || designerFieldCount(f.config),
      usage_count: usage[f.id]?.usageCount ?? 0,
      target_count: usage[f.id]?.targetCount ?? 0,
    }))
  loading.value = false
}

// ── Connections (registration_form_targets, migration 229) ──────────────────
// The tree picker + public link live in the shared <FormConnectionsDialog>
// (also mounted in the form editor's toolbar).
const connOpen = ref(false)
const connForm = ref<{ id: string; name: string } | null>(null)

function openConnections(f: { id: string; name: string }) {
  connForm.value = f
  connOpen.value = true
}
function onConnectionsSaved(count: number) {
  const row = forms.value.find(x => x.id === connForm.value?.id)
  if (row) row.target_count = count
}

// Delete a form: unlink everything pointing at it (events / booking modes /
// classes — their public pages fall back to "no form set up"), then remove the
// form + its fields. Targets cascade via FK.
async function deleteForm(f: { id: string; name: string; usage_count: number }) {
  const usage = f.usage_count ? `\n\nIt's in use by ${f.usage_count} event/mode/class — they'll be unlinked.` : ''
  if (!confirm(`Delete "${f.name}"? This can't be undone.${usage}`)) return
  // The DELETE route detaches everything pointing at it (events / modes / classes
  // form_id nulled) + removes fields + connections, org-scoped.
  await formsApi.remove(f.id, orgId.value!)
  forms.value = forms.value.filter(x => x.id !== f.id)
}

watch(orgId, () => load(), { immediate: true })
</script>
