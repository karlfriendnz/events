<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 settings-fill">
        <Tabs :value="activeTab">
          <TabPanels>

        <!-- ── GENERAL ── -->
        <TabPanel value="general" class="space-y-4 max-w-3xl">
          <div class="mb-1">
            <h1 class="text-xl font-semibold text-gray-900">General</h1>
            <p class="text-sm text-gray-500">Your organisation's name, level and currency.</p>
          </div>
          <div class="card p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-4">Organisation</h2>
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Organisation Name</label>
                <InputText v-model="org.name" />
              </div>
              <!-- Branding: full logo (wordmark) + square icon (app/favicon style) -->
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Branding</label>
                <div class="flex gap-6">
                  <div class="flex flex-col gap-1.5">
                    <span class="text-xs text-surface-500">Logo</span>
                    <div class="flex items-center gap-2">
                      <label class="w-28 h-14 shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-300 relative">
                        <img v-if="org.logo_url" :src="org.logo_url" class="w-full h-full object-contain" />
                        <i v-else :class="['pi', uploadingLogo ? 'pi-spin pi-spinner' : 'pi-image', 'text-gray-300']" />
                        <input type="file" accept="image/*" class="hidden" @change="e => onOrgImage('logo', e)" />
                      </label>
                      <button v-if="org.logo_url" type="button" class="text-xs text-gray-400 hover:text-red-500" @click="clearOrgImage('logo')">Remove</button>
                    </div>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <span class="text-xs text-surface-500">Icon</span>
                    <div class="flex items-center gap-2">
                      <label class="w-14 h-14 shrink-0 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-300 relative">
                        <img v-if="org.icon_url" :src="org.icon_url" class="w-full h-full object-cover" />
                        <i v-else :class="['pi', uploadingIcon ? 'pi-spin pi-spinner' : 'pi-image', 'text-gray-300']" />
                        <input type="file" accept="image/*" class="hidden" @change="e => onOrgImage('icon', e)" />
                      </label>
                      <button v-if="org.icon_url" type="button" class="text-xs text-gray-400 hover:text-red-500" @click="clearOrgImage('icon')">Remove</button>
                    </div>
                  </div>
                </div>
                <p class="text-xs text-surface-400">Logo is the full wordmark; the icon is a square mark used in compact spots (sidebar, tabs).</p>

                <!-- Club brand colours (migration 179). Drive branded surfaces like the
                     invitation email header. Background = the club colour; Text = what sits on it. -->
                <div class="flex flex-col sm:flex-row gap-5 mt-2">
                  <div class="flex items-center gap-3">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-xs font-medium text-surface-600">Background color</span>
                      <span class="text-[11px] text-surface-400 uppercase">{{ (org.brand_color || '#1E2157').replace('#','') }}</span>
                    </div>
                    <label class="relative w-9 h-9 rounded-lg border border-gray-200 shrink-0 cursor-pointer overflow-hidden"
                      :style="{ background: org.brand_color || '#1E2157' }">
                      <input type="color" :value="org.brand_color || '#1E2157'" @input="e => org.brand_color = (e.target as HTMLInputElement).value"
                        class="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-xs font-medium text-surface-600">Text color</span>
                      <span class="text-[11px] text-surface-400 uppercase">{{ (org.brand_text_color || '#FFFFFF').replace('#','') }}</span>
                    </div>
                    <label class="relative w-9 h-9 rounded-lg border border-gray-200 shrink-0 cursor-pointer overflow-hidden"
                      :style="{ background: org.brand_text_color || '#FFFFFF' }">
                      <input type="color" :value="org.brand_text_color || '#FFFFFF'" @input="e => org.brand_text_color = (e.target as HTMLInputElement).value"
                        class="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                  </div>
                  <!-- Live swatch preview -->
                  <div class="flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shrink-0"
                    :style="{ background: org.brand_color || '#1E2157', color: org.brand_text_color || '#FFFFFF' }">
                    {{ org.name || 'Club' }}
                  </div>
                </div>
                <p class="text-xs text-surface-400">Your club's brand colours — used on branded surfaces like the invitation email header.</p>
              </div>
              <!-- Governing bodies set their parent directly here. Clubs set it via the
                   Sports card below (each sport → its NSO), so nothing shows here for them. -->
              <div v-if="isGoverningBody(org.org_level)" class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Parent organisation</label>
                <p class="text-xs text-surface-500 -mt-0.5">The body this organisation reports up to (e.g. a regional → its association). Builds the full chain up to the national body. Drives shared categories, fields, branding, and cross-org reporting.</p>
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
              <!-- Default sport name (governing bodies only) — seeds the name member
                   clubs see when they connect; they can override it locally. -->
              <div v-if="isGoverningBody(org.org_level)" class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Default sport name</label>
                <p class="text-xs text-surface-500 -mt-0.5">The sport this body governs. Member clubs see this as the default name when they connect — they can rename it locally.</p>
                <InputText v-model="org.default_sport_name" placeholder="e.g. Cricket" />
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

          <!-- Contact details (migration 251) -->
          <div class="card p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-4">Contact details</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Full name</label>
                <InputText v-model="org.name" placeholder="Organisation name" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Short name</label>
                <InputText v-model="org.short_name" placeholder="A shorter display name" />
              </div>
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label class="text-sm font-medium">Address</label>
                <Textarea v-model="org.address" rows="2" auto-resize placeholder="Street, suburb, city, postcode" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Country</label>
                <InputText v-model="org.country" placeholder="e.g. New Zealand" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Timezone</label>
                <Select v-model="org.timezone" :options="tzOptions" option-label="label" option-value="value"
                  filter placeholder="Choose a timezone" class="w-full" show-clear />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Email address</label>
                <InputText v-model="org.email" type="email" placeholder="club@example.com" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium">Phone number</label>
                <InputText v-model="org.phone" placeholder="e.g. 027 537 4363" />
              </div>
              <div class="flex flex-col gap-1.5 sm:col-span-2">
                <label class="text-sm font-medium">Website</label>
                <InputText v-model="org.website" placeholder="https://yourclub.co.nz" />
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <Button label="Save contact details" :loading="savingOrg" @click="saveOrg" size="small" />
            </div>
          </div>

        </TabPanel>

        <!-- ── BOOKINGS ── -->
        <TabPanel value="bookings" class="space-y-4 max-w-3xl">
          <div class="mb-1">
            <h1 class="text-xl font-semibold text-gray-900">Bookings</h1>
            <p class="text-sm text-gray-500">Defaults applied across the booking flow.</p>
          </div>
          <div class="card p-5">
            <h2 class="text-sm font-semibold text-surface-700 mb-1">Default booking form</h2>
            <p class="text-xs text-surface-500 mb-3">Form used by every activity mode unless the mode picks its own. Holds the fields, terms &amp; conditions, and confirmation copy customers see at the Details step.</p>
            <div class="flex items-center gap-2">
              <Select v-model="org.default_form_id" :options="formOptions" option-label="label" option-value="value"
                placeholder="No default form (use built-in fields)" filter show-clear class="flex-1" />
              <Button v-if="org.default_form_id" label="Edit form" icon="pi pi-pencil" size="small" severity="secondary" outlined
                @click="navigateTo(`/forms/${org.default_form_id}?return=${encodeURIComponent($route.fullPath)}`)" />
              <Button label="New form" icon="pi pi-plus" size="small"
                style="background:var(--brand-primary);border-color:var(--brand-primary)"
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
                  class="w-24 h-9 px-2 text-xs font-mono uppercase border border-gray-200 rounded outline-none focus:border-primary" />
              </div>
              <div class="flex items-center gap-3">
                <input type="color" v-model="bookerTheme.primary"
                  class="w-12 h-10 rounded border border-gray-200 cursor-pointer shrink-0" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-800">Primary</p>
                  <p class="text-xs text-gray-400">Buttons, selected-state borders, brand accents.</p>
                </div>
                <input type="text" v-model="bookerTheme.primary" maxlength="7"
                  class="w-24 h-9 px-2 text-xs font-mono uppercase border border-gray-200 rounded outline-none focus:border-primary" />
              </div>
              <div class="flex items-center gap-3">
                <input type="color" v-model="bookerTheme.on_primary"
                  class="w-12 h-10 rounded border border-gray-200 cursor-pointer shrink-0" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-800">On primary</p>
                  <p class="text-xs text-gray-400">Text + icons drawn on top of the primary colour.</p>
                </div>
                <input type="text" v-model="bookerTheme.on_primary" maxlength="7"
                  class="w-24 h-9 px-2 text-xs font-mono uppercase border border-gray-200 rounded outline-none focus:border-primary" />
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
        <TabPanel value="events" class="space-y-4 max-w-3xl">
          <div class="mb-1">
            <h1 class="text-xl font-semibold text-gray-900">Events</h1>
            <p class="text-sm text-gray-500">Defaults applied to event registration.</p>
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

        <!-- ── RESOURCES ── -->
        <TabPanel value="resources" class="space-y-4 max-w-3xl">
          <div class="mb-1">
            <h1 class="text-xl font-semibold text-gray-900">Resources</h1>
            <p class="text-sm text-gray-500">Categories, calendars and venues.</p>
          </div>
          <div class="card p-5">
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
          <div class="card p-5">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-surface-700">Calendars</h3>
              <Button label="Manage" icon="pi pi-arrow-right" icon-pos="right" text size="small" @click="navigateTo('/settings/calendars')" />
            </div>
            <p class="text-sm text-surface-500">Named groupings of categories for calendar filtering.</p>
          </div>
          <div class="card p-5">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-surface-700">Venues</h3>
              <Button label="Manage" icon="pi pi-arrow-right" icon-pos="right" text size="small" @click="navigateTo('/settings/venues')" />
            </div>
            <p class="text-sm text-surface-500">Manage bookable venues, fields, and spaces.</p>
          </div>
        </TabPanel>

        <!-- ── ADVANCED ── -->
        <TabPanel value="advanced" class="space-y-4 max-w-3xl">
          <div class="mb-1">
            <h1 class="text-xl font-semibold text-gray-900">Advanced</h1>
            <p class="text-sm text-gray-500">Maintenance and data tools.</p>
          </div>
          <div class="card p-5">
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
      </div>
    </div>

    <!-- Bank Accounts Dialog -->
    <Dialog v-model:visible="showBankAccounts" header="Bank Accounts" modal :style="{ width: '95vw', maxWidth: '540px' }">
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
          style="background:var(--brand-primary);border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

