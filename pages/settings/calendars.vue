<template>
  <div class="p-3 sm:p-6 max-w-[1140px] mx-auto space-y-8">

    <!-- ── CATEGORIES ──────────────────────────────────────────── -->
    <div>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Categories</h2>
          <p class="text-sm text-gray-500 mt-0.5">Colour-coded labels assigned directly to events.</p>
        </div>
        <Button label="New Category" icon="pi pi-plus" size="small" class="w-full sm:w-auto"
          @click="openCatCreate" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </div>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div v-if="catsLoading" class="p-8 flex justify-center">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        </div>
        <div v-else-if="!categories.length" class="text-center py-10 text-gray-400">
          <i class="pi pi-tag text-3xl mb-3 block" />
          <p class="text-sm">No categories yet.</p>
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div v-for="cat in categories" :key="cat.id"
            class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              :style="{ background: cat.color ?? '#1E2157' }">
              <i :class="`${cat.icon ?? 'pi pi-tag'} text-white text-sm`" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900">{{ cat.name }}</p>
              <p class="text-xs text-gray-400">{{ cat._eventCount ?? 0 }} events</p>
            </div>
            <div class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openCatEdit(cat)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteCategory(cat)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── CALENDARS ───────────────────────────────────────────── -->
    <div>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Calendars</h2>
          <p class="text-sm text-gray-500 mt-0.5">Named groupings of categories for filtering the calendar view.</p>
        </div>
        <Button label="New Calendar" icon="pi pi-plus" size="small" class="w-full sm:w-auto"
          @click="openCalCreate" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </div>

      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div v-if="calsLoading" class="p-8 flex justify-center">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        </div>
        <div v-else-if="!calendars.length" class="text-center py-10 text-gray-400">
          <i class="pi pi-calendar text-3xl mb-3 block" />
          <p class="text-sm">No calendars yet. Create one to group categories for filtering.</p>
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div v-for="cal in calendars" :key="cal.id"
            class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
            <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <i class="pi pi-calendar text-gray-500 text-sm" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900">{{ cal.name }}</p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <template v-if="cal.categoryIds?.length">
                  <span v-for="catId in cal.categoryIds.slice(0, 5)" :key="catId"
                    class="flex items-center gap-1 text-xs text-gray-500">
                    <span class="w-2 h-2 rounded-full shrink-0"
                      :style="{ background: catById[catId]?.color ?? '#94a3b8' }" />
                    {{ catById[catId]?.name ?? '?' }}
                  </span>
                  <span v-if="cal.categoryIds.length > 5" class="text-xs text-gray-400">
                    +{{ cal.categoryIds.length - 5 }} more
                  </span>
                </template>
                <span v-else class="text-xs text-gray-400 italic">No categories assigned</span>
              </div>
            </div>
            <div class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button v-if="shareClubs.length" icon="pi pi-share-alt" severity="secondary" text rounded size="small" v-tooltip.top="'Share with clubs'" @click="openShare(cal)" />
              <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openCalEdit(cal)" />
              <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteCalendar(cal)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── CATEGORY DIALOG ─────────────────────────────────────── -->
    <Dialog v-model:visible="showCatDialog" :header="editingCat ? 'Edit Category' : 'New Category'" modal :style="{ width: '95vw', maxWidth: '420px' }">
      <div class="flex flex-col gap-4 py-1">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="catForm.name" autofocus placeholder="e.g. Training, Competition, Social" />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Colour</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="c in colorPalette" :key="c"
              class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              :class="catForm.color === c ? 'border-gray-900 scale-110' : 'border-transparent'"
              :style="{ background: c }"
              @click="catForm.color = c" />
            <input type="color" v-model="catForm.color" class="w-7 h-7 rounded cursor-pointer border border-gray-200" />
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Icon</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="icon in iconOptions" :key="icon"
              class="w-8 h-8 rounded-lg border flex items-center justify-center text-sm transition-colors"
              :class="catForm.icon === icon ? 'border-primary bg-[#EFF6FF] text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-400'"
              @click="catForm.icon = icon">
              <i :class="`pi pi-${icon}`" />
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" :style="{ background: catForm.color || '#1E2157' }">
            <i :class="`pi pi-${catForm.icon || 'tag'} text-white text-sm`" />
          </div>
          <span class="text-sm font-medium text-gray-700">{{ catForm.name || 'Category name' }}</span>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCatDialog = false" />
        <Button :label="editingCat ? 'Save' : 'Create'" :loading="catSaving"
          :disabled="!catForm.name.trim()" @click="saveCat"
          style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <!-- ── CALENDAR DIALOG ─────────────────────────────────────── -->
    <Dialog v-model:visible="showCalDialog" :header="editingCal ? 'Edit Calendar' : 'New Calendar'" modal :style="{ width: '95vw', maxWidth: '440px' }">
      <div class="flex flex-col gap-4 py-1">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="calForm.name" autofocus placeholder="e.g. All Events, Juniors, Competitive Season" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Categories</label>
          <MultiSelect
            v-model="calForm.categoryIds"
            :options="categories"
            option-label="name"
            option-value="id"
            placeholder="Select categories to include…"
            display="chip"
            class="w-full"
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: option.color ?? '#94a3b8' }" />
                <span>{{ option.name }}</span>
              </div>
            </template>
          </MultiSelect>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCalDialog = false" />
        <Button :label="editingCal ? 'Save' : 'Create'" :loading="calSaving"
          :disabled="!calForm.name.trim()" @click="saveCal"
          style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <!-- Share a calendar with clubs -->
    <Dialog v-model:visible="showShareDialog" modal :header="`Share &quot;${shareCal?.name}&quot; with clubs`" :style="{ width: '95vw', maxWidth: '460px' }">
      <p class="text-xs text-gray-500 mb-3">Pick the clubs that should see this calendar's events. Each club accepts it from their dashboard — nothing shows on their calendar until they do.</p>
      <div class="space-y-1.5 max-h-[55vh] overflow-y-auto">
        <div v-for="club in shareClubs" :key="club.id" class="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate">{{ club.name }}</p>
            <p class="text-xs text-gray-400">{{ orgLevelLabel(club.org_level) }}</p>
          </div>
          <span v-if="shareStatusFor(club.id)?.status === 'ACCEPTED'" class="text-[11px] font-semibold text-emerald-600">Accepted</span>
          <span v-else-if="shareStatusFor(club.id)?.status === 'DECLINED'" class="text-[11px] font-semibold text-rose-500">Declined</span>
          <span v-else-if="shareStatusFor(club.id)" class="text-[11px] font-semibold text-amber-500">Invited</span>
          <Button :label="shareStatusFor(club.id) ? 'Unshare' : 'Share'" size="small" :outlined="!!shareStatusFor(club.id)"
            :severity="shareStatusFor(club.id) ? 'secondary' : undefined" :loading="shareBusy === club.id"
            :style="shareStatusFor(club.id) ? undefined : 'background:var(--brand-primary);border-color:var(--brand-primary)'"
            @click="toggleShare(club)" />
        </div>
        <p v-if="!shareClubs.length" class="text-sm text-gray-400 text-center py-4">No clubs to share with.</p>
      </div>
    </Dialog>

    <ConfirmDialog />
    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

