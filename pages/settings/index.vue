<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-surface-900">Settings</h1>
      <p class="text-sm text-surface-500 mt-0.5">Organisation configuration and preferences.</p>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <!-- Org settings -->
      <div class="col-span-2 space-y-4">
        <div class="card p-5">
          <h2 class="text-sm font-semibold text-surface-700 mb-4">Organisation</h2>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium">Organisation Name</label>
              <InputText v-model="org.name" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Currency</label>
                <Select v-model="org.currency" :options="['AUD', 'NZD', 'USD', 'GBP', 'EUR']" class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Locale</label>
                <Select v-model="org.locale" :options="['en-AU', 'en-NZ', 'en-US', 'en-GB']" class="w-full" />
              </div>
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <Button label="Save Organisation" :loading="savingOrg" @click="saveOrg" size="small" />
          </div>
        </div>

        <div class="card p-5">
          <h2 class="text-sm font-semibold text-surface-700 mb-4">Event Defaults</h2>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Default to phased registration</p>
                <p class="text-xs text-surface-500">New events start with member-only window enabled</p>
              </div>
              <ToggleSwitch v-model="defaults.phased_registration" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Default hold-spot flow</p>
                <p class="text-xs text-surface-500">Enable 24h parent confirmation for all new events</p>
              </div>
              <ToggleSwitch v-model="defaults.hold_spot_enabled" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Show attendee list to members</p>
                <p class="text-xs text-surface-500">Members can see who else is attending</p>
              </div>
              <ToggleSwitch v-model="defaults.show_attendee_list" />
            </div>
            <div class="flex flex-col gap-1.5 pt-1">
              <label class="text-sm font-medium">Default member window (days)</label>
              <InputNumber v-model="defaults.member_window_days" :min="0" class="w-32" />
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <Button label="Save Defaults" size="small" @click="toast.add({ severity: 'success', summary: 'Defaults saved', life: 3000 })" />
          </div>
        </div>
      </div>

      <!-- Right panel -->
      <div class="space-y-4">
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-surface-700">Categories</h3>
            <Button label="Manage" icon="pi pi-arrow-right" icon-pos="right" text size="small" @click="navigateTo('/settings/calendars')" />
          </div>
          <div class="space-y-1">
            <div v-for="cat in categories" :key="cat.id"
              class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-50">
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: cat.color || '#94a3b8' }" />
              <span class="text-sm flex-1 truncate">{{ cat.name }}</span>
            </div>
            <p v-if="!categories.length" class="text-sm text-surface-400 py-2">No categories yet.</p>
          </div>
        </div>

        <div class="card p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-surface-700">Calendars</h3>
            <Button label="Manage" icon="pi pi-arrow-right" icon-pos="right" text size="small" @click="navigateTo('/settings/calendars')" />
          </div>
          <p class="text-sm text-surface-500">Named groupings of categories for calendar filtering.</p>
        </div>

        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-surface-700">Venues</h3>
            <Button label="Manage" icon="pi pi-arrow-right" icon-pos="right" text size="small" @click="navigateTo('/settings/venues')" />
          </div>
          <p class="text-sm text-surface-500">Manage bookable venues, fields, and spaces.</p>
        </div>

        <div class="card p-4">
          <h3 class="text-sm font-semibold text-surface-700 mb-3">Members (Persons)</h3>
          <p class="text-sm text-surface-500 mb-3">{{ personCount }} members in this organisation.</p>
          <Button label="Add Member" icon="pi pi-user-plus" size="small" severity="secondary" @click="showAddPerson = true" class="w-full" />
        </div>

        <div class="card p-4">
          <h3 class="text-sm font-semibold text-surface-700 mb-3">Member Groups</h3>
          <div v-if="groupsLoading" class="py-4 flex justify-center">
            <i class="pi pi-spin pi-spinner text-gray-300" />
          </div>
          <div v-else-if="!topLevelGroups.length" class="text-sm text-surface-400 py-1">No groups yet.</div>
          <div v-else class="space-y-1">
            <div v-for="group in topLevelGroups" :key="group.id">
              <!-- Top-level group -->
              <div class="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-surface-50 cursor-pointer"
                @click="groupChildren(group.id).length && toggleExpand(group.id)">
                <button class="w-4 h-4 flex items-center justify-center shrink-0">
                  <i v-if="groupChildren(group.id).length"
                    :class="`pi text-[10px] text-gray-400 ${expandedGroupIds[group.id] ? 'pi-chevron-down' : 'pi-chevron-right'}`" />
                </button>
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: group.color ?? '#94a3b8' }" />
                <span class="text-sm font-semibold text-gray-800 flex-1 truncate">{{ group.name }}</span>
                <span class="text-xs text-gray-400">{{ groupMemberCount(group.id) }}</span>
              </div>
              <!-- Children -->
              <template v-if="expandedGroupIds[group.id]">
                <div v-for="child in groupChildren(group.id)" :key="child.id"
                  class="flex items-center gap-2 py-1.5 pl-7 pr-1 rounded hover:bg-surface-50">
                  <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: child.color ?? '#94a3b8' }" />
                  <span class="text-sm text-gray-700 flex-1 truncate">{{ child.name }}</span>
                  <span class="text-xs text-gray-400">{{ groupMemberCount(child.id) }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Demo Data -->
    <div class="mt-6 rounded-xl border border-gray-200 bg-white p-5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-gray-700">Demo Events</h2>
          <p class="text-xs text-gray-500 mt-0.5">Seed 11 realistic sample events spread across the next month — training weeks, comps, meetings, a ticketed show, and more.</p>
        </div>
        <Button label="Seed Demo Events" icon="pi pi-magic-wand" size="small" severity="secondary" outlined
          :loading="seedingEvents" class="ml-6 shrink-0" @click="seedDemoEvents" />
      </div>
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-gray-700">Demo Bookings</h2>
          <p class="text-xs text-gray-500 mt-0.5">Seed realistic venue bookings across courts, pool lanes, cricket nets and more. Requires demo events to be seeded first.</p>
        </div>
        <Button label="Seed Demo Bookings" icon="pi pi-calendar-plus" size="small" severity="secondary" outlined
          :loading="seedingBookings" class="ml-6 shrink-0" @click="seedDemoBookings" />
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="mt-6 rounded-xl border border-red-200 bg-white p-5 space-y-4">
      <h2 class="text-sm font-semibold text-red-600">Danger Zone</h2>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-700">Reset database</p>
          <p class="text-xs text-gray-500">Deletes all events, venues, bookings, registrations, fees, discounts, forms, and related data. People and member groups are preserved.</p>
        </div>
        <Button
          label="Reset Database"
          severity="danger"
          size="small"
          :loading="resetting"
          class="ml-6 shrink-0"
          @click="resetDatabase" />
      </div>
    </div>

    <!-- Add Person Dialog -->
    <Dialog v-model:visible="showAddPerson" header="Add Member" modal style="width: 400px">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">First Name</label>
            <InputText v-model="personForm.first_name" autofocus />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Last Name</label>
            <InputText v-model="personForm.last_name" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Email</label>
          <InputText v-model="personForm.email" type="email" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Phone</label>
          <InputText v-model="personForm.phone" type="tel" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddPerson = false" />
        <Button label="Add" :loading="addingPerson" :disabled="!personForm.first_name || !personForm.last_name" @click="handleAddPerson" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const org = ref({ name: 'Demo Club', currency: 'AUD', locale: 'en-AU' })
const defaults = ref({ phased_registration: false, hold_spot_enabled: false, show_attendee_list: false, member_window_days: 40 })
const savingOrg = ref(false)
const categories = ref<any[]>([])
const personCount = ref(0)

const memberGroups = ref<any[]>([])
const membershipCounts = ref<Record<string, number>>({})
const groupsLoading = ref(true)
const expandedGroupIds = reactive<Record<string, boolean>>({})

const topLevelGroups = computed(() => memberGroups.value.filter(g => !g.parent_id))
function groupChildren(parentId: string) { return memberGroups.value.filter(g => g.parent_id === parentId) }
function groupMemberCount(groupId: string) {
  const count = membershipCounts.value[groupId] ?? 0
  return count ? `${count}` : ''
}
function toggleExpand(id: string) { expandedGroupIds[id] = !expandedGroupIds[id] }

const showAddPerson = ref(false)
const addingPerson = ref(false)
const personForm = ref({ first_name: '', last_name: '', email: '', phone: '' })

async function load() {
  const [{ data: orgData }, { data: catData }, { count }, { data: groupData }, { data: memberships }] = await Promise.all([
    db.from('organisations').select('*').eq('id', orgId.value).single(),
    db.from('categories').select('*').eq('org_id', orgId.value).order('name'),
    db.from('persons').select('*', { count: 'exact', head: true }).eq('org_id', orgId.value),
    db.from('member_groups').select('id, name, color, parent_id, sort_order').eq('org_id', orgId.value).order('sort_order'),
    db.from('member_group_memberships').select('group_id'),
  ])
  if (orgData) org.value = { name: orgData.name, currency: orgData.currency, locale: orgData.locale }
  categories.value = catData ?? []
  personCount.value = count ?? 0
  memberGroups.value = groupData ?? []
  const counts: Record<string, number> = {}
  for (const m of memberships ?? []) counts[m.group_id] = (counts[m.group_id] ?? 0) + 1
  membershipCounts.value = counts
  groupsLoading.value = false
}

async function saveOrg() {
  savingOrg.value = true
  await db.from('organisations').update({ name: org.value.name, currency: org.value.currency, locale: org.value.locale }).eq('id', orgId.value)
  toast.add({ severity: 'success', summary: 'Organisation saved', life: 3000 })
  savingOrg.value = false
}


async function handleAddPerson() {
  addingPerson.value = true
  const { error } = await db.from('persons').insert({
    org_id: orgId.value,
    first_name: personForm.value.first_name,
    last_name: personForm.value.last_name,
    email: personForm.value.email || null,
    phone: personForm.value.phone || null,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Member added', life: 3000 })
    showAddPerson.value = false
    personForm.value = { first_name: '', last_name: '', email: '', phone: '' }
    load()
  }
  addingPerson.value = false
}

const seedingEvents = ref(false)

async function seedDemoEvents() {
  seedingEvents.value = true

  function d(offsetDays: number, hour = 9, minute = 0) {
    const dt = new Date()
    dt.setDate(dt.getDate() + offsetDays)
    dt.setHours(hour, minute, 0, 0)
    return dt.toISOString()
  }

  try {
    // ── Categories ──────────────────────────────────────────────
    const categoryDefs = [
      { name: 'Training',      color: '#3B82F6', icon: 'pi-bolt' },
      { name: 'Competition',   color: '#EF4444', icon: 'pi-trophy' },
      { name: 'Social',        color: '#8B5CF6', icon: 'pi-star' },
      { name: 'Administration',color: '#6B7280', icon: 'pi-briefcase' },
      { name: 'Community',     color: '#10B981', icon: 'pi-users' },
      { name: 'Development',   color: '#F59E0B', icon: 'pi-graduation-cap' },
    ]
    const { data: insertedCats } = await db.from('categories')
      .insert(categoryDefs.map((c, i) => ({ ...c, org_id: orgId.value, sort_order: i })))
      .select('id, name')
    const cat = Object.fromEntries((insertedCats ?? []).map((c: any) => [c.name, c.id]))

    // ── Bookables (created first so events can reference them) ──
    // 2 staff coaches — upsert on email to avoid duplicates on re-seed
    const { data: coachPersons, error: coachPersonsError } = await db.from('persons').upsert([
      { org_id: orgId.value, first_name: 'James', last_name: 'Carter', email: 'james.carter@sportclub.com' },
      { org_id: orgId.value, first_name: 'Sarah', last_name: 'Mitchell', email: 'sarah.mitchell@sportclub.com' },
    ], { onConflict: 'email' }).select('id, first_name, last_name')
    if (coachPersonsError) console.warn('Coach persons insert failed:', coachPersonsError.message)

    // Top-level venue
    const { data: clubRooms } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Club Rooms', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: 'Function space for meetings, presentations, and social events.', sort_order: 0, allow_multiple_layouts: false,
    }).select('id').single()
    const clubRoomsId = clubRooms?.id as string | undefined

    // Sub-venues of Club Rooms (each with their own sub-locations)
    const { data: footballFields } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Football Fields', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: 'Two full-size football fields for training and match play.',
      parent_id: clubRoomsId, sort_order: 1, allow_multiple_layouts: false,
    }).select('id').single()
    if (footballFields?.id) {
      await db.from('bookables').insert([
        { org_id: orgId.value, name: 'Field 1', type: 'VENUE', status: 'ACTIVE', is_public: true, parent_id: footballFields.id, sort_order: 0, allow_multiple_layouts: false },
        { org_id: orgId.value, name: 'Field 2', type: 'VENUE', status: 'ACTIVE', is_public: true, parent_id: footballFields.id, sort_order: 1, allow_multiple_layouts: false },
      ])
    }

    const { data: swimmingPool } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Swimming Pool', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: '25m heated pool with 6 lanes. Available for squad sessions and public swim.',
      parent_id: clubRoomsId, sort_order: 2, allow_multiple_layouts: false,
    }).select('id').single()
    if (swimmingPool?.id) {
      const { data: compPool } = await db.from('bookables').insert(
        { org_id: orgId.value, name: 'Competition Pool', type: 'VENUE', status: 'ACTIVE', is_public: true, parent_id: swimmingPool.id, sort_order: 0, default_booking_view: 'scheduler', show_in_menu: true, allow_multiple_layouts: false }
      ).select('id').single()
      if (compPool?.id) {
        const { data: lane1 } = await db.from('bookables').insert({
          org_id: orgId.value, name: 'Lane 1', type: 'VENUE', status: 'ACTIVE',
          is_public: true, is_master: true, parent_id: compPool.id, sort_order: 0, allow_multiple_layouts: false,
        }).select('id').single()
        if (lane1?.id) {
          await db.from('bookables').insert(
            [2, 3, 4].map((n, i) => ({
              org_id: orgId.value, name: `Lane ${n}`, type: 'VENUE', status: 'ACTIVE',
              is_public: true, master_id: lane1.id, parent_id: compPool.id, sort_order: i + 1, allow_multiple_layouts: false,
            }))
          )
        }
      }
      await db.from('bookables').insert(
        { org_id: orgId.value, name: 'Learn-to-Swim Area', type: 'VENUE', status: 'ACTIVE', is_public: true, parent_id: swimmingPool.id, sort_order: 1, allow_multiple_layouts: false }
      )
    }

    const { data: tennisCourts } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Tennis Courts', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: '4 hard-court tennis courts with floodlighting.',
      parent_id: clubRoomsId, sort_order: 3, default_booking_view: 'scheduler', show_in_menu: true, allow_multiple_layouts: false,
    }).select('id').single()
    if (tennisCourts?.id) {
      // Court 1 is master; Courts 2–4 are linked to it
      const { data: court1 } = await db.from('bookables').insert({
        org_id: orgId.value, name: 'Court 1', type: 'VENUE', status: 'ACTIVE',
        is_public: true, is_master: true, parent_id: tennisCourts.id, sort_order: 0, allow_multiple_layouts: false,
      }).select('id').single()
      if (court1?.id) {
        await db.from('bookables').insert(
          [2, 3, 4].map((n, i) => ({
            org_id: orgId.value, name: `Court ${n}`, type: 'VENUE', status: 'ACTIVE',
            is_public: true, master_id: court1.id, parent_id: tennisCourts.id, sort_order: i + 1, allow_multiple_layouts: false,
          }))
        )
      }
    }

    const { data: cricketNets } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Cricket Nets', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: '4 practice nets for batting and bowling drills.',
      sort_order: 5, default_booking_view: 'scheduler', show_in_menu: true, allow_multiple_layouts: false,
    }).select('id').single()
    if (cricketNets?.id) {
      const { data: net1 } = await db.from('bookables').insert({
        org_id: orgId.value, name: 'Net 1', type: 'VENUE', status: 'ACTIVE',
        is_public: true, is_master: true, parent_id: cricketNets.id, sort_order: 0, allow_multiple_layouts: false,
      }).select('id').single()
      if (net1?.id) {
        await db.from('bookables').insert(
          [2, 3, 4].map((n, i) => ({
            org_id: orgId.value, name: `Net ${n}`, type: 'VENUE', status: 'ACTIVE',
            is_public: true, master_id: net1.id, parent_id: cricketNets.id, sort_order: i + 1, allow_multiple_layouts: false,
          }))
        )
      }
    }

    const { data: lockerRoom } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Locker Room', type: 'VENUE', status: 'ACTIVE',
      is_public: false, description: 'Members-only locker room.',
      parent_id: clubRoomsId, sort_order: 6,
    }).select('id').single()
    if (lockerRoom?.id) {
      // Locker 1 is master; Lockers 2–10 are linked to it
      const { data: locker1 } = await db.from('bookables').insert({
        org_id: orgId.value, name: 'Locker 1', type: 'ITEM', status: 'ACTIVE',
        is_public: false, is_master: true, item_category: 'Lockers',
        description: 'Locker 1. Combination lock provided.',
        parent_id: lockerRoom.id, max_concurrent: 1, sort_order: 0,
      }).select('id').single()
      if (locker1?.id) {
        await db.from('bookables').insert(
          Array.from({ length: 9 }, (_, i) => ({
            org_id: orgId.value, name: `Locker ${i + 2}`, type: 'ITEM', status: 'ACTIVE',
            is_public: false, master_id: locker1.id, item_category: 'Lockers',
            description: `Locker ${i + 2}. Combination lock provided.`,
            parent_id: lockerRoom.id, max_concurrent: 1, sort_order: i + 1,
          }))
        )
      }
    }

    // Rentable items
    const { error: itemsError } = await db.from('bookables').insert([
      { org_id: orgId.value, name: 'Marquee', type: 'ITEM', status: 'ACTIVE', is_public: true, item_category: 'Equipment', description: '6m × 12m marquee for outdoor events. Advance booking required.', sort_order: 10 },
      { org_id: orgId.value, name: 'Lawn Mower', type: 'ITEM', status: 'ACTIVE', is_public: false, item_category: 'Grounds', description: 'Club ride-on mower. Authorised staff only.', sort_order: 11 },
      { org_id: orgId.value, name: 'PA System', type: 'ITEM', status: 'ACTIVE', is_public: true, item_category: 'Equipment', description: 'Portable PA system with 2 speakers and microphone.', sort_order: 12 },
      { org_id: orgId.value, name: 'Projector & Screen', type: 'ITEM', status: 'ACTIVE', is_public: true, item_category: 'Equipment', description: 'HD projector with 2m pull-down screen.', sort_order: 13 },
      { org_id: orgId.value, name: 'Fold-out Tables (x10)', type: 'ITEM', status: 'ACTIVE', is_public: true, item_category: 'Furniture', description: 'Pack of 10 rectangular fold-out tables.', sort_order: 14 },
      { org_id: orgId.value, name: 'Chairs (x50)', type: 'ITEM', status: 'ACTIVE', is_public: true, item_category: 'Furniture', description: 'Stack of 50 plastic chairs.', sort_order: 15 },
    ])
    if (itemsError) throw new Error(`Rentable items insert failed: ${itemsError.message}`)

    // Staff coaches as PERSON bookables
    const coachNames = coachPersons?.length
      ? coachPersons.map((p: any) => `${p.first_name} ${p.last_name}`)
      : ['James Carter', 'Sarah Mitchell']
    await db.from('bookables').insert(
      coachNames.map((name: string, i: number) => ({
        org_id: orgId.value, name,
        type: 'PERSON', status: 'ACTIVE', is_public: false,
        description: 'Club coach', sort_order: i,
      }))
    )

    // ── Registration forms ──────────────────────────────────────
    const { data: holForm } = await db.from('registration_forms')
      .insert({
        org_id: orgId.value,
        name: 'Holiday Programme Registration',
        config: {
          groups: [{ id: 'member-general', name: 'Member Registration', person_type: 'member' }, { id: 'public-general', name: 'Public Registration', person_type: 'public' }],
          modes: { 'member-general': 'scratch', 'public-general': 'scratch' },
          designs: {
            'member-general': { style: 'single', header: 'event', headerImage: '', icons: { date: true, time: true, cost: true, location: true, criteria: true }, description: 'event', customDescription: '', background: 'default', backgroundImage: '', backgroundColor: '#fefefe', backgroundOverlay: 1, sponsors: 'show', showSessions: true, sessionsHeading: 'Sessions', sessionsLayout: 'date-table', sessionsGroupLabel: '', formHeading: 'Fill in the form to register', addPersonColor: '#0e43a3' },
            'public-general': { style: 'single', header: 'event', headerImage: '', icons: { date: true, time: true, cost: true, location: true, criteria: true }, description: 'event', customDescription: '', background: 'default', backgroundImage: '', backgroundColor: '#fefefe', backgroundOverlay: 1, sponsors: 'show', showSessions: true, sessionsHeading: 'Sessions', sessionsLayout: 'date-table', sessionsGroupLabel: '', formHeading: 'Fill in the form to register', addPersonColor: '#0e43a3' },
          },
          sessions: {},
          sectionSaved: { 'member-general': { design: true, fields: true, terms: true, payment: true, sessions: true }, 'public-general': { design: true, fields: true, terms: true, payment: true, sessions: true } },
          payment: { invoice: { enabled: true, bank_account: '' }, plan: { enabled: false, frequencies: [], due_date: '', first_amount: 'scheduled', schedule_min: 'scheduled', schedule_min_value: '' }, credit_card: { enabled: false }, coupon: { enabled: false, quantity: 2 } },
          terms: ['NZ Sport Terms'],
          discountSettings: { one_discount_only: false },
          groupFields: {
            'member-general': [
              { id: 'f1', label: "Child's Full Name", field_type: 'text', is_required: true, placeholder: 'First and last name', col_span: 2, visibility_conditions: [], financial_rules: [] },
              { id: 'f2', label: 'Age', field_type: 'number', is_required: true, placeholder: 'e.g. 8', col_span: 1, visibility_conditions: [], financial_rules: [] },
              { id: 'f3', label: 'T-Shirt Size', field_type: 'select', is_required: true, placeholder: '', options: ['6 (XS)', '8 (S)', '10 (M)', '12 (L)', '14 (XL)'], col_span: 1, visibility_conditions: [], financial_rules: [] },
              { id: 'f4', label: 'Emergency Contact Name', field_type: 'text', is_required: true, placeholder: '', col_span: 1, visibility_conditions: [], financial_rules: [] },
              { id: 'f5', label: 'Emergency Contact Phone', field_type: 'text', is_required: true, placeholder: '', col_span: 1, visibility_conditions: [], financial_rules: [] },
              { id: 'f6', label: 'Medical Conditions or Allergies', field_type: 'textarea', is_required: false, placeholder: 'Leave blank if none', col_span: 2, visibility_conditions: [], financial_rules: [] },
              { id: 'f7', label: 'Permission to apply sunscreen', field_type: 'checkbox', is_required: false, placeholder: '', col_span: 2, visibility_conditions: [], financial_rules: [] },
            ],
          },
        },
      })
      .select('id').single()
    if (holForm?.id) {
      await db.from('form_fields').insert([
        { form_id: holForm.id, field_type: 'SECTION_HEADER', label: 'Participant Details', sort_order: 0, page_number: 1, is_required: false },
        { form_id: holForm.id, field_type: 'SHORT_TEXT', label: "Child's Full Name", placeholder: 'First and last name', is_required: true, sort_order: 1, page_number: 1 },
        { form_id: holForm.id, field_type: 'NUMBER', label: 'Age', placeholder: 'e.g. 8', is_required: true, sort_order: 2, page_number: 1 },
        { form_id: holForm.id, field_type: 'SINGLE_SELECT', label: 'T-Shirt Size', is_required: true, sort_order: 3, page_number: 1, options: JSON.stringify(['6 (XS)','8 (S)','10 (M)','12 (L)','14 (XL)']) },
        { form_id: holForm.id, field_type: 'SECTION_HEADER', label: 'Emergency Contact', sort_order: 4, page_number: 1, is_required: false },
        { form_id: holForm.id, field_type: 'SHORT_TEXT', label: 'Emergency Contact Name', is_required: true, sort_order: 5, page_number: 1 },
        { form_id: holForm.id, field_type: 'SHORT_TEXT', label: 'Emergency Contact Phone', is_required: true, sort_order: 6, page_number: 1 },
        { form_id: holForm.id, field_type: 'SECTION_HEADER', label: 'Health & Medical', sort_order: 7, page_number: 1, is_required: false },
        { form_id: holForm.id, field_type: 'LONG_TEXT', label: 'Medical Conditions or Allergies', placeholder: 'Leave blank if none', is_required: false, sort_order: 8, page_number: 1 },
        { form_id: holForm.id, field_type: 'TOGGLE', label: 'Permission to apply sunscreen', is_required: false, sort_order: 9, page_number: 1 },
      ])
    }

    const { data: trainingForm } = await db.from('registration_forms')
      .insert({ org_id: orgId.value, name: 'Training Week Registration' })
      .select('id').single()
    if (trainingForm?.id) {
      await db.from('form_fields').insert([
        { form_id: trainingForm.id, field_type: 'SECTION_HEADER', label: 'Emergency Contact', sort_order: 0, page_number: 1, is_required: false },
        { form_id: trainingForm.id, field_type: 'SHORT_TEXT', label: 'Emergency Contact Name', is_required: true, sort_order: 1, page_number: 1 },
        { form_id: trainingForm.id, field_type: 'SHORT_TEXT', label: 'Emergency Contact Phone', is_required: true, sort_order: 2, page_number: 1 },
        { form_id: trainingForm.id, field_type: 'LONG_TEXT', label: 'Medical Conditions or Injuries', placeholder: 'Leave blank if none', is_required: false, sort_order: 3, page_number: 1 },
      ])
    }

    const { data: leaderForm } = await db.from('registration_forms')
      .insert({ org_id: orgId.value, name: 'Leadership Training Registration' })
      .select('id').single()
    if (leaderForm?.id) {
      await db.from('form_fields').insert([
        { form_id: leaderForm.id, field_type: 'SHORT_TEXT', label: 'Emergency Contact Name', is_required: true, sort_order: 0, page_number: 1 },
        { form_id: leaderForm.id, field_type: 'SHORT_TEXT', label: 'Emergency Contact Phone', is_required: true, sort_order: 1, page_number: 1 },
        { form_id: leaderForm.id, field_type: 'SINGLE_SELECT', label: 'Dietary Requirements', is_required: false, sort_order: 2, page_number: 1, options: JSON.stringify(['None','Vegetarian','Vegan','Gluten Free','Halal','Other']) },
        { form_id: leaderForm.id, field_type: 'LONG_TEXT', label: 'What do you hope to get from this course?', is_required: false, sort_order: 3, page_number: 1 },
      ])
    }

    const base = {
      org_id: orgId.value,
      status: 'PUBLISHED',
      is_public: true,
    }

    // ── All persons (for invitees) ──────────────────────────────
    const { data: allMemberships } = await db
      .from('member_group_memberships')
      .select('person_id, member_groups!inner(org_id)')
      .eq('member_groups.org_id', orgId.value)
    const allPersonIds = [...new Set((allMemberships ?? []).map((m: any) => m.person_id))]

    async function inviteAll(eventId: string, personIds: string[], status = 'INVITED') {
      const chunk = 500
      const allInvitees: any[] = []
      for (let i = 0; i < personIds.length; i += chunk) {
        const { data } = await db.from('invitees').insert(
          personIds.slice(i, i + chunk).map((pid: string) => ({ event_id: eventId, person_id: pid, status }))
        ).select('id')
        if (data) allInvitees.push(...data)
      }
      return allInvitees
    }

    async function fakeAttendance(invitees: { id: string }[], sessionId: string | null, attendAt: string, rate = 0.72) {
      const attending = invitees.filter(() => Math.random() < rate)
      if (!attending.length) return
      await db.from('attendance').insert(
        attending.map((inv: any) => ({ invitee_id: inv.id, session_id: sessionId, is_present: true, checked_in_at: attendAt }))
      )
    }

    // 1. Committee Meeting — monthly repeating (3 instances: 2 past, 1 upcoming)
    // Two past meetings provide historical attendance data for reporting
    const committeeDates = [-57, -27, 3]
    const committeeIds: string[] = []
    for (const offset of committeeDates) {
      const { data: cm } = await db.from('events').insert({
        ...base, style: 'BASIC', category_id: cat['Administration'],
        title: 'Committee Meeting',
        description: 'Monthly committee meeting to review upcoming events and discuss club operations.',
        start_at: d(offset, 18, 0), end_at: d(offset, 20, 0),
        location_type: 'BOOKABLE', bookable_id: clubRoomsId,
      }).select('id').single()
      if (cm?.id) committeeIds.push(cm.id)
    }

    // Create 10 dedicated committee members
    const { data: committeePersons } = await db.from('persons').upsert([
      { org_id: orgId.value, first_name: 'Margaret', last_name: 'Holloway', email: 'margaret.holloway@sportclub.com' },
      { org_id: orgId.value, first_name: 'David',    last_name: 'Tran',     email: 'david.tran@sportclub.com' },
      { org_id: orgId.value, first_name: 'Priya',    last_name: 'Sharma',   email: 'priya.sharma@sportclub.com' },
      { org_id: orgId.value, first_name: 'Lachlan',  last_name: 'Reid',     email: 'lachlan.reid@sportclub.com' },
      { org_id: orgId.value, first_name: 'Fiona',    last_name: 'Nguyen',   email: 'fiona.nguyen@sportclub.com' },
      { org_id: orgId.value, first_name: 'Craig',    last_name: 'Watkins',  email: 'craig.watkins@sportclub.com' },
      { org_id: orgId.value, first_name: 'Sandra',   last_name: 'Okafor',   email: 'sandra.okafor@sportclub.com' },
      { org_id: orgId.value, first_name: 'Michael',  last_name: 'Costa',    email: 'michael.costa@sportclub.com' },
      { org_id: orgId.value, first_name: 'Bree',     last_name: 'Lawson',   email: 'bree.lawson@sportclub.com' },
      { org_id: orgId.value, first_name: 'Tom',      last_name: 'Ihejirika', email: 'tom.ihejirika@sportclub.com' },
    ], { onConflict: 'email' }).select('id')

    if (committeePersons?.length && committeeIds.length) {
      // Attendance rates per meeting: realistic variation (past meetings only)
      const attendanceRates = [0.9, 0.8, null] // null = upcoming, no attendance yet
      for (let i = 0; i < committeeIds.length; i++) {
        const { data: cmInvitees } = await db.from('invitees')
          .insert(committeePersons.map((p: any) => ({ event_id: committeeIds[i], person_id: p.id, status: 'CONFIRMED' })))
          .select('id')
        const rate = attendanceRates[i]
        if (cmInvitees?.length && rate !== null) {
          const attending = cmInvitees.filter(() => Math.random() < rate)
          if (attending.length) {
            await db.from('attendance').insert(
              attending.map((inv: any) => ({ invitee_id: inv.id, session_id: null, is_present: true, checked_in_at: d(committeeDates[i], 18, 5) }))
            )
          }
        }
      }
    }

    // 2. Club Night — weekly (4 instances), all members invited
    const clubNightSubGroups = [
      { id: crypto.randomUUID(), name: 'Seniors', color: '#3B82F6', managers: [] },
      { id: crypto.randomUUID(), name: 'Juniors', color: '#10B981', managers: [] },
      { id: crypto.randomUUID(), name: 'Social Members', color: '#8B5CF6', managers: [] },
    ]
    const clubNightOffsets = [5, 12, 19, 26]
    for (const offset of clubNightOffsets) {
      const { data: cn } = await db.from('events').insert({
        ...base, style: 'BASIC', category_id: cat['Social'],
        title: 'Club Night',
        description: 'Regular weekly club night. All members welcome.',
        start_at: d(offset, 18, 30), end_at: d(offset, 21, 30),
        location_type: 'BOOKABLE', bookable_id: clubRoomsId,
        sub_groups: clubNightSubGroups,
      }).select('id').single()
      if (cn?.id && allPersonIds.length) {
        const invs = await inviteAll(cn.id, allPersonIds)
        await fakeAttendance(invs, null, d(offset, 18, 45))
        await db.from('discounts').insert([
          {
            event_id: cn.id, type: 'ROLE',
            name: 'Member Discount',
            form_text: '10% off for active members',
            modifier_type: 'PERCENT', modifier_value: 10,
            is_active: true, apply_to: 'registration_total',
            conditions: [{ key: 'participant_member_status', operator: 'is', value: 'active_member' }],
          },
          {
            event_id: cn.id, type: 'SIBLING',
            name: 'Bring a Friend',
            form_text: '15% off the cheaper ticket when you bring a friend',
            modifier_type: 'PERCENT', modifier_value: 15,
            is_active: true, apply_to: 'cheapest_item',
            conditions: [{ key: 'registration_group_size_min', operator: '>=', value: 2 }],
          },
        ])
      }
    }

    // 3. Trials — 8 days, junior teams, sub-groups A–G
    const juniorGroupIds = [
      '20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000004',
      '20000000-0000-0000-0000-000000000005',
    ]
    const subGroupColors = ['#3B82F6','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444','#F97316']
    const trialsSubGroups = ['A','B','C','D','E','F','G'].map((letter, i) => ({
      id: crypto.randomUUID(), name: `Group ${letter}`, color: subGroupColors[i], managers: [],
    }))
    const { data: trialsEvt } = await db.from('events').insert({
      ...base, style: 'BASIC', category_id: cat['Competition'],
      title: 'Trials',
      description: 'Selection trials for the upcoming season. Bring your best.',
      start_at: d(8, 8, 0), end_at: d(8, 13, 0),
      sub_groups: trialsSubGroups,
      location_type: 'BOOKABLE', bookable_id: footballFields?.id,
    }).select('id').single()
    if (trialsEvt?.id) {
      const { data: jm } = await db.from('member_group_memberships').select('person_id').in('group_id', juniorGroupIds)
      const juniorPersonIds = [...new Set((jm ?? []).map((m: any) => m.person_id))]
      if (juniorPersonIds.length) {
        const invs = await inviteAll(trialsEvt.id, juniorPersonIds)
        await fakeAttendance(invs, null, d(8, 8, 10), 0.85)
      }
    }

    // 4. Training Week — 10–14 days, multi-session
    const trainingWeekSubGroups = [
      { id: crypto.randomUUID(), name: 'Senior Men', color: '#1E2157', managers: [] },
      { id: crypto.randomUUID(), name: 'Senior Women', color: '#EC4899', managers: [] },
      { id: crypto.randomUUID(), name: 'Under 18s', color: '#F59E0B', managers: [] },
      { id: crypto.randomUUID(), name: 'Academy', color: '#10B981', managers: [] },
    ]
    const { data: trainingEvt } = await db.from('events').insert({
      ...base, style: 'ADVANCED', category_id: cat['Training'],
      title: 'Training Week',
      description: 'Intensive training week for all squads. Morning and afternoon sessions daily.',
      start_at: d(10, 9, 0), end_at: d(14, 17, 0),
      form_id: trainingForm?.id,
      location_type: 'BOOKABLE', bookable_id: footballFields?.id,
      sub_groups: trainingWeekSubGroups,
    }).select('id').single()
    if (trainingEvt?.id) {
      const ff = footballFields?.id; const sp = swimmingPool?.id; const cr = clubRoomsId
      const { data: trainSessions } = await db.from('sessions').insert([
        { event_id: trainingEvt.id, title: 'Warm-up & Conditioning', start_at: d(10, 9, 0),  end_at: d(10, 10, 30), is_public: true, display_on_form: true, sort_order: 0,  location_type: 'BOOKABLE', bookable_id: ff },
        { event_id: trainingEvt.id, title: 'Seniors Skills Block',    start_at: d(10, 11, 0), end_at: d(10, 12, 30), is_public: true, display_on_form: true, sort_order: 1,  location_type: 'BOOKABLE', bookable_id: ff, invitee_modes: ['specific_groups'], invitee_groups: ['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'] },
        { event_id: trainingEvt.id, title: 'Juniors Technique',       start_at: d(10, 13, 0), end_at: d(10, 15, 0),  is_public: true, display_on_form: true, sort_order: 2,  location_type: 'BOOKABLE', bookable_id: ff, invitee_modes: ['specific_groups'], invitee_groups: ['20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000005'] },
        { event_id: trainingEvt.id, title: 'Strength & Power',        start_at: d(11, 9, 0),  end_at: d(11, 11, 0),  is_public: true, display_on_form: true, sort_order: 3,  location_type: 'BOOKABLE', bookable_id: ff },
        { event_id: trainingEvt.id, title: 'Tactical Drills – Senior',start_at: d(11, 11, 30),end_at: d(11, 13, 0),  is_public: true, display_on_form: true, sort_order: 4,  location_type: 'BOOKABLE', bookable_id: ff, invitee_modes: ['specific_groups'], invitee_groups: ['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'] },
        { event_id: trainingEvt.id, title: 'Academy Development',     start_at: d(11, 13, 30),end_at: d(11, 16, 0),  is_public: true, display_on_form: true, sort_order: 5,  location_type: 'BOOKABLE', bookable_id: ff, invitee_modes: ['specific_groups'], invitee_groups: ['20000000-0000-0000-0000-000000000010'] },
        { event_id: trainingEvt.id, title: 'Recovery & Mobility',     start_at: d(12, 9, 0),  end_at: d(12, 10, 30), is_public: true, display_on_form: true, sort_order: 6,  location_type: 'BOOKABLE', bookable_id: sp },
        { event_id: trainingEvt.id, title: "Women's Squad Session",   start_at: d(12, 11, 0), end_at: d(12, 13, 0),  is_public: true, display_on_form: true, sort_order: 7,  location_type: 'BOOKABLE', bookable_id: ff, invitee_modes: ['specific_groups'], invitee_groups: ['20000000-0000-0000-0000-000000000006'] },
        { event_id: trainingEvt.id, title: 'Full Squad Scrimmage',    start_at: d(12, 14, 0), end_at: d(12, 17, 0),  is_public: true, display_on_form: true, sort_order: 8,  location_type: 'BOOKABLE', bookable_id: ff },
        { event_id: trainingEvt.id, title: 'Coaches Briefing',        start_at: d(13, 8, 30), end_at: d(13, 9, 30),  is_public: false, display_on_form: false, sort_order: 9,  location_type: 'BOOKABLE', bookable_id: cr, invitee_modes: ['specific_groups'], invitee_groups: ['20000000-0000-0000-0000-000000000008'], eligibility: { restricted: true, conditions: [{ field: 'membership_type', operator: 'in', value: ['coaching_staff'] }] } },
        { event_id: trainingEvt.id, title: 'Sprint & Agility',        start_at: d(13, 10, 0), end_at: d(13, 12, 0),  is_public: true, display_on_form: true, sort_order: 10, location_type: 'BOOKABLE', bookable_id: ff },
        { event_id: trainingEvt.id, title: 'Video Review – Seniors',  start_at: d(13, 13, 0), end_at: d(13, 14, 30), is_public: true, display_on_form: true, sort_order: 11, location_type: 'BOOKABLE', bookable_id: cr, invitee_modes: ['specific_groups'], invitee_groups: ['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'] },
        { event_id: trainingEvt.id, title: 'Game Simulation',         start_at: d(14, 9, 0),  end_at: d(14, 12, 0),  is_public: true, display_on_form: true, sort_order: 12, location_type: 'BOOKABLE', bookable_id: ff },
        { event_id: trainingEvt.id, title: 'End of Week Debrief',     start_at: d(14, 13, 0), end_at: d(14, 14, 0),  is_public: true, display_on_form: true, sort_order: 13, location_type: 'BOOKABLE', bookable_id: cr },
        { event_id: trainingEvt.id, title: 'Masters Open Swim',       start_at: d(14, 15, 0), end_at: d(14, 17, 0),  is_public: true, display_on_form: true, sort_order: 14, location_type: 'BOOKABLE', bookable_id: sp, invitee_modes: ['specific_groups'], invitee_groups: ['20000000-0000-0000-0000-000000000009'] },
      ]).select('id')
      const trainingInvitees = await inviteAll(trainingEvt.id, allPersonIds, 'CONFIRMED')
      if (trainSessions?.length) {
        for (const s of trainSessions) {
          await fakeAttendance(trainingInvitees, s.id, new Date().toISOString(), 0.65)
        }
      }
    }

    // 5. Have a Go Day — 12 days, community open day
    await db.from('events').insert({
      ...base, style: 'BASIC', category_id: cat['Community'],
      title: 'Have a Go Day',
      description: 'Open day for the community to come try out the sport. No experience needed!',
      start_at: d(12, 10, 0), end_at: d(12, 15, 0),
      location_type: 'BOOKABLE', bookable_id: footballFields?.id,
    })

    // 6. Surf Comp — 15 days
    await db.from('events').insert({
      ...base, style: 'ADVANCED', category_id: cat['Competition'],
      title: 'Surf Comp',
      description: 'Annual club surf competition. All divisions welcome.',
      start_at: d(15, 7, 0), end_at: d(15, 17, 0),
    })

    // 7. Holiday Programme — starts the coming Monday (or today if already Monday), runs 2 weeks
    function nextMonday() {
      const dt = new Date()
      const dow = dt.getDay() // 0=Sun,1=Mon…
      const daysUntilMon = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow
      return daysUntilMon
    }
    const holStart = nextMonday()
    const { data: holEvt } = await db.from('events').insert({
      ...base, style: 'ADVANCED', category_id: cat['Development'],
      title: 'Holiday Programme',
      description: 'School holiday programme for juniors. Fun, active and skill-building sessions across two weeks.',
      start_at: d(holStart, 9, 0), end_at: d(holStart + 11, 17, 0),
      capacity_max: 45,
      form_id: holForm?.id,
      location_type: 'BOOKABLE', bookable_id: clubRoomsId,
    }).select('id').single()
    if (holEvt?.id) {
      // Day 0 (Monday week 1) sessions are masters; all other days link to them
      const { data: morningMaster } = await db.from('sessions').insert({
        event_id: holEvt.id, title: 'Morning Session', is_master: true,
        start_at: d(holStart, 9, 0), end_at: d(holStart, 12, 0),
        is_public: true, display_on_form: true, sort_order: 0,
        capacity_max: 30, location_type: 'BOOKABLE', bookable_id: clubRoomsId,
      }).select('id').single()
      const { data: afternoonMaster } = await db.from('sessions').insert({
        event_id: holEvt.id, title: 'Afternoon Session', is_master: true,
        start_at: d(holStart, 13, 0), end_at: d(holStart, 17, 0),
        is_public: true, display_on_form: true, sort_order: 1,
        capacity_max: 30, location_type: 'BOOKABLE', bookable_id: clubRoomsId,
      }).select('id').single()
      // Remaining 9 days (Tue week 1 → Fri week 2), skipping weekends
      const holSessionRows: any[] = []
      let sortIdx = 2
      for (let week = 0; week < 2; week++) {
        for (let weekday = 0; weekday < 5; weekday++) {
          if (week === 0 && weekday === 0) continue // skip Monday week 1 — already the master
          const dayOffset = holStart + week * 7 + weekday
          if (morningMaster?.id) holSessionRows.push({
            event_id: holEvt.id, master_id: morningMaster.id, title: 'Morning Session',
            start_at: d(dayOffset, 9, 0), end_at: d(dayOffset, 12, 0),
            is_public: true, display_on_form: true, sort_order: sortIdx++,
            capacity_max: 30, location_type: 'BOOKABLE', bookable_id: clubRoomsId,
          })
          if (afternoonMaster?.id) holSessionRows.push({
            event_id: holEvt.id, master_id: afternoonMaster.id, title: 'Afternoon Session',
            start_at: d(dayOffset, 13, 0), end_at: d(dayOffset, 17, 0),
            is_public: true, display_on_form: true, sort_order: sortIdx++,
            capacity_max: 30, location_type: 'BOOKABLE', bookable_id: clubRoomsId,
          })
        }
      }
      const { data: holSessions } = await db.from('sessions').insert(holSessionRows).select('id')

      // Fee components for master sessions
      if (morningMaster?.id) {
        await db.from('fee_components').insert({
          event_id: holEvt.id, session_id: morningMaster.id,
          name: 'Morning Session', amount: 25.00, sort_order: 0,
        })
      }
      if (afternoonMaster?.id) {
        await db.from('fee_components').insert({
          event_id: holEvt.id, session_id: afternoonMaster.id,
          name: 'Afternoon Session', amount: 30.00, sort_order: 1,
        })
      }

      // Discounts
      await db.from('discounts').insert([
        {
          event_id: holEvt.id, type: 'SIBLING',
          name: 'Group Discount',
          form_text: '15% off per person when registering 2 or more',
          modifier_type: 'PERCENT', modifier_value: 15,
          is_active: true, apply_to: 'per_person',
          conditions: [{ key: 'registration_group_size_min', operator: '>=', value: 2 }],
        },
        {
          event_id: holEvt.id, type: 'TRAINING_LINKED',
          name: 'Weekly Package',
          form_text: '20% off when you book 5 or more sessions',
          modifier_type: 'PERCENT', modifier_value: 20,
          is_active: true, apply_to: 'per_session',
          conditions: [{ key: 'booked_session_count_min', operator: '>=', value: 5 }],
        },
        {
          event_id: holEvt.id, type: 'TRAINING_LINKED',
          name: 'Full Week Deal',
          form_text: 'Book all 10 sessions and save $25',
          modifier_type: 'FLAT', modifier_value: 25,
          is_active: true, apply_to: 'registration_total',
          conditions: [{ key: 'booked_session_count_min', operator: '>=', value: 10 }],
        },
      ])

      // Addon: free club hat for first 20 registrations
      await db.from('addons').insert({
        event_id: holEvt.id,
        type: 'OBJECT',
        name: 'Welcome Club Hat',
        description: 'Free club hat for the first 20 registrations!',
        price: 0,
        stock_limit: 20,
        sort_order: 0,
      })

      // Invitees: all juniors + some fake attendance on past-ish sessions
      const { data: jm2 } = await db.from('member_group_memberships').select('person_id')
        .in('group_id', ['20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000005'])
      const holPersonIds = [...new Set((jm2 ?? []).map((m: any) => m.person_id))]
      if (holPersonIds.length) {
        const holInvitees = await inviteAll(holEvt.id, holPersonIds, 'CONFIRMED')
        const allHolSessions = [
          ...(morningMaster?.id ? [morningMaster] : []),
          ...(afternoonMaster?.id ? [afternoonMaster] : []),
          ...(holSessions ?? []),
        ]
        for (const s of allHolSessions.slice(0, 6)) {
          await fakeAttendance(holInvitees, s.id, new Date().toISOString(), 0.8)
        }
      }
    }

    // 8. Leadership Training Course — 22–23 days
    const { data: leaderEvt } = await db.from('events').insert({
      ...base, style: 'ADVANCED', category_id: cat['Development'],
      title: 'Leadership Training Course',
      description: 'Two-day leadership development course for coaches and committee members.',
      start_at: d(22, 9, 0), end_at: d(23, 17, 0),
      form_id: leaderForm?.id,
      location_type: 'BOOKABLE', bookable_id: clubRoomsId,
    }).select('id').single()
    if (leaderEvt?.id) {
      await db.from('sessions').insert([
        { event_id: leaderEvt.id, title: 'Day 1 — Foundations', start_at: d(22, 9, 0), end_at: d(22, 17, 0), is_public: true, display_on_form: true, sort_order: 0, location_type: 'BOOKABLE', bookable_id: clubRoomsId },
        { event_id: leaderEvt.id, title: 'Day 2 — Application',  start_at: d(23, 9, 0), end_at: d(23, 17, 0), is_public: true, display_on_form: true, sort_order: 1, location_type: 'BOOKABLE', bookable_id: clubRoomsId },
      ])
      await db.from('discounts').insert([
        {
          event_id: leaderEvt.id, type: 'ROLE',
          name: 'Member Discount',
          form_text: 'Active members save 15%',
          modifier_type: 'PERCENT', modifier_value: 15,
          is_active: true, apply_to: 'registration_total',
          conditions: [{ key: 'participant_member_status', operator: 'is', value: 'active_member' }],
        },
        {
          event_id: leaderEvt.id, type: 'SIBLING',
          name: 'Group Booking',
          form_text: '$30 off per person when booking for 2 or more',
          modifier_type: 'FLAT', modifier_value: 30,
          is_active: true, apply_to: 'per_person',
          conditions: [{ key: 'registration_group_size_min', operator: '>=', value: 2 }],
        },
        {
          event_id: leaderEvt.id, type: 'TRAINING_LINKED',
          name: 'Both Days',
          form_text: 'Book both days and save $20',
          modifier_type: 'FLAT', modifier_value: 20,
          is_active: true, apply_to: 'registration_total',
          conditions: [{ key: 'booked_session_count_min', operator: '>=', value: 2 }],
        },
      ])
      await inviteAll(leaderEvt.id, allPersonIds.slice(0, 20), 'CONFIRMED')
    }

    // 9. AGM — 25 days, all members invited
    const { data: agmEvt } = await db.from('events').insert({
      ...base, style: 'BASIC', category_id: cat['Administration'],
      title: 'AGM',
      description: 'Annual General Meeting. All financial members are eligible to vote.',
      start_at: d(25, 18, 0), end_at: d(25, 20, 30),
      location_type: 'BOOKABLE', bookable_id: clubRoomsId,
    }).select('id').single()
    if (agmEvt?.id) await inviteAll(agmEvt.id, allPersonIds)

    // 10. Club Show — Tickets, 28 days
    const { data: showEvt } = await db.from('events').insert({
      ...base, style: 'BASIC', category_id: cat['Social'],
      title: 'Club Show',
      description: 'Annual club show and presentation evening. Tickets required.',
      start_at: d(28, 18, 0), end_at: d(28, 22, 0),
      has_tickets: true,
      location_type: 'BOOKABLE', bookable_id: clubRoomsId,
    }).select('id').single()
    if (showEvt?.id) {
      await db.from('ticket_types').insert([
        { event_id: showEvt.id, name: 'Adult', description: 'General admission', price: 35.00, capacity: 200, is_active: true, sort_order: 0 },
        { event_id: showEvt.id, name: 'Concession', description: 'Students, seniors & members', price: 25.00, capacity: 100, is_active: true, sort_order: 1 },
        { event_id: showEvt.id, name: 'Child (under 12)', description: 'Children 12 and under', price: 0.00, capacity: 50, is_active: true, sort_order: 2 },
        { event_id: showEvt.id, name: 'Family Pass', description: '2 adults + 2 children', price: 80.00, capacity: 40, is_active: true, sort_order: 3 },
      ])
    }

    // 11. Awards Night — 30 days, all members invited
    const { data: awardsEvt } = await db.from('events').insert({
      ...base, style: 'BASIC', category_id: cat['Social'],
      title: 'Awards Night',
      description: "End of season awards and prize-giving. Celebrating our members' achievements.",
      start_at: d(30, 18, 30), end_at: d(30, 22, 0),
      location_type: 'BOOKABLE', bookable_id: clubRoomsId,
    }).select('id').single()
    if (awardsEvt?.id) await inviteAll(awardsEvt.id, allPersonIds)

    // ── Calendars ───────────────────────────────────────────────
    const calendarDefs = [
      { name: 'Club Events', sort_order: 0, categories: ['Social', 'Community', 'Administration'] },
      { name: 'Committee',   sort_order: 1, categories: ['Administration'] },
      { name: 'Sport',       sort_order: 2, categories: ['Training', 'Competition', 'Development'] },
    ]
    for (const calDef of calendarDefs) {
      const { data: calRow } = await (db.from as any)('calendars')
        .insert({ org_id: orgId.value, name: calDef.name, sort_order: calDef.sort_order })
        .select('id').single()
      if (calRow?.id) {
        const catIds = calDef.categories.map((name: string) => cat[name]).filter(Boolean)
        if (catIds.length) {
          await (db.from as any)('calendar_categories').insert(
            catIds.map((cid: string) => ({ calendar_id: calRow.id, category_id: cid }))
          )
        }
      }
    }

    toast.add({ severity: 'success', summary: 'Demo events created', detail: '11 events seeded with invitees, attendance, forms, discounts & bookables.', life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Seed failed', detail: e?.message ?? 'Unknown error', life: 5000 })
  } finally {
    seedingEvents.value = false
  }
}

