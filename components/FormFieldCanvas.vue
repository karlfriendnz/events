<template>
  <!-- Empty state -->
  <div v-if="!modelValue.length"
    class="border-2 border-dashed rounded-xl py-10 text-center transition-all"
    :class="dropActive ? 'border-[#0e43a3] bg-blue-50/30' : 'border-gray-200 bg-[#fafaf9]'"
    @dragover.prevent="onDragOver"
    @dragleave="dropActive = false"
    @drop.prevent="onDrop">
    <i class="pi pi-arrow-circle-down mb-1.5 text-sm" :class="dropActive ? 'text-[#0e43a3]' : 'text-gray-300'" />
    <p class="text-sm font-semibold" :class="dropActive ? 'text-[#0e43a3]' : 'text-gray-400'">
      {{ dropActive ? 'Drop to add field' : (emptyText ?? 'Drag fields here') }}
    </p>
    <slot name="empty-action" />
  </div>

  <!-- Sectioned layout: top-level sections, then ONE Tabs element (a tab strip + per-tab pages) -->
  <div v-else-if="sectioned" ref="sectionRootEl" class="space-y-3"
    @dragover.prevent="onDragOver" @dragleave="dropActive = false" @drop.prevent="onDrop">
    <template v-for="c in renderContainers" :key="c.key">
      <!-- Tabs element bar -->
      <div v-if="c.type === 'tabsbar'"
        class="pfc-tabsel flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#0e43a3]/30 bg-[#0e43a3]/5"
        :class="editingKey === c.el._key ? 'ring-2 ring-[#0e43a3]/40' : ''"
        :data-tabs-key="c.el._key">
        <i class="pi pi-folder text-[#0e43a3] text-xs shrink-0" />
        <div class="flex items-center gap-1 flex-1 overflow-x-auto overflow-y-hidden">
          <button v-for="t in c.el.tabs" :key="t.id" type="button"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition-colors"
            :class="activeTabId === t.id ? 'bg-[#0e43a3] text-white' : 'text-[#0e43a3] hover:bg-[#0e43a3]/10'"
            @click="setActive(t.id)"><i v-if="t.icon" :class="`${t.icon} text-[10px]`" />{{ t.label || 'Tab' }}</button>
        </div>
        <button type="button" class="text-[#0e43a3]/60 hover:text-[#0e43a3] shrink-0" v-tooltip.top="'Edit tabs'"
          @click="$emit('select', c.el._key)"><i class="pi pi-cog text-xs" /></button>
      </div>

      <!-- A groups container: top-level (tab_id '') or one tab page -->
      <div v-else v-show="c.type !== 'tabpage' || activeTabId === c.tabId"
        class="pfc-cgroups grid grid-cols-2 gap-3 items-start" :data-tab-id="c.tabId">
        <div v-for="grp in c.groups" :key="grp.key"
          class="pfc-group rounded-xl border border-gray-200 bg-white overflow-hidden"
          :class="[grp.key.startsWith('__top') ? 'border-dashed' : '', (grp.section && grp.section.col_span !== 2) ? 'col-span-1' : 'col-span-2']"
          :data-section-key="grp.key">
          <div v-if="grp.section"
            class="flex items-start gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 group/sec cursor-pointer transition-all"
            :class="editingKey === grp.section._key ? 'ring-2 ring-inset ring-[#0e43a3]/40' : 'hover:bg-gray-100'"
            @click="$emit('select', grp.section._key)">
            <span class="pfc-section-handle cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary shrink-0 mt-0.5"
              v-tooltip.top="'Drag to reorder section'" @click.stop @mousedown.stop><i class="pi pi-bars text-xs" /></span>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold text-gray-800 truncate">{{ grp.section.label || 'Section heading' }}</h3>
              <p v-if="grp.section.placeholder" class="text-xs text-gray-400 mt-0.5 truncate">{{ grp.section.placeholder }}</p>
            </div>
            <img v-if="grp.section.block && grp.section.block[0]" :src="grp.section.block[0]" class="h-11 w-auto object-contain shrink-0" />
            <i class="pi pi-pencil text-[9px] text-gray-300 opacity-0 group-hover/sec:opacity-100 transition-opacity mt-0.5 shrink-0" />
          </div>
          <div v-else class="px-4 pt-2.5 text-[10px] font-semibold text-gray-300 uppercase tracking-widest">Unsectioned</div>

          <div class="pfc-fields grid gap-x-8 gap-y-5 p-4 sm:p-5 min-h-[40px]" :class="(grp.section && grp.section.col_span !== 2) ? 'grid-cols-1' : 'grid-cols-2'" :data-section-key="grp.key">
            <div v-for="f in grp.fields" :key="f._key"
              :data-field-key="f._key" :data-pinned="isPinned(f) ? 'true' : null"
              :class="[
                f.col_span === 1 ? 'col-span-1' : 'col-span-2',
                editingKey === f._key ? 'ring-2 ring-[#0e43a3]/40 bg-blue-50/20' : 'hover:ring-2 hover:ring-[#0e43a3]/20 hover:bg-blue-50/20',
              ]"
              class="space-y-1 group cursor-pointer rounded-lg px-2 py-1 transition-all relative"
              @click="$emit('select', f._key)">
              <span v-if="!isPinned(f)"
                class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10"
                v-tooltip.top="'Drag to move'" @click.stop @mousedown.stop><i class="pi pi-arrows-alt text-[11px]" /></span>
              <CanvasFieldPreview :f="f" />
            </div>
            <p v-if="!grp.fields.length" class="col-span-2 text-xs text-gray-300 italic py-1 text-center">Drag fields here</p>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Flat layout (default) -->
  <div v-else ref="listEl" class="grid grid-cols-2 gap-3"
    @dragover.prevent="onDragOver"
    @dragleave="dropActive = false"
    @drop.prevent="onDrop">
    <div v-for="f in modelValue" :key="f._key"
      :data-field-key="f._key"
      :data-pinned="isPinned(f) ? 'true' : null"
      :class="[
        f.col_span === 1 ? 'col-span-1' : 'col-span-2',
        editingKey === f._key
          ? 'ring-2 ring-[#0e43a3]/40 bg-blue-50/20'
          : 'hover:ring-2 hover:ring-[#0e43a3]/20 hover:bg-blue-50/20',
      ]"
      class="space-y-1 group cursor-pointer rounded-lg px-2 py-1 -mx-2 transition-all relative"
      @click="$emit('select', f._key)">
      <span v-if="!isPinned(f)"
        class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10"
        v-tooltip.top="'Drag to reorder'"
        @click.stop
        @mousedown.stop>
        <i class="pi pi-arrows-alt text-[11px]" />
      </span>
      <CanvasFieldPreview :f="f" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Sortable from 'sortablejs'

