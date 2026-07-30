<template>
  <div class="px-4 sm:px-6 py-5">
    <!-- Public / read-only: static text (custom if set, else the event's own words). -->
    <div v-if="readonly" class="fm-rich prose prose-sm max-w-none text-gray-600 leading-relaxed" v-html="displayHtml" />

    <!-- Builder: ONE inline rich-text editor — no box, hover shows an underline + text
         cursor, click to edit with TipTap (multi-line). Same interaction as the form
         heading and the section headings. It starts from the event's description; the
         first edit makes it this form's own custom description. -->
    <template v-else>
      <RichTextEditor v-model="body" bubble inline
        placeholder="Enter a custom description for this registration form…" />
      <button v-if="design.description === 'custom'" type="button"
        class="mt-1 text-[11px] text-gray-400 hover:text-[#0e43a3] transition-colors"
        @click="useEventDescription">
        <i class="pi pi-undo text-[9px] mr-1" />Use the event's description instead
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  design: { description?: 'event' | 'custom'; customDescription?: string }
  event: { description?: string | null } | null
  /** Public preview — show the description as static text (no editor). */
  readonly?: boolean
}>()

// What shows read-only: the custom text once chosen, otherwise the event's description.
const displayHtml = computed(() => (props.design.description === 'custom'
  ? (props.design.customDescription || '')
  : (props.event?.description || '')))

// The editable value: the event's words until the user edits, then their own custom
// text. Editing flips the design to 'custom' so the event page keeps its own wording.
const body = computed({
  get() {
    return props.design.description === 'custom'
      ? (props.design.customDescription || '')
      : (props.event?.description || '')
  },
  set(v: string) {
    props.design.customDescription = v
    props.design.description = 'custom'
  },
})

// Revert to the event's description (drops the custom override).
function useEventDescription() {
  props.design.description = 'event'
}
</script>
