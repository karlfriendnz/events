<!--
  Drag an image inside its box to choose which part shows.

  A banner is displayed at several shapes across the app — a 128px strip in the
  wizard, a taller hero on the public form, a card thumbnail — and `object-fit:
  cover` centres by default, which crops the wrong part of any photo whose
  subject isn't dead centre.

  This stores a FOCAL POINT (a CSS `object-position`), not a crop. The original
  file is untouched, so every box re-frames correctly from the same image; a
  crop would have baked one box's aspect ratio into the file and looked wrong
  everywhere else.

  Only the axis that actually overflows can move: on an image wider than its box
  there is nothing to gain by dragging vertically, and letting it move anyway
  feels broken. When neither axis overflows, dragging is disabled outright.
-->
<template>
  <div ref="box" class="relative overflow-hidden select-none" :class="boxClass">
    <img
      ref="img"
      :src="src"
      class="w-full h-full object-cover"
      :class="editable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''"
      :style="{ objectPosition: position }"
      draggable="false"
      @load="measure"
      @pointerdown="onPointerDown" />

    <!-- Affordance. Hidden while dragging so it doesn't sit over the thing
         you're trying to look at. -->
    <div v-if="editable && canDrag && !dragging"
      class="absolute inset-x-0 bottom-0 flex justify-center pb-1.5 pointer-events-none
             opacity-0 group-hover/banner:opacity-100 transition-opacity">
      <span class="text-[10px] font-medium text-white bg-black/55 rounded px-1.5 py-0.5">
        <i class="pi pi-arrows-alt text-[9px] mr-1" />Drag to reposition
      </span>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  src: string
  /** CSS object-position, e.g. "50% 30%". Empty/null = centre. */
  modelValue?: string | null
  editable?: boolean
  boxClass?: string
}>(), { modelValue: null, editable: false, boxClass: '' })

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const box = ref<HTMLElement | null>(null)
const img = ref<HTMLImageElement | null>(null)
const dragging = ref(false)

// Percentages, 0–100. Centre is the CSS default and the sane starting point.
const px = ref(50)
const py = ref(50)
watch(() => props.modelValue, (v) => {
  const m = /^\s*([\d.]+)%\s+([\d.]+)%\s*$/.exec(v ?? '')
  px.value = m ? Number(m[1]) : 50
  py.value = m ? Number(m[2]) : 50
}, { immediate: true })

const position = computed(() => `${px.value}% ${py.value}%`)

/**
 * Which axes actually overflow the box once the image is covered.
 * Dragging an axis with nothing hidden does nothing visible, so we don't offer it.
 */
const overflowX = ref(false)
const overflowY = ref(false)
const canDrag = computed(() => overflowX.value || overflowY.value)

function measure() {
  const b = box.value, i = img.value
  if (!b || !i || !i.naturalWidth || !i.naturalHeight) return
  const boxRatio = b.clientWidth / b.clientHeight
  const imgRatio = i.naturalWidth / i.naturalHeight
  // cover scales to the LARGER ratio; the other axis is what spills over.
  overflowX.value = imgRatio > boxRatio + 0.001
  overflowY.value = imgRatio < boxRatio - 0.001
}
onMounted(measure)
useResizeObserverSafe(box, measure)

let startX = 0, startY = 0, startPx = 50, startPy = 50
function onPointerDown(e: PointerEvent) {
  if (!props.editable || !canDrag.value) return
  e.preventDefault()
  dragging.value = true
  startX = e.clientX; startY = e.clientY
  startPx = px.value; startPy = py.value
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const b = box.value
  if (!b) return
  // Dragging RIGHT should reveal what's off to the left, i.e. decrease the
  // position percentage — hence the inversion. Scaled by the box size so the
  // image tracks the cursor rather than lagging or racing it.
  if (overflowX.value) px.value = clamp(startPx - ((e.clientX - startX) / b.clientWidth) * 100)
  if (overflowY.value) py.value = clamp(startPy - ((e.clientY - startY) / b.clientHeight) * 100)
}
function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  emit('update:modelValue', position.value)
}
function clamp(n: number) { return Math.min(100, Math.max(0, n)) }

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

/** ResizeObserver is absent in some test/SSR contexts; degrade rather than throw. */
function useResizeObserverSafe(el: Ref<HTMLElement | null>, cb: () => void) {
  let ro: ResizeObserver | null = null
  onMounted(() => {
    if (typeof ResizeObserver === 'undefined') return
    ro = new ResizeObserver(cb)
    if (el.value) ro.observe(el.value)
  })
  onBeforeUnmount(() => { ro?.disconnect(); ro = null })
}
</script>
