<template>
  <!-- The EVENT's description, shown as-is. Clicking it in the builder starts editing:
       the event's own words are copied into a CUSTOM description for this form, so the
       event is never edited from here by accident and the form can say something
       different (the event page keeps its wording). -->
  <div v-if="design.description === 'event'" class="px-4 sm:px-6 py-5">
    <div v-if="readonly" class="text-sm text-gray-600 leading-relaxed" v-html="event?.description || ''" />
    <button v-else type="button"
      class="group w-full text-left rounded-lg -m-1 p-1 transition-colors hover:bg-blue-50/40 hover:ring-2 hover:ring-[#0e43a3]/20"
      @click="startCustom">
      <span class="block text-sm text-gray-600 leading-relaxed" v-html="event?.description || ''" />
      <span v-if="!event?.description" class="block text-sm text-gray-400">
        Event description will appear here once added in event details.
      </span>
      <span class="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0e43a3] opacity-0 group-hover:opacity-100 transition-opacity">
        <i class="pi pi-pencil text-[9px]" />Write a different description for this form
      </span>
    </button>
  </div>
  <div v-else-if="design.description === 'custom'" class="px-4 sm:px-6 py-5">
    <!-- Public/registrant view: static rendered text. Builder: bubble editor (select to format). -->
    <div v-if="readonly" class="prose prose-sm max-w-none text-gray-600 leading-relaxed" v-html="design.customDescription || ''" />
    <template v-else>
      <RichTextEditor v-model="design.customDescription" bubble
        placeholder="Enter a custom description for this registration form..." />
      <div class="mt-1 flex items-center gap-3">
        <!-- Clear empties the text but STAYS custom — otherwise clearing would snap
             back to the event's description, which is the opposite of what you asked. -->
        <button v-if="design.customDescription" type="button" class="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
          @click="design.customDescription = ''">
          <i class="pi pi-times text-[9px] mr-1" />Clear
        </button>
        <button type="button" class="text-[11px] text-gray-400 hover:text-[#0e43a3] transition-colors"
          @click="design.description = 'event'">
          <i class="pi pi-undo text-[9px] mr-1" />Use the event's description instead
        </button>
      </div>
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

// Start from the event's own words — editing usually means "this, but different", and
// blanking the page would make you retype what's already written. An existing custom
// description is left alone (it's your work, not a default to overwrite).
function startCustom() {
  if (!props.design.customDescription) props.design.customDescription = props.event?.description || ''
  props.design.description = 'custom'
}
</script>
