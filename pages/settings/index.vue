<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-surface-900">Settings</h1>
      <p class="text-sm text-surface-500 mt-0.5">Organisation configuration and preferences.</p>
    </div>

    <Tabs value="general">
      <TabList>
        <Tab value="general"><i class="pi pi-cog mr-2 text-xs" />General</Tab>
        <Tab value="bookings"><i class="pi pi-calendar mr-2 text-xs" />Bookings</Tab>
        <Tab value="events"><i class="pi pi-megaphone mr-2 text-xs" />Events</Tab>
        <Tab value="people"><i class="pi pi-users mr-2 text-xs" />People</Tab>
        <Tab value="resources"><i class="pi pi-building mr-2 text-xs" />Resources</Tab>
        <Tab value="advanced"><i class="pi pi-wrench mr-2 text-xs" />Advanced</Tab>
      </TabList>
      <TabPanels>

        <!-- ── GENERAL ── -->
        <TabPanel value="general" class="space-y-4 max-w-2xl">
          <div class="card p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-4">Organisation</h2>
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Organisation Name</label>
                <InputText v-model="org.name" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Organisation level</label>
                <p class="text-xs text-surface-500 -mt-0.5">Where this organisation sits in the hierarchy.</p>
                <Select v-model="org.org_level" :options="orgLevelOptions" option-label="label" option-value="value" class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Parent organisation</label>
                <p class="text-xs text-surface-500 -mt-0.5">The body this organisation reports up to (e.g. a club → its regional association). Builds the full chain up to the national body. Drives shared categories, fields, branding, and cross-org reporting.</p>
                <Select v-model="org.parent_id" :options="parentCandidates" option-label="_label" option-value="id"
                  placeholder="Not affiliated" show-clear filter class="w-full" />
                <div v-if="orgChain.length > 1" class="mt-1 flex flex-wrap items-center gap-1 text-xs">
                  <template v-for="(node, i) in orgChain" :key="node.id">
                    <span :class="['px-2 py-0.5 rounded', node.id === orgId ? 'bg-primary text-white' : 'bg-surface-100 text-surface-700']">
                      {{ node.name }}<span class="opacity-60"> · {{ orgLevelLabel(node.org_level) }}</span>
                    </span>
                    <i v-if="i < orgChain.length - 1" class="pi pi-angle-right text-surface-400" />
                  </template>
                </div>
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
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Season</label>
                <p class="text-xs text-surface-500 -mt-0.5">Default date range used by group terms, attendance, and reporting windows.</p>
                <div class="grid grid-cols-2 gap-3 mt-1">
                  <DatePicker v-model="org.season_start" date-format="d M yy" placeholder="Start date" class="w-full" />
                  <DatePicker v-model="org.season_end" date-format="d M yy" placeholder="End date" :min-date="org.season_start ?? undefined" class="w-full" />
                </div>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <Button label="Save Organisation" :loading="savingOrg" @click="saveOrg" size="small" />
            </div>
          </div>
        </TabPanel>

        <!-- ── BOOKINGS ── -->
        <TabPanel value="bookings" class="space-y-4 max-w-2xl">
          <div class="card p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-1">Default booking form</h2>
            <p class="text-xs text-surface-500 mb-3">Form used by every activity mode unless the mode picks its own. Holds the fields, terms &amp; conditions, and confirmation copy customers see at the Details step.</p>
            <div class="flex items-center gap-2">
              <Select v-model="org.default_form_id" :options="formOptions" option-label="label" option-value="value"
                placeholder="No default form (use built-in fields)" filter show-clear class="flex-1" />
              <Button v-if="org.default_form_id" label="Edit form" icon="pi pi-pencil" size="small" severity="secondary" outlined
                @click="navigateTo(`/forms/${org.default_form_id}?return=${encodeURIComponent($route.fullPath)}`)" />
              <Button label="New form" icon="pi pi-plus" size="small"
                style="background:#1E2157;border-color:#1E2157"
                @click="navigateTo(`/forms/new?return=${encodeURIComponent($route.fullPath)}`)" />
            </div>
            <div class="mt-4 flex justify-end">
              <Button label="Save default form" :loading="savingDefaultForm" @click="saveDefaultForm" size="small" />
            </div>
          </div>

          <div class="card p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-1">Payment Options for bookings</h2>
            <p class="text-xs text-surface-500 mb-4">Methods offered by default on activity-mode bookings. Modes can override.</p>
            <PaymentOptionsEditor
              v-model="defaultPaymentOptions"
              :default-model="org.default_payment_method"
              @update:defaultModel="org.default_payment_method = $event"
              :bank-accounts="bankAccounts"
              :bank-account-id="org.default_bank_account_id"
              @update:bankAccountId="org.default_bank_account_id = $event"
              allow-default
              manage-bank-accounts
              @manage-bank-accounts="showBankAccounts = true" />
            <div class="mt-4 flex justify-end">
              <Button label="Save Payment Options" :loading="savingPayments" @click="saveDefaultPayments" size="small" />
            </div>
          </div>

          <!-- Booker theme — applied to /book embeds (and the Open page). -->
          <div class="card p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-1">Booker theme</h2>
            <p class="text-xs text-surface-500 mb-4">Brand colours used on the public booking page (/book) and any iframe embed.</p>
            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <input type="color" v-model="bookerTheme.canvas"
                  class="w-12 h-10 rounded border border-gray-200 cursor-pointer shrink-0" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-800">Background</p>
                  <p class="text-xs text-gray-400">Page canvas behind the cards.</p>
                </div>
                <input type="text" v-model="bookerTheme.canvas" maxlength="7"
                  class="w-24 h-9 px-2 text-xs font-mono uppercase border border-gray-200 rounded outline-none focus:border-[#1E2157]" />
              </div>
              <div class="flex items-center gap-3">
                <input type="color" v-model="bookerTheme.primary"
                  class="w-12 h-10 rounded border border-gray-200 cursor-pointer shrink-0" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-800">Primary</p>
                  <p class="text-xs text-gray-400">Buttons, selected-state borders, brand accents.</p>
                </div>
                <input type="text" v-model="bookerTheme.primary" maxlength="7"
                  class="w-24 h-9 px-2 text-xs font-mono uppercase border border-gray-200 rounded outline-none focus:border-[#1E2157]" />
              </div>
              <div class="flex items-center gap-3">
                <input type="color" v-model="bookerTheme.on_primary"
                  class="w-12 h-10 rounded border border-gray-200 cursor-pointer shrink-0" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-800">On primary</p>
                  <p class="text-xs text-gray-400">Text + icons drawn on top of the primary colour.</p>
                </div>
                <input type="text" v-model="bookerTheme.on_primary" maxlength="7"
                  class="w-24 h-9 px-2 text-xs font-mono uppercase border border-gray-200 rounded outline-none focus:border-[#1E2157]" />
              </div>

              <!-- Live preview swatch -->
              <div class="rounded-lg overflow-hidden border border-gray-200"
                :style="{ background: bookerTheme.canvas }">
                <div class="p-4 flex items-center gap-3">
                  <button class="px-4 py-2 text-sm font-semibold rounded-lg transition-shadow hover:shadow-sm"
                    :style="{ background: bookerTheme.primary, color: bookerTheme.on_primary }">
                    Confirm booking
                  </button>
                  <p class="text-xs text-gray-500">Preview</p>
                </div>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <Button label="Save Theme" :loading="savingTheme" @click="saveBookerTheme" size="small" />
            </div>
          </div>
        </TabPanel>

        <!-- ── EVENTS ── -->
        <TabPanel value="events" class="space-y-4 max-w-2xl">
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

          <div class="card p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-1">Payment Options for events</h2>
            <p class="text-xs text-surface-500 mb-4">Methods offered by default on event registration forms. Individual events can override.</p>
            <PaymentOptionsEditor
              v-model="eventsPaymentOptions"
              :default-model="org.events_default_payment_method"
              @update:defaultModel="org.events_default_payment_method = $event"
              :bank-accounts="bankAccounts"
              :bank-account-id="org.events_default_bank_account_id"
              @update:bankAccountId="org.events_default_bank_account_id = $event"
              allow-default
              manage-bank-accounts
              @manage-bank-accounts="showBankAccounts = true" />
            <div class="mt-4 flex justify-end">
              <Button label="Save Payment Options" :loading="savingEventsPayments" @click="saveEventsPayments" size="small" />
            </div>
          </div>
        </TabPanel>

        <!-- ── PEOPLE ── -->
        <TabPanel value="people" class="grid grid-cols-2 gap-4 max-w-4xl">
          <div class="card p-4">
            <h3 class="text-sm font-semibold text-surface-700 mb-3">Members</h3>
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
        </TabPanel>

        <!-- ── RESOURCES ── -->
        <TabPanel value="resources" class="grid grid-cols-3 gap-4 max-w-4xl">
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
        </TabPanel>

        <!-- ── ADVANCED ── -->
        <TabPanel value="advanced" class="space-y-4 max-w-2xl">
          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-semibold text-gray-700">Demo Events</h2>
                <p class="text-xs text-gray-500 mt-0.5">Seed 11 realistic sample events spread across the next month — training weeks, comps, meetings, a ticketed show, and more.</p>
              </div>
              <Button label="Seed Demo Events" icon="pi pi-magic-wand" size="small" severity="secondary" outlined
                :loading="seedingEvents" class="ml-6 shrink-0" @click="seedDemoEvents" />
            </div>
          </div>

          <div class="rounded-xl border border-red-200 bg-white p-5 space-y-4">
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
        </TabPanel>

      </TabPanels>
    </Tabs>

    <!-- Bank Accounts Dialog -->
    <Dialog v-model:visible="showBankAccounts" header="Bank Accounts" modal style="width: 540px">
      <div class="space-y-3">
        <div v-if="!bankAccounts.length" class="text-sm text-gray-400 italic py-3 text-center">No bank accounts yet.</div>
        <div v-for="b in bankAccounts" :key="b.id"
          class="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/40">
          <div class="flex items-center gap-2">
            <InputText v-model="b.name" placeholder="Account name (e.g. Main Account)" class="flex-1" />
            <button type="button" class="w-8 h-8 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              @click="removeBankAccount(b.id)">
              <i class="pi pi-trash text-xs" />
            </button>
          </div>
          <Textarea v-model="b.details" rows="2" auto-resize placeholder="Account details (BSB, number, reference, etc.)" class="w-full text-sm bg-white" />
        </div>
        <Button label="Add bank account" icon="pi pi-plus" size="small" severity="secondary" outlined
          class="w-full" @click="addBankAccount" />
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="cancelBankAccounts" />
        <Button label="Save" :loading="savingBankAccounts" @click="saveBankAccounts"
          style="background:#1E2157;border-color:#1E2157" />
      </template>
    </Dialog>

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

