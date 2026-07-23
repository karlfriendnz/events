<template>
  <!-- THE shared "Communication preferences" control — used by the form builder AND the
       live registration form, so both show the exact same per-person picker + matrix.
       You pick WHO this person receives club updates on behalf of; "Customise" opens a
       people × updates × channel (email/app) grid. Subscriptions are stored as a flat
       map keyed "personId|topicId|channel" so the value round-trips cleanly. -->
  <div class="space-y-1.5" @click.stop>
    <p class="text-sm text-gray-700">Select who <span class="font-semibold">{{ subjectName || 'this person' }}</span> receives communications on behalf of</p>
    <div class="flex items-center gap-2">
      <MultiSelect :modelValue="peopleModel" @update:modelValue="setPeople" :options="people"
        optionLabel="label" optionValue="id" display="chip" :showToggleAll="false"
        placeholder="Select people…" class="flex-1 min-w-0" />
      <button type="button"
        class="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:border-primary text-gray-600 transition-colors"
        @click.stop="dialogOpen = true">
        <i class="pi pi-sliders-h text-xs" />Customise
      </button>
    </div>

    <Dialog v-model:visible="dialogOpen" modal header="Communication preferences" :style="{ width: '560px' }">
      <p class="text-sm text-gray-500 -mt-1 mb-3">Choose how each person receives each update — by email (<i class="pi pi-envelope text-[10px]" />) and/or app (<i class="pi pi-mobile text-[10px]" />).</p>
      <p v-if="!topics.length" class="text-sm text-gray-400 py-2">No communication topics yet — add them in Settings → Communications.</p>
      <p v-else-if="!people.length" class="text-sm text-gray-400 py-2">Add a person to the form to choose communications.</p>
      <template v-else>
        <div class="flex justify-end mb-2">
          <button type="button"
            class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-primary hover:text-primary transition-colors"
            @click="toggleAll">
            <i :class="['pi', allOn ? 'pi-times' : 'pi-check', 'text-[10px]']" />{{ allOn ? 'Clear all' : 'Select all' }}
          </button>
        </div>
        <div class="rounded-xl border border-gray-200 overflow-hidden">
          <table class="w-full text-sm border-collapse table-fixed">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100">
                <th class="text-left font-semibold text-gray-400 text-[11px] uppercase tracking-wide px-4 py-2.5">Updates</th>
                <th v-for="p in people" :key="p.id" class="px-3 py-2.5">
                  <button type="button" v-tooltip.top="colOn(p.id) ? 'Turn all off for this person' : 'Turn all on for this person'"
                    class="font-semibold text-gray-600 text-xs text-center truncate max-w-full hover:text-primary hover:underline mx-auto block"
                    @click="toggleCol(p.id)">{{ p.label }}</button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in topics" :key="t.id" class="border-b border-gray-50 last:border-0">
                <td class="px-4 py-3">
                  <button type="button" v-tooltip.top="rowOn(t) ? 'Turn this update off for everyone' : 'Turn this update on for everyone'"
                    class="text-gray-700 font-medium text-left truncate max-w-full hover:text-primary hover:underline"
                    @click="toggleRow(t)">{{ t.name }}</button>
                </td>
                <td v-for="p in people" :key="p.id" class="px-3 py-3">
                  <div class="flex items-center justify-center gap-1.5">
                    <template v-for="ch in CHANNELS" :key="ch">
                      <button v-if="t.channels.includes(ch)" type="button"
                        v-tooltip.top="ch === 'email' ? 'Email' : 'App notification'"
                        class="w-7 h-7 rounded-lg border inline-flex items-center justify-center transition-colors"
                        :class="sub(p.id, t.id, ch) ? 'bg-primary border-primary text-white' : 'border-gray-200 text-gray-300 hover:border-primary/50'"
                        @click="toggleSub(p.id, t.id, ch)">
                        <i :class="['pi', ch === 'email' ? 'pi-envelope' : 'pi-mobile', 'text-[11px]']" />
                      </button>
                      <span v-else class="w-7 h-7 inline-block" />
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #footer>
        <Button label="Done" @click="dialogOpen = false" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  /** Whose form this is — "Select who {name} receives…". */
  subjectName?: string
  /** People this subject can receive comms on behalf of. */
  people: { id: string; label: string }[]
  /** The club's communication topics, each with its delivery channels. */
  topics: { id: string; name: string; channels: string[] }[]
  /** Subscriptions map, keyed "personId|topicId|channel". */
  modelValue?: Record<string, boolean> | null
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: Record<string, boolean>): void }>()

const CHANNELS = ['email', 'app'] as const
const dialogOpen = ref(false)
const subs = () => props.modelValue || {}
const sub = (pid: string, tid: string, ch: string) => !!subs()[`${pid}|${tid}|${ch}`]

function setKeys(keys: string[], on: boolean) {
  const next = { ...subs() }
  for (const k of keys) next[k] = on
  emit('update:modelValue', next)
}
function toggleSub(pid: string, tid: string, ch: string) {
  const k = `${pid}|${tid}|${ch}`
  emit('update:modelValue', { ...subs(), [k]: !subs()[k] })
}
const allKeys = () => props.people.flatMap(p => props.topics.flatMap(t => t.channels.map(ch => `${p.id}|${t.id}|${ch}`)))
const allOn = computed(() => { const k = allKeys(); return k.length > 0 && k.every(x => subs()[x]) })
const toggleAll = () => setKeys(allKeys(), !allOn.value)
const rowKeys = (t: any) => props.people.flatMap(p => t.channels.map((ch: string) => `${p.id}|${t.id}|${ch}`))
const rowOn = (t: any) => { const k = rowKeys(t); return k.length > 0 && k.every(x => subs()[x]) }
const toggleRow = (t: any) => setKeys(rowKeys(t), !rowOn(t))
const colKeys = (pid: string) => props.topics.flatMap(t => t.channels.map(ch => `${pid}|${t.id}|${ch}`))
const colOn = (pid: string) => { const k = colKeys(pid); return k.length > 0 && k.every(x => subs()[x]) }
const toggleCol = (pid: string) => setKeys(colKeys(pid), !colOn(pid))

// A person is "selected" in the picker when any of their channels is on. Selecting a
// name turns everything on for them (unless they were already customised); deselecting
// clears them.
const peopleModel = computed(() =>
  props.people.filter(p => props.topics.some(t => t.channels.some(ch => sub(p.id, t.id, ch)))).map(p => p.id))
function setPeople(ids: string[]) {
  const next = { ...subs() }
  for (const p of props.people) {
    const keys = colKeys(p.id)
    const currentlyOn = keys.some(k => next[k])
    if (ids.includes(p.id)) { if (!currentlyOn) keys.forEach(k => { next[k] = true }) }
    else keys.forEach(k => { next[k] = false })
  }
  emit('update:modelValue', next)
}
</script>
