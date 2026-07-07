<!--
  Buttons dashboard widget (buttons:<id> instance). One or more link buttons —
  label, URL and colour, laid out in a row or stacked. Self-contained: renders +
  owns its config dialog, emits `update:opts` to persist.
-->
<script setup lang="ts">
const props = defineProps<{ opts: any; editable?: boolean }>()
const emit = defineEmits<{ (e: 'update:opts', v: any): void }>()

const title = computed(() => props.opts?.title ?? '')
const layout = computed(() => props.opts?.layout ?? 'stack')
const buttons = computed<any[]>(() => Array.isArray(props.opts?.buttons) ? props.opts.buttons : [])

const cfgOpen = ref(false)
const draft = reactive<{ title: string; layout: string; buttons: any[] }>({ title: '', layout: 'stack', buttons: [] })
function openCfg() {
  draft.title = props.opts?.title ?? ''
  draft.layout = props.opts?.layout ?? 'stack'
  draft.buttons = (props.opts?.buttons ?? []).map((b: any) => ({ label: b.label ?? '', href: b.href ?? '', color: b.color ?? '#1E2157' }))
  if (!draft.buttons.length) draft.buttons = [{ label: 'View', href: '', color: '#1E2157' }]
  cfgOpen.value = true
}
function addBtn() { draft.buttons.push({ label: '', href: '', color: '#1E2157' }) }
function removeBtn(i: number) { draft.buttons.splice(i, 1) }
function save() {
  emit('update:opts', { title: draft.title.trim(), layout: draft.layout, buttons: draft.buttons.filter(b => b.label.trim()) })
  cfgOpen.value = false
}
// internal links (start with /) route in-app; external open in a new tab
function isInternal(href: string) { return typeof href === 'string' && href.startsWith('/') }
</script>

<template>
  <div class="card h-full flex flex-col overflow-hidden relative">
    <button v-if="editable" type="button"
      class="absolute top-1.5 right-9 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-primary pointer-events-auto"
      title="Configure buttons" @click="openCfg"><i class="pi pi-cog text-xs" /></button>

    <div v-if="title" class="px-4 py-3 border-b border-gray-100 shrink-0"><p class="text-sm font-semibold text-gray-800">{{ title }}</p></div>

    <div class="p-4 flex-1 overflow-auto flex" :class="layout === 'row' ? 'flex-row flex-wrap items-start gap-2' : 'flex-col gap-2'">
      <p v-if="!buttons.length" class="text-sm text-gray-400 text-center w-full py-6">No buttons yet.<span v-if="editable"> Click the cog to add one.</span></p>
      <template v-for="(b, i) in buttons" :key="i">
        <NuxtLink v-if="isInternal(b.href)" :to="b.href"
          class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110 transition"
          :class="layout === 'stack' ? 'w-full' : ''" :style="{ background: b.color || '#1E2157' }">{{ b.label }}</NuxtLink>
        <a v-else :href="b.href || '#'" target="_blank" rel="noopener"
          class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110 transition"
          :class="layout === 'stack' ? 'w-full' : ''" :style="{ background: b.color || '#1E2157' }">{{ b.label }}</a>
      </template>
    </div>

    <Dialog v-model:visible="cfgOpen" modal header="Buttons" :style="{ width: '95vw', maxWidth: '34rem' }">
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1.5 sm:col-span-2"><label class="text-xs font-medium text-gray-500">Title <span class="text-gray-300">— optional</span></label><InputText v-model="draft.title" placeholder="e.g. Quick links" /></div>
          <div class="flex flex-col gap-1.5"><label class="text-xs font-medium text-gray-500">Layout</label><Select v-model="draft.layout" :options="[{label:'Stacked',value:'stack'},{label:'Row',value:'row'}]" optionLabel="label" optionValue="value" /></div>
        </div>
        <div class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Buttons</p>
          <div v-for="(b, i) in draft.buttons" :key="i" class="flex items-center gap-2">
            <input type="color" v-model="b.color" class="w-9 h-9 rounded border border-gray-200 shrink-0 cursor-pointer" />
            <InputText v-model="b.label" placeholder="Label" class="w-32 shrink-0" />
            <InputText v-model="b.href" placeholder="/dashboard or https://…" class="flex-1 min-w-0" />
            <button type="button" class="text-gray-300 hover:text-red-500" @click="removeBtn(i)"><i class="pi pi-times-circle" /></button>
          </div>
          <button type="button" class="text-sm text-primary hover:underline" @click="addBtn"><i class="pi pi-plus text-[10px] mr-1" />Add button</button>
        </div>
      </div>
      <template #footer><Button label="Done" @click="save" style="background:#1E2157;border-color:#1E2157" /></template>
    </Dialog>
  </div>
</template>