// Every org-settings read/write — including the dev seed/reset tooling — goes through
// the seam composables now. No direct useDb() remains on this page.
const devSeedApi = useDevSeedApi()
const orgApi = useOrganisationsApi()
const eventsApi = useEventsApi()
const formsApi = useFormsApi()
const financesApi = useFinancesApi()
const toast = useToast()

// Active panel is driven by ?tab= so the shared <SettingsNav> tab bar controls it.
const route = useRoute()
const activeTab = computed(() => (route.query.tab as string) || 'general')

const org = ref<{
  name: string
  currency: string
  locale: string
  season_start: Date | null
  season_end: Date | null
  parent_id: string | null
  org_level: 'CLUB' | 'REGIONAL' | 'ASSOCIATION' | 'NATIONAL' | 'RST'
  default_sport_name: string | null
  club_type_ids: string[]
  logo_url: string | null
  icon_url: string | null
  brand_color: string | null
  brand_text_color: string | null
  default_form_id: string | null
  default_payment_method: string | null
  default_bank_account_id: string | null
  events_default_payment_method: string | null
  events_default_bank_account_id: string | null
  // Contact details (migration 251)
  short_name: string | null
  address: string | null
  country: string | null
  timezone: string | null
  email: string | null
  phone: string | null
  website: string | null
}>({
  name: 'Demo Club', currency: 'AUD', locale: 'en-AU',
  season_start: null, season_end: null,
  parent_id: null, org_level: 'CLUB', default_sport_name: null, club_type_ids: [],
  logo_url: null, icon_url: null, brand_color: null, brand_text_color: null,
  default_form_id: null, default_payment_method: null, default_bank_account_id: null,
  events_default_payment_method: null, events_default_bank_account_id: null,
  short_name: null, address: null, country: null, timezone: null, email: null, phone: null, website: null,
})

