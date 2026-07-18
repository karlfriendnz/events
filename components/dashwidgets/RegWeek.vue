<!-- Dashboard widget: registrations this week (form_submissions feed + per-day bars) -->
<script setup lang="ts">
const forms = useFormsApi()
const groups = useGroupsApi()
const events = useEventsApi()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const loading = ref(true)
const subs = ref<any[]>([])
const names = ref<Record<string, string>>({})
const days = ref<{ label: string; count: number }[]>([])

async function load() {
  if (!orgId.value) return
  loading.value = true
  const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0)
  // Seam read: recent submissions, then keep the last 7 days (the seam returns
  // newest-first; date-windowing stays client-side). Map to the snake shape.
  const all = await forms.submissions(orgId.value, { limit: 200 })
  subs.value = all
    .filter(s => new Date(s.createdAt) >= since)
    .slice(0, 60)
    .map(s => ({ id: s.id, submitter_name: s.submitterName, context_type: s.contextType, context_id: s.contextId, created_at: s.createdAt }))
  // resolve context names (classes + events) via the owning domains' lists.
  const gids = new Set(subs.value.filter(s => s.context_type === 'group').map(s => s.context_id))
  const eids = new Set(subs.value.filter(s => s.context_type === 'event').map(s => s.context_id))
  const [g, e] = await Promise.all([
    gids.size ? groups.list(orgId.value) : Promise.resolve([]),
    eids.size ? events.list(orgId.value) : Promise.resolve([]),
  ])
  const map: Record<string, string> = {}
  for (const x of g) if (gids.has(x.id)) map[x.id] = x.name
  for (const x of e) if (eids.has(x.id)) map[x.id] = x.title
  names.value = map
  // per-day bars (7 days)
  const buckets: { label: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toDateString()
    buckets.push({ label: d.toLocaleDateString('en-NZ', { weekday: 'narrow' }), count: subs.value.filter(s => new Date(s.created_at).toDateString() === key).length })
  }
  days.value = buckets
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })

const maxDay = computed(() => Math.max(1, ...days.value.map(d => d.count)))
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}
</script>

<template>
  <AppCard title="Registrations this week" class="h-full">
    <template #header-action>
      <span class="text-xs font-bold text-gray-900">{{ subs.length }}</span>
    </template>
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <template v-else>
        <!-- per-day bars -->
        <div class="flex items-end gap-1.5 h-12 mb-3">
          <div v-for="(d, i) in days" :key="i" class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full rounded-t bg-primary/70" :style="{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? '4px' : '1px', opacity: d.count ? 1 : 0.2 }" />
            <span class="text-[10px] text-gray-400">{{ d.label }}</span>
          </div>
        </div>
        <p v-if="!subs.length" class="text-sm text-gray-400 py-2 text-center">No sign-ups in the last 7 days.</p>
        <ul v-else class="divide-y divide-gray-50">
          <li v-for="s in subs.slice(0, 6)" :key="s.id" class="py-1.5 flex items-center gap-2 text-sm">
            <i class="pi pi-user-plus text-emerald-500 text-xs shrink-0" />
            <span class="font-medium text-gray-800 truncate">{{ s.submitter_name || 'Someone' }}</span>
            <span class="text-gray-400 truncate text-xs">→ {{ names[s.context_id] ?? s.context_type }}</span>
            <span class="ml-auto text-xs text-gray-300 shrink-0">{{ ago(s.created_at) }}</span>
          </li>
        </ul>
      </template>
    </div>
  </AppCard>
</template>
