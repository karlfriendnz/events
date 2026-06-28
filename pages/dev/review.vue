<template>
  <div class="min-h-full px-3 sm:px-6 py-8 bg-[#F5F8FA]">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-end justify-between mb-5">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Sign-off report</h1>
          <p class="text-sm text-gray-500 mt-1">
            Pages × reviewers — who's signed, who's still pending, and where comments are open.
          </p>
        </div>
        <span class="text-xs text-gray-400">{{ reportRows.length }} pages tracked</span>
      </div>

      <!-- Per-reviewer totals -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
        <div v-for="r in reviewers" :key="r.id"
          class="flex items-center gap-2 bg-white rounded-md px-3 py-2 border border-gray-100">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            :style="{ background: (r.color || '#1E2157') + '22', color: r.color || '#1E2157' }">
            {{ initialsOf(r.name) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-gray-800 truncate">
              {{ r.name }}<span v-if="r.role" class="text-gray-400 font-normal"> · {{ r.role }}</span>
            </p>
            <p class="text-[10px] text-gray-400">
              {{ reviewerSignedCounts[r.id] ?? 0 }} of {{ reportRows.length }} signed
            </p>
          </div>
        </div>
      </div>

      <!-- Matrix -->
      <div v-if="loading" class="text-sm text-gray-400 py-12 text-center">Loading…</div>
      <div v-else-if="!reportRows.length" class="text-sm text-gray-400 py-12 text-center bg-white rounded-xl border border-gray-100">
        No tracked pages yet — leave a comment or set a stage on any page to start tracking it here.
      </div>
      <div v-else class="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="text-xs w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left font-semibold text-gray-500 px-4 py-3">Page</th>
                <th v-for="r in reviewers" :key="r.id"
                  class="text-center font-semibold text-gray-500 px-2 py-3"
                  v-tooltip.top="`${r.name}${r.role ? ' · ' + r.role : ''}`">
                  {{ initialsOf(r.name) }}
                </th>
                <th class="text-right font-semibold text-gray-500 px-4 py-3">Open</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in reportRows" :key="row.pageKey"
                class="border-t border-gray-100 hover:bg-gray-50"
                :class="isTemplated(row.pageKey) ? 'cursor-default' : 'cursor-pointer'"
                @click="row.pageKey && !isTemplated(row.pageKey) ? navigateToPage(row.pageKey) : null">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5">
                    <p class="font-mono text-[11px] text-gray-700 truncate max-w-[260px]">{{ row.pageKey }}</p>
                    <i v-if="isTemplated(row.pageKey)" class="pi pi-asterisk text-[9px] text-gray-300"
                      v-tooltip.top="'Page template — applies to every instance'" />
                  </div>
                  <span v-if="row.stage && row.stage !== 'draft'"
                    class="inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                    :class="stageChipFor(row.stage)">
                    {{ stageLabelFor(row.stage) }}
                  </span>
                </td>
                <td v-for="r in reviewers" :key="r.id" class="text-center px-2 py-3">
                  <i v-if="row.signedBy[r.id]" class="pi pi-check-circle text-emerald-500 text-base"
                    v-tooltip.top="`${r.name} · ${formatRelative(row.signedBy[r.id].signed_at)}`" />
                  <span v-else class="text-gray-200">·</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <span v-if="row.openCount > 0"
                    class="inline-block min-w-[20px] h-[20px] px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-[20px]">
                    {{ row.openCount }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const db = useDb()
const router = useRouter()
const user = useSupabaseUser()
const { orgId } = useOrg()

interface Reviewer {
  id: string
  name: string
  role: string | null
  color: string | null
}
interface ReportRow {
  pageKey: string
  stage: string
  openCount: number
  signedBy: Record<string, any>
}

const reviewers = ref<Reviewer[]>([])
const reportRows = ref<ReportRow[]>([])
const loading = ref(true)

// Restrict to Karl. Other reviewers shouldn't see the matrix; developers
// are gated separately by useDeveloperGate. Bounce non-Karl users back
// to /events with a quiet redirect — there's nothing useful here for them.
const meReviewer = computed(() => {
  const email = user.value?.email
  if (!email || !reviewers.value.length) return null
  const local = email.split('@')[0]?.toLowerCase()
  return reviewers.value.find(r => (r.name || '').toLowerCase() === local) ?? null
})

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [{ data: revs }, { data: pageRevs }, { data: cs }, { data: sos }] = await Promise.all([
    (db.from as any)('page_reviewers')
      .select('*').eq('org_id', orgId.value)
      .order('sort_order').order('name'),
    (db.from as any)('page_reviews')
      .select('path, stage').eq('org_id', orgId.value),
    (db.from as any)('page_comments')
      .select('path, resolved').eq('org_id', orgId.value),
    (db.from as any)('page_signoffs')
      .select('path, reviewer_id, signed_at').eq('org_id', orgId.value),
  ])
  reviewers.value = revs ?? []

  // Gate: only Karl gets the report. Bounce everyone else away.
  if (meReviewer.value && meReviewer.value.name !== 'Karl') {
    router.replace('/events')
    return
  }

  const open: Record<string, number> = {}
  for (const c of cs ?? []) if (!c.resolved) open[c.path] = (open[c.path] ?? 0) + 1
  const stageByPath: Record<string, string> = {}
  for (const r of pageRevs ?? []) stageByPath[r.path] = r.stage
  const signedByPath: Record<string, Record<string, any>> = {}
  for (const s of sos ?? []) {
    if (!signedByPath[s.path]) signedByPath[s.path] = {}
    signedByPath[s.path][s.reviewer_id] = s
  }
  const allKeys = new Set<string>([
    ...Object.keys(open),
    ...Object.keys(stageByPath),
    ...Object.keys(signedByPath),
  ])
  reportRows.value = [...allKeys]
    .map(k => ({
      pageKey: k,
      stage: stageByPath[k] ?? 'draft',
      openCount: open[k] ?? 0,
      signedBy: signedByPath[k] ?? {},
    }))
    .sort((a, b) =>
      b.openCount - a.openCount ||
      Object.keys(b.signedBy).length - Object.keys(a.signedBy).length ||
      a.pageKey.localeCompare(b.pageKey),
    )
  loading.value = false
}
watch(orgId, load, { immediate: true })

const reviewerSignedCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const row of reportRows.value) {
    for (const rId of Object.keys(row.signedBy)) counts[rId] = (counts[rId] ?? 0) + 1
  }
  return counts
})

function parsePageKey(key: string): { path: string; tab?: string } {
  const m = key.match(/^([^?]+)(?:\?tab=(.+))?$/)
  return { path: m?.[1] ?? key, tab: m?.[2] }
}
function isTemplated(key: string) { return key.includes(':') }
function navigateToPage(key: string) {
  if (isTemplated(key)) return
  const { path, tab } = parsePageKey(key)
  router.push(tab ? { path, query: { tab } } : path)
}

function stageLabelFor(s: string) {
  return s === 'approved' ? 'Approved' : s === 'in_review' ? 'In review' : 'Draft'
}
function stageChipFor(s: string) {
  if (s === 'approved')  return 'bg-emerald-100 text-emerald-700'
  if (s === 'in_review') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-200 text-gray-700'
}
function initialsOf(name: string): string {
  const parts = (name || '').split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function formatRelative(iso: string): string {
  const d = new Date(iso)
  const ms = Date.now() - d.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
</script>