interface CanvasField {
  _key: string
  field_type: string
  label: string
  is_required?: boolean
  placeholder?: string
  has_placeholder?: boolean
  helper_text?: string
  has_helper_text?: boolean
  col_span?: 1 | 2
  _optionsText?: string
  options?: any
  core?: string
  tab_id?: string | null
  tabs?: { id: string; label: string; icon?: string }[]
}

const props = defineProps<{
  modelValue: CanvasField[]
  editingKey?: string | null
  pinnedRoles?: string[]
  emptyText?: string
  sectioned?: boolean
  activeTab?: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: CanvasField[]): void
  (e: 'update:activeTab', id: string): void
  (e: 'select', key: string): void
  (e: 'drop', payload: string): void
}>()

const listEl = ref<HTMLElement | null>(null)
const sectionRootEl = ref<HTMLElement | null>(null)
let sortable: any = null
let sectionSortables: any[] = []
const dropActive = ref(false)

function isPinned(f: CanvasField) {
  return !!(f.core && (props.pinnedRoles ?? []).includes(f.core))
}

// Group a list of items into section containers (leading "no section" group + one per section).
function groupItems(items: CanvasField[]) {
  const out: { key: string; section: CanvasField | null; fields: CanvasField[] }[] = []
  let cur: { key: string; section: CanvasField | null; fields: CanvasField[] } = { key: '__top', section: null, fields: [] }
  out.push(cur)
  for (const f of items) {
    if (f.field_type === 'section') { cur = { key: f._key, section: f, fields: [] }; out.push(cur) }
    else cur.fields.push(f)
  }
  // unique keys for "no section" boxes
  for (const g of out) if (!g.section) g.key = '__top_' + (g.fields[0]?._key ?? 'x')
  return out.filter((g, i) => (i === 0 ? (g.fields.length > 0 || out.length === 1) : true))
}

const tabsEl = computed(() => props.modelValue.find(f => f.field_type === 'tabs') || null)
const topItems = computed(() => props.modelValue.filter(f => f.field_type !== 'tabs' && !f.tab_id))
function itemsForTab(id: string) { return props.modelValue.filter(f => f.field_type !== 'tabs' && f.tab_id === id) }

// Ordered list of render containers: top-level groups, the tabs bar, then a page per tab.
const renderContainers = computed(() => {
  const out: any[] = []
  out.push({ type: 'toplevel', key: '__toplevel', tabId: '', groups: groupItems(topItems.value) })
  if (tabsEl.value) {
    out.push({ type: 'tabsbar', key: 'tabsbar:' + tabsEl.value._key, el: tabsEl.value })
    for (const t of (tabsEl.value.tabs ?? [])) {
      out.push({ type: 'tabpage', key: 'page:' + t.id, tabId: t.id, groups: groupItems(itemsForTab(t.id)) })
    }
  }
  return out
})