// Timezone options — the platform's full IANA list when available, else a small fallback.
const timezoneOptions = (() => {
  try { return (Intl as any).supportedValuesOf?.('timeZone') as string[] ?? [] } catch { return [] }
})()
const tzFallback = ['Pacific/Auckland', 'Australia/Sydney', 'Australia/Perth', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC']
const tzOptions = computed(() => (timezoneOptions.length ? timezoneOptions : tzFallback).map(z => ({ label: z.replace(/_/g, ' '), value: z })))

// Org hierarchy (Club -> Regional -> Association -> National)
const { buildChain } = useOrgHierarchy()
const allOrgs = ref<OrgNode[]>([])
const orgLevelOptions = (ORG_TYPE_OPTIONS as readonly string[]).map(v => ({ value: v, label: orgLevelLabel(v) }))
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
  const data = await financesApi.bankAccounts(orgId.value).catch(() => [])
  // Seam returns camelCase (id/name/details); the template reads id/name/details.
  bankAccounts.value = (data ?? []).map((b: any) => ({ id: b.id, name: b.name, details: b.details ?? null }))
}
async function saveBankAccounts() {
  savingBankAccounts.value = true
  try {
    const existingIds = (bankAccountsBackup as any[]).map(b => b.id)
    const currentIds = bankAccounts.value.map(b => b.id)
    const toDelete = existingIds.filter(id => !currentIds.includes(id))
    for (const delId of toDelete) await financesApi.removeBankAccount(delId, orgId.value)
    for (const b of bankAccounts.value) {
      if (!b.name?.trim()) continue
      if (b._new) {
        await financesApi.createBankAccount({ orgId: orgId.value, name: b.name.trim(), details: b.details || null })
      } else {
        await financesApi.updateBankAccount(b.id, { orgId: orgId.value, name: b.name.trim(), details: b.details || null })
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
  await orgApi.updateProfile(orgId.value, { defaultFormId: org.value.default_form_id || null })
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
  await orgApi.updateProfile(orgId.value, { bookerTheme: { ...bookerTheme.value } })
  toast.add({ severity: 'success', summary: 'Booker theme saved', life: 2500 })
  savingTheme.value = false
}
async function saveDefaultPayments() {
  savingPayments.value = true
  await orgApi.updateProfile(orgId.value, {
    defaultPaymentOptions: { ...defaultPaymentOptions.value },
    defaultPaymentMethod: org.value.default_payment_method || null,
    defaultBankAccountId: org.value.default_bank_account_id || null,
  })
  toast.add({ severity: 'success', summary: 'Booking payments saved', life: 2500 })
  savingPayments.value = false
}
async function saveEventsPayments() {
  savingEventsPayments.value = true
  await orgApi.updateProfile(orgId.value, {
    eventsDefaultPaymentOptions: { ...eventsPaymentOptions.value },
    eventsDefaultPaymentMethod: org.value.events_default_payment_method || null,
    eventsDefaultBankAccountId: org.value.events_default_bank_account_id || null,
  })
  toast.add({ severity: 'success', summary: 'Event payments saved', life: 2500 })
  savingEventsPayments.value = false
}
const categories = ref<any[]>([])
// Club types catalogue (created by super-admins in /admin) for the multi-select.
const clubTypes = ref<{ id: string; name: string }[]>([])
const { resolveInherited: resolveInheritedClubTypes } = useClubTypes()
const inheritedClubTypes = ref<{ id: string; name: string; from: string }[]>([])

const { loadCatalog: loadClubTypeCatalog } = useClubTypes()
async function loadClubTypes() {
  clubTypes.value = await loadClubTypeCatalog()
  inheritedClubTypes.value = orgId.value ? await resolveInheritedClubTypes(orgId.value, clubTypes.value) : []
}

async function load() {
  // The org GENERAL profile, event categories, the org's forms, and the full org
  // list (for the parent-candidate hierarchy) — all via the seam.
  const [profile, cats, forms, orgs] = await Promise.all([
    orgApi.getProfile(orgId.value),
    eventsApi.categories(orgId.value),
    formsApi.list(orgId.value),
    orgApi.list(),
  ])
  // allOrgs feeds parentCandidates/orgChain, which read snake_case OrgNode fields.
  allOrgs.value = orgs.map(o => ({ id: o.id, name: o.name, org_level: o.orgLevel, parent_id: o.parentId })) as OrgNode[]
  loadClubTypes()
  if (profile) {
    org.value = {
      name: profile.name,
      currency: profile.currency,
      locale: profile.locale,
      season_start: profile.seasonStart ? new Date(profile.seasonStart) : null,
      season_end: profile.seasonEnd ? new Date(profile.seasonEnd) : null,
      parent_id: profile.parentId ?? null,
      org_level: (profile.orgLevel ?? 'CLUB') as 'CLUB' | 'REGIONAL' | 'ASSOCIATION' | 'NATIONAL' | 'RST',
      default_sport_name: profile.defaultSportName ?? null,
      club_type_ids: profile.clubTypeIds ?? [],
      logo_url: profile.logoUrl ?? null,
      icon_url: profile.iconUrl ?? null,
      brand_color: profile.brandColor ?? null,
      brand_text_color: profile.brandTextColor ?? null,
      default_form_id: profile.defaultFormId ?? null,
      default_payment_method: profile.defaultPaymentMethod ?? null,
      default_bank_account_id: profile.defaultBankAccountId ?? null,
      events_default_payment_method: profile.eventsDefaultPaymentMethod ?? null,
      events_default_bank_account_id: profile.eventsDefaultBankAccountId ?? null,
      short_name: profile.shortName ?? null,
      address: profile.address ?? null,
      country: profile.country ?? null,
      timezone: profile.timezone ?? null,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      website: profile.website ?? null,
    }
    defaultPaymentOptions.value = {
      invoice: false, credit_card: false, payment_plan: false, coupon: false,
      ...(profile.defaultPaymentOptions ?? {}),
    }
    eventsPaymentOptions.value = {
      invoice: false, credit_card: false, payment_plan: false, coupon: false,
      ...(profile.eventsDefaultPaymentOptions ?? {}),
    }
    const t = (profile.bookerTheme ?? {}) as Partial<BookerTheme>
    bookerTheme.value = {
      canvas: t.canvas || '#F5F8FA',
      primary: t.primary || '#1E2157',
      on_primary: t.on_primary || '#FFFFFF',
    }
  }
  await loadBankAccounts()
  allForms.value = forms.map(f => ({ id: f.id, name: f.name }))
  categories.value = cats
}

function toIsoDate(d: Date | null): string | null {
  if (!d) return null
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const { uploadFile } = useUpload()
const uploadingLogo = ref(false)
const uploadingIcon = ref(false)
async function onOrgImage(kind: 'logo' | 'icon', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
  const busy = kind === 'logo' ? uploadingLogo : uploadingIcon
  busy.value = true
  try {
    const url = await uploadFile(file)
    if (kind === 'logo') org.value.logo_url = url; else org.value.icon_url = url
    await orgApi.updateProfile(orgId.value, kind === 'logo' ? { logoUrl: url } : { iconUrl: url })
    toast.add({ severity: 'success', summary: `${kind === 'logo' ? 'Logo' : 'Icon'} uploaded`, life: 1500 })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Upload failed', detail: err?.message, life: 4000 })
  } finally { busy.value = false }
}
async function clearOrgImage(kind: 'logo' | 'icon') {
  if (kind === 'logo') org.value.logo_url = null; else org.value.icon_url = null
  await orgApi.updateProfile(orgId.value, kind === 'logo' ? { logoUrl: null } : { iconUrl: null })
}

async function saveOrg() {
  savingOrg.value = true
  // SEAM GAP (organisations, CRIT-3 / gap A4): parent_id is NOT writable through the
  // general profile patch — re-parenting an org is a privileged, tenant-crossing act
  // that needs its own permission-checked setParent(orgId, parentId) route (currently a
  // documented done-domain fill). The parent select still updates org.value locally.
  await orgApi.updateProfile(orgId.value, {
    name: org.value.name,
    currency: org.value.currency,
    locale: org.value.locale,
    orgLevel: org.value.org_level,
    defaultSportName: org.value.default_sport_name?.trim() || null,
    clubTypeIds: org.value.club_type_ids ?? [],
    logoUrl: org.value.logo_url,
    iconUrl: org.value.icon_url,
    brandColor: org.value.brand_color,
    brandTextColor: org.value.brand_text_color,
    seasonStart: toIsoDate(org.value.season_start),
    seasonEnd: toIsoDate(org.value.season_end),
    shortName: org.value.short_name?.trim() || null,
    address: org.value.address?.trim() || null,
    country: org.value.country?.trim() || null,
    timezone: org.value.timezone || null,
    email: org.value.email?.trim() || null,
    phone: org.value.phone?.trim() || null,
    website: org.value.website?.trim() || null,
  })
  toast.add({ severity: 'success', summary: 'Organisation saved', life: 3000 })
  savingOrg.value = false
}


const seedingEvents = ref(false)

// Demo seed + reset now run through the dev seed/reset engine (server/db/seed/**,
// exposed via useDevSeedApi). The ~1250 lines of inline cross-domain useDb writes
// that lived here are gone — the engine populates the same kind of club (venues,
// activities, ~10 events with sessions, forms, discounts) through the repositories.
async function seedDemoEvents() {
  seedingEvents.value = true
  try {
    const summary = await devSeedApi.seed('demo-events', orgId.value)
    const counts = Object.entries(summary.created)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ')
    toast.add({ severity: 'success', summary: 'Demo data seeded', detail: counts || 'Done', life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Seed failed', detail: e?.data?.message ?? e?.message ?? 'Unknown error', life: 5000 })
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
    await devSeedApi.reset(orgId.value, 'org-data')
    toast.add({ severity: 'success', summary: 'Database reset', detail: 'All data except people has been cleared.', life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Reset failed', detail: e?.data?.message ?? e?.message ?? 'Unknown error', life: 5000 })
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