const org = ref<{
  name: string
  currency: string
  locale: string
  season_start: Date | null
  season_end: Date | null
  parent_id: string | null
  org_level: 'CLUB' | 'REGIONAL' | 'ASSOCIATION' | 'NATIONAL'
  default_form_id: string | null
  default_payment_method: string | null
  default_bank_account_id: string | null
  events_default_payment_method: string | null
  events_default_bank_account_id: string | null
}>({
  name: 'Demo Club', currency: 'AUD', locale: 'en-AU',
  season_start: null, season_end: null,
  parent_id: null, org_level: 'CLUB',
  default_form_id: null, default_payment_method: null, default_bank_account_id: null,
  events_default_payment_method: null, events_default_bank_account_id: null,
})

// Org hierarchy (Club -> Regional -> Association -> National)
const { buildChain } = useOrgHierarchy()
const allOrgs = ref<OrgNode[]>([])
const orgLevelOptions = (ORG_LEVELS as readonly string[]).map(v => ({ value: v, label: orgLevelLabel(v) }))
// Candidate parents = every other org that is NOT a descendant of this org (cycle-safe).
const parentCandidates = computed(() => allOrgs.value
  .filter(o => o.id !== orgId.value)
  .filter(o => !buildChain(o.id, allOrgs.value).some(c => c.id === orgId.value))
  .map(o => ({ ...o, _label: `${o.name} · ${orgLevelLabel(o.org_level)}` }))
  .sort((a, b) => orgLevelRank(b.org_level) - orgLevelRank(a.org_level) || a.name.localeCompare(b.name)))
// Resolved chain (top org first … this org last), using the LIVE form selection.
const orgChain = computed<OrgNode[]>(() => {
  const id = orgId.value
  if (!id) return []
  const merged = allOrgs.value.map(o => o.id === id
    ? { ...o, name: org.value.name, parent_id: org.value.parent_id, org_level: org.value.org_level }
    : o)
  if (!merged.some(o => o.id === id)) {
    merged.push({ id, name: org.value.name, org_level: org.value.org_level, parent_id: org.value.parent_id })
  }
  return buildChain(id, merged)
})

// Bank accounts
const bankAccounts = ref<{ id: string; name: string; details: string | null; _new?: boolean }[]>([])
const showBankAccounts = ref(false)
const savingBankAccounts = ref(false)
let bankAccountsBackup: any[] = []
function addBankAccount() {
  bankAccounts.value.push({ id: crypto.randomUUID(), name: '', details: '', _new: true })
}
function removeBankAccount(id: string) {
  bankAccounts.value = bankAccounts.value.filter(b => b.id !== id)
}
function cancelBankAccounts() {
  bankAccounts.value = JSON.parse(JSON.stringify(bankAccountsBackup))
  showBankAccounts.value = false
}
async function loadBankAccounts() {
  const { data } = await (db.from as any)('bank_accounts')
    .select('id, name, details')
    .eq('org_id', orgId.value)
    .order('sort_order').order('created_at')
  bankAccounts.value = (data ?? []) as any[]
}
async function saveBankAccounts() {
  savingBankAccounts.value = true
  try {
    const existingIds = (bankAccountsBackup as any[]).map(b => b.id)
    const currentIds = bankAccounts.value.map(b => b.id)
    const toDelete = existingIds.filter(id => !currentIds.includes(id))
    if (toDelete.length) await (db.from as any)('bank_accounts').delete().in('id', toDelete)
    for (const b of bankAccounts.value) {
      if (!b.name?.trim()) continue
      if (b._new) {
        await (db.from as any)('bank_accounts').insert({
          id: b.id, org_id: orgId.value, name: b.name.trim(), details: b.details || null,
        })
      } else {
        await (db.from as any)('bank_accounts').update({
          name: b.name.trim(), details: b.details || null,
        }).eq('id', b.id)
      }
    }
    await loadBankAccounts()
    bankAccountsBackup = JSON.parse(JSON.stringify(bankAccounts.value))
    showBankAccounts.value = false
    toast.add({ severity: 'success', summary: 'Bank accounts saved', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 4000 })
  }
  savingBankAccounts.value = false
}
watch(showBankAccounts, (open) => {
  if (open) bankAccountsBackup = JSON.parse(JSON.stringify(bankAccounts.value))
})
const defaults = ref({ phased_registration: false, hold_spot_enabled: false, show_attendee_list: false, member_window_days: 40 })
const savingOrg = ref(false)
const savingDefaultForm = ref(false)
const allForms = ref<{ id: string; name: string }[]>([])
const formOptions = computed(() => allForms.value.map(f => ({ value: f.id, label: f.name })))
async function saveDefaultForm() {
  savingDefaultForm.value = true
  await (db.from as any)('organisations')
    .update({ default_form_id: org.value.default_form_id || null })
    .eq('id', orgId.value)
  toast.add({ severity: 'success', summary: 'Default form saved', life: 2500 })
  savingDefaultForm.value = false
}