// The Calendars section (calendars + calendar_categories: read join + create/update/
// delete + category links) goes through useWaitlistsApi (calendar WRITES seam); the
// category list + its per-row event-count badge go through useEventsApi.
const { categories: apiCategories, categoryEventCounts, createCategory, updateCategory, removeCategory, calendarInvitees, addCalendarInvitee, removeCalendarInvitee } = useEventsApi()
const {
  calendars: apiCalendars,
  createCalendar,
  updateCalendar,
  removeCalendar,
  setCalendarCategories,
} = useWaitlistsApi()
const toast = useToast()
const confirm = useConfirm()

// ── Sharing a calendar with clubs ───────────────────────────────
// A governing org shares a whole calendar with the clubs beneath it; each club
// accepts from its dashboard and the calendar's events surface on its own calendar.
// The Share control only appears when this org actually has clubs to share with.
const { descendants } = useOrgHierarchy()
const shareClubs = ref<any[]>([])
async function loadShareClubs() {
  if (!orgId.value) { shareClubs.value = []; return }
  shareClubs.value = await descendants(orgId.value).catch(() => [])
}
const showShareDialog = ref(false)
const shareCal = ref<any>(null)
const shareRows = ref<any[]>([])           // calendar_org_invitees for the open calendar
const shareBusy = ref<string | null>(null) // clubId whose share is in flight
const shareStatusFor = (clubId: string) => shareRows.value.find(r => r.orgId === clubId)
async function openShare(cal: any) {
  shareCal.value = cal
  shareRows.value = await calendarInvitees(cal.id).catch(() => [])
  showShareDialog.value = true
}
async function toggleShare(club: any) {
  const existing = shareStatusFor(club.id)
  shareBusy.value = club.id
  try {
    if (existing) await removeCalendarInvitee(existing.id)
    else await addCalendarInvitee({ calendarId: shareCal.value.id, orgId: club.id, invitedByOrgId: orgId.value })
    shareRows.value = await calendarInvitees(shareCal.value.id)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Failed to update sharing', detail: err?.message, life: 4000 })
  } finally { shareBusy.value = null }
}

