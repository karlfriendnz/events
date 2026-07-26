<!--
  A textarea that understands `@name`.

  Type `@`, pick a reviewer, and the comment records WHO it addresses — so it can
  reach them wherever they are, rather than relying on them wandering onto the
  same page.

  Mentions are re-derived from the text on every change and emitted as reviewer
  IDS. Deriving (rather than tracking insertions separately) means deleting the
  "@kate" from the text also removes the mention, which is what anyone editing
  would expect; storing ids (rather than the raw text) means a later rename of a
  reviewer can't orphan it.

  Exists as a component because the panel needs this in three places — the new
  comment composer, the reply box, and the edit box — and three copies of caret
  arithmetic would drift.
-->
<template>
  <div class="relative">
    <textarea
      ref="ta"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :class="textareaClass"
      @input="onInput"
      @keydown="onKeydown"
      @blur="closeSoon" />

    <!-- Suggestions. Positioned under the box rather than at the caret: caret
         coordinates in a textarea need a mirrored element to measure, which is a
         lot of machinery for a five-person list. -->
    <ul v-if="open && matches.length"
      class="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg
             max-h-40 overflow-y-auto py-1">
      <li v-for="(r, i) in matches" :key="r.id">
        <button type="button"
          class="w-full text-left px-2 py-1 text-xs flex items-center gap-1.5"
          :class="i === activeIndex ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'"
          @mousedown.prevent="choose(r)">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: r.color || '#94a3b8' }" />
          <span class="font-medium">{{ r.name }}</span>
          <span v-if="r.role" class="text-[10px] text-gray-400">{{ r.role }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
interface Reviewer { id: string; name: string; role?: string | null; color?: string | null }

const props = withDefaults(defineProps<{
  modelValue: string
  reviewers: Reviewer[]
  placeholder?: string
  rows?: number
  textareaClass?: string
}>(), {
  placeholder: '',
  rows: 3,
  textareaClass: 'w-full text-xs border border-gray-200 rounded-md p-2 focus:outline-none focus:border-primary',
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:mentions', ids: string[]): void
}>()

const ta = ref<HTMLTextAreaElement | null>(null)
const open = ref(false)
const query = ref('')
const activeIndex = ref(0)

/** The `@word` being typed immediately before the caret, if any. */
function activeToken(el: HTMLTextAreaElement): { text: string; start: number } | null {
  const upto = el.value.slice(0, el.selectionStart ?? 0)
  // Only after whitespace or at the very start, so an email address doesn't
  // pop the picker open halfway through.
  const m = /(?:^|\s)@([\w-]*)$/.exec(upto)
  if (!m) return null
  return { text: m[1], start: upto.length - m[1].length - 1 }
}

const matches = computed(() => {
  const q = query.value.toLowerCase()
  return props.reviewers
    .filter(r => !q || r.name.toLowerCase().startsWith(q))
    .slice(0, 6)
})

/** Reviewer ids named anywhere in the text. Whole-word, case-insensitive. */
function deriveMentions(text: string): string[] {
  const ids: string[] = []
  for (const r of props.reviewers) {
    const name = r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?:^|\\s)@${name}\\b`, 'i').test(text)) ids.push(r.id)
  }
  return ids
}

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  emit('update:modelValue', el.value)
  emit('update:mentions', deriveMentions(el.value))
  const tok = activeToken(el)
  open.value = !!tok
  query.value = tok?.text ?? ''
  activeIndex.value = 0
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value || !matches.value.length) return
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex.value = (activeIndex.value + 1) % matches.value.length }
  else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex.value = (activeIndex.value - 1 + matches.value.length) % matches.value.length }
  else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(matches.value[activeIndex.value]) }
  else if (e.key === 'Escape') { e.preventDefault(); open.value = false }
}

function choose(r: Reviewer) {
  const el = ta.value
  if (!el) return
  const tok = activeToken(el)
  if (!tok) { open.value = false; return }
  const caret = el.selectionStart ?? 0
  const next = `${el.value.slice(0, tok.start)}@${r.name} ${el.value.slice(caret)}`
  emit('update:modelValue', next)
  emit('update:mentions', deriveMentions(next))
  open.value = false
  nextTick(() => {
    const pos = tok.start + r.name.length + 2
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

// Blur fires before a click on the list registers, so closing is deferred —
// mousedown.prevent on the option is what actually makes the click land.
function closeSoon() { setTimeout(() => { open.value = false }, 120) }

defineExpose({ focus: () => ta.value?.focus() })
</script>