const defaultPaymentOptions = ref<Record<string, boolean>>({ invoice: false, credit_card: false, payment_plan: false, coupon: false })
const eventsPaymentOptions = ref<Record<string, boolean>>({ invoice: false, credit_card: false, payment_plan: false, coupon: false })
const savingPayments = ref(false)
const savingEventsPayments = ref(false)

// Booker theme — applied to /book embeds.
interface BookerTheme { canvas: string; primary: string; on_primary: string }
const bookerTheme = ref<BookerTheme>({ canvas: '#F5F8FA', primary: '#1E2157', on_primary: '#FFFFFF' })
const savingTheme = ref(false)
async function saveBookerTheme() {
  savingTheme.value = true
  await (db.from as any)('organisations')
    .update({ booker_theme: { ...bookerTheme.value } })
    .eq('id', orgId.value)
  toast.add({ severity: 'success', summary: 'Booker theme saved', life: 2500 })
  savingTheme.value = false
}
async function saveDefaultPayments() {
  savingPayments.value = true
  await (db.from as any)('organisations')
    .update({
      default_payment_options: { ...defaultPaymentOptions.value },
      default_payment_method: org.value.default_payment_method || null,
      default_bank_account_id: org.value.default_bank_account_id || null,
    })
    .eq('id', orgId.value)
  toast.add({ severity: 'success', summary: 'Booking payments saved', life: 2500 })
  savingPayments.value = false
}
async function saveEventsPayments() {
  savingEventsPayments.value = true
  await (db.from as any)('organisations')
    .update({
      events_default_payment_options: { ...eventsPaymentOptions.value },
      events_default_payment_method: org.value.events_default_payment_method || null,
      events_default_bank_account_id: org.value.events_default_bank_account_id || null,
    })
    .eq('id', orgId.value)
  toast.add({ severity: 'success', summary: 'Event payments saved', life: 2500 })
  savingEventsPayments.value = false
}
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
  const [{ data: orgData }, { data: catData }, { count }, { data: groupData }, { data: memberships }, { data: forms }, { data: orgsData }] = await Promise.all([
    db.from('organisations').select('*').eq('id', orgId.value).single(),
    db.from('categories').select('*').eq('org_id', orgId.value).order('name'),
    db.from('persons').select('*', { count: 'exact', head: true }).eq('org_id', orgId.value),
    db.from('member_groups').select('id, name, color, parent_id, sort_order').eq('org_id', orgId.value).order('sort_order'),
    db.from('member_group_memberships').select('group_id'),
    (db.from as any)('registration_forms').select('id, name').eq('org_id', orgId.value).order('name'),
    (db.from as any)('organisations').select('id, name, org_level, parent_id').order('name'),
  ])
  allOrgs.value = (orgsData ?? []) as OrgNode[]
  if (orgData) {
    org.value = {
      name: orgData.name,
      currency: orgData.currency,
      locale: orgData.locale,
      season_start: orgData.season_start ? new Date(orgData.season_start) : null,
      season_end: orgData.season_end ? new Date(orgData.season_end) : null,
      parent_id: orgData.parent_id ?? null,
      org_level: (orgData.org_level ?? 'CLUB') as 'CLUB' | 'REGIONAL' | 'ASSOCIATION' | 'NATIONAL',
      default_form_id: orgData.default_form_id ?? null,
      default_payment_method: orgData.default_payment_method ?? null,
      default_bank_account_id: orgData.default_bank_account_id ?? null,
      events_default_payment_method: orgData.events_default_payment_method ?? null,
      events_default_bank_account_id: orgData.events_default_bank_account_id ?? null,
    }
    defaultPaymentOptions.value = {
      invoice: false, credit_card: false, payment_plan: false, coupon: false,
      ...(orgData.default_payment_options ?? {}),
    }
    eventsPaymentOptions.value = {
      invoice: false, credit_card: false, payment_plan: false, coupon: false,
      ...(orgData.events_default_payment_options ?? {}),
    }
    const t = (orgData.booker_theme ?? {}) as Partial<BookerTheme>
    bookerTheme.value = {
      canvas: t.canvas || '#F5F8FA',
      primary: t.primary || '#1E2157',
      on_primary: t.on_primary || '#FFFFFF',
    }
  }
  await loadBankAccounts()
  allForms.value = (forms ?? []) as any[]
  categories.value = catData ?? []
  personCount.value = count ?? 0
  memberGroups.value = groupData ?? []
  const counts: Record<string, number> = {}
  for (const m of memberships ?? []) counts[m.group_id] = (counts[m.group_id] ?? 0) + 1
  membershipCounts.value = counts
  groupsLoading.value = false
}

