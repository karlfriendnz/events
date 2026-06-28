<!--
  Club dashboard — the configurable landing page for a club. Widgets live on a
  draggable + resizable grid (grid-layout-plus). Each club's layout (position,
  size, which widgets are shown) is saved to organisations.dashboard_config
  (migration 159) as an ordered { key, enabled, x, y, w, h }[]. Widget keys live
  in DASHBOARD_WIDGETS and are reconciled on load, so adding a widget here gives
  it a default slot for everyone without a migration.

  Edit mode (the "Customise" toggle) turns on dragging/resizing + per-widget
  remove + an "add widget" tray; view mode locks the grid.
-->
<script setup lang="ts">
import { GridLayout, GridItem } from 'grid-layout-plus'

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

// Registry — defaults (slot + size) for orgs with no saved config.
interface WidgetDef { key: string; label: string; description: string; x: number; y: number; w: number; h: number; minW: number; minH: number; defaultOff?: boolean }
const DASHBOARD_WIDGETS: WidgetDef[] = [
  { key: 'stat_members',   label: 'Members tile',            description: 'Total people in the club',                   x: 0, y: 0,  w: 3,  h: 2, minW: 2, minH: 2 },
  { key: 'stat_groups',    label: 'Groups tile',             description: 'Squads & member groups count',              x: 3, y: 0,  w: 3,  h: 2, minW: 2, minH: 2 },
  { key: 'stat_events',    label: 'Upcoming events tile',    description: 'Events scheduled from today',                x: 6, y: 0,  w: 3,  h: 2, minW: 2, minH: 2 },
  { key: 'stat_bookings',  label: 'Upcoming bookings tile',  description: 'Venue & resource bookings',                  x: 9, y: 0,  w: 3,  h: 2, minW: 2, minH: 2 },
  { key: 'quick_actions',  label: 'Quick actions',           description: 'Shortcuts to create common things',          x: 0, y: 2,  w: 12, h: 1, minW: 3, minH: 1 },
  { key: 'upcoming_events',label: 'Upcoming events',         description: 'The next events from today',                 x: 0, y: 3,  w: 8,  h: 6, minW: 4, minH: 3 },
  { key: 'members_by_type',label: 'Members by type',         description: 'Breakdown by membership type',               x: 8, y: 3,  w: 4,  h: 6, minW: 3, minH: 3 },
  { key: 'recent_members', label: 'Recently added members',  description: 'Newest people in the club',                  x: 0, y: 9,  w: 12, h: 5, minW: 4, minH: 3 },
]
const defById = Object.fromEntries(DASHBOARD_WIDGETS.map(w => [w.key, w]))
// Dynamic chart instances use keys like "chart:<id>" — they aren't in the
// registry, so look-ups fall back to these defaults.
const CHART_DEF: WidgetDef = { key: 'chart', label: 'Chart', description: 'Report on a field (pie / bar)', x: 0, y: 99, w: 4, h: 6, minW: 3, minH: 4 }
function isChart(key: string) { return key.startsWith('chart:') }
function widgetDef(key: string): WidgetDef { return defById[key] ?? CHART_DEF }

// Generic spec for the four stat tiles (rendered from one template branch).
const STAT_TILES: Record<string, { label: string; sublabel: string; icon: string; to: string; stat: 'members' | 'groups' | 'upcomingEvents' | 'upcomingBookings'; color: string }> = {
  stat_members:  { label: 'Members',           sublabel: 'People in this club',        icon: 'pi-users',    to: '/people',                  stat: 'members',         color: '#3B82F6' },
  stat_groups:   { label: 'Groups',            sublabel: 'Squads & member groups',     icon: 'pi-sitemap',  to: '/groups',                  stat: 'groups',          color: '#8B5CF6' },
  stat_events:   { label: 'Upcoming events',   sublabel: 'Scheduled from today',       icon: 'pi-calendar', to: '/events',                  stat: 'upcomingEvents',  color: '#EC4899' },
  stat_bookings: { label: 'Upcoming bookings', sublabel: 'Venue & resource bookings',  icon: 'pi-bookmark', to: '/bookables?tab=bookings',  stat: 'upcomingBookings', color: '#10B981' },
}

