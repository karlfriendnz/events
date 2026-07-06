<!--
  Account-code input with a Xero lookup. Drop-in replacement for the free-text
  "Account code" / "GL" inputs on fee lines everywhere:
  - Xero NOT connected → renders a plain text input (behaviour unchanged).
  - Xero connected → the dropdown opens the moment the field is clicked/focused;
    what's typed doubles as the live filter. The club's SAVED account names are
    canonical — the raw Xero chart hides behind "Show all Xero accounts…".
  Picking stores the bare code, or the legacy {"code","tracking"} JSON when the
  entry carries tracking — JSON values render as a chip (× to clear).

  The dropdown is a MANUAL Teleport panel (not PrimeVue Popover): fixed-position
  from the input's rect with an explicit high z-index, so it works identically
  inside modal Dialogs, overflow-hidden tables and plain pages. Closes on
  outside pointerdown, Escape, scroll of any ancestor, or pick.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string | null
  placeholder?: string
  inputClass?: string
}>(), {
  modelValue: '',
  placeholder: 'Account code',
  inputClass: 'w-full h-10 px-2 text-sm text-gray-800 placeholder-gray-400 border border-gray-300 rounded-md outline-none focus:border-primary',
})
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const xa = useXeroAccounts()
onMounted(() => { xa.loadXeroAccounts() })

const wrapEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const open = ref(false)
const showAll = ref(false)
const panelStyle = ref<Record<string, string>>({})

function onInput(e: Event) { emit('update:modelValue', (e.target as HTMLInputElement).value) }

function position() {
  const el = wrapEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const width = Math.max(r.width, 288)
  const left = Math.min(r.left, window.innerWidth - width - 8)
  const spaceBelow = window.innerHeight - r.bottom
  const style: Record<string, string> = {
    position: 'fixed',
    left: `${Math.max(8, left)}px`,
    width: `${width}px`,
    zIndex: '12000',           // above PrimeVue Dialog masks (~1100s)
  }
  if (spaceBelow < 320 && r.top > 340) style.bottom = `${window.innerHeight - r.top + 4}px`
  else style.top = `${r.bottom + 4}px`
  panelStyle.value = style
}

function openPanel() {
  if (!xa.connected.value) return
  showAll.value = false
  xa.loadAllAccounts()
  position()
  open.value = true
}
function close() { open.value = false }

function pick(code: string, tracking?: Record<string, string> | null) {
  emit('update:modelValue', encodeXeroAccount(code, tracking))
  close()
}

// Close on any pointerdown outside the input + panel, Escape, resize/scroll.
function onDocDown(e: Event) {
  const t = e.target as Node
  if (wrapEl.value?.contains(t) || panelEl.value?.contains(t)) return
  close()
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
function onScroll(e: Event) {
  if (panelEl.value?.contains(e.target as Node)) return   // scrolling the list itself
  if (open.value) position()                              // follow the field
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocDown, true)
  document.addEventListener('keydown', onKey)
  window.addEventListener('resize', close)
  window.addEventListener('scroll', onScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocDown, true)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', close)
  window.removeEventListener('scroll', onScroll, true)
})

// A JSON (tracking-carrying) value renders as a chip — it isn't hand-editable.
const parsed = computed(() => parseXeroAccount(props.modelValue))
const isChip = computed(() => !!parsed.value.tracking)
const chipText = computed(() =>
  `${parsed.value.code} · ${Object.values(parsed.value.tracking ?? {}).join(' · ')}`)
function clearChip() { emit('update:modelValue', ''); close() }

const q = computed(() => isChip.value ? '' : String(props.modelValue ?? '').trim().toLowerCase())
const filteredShortlist = computed(() =>
  xa.shortlist.value.filter(a => !q.value || a.label.toLowerCase().includes(q.value) || a.code.toLowerCase().includes(q.value)))
// The club's SAVED names are canonical — the raw Xero chart stays tucked away
// behind "Show all" (auto-shown when nothing is saved yet, or while searching),
// and never repeats a code the club has already saved under its own name.
const filteredAll = computed(() => {
  if (xa.shortlist.value.length && !showAll.value && !q.value) return []
  const saved = new Set(xa.shortlist.value.map(a => a.code))
  const list = (xa.allAccounts.value ?? []).filter(a => !saved.has(a.code))
  return list
    .filter(a => !q.value || a.name.toLowerCase().includes(q.value) || a.code.toLowerCase().includes(q.value))
    .slice(0, 40)
})
const canShowAll = computed(() =>
  !!xa.shortlist.value.length && !showAll.value && !q.value && !xa.allLoading.value)
