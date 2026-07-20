<!--
  Connect a resource or folder to its audience — person types and/or groups
  (resource_targets, migration 246). Mirrors <FormConnectionsDialog>'s keyed
  checkbox map + delete-then-insert save.

  When the item sits inside a folder (`canInherit`), an "Override the folder's
  audience" toggle is shown; while OFF the audience is inherited from the folder
  and the pickers are read-only.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const props = defineProps<{
  visible: boolean
  ownerType: 'folder' | 'resource'
  ownerId: string | null
  name?: string
  canInherit?: boolean           // true when the item has a parent folder
  override?: boolean             // current override_targets value
  inheritedSummary?: string      // human summary of what it inherits (shown when not overriding)
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'saved'): void
}>()

const { orgId } = useOrg()
const toast = useToast()
const { saveTargets, setOverride } = useResources()
const resApi = useResourcesApi()
const { ensureTerms, t } = useTerms()
onMounted(ensureTerms)
const groupTermPlural = computed(() => t('group', true))

const saving = ref(false)
const overrideOn = ref(true)
const keys = ref<Record<string, { checked?: boolean }>>({})
const search = ref('')

const personTypes = ref<{ id: string; label: string }[]>([])
const groups = ref<{ id: string; name: string; color: string | null }[]>([])
const loaded = ref(false)

// Person types don't inherit — they're always this item's own targets, but the
// override toggle governs whether ANY of this item's targets apply.
const editable = computed(() => !props.canInherit || overrideOn.value)

const filteredGroups = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value.filter(g => g.name.toLowerCase().includes(q))
})

watch(() => props.visible, (v) => { if (v) open() })

async function ensureOptions() {
  if (loaded.value) return
  const [types, grps] = await Promise.all([
    useOrgFieldPolicy().resolvePersonTypes(orgId.value),
    useGroupsApi().list(orgId.value),
  ])
  personTypes.value = (types ?? [])
    .filter((t: any) => t.kind !== 'entity')
    .map((t: any) => ({ id: t.id, label: t.label }))
  groups.value = (grps as any[])
    .filter(g => !isMembershipGroup(g))
    .map(g => ({ id: g.id, name: g.name, color: g.color }))
  loaded.value = true
}

async function open() {
  overrideOn.value = props.canInherit ? !!props.override : true
  keys.value = {}
  await ensureOptions()
  if (!props.ownerId) return
  const rows = await resApi.targets(props.ownerType, props.ownerId)
  const k: Record<string, { checked: boolean }> = {}
  for (const t of rows) k[`${t.targetType}:${t.targetId}`] = { checked: true }
  keys.value = k
}

function toggle(type: 'person_type' | 'group', id: string) {
  if (!editable.value) return
  const key = `${type}:${id}`
  const cur = keys.value[key]?.checked
  keys.value = { ...keys.value, [key]: { checked: !cur } }
}
const isChecked = (type: 'person_type' | 'group', id: string) => !!keys.value[`${type}:${id}`]?.checked

async function save() {
  if (!props.ownerId) return
  saving.value = true
  try {
    if (props.canInherit) await setOverride(props.ownerType, props.ownerId, overrideOn.value)
    // When inheriting (override off), clear this item's own targets.
    await saveTargets(props.ownerType, props.ownerId, overrideOn.value || !props.canInherit ? keys.value : {})
    emit('saved')
    emit('update:visible', false)
    toast.add({ severity: 'success', summary: 'Audience saved', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :visible="visible" modal :style="{ width: '95vw', maxWidth: '520px' }"
    :header="name ? `Audience — ${name}` : 'Audience'"
    @update:visible="v => emit('update:visible', v)">
    <div class="space-y-4">
      <!-- Override toggle -->
      <div v-if="canInherit" class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
        <ToggleSwitch v-model="overrideOn" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-800">Override the folder's audience</p>
          <p class="text-xs text-gray-400 mt-0.5">
            <template v-if="overrideOn">This item sets its own audience below.</template>
            <template v-else>Inherits from the folder{{ inheritedSummary ? ` — ${inheritedSummary}` : '' }}.</template>
          </p>
        </div>
      </div>

      <div :class="editable ? '' : 'opacity-50 pointer-events-none select-none'">
        <!-- Person types -->
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Person types</p>
        <div v-if="!personTypes.length" class="text-xs text-gray-400 mb-3">No person types defined.</div>
        <div v-else class="flex flex-wrap gap-2 mb-4">
          <button v-for="pt in personTypes" :key="pt.id" type="button"
            class="px-3 h-8 rounded-full border text-xs transition-colors"
            :class="isChecked('person_type', pt.id)
              ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'"
            @click="toggle('person_type', pt.id)">
            {{ pt.label }}
          </button>
        </div>

        <!-- Groups -->
        <div class="flex items-center justify-between mb-1.5">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ groupTermPlural }}</p>
          <input v-if="groups.length > 6" v-model="search" placeholder="Search…"
            class="h-7 px-2 text-xs border border-gray-200 rounded-md outline-none focus:border-primary" />
        </div>
        <div v-if="!groups.length" class="text-xs text-gray-400">No {{ groupTermPlural.toLowerCase() }} yet.</div>
        <div v-else class="max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
          <button v-for="g in filteredGroups" :key="g.id" type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
            @click="toggle('group', g.id)">
            <span class="w-4 h-4 rounded border flex items-center justify-center shrink-0"
              :class="isChecked('group', g.id) ? 'bg-primary border-primary' : 'border-gray-300'">
              <i v-if="isChecked('group', g.id)" class="pi pi-check text-white" style="font-size:9px" />
            </span>
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#9CA3AF' }" />
            <span class="text-sm text-gray-700 truncate">{{ g.name }}</span>
          </button>
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="emit('update:visible', false)" />
      <Button label="Save" :loading="saving" style="background:#1E2157;border-color:#1E2157" @click="save" />
    </template>
  </Dialog>
</template>
