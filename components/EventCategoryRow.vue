<!--
  Category + Discipline — the ONE event-category row.

  Every place an event is created asks the same question ("what kind of event is this?")
  and the answer has two halves: the club's own CATEGORY, and the governing body's
  DISCIPLINE. They were written out three times (basic wizard, advanced editor, Quick
  event) and had already drifted — Quick event offered categories only, with no way to
  create one, so the fastest create flow was the one that couldn't classify anything.

  Two behaviours worth keeping in mind:

  * Disciplines come from the club's sport → its NSO chain, not a local list.
    <DisciplineLinker> resolves and persists them itself, so it needs a REAL event row —
    hence `eventId` (every create flow makes its draft up front for exactly this reason).
  * When the governing body defines no disciplines the column disappears entirely and
    Category takes the full width with a normal left label, like every other form row.
    A club with no NSO must never see an empty second column.

  The host keeps owning its category list (a board colours events by it, a wizard names
  it in the summary rail), so the list comes in as a prop and a newly-created one goes
  back out via `@created` rather than being loaded twice.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const props = withDefaults(defineProps<{
  categories: any[]
  /** The draft event row disciplines are written against. Null = still being created. */
  eventId?: string | null
  /** Stack the label above the fields (mobile, or a narrow dialog column). */
  stacked?: boolean
  labelWidth?: string
  label?: string
}>(), { eventId: null, stacked: false, labelWidth: '120px', label: 'Category' })

const model = defineModel<string[]>({ default: () => [] })
const emit = defineEmits<{
  (e: 'created', category: { id: string; name: string; color: string }): void
  (e: 'discipline-empty', empty: boolean): void
}>()

const events = useEventsApi()
const { orgId } = useOrg()
const toast = useToast()

// Assume empty until <DisciplineLinker> reports back — a column that appears once
// there's something in it reads better than one that blinks out a moment after mount.
const disciplineEmpty = ref(true)
function onDisciplineEmpty(v: boolean) {
  disciplineEmpty.value = v
  emit('discipline-empty', v)
}

const rowClass = computed(() => props.stacked
  ? 'space-y-1.5'
  : 'grid items-start gap-4')
const rowStyle = computed(() => props.stacked
  ? undefined
  : { gridTemplateColumns: `${props.labelWidth} 1fr` })

// ── New category ──────────────────────────────────────────────────────────
const showDialog = ref(false)
const newName = ref('')
const newColor = ref('#1E2157')
const saving = ref(false)

const PALETTE = [
  '#1E2157', '#3B82F6', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#6B7280', '#1EA97C', '#F97316', '#84CC16',
]

async function createCategory() {
  if (!newName.value.trim()) return
  saving.value = true
  try {
    const data = await events.createCategory({
      orgId: orgId.value,
      name: newName.value.trim(),
      color: newColor.value,
    })
    const cat = { id: data.id, name: data.name, color: data.color }
    emit('created', cat)
    // Creating one from here means you want it — tick it straight away.
    if (!model.value.includes(cat.id)) model.value = [...model.value, cat.id]
    toast.add({ severity: 'success', summary: 'Category created', life: 2000 })
  } catch { /* dialog closes below either way */ }
  showDialog.value = false
  newName.value = ''
  newColor.value = '#1E2157'
  saving.value = false
}
</script>

<template>
  <div :class="rowClass" :style="rowStyle">
    <!-- With BOTH controls each is titled above its own field — no single left label
         can name two side-by-side things. -->
    <span v-if="disciplineEmpty" class="field-label sm:pt-2">{{ label }}</span>
    <span v-else />

    <div :class="disciplineEmpty ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 lg:grid-cols-2 gap-4'">
      <!-- Category -->
      <div class="min-w-0">
        <label v-if="!disciplineEmpty" class="field-label block mb-1.5">{{ label }}</label>
        <div class="flex items-center gap-2 min-w-0">
          <ChipMultiSelect v-model="model" :options="categories" option-label="name" option-value="id"
            chip-color-field="color"
            placeholder="No category" class="flex-1 min-w-0" :show-toggle-all="false">
            <template #option="{ option }">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color || '#94a3b8' }" />
                {{ option.name }}
              </span>
            </template>
          </ChipMultiSelect>
          <Button icon="pi pi-plus" size="small" severity="secondary" outlined
            v-tooltip.top="'New category'" @click="showDialog = true" />
        </div>
      </div>

      <!-- Discipline — hidden entirely when the governing body defines none. -->
      <div v-show="!disciplineEmpty" class="min-w-0">
        <label class="field-label block mb-1.5">Discipline</label>
        <DisciplineLinker v-if="eventId" entity-type="event" :entity-id="eventId" @empty="onDisciplineEmpty" />
        <p v-else class="text-sm text-gray-400 flex items-center gap-2">
          <i class="pi pi-spin pi-spinner text-xs" /> Preparing…
        </p>
      </div>
    </div>
  </div>

  <Dialog v-model:visible="showDialog" header="New Category" modal :style="{ width: '95vw', maxWidth: '360px' }">
    <div class="flex flex-col gap-4 py-1">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">Name</label>
        <InputText v-model="newName" placeholder="Category name" autofocus />
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">Colour</label>
        <div class="flex flex-wrap gap-2">
          <button v-for="color in PALETTE" :key="color"
            class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            :class="newColor === color ? 'border-gray-900 scale-110' : 'border-transparent'"
            :style="{ background: color }"
            @click="newColor = color" />
          <div class="flex items-center gap-1.5">
            <input type="color" v-model="newColor" class="w-7 h-7 rounded cursor-pointer border border-gray-200" />
            <span class="text-xs text-gray-500">Custom</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: newColor }" />
        <span class="text-sm font-medium text-gray-700">{{ newName || 'Category name' }}</span>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
      <Button label="Create" :disabled="!newName.trim()" :loading="saving" @click="createCategory"
        style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>
  </Dialog>
</template>
