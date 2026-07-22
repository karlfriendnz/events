<!--
  SeedPanel — tick the building blocks of demo data you want (people, terms, classes,
  events, venues…) and seed them into this org. Blocks are filtered server-side by the
  org's kind (a club sees classes/venues; a governing body sees disciplines). Talks
  only to the /api/v1/dev/* seam via useDevSeedApi (dev-gated server-side).
-->
<template>
  <div class="space-y-5">
    <!-- Seed blocks -->
    <AppCard title="Seed data" description="Pick the building blocks you want and add them to this organisation. Everything is prefixed “[Demo]”.">
      <div class="p-4 sm:p-5">
        <div v-if="loading" class="text-sm text-gray-400 py-2">Loading…</div>
        <div v-else-if="!blocks.length" class="text-sm text-gray-400 py-2">No seed blocks apply to this organisation.</div>
        <div v-else class="space-y-2.5">
          <!-- club style: themes the programme/class/venue/event/sport names -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 pb-1">
            <label class="text-sm font-medium text-gray-700">Club style</label>
            <Select v-model="flavour" :options="flavourOptions" optionLabel="label" optionValue="value" class="w-full sm:w-72">
              <template #option="{ option }">
                <div><div class="text-sm">{{ option.label }}</div><div class="text-xs text-gray-400 leading-snug">{{ option.description }}</div></div>
              </template>
            </Select>
            <span class="text-xs text-gray-400">{{ flavourDescription }}</span>
          </div>
          <div v-for="b in blocks" :key="b.key"
            class="rounded-xl border p-3 sm:p-4 transition"
            :class="picked[b.key] ? 'border-primary bg-primary/5' : 'border-gray-200'">
            <label class="flex items-start gap-3 cursor-pointer">
              <Checkbox v-model="picked[b.key]" :binary="true" class="mt-0.5" />
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-gray-800">{{ b.label }}</span>
                <span class="block text-xs text-gray-500 leading-snug">{{ b.description }}</span>
              </span>
            </label>
            <!-- options appear once the block is ticked -->
            <div v-if="picked[b.key] && b.options.length" class="mt-3 ml-8 flex flex-wrap gap-x-6 gap-y-2">
              <div v-for="opt in b.options" :key="opt.key" class="flex items-center gap-2">
                <label class="text-xs text-gray-500">{{ opt.label }}</label>
                <InputNumber v-if="opt.type === 'number'" v-model="optValues[b.key][opt.key]" :min="0" class="w-24" :input-class="'w-24 text-center'" :use-grouping="false" />
                <ToggleSwitch v-else-if="opt.type === 'boolean'" v-model="optValues[b.key][opt.key]" />
                <Select v-else-if="opt.type === 'select'" v-model="optValues[b.key][opt.key]" :options="opt.choices" optionLabel="label" optionValue="value" class="w-56" />
                <InputText v-else v-model="optValues[b.key][opt.key]" class="w-56" />
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <Button :label="pickedCount ? `Seed ${pickedCount} block${pickedCount > 1 ? 's' : ''}` : 'Seed'" icon="pi pi-database"
              :disabled="!pickedCount" :loading="seeding"
              style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="runSeed" />
            <button v-if="pickedCount" type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="clearPicks">Clear</button>
            <span v-if="lastSummary" class="text-sm text-green-700">✓ Created: {{ summaryText(lastSummary) }}</span>
          </div>
        </div>
      </div>
    </AppCard>

    <!-- Reset -->
    <AppCard title="Reset" description="Clear this organisation's data, or remove it entirely.">
      <div class="p-4 sm:p-5">
        <div class="flex flex-col sm:flex-row gap-3">
          <Button label="Clear all data" icon="pi pi-eraser" severity="warning" outlined :loading="resetting === 'org-content'"
            @click="confirmClear = true" />
          <Button label="Delete this org entirely" icon="pi pi-trash" severity="danger" outlined :loading="resetting === 'org-tree'"
            @click="confirmDeleteTree = true" />
        </div>
        <p class="text-xs text-gray-400 mt-2">“Clear all data” empties the club — people, person types, classes, terms, events, venues, bookings &amp; forms — but keeps the organisation itself and its settings (name, level, brand, currency, terminology, modules). Good for re-seeding a different club style. “Delete” removes the organisation and everything under it.</p>
      </div>
    </AppCard>

    <Dialog v-model:visible="confirmClear" modal header="Clear all data" :style="{ width: '95vw', maxWidth: '460px' }">
      <p class="text-sm text-gray-600">This removes <b>all</b> people, person types, classes, terms, events, venues, bookings and forms from <b>{{ orgName }}</b>. The organisation itself and its settings (name, level, brand, currency, terminology, modules) are kept. This cannot be undone.</p>
      <template #footer>
        <Button label="Cancel" text @click="confirmClear = false" />
        <Button label="Clear all data" severity="warning" :loading="resetting === 'org-content'" @click="runReset('org-content')" />
      </template>
    </Dialog>

    <Dialog v-model:visible="confirmDeleteTree" modal header="Delete organisation" :style="{ width: '95vw', maxWidth: '460px' }">
      <p class="text-sm text-gray-600">This permanently deletes <b>{{ orgName }}</b> and all of its data. This cannot be undone. Type the org name to confirm:</p>
      <InputText v-model="deleteConfirmText" class="w-full mt-3" :placeholder="orgName" />
      <template #footer>
        <Button label="Cancel" text @click="confirmDeleteTree = false" />
        <Button label="Delete" severity="danger" :disabled="deleteConfirmText !== orgName" :loading="resetting === 'org-tree'" @click="runReset('org-tree')" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { SEED_FLAVOURS, type SeedBlockInfo, type SeedSummary } from '../shared/contracts/devSeed'
const props = defineProps<{ orgId: string; orgName?: string }>()
const emit = defineEmits<{ seeded: [SeedSummary]; deleted: [] }>()
const dev = useDevSeedApi()
const toast = useToast()

const loading = ref(true)
const blocks = ref<SeedBlockInfo[]>([])
const flavour = ref<string>(SEED_FLAVOURS[0].key)
const flavourOptions = SEED_FLAVOURS.map(f => ({ value: f.key, label: f.label, description: f.description }))
const flavourDescription = computed(() => SEED_FLAVOURS.find(f => f.key === flavour.value)?.description ?? '')
const picked = reactive<Record<string, boolean>>({})
const optValues = reactive<Record<string, Record<string, any>>>({})
const seeding = ref(false)
const resetting = ref<'' | 'org-content' | 'org-tree'>('')
const lastSummary = ref<SeedSummary | null>(null)
const confirmClear = ref(false)
const confirmDeleteTree = ref(false)
const deleteConfirmText = ref('')

const pickedCount = computed(() => Object.values(picked).filter(Boolean).length)
const summaryText = (s: SeedSummary) => Object.entries(s.created || {}).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing'

function clearPicks() { for (const k of Object.keys(picked)) picked[k] = false }

async function runSeed() {
  const chosen = blocks.value.filter(b => picked[b.key]).map(b => ({ key: b.key, options: { ...optValues[b.key] } }))
  if (!chosen.length) return
  seeding.value = true
  try {
    const summary = await dev.seedBlocks(props.orgId, chosen, flavour.value)
    lastSummary.value = summary
    toast.add({ severity: 'success', summary: 'Seeded', detail: summaryText(summary), life: 4000 })
    emit('seeded', summary)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Seed failed', detail: e?.data?.message || e?.message, life: 5000 })
  } finally { seeding.value = false }
}

async function runReset(mode: 'org-content' | 'org-tree') {
  resetting.value = mode
  try {
    await dev.reset(props.orgId, mode)
    toast.add({ severity: 'success', summary: mode === 'org-content' ? 'All data cleared' : 'Org deleted', life: 4000 })
    if (mode === 'org-tree') { confirmDeleteTree.value = false; emit('deleted') }
    else { confirmClear.value = false; lastSummary.value = null; emit('seeded', { created: {} } as any) } // nudge the parent to refresh counts
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Reset failed', detail: e?.data?.message || e?.message, life: 5000 })
  } finally { resetting.value = '' }
}

onMounted(async () => {
  try {
    blocks.value = await dev.blocks(props.orgId)
    for (const b of blocks.value) { picked[b.key] = false; optValues[b.key] = Object.fromEntries(b.options.map(o => [o.key, o.default])) }
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not load seed blocks', detail: e?.data?.message || e?.message, life: 5000 })
  } finally { loading.value = false }
})
</script>