// ── Categories ──────────────────────────────────────────────────
const categories = ref<any[]>([])
const catsLoading = ref(true)
const showCatDialog = ref(false)
const catSaving = ref(false)
const editingCat = ref<any>(null)
const catForm = reactive({ name: '', color: '#1E2157', icon: 'tag' })

const catById = computed(() => Object.fromEntries(categories.value.map(c => [c.id, c])))

const colorPalette = [
  '#1E2157', '#3B82F6', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#6B7280', '#1EA97C', '#F97316', '#84CC16',
]
const iconOptions = [
  'calendar', 'users', 'trophy', 'bolt', 'flag',
  'star', 'heart', 'tag', 'briefcase', 'home',
  'map-marker', 'clock', 'shield', 'book', 'graduation-cap',
]

async function loadCategories() {
  catsLoading.value = true
  const [cats, counts] = await Promise.all([
    apiCategories(orgId.value),
    categoryEventCounts(orgId.value),
  ])
  // The list + calendar chips read id/name/color/icon (all on the seam shape); attach
  // the per-category event count for the badge.
  categories.value = (cats ?? []).map((c: any) => ({ ...c, _eventCount: counts?.[c.id] ?? 0 }))
  catsLoading.value = false
}

function openCatCreate() {
  editingCat.value = null
  catForm.name = ''
  catForm.color = '#1E2157'
  catForm.icon = 'tag'
  showCatDialog.value = true
}

function openCatEdit(cat: any) {
  editingCat.value = cat
  catForm.name = cat.name
  catForm.color = cat.color ?? '#1E2157'
  catForm.icon = (cat.icon ?? 'pi-tag').replace('pi-', '')
  showCatDialog.value = true
}

async function saveCat() {
  catSaving.value = true
  try {
    if (editingCat.value) {
      await updateCategory(editingCat.value.id, { name: catForm.name.trim(), color: catForm.color, icon: `pi-${catForm.icon}` })
      toast.add({ severity: 'success', summary: 'Category updated', life: 3000 })
    } else {
      await createCategory({ orgId: orgId.value, name: catForm.name.trim(), color: catForm.color, icon: `pi-${catForm.icon}` })
      toast.add({ severity: 'success', summary: 'Category created', life: 3000 })
    }
    showCatDialog.value = false
    await loadCategories()
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Failed to save', detail: err?.message, life: 4000 })
  }
  catSaving.value = false
}

function deleteCategory(cat: any) {
  confirm.require({
    message: `Delete "${cat.name}"? Events using this category won't be deleted, just unassigned.`,
    header: 'Delete Category',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await removeCategory(cat.id)
      toast.add({ severity: 'success', summary: 'Category deleted', life: 3000 })
      await loadCategories()
    },
  })
}

// ── Calendars ───────────────────────────────────────────────────
const calendars = ref<any[]>([])
const calsLoading = ref(true)
const showCalDialog = ref(false)
const calSaving = ref(false)
const editingCal = ref<any>(null)
const calForm = reactive({ name: '', categoryIds: [] as string[] })

async function loadCalendars() {
  calsLoading.value = true
  // The seam returns each calendar already hydrated with its linked category ids.
  calendars.value = await apiCalendars(orgId.value)
  calsLoading.value = false
}

function openCalCreate() {
  editingCal.value = null
  calForm.name = ''
  calForm.categoryIds = []
  showCalDialog.value = true
}

function openCalEdit(cal: any) {
  editingCal.value = cal
  calForm.name = cal.name
  calForm.categoryIds = [...(cal.categoryIds ?? [])]
  showCalDialog.value = true
}

async function saveCal() {
  calSaving.value = true
  try {
    if (editingCal.value) {
      await updateCalendar(editingCal.value.id, { name: calForm.name.trim() })
      await setCalendarCategories(orgId.value, editingCal.value.id, calForm.categoryIds)
      toast.add({ severity: 'success', summary: 'Calendar updated', life: 3000 })
    } else {
      await createCalendar({ orgId: orgId.value, name: calForm.name.trim(), categoryIds: calForm.categoryIds })
      toast.add({ severity: 'success', summary: 'Calendar created', life: 3000 })
    }
    showCalDialog.value = false
    await loadCalendars()
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Failed to save', detail: err?.message, life: 4000 })
  }
  calSaving.value = false
}

function deleteCalendar(cal: any) {
  confirm.require({
    message: `Delete "${cal.name}"? This only removes the calendar grouping — events and categories are unaffected.`,
    header: 'Delete Calendar',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await removeCalendar(orgId.value, cal.id)
      toast.add({ severity: 'success', summary: 'Calendar deleted', life: 3000 })
      await loadCalendars()
    },
  })
}

onMounted(async () => {
  await loadCategories()
  await loadCalendars()
  await loadShareClubs()
})
</script>
