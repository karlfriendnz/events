<!--
  Settings → Terminology. Clubs rename canonical terms (Member, Coach, Group,
  Term, Division…) with their own singular/plural. Overrides inherit from the NSO
  (shown as the placeholder/"via …" hint) and fall back to the built-in defaults.
  Ported from the legacy Settings → Terminology page.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const { TERM_DEFS, saveTerminology } = useTerminology()
const { ancestors } = useOrgHierarchy()

const overrides = reactive<Record<string, { singular: string; plural: string }>>({})
const inherited = reactive<Record<string, { singular?: string; plural?: string; from?: string }>>({})
const loading = ref(true)
const saving = ref(false)

const grouped = computed(() => {
  const g: Record<string, typeof TERM_DEFS> = {}
  for (const t of TERM_DEFS) (g[t.group] ||= []).push(t)
  return g
})
function defOf(key: string) { return TERM_DEFS.find(t => t.key === key)! }

async function load() {
  loading.value = true
  TERM_DEFS.forEach(t => { overrides[t.key] = { singular: '', plural: '' } })
  Object.keys(inherited).forEach(k => delete inherited[k])
  const id = orgId.value
  if (id) {
    const { data: me } = await (db.from as any)('organisations').select('terminology').eq('id', id).single()
    const own = me?.terminology || {}
    TERM_DEFS.forEach(t => { overrides[t.key] = { singular: own[t.key]?.singular || '', plural: own[t.key]?.plural || '' } })
    const anc = await ancestors(id)
    if (anc.length) {
      const { data: rows } = await (db.from as any)('organisations').select('id, name, terminology').in('id', anc.map(a => a.id))
      for (const a of [...anc].reverse()) {
        const row = (rows || []).find((r: any) => r.id === a.id)
        const t = row?.terminology || {}
        for (const [k, v] of Object.entries(t as Record<string, any>)) {
          if (v?.singular) inherited[k] = { ...(inherited[k] || {}), singular: v.singular, from: row.name }
          if (v?.plural) inherited[k] = { ...(inherited[k] || {}), plural: v.plural, from: row.name }
        }
      }
    }
  }
  loading.value = false
}

async function save() {
  if (!orgId.value) return
  saving.value = true
  try {
    await saveTerminology(orgId.value, overrides)
    toast.add({ severity: 'success', summary: 'Terminology saved', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 3500 })
  }
  saving.value = false
}

watch(orgId, load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 settings-fill">
        <Tabs value="terms">
          <TabPanels>
            <TabPanel value="terms" class="space-y-4">
    <div class="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 sm:gap-3">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Terminology</h1>
        <p class="text-sm text-gray-500 mt-0.5">Tailor the words your club uses. Leave blank to keep the default or what your governing body set.</p>
      </div>
      <Button label="Save changes" icon="pi pi-check" size="small" class="w-full sm:w-auto" :loading="saving" @click="save" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
    </div>

    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

    <div v-else class="space-y-4">
      <AppCard v-for="(terms, group) in grouped" :key="group" :title="group">
        <div class="px-5 py-3">
          <!-- column headers (once per card) -->
          <div class="hidden sm:grid grid-cols-12 gap-4 px-2 pb-2 mb-1 border-b border-gray-100">
            <span class="col-span-4 text-[10px] font-bold uppercase tracking-widest text-gray-300">Term</span>
            <span class="col-span-4 text-[10px] font-bold uppercase tracking-widest text-gray-300">Singular</span>
            <span class="col-span-4 text-[10px] font-bold uppercase tracking-widest text-gray-300">Plural</span>
          </div>
          <div class="divide-y divide-gray-50">
            <div v-for="t in terms" :key="t.key" class="group/term grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 sm:items-center px-2 py-3 rounded-lg hover:bg-gray-50/60 transition-colors">
              <div class="col-span-4 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-sm font-semibold text-gray-800 truncate">{{ defOf(t.key).singular }}</p>
                  <span v-if="inherited[t.key]?.from" v-tooltip.top="'Set by ' + inherited[t.key]?.from"
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide text-blue-500 bg-blue-50 rounded px-1.5 py-0.5 cursor-help">NSO</span>
                </div>
                <p class="text-[11px] text-gray-400 leading-tight truncate mt-0.5">{{ t.notes }}</p>
              </div>
              <div class="col-span-4">
                <InputText v-model="overrides[t.key].singular" :placeholder="inherited[t.key]?.singular || defOf(t.key).singular" class="w-full" size="small" />
              </div>
              <div class="col-span-4 flex items-center gap-1.5">
                <InputText v-model="overrides[t.key].plural" :placeholder="inherited[t.key]?.plural || defOf(t.key).plural" class="w-full" size="small" />
                <button type="button"
                  class="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  :class="(overrides[t.key].singular || overrides[t.key].plural) ? 'opacity-0 group-hover/term:opacity-100' : 'invisible'"
                  title="Reset to default" @click="overrides[t.key].singular = ''; overrides[t.key].plural = ''">
                  <i class="pi pi-replay text-xs" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppCard>
    </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
    <Toast />
      </div>
    </div>
  </div>
</template>
