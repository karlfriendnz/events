<script setup lang="ts">
/**
 * The shared event-wizard chrome — a teleported modal with a brand header, a
 * clickable step path, and a Back / Next|Finish footer. Extracted from the
 * inline shell in pages/events/new-basic.vue so every wizard reads the same and
 * users don't relearn it. First consumer: the multi-session (programme) builder;
 * new-basic / new-advanced can migrate to it next.
 *
 * The parent owns step CONTENT (v-show by the current index) + validation; this
 * owns the frame + navigation. `v-model` is the current step index.
 */
const props = withDefaults(defineProps<{
  steps: { key: string; label: string }[]
  modelValue: number
  title: string
  /** Gate the Next / Finish button (e.g. current step incomplete). */
  canNext?: boolean
  saving?: boolean
  finishLabel?: string
  /** Full-bleed body for the current step: fill the modal body (small even inset,
   *  no max-width, no summary rail) so an embedded builder looks native. */
  fullBleed?: boolean
  /**
   * Let the STEP own the footer. A step that is itself a multi-screen task (the
   * form builder: registration type → template → who's registering → the builder)
   * carries its own Back and its own finishing action; the wizard's pair underneath
   * then offers a "Next" belonging to a flow the user isn't looking at. The step
   * drives navigation instead, via v-model on the step index.
   */
  hideFooter?: boolean
}>(), { canNext: true, saving: false, finishLabel: 'Create', fullBleed: false, hideFooter: false })

const emit = defineEmits<{
  (e: 'update:modelValue', v: number): void
  (e: 'finish'): void
  (e: 'close'): void
}>()

const isLast = computed(() => props.modelValue >= props.steps.length - 1)

/** "Step 4 of 7 · Who it's for" — read by the review widget's pin capture. */
const reviewScope = computed(() => {
  const s = props.steps[props.modelValue]
  if (!s) return null
  return `Step ${props.modelValue + 1} of ${props.steps.length} · ${s.label}`
})
function onNext() {
  if (isLast.value) emit('finish')
  else emit('update:modelValue', props.modelValue + 1)
}
</script>

<template>
  <Teleport to="body">
    <!-- Top offset + max-height come from the global modal rule (main.css); here we just
         set the top-align, side padding, width and let the panel fill.
         Width SCALES with the window (min(1200px, 94vw)) rather than the old flat
         1000px — on a laptop that left two thick empty gutters while the step content
         (form + summary rail) was squeezed. 1200 is the ceiling: wider read as too big. -->
    <!-- data-review-scope: a wizard is N screens sharing ONE route, so a review
         comment left on step 4 is indistinguishable from one left on step 1
         unless the shell says which step is showing. Declared once here and
         every wizard built on WizardShell is covered. -->
    <div class="app-modal-overlay fixed inset-0 flex items-stretch sm:items-start justify-center sm:px-6 sm:pb-6 bg-slate-900/45 backdrop-blur-[2px]"
      :data-review-scope="reviewScope" style="z-index:1000">
      <div class="flex flex-col bg-white w-full h-full sm:max-w-[min(1200px,94vw)] sm:rounded-xl shadow-2xl overflow-hidden">

        <!-- Header + step path (same brand bar as every dialog) -->
        <div class="shrink-0 bg-white border-b border-gray-200">
          <div class="modal-header-bar flex items-center gap-3 !py-2.5">
            <span class="modal-header-title flex-1">{{ title }}</span>
            <button class="w-9 h-9 flex items-center justify-center rounded-lg text-white/75 hover:text-white hover:bg-white/15 transition-colors"
              v-tooltip.bottom="'Close'" aria-label="Close" @click="emit('close')">
              <i class="pi pi-times text-sm" />
            </button>
          </div>

          <div class="flex items-center px-4 md:px-6 py-3 gap-0 overflow-x-auto no-scrollbar">
            <template v-for="(s, idx) in steps" :key="s.key">
              <div class="flex items-center gap-2 shrink-0"
                :class="idx < modelValue ? 'cursor-pointer' : ''"
                @click="idx < modelValue && emit('update:modelValue', idx)">
                <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
                  :class="idx < modelValue
                    ? 'bg-primary text-white'
                    : idx === modelValue
                      ? 'bg-primary text-white ring-4 ring-primary/20'
                      : 'bg-gray-100 text-gray-400'">
                  <i v-if="idx < modelValue" class="pi pi-check text-[10px]" />
                  <span v-else>{{ idx + 1 }}</span>
                </div>
                <span class="text-xs font-medium whitespace-nowrap hidden sm:inline"
                  :class="idx <= modelValue ? 'text-gray-800' : 'text-gray-400'">{{ s.label }}</span>
              </div>
              <div v-if="idx < steps.length - 1" class="flex-1 min-w-[16px] h-px mx-2 shrink-0"
                :class="idx < modelValue ? 'bg-primary' : 'bg-gray-200'" />
            </template>
          </div>
        </div>

        <!-- Body: step content on the left, live summary rail on the right -->
        <div class="flex-1 flex min-h-0">
          <!-- ONE wrapper, class-toggled (never v-if/v-else — that remounts the slot
               and would reset an embedded builder). Full-bleed = fill body with a
               small inset; otherwise padded + max-width + scrolling. -->
          <div class="flex-1 min-w-0 bg-[#F5F8FA] flex flex-col" :class="fullBleed ? 'overflow-hidden' : 'overflow-y-auto'">
            <div :class="fullBleed
              ? 'flex-1 min-h-0 flex flex-col p-3 sm:p-4'
              : 'max-w-[1340px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6'">
              <slot />
            </div>
          </div>
          <aside v-if="$slots.summary && !fullBleed" class="hidden lg:flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white overflow-y-auto">
            <slot name="summary" />
          </aside>
        </div>

        <!-- Footer nav — Back + Next both grouped on the RIGHT (global wizard rule). -->
        <div v-if="!hideFooter" class="shrink-0 border-t border-gray-200 bg-white px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
          <Button v-if="modelValue > 0" label="Back" icon="pi pi-chevron-left"
            severity="secondary" outlined size="small"
            @click="emit('update:modelValue', modelValue - 1)" />
          <Button
            :label="isLast ? finishLabel : 'Next'"
            :icon="isLast ? 'pi pi-check' : 'pi pi-chevron-right'"
            icon-pos="right" size="small"
            :disabled="!canNext"
            :loading="saving && isLast"
            @click="onNext"
            style="background:var(--brand-primary); border-color:var(--brand-primary)" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
