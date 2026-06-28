<!--
  PROTOTYPE · Global core fields. Personal details + Communication are set ONCE
  here and apply to EVERY person type. Each field's requirement:
   • Required (locked)  — First/Last/Role, and DOB+Gender (used to match people)
   • Conditional        — Email (required for account holders / comms recipients)
   • Club's choice      — Phone (Required or Optional)
   • Optional toggle    — Secondary phone, Communication preferences
-->
<script setup lang="ts">
const toast = useToast()
const { orgId } = useOrg()
const { CORE_SECTIONS, coreStatus, loadConfig, saveConfig } = useCoreFields()

const cfg = ref<{ required: Record<string, boolean>; enabled: Record<string, boolean> }>({ required: {}, enabled: {} })
const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  const c = await loadConfig()
  cfg.value = { required: c.required ?? {}, enabled: c.enabled ?? {} }
  loading.value = false
}
function setRequired(key: string, v: boolean) { cfg.value.required = { ...cfg.value.required, [key]: v } }
function setEnabled(key: string, v: boolean) { cfg.value.enabled = { ...cfg.value.enabled, [key]: v } }
function isEnabled(key: string) { return cfg.value.enabled[key] !== false }
async function save() {
  saving.value = true
  await saveConfig(cfg.value)
  saving.value = false
  toast.add({ severity: 'success', summary: 'Core fields saved', life: 2000 })
}
watch(orgId, load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <ProtoNav />
      <div class="flex-1 min-w-0 max-w-2xl">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">Personal details &amp; communication</h1>
            <p class="text-sm text-gray-500">Set once — these apply to <strong>every</strong> person type and can't be changed per type. They always show on the profile layout.</p>
          </div>
          <Button label="Save" size="small" :loading="saving" @click="save" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
        <div v-else class="space-y-4">
          <AppCard v-for="s in CORE_SECTIONS" :key="s.key" :title="s.label" :description="s.desc">
            <div class="divide-y divide-gray-50">
              <div v-for="f in s.fields" :key="f.key" class="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-800">{{ f.label }}</span>
                    <span class="text-[10px] uppercase tracking-wide text-gray-300">{{ f.type }}</span>
                  </div>
                  <p v-if="f.note" class="text-[11px] text-gray-400 mt-0.5">{{ f.note }}</p>
                </div>

                <!-- control by requirement -->
                <div class="shrink-0 text-right">
                  <span v-if="f.requirement === 'always'" class="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500"><i class="pi pi-lock text-[10px]" />Required</span>

                  <span v-else-if="f.requirement === 'conditional'" class="inline-flex items-center gap-1 text-[11px] text-amber-600"><i class="pi pi-info-circle text-[10px]" />Required when it applies</span>

                  <div v-else-if="f.requirement === 'configurable'" class="flex items-center gap-2">
                    <span class="text-[11px]" :class="cfg.required[f.key] ? 'text-gray-700 font-medium' : 'text-gray-400'">{{ cfg.required[f.key] ? 'Required' : 'Optional' }}</span>
                    <ToggleSwitch :modelValue="!!cfg.required[f.key]" @update:modelValue="v => setRequired(f.key, v)" />
                  </div>

                  <div v-else class="flex items-center gap-2">
                    <span class="text-[11px]" :class="isEnabled(f.key) ? 'text-gray-600' : 'text-gray-400'">{{ isEnabled(f.key) ? 'Collected' : 'Off' }}</span>
                    <ToggleSwitch :modelValue="isEnabled(f.key)" @update:modelValue="v => setEnabled(f.key, v)" />
                  </div>
                </div>
              </div>
            </div>
          </AppCard>
          <p class="text-xs text-gray-400">First name, Last name, User role, Date of birth and Gender are always required. Email is required for account holders and anyone receiving communications. Phone is required only if you switch it on. Optional fields you turn off won't appear on any person type.</p>
        </div>
        <Toast />
      </div>
    </div>
  </div>
</template>
