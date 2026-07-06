<!--
  New registration form — a real stepper wizard (full screen, no builder chrome).

  Step 1 · Who registers  — name the form + pick the registration shape
                            (Basic / Blank / the shared PROFILE_PRESETS).
  Step 2 · Connect        — tick programmes/classes in the hierarchy tree
                            (inline, not a modal). Optional.
  Step 3 · Design         — "Create & design" inserts the registration_forms row
                            (ONLY now — abandoning earlier leaves nothing behind)
                            with the chosen shape stashed as config._pendingType/
                            _pendingPreset, writes the target rows, then lands in
                            the designer (/forms/:id), which applies the shape.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { PROFILE_PRESETS } from '~/composables/useFormProfilePresets'

definePageMeta({ layout: 'default' })

const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const toast = useToast()

useBreadcrumbs([{ label: 'Forms', to: '/forms' }, { label: 'New form' }] as any)

const step = ref(1)
const creating = ref(false)

// Step 1 — name + registration shape. Role labels honour the club's
// terminology — a literal "Member" renders as whatever this club calls one.
const name = ref((route.query.name as string) || '')
const typeId = ref<string | null>(null)   // 'basic' | 'blank' | a PROFILE_PRESETS id
const { resolveTerminology, term } = useTerminology()
const memberTerm = ref('Member')
watch(orgId, async (id) => {
  if (!id) return
  try { memberTerm.value = term(await resolveTerminology(id), 'member') } catch { /* default */ }
}, { immediate: true })
const TYPE_OPTIONS = computed(() => [
  { id: 'basic', label: 'Basic', icon: 'pi-file-edit', description: 'One quick form — name, contact details, submit.', includes: '' },
  { id: 'blank', label: 'Blank', icon: 'pi-file', description: 'Start with a single person and build the form yourself.', includes: '' },
  ...PROFILE_PRESETS.map(p => ({
    id: p.id, label: p.label, icon: p.icon, description: p.description,
    includes: p.roles.map(r => {
      const label = r.label === 'Member' ? memberTerm.value : r.label
      return `${r.min}${r.max == null ? '+' : (r.max !== r.min ? `–${r.max}` : '')} ${label}`
    }).join(', '),
  })),
])
function pickType(id: string) {
  typeId.value = id
  if (!name.value.trim()) {
    const t = TYPE_OPTIONS.value.find(x => x.id === id)
    name.value = id === 'basic' || id === 'blank' ? 'Registration form' : `${t?.label} registration`
  }
  step.value = 2
}

// Step 2 — connections (inline hierarchy tree; code tick = whole programme).
const connKeys = ref<Record<string, { checked?: boolean }>>({})
const connCount = computed(() => Object.values(connKeys.value).filter(v => v?.checked).length)

// Step 3 — create the row + targets, then land in the designer.
async function createForm() {
  if (creating.value || !orgId.value) return
  creating.value = true
  try {
    const pending = typeId.value === 'basic' ? { _pendingType: 'simple' }
      : typeId.value === 'blank' ? { _pendingType: 'scratch' }
      : { _pendingType: 'preset', _pendingPreset: typeId.value }
    const { data: f, error } = await (db.from as any)('registration_forms').insert({
      org_id: orgId.value,
      name: name.value.trim() || 'Registration form',
      config: { groups: [], ...pending },
    }).select('id').single()
    if (error) throw error
    const rows = Object.entries(connKeys.value)
      .filter(([k, v]) => v?.checked && k.includes(':'))
      .map(([k], idx) => {
        const [type, id] = k.split(':')
        return { org_id: orgId.value, form_id: f.id, target_type: type, target_id: id, sort_order: idx }
      })
    if (rows.length) await (db.from as any)('registration_form_targets').insert(rows)
    await navigateTo(`/forms/${f.id}`, { replace: true })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not create the form', detail: e?.message, life: 4000 })
    creating.value = false
  }
}

const STEPS = [
  { n: 1, label: 'Who registers' },
  { n: 2, label: 'Connect' },
  { n: 3, label: 'Design' },
]
</script>

<template>
  <div class="min-h-full bg-[#F5F8FA] p-3 sm:p-6">
    <div class="max-w-[620px] mx-auto">
      <NuxtLink to="/forms" class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1.5 mb-3">
        <i class="pi pi-arrow-left text-xs" /> Forms
      </NuxtLink>

      <div class="bg-white rounded-xl shadow-lg overflow-hidden">
        <!-- Header + stepper -->
        <div class="bg-[#182e59] px-6 pt-5 pb-4 text-center">
          <h2 class="text-[17px] font-semibold text-white leading-snug">New registration form</h2>
          <div class="flex items-center justify-center gap-2 mt-3">
            <template v-for="(s, i) in STEPS" :key="s.n">
              <button type="button" class="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                :class="[step === s.n ? 'text-white' : 'text-white/50', s.n < step ? 'cursor-pointer hover:text-white' : 'cursor-default']"
                @click="s.n < step && (step = s.n)">
                <span class="w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                  :class="step === s.n ? 'bg-white text-[#182e59]' : (s.n < step ? 'bg-emerald-400 text-white' : 'bg-white/20 text-white/70')">
                  <i v-if="s.n < step" class="pi pi-check text-[9px]" />
                  <template v-else>{{ s.n }}</template>
                </span>
                {{ s.label }}
              </button>
              <span v-if="i < STEPS.length - 1" class="text-white/30">›</span>
            </template>
          </div>
        </div>

        <!-- Step 1 · Who registers -->
        <div v-if="step === 1" class="p-5">
          <label class="text-sm font-semibold text-gray-600 block mb-1">Form name</label>
          <InputText v-model="name" placeholder="e.g. Term 4 enrolment" class="w-full mb-4" />
          <p class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Who is registering?</p>
          <p class="text-sm text-gray-500 mb-3">Pick a starting point — every setting is fully configurable afterwards.</p>
          <div class="space-y-2.5">
            <button v-for="t in TYPE_OPTIONS" :key="t.id" type="button"
              class="w-full flex items-start gap-3 border rounded-lg px-4 py-3 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group"
              :class="typeId === t.id ? 'border-[#182e59] bg-blue-50/40' : 'border-gray-200'"
              @click="pickType(t.id)">
              <div class="shrink-0 w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]">
                <i :class="['pi', t.icon, 'text-lg']" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-bold text-gray-800">{{ t.label }}</p>
                <p class="text-xs text-gray-500 mt-0.5">{{ t.description }}</p>
                <p v-if="t.includes" class="text-[11px] text-gray-400 mt-0.5">Includes {{ t.includes }}</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Step 2 · Connect -->
        <div v-else-if="step === 2" class="p-5">
          <p class="text-sm text-gray-500 mb-3">What does this form register people into? Tick a <span class="font-semibold">programme</span> to include every class inside it — classes added later are offered automatically — or tick individual classes. Registrants choose their class(es) on the form; a full class offers its waitlist.</p>
          <FormTargetsTree v-model:selection-keys="connKeys" />
          <p class="text-xs text-gray-400 mt-2">{{ connCount ? `${connCount} connected` : 'Optional — you can also connect it later from the form editor.' }}</p>
          <div class="flex items-center justify-between mt-5">
            <Button label="Back" text @click="step = 1" />
            <Button :label="creating ? 'Creating…' : 'Create & design'" icon="pi pi-arrow-right" iconPos="right" :loading="creating"
              style="background:#1E2157;border-color:#1E2157" @click="createForm" />
          </div>
        </div>
      </div>
    </div>
    <Toast />
  </div>
</template>