const CHART_COLORS = ['#1E2157', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#6B7280']
const PALETTES: Record<string, { label: string; colors: string[] }> = {
  brand:  { label: 'Brand',  colors: ['#1E2157', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#6B7280'] },
  ocean:  { label: 'Ocean',  colors: ['#0EA5E9', '#2563EB', '#0891B2', '#14B8A6', '#6366F1', '#1D4ED8'] },
  sunset: { label: 'Sunset', colors: ['#F59E0B', '#EF4444', '#EC4899', '#F97316', '#FB7185', '#FBBF24'] },
  forest: { label: 'Forest', colors: ['#10B981', '#059669', '#65A30D', '#16A34A', '#84CC16', '#22C55E'] },
  mono:   { label: 'Mono',   colors: ['#1E2157', '#3A3F7A', '#5860A3', '#7782C0', '#9AA3D6', '#C2C8E8'] },
}
const PALETTE_OPTIONS = Object.entries(PALETTES).map(([value, p]) => ({ value, label: p.label }))
// Fields a chart can report on: built-ins + any custom fields found on members.
const BUILTIN_FIELDS = [
  { value: 'gender', label: 'Gender' },
  { value: 'age', label: 'Age group' },
  { value: 'membership', label: 'Membership type' },
]
const reportFields = ref<{ value: string; label: string }[]>([...BUILTIN_FIELDS])
// Precomputed breakdown rows per field value, e.g. { gender:[…], 'cf:tshirt':[…] }.
const breakdowns = ref<Record<string, { label: string; count: number }[]>>({})

const user = useSupabaseUser()
const route = useRoute()
const { can, unrestricted } = useCan()
const { uploadFile } = useUpload()
const loading = ref(true)
const orgName = ref('')
// Who can edit the club's per-role default templates.
const isAdmin = computed(() => ((user.value as any)?.app_metadata?.role === 'super_admin') || unrestricted.value || can('settings', 'update'))
// Template-edit mode: arrive from Settings → Dashboard defaults with ?editTemplate=<userType>.
// In this mode the page edits a ROLE'S default template, not the user's own layout.
const templateType = computed(() => (isAdmin.value && route.query.editTemplate) ? String(route.query.editTemplate) : null)
const templateMode = computed(() => !!templateType.value)
const templateLabel = ref('')

// Per-person dashboard config lives in user_dashboards; per-role club templates in
// dashboard_templates; organisations.dashboard_config is the final fallback.
async function persistConfig(cfg: CfgItem[]): Promise<{ error: any }> {
  // useSupabaseUser() can be null right after a hard refresh (INITIAL_SESSION is
  // async) or on a dev port that hasn't hydrated the user ref — recover the id
  // straight from the stored session, the same way auth.global.ts does.
  let uid = user.value?.id
  if (!uid) {
    const { data: { session } } = await db.auth.getSession()
    uid = session?.user?.id
    if (uid) user.value = session!.user as any
  }
  if (!uid) return { error: { message: 'No user session — please sign in again.' } }
  if (!orgId.value) return { error: { message: 'No active organisation selected.' } }
  const { error } = await (db.from as any)('user_dashboards').upsert(
    { user_id: uid, org_id: orgId.value, config: cfg, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,org_id' },
  )
  if (error) console.error('[dashboard] save failed', error)
  return { error }
}
// The permission groups (= user types) the current user belongs to, plus the core
// templates they derive from — ordered, used to pick their default dashboard.
async function resolveUserTypeKeys(): Promise<string[]> {
  const email = user.value?.email; if (!email || !orgId.value) return []
  const { data: person } = await (db.from as any)('persons').select('id').eq('org_id', orgId.value).ilike('email', email).limit(1).maybeSingle()
  if (!person) return []
  const { data: mem } = await (db.from as any)('permission_group_members').select('group_id').eq('person_id', person.id)
  const gids = (mem ?? []).map((m: any) => m.group_id)
  if (!gids.length) return []
  const { data: grps } = await (db.from as any)('permission_groups').select('id, source_group_id, sort_order').in('id', gids)
  const sorted = (grps ?? []).slice().sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const keys: string[] = []
  for (const g of sorted) { keys.push(g.id); if (g.source_group_id) keys.push(g.source_group_id) }
  return keys
}
// Human label for a user_type key ('_default' or a permission_groups.id).
async function resolveTypeLabel(userType: string): Promise<string> {
  if (userType === '_default') return 'All users'
  const { data } = await (db.from as any)('permission_groups').select('name').eq('id', userType).maybeSingle()
  return data?.name ?? 'role'
}
const logoUrl = ref<string | null>(null)
const bannerUrl = ref<string | null>(null)
const uploadingBanner = ref(false)
const nowLabel = new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

async function onBanner(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
  uploadingBanner.value = true
  try {
    const url = await uploadFile(file)
    bannerUrl.value = url
    await (db.from as any)('organisations').update({ dashboard_banner_url: url }).eq('id', orgId.value)
    toast.add({ severity: 'success', summary: 'Banner updated', life: 1500 })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Upload failed', detail: err?.message, life: 4000 })
  } finally { uploadingBanner.value = false }
}
async function clearBanner() {
  bannerUrl.value = null
  await (db.from as any)('organisations').update({ dashboard_banner_url: null }).eq('id', orgId.value)
}
const stats = reactive({ members: 0, groups: 0, upcomingEvents: 0, upcomingBookings: 0 })
const byType = ref<{ label: string; count: number }[]>([])
const upcoming = ref<{ id: string; title: string; start_at: string | null; location_type: string; address: string | null; status: string }[]>([])
const recent = ref<{ id: string; name: string; email: string | null; created_at: string }[]>([])

// ── Config + live grid layout ──
interface CfgItem { key: string; enabled: boolean; x: number; y: number; w: number; h: number; opts?: Record<string, any> }
const config = ref<CfgItem[]>([])
const layout = ref<any[]>([]) // grid-layout-plus model: { i, x, y, w, h, minW, minH }

// On a narrow screen the dashboard is VIEW-ONLY and every widget stacks full-width
// in order (the 12-col grid is meaningless on a phone). Editing is desktop-only.
const isNarrow = ref(false)
function updateNarrow() { if (import.meta.client) isNarrow.value = window.innerWidth < 768 }
onMounted(updateNarrow)
if (import.meta.client) {
  window.addEventListener('resize', updateNarrow)
  onBeforeUnmount(() => window.removeEventListener('resize', updateNarrow))
}
const displayLayout = computed(() => {
  if (!isNarrow.value) return layout.value
  // Mobile: stack in visual order. Stat tiles go 2-up (compact); everything else
  // is full-width. Keeps it dense and app-like rather than tall sparse cards.
  const sorted = [...layout.value].sort((a, b) => (a.y - b.y) || (a.x - b.x))
  const out: any[] = []
  let y = 0
  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i]
    const isStat = String(it.i).startsWith('stat_')
    const next = sorted[i + 1]
    if (isStat && next && String(next.i).startsWith('stat_')) {
      out.push({ ...it, x: 0, w: 6, y, h: 1 })
      out.push({ ...next, x: 6, w: 6, y, h: 1 })
      y += 1; i++
    } else if (isStat) {
      out.push({ ...it, x: 0, w: 6, y, h: 1 }); y += 1
    } else {
      out.push({ ...it, x: 0, w: 12, y }); y += (it.h || 1)
    }
  }
  return out
})

function defaultConfig(): CfgItem[] {
  return DASHBOARD_WIDGETS.map(w => ({ key: w.key, enabled: !w.defaultOff, x: w.x, y: w.y, w: w.w, h: w.h }))
}
function reconcile(saved: any): CfgItem[] {
  const valid = new Set(DASHBOARD_WIDGETS.map(w => w.key))
  const out: CfgItem[] = []
  const seen = new Set<string>()
  for (const it of Array.isArray(saved) ? saved : []) {
    // Keep registry widgets AND dynamic chart instances (chart:<id>, not in the registry).
    if (it && (valid.has(it.key) || isChart(it.key)) && !seen.has(it.key)) {
      const d = widgetDef(it.key)
      out.push({
        key: it.key, enabled: it.enabled !== false,
        x: Number.isFinite(it.x) ? it.x : d.x, y: Number.isFinite(it.y) ? it.y : d.y,
        w: Number.isFinite(it.w) ? it.w : d.w, h: Number.isFinite(it.h) ? it.h : d.h,
        opts: it.opts && typeof it.opts === 'object' ? it.opts : undefined,
      })
      seen.add(it.key)
    }
  }
  for (const w of DASHBOARD_WIDGETS) if (!seen.has(w.key)) out.push({ key: w.key, enabled: !w.defaultOff, x: w.x, y: w.y, w: w.w, h: w.h })
  return out
}
// Build the grid-layout model from the enabled config items.
function rebuildLayout() {
  layout.value = config.value.filter(c => c.enabled).map(c => {
    const d = widgetDef(c.key)
    return { i: c.key, x: c.x, y: c.y, w: c.w, h: c.h, minW: d.minW, minH: d.minH }
  })
}
const hiddenWidgets = computed(() => config.value.filter(c => !c.enabled))

const nowIso = computed(() => new Date().toISOString())
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// ── Charts (dynamic instances; each picks a field to report on) ──
function cfgOpts(key: string): Record<string, any> { return config.value.find(c => c.key === key)?.opts || {} }
function chartDim(key: string): string { return cfgOpts(key).dimension || 'gender' }
function chartType(key: string): 'pie' | 'bar' { return (cfgOpts(key).chartType as 'pie' | 'bar') || 'pie' }
function chartTitle(key: string): string {
  return cfgOpts(key).title?.trim() || reportFields.value.find(f => f.value === chartDim(key))?.label || 'Chart'
}
function chartPalette(key: string): string[] { return PALETTES[cfgOpts(key).palette as string]?.colors || PALETTES.brand.colors }
function chartShowTable(key: string): boolean { return !!cfgOpts(key).showTable }
async function patchChart(key: string, patch: Record<string, any>) {
  const c = config.value.find(x => x.key === key); if (!c) return
  c.opts = { ...(c.opts || {}), ...patch }
  await persistConfig(config.value)
}
function setChartType(key: string, type: 'pie' | 'bar') { patchChart(key, { chartType: type }) }
function setChartDim(key: string, dim: string) { patchChart(key, { dimension: dim }) }
function chartRows(key: string) { return breakdowns.value[chartDim(key)] || [] }
function chartTableRows(key: string) {
  const rows = chartRows(key); const total = rows.reduce((s, r) => s + r.count, 0) || 1
  const pal = chartPalette(key)
  return rows.map((r, i) => ({ ...r, pct: Math.round(r.count / total * 100), color: pal[i % pal.length] }))
}
function chartData(key: string) {
  const rows = chartRows(key)
  const pal = chartPalette(key)
  return { labels: rows.map(r => r.label), datasets: [{ data: rows.map(r => r.count), backgroundColor: rows.map((_, i) => pal[i % pal.length]), borderWidth: 0, borderRadius: chartType(key) === 'bar' ? 6 : 0 }] }
}
function chartOptions(key: string) {
  const o = cfgOpts(key); const isPie = chartType(key) === 'pie'
  const yMin = Number.isFinite(o.yMin) ? o.yMin : undefined
  const yMax = Number.isFinite(o.yMax) ? o.yMax : undefined
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: o.legend ?? isPie, position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } } },
    scales: isPie ? {} : { y: { beginAtZero: yMin === undefined, min: yMin, max: yMax, ticks: { precision: 0 } }, x: { grid: { display: false } } },
  }
}

