<!--
  The body of ONE review comment: the text (or its editor), where on the page it
  points, and whether Claude has already actioned it.

  Extracted because <ReviewWidget> renders comment cards in three near-identical
  places (open pins / resolved pins / page-level notes) and these three things
  had to appear in all of them. One component beats three copies drifting apart.

  Deliberately presentational — it owns no data and performs no writes. The
  widget holds the edit state and does the saving, so there is still exactly one
  place that talks to the seam.
-->
<template>
  <!-- The WHOLE comment is the image drop target. Anything smaller has to be
       aimed at, and you can't aim at something you can't see mid-drag. -->
  <div ref="root" class="group/body relative"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop">

    <!-- Shown only while a file is actually over the card. pointer-events-none
         so it can't swallow the drop it is advertising. -->
    <div v-if="dragOver"
      class="absolute inset-0 z-10 rounded-md border-2 border-dashed border-primary bg-primary/10
             flex items-center justify-center pointer-events-none">
      <span class="text-[11px] font-semibold text-primary">
        <i class="pi pi-image text-[10px] mr-1" />Drop to attach
      </span>
    </div>

    <!-- Editing -->
    <div v-if="editing" class="flex flex-col gap-1">
      <!-- Mention-aware, like the new-comment and reply boxes: typing @ here has
           to offer the same picker, or the feature only half exists. -->
      <MentionTextarea :model-value="draft" :reviewers="reviewers ?? []" :rows="3"
        placeholder="@name to ask someone"
        @update:model-value="emit('update:draft', $event)" />
      <div class="flex items-center gap-2 justify-end">
        <button type="button" class="text-[10px] text-gray-500 hover:text-gray-700"
          @click="emit('cancel')">Cancel</button>
        <Button label="Save" size="small" outlined :disabled="!draft.trim()"
          @click="emit('save')" />
        <!-- Saves the edit AND hands this one comment straight to Claude, so a
             note you've just finished wording doesn't need a second trip
             through tick-the-box → Send. -->
        <Button label="Save &amp; send" icon="pi pi-android" size="small"
          :disabled="!draft.trim()"
          v-tooltip.top="'Save, then send just this task to Claude'"
          @click="emit('save-send')"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" />
      </div>
    </div>

    <!-- Reading -->
    <template v-else>
      <!-- The text is the click target: tapping a comment should take you to
           the thing it's about (same as clicking its pin), and the text is what
           a person actually points at. The card can't be one big button — it's
           full of interactive controls — so the affordance lives on the words. -->
      <p class="text-xs text-gray-700 whitespace-pre-wrap break-words cursor-pointer"
        :class="comment.resolved ? 'line-through' : ''"
        @click="emit('open')">{{ comment.body }}</p>

      <!-- Attached images. Some feedback is much faster to show than to write —
           a marked-up screenshot, a reference design. These are real files under
           public/uploads, so the task brief cites paths Claude can open. -->
      <div v-if="attachments.length" class="mt-1.5 flex flex-wrap gap-1.5">
        <div v-for="(a, i) in attachments" :key="a.url" class="relative group/att">
          <a :href="a.url" target="_blank" rel="noopener">
            <img :src="a.url" :alt="a.name || 'attachment'"
              class="w-14 h-14 object-cover rounded border border-gray-200 hover:border-primary transition-colors" />
          </a>
          <button type="button"
            class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-300 text-gray-400
                   hover:text-red-500 hover:border-red-300 flex items-center justify-center opacity-0
                   group-hover/att:opacity-100 transition-opacity"
            v-tooltip.top="'Remove image'"
            @click="emit('remove-attachment', i)">
            <i class="pi pi-times text-[8px]" />
          </button>
        </div>
      </div>

      <!-- Hint only — the DROP TARGET is the whole comment (see the root
           element's handlers). This used to be the target itself, a ~20px strip
           revealed on CSS :hover — but :hover doesn't apply while you're
           dragging a file, so it never appeared and you had to blind-hit an
           invisible strip. A drop area you cannot see is not a drop area. -->
      <p v-if="!compact && !comment.resolved && !uploading"
        class="mt-1 text-[10px] text-gray-300 opacity-0 group-hover/body:opacity-100 transition-opacity">
        <i class="pi pi-image text-[9px] mr-1" />Drag an image onto this comment
      </p>
      <p v-if="uploading" class="mt-1 text-[10px] text-gray-400">
        <i class="pi pi-spin pi-spinner text-[9px] mr-1" />Uploading…
      </p>

      <!-- WHERE it points. The reviewer's words are shorthand for what they were
           looking at ("Padding", "remove this"); this is the other half, and the
           half that makes the note actionable a week later. -->
      <p v-if="!compact && whereLine" class="mt-1 text-[10px] text-gray-400 truncate"
        v-tooltip.bottom="whereTooltip">
        <i class="pi pi-map-marker text-[9px] mr-0.5" />{{ whereLine }}
      </p>

      <!-- Not yet approved. Anyone on the team can leave a comment; it stays a
           SUGGESTION until the builder says it is work, and only then can it be
           sent to Claude. Shown to everyone (so the author knows where it
           stands); only the builder gets the button. -->
      <p v-if="!compact && !comment.ready && !comment.resolved"
        class="mt-1 inline-flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
        <i class="pi pi-inbox text-[9px]" />
        <span>Suggestion — not sent to Claude</span>
        <button v-if="canApprove" type="button"
          class="font-semibold text-primary hover:underline"
          @click="emit('toggle-ready', true)">Mark ready</button>
      </p>

      <!-- Claude's hand-back. GREEN = it's built. (This was amber at first, on
           the reasoning that "done by an agent" isn't "finished" until a human
           signs it off — but amber reads as a warning, and at a glance down the
           list the thing you want to know is simply "has this been built yet".
           The comment still stays OPEN until Karl resolves it; the tick in the
           row is what closes it.) -->
      <p v-if="!compact && comment.claude_status === 'done'"
        class="mt-1 inline-flex items-start gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-300 rounded px-1.5 py-0.5">
        <i class="pi pi-android text-[9px] mt-0.5" />
        <span><span class="font-semibold">Built.</span> {{ comment.claude_note || 'Actioned by Claude' }} — check &amp; sign off</span>
      </p>

      <!-- Handed over but not started. Without this a sent comment looks
           identical to one nobody has touched, so you can't tell what is in
           flight. Queued means QUEUED, not started — so it's the one state you
           can still call back: hover reveals "Cancel", clicking pulls it out of
           the queue (only meaningful for the builder, who did the sending). -->
      <button v-else-if="!compact && comment.claude_status === 'queued'"
        type="button"
        class="group/q mt-1 inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border transition-colors
               text-sky-800 bg-sky-50 border-sky-200"
        :class="canApprove ? 'hover:text-red-700 hover:bg-red-50 hover:border-red-200 cursor-pointer' : 'cursor-default'"
        :disabled="!canApprove"
        v-tooltip.top="canApprove ? 'Cancel — pull this back out of Claude’s queue' : ''"
        @click="canApprove && emit('unqueue')">
        <i class="pi text-[9px]" :class="canApprove ? 'pi-send group-hover/q:hidden' : 'pi-send'" />
        <i v-if="canApprove" class="pi pi-times text-[9px] hidden group-hover/q:inline" />
        <span class="group-hover/q:hidden">Sent to Claude — queued</span>
        <span v-if="canApprove" class="hidden group-hover/q:inline">Cancel send</span>
      </button>

      <!-- Claude couldn't place or understand it and is ASKING rather than
           guessing. Red, because unlike "done" this one is blocked on Karl. -->
      <p v-else-if="!compact && comment.claude_status === 'needs_info'"
        class="mt-1 flex items-start gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-1">
        <i class="pi pi-exclamation-triangle text-[9px] mt-0.5 shrink-0" />
        <span class="min-w-0">
          <span class="font-semibold">Claude needs more info:</span>
          {{ comment.claude_note || 'Not enough detail to action this one.' }}
        </span>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { describeTargetLine } from '~/utils/reviewTarget'

const props = defineProps<{
  comment: any
  editing?: boolean
  draft?: string
  /** Is the viewer the builder (the person who triages suggestions into work)? */
  canApprove?: boolean
  /**
   * Reply mode: body + images + drop target only. A reply has no pin, no
   * ready-gate of its own and no agent status, so those chips would be noise —
   * but it should still be able to carry a screenshot.
   */
  compact?: boolean
  /** Reviewers offered by the @ picker while editing. */
  reviewers?: { id: string; name: string; role?: string | null; color?: string | null }[]
}>()
const emit = defineEmits<{
  (e: 'update:draft', v: string): void
  (e: 'save'): void
  (e: 'save-send'): void
  (e: 'cancel'): void
  (e: 'toggle-ready', v: boolean): void
  (e: 'attach', files: { url: string; name: string }[]): void
  (e: 'remove-attachment', index: number): void
  /** Reading-mode text clicked — take me to what this comment is about. */
  (e: 'open'): void
  /** The "Sent to Claude" chip clicked — pull it back out of the queue. */
  (e: 'unqueue'): void
}>()
const draft = computed(() => props.draft ?? '')

const attachments = computed<{ url: string; name?: string | null }[]>(() =>
  Array.isArray(props.comment?.attachments) ? props.comment.attachments : [])

// ── Drop an image on a comment ───────────────────────────────────────
const root = ref<HTMLElement | null>(null)
const dragOver = ref(false)
const uploading = ref(false)
const { uploadFile } = useUpload()

/** Only react to FILE drags — dragging selected text over a comment isn't an attach. */
function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}
function onDragEnter(e: DragEvent) {
  if (hasFiles(e)) dragOver.value = true
}
function onDragOver(e: DragEvent) {
  if (!hasFiles(e)) return
  dragOver.value = true
  // Without this the cursor shows "no drop allowed" over a perfectly good target.
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
function onDragLeave(e: DragEvent) {
  // dragleave fires every time the pointer crosses into a CHILD element, so a
  // naive handler flickers the overlay off while you're still over the card.
  // Only clear when the pointer has genuinely left the card's subtree.
  const to = e.relatedTarget as Node | null
  if (to && root.value?.contains(to)) return
  dragOver.value = false
}

async function onDrop(e: DragEvent) {
  dragOver.value = false
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (!files.length) return
  uploading.value = true
  try {
    // Upload all, keep whatever succeeded. One bad file shouldn't discard the
    // rest of a multi-image drop.
    const results = await Promise.all(files.map(async (f) => {
      try {
        const { url } = await uploadFile(f)
        return url ? { url, name: f.name } : null
      } catch { return null }
    }))
    const ok = results.filter(Boolean) as { url: string; name: string }[]
    if (ok.length) emit('attach', ok)
  } finally {
    uploading.value = false
  }
}

const whereLine = computed(() => describeTargetLine(props.comment?.context))
/** The full detail, including the component file — too long for the card line. */
const whereTooltip = computed(() => {
  const ctx = props.comment?.context
  if (!ctx) return ''
  return [whereLine.value, ctx.componentFile].filter(Boolean).join('\n')
})
</script>
