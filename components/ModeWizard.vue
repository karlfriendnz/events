<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)"
    modal :show-header="false" :dismissable-mask="true"
    :style="{ width: 'min(440px, 95vw)' }"
    :content-style="{ padding: 0 }">
    <div class="relative px-8 pt-10 pb-8 text-center">

      <button type="button" aria-label="Close"
        class="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        @click="close">
        <i class="pi pi-times text-xs" />
      </button>

      <p v-if="activityName" class="text-[11px] font-semibold text-primary uppercase tracking-[0.18em]">
        {{ activityName }}
      </p>
      <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
        {{ activityName ? `What's a booking type you can do at the ${activityName}?` : "What's a booking type you can do here?" }}
      </h2>
      <p class="text-sm text-gray-500 mt-1">Add one at a time — e.g. Singles, Doubles, Birthdays, Function hire.</p>

      <InputText v-model="form.name" class="w-full text-base mt-6"
        placeholder="Type a name…" autofocus
        @keyup.enter="canSave && save(false)" />

      <div class="mt-5 flex gap-2 justify-center flex-wrap">
        <button v-for="c in COLORS" :key="c" type="button"
          class="w-7 h-7 rounded-full transition-all"
          :style="{ background: c }"
          :class="form.color === c
            ? 'ring-2 ring-gray-700 ring-offset-2 scale-110'
            : 'hover:ring-2 hover:ring-gray-300 opacity-70 hover:opacity-100'"
          @click="form.color = c" />
      </div>

      <div class="mt-8 flex flex-col items-center gap-3">
        <Button :label="addLabel"
          icon="pi pi-check" size="small" class="w-48"
          :disabled="!canSave" @click="save(false)"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        <button type="button"
          class="text-xs font-medium text-primary hover:underline disabled:text-gray-300 disabled:no-underline"
          :disabled="!canSave"
          @click="save(true)">
          + Save and add another
        </button>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
export type ModePayload = {
  name: string
  description: string
  color: string
  min_people: number | null
  max_people: number | null
  allow_visitors: boolean
  default_price: number | null
}

const props = defineProps<{
  visible: boolean
  activityName?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'done', mode: ModePayload): void
}>()

const COLORS = ['#6366F1','#EF4444','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#F97316','#14B8A6','#84CC16']

// Random starter colour so users don't have to "pick something" before
// they can move on — they can override by clicking another swatch.
function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

function blankForm() {
  return {
    name: '',
    color: randomColor(),
  }
}

const form = reactive(blankForm())

const canSave = computed(() => form.name.trim().length > 0)
const addLabel = computed(() => {
  const trimmed = form.name.trim()
  return trimmed ? `Add "${trimmed}"` : 'Add it'
})

function reset() {
  Object.assign(form, blankForm())
}

function close() {
  emit('update:visible', false)
}

function save(addAnother: boolean) {
  if (!canSave.value) return
  // Capacity + pricing intentionally left as nulls — the wizard only
  // captures the bare minimum to create a row. Users tune the rest on
  // the dedicated `/activities/:id/modes/:modeId` editor.
  emit('done', {
    name: form.name.trim(),
    description: '',
    color: form.color,
    min_people: null,
    max_people: null,
    allow_visitors: false,
    default_price: null,
  })
  if (addAnother) reset()
  else { reset(); close() }
}

watch(() => props.visible, v => { if (v) reset() })
</script>