// Per-chart settings dialog
const settingsKey = ref<string | null>(null)
const settingsDraft = reactive<{ title: string; dimension: string; chartType: 'pie' | 'bar'; palette: string; legend: boolean; showTable: boolean; yMin: number | null; yMax: number | null }>({
  title: '', dimension: 'gender', chartType: 'pie', palette: 'brand', legend: true, showTable: false, yMin: null, yMax: null,
})
function openChartSettings(key: string) {
  const o = cfgOpts(key)
  Object.assign(settingsDraft, {
    title: o.title || '', dimension: o.dimension || 'gender', chartType: o.chartType || 'pie',
    palette: o.palette || 'brand', legend: o.legend ?? (o.chartType !== 'bar'), showTable: !!o.showTable,
    yMin: Number.isFinite(o.yMin) ? o.yMin : null, yMax: Number.isFinite(o.yMax) ? o.yMax : null,
  })
  settingsKey.value = key
}
async function saveChartSettings() {
  if (!settingsKey.value) return
  await patchChart(settingsKey.value, {
    title: settingsDraft.title.trim() || null, dimension: settingsDraft.dimension, chartType: settingsDraft.chartType,
    palette: settingsDraft.palette, legend: settingsDraft.legend, showTable: settingsDraft.showTable,
    yMin: settingsDraft.yMin, yMax: settingsDraft.yMax,
  })
  settingsKey.value = null
}

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [{ data: orgRow }, { data: persons }, { count: groupCount }, { data: events, count: eventCount }, { data: bookables }] = await Promise.all([
    (db.from as any)('organisations').select('name, logo_url, dashboard_banner_url, dashboard_config').eq('id', orgId.value).maybeSingle(),
    (db.from as any)('persons').select('id, first_name, last_name, email, membership_type, gender, dob, custom_fields, created_at').eq('org_id', orgId.value),
    (db.from as any)('member_groups').select('id', { count: 'exact', head: true }).eq('org_id', orgId.value),
    (db.from as any)('events').select('id, title, start_at, end_at, location_type, address, status', { count: 'exact' })
      .eq('org_id', orgId.value).neq('status', 'ARCHIVED').neq('status', 'CANCELLED')
      .gte('start_at', nowIso.value).order('start_at').limit(6),
    (db.from as any)('bookables').select('id').eq('org_id', orgId.value),
  ])

  orgName.value = orgRow?.name ?? ''
  logoUrl.value = orgRow?.logo_url ?? null
  bannerUrl.value = orgRow?.dashboard_banner_url ?? null
  let base: any = null
  if (templateMode.value) {
    // Editing a role's default template — load THAT template (or fall back to defaults).
    templateLabel.value = await resolveTypeLabel(templateType.value!)
    const { data: tpl } = await (db.from as any)('dashboard_templates').select('config')
      .eq('org_id', orgId.value).eq('user_type', templateType.value).maybeSingle()
    base = tpl?.config ?? orgRow?.dashboard_config
  } else {
    // Resolution: this user's own layout → their role's template → '_default' → club default → code.
    let savedCfg: any = null
    let uid = user.value?.id
    if (!uid) {
      const { data: { session } } = await db.auth.getSession()
      uid = session?.user?.id
      if (uid) user.value = session!.user as any
    }
    if (uid) {
      const { data: ud } = await (db.from as any)('user_dashboards').select('config')
        .eq('user_id', uid).eq('org_id', orgId.value).maybeSingle()
      savedCfg = ud?.config ?? null
    }
    base = savedCfg
    if (!base) {
      const candidates = [...(await resolveUserTypeKeys()), '_default']
      const { data: tpls } = await (db.from as any)('dashboard_templates').select('user_type, config')
        .eq('org_id', orgId.value).in('user_type', candidates)
      for (const k of candidates) { const t = (tpls ?? []).find((x: any) => x.user_type === k); if (t?.config) { base = t.config; break } }
    }
    base = base ?? orgRow?.dashboard_config
  }
  config.value = base ? reconcile(base) : defaultConfig()
  if (templateMode.value) editing.value = true
  rebuildLayout()

  const people = persons ?? []
  stats.members = people.length
  stats.groups = groupCount ?? 0
  stats.upcomingEvents = eventCount ?? 0

  const typeCounts: Record<string, number> = {}
  for (const p of people) {
    const k = (p.membership_type || 'Unspecified').trim() || 'Unspecified'
    typeCounts[k] = (typeCounts[k] ?? 0) + 1
  }
  byType.value = Object.entries(typeCounts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)

  // ── Build report breakdowns (powering the chart widgets) ──
  const tally = (fn: (p: any) => string, order?: string[]) => {
    const counts: Record<string, number> = {}
    for (const p of people) { const k = fn(p); counts[k] = (counts[k] ?? 0) + 1 }
    const rows = Object.entries(counts).map(([label, count]) => ({ label, count }))
    return order ? order.map(l => ({ label: l, count: counts[l] ?? 0 })).filter(r => r.count > 0)
                 : rows.sort((a, b) => b.count - a.count)
  }
  const GENDER_LABEL: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', NON_BINARY: 'Non-binary', UNSPECIFIED: 'Unspecified' }
  const today = new Date()
  const ageBands = ['Under 13', '13–17', '18–29', '30–49', '50+', 'Unknown']
  const ageOf = (p: any) => {
    if (!p.dob) return 'Unknown'
    const d = new Date(p.dob); let a = today.getFullYear() - d.getFullYear()
    const m = today.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--
    return a < 13 ? 'Under 13' : a < 18 ? '13–17' : a < 30 ? '18–29' : a < 50 ? '30–49' : '50+'
  }
  const bd: Record<string, { label: string; count: number }[]> = {
    gender: tally(p => GENDER_LABEL[p.gender] || 'Unspecified'),
    age: tally(ageOf, ageBands),
    membership: byType.value,
  }
  // Custom fields discovered on member records.
  const cfKeys = new Set<string>()
  for (const p of people) for (const k of Object.keys(p.custom_fields || {})) cfKeys.add(k)
  const humanize = (k: string) => k.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const cfFields: { value: string; label: string }[] = []
  for (const k of [...cfKeys].sort()) {
    const dim = 'cf:' + k
    bd[dim] = tally(p => { const v = p.custom_fields?.[k]; return (v === null || v === undefined || v === '') ? '—' : String(v) })
    cfFields.push({ value: dim, label: humanize(k) })
  }
  breakdowns.value = bd
  reportFields.value = [...BUILTIN_FIELDS, ...cfFields]

  upcoming.value = events ?? []
  recent.value = [...people]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 6)
    .map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`.trim(), email: p.email, created_at: p.created_at }))

  const ids = (bookables ?? []).map((b: any) => b.id)
  if (ids.length) {
    const { count } = await (db.from as any)('bookings').select('id', { count: 'exact', head: true })
      .in('bookable_id', ids).gte('start_at', nowIso.value)
    stats.upcomingBookings = count ?? 0
  } else stats.upcomingBookings = 0

  loading.value = false
}

const maxTypeCount = computed(() => Math.max(1, ...byType.value.map(t => t.count)))

// ── Edit mode ──
const editing = ref(false)
const saving = ref(false)

// Quick-actions dropdown (popup menu, teleported so the card doesn't clip it).
const quickMenu = ref()
const quickItems = [
  { label: 'New event', icon: 'pi pi-calendar-plus', command: () => navigateTo('/events/new-basic') },
  { label: 'Add member', icon: 'pi pi-user-plus', command: () => navigateTo('/people/new') },
  { label: 'New booking', icon: 'pi pi-bookmark', command: () => navigateTo('/bookings/new') },
  { label: 'Send email', icon: 'pi pi-envelope', command: () => navigateTo('/settings/communications') },
]
const addMenuOpen = ref(false)
function startEdit() { editing.value = true }
function cancelEdit() {
  if (templateMode.value) { navigateTo('/settings/dashboard-defaults'); return }
  editing.value = false; addMenuOpen.value = false; rebuildLayout()
}
function removeWidget(key: string) {
  layout.value = layout.value.filter(l => l.i !== key)
  if (isChart(key)) {
    // Chart instances are dynamic — delete entirely (don't linger as "hidden").
    config.value = config.value.filter(c => c.key !== key)
  } else {
    const c = config.value.find(x => x.key === key); if (c) c.enabled = false
  }
}
function addWidget(key: string) {
  const c = config.value.find(x => x.key === key); if (!c) return
  c.enabled = true
  const d = widgetDef(key)
  const maxY = layout.value.reduce((m, l) => Math.max(m, l.y + l.h), 0)
  layout.value.push({ i: key, x: 0, y: maxY, w: d.w, h: d.h, minW: d.minW, minH: d.minH })
}
let chartSeq = 0
function addChart() {
  const id = `chart:${Date.now().toString(36)}${chartSeq++}`
  const d = CHART_DEF
  config.value.push({ key: id, enabled: true, x: 0, y: 99, w: d.w, h: d.h, opts: { dimension: reportFields.value[0]?.value || 'gender', chartType: 'pie' } })
  const maxY = layout.value.reduce((m, l) => Math.max(m, l.y + l.h), 0)
  layout.value.push({ i: id, x: 0, y: maxY, w: d.w, h: d.h, minW: d.minW, minH: d.minH })
}
// Fold live grid positions back into config (disabled widgets keep their last slot).
function currentConfig(): CfgItem[] {
  const byKey = Object.fromEntries(layout.value.map(l => [l.i, l]))
  return config.value.map(c => {
    const l = byKey[c.key]
    return l ? { ...c, enabled: true, x: l.x, y: l.y, w: l.w, h: l.h } : { ...c, enabled: false }
  })
}
async function saveLayout() {
  saving.value = true
  const next = currentConfig()
  config.value = next
  if (templateMode.value) {
    // Save the role's default template, then return to Settings.
    await (db.from as any)('dashboard_templates').upsert(
      { org_id: orgId.value, user_type: templateType.value, config: next, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,user_type' },
    )
    saving.value = false
    toast.add({ severity: 'success', summary: `Saved default for ${templateLabel.value}`, life: 2200 })
    navigateTo('/settings/dashboard-defaults')
    return
  }
  const { error } = await persistConfig(next)
  saving.value = false; editing.value = false; addMenuOpen.value = false
  if (error) { toast.add({ severity: 'error', summary: 'Could not save dashboard', detail: error.message, life: 6000 }); return }
  toast.add({ severity: 'success', summary: 'Dashboard saved', life: 1500 })
}
async function resetLayout() {
  config.value = defaultConfig(); rebuildLayout()
}

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 md:p-8 relative">
    <!-- Full-bleed background image sitting BEHIND the top section, fading into the page bg -->
    <div v-if="bannerUrl" class="pointer-events-none absolute top-0 left-0 right-0 h-[440px] overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url(${bannerUrl})` }" />
      <!-- left fade (logo/text legibility) -->
      <div class="absolute inset-0" style="background: linear-gradient(90deg, #F5F8FA 0%, #F5F8FA 15%, rgba(245,248,250,0.80) 33%, rgba(245,248,250,0.25) 52%, rgba(245,248,250,0) 70%)" />
      <!-- bottom fade (soft blend into the widgets below) -->
      <div class="absolute inset-0" style="background: linear-gradient(0deg, #F5F8FA 0%, #F5F8FA 24%, rgba(245,248,250,0.65) 46%, rgba(245,248,250,0) 80%)" />
    </div>

    <!-- Welcome header (over the image) -->
    <div class="relative flex items-start justify-between gap-4 mb-6 min-h-[120px] md:min-h-[150px]">
      <div class="pt-1">
        <div class="mb-6 md:mb-8">
          <img v-if="logoUrl" :src="logoUrl" class="h-12 md:h-14 max-w-[220px] object-contain" />
          <span v-else class="text-lg font-bold text-gray-800">{{ orgName }}</span>
        </div>
        <h1 class="text-lg sm:text-2xl font-bold tracking-tight text-gray-900">Welcome {{ orgName }}</h1>
        <p class="text-sm text-gray-500 mt-0.5">{{ nowLabel }}</p>
      </div>

      <!-- controls -->
      <div class="flex items-center gap-2 shrink-0">
        <template v-if="editing">
          <!-- banner image controls live behind Customise -->
          <label class="w-8 h-8 rounded-lg bg-white/90 shadow-sm flex items-center justify-center cursor-pointer text-gray-500 hover:text-gray-800" title="Change banner image">
            <i :class="['pi', uploadingBanner ? 'pi-spin pi-spinner' : 'pi-image', 'text-sm']" />
            <input type="file" accept="image/*" class="hidden" @change="onBanner" />
          </label>
          <button v-if="bannerUrl" class="w-8 h-8 rounded-lg bg-white/90 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500" title="Remove banner image" @click="clearBanner"><i class="pi pi-trash text-sm" /></button>
          <span class="w-px h-5 bg-gray-300/60 mx-0.5" />
          <!-- Add widget/chart menu -->
          <div class="relative">
            <button class="text-xs px-2.5 py-1.5 rounded-lg bg-white/90 text-gray-700 hover:text-gray-900 shadow-sm inline-flex items-center gap-1" @click="addMenuOpen = !addMenuOpen"><i class="pi pi-plus text-[10px]" />Add</button>
            <template v-if="addMenuOpen">
              <div class="fixed inset-0 z-[55]" @click="addMenuOpen = false" />
              <div class="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[60] text-left">
                <button v-for="hw in hiddenWidgets" :key="hw.key" type="button" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="addWidget(hw.key); addMenuOpen = false"><i class="pi pi-plus text-[10px] text-gray-400" />{{ widgetDef(hw.key).label }}</button>
                <div v-if="hiddenWidgets.length" class="border-t border-gray-100 my-1" />
                <button type="button" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-gray-50" @click="addChart(); addMenuOpen = false"><i class="pi pi-chart-pie text-[10px]" />Chart (choose a field)</button>
              </div>
            </template>
          </div>
          <button class="text-xs px-2 py-1.5 rounded-lg bg-white/90 text-gray-500 hover:text-gray-800 shadow-sm" @click="resetLayout">Reset</button>
          <button class="text-xs px-2.5 py-1.5 rounded-lg bg-white/90 text-gray-600 hover:text-gray-900 shadow-sm" @click="cancelEdit">Cancel</button>
          <button class="text-xs px-2.5 py-1.5 rounded-lg text-white shadow-sm" style="background:var(--brand-primary)" :disabled="saving" @click="saveLayout">
            <i v-if="saving" class="pi pi-spin pi-spinner text-[10px] mr-1" />Done
          </button>
        </template>
        <button v-else class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 shadow-sm text-sm font-medium text-gray-700 hover:text-gray-900" @click="startEdit">
          <i class="pi pi-sliders-h text-xs" />Customise
        </button>
      </div>
    </div>

    <!-- Everything below the header sits above the banner image (which is absolutely positioned) -->
    <div class="relative z-[1]">
    <div v-if="templateMode" class="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
      <i class="pi pi-info-circle shrink-0" />You're editing the default dashboard for <b class="font-semibold">{{ templateLabel }}</b>. <span class="text-amber-700/80">Done saves it as the starting layout for everyone with that role (until they personalise their own).</span>
    </div>
    <div v-if="editing" class="mb-3 text-xs text-gray-400"><i class="pi pi-arrows-alt mr-1" />Drag to move, drag the bottom-right corner to resize. Use <b class="font-medium">Add</b> (top right) for more widgets.</div>

    <GridLayout
      :layout="displayLayout" @update:layout="v => { if (!isNarrow) layout = v }"
      :col-num="12" :row-height="60" :margin="[18, 18]"
      :is-draggable="editing && !isNarrow" :is-resizable="editing && !isNarrow"
      :is-bounded="false" :vertical-compact="true" :use-css-transforms="true"
      :style="{ marginLeft: '-18px', marginRight: '-18px' }"
      :class="editing ? 'is-editing' : ''">
      <GridItem v-for="item in displayLayout" :key="item.i"
        :i="item.i" :x="item.x" :y="item.y" :w="item.w" :h="item.h" :min-w="item.minW" :min-h="item.minH">
        <div class="relative h-full w-full overflow-hidden rounded-xl"
          :class="editing ? 'ring-2 ring-primary/30 ring-offset-0' : ''">
          <button v-if="editing" type="button"
            class="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500"
            title="Hide widget" @click="removeWidget(item.i)">
            <i class="pi pi-times text-xs" />
          </button>

          <div class="h-full w-full overflow-auto" :class="editing ? 'pointer-events-none select-none' : ''">
            <!-- Stat tile (one of four; each independently toggleable) -->
            <NuxtLink v-if="STAT_TILES[item.i]" :to="STAT_TILES[item.i].to"
              class="card h-full p-0 overflow-hidden flex items-stretch hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div class="w-12 md:w-16 shrink-0 flex items-center justify-center text-white"
                :style="{ backgroundColor: STAT_TILES[item.i].color }"><i :class="['pi', STAT_TILES[item.i].icon, 'text-base md:text-xl']" /></div>
              <div class="min-w-0 flex-1 px-3 md:px-4 flex flex-col justify-center">
                <p class="text-xl md:text-3xl font-bold text-gray-900 leading-none">{{ (stats as any)[STAT_TILES[item.i].stat] }}</p>
                <p class="text-[11px] md:text-sm font-medium text-gray-600 mt-0.5 md:mt-1.5 leading-tight truncate">{{ STAT_TILES[item.i].label }}</p>
                <p class="hidden md:block text-[11px] text-gray-400 md:truncate">{{ STAT_TILES[item.i].sublabel }}</p>
              </div>
            </NuxtLink>

            <!-- Quick actions: inline buttons on desktop, dropdown on mobile/tablet -->
            <div v-else-if="item.i === 'quick_actions'" class="card p-3 h-full flex items-center">
              <!-- mobile / tablet: dropdown -->
              <button type="button"
                class="md:hidden inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors w-full sm:w-56"
                @click="e => quickMenu.toggle(e)">
                <span class="inline-flex items-center gap-2"><i class="pi pi-plus" />Quick actions</span>
                <i class="pi pi-chevron-down text-xs" />
              </button>
              <!-- desktop: inline buttons -->
              <div class="hidden md:flex items-center gap-2 flex-wrap">
                <button v-for="qa in quickItems" :key="qa.label" type="button"
                  class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
                  @click="qa.command">
                  <i :class="qa.icon" />{{ qa.label }}
                </button>
              </div>
            </div>

            <!-- Upcoming events -->
            <AppCard v-else-if="item.i === 'upcoming_events'" title="Upcoming events" class="h-full">
              <template #header-action>
                <NuxtLink to="/events" class="text-xs font-medium text-primary hover:underline">View all →</NuxtLink>
              </template>
              <div class="px-3 py-2">
                <div v-if="loading" class="text-sm text-gray-400 py-4 px-2">Loading…</div>
                <div v-else-if="!upcoming.length" class="text-sm text-gray-400 py-8 text-center">
                  No upcoming events. <NuxtLink to="/events/new-basic" class="text-primary hover:underline">Create one →</NuxtLink>
                </div>
                <ul v-else>
                  <li v-for="e in upcoming" :key="e.id">
                    <NuxtLink :to="`/events/${e.id}`" class="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                      <div class="w-12 h-12 shrink-0 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center">
                        <span class="text-[9px] uppercase tracking-wide text-gray-400 leading-none">{{ fmtDate(e.start_at).split(' ')[0] }}</span>
                        <span class="text-lg font-bold text-primary leading-tight">{{ new Date(e.start_at!).getDate() }}</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-800 truncate">{{ e.title }}</p>
                        <p class="text-xs text-gray-400 truncate">
                          {{ fmtTime(e.start_at) }}<span v-if="e.location_type === 'ADDRESS' && e.address"> · {{ e.address }}</span>
                          <span v-else-if="e.location_type === 'ONLINE'"> · Online</span>
                        </p>
                      </div>
                      <span class="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full shrink-0"
                        :class="e.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'">{{ e.status.toLowerCase() }}</span>
                    </NuxtLink>
                  </li>
                </ul>
              </div>
            </AppCard>

            <!-- Members by type -->
            <AppCard v-else-if="item.i === 'members_by_type'" title="Members by type" class="h-full">
              <div class="p-5">
                <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
                <div v-else-if="!byType.length" class="text-sm text-gray-400 py-8 text-center">No members yet.</div>
                <div v-else class="space-y-3.5">
                  <div v-for="t in byType" :key="t.label">
                    <div class="flex items-center justify-between text-xs mb-1.5">
                      <span class="text-gray-600 truncate">{{ t.label }}</span>
                      <span class="text-gray-400 tabular-nums shrink-0">{{ t.count }}</span>
                    </div>
                    <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div class="h-full rounded-full bg-primary transition-all" :style="{ width: (t.count / maxTypeCount * 100) + '%' }" />
                    </div>
                  </div>
                </div>
              </div>
            </AppCard>

            <!-- Chart widget (choose the field to report on; configurable) -->
            <div v-else-if="isChart(item.i)" class="card h-full flex flex-col">
              <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 pointer-events-auto">
                <p class="text-sm font-semibold text-gray-800 truncate">{{ chartTitle(item.i) }}</p>
                <div class="flex items-center gap-1.5 shrink-0">
                  <div class="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                    <button type="button" class="px-2 py-1 transition-colors" :class="chartType(item.i) === 'pie' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-50'" title="Pie" @click="setChartType(item.i, 'pie')"><i class="pi pi-chart-pie text-xs" /></button>
                    <button type="button" class="px-2 py-1 transition-colors" :class="chartType(item.i) === 'bar' ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-50'" title="Bar" @click="setChartType(item.i, 'bar')"><i class="pi pi-chart-bar text-xs" /></button>
                  </div>
                  <button type="button" class="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center" title="Chart settings" @click="openChartSettings(item.i)"><i class="pi pi-cog text-xs" /></button>
                </div>
              </div>
              <div class="flex-1 min-h-0 p-3 flex flex-col overflow-hidden">
                <div v-if="loading" class="text-sm text-gray-400 p-2">Loading…</div>
                <div v-else-if="!chartRows(item.i).length" class="text-sm text-gray-400 py-8 text-center">No data for this field yet.</div>
                <template v-else>
                  <div class="min-h-0" :class="chartShowTable(item.i) ? 'h-40 shrink-0' : 'flex-1'">
                    <Chart :type="chartType(item.i)" :data="chartData(item.i)" :options="chartOptions(item.i)" class="h-full w-full" />
                  </div>
                  <div v-if="chartShowTable(item.i)" class="mt-2 overflow-auto pointer-events-auto">
                    <table class="w-full text-xs">
                      <tbody>
                        <tr v-for="r in chartTableRows(item.i)" :key="r.label" class="border-t border-gray-50">
                          <td class="py-1 pr-2 text-gray-700"><span class="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" :style="{ background: r.color }" />{{ r.label }}</td>
                          <td class="py-1 text-right tabular-nums text-gray-800">{{ r.count }}</td>
                          <td class="py-1 pl-2 text-right tabular-nums text-gray-400 w-10">{{ r.pct }}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
              </div>
            </div>

            <!-- Recently added members -->
            <AppCard v-else-if="item.i === 'recent_members'" title="Recently added members" class="h-full">
              <template #header-action>
                <NuxtLink to="/people" class="text-xs font-medium text-primary hover:underline">View all →</NuxtLink>
              </template>
              <div class="px-3 py-2">
                <div v-if="loading" class="text-sm text-gray-400 py-4 px-2">Loading…</div>
                <div v-else-if="!recent.length" class="text-sm text-gray-400 py-8 text-center">No members yet.</div>
                <ul v-else>
                  <li v-for="p in recent" :key="p.id">
                    <NuxtLink :to="`/people/${p.id}`" class="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                      <span class="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold shrink-0">
                        {{ p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }}
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-800 truncate">{{ p.name || 'Unnamed' }}</p>
                        <p v-if="p.email" class="text-xs text-gray-400 truncate">{{ p.email }}</p>
                      </div>
                      <span class="text-xs text-gray-400 shrink-0">{{ fmtDate(p.created_at) }}</span>
                    </NuxtLink>
                  </li>
                </ul>
              </div>
            </AppCard>
          </div>
        </div>
      </GridItem>
    </GridLayout>

    <div v-if="!layout.length && !editing" class="card p-8 text-center text-gray-400 text-sm">
      No widgets shown. <button class="text-primary hover:underline" @click="startEdit">Customise your dashboard →</button>
    </div>
    </div>

    <!-- Quick-actions popup menu (rendered once, outside the widget loop) -->
    <Menu ref="quickMenu" :model="quickItems" :popup="true" />

    <!-- Per-chart settings -->
    <Dialog :visible="!!settingsKey" modal header="Chart settings" :style="{ width: '95vw', maxWidth: '26rem' }" @update:visible="v => { if (!v) settingsKey = null }">
      <div class="flex flex-col gap-3.5">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Title</label>
          <InputText v-model="settingsDraft.title" :placeholder="reportFields.find(f => f.value === settingsDraft.dimension)?.label || 'Chart'" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Report on</label>
          <Select v-model="settingsDraft.dimension" :options="reportFields" option-label="label" option-value="value" class="w-full" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Chart type</label>
            <Select v-model="settingsDraft.chartType" :options="[{ value: 'pie', label: 'Pie' }, { value: 'bar', label: 'Bar' }]" option-label="label" option-value="value" class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Colours</label>
            <Select v-model="settingsDraft.palette" :options="PALETTE_OPTIONS" option-label="label" option-value="value" class="w-full" />
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Show legend</span>
          <ToggleSwitch v-model="settingsDraft.legend" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Show data table</span>
          <ToggleSwitch v-model="settingsDraft.showTable" />
        </div>
        <div v-if="settingsDraft.chartType === 'bar'" class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Y-axis min</label>
            <InputNumber v-model="settingsDraft.yMin" :min="0" placeholder="Auto" showButtons class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Y-axis max</label>
            <InputNumber v-model="settingsDraft.yMax" :min="0" placeholder="Auto" showButtons class="w-full" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="settingsKey = null" />
        <Button label="Save" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveChartSettings" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* Edit-mode affordances for the grid items. */
.is-editing :deep(.vgl-item) { cursor: grab; }
.is-editing :deep(.vgl-item--resizing),
.is-editing :deep(.vgl-item--dragging) { cursor: grabbing; z-index: 30; }
:deep(.vgl-item__resizer) { z-index: 20; }
</style>
