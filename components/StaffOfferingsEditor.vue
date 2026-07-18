<template>
  <!--
    "What I offer" tab for /bookables/:id when the bookable is a PERSON.
    A staff member owns exactly ONE activity (its name = the staff's
    name) and their offerings are the modes on that activity. This tab
    is the modes list — no activity-level UI here, just modes.

    The single owning activity is auto-created the first time this tab
    is opened so existing staff don't need any setup.
  -->
  <div class="p-3 sm:p-6 min-h-full">
    <div class="max-w-3xl mx-auto">
      <div class="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-gray-900">What {{ staffName || 'this coach' }} offers</h2>
          <p class="text-sm text-gray-500 mt-1">
            Each option is something members can book — duration, price, what's included.
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Button v-if="activityId" label="Settings" icon="pi pi-cog" size="small" severity="secondary" outlined
            @click="navigateTo(`/activities/${activityId}`)" />
          <Button label="Add option" icon="pi pi-plus" size="small"
            :disabled="!activityId || creatingMode"
            @click="addMode"
            style="background:var(--brand-primary); border-color:var(--brand-primary)" />
        </div>
      </div>

      <div v-if="loading" class="py-10 text-center text-sm text-gray-400">
        <i class="pi pi-spin pi-spinner text-lg" />
      </div>

      <div v-else-if="!modes.length"
        class="text-center py-12 px-3 sm:px-6 bg-white rounded-xl border-2 border-dashed border-gray-200">
        <div class="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <i class="pi pi-bolt text-lg text-gray-400" />
        </div>
        <p class="text-sm font-semibold text-gray-700 mb-1">No options yet</p>
        <p class="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
          Add a session type — e.g. "30-min adult lesson" or "Kids group coaching".
        </p>
        <Button label="Add option" icon="pi pi-plus" size="small"
          :disabled="!activityId || creatingMode"
          @click="addMode"
          style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </div>

      <div v-else class="space-y-2">
        <div v-for="m in modes" :key="m.id"
          class="bg-white rounded-xl border border-gray-200 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
          @click="openMode(m.id)">
          <div class="px-5 py-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              :style="{ background: (m.color ?? '#1E2157') + '1A', color: m.color ?? '#1E2157' }">
              <i class="pi pi-bolt text-base" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-gray-900 truncate">{{ m.name }}</p>
              <p class="text-[11px] text-gray-400 mt-0.5">
                <span v-if="m.period_price != null">${{ m.period_price }}<span v-if="m.period_unit"> / {{ formatPeriod(m) }}</span></span>
                <span v-else>—</span>
              </p>
            </div>
            <i class="pi pi-chevron-right text-gray-300 text-xs" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ staffBookableId: string; staffName?: string | null }>()

const api = useBookingsApi()
const { orgId } = useOrg()
const toast = useToast()

const loading = ref(true)
const creatingMode = ref(false)
const activityId = ref<string | null>(null)
const modes = ref<any[]>([])

function formatPeriod(m: any): string {
  if (!m?.period_unit) return ''
  const c = m.period_count ?? 1
  return c === 1 ? m.period_unit : `${c} ${m.period_unit}s`
}

// Resolve the staff's owning activity. Three paths in order of cost:
//   1. Activity already tagged with staff_bookable_id — perfect.
//   2. Activity linked via activity_bookables but not yet tagged —
//      happens for PERSON bookables created before migration 119.
//      Backfill the column and reuse it.
//   3. No activity at all — create one named after the staff member.
async function ensureActivity(): Promise<string | null> {
  // Pull every activity linked to (or tagged with) this staff bookable in one call,
  // then resolve the three paths client-side.
  let linked: Awaited<ReturnType<typeof api.bookableActivities>> = []
  try {
    linked = await api.bookableActivities(props.staffBookableId)
  } catch (e) {
    console.error('StaffOfferingsEditor: bookable-activity lookup failed', e)
  }

  // Path 1 — an activity already tagged with staff_bookable_id.
  const tagged = linked.find(a => a.staffBookableId === props.staffBookableId && a.status !== 'ARCHIVED')
  if (tagged) return tagged.id

  // Path 2 — linked via activity_bookables but not yet tagged (pre-mig-119); backfill.
  const candidate = linked.find(a => a.status !== 'ARCHIVED' && !a.staffBookableId)
  if (candidate) {
    await api.updateActivity(candidate.id, { staffBookableId: props.staffBookableId })
    return candidate.id
  }

  // Path 3 — no activity yet; create one named after the staff member.
  if (!orgId.value) return null
  try {
    const created = await api.createActivity({
      orgId: orgId.value,
      name: props.staffName?.trim() || 'Coach',
      status: 'ACTIVE',
      bookingsEnabled: true,
      bookingFlow: 'wizard',
      requireMode: true,
      staffBookableId: props.staffBookableId,
    })
    await api.setActivityBookables(created.id, [props.staffBookableId])
    return created.id
  } catch (e) {
    console.error('StaffOfferingsEditor: failed to create activity', e)
    return null
  }
}

async function load() {
  loading.value = true
  try {
    const id = await ensureActivity()
    activityId.value = id
    if (!id) { modes.value = []; return }
    // Seam returns camelCase; map the fields this card reads back to snake_case.
    const rows = await api.activityModes(id)
    modes.value = rows.map(m => ({
      ...m,
      period_unit: m.periodUnit, period_count: m.periodCount,
      period_price: m.periodPrice, term_type: m.termType, sort_order: m.sortOrder,
    }))
  } catch (e) {
    console.error('StaffOfferingsEditor load failed', e)
    toast.add({ severity: 'error', summary: 'Could not load services', detail: (e as any)?.message ?? 'Unknown error', life: 5000 })
  } finally {
    loading.value = false
  }
}

function openMode(modeId: string) {
  if (!activityId.value) return
  navigateTo(`/activities/${activityId.value}/modes/${modeId}`)
}

async function addMode() {
  if (!activityId.value) return
  creatingMode.value = true
  try {
    const row = await api.createActivityMode({
      activityId: activityId.value,
      name: 'New option',
      sortOrder: modes.value.length,
    })
    if (!row?.id) throw new Error('Could not create')
    navigateTo(`/activities/${activityId.value}/modes/${row.id}`)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not add', detail: e?.message ?? 'Unknown error', life: 5000 })
  } finally {
    creatingMode.value = false
  }
}

// Watch BOTH the bookable id and orgId — orgId resolves async on initial
// mount, and without it `ensureActivity` can't fall through to the
// create path. Re-running the loader once orgId is ready fixes a "blank
// tab on first open" race.
watch([() => props.staffBookableId, orgId], load, { immediate: true })
</script>