const seedingBookings = ref(false)

async function seedDemoBookings() {
  seedingBookings.value = true

  function d(offsetDays: number, hour = 9, minute = 0) {
    const dt = new Date()
    dt.setDate(dt.getDate() + offsetDays)
    dt.setHours(hour, minute, 0, 0)
    return dt.toISOString()
  }

  try {
    // Load or create venues
    const { data: existing } = await db.from('bookables')
      .select('id, name')
      .eq('org_id', orgId.value)
      .eq('type', 'VENUE')
      .eq('status', 'ACTIVE')

    const venueMap: Record<string, string> = Object.fromEntries((existing ?? []).map((b: any) => [b.name, b.id]))

    async function ensureVenue(name: string, extra: Record<string, any> = {}, parentId?: string): Promise<string> {
      if (venueMap[name]) return venueMap[name]
      const { data } = await db.from('bookables').insert({
        org_id: orgId.value, name, type: 'VENUE', status: 'ACTIVE',
        is_public: true, allow_multiple_layouts: false,
        ...(parentId ? { parent_id: parentId } : {}),
        ...extra,
      }).select('id').single()
      venueMap[name] = data!.id
      return data!.id
    }

    const clubRoomsId   = await ensureVenue('Club Rooms',      { description: 'Function space for meetings, presentations, and social events.', sort_order: 0 })
    const footballFieldsId = await ensureVenue('Football Fields', { description: 'Two full-size football fields for training and match play.', sort_order: 1 }, clubRoomsId)
    const field1Id      = await ensureVenue('Field 1',   {}, footballFieldsId)
    const field2Id      = await ensureVenue('Field 2',   {}, footballFieldsId)
    const swimmingPoolId = await ensureVenue('Swimming Pool', { description: '25m heated pool with 6 lanes.', sort_order: 2 }, clubRoomsId)
    const compPoolId    = await ensureVenue('Competition Pool', { default_booking_view: 'scheduler', show_in_menu: true, sort_order: 0 }, swimmingPoolId)
    const lane1Id       = await ensureVenue('Lane 1', { is_master: true, sort_order: 0 }, compPoolId)
    const lane2Id       = await ensureVenue('Lane 2', { sort_order: 1 }, compPoolId)
    const lane3Id       = await ensureVenue('Lane 3', { sort_order: 2 }, compPoolId)
    const lane4Id       = await ensureVenue('Lane 4', { sort_order: 3 }, compPoolId)
    const tennisCourtsId = await ensureVenue('Tennis Courts', { description: '4 hard-court tennis courts with floodlighting.', default_booking_view: 'scheduler', show_in_menu: true, sort_order: 3 }, clubRoomsId)
    const court1Id      = await ensureVenue('Court 1', { is_master: true, sort_order: 0 }, tennisCourtsId)
    const court2Id      = await ensureVenue('Court 2', { sort_order: 1 }, tennisCourtsId)
    const court3Id      = await ensureVenue('Court 3', { sort_order: 2 }, tennisCourtsId)
    const court4Id      = await ensureVenue('Court 4', { sort_order: 3 }, tennisCourtsId)
    const cricketNetsId = await ensureVenue('Cricket Nets', { description: '4 practice nets for batting and bowling drills.', default_booking_view: 'scheduler', show_in_menu: true, sort_order: 5 })
    const net1Id        = await ensureVenue('Net 1', { is_master: true, sort_order: 0 }, cricketNetsId)
    const net2Id        = await ensureVenue('Net 2', { sort_order: 1 }, cricketNetsId)
    const net3Id        = await ensureVenue('Net 3', { sort_order: 2 }, cricketNetsId)
    const net4Id = await ensureVenue('Net 4', { sort_order: 3 }, cricketNetsId)

    const rows: any[] = []

    const purposes = {
      tennis: ['Club Competition', 'Coaching Session', 'Social Match', 'Junior Training', 'Ladies Group', 'Mixed Doubles'],
      pool: ['Squad Training', 'Masters Swim', 'Learn to Swim', 'Fitness Swim', 'School Group', 'Club Carnival'],
      cricket: ['Net Practice', 'Batting Drill', 'Bowling Session', 'Warm-up', 'Youth Squad', 'Club Practice'],
      club: ['Board Meeting', 'Team Briefing', 'Social Event', 'First Aid Course', 'Coaching Workshop', 'Volunteer Training'],
      football: ['Seniors Training', 'Juniors Training', 'Pre-Match Warm-up', 'Skills Clinic', 'School Program', 'Academy Session'],
    }

    function pick(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)] }

    // Tennis courts — morning and afternoon slots over next 14 days
    for (let day = 0; day < 14; day++) {
      const slots = [[7, 0, 8, 30], [9, 0, 10, 30], [11, 0, 12, 30], [14, 0, 15, 30], [16, 0, 17, 30], [18, 0, 19, 30]]
      const courts = [court1Id, court2Id, court3Id, court4Id].filter(Boolean)
      for (const courtId of courts) {
        for (const [sh, sm, eh, em] of slots) {
          if (Math.random() < 0.55) {
            rows.push({
              bookable_id: courtId, type: 'STANDALONE', status: 'CONFIRMED',
              start_at: d(day, sh, sm), end_at: d(day, eh, em),
              purpose: pick(purposes.tennis), is_all_day: false,
            })
          }
        }
      }
    }

    // Pool lanes — early morning and evening lap swims
    for (let day = 0; day < 14; day++) {
      const slots = [[5, 30, 7, 0], [7, 0, 8, 30], [12, 0, 13, 0], [17, 30, 19, 0], [19, 0, 20, 30]]
      const lanes = [lane1Id, lane2Id, lane3Id, lane4Id].filter(Boolean)
      for (const laneId of lanes) {
        for (const [sh, sm, eh, em] of slots) {
          if (Math.random() < 0.60) {
            rows.push({
              bookable_id: laneId, type: 'STANDALONE', status: 'CONFIRMED',
              start_at: d(day, sh, sm), end_at: d(day, eh, em),
              purpose: pick(purposes.pool), is_all_day: false,
            })
          }
        }
      }
    }

    // Cricket nets — afternoon and evening sessions
    for (let day = 0; day < 14; day++) {
      const slots = [[15, 0, 16, 30], [16, 30, 18, 0], [18, 0, 19, 30]]
      const nets = [net1Id, net2Id, net3Id, net4Id].filter(Boolean)
      for (const netId of nets) {
        for (const [sh, sm, eh, em] of slots) {
          if (Math.random() < 0.50) {
            rows.push({
              bookable_id: netId, type: 'STANDALONE', status: 'CONFIRMED',
              start_at: d(day, sh, sm), end_at: d(day, eh, em),
              purpose: pick(purposes.cricket), is_all_day: false,
            })
          }
        }
      }
    }

    // Football fields
    for (let day = 0; day < 14; day++) {
      const slots = [[8, 0, 10, 0], [10, 30, 12, 0], [15, 0, 17, 0], [17, 30, 19, 30]]
      const fields = [field1Id, field2Id].filter(Boolean)
      for (const fieldId of fields) {
        for (const [sh, sm, eh, em] of slots) {
          if (Math.random() < 0.45) {
            rows.push({
              bookable_id: fieldId, type: 'STANDALONE', status: 'CONFIRMED',
              start_at: d(day, sh, sm), end_at: d(day, eh, em),
              purpose: pick(purposes.football), is_all_day: false,
            })
          }
        }
      }
    }

    // Club Rooms — occasional meetings and workshops
    if (clubRoomsId) {
      for (let day = 0; day < 14; day++) {
        if (Math.random() < 0.35) {
          const hour = [9, 13, 17, 18][Math.floor(Math.random() * 4)]
          rows.push({
            bookable_id: clubRoomsId, type: 'STANDALONE', status: 'CONFIRMED',
            start_at: d(day, hour, 0), end_at: d(day, hour + 2, 0),
            purpose: pick(purposes.club), is_all_day: false,
          })
        }
      }
    }

    // Also backfill EVENT_DRIVEN bookings from existing events
    const { data: events } = await db.from('events')
      .select('id, start_at, end_at, title, is_all_day, locations, location_type, bookable_id')
      .eq('org_id', orgId.value)
      .not('start_at', 'is', null)
    for (const evt of events ?? []) {
      const bookableIds: string[] = []
      if (evt.locations?.length) {
        for (const loc of evt.locations) {
          if (loc.type === 'BOOKABLE') bookableIds.push(...(loc.bookable_ids ?? []))
        }
      } else if (evt.location_type === 'BOOKABLE' && evt.bookable_id) {
        bookableIds.push(evt.bookable_id)
      }
      for (const bid of bookableIds) {
        rows.push({
          bookable_id: bid, event_id: evt.id, type: 'EVENT_DRIVEN', status: 'CONFIRMED',
          start_at: evt.start_at, end_at: evt.end_at,
          purpose: evt.title, is_all_day: evt.is_all_day ?? false,
        })
      }
    }

    // Insert in chunks to avoid payload limits
    const chunk = 200
    for (let i = 0; i < rows.length; i += chunk) {
      await db.from('bookings').insert(rows.slice(i, i + chunk))
    }

    toast.add({ severity: 'success', summary: 'Demo bookings created', detail: `${rows.length} bookings seeded across all venues.`, life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Seed failed', detail: e?.message ?? 'Unknown error', life: 5000 })
  } finally {
    seedingBookings.value = false
  }
}

const resetting = ref(false)

async function resetDatabase() {
  const ok = confirm('Reset the database? This will delete all events, venues, bookings, registrations, forms, fees, discounts, and related data. People and member groups will be kept. This cannot be undone.')
  if (!ok) return
  resetting.value = true
  try {
    // Delete in dependency order (children before parents)
    const tables = [
      'audit_log', 'access_scans', 'physical_schedules', 'lighting_profiles',
      'tasks', 'attendance', 'communications',
      'registration_ticket_items', 'registration_sessions', 'transactions', 'registrations',
      'ticket_types',
      'form_fields', 'registration_forms',
      'discounts', 'addons', 'fee_rules', 'fee_components',
      'invitees', 'connection_group_events', 'connection_groups',
      'sessions', 'events',
      'bookings', 'bookable_closures', 'availability_rules', 'bookables',
      'calendar_categories', 'calendars', 'categories',
    ]
    for (const table of tables) {
      await db.from(table as any).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }
    toast.add({ severity: 'success', summary: 'Database reset', detail: 'All data except people has been cleared.', life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Reset failed', detail: e?.message ?? 'Unknown error', life: 5000 })
  } finally {
    resetting.value = false
  }
}

onMounted(load)
</script>
