<!--
  Connections dialog for a registration form (registration_form_targets, migration 229).
  A form connects to CODES (whole programmes — dynamic, includes classes added later)
  and/or individual GROUPS, picked in a hierarchy tree (codes nest, classes are
  leaves). Also shows the form's public link (/r/form/:id) with Copy/Open.

  Used from the Forms list (Settings → Forms) and the form editor toolbar.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const props = defineProps<{ visible: boolean; formId: string | null; formName?: string }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'saved', count: number): void }>()

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

const saving = ref(false)
const keys = ref<Record<string, { checked?: boolean }>>({})

const link = computed(() => props.formId ? `${window.location.origin}/r/form/${props.formId}` : '')

watch(() => props.visible, (v) => { if (v && props.formId) load() })

async function load() {
  keys.value = {}
  const { data: tgts } = await (db.from as any)('registration_form_targets')
    .select('target_type, target_id').eq('form_id', props.formId).order('sort_order')
  const k: Record<string, { checked: boolean }> = {}
  for (const t of (tgts ?? [])) k[`${t.target_type}:${t.target_id}`] = { checked: true }
  keys.value = k
}

function copyLink() {
  navigator.clipboard?.writeText(link.value)
  toast.add({ severity: 'success', summary: 'Registration link copied', life: 2000 })
}

async function save() {
  if (!props.formId) return
  saving.value = true
  try {
    const rows = Object.entries(keys.value)
      .filter(([k, v]) => v?.checked && k.includes(':'))
      .map(([k], idx) => {
        const [type, id] = k.split(':')
        return { org_id: orgId.value, form_id: props.formId, target_type: type, target_id: id, sort_order: idx }
      })
    await (db.from as any)('registration_form_targets').delete().eq('form_id', props.formId)
    if (rows.length) await (db.from as any)('registration_form_targets').insert(rows)
    emit('saved', rows.length)
    emit('update:visible', false)
    toast.add({ severity: 'success', summary: 'Connections saved', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :visible="visible" modal :style="{ width: '95vw', maxWidth: '480px' }"
    :header="formName ? `Connect — ${formName}` : 'Connections'"
    @update:visible="v => emit('update:visible', v)">
    <div class="space-y-4">
      <div>
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Classes</p>
        <FormTargetsTree v-model:selection-keys="keys" />
        <p class="text-xs text-gray-400 mt-1.5">Tick a <span class="font-semibold">programme</span> to include every class inside it — classes added to it later are offered automatically. Or tick individual classes. Registrants choose their class(es) on the form; a full class offers its waitlist.</p>
      </div>
      <div>
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Public link</p>
        <div class="flex items-center gap-2">
          <input :value="link" readonly
            class="flex-1 min-w-0 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 outline-none" />
          <Button icon="pi pi-copy" label="Copy" size="small" outlined @click="copyLink" />
          <a :href="link" target="_blank" v-tooltip.top="'Open the public page'"
            class="h-9 w-9 shrink-0 inline-flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:text-primary hover:border-primary transition-colors">
            <i class="pi pi-external-link text-sm" />
          </a>
        </div>
        <p class="text-xs text-gray-400 mt-1.5">Anyone can register from this link — no login needed.</p>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="emit('update:visible', false)" />
      <Button label="Save" :loading="saving" style="background:#1E2157;border-color:#1E2157" @click="save" />
    </template>
  </Dialog>
</template>
