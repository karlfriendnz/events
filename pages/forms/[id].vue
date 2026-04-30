<template>
  <div class="flex flex-col h-screen bg-[#F5F8FA]">
    <!-- Top toolbar -->
    <div class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <button class="text-sm text-gray-500 hover:text-[#1E2157] flex items-center gap-1.5"
          @click="navigateTo(returnTo || '/forms')">
          <i class="pi pi-arrow-left text-xs" />
          {{ returnLabel }}
        </button>
        <span class="text-gray-300">/</span>
        <span class="text-sm font-semibold text-gray-800">{{ form.name || (isNew ? 'New form' : 'Untitled form') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <Button :label="isNew ? 'Create form' : 'Save changes'" icon="pi pi-check" size="small" :loading="saving"
          @click="save" style="background:#1E2157;border-color:#1E2157" />
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      <i class="pi pi-spin pi-spinner text-2xl" />
    </div>

    <FormBuilder v-else
      v-model="form"
      :context="builderContext"
      :show-back="!!returnTo"
      :can-delete="!isNew"
      :allow-multiple-persons="false"
      @back="navigateTo(returnTo || '/forms')"
      @done="save"
      @delete="onDelete" />

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

definePageMeta({ layout: 'default' })

const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const toast = useToast()

const isNew = computed(() => route.params.id === 'new')
const formId = ref<string | null>(isNew.value ? null : (route.params.id as string))
const returnTo = computed(() => (route.query.return as string | undefined) || null)
const returnLabel = computed(() => returnTo.value ? 'Back' : 'Forms')

function freshKey() { return crypto.randomUUID() }

function coreFields() {
  return [
    { _key: freshKey(), field_type: 'text',     label: 'First Name',       is_required: true,  placeholder: 'John',                  has_placeholder: true,  helper_text: '', has_helper_text: false, col_span: 1, _optionsText: '', core: 'first_name' as const },
    { _key: freshKey(), field_type: 'text',     label: 'Last Name',        is_required: true,  placeholder: 'Smith',                 has_placeholder: true,  helper_text: '', has_helper_text: false, col_span: 1, _optionsText: '', core: 'last_name'  as const },
    { _key: freshKey(), field_type: 'text',     label: 'Email Address',    is_required: true,  placeholder: 'you@example.com',       has_placeholder: true,  helper_text: '', has_helper_text: false, col_span: 2, _optionsText: '', core: 'email'      as const },
    { _key: freshKey(), field_type: 'text',     label: 'Phone Number',     is_required: false, placeholder: '+64…',                  has_placeholder: true,  helper_text: '', has_helper_text: false, col_span: 2, _optionsText: '', core: 'phone'      as const },
    { _key: freshKey(), field_type: 'number',   label: 'People Attending', is_required: false, placeholder: '1',                     has_placeholder: true,  helper_text: 'How many people are attending?', has_helper_text: true, col_span: 1, _optionsText: '', core: 'attendees' as const },
    { _key: freshKey(), field_type: 'textarea', label: 'Notes',            is_required: false, placeholder: 'Any special requirements…', has_placeholder: true, helper_text: '', has_helper_text: false, col_span: 2, _optionsText: '', core: 'notes' as const },
  ]
}

function emptyForm() {
  return {
    name: '',
    description: '',
    fields: coreFields() as any[],
    terms: [] as any[],
    settings: {
      submitLabel: 'Submit',
      confirmMessage: '',
      formHeading: 'Fill in the form to register',
    },
    sectionSaved: { settings: false, fields: false, terms: false } as Record<string, boolean>,
  }
}
const form = ref(emptyForm())

const builderContext = computed(() => ({
  title: form.value.name,
  description: form.value.description,
}))

const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  if (isNew.value) {
    const fresh = emptyForm()
    fresh.name = (route.query.name as string) || ''
    form.value = fresh
    loading.value = false
    return
  }
  const id = formId.value!
  const fresh = emptyForm()
  const { data: f } = await (db.from as any)('registration_forms').select('id, name, config').eq('id', id).single()
  let fieldMeta: Record<string, any> = {}
  if (f) {
    fresh.name = f.name ?? ''
    const cfg = (f.config as any) ?? {}
    fresh.description = cfg.description ?? ''
    fresh.terms = (cfg.terms ?? []).map((t: any) => ({ _key: freshKey(), ...t }))
    Object.assign(fresh.settings, cfg.settings ?? {})
    Object.assign(fresh.sectionSaved, cfg.sectionSaved ?? {})
    fieldMeta = cfg.fieldMeta ?? {}
  }
  const { data: ff } = await (db.from as any)('form_fields').select('*').eq('form_id', id).order('sort_order')
  const coreByLabel: Record<string, 'first_name' | 'last_name' | 'email' | 'phone' | 'attendees' | 'notes'> = {
    'First Name': 'first_name', 'Last Name': 'last_name', 'Email Address': 'email', 'Phone Number': 'phone',
    'People Attending': 'attendees', 'Notes': 'notes',
  }
  const dbToType: Record<string, string> = {
    SHORT_TEXT: 'text', LONG_TEXT: 'textarea', SINGLE_SELECT: 'select', MULTI_SELECT: 'select',
    TOGGLE: 'checkbox', NUMBER: 'number', DATE: 'date', FILE: 'file', SECTION_HEADER: 'text',
  }
  fresh.fields = (ff ?? []).map((row: any) => {
    let options: string[] = []
    try { options = JSON.parse(row.options || '[]') } catch { options = [] }
    const meta = fieldMeta[row.label] ?? {}
    const core = meta.core ?? coreByLabel[row.label] ?? undefined
    return {
      _key: freshKey(),
      id: row.id,
      field_type: dbToType[row.field_type] ?? (row.field_type || 'text').toLowerCase(),
      label: row.label,
      placeholder: row.placeholder ?? '',
      has_placeholder: !!row.placeholder,
      helper_text: row.help_text ?? '',
      has_helper_text: !!meta.has_helper_text || !!row.help_text,
      col_span: meta.col_span ?? 2,
      is_required: !!row.is_required || core === 'first_name' || core === 'last_name' || core === 'email',
      _optionsText: options.join('\n'),
      core,
      // Advanced rules round-trip from registration_forms.config.fieldMeta.
      has_visibility_conditions: !!meta.has_visibility_conditions,
      visibility_conditions: meta.visibility_conditions ?? [],
      has_financial_increase: !!meta.has_financial_increase,
      financial_rules: meta.financial_rules ?? [],
    }
  })
  // If an existing form is missing any core field, append the missing ones so the
  // mode-on-details-page contract still holds.
  const present = new Set(fresh.fields.map((f: any) => f.core).filter(Boolean))
  for (const cf of coreFields()) if (!present.has(cf.core)) fresh.fields.push(cf)
  form.value = fresh
  loading.value = false
}

async function save() {
  if (!form.value.name.trim()) {
    toast.add({ severity: 'warn', summary: 'Name required', life: 2500 })
    return
  }
  saving.value = true
  try {
    let id = formId.value
    const config: any = {
      description: form.value.description || null,
      terms: form.value.terms.map(({ _key, ...rest }: any) => rest),
      settings: { ...form.value.settings },
      sectionSaved: { ...form.value.sectionSaved },
    }
    if (isNew.value || !id) {
      const { data, error } = await (db.from as any)('registration_forms').insert({
        org_id: orgId.value,
        name: form.value.name.trim(),
        config,
      }).select('id').single()
      if (error) throw error
      id = data.id
      formId.value = id
    } else {
      await (db.from as any)('registration_forms').update({ name: form.value.name.trim(), config }).eq('id', id)
    }
    await (db.from as any)('form_fields').delete().eq('form_id', id)
    if (form.value.fields.length) {
      const typeToDb: Record<string, string> = {
        text: 'SHORT_TEXT', textarea: 'LONG_TEXT', select: 'SINGLE_SELECT', checkbox: 'TOGGLE',
        number: 'NUMBER', date: 'DATE', file: 'FILE',
      }
      const rows = form.value.fields.map((f: any, idx: number) => ({
        form_id: id,
        field_type: typeToDb[f.field_type] ?? 'SHORT_TEXT',
        label: f.label || 'Untitled',
        placeholder: f.has_placeholder ? (f.placeholder || null) : null,
        help_text: f.has_helper_text ? (f.helper_text || null) : null,
        is_required: !!f.is_required,
        sort_order: idx,
        page_number: 1,
        options: f.field_type === 'select'
          ? JSON.stringify((f._optionsText || '').split('\n').map((s: string) => s.trim()).filter(Boolean))
          : null,
      }))
      await (db.from as any)('form_fields').insert(rows)
    }
    // Persist per-field metadata (col_span, core, has_helper_text) in the form config
    // so it round-trips even though form_fields doesn't have those columns yet.
    const fieldMeta = form.value.fields.reduce((acc: any, f: any) => {
      acc[f.label] = {
        col_span: f.col_span,
        core: f.core,
        has_helper_text: f.has_helper_text,
        // Advanced rules round-trip via the form's config jsonb so we don't need
        // a schema change on form_fields.
        has_visibility_conditions: f.has_visibility_conditions,
        visibility_conditions: f.visibility_conditions,
        has_financial_increase: f.has_financial_increase,
        financial_rules: f.financial_rules,
      }
      return acc
    }, {})
    await (db.from as any)('registration_forms').update({
      config: { ...config, fieldMeta },
    }).eq('id', id)
    toast.add({ severity: 'success', summary: 'Form saved', life: 2000 })
    if (returnTo.value) {
      await navigateTo(`${returnTo.value}${returnTo.value.includes('?') ? '&' : '?'}form_id=${id}`)
    } else if (isNew.value) {
      await navigateTo(`/forms/${id}`, { replace: true })
    }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 4000 })
  }
  saving.value = false
}

async function onDelete() {
  if (!formId.value) return
  if (!confirm('Delete this form? Modes and events using it will be unlinked.')) return
  await (db.from as any)('form_fields').delete().eq('form_id', formId.value)
  await (db.from as any)('registration_forms').delete().eq('id', formId.value)
  toast.add({ severity: 'success', summary: 'Form deleted', life: 2000 })
  navigateTo('/forms')
}

watch([orgId, () => route.params.id], () => {
  formId.value = isNew.value ? null : (route.params.id as string)
  load()
}, { immediate: true })
</script>
