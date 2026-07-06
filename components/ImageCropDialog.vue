<!--
  ImageCropDialog — pick/crop an image before upload. Open it with a selected
  file's object URL (`src`); the user drags/resizes the crop box however they
  want, and on "Use image" the cropped result is uploaded via useUpload and the
  URL is emitted. Free-form by default; pass `aspectRatio` to lock a ratio.
-->
<script setup lang="ts">
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const props = withDefaults(defineProps<{ visible: boolean; src: string | null; aspectRatio?: number | null; title?: string }>(), {
  aspectRatio: null,
  title: 'Crop image',
})
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'cropped', url: string): void }>()

const { uploadFile } = useUpload()
const cropperRef = ref<any>(null)
const uploading = ref(false)

function close() { emit('update:visible', false) }

async function confirm() {
  const result = cropperRef.value?.getResult?.()
  const canvas: HTMLCanvasElement | undefined = result?.canvas
  if (!canvas) return
  uploading.value = true
  try {
    const blob: Blob | null = await new Promise(r => canvas.toBlob(b => r(b), 'image/jpeg', 0.9))
    if (!blob) return
    const file = new File([blob], 'group-image.jpg', { type: 'image/jpeg' })
    const url = await uploadFile(file)
    emit('cropped', url)
    close()
  } finally { uploading.value = false }
}
</script>

<template>
  <Dialog :visible="visible" @update:visible="v => emit('update:visible', v)" modal :header="title"
    :style="{ width: '95vw', maxWidth: '640px' }">
    <div v-if="src" class="space-y-3">
      <Cropper ref="cropperRef" :src="src"
        :stencil-props="aspectRatio ? { aspectRatio } : {}"
        image-restriction="stencil"
        class="rounded-lg bg-gray-900" style="max-height: 60vh" />
      <p class="text-xs text-gray-400">Drag the image to reposition, drag the box corners to resize the crop.</p>
    </div>
    <template #footer>
      <Button label="Cancel" text severity="secondary" @click="close" />
      <Button :label="uploading ? 'Saving…' : 'Use image'" :loading="uploading" icon="pi pi-check"
        style="background:#1E2157;border-color:#1E2157" @click="confirm" />
    </template>
  </Dialog>
</template>