const hint = computed(() => xa.labelFor(props.modelValue) ?? undefined)
</script>

<template>
  <div ref="wrapEl" class="relative min-w-0">
    <!-- Tracking-carrying values show as a chip (code · options), cleared with × -->
    <div v-if="isChip" :class="[inputClass, '!pr-7 flex items-center overflow-hidden cursor-pointer']" :title="hint ?? chipText" @click="openPanel">
      <span class="inline-flex items-center gap-1 max-w-full rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
        <i class="pi pi-tag text-[9px] text-gray-400 shrink-0" />
        <span class="truncate">{{ chipText }}</span>
        <button type="button" class="shrink-0 text-gray-400 hover:text-red-500" title="Clear" @click.stop="clearChip">
          <i class="pi pi-times text-[9px]" />
        </button>
      </span>
    </div>
    <input v-else :value="modelValue ?? ''" type="text" :placeholder="placeholder" :title="hint"
      :class="[inputClass, xa.connected.value ? '!pr-7' : '']" @input="onInput" @focus="openPanel" @click="openPanel" />
    <button v-if="xa.connected.value" type="button" tabindex="-1" title="Look up Xero accounts"
      class="absolute right-0.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-primary hover:bg-gray-100 transition-colors"
      @click="open ? close() : openPanel()">
      <i class="pi pi-book text-xs" />
    </button>

    <Teleport to="body">
      <div v-if="open" ref="panelEl" :style="panelStyle"
        class="rounded-xl border border-gray-200 bg-white shadow-xl p-2"
        @mousedown.prevent>
        <div class="max-h-64 overflow-y-auto space-y-0.5">
          <template v-if="filteredShortlist.length">
            <div class="text-[10px] font-bold uppercase tracking-wide text-gray-400 px-1 mb-0.5">Accounts you use</div>
            <button v-for="a in filteredShortlist" :key="'s-' + a.code + a.label" type="button"
              class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-50"
              @click="pick(a.code, a.tracking)">
              <span class="flex-1 min-w-0 truncate">
                <span class="block truncate text-sm text-gray-800">{{ a.label }}</span>
                <span v-if="a.tracking && Object.keys(a.tracking).length" class="block truncate text-[11px] text-gray-400">
                  <i class="pi pi-tag text-[9px]" /> {{ Object.values(a.tracking).join(' · ') }}
                </span>
              </span>
              <span v-if="a.default" class="shrink-0 text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full" style="background:#13B5EA">Default</span>
              <span class="shrink-0 text-xs text-gray-400 font-mono">{{ a.code }}</span>
            </button>
            <div class="border-t border-gray-100 my-1.5" />
          </template>

          <div v-if="xa.allLoading.value && !filteredShortlist.length" class="flex items-center gap-2 px-1 py-2 text-xs text-gray-400">
            <i class="pi pi-spin pi-spinner text-xs" /> Loading your chart of accounts…
          </div>
          <button v-else-if="canShowAll" type="button"
            class="w-full px-2 py-1.5 rounded-md text-left text-xs text-gray-400 hover:text-primary hover:bg-gray-50"
            @click="showAll = true">Show all Xero accounts…</button>
          <template v-else-if="filteredAll.length">
            <div class="text-[10px] font-bold uppercase tracking-wide text-gray-400 px-1 mb-0.5">Other Xero accounts</div>
            <button v-for="a in filteredAll" :key="'a-' + a.code" type="button"
              class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-50"
              @click="pick(a.code)">
              <span class="flex-1 min-w-0 truncate text-sm text-gray-700">{{ a.name }}</span>
              <span class="shrink-0 text-xs text-gray-400 font-mono">{{ a.code }}</span>
            </button>
          </template>
          <div v-if="!filteredShortlist.length && !filteredAll.length && !xa.allLoading.value && !canShowAll"
            class="px-1 py-2 text-xs text-gray-400">No matching accounts.</div>
        </div>
        <NuxtLink to="/settings/xero" class="block px-1 mt-2 text-[11px] text-gray-400 hover:text-primary" @click="close">
          Manage accounts in Settings → Xero
        </NuxtLink>
      </div>
    </Teleport>
  </div>
</template>