const activeTabId = ref('')
watch(tabsEl, (el) => {
  const ids = (el?.tabs ?? []).map(t => t.id)
  if (!ids.includes(activeTabId.value)) activeTabId.value = ids[0] ?? ''
}, { immediate: true })
function setActive(id: string) { activeTabId.value = id; emit('update:activeTab', id) }
watch(activeTabId, id => emit('update:activeTab', id), { immediate: true })

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('text/plain')) {
    dropActive.value = true
    e.dataTransfer.dropEffect = 'copy'
  }
}
function onDrop(e: DragEvent) {
  dropActive.value = false
  const payload = e.dataTransfer?.getData('text/plain')
  if (payload) emit('drop', payload)
}

function repin(list: CanvasField[]): CanvasField[] {
  const pinnedRoles = props.pinnedRoles ?? []
  if (!pinnedRoles.length) return list
  const pinned = pinnedRoles.map(role => list.find(f => f.core === role)).filter(Boolean) as CanvasField[]
  const rest = list.filter(f => !pinnedRoles.includes(f.core ?? ''))
  return [...pinned, ...rest]
}

// ── Flat-mode sortable ──
watch(listEl, (el) => {
  if (sortable) { sortable.destroy(); sortable = null }
  if (!el) return
  sortable = Sortable.create(el, {
    handle: '.field-drag-handle',
    animation: 150,
    filter: '[data-pinned="true"]',
    onMove: (evt: any) => evt.related?.dataset?.pinned !== 'true',
    onEnd: () => {
      const orderedKeys = Array.from(el.querySelectorAll<HTMLElement>('[data-field-key]')).map(n => n.dataset.fieldKey!)
      const next = [...props.modelValue].sort((a, b) => orderedKeys.indexOf(a._key) - orderedKeys.indexOf(b._key))
      emit('update:modelValue', repin(next))
    },
  })
})

// ── Sectioned-mode sortables ──
function destroySectioned() { sectionSortables.forEach(s => s.destroy()); sectionSortables = [] }
function pushBox(box: HTMLElement, tid: string | null, byKey: Record<string, CanvasField>, next: CanvasField[]) {
  const secKey = box.getAttribute('data-section-key')
  if (secKey && !secKey.startsWith('__top') && byKey[secKey]) next.push({ ...byKey[secKey], tab_id: tid })
  box.querySelectorAll<HTMLElement>('.pfc-fields [data-field-key]').forEach(node => {
    const k = node.dataset.fieldKey!
    if (byKey[k]) next.push({ ...byKey[k], tab_id: tid })
  })
}
function serializeSectioned() {
  const root = sectionRootEl.value
  if (!root) return
  const byKey = Object.fromEntries(props.modelValue.map(f => [f._key, f]))
  const next: CanvasField[] = []
  Array.from(root.children).forEach(node => {
    const el = node as HTMLElement
    if (el.classList.contains('pfc-tabsel')) {
      const k = el.getAttribute('data-tabs-key')
      if (k && byKey[k]) next.push(byKey[k])
    } else if (el.classList.contains('pfc-cgroups')) {
      const tid = el.getAttribute('data-tab-id') || null
      el.querySelectorAll<HTMLElement>(':scope > .pfc-group').forEach(box => pushBox(box, tid, byKey, next))
    }
  })
  emit('update:modelValue', repin(next))
}
function buildSectioned() {
  destroySectioned()
  const root = sectionRootEl.value
  if (!root) return
  // Field lists — shared group so fields drag between sections AND across tab pages / top-level.
  root.querySelectorAll<HTMLElement>('.pfc-fields').forEach(el => {
    sectionSortables.push(Sortable.create(el, {
      group: { name: 'pfc', pull: true, put: true },
      handle: '.field-drag-handle',
      animation: 150,
      filter: '[data-pinned="true"]',
      onMove: (evt: any) => evt.related?.dataset?.pinned !== 'true',
      onEnd: serializeSectioned,
      onAdd: serializeSectioned,
    }))
  })
  // Section reorder within each container.
  root.querySelectorAll<HTMLElement>('.pfc-cgroups').forEach(el => {
    sectionSortables.push(Sortable.create(el, {
      handle: '.pfc-section-handle',
      draggable: '.pfc-group',
      animation: 150,
      onEnd: serializeSectioned,
    }))
  })
}

watch(() => [props.sectioned, renderContainers.value] as const, () => {
  if (props.sectioned) nextTick(buildSectioned)
  else destroySectioned()
}, { immediate: true })

onBeforeUnmount(() => {
  if (sortable) { sortable.destroy(); sortable = null }
  destroySectioned()
})
</script>
