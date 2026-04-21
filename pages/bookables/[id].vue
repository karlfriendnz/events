<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">

    <!-- Row 1: Pill tabs -->
    <div class="bg-white border-b border-gray-200 px-4 py-2.5 shrink-0 flex justify-center">
      <div class="flex gap-2">
        <button v-for="tab in tabs" :key="tab.key"
          class="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-colors"
          :class="activeTab === tab.key
            ? 'bg-[#1E2157] text-white shadow-sm'
            : 'bg-[rgba(30,33,90,0.06)] text-gray-600 hover:bg-[rgba(30,33,90,0.1)]'"
          @click="activeTab = tab.key">
          <i :class="`pi ${tab.icon} text-xs`" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Row 2: Contextual actions (only when there's something to show) -->
    <div v-if="activeTab === 'bookings' || ['details','layouts','rules'].includes(activeTab)"
      class="bg-white border-b border-gray-200 px-4 py-2 shrink-0 flex items-center justify-between gap-3">
      <template v-if="activeTab === 'bookings'">
        <div class="flex items-center gap-2">
          <Button label="New Booking" icon="pi pi-plus" size="small"
            @click="openNewBooking(null)" style="background:#1E2157;border-color:#1E2157" />
          <div class="flex items-center gap-1">
            <Button icon="pi pi-chevron-left" severity="secondary" text size="small" @click="navPrev" />
            <span class="text-sm font-medium text-gray-700 w-36 text-center">{{ activeCalView === 'scheduler' ? schedulerTitle : calTitle }}</span>
            <Button icon="pi pi-chevron-right" severity="secondary" text size="small" @click="navNext" />
            <Button label="Today" severity="secondary" outlined size="small" @click="navToday" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button v-for="v in calViews" :key="v.value"
              class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              :class="activeCalView === v.value ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'"
              @click="setCalView(v.value)">
              {{ v.label }}
            </button>
          </div>
          <Button icon="pi pi-ellipsis-v" severity="secondary" text size="small" @click="e => moreMenu.toggle(e)" />
          <Menu ref="moreMenu" :model="moreMenuItems" :popup="true" />
        </div>
      </template>
      <template v-else-if="['details','layouts','rules'].includes(activeTab)">
        <div />
        <div class="flex items-center gap-2">
          <Button label="Save changes" icon="pi pi-check" size="small"
            :loading="editorRef?.saving" :disabled="loading"
            @click="editorRef?.save()" style="background:#1E2157;border-color:#1E2157" />
          <Button icon="pi pi-ellipsis-v" severity="secondary" text size="small" @click="e => moreMenu.toggle(e)" />
          <Menu ref="moreMenu" :model="moreMenuItems" :popup="true" />
        </div>
      </template>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 bg-[#F5F8FA] overflow-hidden">

      <!-- Bookings tab -->
      <div v-if="activeTab === 'bookings'" class="h-full flex flex-col">
        <div v-if="activeCalView !== 'scheduler'" class="flex-1 min-h-0 p-4">
          <div class="h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
            <FullCalendar ref="calRef" :options="calOptions" style="height:100%" />
          </div>
        </div>
        <SubVenueScheduler v-else class="flex-1 min-h-0" :children="children" :date="schedulerDate"
          @booking-click="openEditBooking"
          @new-booking="openSchedulerBooking" />
      </div>

      <!-- Editor tabs (Details / Layouts / Rules) -->
      <div v-else-if="venue && ['details','layouts','rules'].includes(activeTab)" class="h-full flex flex-col">

        <!-- Layouts inheritance banner -->
        <div v-if="activeTab === 'layouts' && venue?.master_id" class="mx-6 mt-6 mb-0 rounded-xl border overflow-hidden"
          :class="sectionInherited('layouts') ? 'border-violet-200 bg-violet-50' : 'border-amber-200 bg-amber-50'">
          <div class="flex items-center gap-3 px-4 py-3">
            <i class="pi text-sm" :class="sectionInherited('layouts') ? 'pi-lock text-violet-500' : 'pi-lock-open text-amber-500'" />
            <span class="text-sm flex-1" :class="sectionInherited('layouts') ? 'text-violet-700' : 'text-amber-700'">
              <template v-if="sectionInherited('layouts')">Layouts inherited from <strong>{{ masterName }}</strong>.</template>
              <template v-else>Layouts customised locally.</template>
            </span>
            <button class="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors bg-white"
              :class="sectionInherited('layouts') ? 'border-violet-300 text-violet-700 hover:bg-violet-100' : 'border-amber-300 text-amber-700 hover:bg-amber-100'"
              @click="toggleSectionInheritance('layouts')">
              {{ sectionInherited('layouts') ? 'Customise' : 'Reset to master' }}
            </button>
          </div>
        </div>
        <BookableEditor
          ref="editorRef"
          :bookable="venue"
          :all-bookables="allBookables"
          :standalone="true"
          :initial-tab="activeTab"
          @saved="onSaved"
          @delete="onDelete"
          @set-role="setVenueRole"
          class="flex-1 min-h-0"
        />
      </div>

      <!-- Items tab -->
      <div v-else-if="activeTab === 'items'" class="h-full overflow-y-auto p-6">
        <div class="max-w-4xl mx-auto">
          <div class="flex justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-700">Items</h3>
            <div class="flex gap-2">
              <Button label="Add existing" icon="pi pi-link" size="small" severity="secondary" outlined
                @click="openAddExisting" />
              <Button label="Create new" icon="pi pi-plus" size="small"
                @click="navigateTo(`/bookables/new?parentId=${venue.id}&parentName=${encodeURIComponent(venue.name)}&type=ITEM`)"
                style="background:#1E2157; border-color:#1E2157" />
            </div>
          </div>
          <div v-if="!items.length" class="text-center py-16 text-gray-400">
            <i class="pi pi-box text-3xl mb-3 block text-gray-300" />
            <p class="text-sm">No items attached yet. Add existing items or create a new one.</p>
          </div>
          <div v-else class="grid grid-cols-3 gap-4">
            <div v-for="item in items" :key="item.id" class="relative group">
              <NuxtLink :to="`/bookables/${item.id}`"
                class="block bg-white border border-gray-200 rounded-xl p-4 hover:border-[#1E2157] hover:shadow-sm transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                    <i class="pi pi-box text-white text-xs" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-gray-900 text-sm truncate">{{ item.name }}</p>
                    <p v-if="item.item_category" class="text-xs text-gray-400">{{ item.item_category }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <Tag :value="item.status" :severity="statusSeverity(item.status)" class="text-xs" />
                  <span v-if="item.max_concurrent" class="text-xs text-gray-400">× {{ item.max_concurrent }}</span>
                </div>
              </NuxtLink>
              <button class="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200"
                title="Unlink item" @click.prevent="unlinkItem(item)">
                <i class="pi pi-times text-[10px] text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Availability tab -->
      <div v-else-if="activeTab === 'availability'" class="h-full overflow-y-auto">
        <!-- Inheritance banner -->
        <div v-if="venue?.master_id" class="mx-6 mt-6 rounded-xl border overflow-hidden"
          :class="sectionInherited('availability') ? 'border-violet-200 bg-violet-50' : 'border-amber-200 bg-amber-50'">
          <div class="flex items-center gap-3 px-4 py-3">
            <i class="pi text-sm" :class="sectionInherited('availability') ? 'pi-lock text-violet-500' : 'pi-lock-open text-amber-500'" />
            <span class="text-sm flex-1" :class="sectionInherited('availability') ? 'text-violet-700' : 'text-amber-700'">
              <template v-if="sectionInherited('availability')">Availability inherited from <strong>{{ masterName }}</strong>.</template>
              <template v-else>Availability customised locally.</template>
            </span>
            <button class="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors bg-white"
              :class="sectionInherited('availability') ? 'border-violet-300 text-violet-700 hover:bg-violet-100' : 'border-amber-300 text-amber-700 hover:bg-amber-100'"
              @click="toggleSectionInheritance('availability')">
              {{ sectionInherited('availability') ? 'Customise' : 'Reset to master' }}
            </button>
          </div>
        </div>
        <AvailabilityEditor
          :bookable-id="sectionInherited('availability') && venue?.master_id ? venue.master_id : id"
          :readonly="sectionInherited('availability') && !!venue?.master_id"
          @saved="onScheduleSaved"
        />
      </div>

      <!-- Sub-venues tab -->
      <div v-else-if="activeTab === 'sub-venues'" class="h-full overflow-y-auto p-6">
        <div class="max-w-4xl mx-auto">
          <div class="flex justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-700">Sub-venues</h3>
            <Button label="Add Sub-venue" icon="pi pi-plus" size="small"
              @click="navigateTo(`/bookables/new?parentId=${venue.id}&parentName=${encodeURIComponent(venue.name)}`)"
              style="background:#1E2157; border-color:#1E2157" />
          </div>
          <div v-if="!children.length" class="text-center py-16 text-gray-400">
            <i class="pi pi-sitemap text-3xl mb-3 block text-gray-300" />
            <p class="text-sm">No sub-venues yet.</p>
          </div>
          <div v-else class="grid grid-cols-3 gap-4">
            <div v-for="child in children" :key="child.id" class="relative group">
              <NuxtLink :to="`/bookables/${child.id}`"
                class="block bg-white border border-gray-200 rounded-xl p-4 hover:border-[#1E2157] hover:shadow-sm transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-8 h-8 rounded-lg bg-[#1E2157] flex items-center justify-center shrink-0">
                    <i class="pi pi-building text-white text-xs" />
                  </div>
                  <p class="font-medium text-gray-900 text-sm">{{ child.name }}</p>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-400">
                  <i class="pi pi-users" />
                  <span>Capacity {{ child.max_concurrent || '—' }}</span>
                </div>
                <div v-if="child.location" class="text-xs text-gray-400 mt-1">
                  <i class="pi pi-map-marker mr-1" />{{ child.location }}
                </div>
              </NuxtLink>
              <button class="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                title="Duplicate" @click.prevent="duplicateVenue(child)">
                <i class="pi pi-copy text-xs text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Add existing items dialog -->
    <Dialog v-model:visible="showAddExisting" header="Add existing items" modal style="width: 520px">
      <div class="space-y-3">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="existingSearch" placeholder="Search items…" class="w-full" autofocus />
        </IconField>
        <div class="max-h-80 overflow-y-auto space-y-1 border border-gray-100 rounded-lg">
          <div v-if="!filteredExistingItems.length" class="text-center py-8 text-sm text-gray-400">
            No unlinked items found.
          </div>
          <label v-for="exItem in filteredExistingItems" :key="exItem.id"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
            <Checkbox v-model="selectedExistingIds" :value="exItem.id" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900">{{ exItem.name }}</p>
              <p class="text-xs text-gray-400">{{ exItem.item_category || 'No category' }}</p>
            </div>
            <Tag :value="exItem.status" :severity="statusSeverity(exItem.status)" class="text-xs" />
          </label>
        </div>
        <p class="text-xs text-gray-400">{{ selectedExistingIds.length }} selected</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddExisting = false" />
        <Button label="Add selected" icon="pi pi-check" :disabled="!selectedExistingIds.length"
          :loading="linkingSaving" @click="linkSelectedItems"
          style="background:#1E2157; border-color:#1E2157" />
      </template>
    </Dialog>

    <BookingWizard
      v-if="venue"
      v-model="showBookingDialog"
      :bookable="wizardBookable ?? venue"
      :prefill-date="wizardPrefillDate"
      :prefill-end-date="wizardPrefillEndDate"
      :edit-booking="editingBooking"
      @saved="loadBookings"
    />

    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()
const route = useRoute()
const id = route.params.id as string
const breadcrumbs = useBreadcrumbs()

const venue = ref<any>(null)
const parentVenue = ref<any>(null)
const children = ref<any[]>([])
const allBookables = ref<any[]>([])
const linkedItems = ref<any[]>([])
const syncing = ref(false)
const loading = ref(true)
const moreMenu = ref()
const editorRef = ref<any>(null)
const activeTab = ref('bookings')
const linkedMasterId = ref<string | null>(null)

const masterName = computed(() =>
  allBookables.value.find(b => b.id === venue.value?.master_id)?.name ?? 'master'
)

const availableMasters = computed(() =>
  allBookables.value.filter(b => b.is_master && b.id !== id && b.status !== 'DELETED' && b.status !== 'ARCHIVED')
)

// Section inheritance helpers
function sectionInherited(section: string) {
  return !!(venue.value?.master_id) && !(venue.value?.customized_sections ?? []).includes(section)
}

async function toggleSectionInheritance(section: string) {
  if (!venue.value) return
  const current: string[] = venue.value.customized_sections ?? []
  let next: string[]
  if (current.includes(section)) {
    // Reset to master: remove from customized list, pull master data for this section
    next = current.filter(s => s !== section)
    await pullSectionFromMaster(section)
  } else {
    // Customise: add to list so master propagation skips this venue for this section
    next = [...current, section]
  }
  await db.from('bookables').update({ customized_sections: next }).eq('id', id)
  venue.value = { ...venue.value, customized_sections: next }
}

async function pullSectionFromMaster(section: string) {
  if (!venue.value?.master_id) return
  const masterId = venue.value.master_id

  if (section === 'layouts') {
    const { data: masterLayouts } = await (db.from as any)('bookable_layouts')
      .select('*, bookable_layout_modes(*)')
      .eq('bookable_id', masterId)
    await (db.from as any)('bookable_layouts').delete().eq('bookable_id', id)
    if (masterLayouts?.length) {
      const { data: newLayouts } = await (db.from as any)('bookable_layouts')
        .insert(masterLayouts.map(({ id: _, bookable_id: __, created_at: ___, bookable_layout_modes: ____, ...rest }: any) => ({ ...rest, bookable_id: id })))
        .select()
      if (newLayouts) {
        const modeRows: any[] = []
        newLayouts.forEach((nl: any, i: number) => {
          ;(masterLayouts[i].bookable_layout_modes ?? []).forEach((m: any) => {
            modeRows.push({ layout_id: nl.id, name: m.name, description: m.description, min_players: m.min_players, max_players: m.max_players, price: m.price, price_type: m.price_type, sort_order: m.sort_order })
          })
        })
        if (modeRows.length) await (db.from as any)('bookable_layout_modes').insert(modeRows)
      }
    }
  }

  if (section === 'availability') {
    const { data: avRules } = await (db.from as any)('availability_rules').select('*').eq('bookable_id', masterId)
    await (db.from as any)('availability_rules').delete().eq('bookable_id', id)
    if (avRules?.length) {
      await (db.from as any)('availability_rules').insert(
        avRules.map(({ id: _, bookable_id: __, created_at: ___, ...rest }: any) => ({ ...rest, bookable_id: id }))
      )
    }
  }

  if (section === 'schedule') {
    const { data: wins } = await (db.from as any)('booking_windows').select('*, booking_window_slots(*)').eq('bookable_id', masterId)
    await (db.from as any)('booking_windows').delete().eq('bookable_id', id)
    if (wins?.length) {
      const { data: newWins } = await (db.from as any)('booking_windows')
        .insert(wins.map(({ id: _, bookable_id: __, created_at: ___, booking_window_slots: ____, ...rest }: any) => ({ ...rest, bookable_id: id })))
        .select()
      if (newWins) {
        const slotRows: any[] = []
        newWins.forEach((nw: any, i: number) => {
          ;(wins[i].booking_window_slots ?? []).forEach((s: any) => {
            slotRows.push({ window_id: nw.id, slot_start: s.slot_start, slot_end: s.slot_end, capacity: s.capacity, label: s.label, sort_order: s.sort_order })
          })
        })
        if (slotRows.length) await (db.from as any)('booking_window_slots').insert(slotRows)
      }
    }
  }
}

// Propagate a section from this master to all linked venues that haven't customised it
async function propagateSectionToLinked(section: string) {
  if (!venue.value?.is_master || !linkedItems.value.length) return
  const targets = linkedItems.value.filter(l => !(l.customized_sections ?? []).includes(section))
  for (const target of targets) {
    const savedMasterId = venue.value.master_id
    // Temporarily treat this venue as the master for propagation
    venue.value = { ...venue.value!, master_id: null }
    await pullSectionFromMaster.call({ venue: { value: { ...target, master_id: id } } }, section)
    venue.value = { ...venue.value!, master_id: savedMasterId }
  }
  // Simpler: re-use the copy logic directly
  await propagateSection(section, targets.map(t => t.id))
}

async function propagateSection(section: string, targetIds: string[]) {
  if (!targetIds.length) return

  if (section === 'layouts') {
    const { data: masterLayouts } = await (db.from as any)('bookable_layouts')
      .select('*, bookable_layout_modes(*)')
      .eq('bookable_id', id)
    for (const tid of targetIds) {
      await (db.from as any)('bookable_layouts').delete().eq('bookable_id', tid)
      if (masterLayouts?.length) {
        const { data: newLayouts } = await (db.from as any)('bookable_layouts')
          .insert(masterLayouts.map(({ id: _, bookable_id: __, created_at: ___, bookable_layout_modes: ____, ...rest }: any) => ({ ...rest, bookable_id: tid })))
          .select()
        if (newLayouts) {
          const modeRows: any[] = []
          newLayouts.forEach((nl: any, i: number) => {
            ;(masterLayouts[i].bookable_layout_modes ?? []).forEach((m: any) => {
              modeRows.push({ layout_id: nl.id, name: m.name, description: m.description, min_players: m.min_players, max_players: m.max_players, price: m.price, price_type: m.price_type, sort_order: m.sort_order })
            })
          })
          if (modeRows.length) await (db.from as any)('bookable_layout_modes').insert(modeRows)
        }
      }
    }
  }

  if (section === 'schedule') {
    const { data: wins } = await (db.from as any)('booking_windows').select('*, booking_window_slots(*)').eq('bookable_id', id)
    for (const tid of targetIds) {
      await (db.from as any)('booking_windows').delete().eq('bookable_id', tid)
      if (wins?.length) {
        const { data: newWins } = await (db.from as any)('booking_windows')
          .insert(wins.map(({ id: _, bookable_id: __, created_at: ___, booking_window_slots: ____, ...rest }: any) => ({ ...rest, bookable_id: tid })))
          .select()
        if (newWins) {
          const slotRows: any[] = []
          newWins.forEach((nw: any, i: number) => {
            ;(wins[i].booking_window_slots ?? []).forEach((s: any) => {
              slotRows.push({ window_id: nw.id, slot_start: s.slot_start, slot_end: s.slot_end, capacity: s.capacity, label: s.label, sort_order: s.sort_order })
            })
          })
          if (slotRows.length) await (db.from as any)('booking_window_slots').insert(slotRows)
        }
      }
    }
  }
}

async function setVenueRole(role: 'standalone' | 'master' | 'linked') {
  if (!venue.value) return
  const updates: any = { is_master: false, master_id: null }
  if (role === 'master') updates.is_master = true
  if (role === 'linked') {
    const firstMaster = availableMasters.value[0]
    if (!firstMaster) return
    updates.master_id = firstMaster.id
    linkedMasterId.value = firstMaster.id
  }
  await db.from('bookables').update(updates).eq('id', id)
  venue.value = { ...venue.value, ...updates }
  if (role === 'linked' && updates.master_id) {
    for (const section of ['layouts', 'schedule']) {
      if (!sectionInherited(section)) continue
      await pullSectionFromMaster(section)
    }
  }
  await loadLinked()
}

async function changeMaster(newMasterId: string) {
  if (!venue.value) return
  await db.from('bookables').update({ master_id: newMasterId }).eq('id', id)
  venue.value = { ...venue.value, master_id: newMasterId }
  for (const section of ['layouts', 'schedule']) {
    if (sectionInherited(section)) await pullSectionFromMaster(section)
  }
}

// ── Items tab ─────────────────────────────────────────────────
const items = ref<any[]>([])
const showAddExisting = ref(false)
const existingSearch = ref('')
const allUnlinkedItems = ref<any[]>([])
const selectedExistingIds = ref<string[]>([])
const linkingSaving = ref(false)

const filteredExistingItems = computed(() => {
  const q = existingSearch.value.toLowerCase()
  return allUnlinkedItems.value.filter(i =>
    !q || i.name.toLowerCase().includes(q) || (i.item_category ?? '').toLowerCase().includes(q)
  )
})

async function openAddExisting() {
  existingSearch.value = ''
  selectedExistingIds.value = []
  const linkedIds = new Set(items.value.map(i => i.id))
  const { data } = await db.from('bookables').select('*').eq('type', 'ITEM').eq('status', 'ACTIVE').order('name')
  allUnlinkedItems.value = (data ?? []).filter(i => !linkedIds.has(i.id))
  showAddExisting.value = true
}

async function linkSelectedItems() {
  if (!selectedExistingIds.value.length) return
  linkingSaving.value = true
  await db.from('bookables').update({ parent_id: id }).in('id', selectedExistingIds.value)
  linkingSaving.value = false
  showAddExisting.value = false
  await loadItems()
  toast.add({ severity: 'success', summary: `${selectedExistingIds.value.length} item(s) linked`, life: 2000 })
}

async function unlinkItem(item: any) {
  if (!confirm(`Unlink "${item.name}" from this bookable?`)) return
  await db.from('bookables').update({ parent_id: null }).eq('id', item.id)
  await loadItems()
  toast.add({ severity: 'success', summary: 'Item unlinked', life: 2000 })
}

const bookings = ref<any[]>([])
const bookingsLoading = ref(false)
const calRef = ref<any>(null)
const calTitle = ref('')

const calViews = computed(() => [
  { label: 'Month', value: 'dayGridMonth' },
  { label: 'Week',  value: 'timeGridWeek' },
  { label: 'Day',   value: 'timeGridDay' },
  { label: 'List',  value: 'listWeek' },
  ...(children.value.length ? [{ label: 'Scheduler', value: 'scheduler' }] : []),
])
const activeCalView = ref('dayGridMonth')

const schedulerDate  = ref(new Date())
const schedulerTitle = computed(() =>
  schedulerDate.value.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' })
)

function setCalView(view: string) {
  activeCalView.value = view
  if (view !== 'scheduler') {
    calOptions.value.initialView = view
    nextTick(() => calRef.value?.getApi()?.changeView(view))
  }
}

function navPrev() {
  if (activeCalView.value === 'scheduler') {
    const d = new Date(schedulerDate.value); d.setDate(d.getDate() - 1); schedulerDate.value = d
  } else { calRef.value?.getApi()?.prev() }
}
function navNext() {
  if (activeCalView.value === 'scheduler') {
    const d = new Date(schedulerDate.value); d.setDate(d.getDate() + 1); schedulerDate.value = d
  } else { calRef.value?.getApi()?.next() }
}
function navToday() {
  if (activeCalView.value === 'scheduler') {
    schedulerDate.value = new Date()
  } else { calRef.value?.getApi()?.today() }
}

// Booking wizard
const showBookingDialog    = ref(false)
const editingBooking       = ref<any>(null)
const wizardPrefillDate    = ref<Date | null>(null)
const wizardPrefillEndDate = ref<Date | null>(null)
const wizardBookable       = ref<any>(null)

function openNewBooking(prefillDate: Date | null) {
  editingBooking.value       = null
  wizardPrefillDate.value    = prefillDate
  wizardPrefillEndDate.value = null
  wizardBookable.value       = null
  showBookingDialog.value    = true
}

function openEditBooking(booking: any) {
  editingBooking.value       = booking
  wizardPrefillDate.value    = null
  wizardPrefillEndDate.value = null
  wizardBookable.value       = null
  showBookingDialog.value    = true
}

function openSchedulerBooking(child: any, start: Date, end: Date) {
  editingBooking.value       = null
  wizardBookable.value       = child
  wizardPrefillDate.value    = start
  wizardPrefillEndDate.value = end
  showBookingDialog.value    = true
}

const tabs = computed(() => [
  { key: 'bookings',   label: 'Bookings',    icon: 'pi-calendar' },
  { key: 'details',    label: 'Details',     icon: 'pi-info-circle' },
  ...(venue.value?.allow_multiple_layouts !== false ? [{ key: 'layouts', label: 'Layouts', icon: 'pi-th-large' }] : []),
  { key: 'rules',      label: 'Rules',       icon: 'pi-file-edit' },
  { key: 'availability', label: 'Availability', icon: 'pi-clock' },
  { key: 'sub-venues', label: 'Sub-venues',  icon: 'pi-sitemap' },
  { key: 'items',      label: 'Items',       icon: 'pi-box' },
])

const calOptions = ref({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: false,
  height: '100%',
  events: [] as any[],
  eventDisplay: 'block',
  dayMaxEvents: 4,
  selectable: true,
  selectMirror: true,
  select: (info: any) => {
    const start = new Date(info.startStr)
    start.setHours(9, 0, 0, 0)
    const end = new Date(start)
    end.setHours(10, 0, 0, 0)
    openNewBooking(start)
  },
  eventClick: (info: any) => {
    const booking = bookings.value.find(b => b.id === info.event.id)
    if (booking) openEditBooking(booking)
  },
  datesSet: (info: any) => {
    calTitle.value = info.view.currentStart.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  },
  dayCellClassNames: 'hover:bg-gray-50 cursor-pointer',
})


const moreMenuItems = computed(() => [
  {
    label: 'Add Sub-venue',
    icon: 'pi pi-sitemap',
    command: () => navigateTo(`/bookables/new?parentId=${venue.value?.id}&parentName=${encodeURIComponent(venue.value?.name ?? '')}`)
  },
  { separator: true },
  {
    label: 'Archive',
    icon: 'pi pi-trash',
    class: 'text-red-500',
    command: async () => {
      if (!confirm(`Archive "${venue.value?.name}"?`)) return
      await db.from('bookables').update({ status: 'ARCHIVED' }).eq('id', id)
      toast.add({ severity: 'success', summary: 'Archived', life: 3000 })
      navigateTo('/bookables')
    }
  },
])

function statusSeverity(s: string) {
  return { ACTIVE: 'success', DRAFT: 'secondary', ARCHIVED: 'warn', DELETED: 'danger' }[s] ?? 'secondary'
}
function bookingStatusSeverity(s: string) {
  return { CONFIRMED: 'success', PENDING: 'warn', CANCELLED: 'danger' }[s] ?? 'secondary'
}

function formatDT(d: string) {
  return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function onScheduleSaved() {
  if (venue.value?.is_master) {
    const targets = linkedItems.value.filter(l => !(l.customized_sections ?? []).includes('schedule')).map(l => l.id)
    if (targets.length) {
      await propagateSection('schedule', targets)
      toast.add({ severity: 'info', summary: `Schedule synced to ${targets.length} linked venue${targets.length !== 1 ? 's' : ''}`, life: 2500 })
    }
  }
}

async function onSaved(saved: any) {
  venue.value = saved
  toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
  if (saved.default_booking_view && saved.default_booking_view !== activeCalView.value) {
    setCalView(saved.default_booking_view)
  }
  if (saved.is_master && activeTab.value === 'layouts') {
    const targets = linkedItems.value.filter(l => !(l.customized_sections ?? []).includes('layouts')).map(l => l.id)
    if (targets.length) {
      await propagateSection('layouts', targets)
      toast.add({ severity: 'info', summary: `Layouts synced to ${targets.length} linked venue${targets.length !== 1 ? 's' : ''}`, life: 2500 })
    }
  }
}

async function onDelete() {
  if (!confirm(`Delete "${venue.value?.name}"? This cannot be undone.`)) return
  await db.from('bookables').update({ status: 'DELETED' }).eq('id', id)
  toast.add({ severity: 'success', summary: 'Deleted', life: 2000 })
  navigateTo('/bookables')
}

async function loadVenue() {
  loading.value = true
  const [{ data }, { data: all }] = await Promise.all([
    db.from('bookables').select('*').eq('id', id).maybeSingle(),
    db.from('bookables').select('id, name, type').eq('org_id', orgId.value).neq('status', 'DELETED').order('name'),
  ])
  venue.value = data
  allBookables.value = all ?? []
  if (data?.parent_id) {
    const { data: parent } = await db.from('bookables').select('id, name').eq('id', data.parent_id).maybeSingle()
    parentVenue.value = parent
  } else {
    parentVenue.value = null
  }
  if (data?.default_booking_view) {
    calOptions.value.initialView = data.default_booking_view
    activeCalView.value = data.default_booking_view
    if (data.default_booking_view !== 'scheduler') {
      nextTick(() => calRef.value?.getApi()?.changeView(data.default_booking_view))
    }
  }
  // Set breadcrumbs in global header
  const crumbs: { label: string; to?: string }[] = [{ label: 'Bookables', to: '/bookables' }]
  if (parentVenue.value) crumbs.push({ label: parentVenue.value.name, to: `/bookables/${parentVenue.value.id}` })
  crumbs.push({ label: data?.name ?? 'Venue' })
  breadcrumbs.value = crumbs
  loading.value = false
}

async function loadLinked() {
  const { data } = await db.from('bookables').select('*').eq('master_id', id).neq('status', 'DELETED').order('name')
  linkedItems.value = data ?? []
}

async function syncToLinked() {
  if (!linkedItems.value.length || !venue.value) return
  syncing.value = true
  const master = venue.value
  // Copy bookable fields
  await db.from('bookables').update({
    description: master.description,
    rules: master.rules,
    features: master.features,
    sports: master.sports,
    max_concurrent: master.max_concurrent,
  }).in('id', linkedItems.value.map(l => l.id))
  const { data: masterLayouts } = await (db.from as any)('bookable_layouts').select('*').eq('bookable_id', id)
  for (const linked of linkedItems.value) {
    const lid = linked.id
    await (db.from as any)('bookable_layouts').delete().eq('bookable_id', lid)
    if (masterLayouts?.length) {
      await (db.from as any)('bookable_layouts')
        .insert(masterLayouts.map(({ id: _, bookable_id: __, created_at: ___, ...rest }: any) => ({ ...rest, bookable_id: lid })))
    }
  }
  syncing.value = false
  toast.add({ severity: 'success', summary: `Synced to ${linkedItems.value.length} linked item(s)`, life: 3000 })
}

async function syncFromMaster() {
  if (!venue.value?.master_id) return
  syncing.value = true
  const masterId = venue.value.master_id
  const { data: master } = await db.from('bookables').select('*').eq('id', masterId).single()
  if (master) {
    await db.from('bookables').update({
      description: master.description,
      rules: master.rules,
      features: master.features,
      sports: master.sports,
      max_concurrent: master.max_concurrent,
    }).eq('id', id)
    const { data: masterLayouts } = await (db.from as any)('bookable_layouts').select('*').eq('bookable_id', masterId)
    await (db.from as any)('bookable_layouts').delete().eq('bookable_id', id)
    if (masterLayouts?.length) {
      await (db.from as any)('bookable_layouts')
        .insert(masterLayouts.map(({ id: _, bookable_id: __, created_at: ___, ...rest }: any) => ({ ...rest, bookable_id: id })))
    }
    await loadVenue()
    await afterPricingMutation()
  }
  syncing.value = false
  toast.add({ severity: 'success', summary: 'Synced from master', life: 3000 })
}

async function loadChildren() {
  const { data } = await db.from('bookables').select('*').eq('parent_id', id).eq('type', 'VENUE').neq('status', 'DELETED').order('name')
  children.value = data ?? []
}

async function duplicateVenue(child: any) {
  const { id: _, created_at: __, ...rest } = child
  const { data } = await db.from('bookables').insert({ ...rest, name: `${child.name} (copy)` }).select('id').single()
  if (data?.id) {
    await loadChildren()
    toast.add({ severity: 'success', summary: 'Duplicated', detail: `"${child.name} (copy)" created`, life: 2500 })
  }
}

async function loadItems() {
  const { data } = await db.from('bookables').select('*').eq('parent_id', id).eq('type', 'ITEM').neq('status', 'DELETED').order('sort_order').order('name')
  items.value = data ?? []
}

async function loadBookings() {
  bookingsLoading.value = true
  const { data } = await db.from('bookings')
    .select('*, event:events(id, title)')
    .eq('bookable_id', id)
    .order('start_at')
    .limit(500)
  bookings.value = data ?? []

  const statusColors: Record<string, string> = {
    CONFIRMED: '#1E2157',
    PENDING:   '#F59E0B',
    CANCELLED: '#9CA3AF',
  }
  calOptions.value.events = (data ?? []).map(b => ({
    id: b.id,
    title: b.notes || b.event?.title || 'Booking',
    start: b.start_at,
    end: b.end_at,
    backgroundColor: statusColors[b.status] ?? '#1E2157',
    borderColor: statusColors[b.status] ?? '#1E2157',
    extendedProps: { booking: b },
  }))

  bookingsLoading.value = false
}

watch(activeTab, tab => {
  if (tab === 'bookings') {
    loadBookings()
    if (activeCalView.value !== 'scheduler') {
      nextTick(() => calRef.value?.getApi()?.changeView(activeCalView.value))
    }
  }
  if (tab === 'items') loadItems()
})

onMounted(async () => {
  await loadVenue()
  await loadChildren()
  loadItems()
  loadLinked()
  loadBookings()
})

onUnmounted(() => { breadcrumbs.value = [] })
</script>
