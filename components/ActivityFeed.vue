<script setup lang="ts">
// Timeline feed of activity entries — coloured icon + a sentence (with linked
// entities) + date · author. Presentational: the host supplies `items`.
export interface ActivityPart { text: string; to?: string }
export interface ActivityItem {
  id: string | number
  type: string
  parts: ActivityPart[]
  date: string
  author?: string
}
defineProps<{ items: ActivityItem[] }>()

const STYLES: Record<string, { icon: string; bg: string; fg: string }> = {
  payment:          { icon: 'pi-dollar', bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  invoice:          { icon: 'pi-dollar', bg: 'bg-indigo-50',  fg: 'text-indigo-600' },
  registration:     { icon: 'pi-file',   bg: 'bg-sky-50',     fg: 'text-sky-600' },
  'group-add':      { icon: 'pi-users',  bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  'group-remove':   { icon: 'pi-users',  bg: 'bg-rose-50',    fg: 'text-rose-500' },
  'group-transfer': { icon: 'pi-users',  bg: 'bg-orange-50',  fg: 'text-orange-500' },
}
const styleFor = (t: string) => STYLES[t] || { icon: 'pi-circle-fill', bg: 'bg-gray-100', fg: 'text-gray-500' }
</script>

<template>
  <ul v-if="items.length" class="divide-y divide-gray-100">
    <li v-for="it in items" :key="it.id" class="flex items-start gap-3 py-3.5">
      <span class="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" :class="[styleFor(it.type).bg, styleFor(it.type).fg]">
        <i class="pi text-sm" :class="styleFor(it.type).icon" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm text-gray-800 leading-snug"><template v-for="(p, i) in it.parts" :key="i"><NuxtLink v-if="p.to" :to="p.to" class="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-500">{{ p.text }}</NuxtLink><span v-else>{{ p.text }}</span></template></p>
        <p class="text-xs text-gray-400 mt-1">{{ it.date }}<span v-if="it.author"> · <span class="text-gray-500">{{ it.author }}</span></span></p>
      </div>
    </li>
  </ul>
  <div v-else class="text-center py-10 text-gray-400">
    <i class="pi pi-clock text-2xl mb-2 block" />
    <p class="text-sm">No activity yet.</p>
  </div>
</template>