function toIsoDate(d: Date | null): string | null {
  if (!d) return null
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function saveOrg() {
  savingOrg.value = true
  await db.from('organisations').update({
    name: org.value.name,
    currency: org.value.currency,
    locale: org.value.locale,
    parent_id: org.value.parent_id,
    org_level: org.value.org_level,
    season_start: toIsoDate(org.value.season_start),
    season_end: toIsoDate(org.value.season_end),
  }).eq('id', orgId.value)
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
      { name: 'Trainings',     color: '#06B6D4', icon: 'pi-calendar' },
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
      is_public: true, description: 'Function space for meetings, presentations, and social events.', sort_order: 0,
    }).select('id').single()
    const clubRoomsId = clubRooms?.id as string | undefined

    // Sub-venues of Club Rooms (each with their own sub-locations)
    // Football Fields — slot-aware setup matching SetupWizard's Football
    // preset. Field 1 master, Field 2 linked; each gets Half A/B as
    // physical sub-venues, with Halves configurations so Small-sided
    // games book "Any half".
    const footballFieldIds: string[] = []
    const footballHalvesByField: Record<string, string[]> = {}
    const { data: footballFields } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Football Fields', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: 'Two full-size football fields for training and match play.',
      parent_id: clubRoomsId, sort_order: 1, allow_sub_venues: true,
      default_booking_view: 'scheduler', show_in_menu: true,
    }).select('id').single()
    if (footballFields?.id) {
      const { data: field1 } = await db.from('bookables').insert({
        org_id: orgId.value, name: 'Field 1', type: 'VENUE', status: 'ACTIVE',
        is_public: true, is_master: true, parent_id: footballFields.id, sort_order: 0,
        allow_sub_venues: true, auto_resolve_children: true,
      }).select('id').single()
      if (field1?.id) {
        footballFieldIds.push(field1.id as string)
        const { data: field2 } = await db.from('bookables').insert({
          org_id: orgId.value, name: 'Field 2', type: 'VENUE', status: 'ACTIVE',
          is_public: true, master_id: field1.id, parent_id: footballFields.id, sort_order: 1,
          allow_sub_venues: true, auto_resolve_children: true,
        }).select('id').single()
        if (field2?.id) footballFieldIds.push(field2.id as string)

        // Halves on each field — Field 1 owns the master halves, Field 2's
        // halves chain back to Field 1's via master_id.
        const halfNames = ['Half A', 'Half B']
        const masterHalfIds: string[] = []
        for (let i = 0; i < halfNames.length; i++) {
          const isMaster = i === 0
          const { data: h } = await db.from('bookables').insert({
            org_id: orgId.value, name: halfNames[i], type: 'VENUE', status: 'ACTIVE',
            is_public: true, parent_id: field1.id,
            is_master: isMaster, master_id: isMaster ? null : masterHalfIds[0],
            max_concurrent: 1,
          }).select('id').single()
          if (h?.id) masterHalfIds.push(h.id as string)
        }
        footballHalvesByField[field1.id as string] = masterHalfIds

        if (footballFieldIds.length > 1) {
          const linkedField = footballFieldIds[1]
          const linkedHalfIds: string[] = []
          for (let i = 0; i < halfNames.length; i++) {
            const { data: h } = await db.from('bookables').insert({
              org_id: orgId.value, name: halfNames[i], type: 'VENUE', status: 'ACTIVE',
              is_public: true, parent_id: linkedField,
              is_master: false, master_id: masterHalfIds[i],
              max_concurrent: 1,
            }).select('id').single()
            if (h?.id) linkedHalfIds.push(h.id as string)
          }
          footballHalvesByField[linkedField] = linkedHalfIds
        }

        // Halves configuration on every field — single-member slots since
        // halves IS the finest division (no quarters here).
        const { saveConfiguration } = useBookableConfigurations()
        for (const fieldId of footballFieldIds) {
          const hIds = footballHalvesByField[fieldId]
          if (!hIds || hIds.length !== 2) continue
          await saveConfiguration(fieldId, 'halves', 'Halves', [
            { name: 'Half A', childIds: [hIds[0]] },
            { name: 'Half B', childIds: [hIds[1]] },
          ])
        }
      }
    }

    // Swimming Pool — Competition Pool gets a Lanes-4 configuration so a
    // Lane swim mode can resolve "Any free lane" while Pool hire books
    // the whole pool (parent-child mutex blocks every lane).
    let competitionPoolId: string | null = null
    const competitionLaneIds: string[] = []
    const { data: swimmingPool } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Swimming Pool', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: '25m heated pool with 6 lanes. Available for squad sessions and public swim.',
      parent_id: clubRoomsId, sort_order: 2, allow_sub_venues: true,
    }).select('id').single()
    if (swimmingPool?.id) {
      const { data: compPool } = await db.from('bookables').insert(
        { org_id: orgId.value, name: 'Competition Pool', type: 'VENUE', status: 'ACTIVE', is_public: true, parent_id: swimmingPool.id, sort_order: 0, default_booking_view: 'scheduler', show_in_menu: true, allow_sub_venues: true },
      ).select('id').single()
      if (compPool?.id) {
        competitionPoolId = compPool.id as string
        const { data: lane1 } = await db.from('bookables').insert({
          org_id: orgId.value, name: 'Lane 1', type: 'VENUE', status: 'ACTIVE',
          is_public: true, is_master: true, parent_id: compPool.id, sort_order: 0,
          max_concurrent: 1,
        }).select('id').single()
        if (lane1?.id) {
          competitionLaneIds.push(lane1.id as string)
          const { data: linkedLanes } = await db.from('bookables').insert(
            [2, 3, 4].map((n, i) => ({
              org_id: orgId.value, name: `Lane ${n}`, type: 'VENUE', status: 'ACTIVE',
              is_public: true, master_id: lane1.id, parent_id: compPool.id, sort_order: i + 1,
              max_concurrent: 1,
            })),
          ).select('id, sort_order')
          for (const ll of ((linkedLanes ?? []) as { id: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order)) {
            competitionLaneIds.push(ll.id)
          }
        }

        if (competitionLaneIds.length === 4) {
          const { saveConfiguration } = useBookableConfigurations()
          await saveConfiguration(competitionPoolId, 'lanes-4', '4 lanes', competitionLaneIds.map((cid, i) => ({
            name: `Lane ${i + 1}`, childIds: [cid],
          })))
        }
      }
      await db.from('bookables').insert(
        { org_id: orgId.value, name: 'Learn-to-Swim Area', type: 'VENUE', status: 'ACTIVE', is_public: true, parent_id: swimmingPool.id, sort_order: 1 },
      )
    }

    // Tennis Courts — full slot-aware setup matching what SetupWizard
    // produces: facility → 4 courts (master/linked) → 4 quarters per court
    // (master/linked chained), plus Halves + Quarters configurations on
    // every court so modes can require either layout.
    const tennisCourtIds: string[] = []
    const tennisQuartersByCourt: Record<string, string[]> = {}
    const { data: tennisCourts } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Tennis Courts', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: '4 hard-court tennis courts with floodlighting.',
      parent_id: clubRoomsId, sort_order: 3, default_booking_view: 'scheduler', show_in_menu: true,
      allow_sub_venues: true,
    }).select('id').single()
    if (tennisCourts?.id) {
      // Court 1 is master; Courts 2–4 are linked to it. Each court itself
      // has allow_sub_venues=true so the Sub-venues tab + Configurations
      // panel appear inside it.
      const { data: court1 } = await db.from('bookables').insert({
        org_id: orgId.value, name: 'Court 1', type: 'VENUE', status: 'ACTIVE',
        is_public: true, is_master: true, parent_id: tennisCourts.id, sort_order: 0,
        allow_sub_venues: true, auto_resolve_children: true,
      }).select('id').single()
      if (court1?.id) {
        tennisCourtIds.push(court1.id as string)
        const { data: linkedCourts } = await db.from('bookables').insert(
          [2, 3, 4].map((n, i) => ({
            org_id: orgId.value, name: `Court ${n}`, type: 'VENUE', status: 'ACTIVE',
            is_public: true, master_id: court1.id, parent_id: tennisCourts.id, sort_order: i + 1,
            allow_sub_venues: true, auto_resolve_children: true,
          })),
        ).select('id, sort_order')
        const orderedLinked = ((linkedCourts ?? []) as { id: string; sort_order: number }[])
          .sort((a, b) => a.sort_order - b.sort_order)
        for (const lc of orderedLinked) tennisCourtIds.push(lc.id)

        // Quarters per court — Q1 of Court 1 is the overall master; each
        // subsequent court's Q1-Q4 chains via master_id back to Court 1's
        // Q1-Q4 so an edit on the master cascades to siblings.
        const quarterNames = ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4']
        const masterQuarterIds: string[] = []
        for (let qi = 0; qi < quarterNames.length; qi++) {
          const isMaster = qi === 0
          const { data: q } = await db.from('bookables').insert({
            org_id: orgId.value, name: quarterNames[qi], type: 'VENUE', status: 'ACTIVE',
            is_public: true,
            parent_id: court1.id,
            is_master: isMaster,
            master_id: isMaster ? null : masterQuarterIds[0],
            max_concurrent: 1,
          }).select('id').single()
          if (q?.id) masterQuarterIds.push(q.id as string)
        }
        tennisQuartersByCourt[court1.id as string] = masterQuarterIds

        for (const lc of orderedLinked) {
          const linkedQuarterIds: string[] = []
          for (let qi = 0; qi < quarterNames.length; qi++) {
            const { data: q } = await db.from('bookables').insert({
              org_id: orgId.value, name: quarterNames[qi], type: 'VENUE', status: 'ACTIVE',
              is_public: true,
              parent_id: lc.id,
              is_master: false,
              master_id: masterQuarterIds[qi],
              max_concurrent: 1,
            }).select('id').single()
            if (q?.id) linkedQuarterIds.push(q.id as string)
          }
          tennisQuartersByCourt[lc.id] = linkedQuarterIds
        }

        // Save Halves + Quarters configurations on every court via the
        // shared composable — same path SetupWizard uses, so the schema
        // is identical to a wizard-built setup.
        const { saveConfiguration } = useBookableConfigurations()
        for (const courtId of tennisCourtIds) {
          const qIds = tennisQuartersByCourt[courtId]
          if (!qIds || qIds.length !== 4) continue
          await saveConfiguration(courtId, 'halves', 'Halves', [
            { name: 'Half A', childIds: [qIds[0], qIds[1]] },
            { name: 'Half B', childIds: [qIds[2], qIds[3]] },
          ])
          await saveConfiguration(courtId, 'quads', 'Quarters', qIds.map((cid, i) => ({
            name: `Quarter ${i + 1}`, childIds: [cid],
          })))
        }
      }
    }

    const { data: hall } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Hall', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: 'Multi-purpose hall for indoor sports, classes, and large events.',
      parent_id: clubRoomsId, sort_order: 4, max_concurrent: 1,
    }).select('id').single()
    const hallId = hall?.id as string | undefined

    const { data: cricketNets } = await db.from('bookables').insert({
      org_id: orgId.value, name: 'Cricket Nets', type: 'VENUE', status: 'ACTIVE',
      is_public: true, description: '4 practice nets for batting and bowling drills.',
      sort_order: 5, default_booking_view: 'scheduler', show_in_menu: true,
    }).select('id').single()
    // Capture cricket net IDs so the cricket coach's modes can pool them
    // as their required-venue option set later in this seed.
    const cricketNetIds: string[] = []
    if (cricketNets?.id) {
      const { data: net1 } = await db.from('bookables').insert({
        org_id: orgId.value, name: 'Net 1', type: 'VENUE', status: 'ACTIVE',
        is_public: true, is_master: true, parent_id: cricketNets.id, sort_order: 0,
      }).select('id').single()
      if (net1?.id) {
        cricketNetIds.push(net1.id)
        const { data: extras } = await db.from('bookables').insert(
          [2, 3, 4].map((n, i) => ({
            org_id: orgId.value, name: `Net ${n}`, type: 'VENUE', status: 'ACTIVE',
            is_public: true, master_id: net1.id, parent_id: cricketNets.id, sort_order: i + 1,
          }))
        ).select('id')
        for (const r of (extras ?? [])) cricketNetIds.push(r.id)
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

    // Rentable items. Bowling Machine is captured by id so the cricket
    // coach's "Net session" mode can flag it as required equipment
    // (auto-reserved alongside the booking).
    const { data: insertedItems, error: itemsError } = await db.from('bookables').insert([
      { org_id: orgId.value, name: 'Marquee',              type: 'ITEM', status: 'ACTIVE', is_public: true,  item_category: 'Equipment', description: '6m × 12m marquee for outdoor events. Advance booking required.', max_concurrent: 1, sort_order: 10 },
      { org_id: orgId.value, name: 'Lawn Mower',           type: 'ITEM', status: 'ACTIVE', is_public: false, item_category: 'Grounds',   description: 'Club ride-on mower. Authorised staff only.',                    max_concurrent: 1, sort_order: 11 },
      { org_id: orgId.value, name: 'PA System',            type: 'ITEM', status: 'ACTIVE', is_public: true,  item_category: 'Equipment', description: 'Portable PA system with 2 speakers and microphone.',            max_concurrent: 1, sort_order: 12 },
      { org_id: orgId.value, name: 'Projector & Screen',   type: 'ITEM', status: 'ACTIVE', is_public: true,  item_category: 'Equipment', description: 'HD projector with 2m pull-down screen.',                        max_concurrent: 1, sort_order: 13 },
      { org_id: orgId.value, name: 'Fold-out Tables (x10)',type: 'ITEM', status: 'ACTIVE', is_public: true,  item_category: 'Furniture', description: 'Pack of 10 rectangular fold-out tables.',                       max_concurrent: 1, sort_order: 14 },
      { org_id: orgId.value, name: 'Chairs (x50)',         type: 'ITEM', status: 'ACTIVE', is_public: true,  item_category: 'Furniture', description: 'Stack of 50 plastic chairs.',                                   max_concurrent: 1, sort_order: 15 },
      { org_id: orgId.value, name: 'Bowling Machine',      type: 'ITEM', status: 'ACTIVE', is_public: true,  item_category: 'Equipment', description: 'Cricket bowling machine — programmable.',                       max_concurrent: 2, sort_order: 16 },
    ]).select('id, name')
    if (itemsError) throw new Error(`Rentable items insert failed: ${itemsError.message}`)
    const bowlingMachineId = (insertedItems ?? []).find((i: any) => i.name === 'Bowling Machine')?.id as string | undefined

    // Staff coaches as PERSON bookables — each gets their own owning
    // activity (staff_bookable_id set) plus a couple of mode "offerings"
    // so the "What I offer" tab is populated end-to-end.
    const coachNames = coachPersons?.length
      ? coachPersons.map((p: any) => `${p.first_name} ${p.last_name}`)
      : ['James Carter', 'Sarah Mitchell']
    const { data: insertedCoaches } = await db.from('bookables').insert(
      coachNames.map((name: string, i: number) => ({
        org_id: orgId.value, name,
        type: 'PERSON', status: 'ACTIVE', is_public: false,
        description: 'Club coach', sort_order: i,
      })),
    ).select('id, name')

    // Per-coach offerings. The first coach is the cricket / hitting coach
    // (uses cricket nets — these will exist in this seed too — and a
    // bowling machine). The second coach is a tennis coach. Adjust mode
    // shape if you want different defaults; this is just demo seed.
    const coachOfferings: Record<string, { category: string; modes: any[] }> = {
      'James Carter': {
        category: 'Cricket',
        modes: [
          { name: 'Net session',     period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 80,  sort_order: 0 },
          { name: '1-on-1 coaching', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 100, sort_order: 1 },
        ],
      },
      'Sarah Mitchell': {
        category: 'Tennis',
        modes: [
          { name: '30-min lesson', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 60,  sort_order: 0 },
          { name: '60-min lesson', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 100, sort_order: 1 },
        ],
      },
    }
    for (const coach of insertedCoaches ?? []) {
      const cfg = coachOfferings[coach.name as string]
      if (!cfg) continue
      // 1. Owning activity — same name as the coach, staff_bookable_id set.
      const { data: actRow } = await db.from('activities').insert({
        org_id: orgId.value,
        name: coach.name,
        status: 'ACTIVE',
        bookings_enabled: true,
        booking_flow: 'wizard',
        require_mode: true,
        staff_bookable_id: coach.id,
        color: '#1E2157',
        icon: 'pi-user',
      }).select('id').single()
      if (!actRow?.id) continue
      // 2. Link the coach as the only resource on this activity.
      await db.from('activity_bookables').insert({ activity_id: actRow.id, bookable_id: coach.id })
      // 3. Modes — tagged with the category so the booker's "By service"
      //    cards group all coaches teaching the same thing together.
      const { data: insertedModes } = await db.from('activity_modes').insert(
        cfg.modes.map(m => ({ ...m, activity_id: actRow.id, category: cfg.category })),
      ).select('id, name')
      // 4. Wire venue requirements + required equipment per mode. Cricket
      //    coach modes pool the cricket nets; "Net session" also auto-
      //    reserves a bowling machine (locked equipment row at booking
      //    time). Tennis coach uses tennis-court-style venues — wired
      //    elsewhere when those exist; for now the tennis coach has none.
      for (const mode of insertedModes ?? []) {
        if (cfg.category === 'Cricket' && cricketNetIds.length) {
          await db.from('activity_mode_resources').insert(
            cricketNetIds.map((bid, i) => ({ mode_id: mode.id, bookable_id: bid, sort_order: i })),
          )
          if (mode.name === 'Net session' && bowlingMachineId) {
            await db.from('activity_mode_required_items').insert({
              mode_id: mode.id,
              bookable_id: bowlingMachineId,
              quantity: 1,
              sort_order: 0,
            })
          }
        }
      }
    }

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

    // ── Booking form (used by activity modes — e.g. Birthdays Boys) ─────
    const { data: bookingForm } = await db.from('registration_forms')
      .insert({
        org_id: orgId.value,
        name: 'Booking form',
        config: {
          settings: { layout: 'single', formHeading: 'Fill in the form to register', submitLabel: 'Submit', confirmMessage: '' },
          fieldMeta: {
            'First Name':       { core: 'first_name', col_span: 1, has_helper_text: false },
            'Last Name':        { core: 'last_name',  col_span: 1, has_helper_text: false },
            'Email Address':    { core: 'email',      col_span: 2, has_helper_text: false },
            'Phone Number':     { core: 'phone',      col_span: 1, has_helper_text: false },
            'People Attending': { core: 'attendees',  col_span: 1, has_helper_text: true },
            'Notes':            { core: 'notes',      col_span: 2, has_helper_text: false },
            'Medical Notes':    { col_span: 2, has_helper_text: false },
          },
          terms: [],
          sectionSaved: { settings: true, fields: true, terms: true, payment: false },
        },
      })
      .select('id').single()
    if (bookingForm?.id) {
      await db.from('form_fields').insert([
        { form_id: bookingForm.id, field_type: 'SHORT_TEXT', label: 'First Name',       placeholder: 'John',            is_required: true,  is_event_only: true, sort_order: 0, page_number: 1 },
        { form_id: bookingForm.id, field_type: 'SHORT_TEXT', label: 'Last Name',        placeholder: 'Smith',           is_required: true,  is_event_only: true, sort_order: 1, page_number: 1 },
        { form_id: bookingForm.id, field_type: 'SHORT_TEXT', label: 'Email Address',    placeholder: 'you@example.com', is_required: true,  is_event_only: true, sort_order: 2, page_number: 1 },
        { form_id: bookingForm.id, field_type: 'NUMBER',     label: 'People Attending', placeholder: '1', help_text: 'How many people are attending?', is_required: false, is_event_only: true, sort_order: 3, page_number: 1 },
        { form_id: bookingForm.id, field_type: 'SHORT_TEXT', label: 'Phone Number',     placeholder: '+64…',            is_required: false, is_event_only: true, sort_order: 4, page_number: 1 },
        { form_id: bookingForm.id, field_type: 'LONG_TEXT',  label: 'Medical Notes',                                    is_required: false, is_event_only: true, sort_order: 5, page_number: 1 },
      ])
    }

    // ── Activities + modes — every activity below mirrors what
    //    SetupWizard would write: scheduler booking_flow, configuration_key
    //    on slot-bound modes, explicit activity_mode_bookables scope.
    const { data: birthdaysAct } = await db.from('activities').insert({
      org_id: orgId.value, name: 'Birthdays', color: '#F59E0B', icon: 'pi-bolt',
      status: 'ACTIVE', bookings_enabled: true, approval_mode: 'manual',
      booking_flow: 'wizard', require_mode: true,
      area_name_singular: 'Hall',
      area_name_plural: 'Halls',
    }).select('id').single()
    const { data: tennisAct } = await db.from('activities').insert({
      org_id: orgId.value, name: 'Tennis', color: '#84CC16', icon: 'pi-bolt',
      status: 'ACTIVE', bookings_enabled: true, approval_mode: 'auto',
      booking_flow: 'scheduler', require_mode: true,
      area_name_singular: 'Court',
      area_name_plural: 'Courts',
    }).select('id').single()
    const { data: footballAct } = await db.from('activities').insert({
      org_id: orgId.value, name: 'Football', color: '#10B981', icon: 'pi-bolt',
      status: 'ACTIVE', bookings_enabled: true, approval_mode: 'auto',
      booking_flow: 'scheduler', require_mode: true,
      area_name_singular: 'Field',
      area_name_plural: 'Fields',
    }).select('id').single()
    const { data: swimmingAct } = await db.from('activities').insert({
      org_id: orgId.value, name: 'Swimming', color: '#0EA5E9', icon: 'pi-bolt',
      status: 'ACTIVE', bookings_enabled: true, approval_mode: 'auto',
      booking_flow: 'scheduler', require_mode: true,
      area_name_singular: 'Lane',
      area_name_plural: 'Lanes',
    }).select('id').single()

    // activity_bookables — link each activity to the venues it can be
    // booked on. Children (quarters / halves / lanes) inherit through
    // configuration_key resolution at booking time, so we link the parent
    // bookable rather than every sub-venue.
    if (hallId && birthdaysAct?.id) {
      await db.from('activity_bookables').insert({
        activity_id: birthdaysAct.id, bookable_id: hallId,
      })
    }
    if (tennisAct?.id && tennisCourtIds.length) {
      await db.from('activity_bookables').insert(
        tennisCourtIds.map(bid => ({ activity_id: tennisAct.id, bookable_id: bid })),
      )
    }
    if (footballAct?.id && footballFieldIds.length) {
      await db.from('activity_bookables').insert(
        footballFieldIds.map(bid => ({ activity_id: footballAct.id, bookable_id: bid })),
      )
    }
    if (swimmingAct?.id && competitionPoolId) {
      await db.from('activity_bookables').insert({
        activity_id: swimmingAct.id, bookable_id: competitionPoolId,
      })
    }

    // Default payment options for seeded modes — shared across every row
    // in each batch so PostgREST doesn't fill `null` on rows that omit
    // the key (NOT NULL constraint on activity_modes.payment_options).
    const seedPaymentOptions = { bank: true, card: true, cash: true, coupon: false, invoice: true, credit_card: true, payment_plan: false }

    if (birthdaysAct?.id) {
      const { data: birthdayModes, error: bdayModesErr } = await db.from('activity_modes').insert([
        {
          activity_id: birthdaysAct.id, name: 'Boys', color: '#3B82F6', sort_order: 0,
          allow_visitors: false, approval_mode: 'INSTANT',
          form_id: bookingForm?.id ?? null,
          default_booking_view: 'listWeek',
          payment_options: seedPaymentOptions,
          configuration_key: null,
          pricing: { base: [], tiers: [], per_hour: [], per_person: [] },
          addons: [
            { id: crypto.randomUUID(), name: 'Cake Small',   type: 'fee_base',       description: '', qty_available: null,
              fees: [{ id: crypto.randomUUID(), name: 'Small Cake', amount: 180, xero_code: '' }] },
            { id: crypto.randomUUID(), name: 'Cake Large',   type: 'fee_base',       description: '', qty_available: null,
              fees: [{ id: crypto.randomUUID(), name: 'Large Cake', amount: 250, xero_code: '' }] },
            { id: crypto.randomUUID(), name: 'Food Package', type: 'fee_per_person', description: '', qty_available: null,
              fees: [{ id: crypto.randomUUID(), name: 'Food Package - small', amount: 10, xero_code: '' }] },
          ],
        },
        {
          activity_id: birthdaysAct.id, name: 'Girls', color: '#EC4899', sort_order: 1,
          allow_visitors: false, approval_mode: 'INSTANT',
          form_id: null,
          default_booking_view: null,
          payment_options: seedPaymentOptions,
          configuration_key: null,
          pricing: { base: [], tiers: [], per_hour: [], per_person: [] }, addons: [],
        },
      ]).select('id')
      if (bdayModesErr) throw new Error(`Birthdays modes seed failed: ${bdayModesErr.message}`)

      // Both Boys/Girls modes book the whole hall — explicit scope for
      // consistency with the wizard pattern.
      if (birthdayModes?.length && hallId) {
        const scopeRows = (birthdayModes as { id: string }[]).map(m => ({ mode_id: m.id, bookable_id: hallId }))
        const { error: scopeErr } = await db.from('activity_mode_bookables').insert(scopeRows)
        if (scopeErr) throw new Error(`Birthdays mode-scope seed failed: ${scopeErr.message}`)
      }
    }

    // Tennis modes — mirror the SetupWizard's preset modes for tennis so
    // the seed produces the same schema a wizard run would. Singles /
    // Doubles use the whole court; Mini-tennis requires the Halves
    // configuration; Kids coaching requires the Quarters configuration.
    if (tennisAct?.id) {
      const tennisModeRows = [
        { name: 'Singles',       color: '#F97316', requires: null     },
        { name: 'Doubles',       color: '#0EA5E9', requires: null     },
        { name: 'Mini-tennis',   color: '#14B8A6', requires: 'halves' },
        { name: 'Kids coaching', color: '#A855F7', requires: 'quads'  },
        { name: 'Practice',      color: '#3B82F6', requires: null     },
      ]
      const { data: tennisInsertedModes, error: tennisModesErr } = await db.from('activity_modes').insert(
        tennisModeRows.map((m, i) => ({
          activity_id: tennisAct.id,
          name: m.name,
          color: m.color,
          sort_order: i,
          allow_visitors: false,
          approval_mode: 'INSTANT',
          configuration_key: m.requires,
          payment_options: seedPaymentOptions,
          pricing: { base: [], tiers: [], per_hour: [], per_person: [] },
          addons: [],
        })),
      ).select('id')
      if (tennisModesErr) throw new Error(`Tennis modes seed failed: ${tennisModesErr.message}`)

      // Per-mode bookable scope — every mode is bookable on every court.
      // Matches the explicit-scope behaviour the wizard now writes.
      if (tennisInsertedModes?.length && tennisCourtIds.length) {
        const scopeRows = (tennisInsertedModes as { id: string }[]).flatMap(m =>
          tennisCourtIds.map(bid => ({ mode_id: m.id, bookable_id: bid })),
        )
        const { error: scopeErr } = await db.from('activity_mode_bookables').insert(scopeRows)
        if (scopeErr) throw new Error(`Tennis mode-scope seed failed: ${scopeErr.message}`)
      }
    }

    // Football modes — Match books the full pitch; Small-sided games book
    // a half (Halves configuration on each field). Mirrors SetupWizard's
    // football preset.
    if (footballAct?.id) {
      const footballModeRows = [
        { name: 'Match',            color: '#10B981', requires: null     },
        { name: 'Small-sided game', color: '#0EA5E9', requires: 'halves' },
        { name: 'Training',         color: '#3B82F6', requires: null     },
      ]
      const { data: footballInsertedModes, error: footballModesErr } = await db.from('activity_modes').insert(
        footballModeRows.map((m, i) => ({
          activity_id: footballAct.id,
          name: m.name,
          color: m.color,
          sort_order: i,
          allow_visitors: false,
          approval_mode: 'INSTANT',
          configuration_key: m.requires,
          payment_options: seedPaymentOptions,
          pricing: { base: [], tiers: [], per_hour: [], per_person: [] },
          addons: [],
        })),
      ).select('id')
      if (footballModesErr) throw new Error(`Football modes seed failed: ${footballModesErr.message}`)

      if (footballInsertedModes?.length && footballFieldIds.length) {
        const scopeRows = (footballInsertedModes as { id: string }[]).flatMap(m =>
          footballFieldIds.map(bid => ({ mode_id: m.id, bookable_id: bid })),
        )
        const { error: scopeErr } = await db.from('activity_mode_bookables').insert(scopeRows)
        if (scopeErr) throw new Error(`Football mode-scope seed failed: ${scopeErr.message}`)
      }
    }

    // Swimming modes — Pool hire books the whole Competition Pool (parent-
    // child mutex blocks every lane); Lane swim resolves "Any free lane"
    // through the Lanes-4 configuration.
    if (swimmingAct?.id && competitionPoolId) {
      const swimmingModeRows = [
        { name: 'Pool hire',       color: '#0EA5E9', requires: null      },
        { name: 'Lane swim',       color: '#06B6D4', requires: 'lanes-4' },
        { name: 'Squad training',  color: '#3B82F6', requires: 'lanes-4' },
      ]
      const { data: swimmingInsertedModes, error: swimmingModesErr } = await db.from('activity_modes').insert(
        swimmingModeRows.map((m, i) => ({
          activity_id: swimmingAct.id,
          name: m.name,
          color: m.color,
          sort_order: i,
          allow_visitors: false,
          approval_mode: 'INSTANT',
          configuration_key: m.requires,
          payment_options: seedPaymentOptions,
          pricing: { base: [], tiers: [], per_hour: [], per_person: [] },
          addons: [],
        })),
      ).select('id')
      if (swimmingModesErr) throw new Error(`Swimming modes seed failed: ${swimmingModesErr.message}`)

      if (swimmingInsertedModes?.length) {
        const scopeRows = (swimmingInsertedModes as { id: string }[]).map(m => ({
          mode_id: m.id, bookable_id: competitionPoolId,
        }))
        const { error: scopeErr } = await db.from('activity_mode_bookables').insert(scopeRows)
        if (scopeErr) throw new Error(`Swimming mode-scope seed failed: ${scopeErr.message}`)
      }
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
    const allCategoryNames = categoryDefs.map(c => c.name)
    const calendarDefs = [
      { name: 'Main Calendar', sort_order: 0, categories: allCategoryNames },
      { name: 'Club Events',   sort_order: 1, categories: ['Social', 'Community', 'Administration'] },
      { name: 'Committee',     sort_order: 2, categories: ['Administration'] },
      { name: 'Sport',         sort_order: 3, categories: ['Training', 'Trainings', 'Competition', 'Development'] },
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

    // ── Availability rules for venues and staff ──
    // Each venue/court/lane/net/field gets opening hours; coaches get working hours.
    const { data: allBookables } = await db.from('bookables')
      .select('id, name, type, parent_id')
      .eq('org_id', orgId.value)
      .in('type', ['VENUE', 'PERSON'])

    const availabilityRows: any[] = []
    const allDays = [0, 1, 2, 3, 4, 5, 6]
    const weekdays = [0, 1, 2, 3, 4]

    function rule(bookable_id: string, name: string, days: number[], from: string, to: string) {
      return {
        bookable_id,
        name,
        rule_type: 'OPEN',
        days_of_week: days,
        time_slots: [{ from, to }],
        is_active: true,
      }
    }

    for (const b of allBookables ?? []) {
      const n = (b.name || '').toLowerCase()
      if (b.type === 'PERSON') {
        availabilityRows.push(rule(b.id, 'After-school coaching', weekdays, '17:00', '20:00'))
        availabilityRows.push(rule(b.id, 'Saturday morning', [5], '09:00', '13:00'))
      } else if (n.startsWith('court ')) {
        availabilityRows.push(rule(b.id, 'Open hours', allDays, '07:00', '22:00'))
      } else if (n.startsWith('lane ')) {
        availabilityRows.push(rule(b.id, 'Open hours', allDays, '05:30', '21:00'))
      } else if (n.startsWith('net ')) {
        availabilityRows.push(rule(b.id, 'Open hours', allDays, '09:00', '21:00'))
      } else if (n.startsWith('field ')) {
        availabilityRows.push(rule(b.id, 'Open hours', allDays, '08:00', '21:00'))
      } else if (n === 'club rooms' || n === 'hall') {
        availabilityRows.push(rule(b.id, 'Open hours', allDays, '08:00', '22:00'))
      } else if (n === 'tennis courts' || n === 'cricket nets' || n === 'football fields' || n === 'swimming pool' || n === 'competition pool') {
        availabilityRows.push(rule(b.id, 'Open hours', allDays, '07:00', '22:00'))
      } else if (b.type === 'VENUE') {
        // Catch-all: any other VENUE gets sensible default open hours so the
        // booking wizard always finds slots, even for venues we forgot to name-match.
        availabilityRows.push(rule(b.id, 'Open hours', allDays, '08:00', '22:00'))
      }
    }

    if (availabilityRows.length) {
      const arChunk = 200
      for (let i = 0; i < availabilityRows.length; i += arChunk) {
        await db.from('availability_rules').insert(availabilityRows.slice(i, i + arChunk))
      }
    }

    // ── Backfill EVENT_DRIVEN bookings for every event/session tied to a venue ──
    // This makes the venue calendars show the events that were just created.
    const { data: allEvents } = await db.from('events')
      .select('id, start_at, end_at, title, is_all_day, locations, location_type, bookable_id')
      .eq('org_id', orgId.value)
      .not('start_at', 'is', null)
    const { data: allSessions } = await db.from('sessions')
      .select('id, event_id, start_at, end_at, title, location_type, bookable_id')
      .in('event_id', (allEvents ?? []).map((e: any) => e.id))
      .not('start_at', 'is', null)

    const bookingRows: any[] = []
    for (const evt of allEvents ?? []) {
      const ids: string[] = []
      if (evt.locations?.length) {
        for (const loc of evt.locations) {
          if (loc.type === 'BOOKABLE') ids.push(...(loc.bookable_ids ?? []))
        }
      } else if (evt.location_type === 'BOOKABLE' && evt.bookable_id) {
        ids.push(evt.bookable_id)
      }
      for (const bid of ids) {
        bookingRows.push({
          bookable_id: bid, event_id: evt.id, type: 'EVENT_DRIVEN', status: 'CONFIRMED',
          start_at: evt.start_at, end_at: evt.end_at,
          purpose: evt.title, is_all_day: evt.is_all_day ?? false,
        })
      }
    }
    for (const s of allSessions ?? []) {
      if (s.location_type === 'BOOKABLE' && s.bookable_id) {
        bookingRows.push({
          bookable_id: s.bookable_id, event_id: s.event_id, session_id: s.id,
          type: 'EVENT_DRIVEN', status: 'CONFIRMED',
          start_at: s.start_at, end_at: s.end_at,
          purpose: s.title, is_all_day: false,
        })
      }
    }
    const bookingChunk = 200
    for (let i = 0; i < bookingRows.length; i += bookingChunk) {
      await db.from('bookings').insert(bookingRows.slice(i, i + bookingChunk))
    }

    toast.add({ severity: 'success', summary: 'Demo events created', detail: `11 events, ${availabilityRows.length} availability rules & ${bookingRows.length} venue bookings seeded.`, life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Seed failed', detail: e?.message ?? 'Unknown error', life: 5000 })
  } finally {
    seedingEvents.value = false
  }
}

const resetting = ref(false)

async function resetDatabase() {
  const ok = confirm('Reset the database? This will delete all events, venues, bookings, activities, booking discounts, registrations, forms, fees, event discounts, and related data for your organisation. People and member groups will be kept. This cannot be undone.')
  if (!ok) return
  resetting.value = true
  try {
    const oid = orgId.value
    const db2 = (table: string) => (db.from as any)(table)

    // Helper: skip delete when no parent IDs exist (avoids deleting unrelated rows)
    const del = async (table: string, col: string, ids: string[]) => {
      if (!ids.length) return
      await db2(table).delete().in(col, ids)
    }

    // 1. Fetch parent IDs for this org so children can be scoped
    const [evRes, regRes, formRes, cgRes, calRes, bRes] = await Promise.all([
      db2('events').select('id').eq('org_id', oid),
      db2('registrations').select('id').eq('org_id', oid),
      db2('registration_forms').select('id').eq('org_id', oid),
      db2('connection_groups').select('id').eq('org_id', oid),
      db2('calendars').select('id').eq('org_id', oid),
      db2('bookables').select('id').eq('org_id', oid),
    ])
    const eIds  = (evRes.data   ?? []).map((r: any) => r.id)
    const rIds  = (regRes.data  ?? []).map((r: any) => r.id)
    const fIds  = (formRes.data ?? []).map((r: any) => r.id)
    const cgIds = (cgRes.data   ?? []).map((r: any) => r.id)
    const calIds= (calRes.data  ?? []).map((r: any) => r.id)
    const bIds  = (bRes.data    ?? []).map((r: any) => r.id)

    // Fetch session IDs (needed to scope their children)
    const [sessRes] = await Promise.all([
      eIds.length  ? db2('sessions').select('id').in('event_id', eIds) : { data: [] },
    ])
    const sessIds  = (sessRes.data   ?? []).map((r: any) => r.id)

    // 2. Delete deepest children first, all scoped to this org's data
    await Promise.all([
      del('bookable_modes', 'bookable_id', bIds),
      // Event children
      del('access_scans',       'event_id',       eIds),
      del('physical_schedules', 'event_id',       eIds),
      del('ticket_types',       'event_id',       eIds),
      del('connection_group_events', 'event_id',  eIds),
      // Session children
      del('attendance', 'session_id', sessIds),
      // Registration children
      del('registration_ticket_items', 'registration_id', rIds),
      del('registration_sessions',     'registration_id', rIds),
      del('transactions',              'registration_id', rIds),
      // Form children
      del('form_fields', 'form_id', fIds),
      // Connection group children
      del('connection_group_events', 'connection_group_id', cgIds),
      // Calendar children
      del('calendar_categories', 'calendar_id', calIds),
      // Bookable-scoped (no org_id column — must be deleted before bookables)
      del('bookings',            'bookable_id', bIds),
      del('availability_rules',  'bookable_id', bIds),
      del('bookable_closures',   'bookable_id', bIds),
    ])

    // 3. Delete mid-level children
    await Promise.all([
      del('sessions', 'event_id', eIds),
    ])

    // 4. Delete all org-scoped tables in dependency order
    const orgScoped = [
      'audit_log', 'lighting_profiles', 'tasks', 'communications',
      'registrations', 'registration_forms',
      'discounts', 'addons', 'fee_rules', 'fee_components',
      'invitees', 'connection_groups',
      'booking_discounts', 'activities',
      'events', 'bookables',
      'calendars', 'categories',
    ]
    for (const table of orgScoped) {
      await db2(table).delete().eq('org_id', oid)
    }

    toast.add({ severity: 'success', summary: 'Database reset', detail: 'All data except people has been cleared.', life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Reset failed', detail: e?.message ?? 'Unknown error', life: 5000 })
  } finally {
    resetting.value = false
  }
}

onMounted(async () => {
  await load()
  // Returning from /forms with ?form_id=… — apply it as the default and save.
  const returningId = (useRoute().query.form_id as string | undefined) ?? null
  if (returningId && returningId !== org.value.default_form_id) {
    org.value.default_form_id = returningId
    await saveDefaultForm()
  }
})
</script>
