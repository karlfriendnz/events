<!--
  Club-side Help centre. Shows the help articles this club + user can actually use
  (module enabled AND role has read access), rendered in the club's OWN terminology.
  Grouped by module, each an expandable card with an explanation + step-by-step
  tutorial and a link to the related page.
-->
<script setup lang="ts">
import type { HelpArticle } from '~/composables/useHelp'
const { loadHelpArticles, renderHelpTokens } = useHelp()
const { ensureTerms, map } = useTerms()

useBreadcrumbs([{ label: 'Help' }])

const loading = ref(true)
const articles = ref<HelpArticle[]>([])
const search = ref('')
const openIds = ref<Set<string>>(new Set())

function toggle(id: string) {
  const next = new Set(openIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  openIds.value = next
}

const render = (text: string) => renderHelpTokens(text, map.value)

// Client-side search over rendered title + explanation.
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return articles.value
  return articles.value.filter(a =>
    render(a.title).toLowerCase().includes(q) || render(a.explanation).toLowerCase().includes(q))
})

// Grouped by module (module label from MODULE_DEFS; null = General).
const grouped = computed(() => {
  const byModule = new Map<string | null, HelpArticle[]>()
  for (const a of filtered.value) {
    if (!byModule.has(a.module)) byModule.set(a.module, [])
    byModule.get(a.module)!.push(a)
  }
  const moduleLabel = (key: string | null) => key ? (MODULE_DEFS.find(m => m.key === key)?.label ?? key) : 'General'
  return [...byModule.entries()]
    .map(([key, items]) => ({ key, label: moduleLabel(key), items }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

onMounted(async () => {
  await ensureTerms()
  articles.value = await loadHelpArticles()
  loading.value = false
})
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-4xl mx-auto">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p class="text-sm text-gray-500">Guides and step-by-step tutorials for your club.</p>
      <IconField class="w-full sm:w-72">
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search help…" class="w-full" size="small" />
      </IconField>
    </div>

    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

    <div v-else-if="!filtered.length" class="card p-8 text-center">
      <i class="pi pi-question-circle text-3xl text-gray-300" />
      <p class="mt-2 text-sm text-gray-500">{{ search ? 'No help articles match your search.' : 'No help articles are available yet.' }}</p>
    </div>

    <div v-else class="space-y-5">
      <section v-for="g in grouped" :key="g.key ?? '_general'">
        <h2 class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{{ g.label }}</h2>
        <div class="space-y-2">
          <div v-for="a in g.items" :key="a.id" class="card overflow-hidden">
            <button type="button" class="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors" @click="toggle(a.id)">
              <i class="pi text-gray-400 text-sm shrink-0" :class="openIds.has(a.id) ? 'pi-chevron-down' : 'pi-chevron-right'" />
              <span class="flex-1 text-sm font-semibold text-gray-800">{{ render(a.title) }}</span>
            </button>
            <div v-if="openIds.has(a.id)" class="px-4 sm:px-5 pb-5 pt-1 border-t border-gray-100">
              <p v-if="a.explanation" class="text-sm text-gray-600 leading-relaxed">{{ render(a.explanation) }}</p>

              <ol v-if="a.steps.length" class="mt-4 space-y-3">
                <li v-for="(s, i) in a.steps" :key="i" class="flex gap-3">
                  <span class="w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{{ i + 1 }}</span>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-800">{{ render(s.title) }}</p>
                    <p class="text-sm text-gray-600 leading-relaxed">{{ render(s.body) }}</p>
                  </div>
                </li>
              </ol>

              <NuxtLink v-if="a.route" :to="a.route" class="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary hover:underline">
                Open the page <i class="pi pi-arrow-right text-xs" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
