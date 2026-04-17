<template>
  <div class="rich-text-editor border border-gray-200 rounded-lg overflow-hidden" :class="{ 'opacity-60 pointer-events-none bg-gray-50': readonly }">
    <!-- Toolbar -->
    <div class="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded text-sm font-bold transition-colors"
        :class="editor?.isActive('bold') ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-200'"
        @click="editor?.chain().focus().toggleBold().run()">B</button>
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded text-sm italic transition-colors"
        :class="editor?.isActive('italic') ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-200'"
        @click="editor?.chain().focus().toggleItalic().run()">I</button>
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded text-sm underline transition-colors"
        :class="editor?.isActive('underline') ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-200'"
        @click="editor?.chain().focus().toggleUnderline().run()">U</button>
      <div class="w-px h-4 bg-gray-300 mx-1" />
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded transition-colors"
        :class="editor?.isActive('bulletList') ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-200'"
        @click="editor?.chain().focus().toggleBulletList().run()">
        <i class="pi pi-list text-xs" />
      </button>
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded transition-colors"
        :class="editor?.isActive('orderedList') ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-200'"
        @click="editor?.chain().focus().toggleOrderedList().run()">
        <i class="pi pi-sort-amount-down text-xs" />
      </button>
      <div class="w-px h-4 bg-gray-300 mx-1" />
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded transition-colors"
        :class="editor?.isActive('heading', { level: 2 }) ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-200'"
        @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()">
        <span class="text-xs font-bold">H</span>
      </button>
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded transition-colors text-gray-500 hover:bg-gray-200"
        @click="editor?.chain().focus().setHorizontalRule().run()">
        <span class="text-xs">—</span>
      </button>
      <div class="w-px h-4 bg-gray-300 mx-1" />
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded transition-colors text-gray-500 hover:bg-gray-200"
        :disabled="!editor?.can().undo()"
        @click="editor?.chain().focus().undo().run()">
        <i class="pi pi-undo text-xs" />
      </button>
      <button type="button"
        class="w-7 h-7 flex items-center justify-center rounded transition-colors text-gray-500 hover:bg-gray-200"
        :disabled="!editor?.can().redo()"
        @click="editor?.chain().focus().redo().run()">
        <i class="pi pi-refresh text-xs" />
      </button>
    </div>

    <!-- Editor content -->
    <EditorContent :editor="editor" class="prose prose-sm max-w-none" />
  </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { watch, onBeforeUnmount, computed } from 'vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  extensions: [
    StarterKit,
    Underline,
    Placeholder.configure({ placeholder: props.placeholder ?? 'Write something…' }),
  ],
  content: props.modelValue || '',
  editable: !props.readonly,
  onUpdate({ editor }) {
    const html = editor.getHTML()
    // Emit empty string when editor is blank
    emit('update:modelValue', html === '<p></p>' ? '' : html)
  },
  editorProps: {
    attributes: {
      class: 'outline-none px-4 py-3 min-h-[120px] text-sm text-gray-800',
    },
  },
})

watch(() => props.readonly, (val) => {
  editor.value?.setEditable(!val)
})

// Keep editor in sync if parent changes the value externally
watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  const current = editor.value.getHTML()
  const incoming = val || ''
  if (current !== incoming && !(current === '<p></p>' && incoming === '')) {
    editor.value.commands.setContent(incoming, false)
  }
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<style>
.rich-text-editor .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

.rich-text-editor .tiptap {
  outline: none;
}

.rich-text-editor .tiptap ul {
  list-style-type: disc;
  padding-left: 1.25rem;
}

.rich-text-editor .tiptap ol {
  list-style-type: decimal;
  padding-left: 1.25rem;
}

.rich-text-editor .tiptap h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.rich-text-editor .tiptap hr {
  border-color: #e5e7eb;
  margin: 0.5rem 0;
}
</style>
