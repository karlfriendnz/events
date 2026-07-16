<template>
  <!-- Rendered as a modal over the app — see new-basic.vue for the pattern. -->
  <Teleport to="body">
  <div class="app-modal-overlay fixed inset-0 flex items-stretch sm:items-center justify-center sm:p-6 bg-slate-900/45 backdrop-blur-[2px]"
    style="z-index: 1000">
  <div class="flex flex-col bg-white w-full h-full sm:h-[92vh] sm:max-w-[1200px] sm:rounded-xl shadow-2xl overflow-hidden">

    <!-- Step progress header -->
    <div class="bg-white border-b border-gray-200 shrink-0">
      <!-- Top bar: solid brand bar (matches the global dialog chrome) -->
      <div class="modal-header-bar flex items-center justify-between">
        <span class="modal-header-title">Create Advanced Event</span>
        <div class="flex items-center gap-3">
          <button class="text-sm font-medium text-white/80 hover:text-white" @click="saveDraft">
            <span class="hidden sm:inline">Save draft</span>
            <i class="pi pi-bookmark sm:hidden" />
          </button>
          <button
            class="w-7 h-7 rounded-md flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 transition-colors"
            aria-label="Close"
            @click="navigateTo('/events')">
            <i class="pi pi-times text-sm" />
          </button>
        </div>
      </div>

      <!-- Step indicators -->
      <div class="flex items-center px-4 md:px-6 pb-4 gap-0 overflow-x-auto">
        <template v-for="(step, idx) in steps" :key="idx">
          <div class="flex items-center gap-2 shrink-0 cursor-pointer" @click="idx < currentStep && (currentStep = idx)">
            <!-- Circle -->
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
              :class="idx < currentStep
                ? 'bg-primary text-white'
                : idx === currentStep
                  ? 'bg-primary text-white ring-4 ring-primary/20'
                  : 'bg-gray-100 text-gray-400'">
              <i v-if="idx < currentStep" class="pi pi-check text-[10px]" />
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <!-- Label -->
            <span class="text-xs font-medium whitespace-nowrap hidden sm:inline"
              :class="idx <= currentStep ? 'text-gray-800' : 'text-gray-400'">
              {{ step.label }}
            </span>
          </div>
          <!-- Connector line -->
          <div v-if="idx < steps.length - 1" class="flex-1 min-w-[16px] h-px mx-2 shrink-0"
            :class="idx < currentStep ? 'bg-primary' : 'bg-gray-200'" />
        </template>
      </div>
    </div>

    <!-- Step content (scrollable) -->
    <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div class="max-w-[1140px] mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">

        <!-- Step 0: Event Info — the SAME card as the basic wizard's first step
             (same order, same 120px label column, same date editor, same
             governing-body disciplines). Two builders asking for the same five
             things in two different shapes was just a thing to get wrong twice. -->
        <template v-if="currentStep === 0">
          <div class="mb-1">
            <h2 class="text-sm font-semibold text-gray-800">Event info</h2>
            <p class="text-xs text-gray-500 mt-0.5">Name the event, set when it runs, and how people find it.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Title -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div class="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-1.5 sm:gap-4">
                <label class="text-sm font-semibold text-gray-800">Event Title <span class="text-red-400">*</span></label>
                <InputText v-model="form.title" placeholder="Enter the name of your event" class="w-full" autofocus />
              </div>
            </div>
            <!-- Date -->
            <div class="px-5 py-4 border-b border-gray-100">
              <DateTimeEditor
                v-model:startDate="form.start_date"
                v-model:endDate="form.end_date"
                v-model:startTime="form.start_time"
                v-model:endTime="form.end_time"
                v-model:isAllDay="form.is_all_day"
                v-model:repeat="form.repeat"
                v-model:exdates="form.exdates"
                :minStartDate="today"
                :minEndDate="form.start_date ?? today"
                label="Date"
                required
                label-width="w-[120px]"
                label-class="text-gray-800 font-semibold"
                row-padding="px-0 py-2"
              />
              <!-- Why you can't proceed — a disabled Next with no reason is a dead end. -->
              <div v-if="dateInvalidReason && (form.title.trim() || form.start_date)" class="py-1 sm:pl-[136px]">
                <span class="inline-flex items-center gap-2 rounded-md bg-red-50 border border-red-100 px-2.5 py-1.5">
                  <i class="pi pi-exclamation-circle text-red-500 text-xs" />
                  <span class="text-xs font-medium text-red-600">{{ dateInvalidReason }}</span>
                </span>
              </div>
            </div>
            <!-- Description -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div class="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1.5 sm:gap-4">
                <label class="text-sm font-semibold text-gray-800 pt-1">Description</label>
                <RichTextEditor v-model="form.description" placeholder="Describe your event here…" />
              </div>
            </div>
            <!-- Category + Discipline. Disciplines come from the governing body
                 (club's sport → its NSO chain), NOT a local list — <DisciplineLinker>
                 resolves + persists event_disciplines itself, so it needs the draft row. -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div class="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-start gap-1.5 sm:gap-4">
                <span class="hidden sm:block" />
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div class="min-w-0">
                    <label class="block text-sm font-semibold text-gray-800 mb-1.5">Category</label>
                    <div class="flex items-center gap-2 min-w-0">
                      <MultiSelect v-model="form.category_ids" :options="categories" option-label="name" option-value="id"
                        placeholder="Choose categories" class="flex-1 min-w-0" display="chip" :max-selected-labels="3">
                        <template #chip="{ value }">
                          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            :style="{ background: categories.find(c => c.id === value)?.color ?? '#1E2157' }">
                            {{ categories.find(c => c.id === value)?.name }}
                          </div>
                        </template>
                      </MultiSelect>
                      <Button icon="pi pi-plus" size="small" severity="secondary" outlined v-tooltip.top="'New category'" @click="showNewCategoryDialog = true" />
                    </div>
                  </div>
                  <div class="min-w-0">
                    <label class="block text-sm font-semibold text-gray-800 mb-1.5">Discipline</label>
                    <DisciplineLinker v-if="draftEventId" entity-type="event" :entity-id="draftEventId" />
                    <p v-else class="text-sm text-gray-400 flex items-center gap-2">
                      <i class="pi pi-spin pi-spinner text-xs" /> Preparing…
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <!-- Banner -->
            <div class="px-5 py-4">
              <div class="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1.5 sm:gap-4">
                <label class="text-sm font-semibold text-gray-800 pt-1">Banner</label>
                <div>
                  <div v-if="!form.banner_url"
                    class="border-2 border-dashed border-gray-300 rounded-xl px-4 py-5 flex flex-col items-center gap-2 hover:border-primary transition-colors cursor-pointer"
                    @click="bannerInput?.click()">
                    <i class="pi pi-image text-2xl text-gray-400" />
                    <Button label="Upload banner image" severity="secondary" outlined size="small" icon="pi pi-upload" />
                    <p class="text-xs text-gray-500">For best results upload an image that is 1200 × 350</p>
                  </div>
                  <div v-else class="relative rounded-xl overflow-hidden">
                    <img :src="form.banner_url" class="w-full h-32 object-cover" />
                    <div v-if="uploadingBanner" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <i class="pi pi-spin pi-spinner text-white text-xl" />
                    </div>
                    <template v-else>
                      <Button icon="pi pi-upload" severity="secondary" rounded size="small" class="absolute top-2 right-11" @click="bannerInput?.click()" />
                      <Button icon="pi pi-times" severity="danger" rounded size="small" class="absolute top-2 right-2" @click="form.banner_url = ''" />
                    </template>
                  </div>
                  <input ref="bannerInput" type="file" accept="image/*" class="hidden" @change="handleBannerUpload" />
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Step 1: Sessions -->
        <template v-if="currentStep === 1">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Sessions</h2>
            <p class="text-sm text-gray-500">Define session templates and we'll generate a session for each day in the programme — all under one event with shared registration.</p>
          </div>

          <!-- Programme days -->
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 class="text-sm font-semibold text-gray-700">Programme Days</h3>
            </div>
            <div class="px-5 py-4 space-y-3">
              <div v-if="!form.start_date || !form.end_date" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <i class="pi pi-exclamation-triangle mr-1.5" />
                Set the event start and end dates on the previous step to generate sessions.
              </div>
              <div class="flex items-center gap-4 flex-wrap">
                <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <Checkbox v-model="sessionOptions.includeWeekends" :binary="true" />
                  Include weekends
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <Checkbox v-model="sessionOptions.excludePublicHolidays" :binary="true" />
                  Exclude public holidays
                </label>
              </div>
              <p v-if="sessionDays.length > 0" class="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 inline-block">
                <i class="pi pi-calendar-clock mr-1.5" />
                <strong>{{ sessionDays.length }}</strong> day{{ sessionDays.length !== 1 ? 's' : '' }} in programme
                <span v-if="!sessionOptions.includeWeekends" class="text-green-600"> (weekdays only)</span>
                <span v-if="sessionOptions.excludePublicHolidays" class="text-green-600"> (excl. public holidays)</span>
              </p>
            </div>
          </div>

          <!-- Session templates -->
          <BulkSessionTemplates
            :modelValue="templates"
            :daysCount="sessionDays.length"
            @update:modelValue="v => { templates.splice(0, templates.length, ...v) }" />

          <!-- Preview -->
          <div v-if="sessionDays.length > 0 && namedTemplates.length > 0" class="bg-primary/5 border border-primary/20 rounded-xl px-5 py-4">
            <p class="text-sm font-semibold text-primary mb-2">Sessions to be created</p>
            <ul class="text-sm text-gray-600 space-y-1">
              <li><i class="pi pi-clock text-primary mr-2 text-xs" />{{ sessionDays.length }} day{{ sessionDays.length !== 1 ? 's' : '' }} · {{ namedTemplates.length }} template{{ namedTemplates.length !== 1 ? 's' : '' }} per day</li>
              <li><i class="pi pi-list text-primary mr-2 text-xs" /><strong>{{ totalSessions }}</strong> sessions will be generated</li>
            </ul>
          </div>
        </template>

        <!-- Step 2: Location -->
        <template v-if="currentStep === 2">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Location</h2>
            <p class="text-sm text-gray-500">Where will the event take place?</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <LocationEditor v-model="form.locations" :availabilityMap="availabilityMap" />
          </div>
        </template>

        <!-- Step 3: Capacity & Sign Up -->
        <template v-if="currentStep === 3">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Capacity &amp; Sign Up</h2>
            <p class="text-sm text-gray-500">Control how many people can register and when.</p>
          </div>

          <!-- Capacity -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Capacity</h3>
            <div class="flex items-center gap-3">
              <ToggleSwitch v-model="form.has_capacity" />
              <span class="text-sm text-gray-600">{{ form.has_capacity ? 'Limited capacity' : 'No capacity limit' }}</span>
            </div>
            <div v-if="form.has_capacity" class="flex items-center gap-3">
              <InputNumber v-model="form.capacity_max" placeholder="Max attendees" class="w-48" :min="1" />
              <span class="text-sm text-gray-500">spots maximum</span>
            </div>
            <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
              <ToggleSwitch v-model="form.has_waitlist" />
              <div>
                <p class="text-sm text-gray-700">Enable waitlist</p>
                <p class="text-xs text-gray-400">Overflow registrations join a waitlist</p>
              </div>
            </div>
            <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
              <ToggleSwitch v-model="form.allow_guests" />
              <div>
                <p class="text-sm text-gray-700">Allow guests</p>
                <p class="text-xs text-gray-400">Non-members can register</p>
              </div>
            </div>
          </div>

          <!-- Sign Up Window -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Sign Up Window</h3>
            <p class="text-xs text-gray-500">Leave blank to allow sign-ups at any time.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Opens</label>
                <DatePicker v-model="form.reg_open_at" show-icon show-time hour-format="12" date-format="dd/mm/yy" class="w-full" placeholder="No open date" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Closes</label>
                <DatePicker v-model="form.reg_close_at" show-icon show-time hour-format="12" date-format="dd/mm/yy" class="w-full" placeholder="No close date" />
              </div>
            </div>
          </div>

          <!-- Phased registration -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Phased Registration</h3>
            <div class="flex items-center gap-3">
              <ToggleSwitch v-model="form.phased_registration" />
              <div>
                <p class="text-sm text-gray-700">Member early access</p>
                <p class="text-xs text-gray-400">Members get a head start before public registration opens</p>
              </div>
            </div>
            <div v-if="form.phased_registration" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Member window (days)</label>
                <InputNumber v-model="form.member_window_days" :min="1" :max="365" class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Public opens at</label>
                <DatePicker v-model="form.public_opens_at" show-icon show-time hour-format="12" date-format="dd/mm/yy" class="w-full" placeholder="Public open date" />
              </div>
            </div>
          </div>
        </template>

        <!-- Step 4: Visibility & Permissions -->
        <template v-if="currentStep === 4">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Visibility &amp; Permissions</h2>
            <p class="text-sm text-gray-500">Control who can see and interact with this event.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div v-for="opt in visibilityOptions" :key="opt.key" class="flex items-center gap-4 px-5 py-4">
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-700">{{ opt.label }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ opt.desc }}</p>
              </div>
              <ToggleSwitch v-model="form[opt.key]" />
            </div>
          </div>
        </template>

        <!-- Step 5: Fees -->
        <template v-if="currentStep === 5">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Fees</h2>
            <p class="text-sm text-gray-500">Set up registration fees if this event is ticketed or charged.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700">Are attendees charged?</p>
                <p class="text-xs text-gray-400 mt-0.5">Enable to add fee components</p>
              </div>
              <div class="flex">
                <button class="px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors"
                  :class="!form.is_paid ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'"
                  @click="form.is_paid = false">Free</button>
                <button class="px-4 py-2 text-sm font-medium border rounded-r-lg transition-colors"
                  :class="form.is_paid ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'"
                  @click="form.is_paid = true">Charged</button>
              </div>
            </div>
            <template v-if="form.is_paid">
              <div class="border border-gray-200 rounded-xl overflow-hidden">
                <!-- Desktop header row -->
                <div class="hidden sm:grid px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  style="grid-template-columns:2fr 2fr 1fr 40px">
                  <span>Fee Name</span><span>Account</span><span>Amount</span><span />
                </div>
                <!-- Desktop rows -->
                <div v-for="(fee, idx) in form.fees" :key="idx"
                  class="border-b border-gray-100">
                  <!-- Desktop layout -->
                  <div class="hidden sm:grid px-4 py-2.5 items-center gap-3"
                    style="grid-template-columns:2fr 2fr 1fr 40px">
                    <InputText v-model="fee.name" placeholder="e.g. Entry Fee" size="small" class="w-full" />
                    <XeroAccountInput v-model="fee.account" placeholder="Account code" class="w-full"
                      input-class="w-full h-9 px-2.5 text-sm text-gray-800 placeholder-gray-400 border border-gray-300 rounded-md outline-none focus:border-primary" />
                    <InputNumber v-model="fee.amount" mode="currency" :currency="orgCurrency" locale="en-NZ" size="small" class="w-full" input-class="text-right" />
                    <Button icon="pi pi-trash" text severity="danger" size="small" @click="form.fees.splice(idx, 1)" />
                  </div>
                  <!-- Mobile layout -->
                  <div class="sm:hidden px-4 py-3 space-y-2">
                    <div class="flex items-center gap-2">
                      <InputText v-model="fee.name" placeholder="Fee name" size="small" class="flex-1" />
                      <Button icon="pi pi-trash" text severity="danger" size="small" @click="form.fees.splice(idx, 1)" />
                    </div>
                    <XeroAccountInput v-model="fee.account" placeholder="Account code" class="w-full"
                      input-class="w-full h-9 px-2.5 text-sm text-gray-800 placeholder-gray-400 border border-gray-300 rounded-md outline-none focus:border-primary" />
                    <InputNumber v-model="fee.amount" mode="currency" :currency="orgCurrency" locale="en-NZ" size="small" class="w-full" input-class="text-right" placeholder="Amount" />
                  </div>
                </div>
                <div class="hidden sm:grid px-4 py-2.5 border-b border-gray-200 font-semibold text-sm"
                  style="grid-template-columns:2fr 2fr 1fr 40px">
                  <span class="text-gray-700">Total</span><span /><span class="text-gray-900">${{ totalFees.toFixed(2) }}</span><span />
                </div>
                <div class="sm:hidden px-4 py-2.5 border-b border-gray-200 flex justify-between text-sm font-semibold">
                  <span class="text-gray-700">Total</span>
                  <span class="text-gray-900">${{ totalFees.toFixed(2) }}</span>
                </div>
                <div class="px-4 py-2.5">
                  <Button icon="pi pi-plus" label="Add Fee" size="small" severity="secondary" text @click="addFee" />
                </div>
              </div>
              <div class="flex items-center gap-3 pt-2">
                <ToggleSwitch v-model="form.has_tickets" />
                <div>
                  <p class="text-sm text-gray-700">Enable ticketing</p>
                  <p class="text-xs text-gray-400">Set up ticket types and quantities after creation</p>
                </div>
              </div>
            </template>
          </div>
        </template>

        <div class="h-2" />
      </div>
    </div>

    <!-- Bottom navigation -->
    <div class="bg-white border-t border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
      <Button
        v-if="currentStep > 0"
        label="Back"
        icon="pi pi-chevron-left"
        severity="secondary"
        outlined
        @click="currentStep--; scrollTop()"
      />
      <div v-else />
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">{{ currentStep + 1 }} / {{ steps.length }}</span>
        <Button
          v-if="currentStep < steps.length - 1"
          label="Next"
          icon="pi pi-chevron-right"
          icon-pos="right"
          :disabled="currentStep === 0 && !step1Complete"
          style="background:var(--brand-primary); border-color:var(--brand-primary)"
          @click="currentStep++; scrollTop()"
        />
        <Button
          v-else
          label="Create Event"
          icon="pi pi-check"
          :loading="saving"
          :disabled="!form.title.trim()"
          style="background:#34B66D; border-color:#34B66D"
          @click="saveEvent"
        />
      </div>
    </div>
  </div>
  </div>
  </Teleport>

  <!-- New Category Dialog -->
  <Dialog v-model:visible="showNewCategoryDialog" header="New Category" modal :style="{ width: '95vw', maxWidth: '360px' }">
    <div class="flex flex-col gap-4 py-1">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">Name</label>
        <InputText v-model="newCategoryName" placeholder="Category name" autofocus />
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">Colour</label>
        <div class="flex flex-wrap gap-2">
          <button v-for="color in colorPalette" :key="color"
            class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            :class="newCategoryColor === color ? 'border-gray-900 scale-110' : 'border-transparent'"
            :style="{ background: color }"
            @click="newCategoryColor = color" />
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showNewCategoryDialog = false" />
      <Button label="Create" :disabled="!newCategoryName.trim()" :loading="savingCategory" @click="createCategory"
        style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>
  </Dialog>

  <Toast />
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'
import type { LocationEntry } from '~/composables/useLocation'

definePageMeta({ layout: 'default' })

const db = useDb()
const toast = useToast()
const route = useRoute()
const orgCurrency = ref('NZD')

const saving = ref(false)
const currentStep = ref(0)

const steps = [
  { label: 'Event Info' },
  { label: 'Sessions' },
  { label: 'Location' },
  { label: 'Capacity & Sign Up' },
  { label: 'Visibility' },
  { label: 'Fees' },
]

// The draft row exists from the moment the builder opens, exactly as in the basic
// wizard: <DisciplineLinker> writes event_disciplines against a real event id, so
// there has to be one to write against. saveEvent() then UPDATES this row rather
// than inserting a second one.
const draftEventId = ref<string | null>(null)

async function ensureDraft() {
  if (draftEventId.value) return
  const { data } = await (db.from as any)('events').insert({
    org_id: orgId.value,
    style: 'ADVANCED',
    created_via: 'advanced',
    status: 'DRAFT',
    title: (route.query.name as string)?.trim() || 'Untitled event',
  }).select('id').single()
  draftEventId.value = data?.id ?? null
}

// Same rule as the basic wizard: a date you can't act on isn't a date.
const dateInvalidReason = computed(() => {
  if (!form.start_date) return 'Pick a start date for the event.'
  if (form.end_date && form.start_date && form.end_date < form.start_date) return 'The end date is before the start date.'
  if (!form.is_all_day && (!form.start_time || !form.end_time)) return 'Set a start and end time, or mark it as an all-day event.'
  return ''
})
const step1Complete = computed(() => !!form.title.trim() && !dateInvalidReason.value)

function scrollTop() {
  nextTick(() => document.querySelector('.overflow-y-auto')?.scrollTo(0, 0))
}

// ── Form ──────────────────────────────────────────────────────────────────
// An event can't start in the past — the earliest selectable date is today.
const today = new Date()
today.setHours(0, 0, 0, 0)

function parseDateParam(str: string | null): Date | null {
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

const form = reactive({
  title: (route.query.name as string) ?? '',
  description: '',
  category_ids: [] as string[],
  banner_url: '',
  // Date
  is_all_day: false,
  start_date: parseDateParam(route.query.date as string ?? null),
  start_time: null as Date | null,
  end_date: parseDateParam(route.query.date as string ?? null),
  end_time: null as Date | null,
  repeat: '',
  exdates: [] as string[],
  // Location
  locations: [{ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] as string[] }] as LocationEntry[],
  // Capacity
  has_capacity: false,
  capacity_max: null as number | null,
  has_waitlist: false,
  allow_guests: false,
  // Sign up
  reg_open_at: null as Date | null,
  reg_close_at: null as Date | null,
  // Phased
  phased_registration: false,
  member_window_days: 40,
  public_opens_at: null as Date | null,
  // Visibility
  is_public: false,
  is_featured: false,
  show_attendee_list: false,
  show_attendee_count: true,
  allow_interest: false,
  hold_spot_enabled: false,
  // Fees
  is_paid: false,
  has_tickets: false,
  fees: [] as { name: string; account: string; amount: number | null }[],
})

const visibilityOptions = [
  { key: 'is_public',           label: 'Public event',          desc: 'Visible to non-members' },
  { key: 'is_featured',         label: 'Featured',              desc: 'Highlighted in event lists' },
  { key: 'show_attendee_list',  label: 'Show attendee list',    desc: 'Members can see who is attending' },
  { key: 'show_attendee_count', label: 'Show attendee count',   desc: 'Display total registration numbers' },
  { key: 'allow_interest',      label: 'Allow interest',        desc: 'Members can express interest before registration opens' },
  { key: 'hold_spot_enabled',   label: 'Hold-spot registration',desc: 'Members can hold a spot pending confirmation' },
]

const totalFees = computed(() => form.fees.reduce((sum, f) => sum + (f.amount ?? 0), 0))

function addFee() {
  form.fees.push({ name: '', account: '', amount: null })
}

// ── Sessions (bulk-template mode) ─────────────────────────────────────────
const NZ_PUBLIC_HOLIDAYS_2025_2026 = [
  '2025-04-18','2025-04-19','2025-04-20','2025-04-21','2025-04-25',
  '2025-06-02','2025-10-27','2025-12-25','2025-12-26',
  '2026-01-01','2026-01-02','2026-02-06','2026-04-03','2026-04-04',
  '2026-04-05','2026-04-06','2026-04-27','2026-06-01','2026-10-26',
  '2026-12-25','2026-12-26',
]

const sessionOptions = reactive({
  includeWeekends: true,
  excludePublicHolidays: false,
})

function makeTime(h: number, m = 0) {
  const d = new Date(); d.setHours(h, m, 0, 0); return d
}

const templates = reactive([
  { name: 'Morning',   cost: null as number | null, startTime: makeTime(9),  endTime: makeTime(12), limit: null as number | null },
  { name: 'Afternoon', cost: null as number | null, startTime: makeTime(13), endTime: makeTime(17), limit: null as number | null },
])

const sessionDays = computed(() => {
  if (!form.start_date || !form.end_date) return []
  const days: Date[] = []
  const cur = new Date(form.start_date)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(form.end_date)
  end.setHours(23, 59, 59, 999)
  while (cur <= end) {
    const dow = cur.getDay()
    const iso = cur.toISOString().slice(0, 10)
    const isWeekend = dow === 0 || dow === 6
    const isHoliday = sessionOptions.excludePublicHolidays && NZ_PUBLIC_HOLIDAYS_2025_2026.includes(iso)
    if (!isHoliday && (sessionOptions.includeWeekends || !isWeekend)) days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
})

const namedTemplates = computed(() => templates.filter(t => t.name.trim()))

const totalSessions = computed(() => sessionDays.value.length * namedTemplates.value.length)

function buildSessionDatetime(date: Date, time: Date | null, fallbackHour = 0): string {
  const d = new Date(date)
  if (time) d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  else d.setHours(fallbackHour, 0, 0, 0)
  return d.toISOString()
}

// ── Categories ────────────────────────────────────────────────────────────
const categories = ref<any[]>([])
const showNewCategoryDialog = ref(false)
const newCategoryName = ref('')
const newCategoryColor = ref('#1E2157')
const savingCategory = ref(false)
const colorPalette = ['#1E2157','#3B82F6','#8B5CF6','#EC4899','#EF4444','#F59E0B','#10B981','#06B6D4','#6B7280','#1EA97C','#F97316','#84CC16']

async function createCategory() {
  if (!newCategoryName.value.trim()) return
  savingCategory.value = true
  const { data, error } = await db.from('categories').insert({
    org_id: orgId.value, name: newCategoryName.value.trim(), color: newCategoryColor.value,
  }).select('id, name, color').single()
  if (!error && data) {
    categories.value.push(data)
    form.category_ids.push(data.id)
  }
  showNewCategoryDialog.value = false
  newCategoryName.value = ''
  newCategoryColor.value = '#1E2157'
  savingCategory.value = false
}

// ── Banner ────────────────────────────────────────────────────────────────
const bannerInput = ref<HTMLInputElement | null>(null)
const uploadingBanner = ref(false)
const { uploadFile } = useUpload()

async function handleBannerUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  form.banner_url = URL.createObjectURL(file)
  uploadingBanner.value = true
  try { form.banner_url = await uploadFile(file) } finally { uploadingBanner.value = false }
}

// ── Availability ──────────────────────────────────────────────────────────
const availabilityMap = reactive<Record<string, 'available' | 'booked'>>({})

// ── Save ──────────────────────────────────────────────────────────────────
function buildDateTime(date: Date | null, time: Date | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (time) d.setHours((time as Date).getHours(), (time as Date).getMinutes(), 0, 0)
  else d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function saveEvent() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    const payload = {
      org_id: orgId.value,
      style: 'ADVANCED',
      created_via: 'advanced',
      status: 'DRAFT',
      title: form.title.trim(),
      description: form.description.trim() || null,
      category_id: form.category_ids[0] ?? null,
      secondary_category_id: form.category_ids[1] ?? null,
      banner_url: form.banner_url || null,
      is_all_day: form.is_all_day,
      start_at: buildDateTime(form.start_date, form.is_all_day ? null : form.start_time),
      end_at: buildDateTime(form.end_date, form.is_all_day ? null : form.end_time),
      recurrence_rule: form.repeat || null,
      exdates: form.exdates ?? [],
      locations: form.locations,
      location_type: (form.locations[0]?.type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE',
      address: form.locations[0]?.type === 'ADDRESS' ? (form.locations[0].address || null) : null,
      meeting_link: form.locations[0]?.type === 'ONLINE' ? (form.locations[0].meeting_link || null) : null,
      capacity_max: form.has_capacity ? (form.capacity_max ?? null) : null,
      has_waitlist: form.has_waitlist,
      allow_guests: form.allow_guests,
      reg_open_at: form.reg_open_at ?? null,
      reg_close_at: form.reg_close_at ?? null,
      phased_registration: form.phased_registration,
      member_window_days: form.member_window_days,
      public_opens_at: form.public_opens_at ?? null,
      is_public: form.is_public,
      is_featured: form.is_featured,
      show_attendee_list: form.show_attendee_list,
      show_attendee_count: form.show_attendee_count,
      allow_interest: form.allow_interest,
      hold_spot_enabled: form.hold_spot_enabled,
    }

    // The draft already exists (it has to, for the discipline picker) — update it.
    // Inserting here would leave an empty orphan event behind every time.
    const { data, error } = draftEventId.value
      ? await (db.from as any)('events').update(payload).eq('id', draftEventId.value).select('id').single()
      : await (db.from as any)('events').insert(payload).select('id').single()
    if (error) throw error
    draftEventId.value = data.id

    const days = sessionDays.value
    if (days.length && namedTemplates.value.length) {
      let sortOrder = 0
      for (const tpl of namedTemplates.value) {
        const { data: master, error: masterErr } = await db.from('sessions').insert({
          event_id: data.id,
          title: tpl.name.trim(),
          start_at: buildSessionDatetime(days[0], tpl.startTime, 9),
          end_at: buildSessionDatetime(days[0], tpl.endTime, 17),
          capacity_max: tpl.limit ?? null,
          is_required: false,
          is_public: form.is_public,
          display_on_form: true,
          is_master: true,
          master_id: null,
          sort_order: sortOrder++,
        }).select('id').single()
        if (masterErr || !master?.id) throw masterErr ?? new Error('Failed to create master session')

        if (days.length > 1) {
          const linked = days.slice(1).map(day => ({
            event_id: data.id,
            title: tpl.name.trim(),
            start_at: buildSessionDatetime(day, tpl.startTime, 9),
            end_at: buildSessionDatetime(day, tpl.endTime, 17),
            capacity_max: tpl.limit ?? null,
            is_required: false,
            is_public: form.is_public,
            display_on_form: true,
            is_master: false,
            master_id: master.id,
            sort_order: sortOrder++,
          }))
          const { error: linkedErr } = await db.from('sessions').insert(linked)
          if (linkedErr) throw linkedErr
        }
      }
    }

    if (form.is_paid && form.fees.length) {
      const rows = form.fees.filter(f => f.name.trim()).map(f => ({
        event_id: data.id, name: f.name.trim(), amount: f.amount ?? 0, xero_code: f.account || null,
      }))
      if (rows.length) await db.from('fee_components').insert(rows)
    }

    // Sync venue bookings — surface this event on each linked venue's calendar.
    const bookableIds: string[] = (form.locations ?? [])
      .filter((l: any) => l.type === 'BOOKABLE')
      .flatMap((l: any) => l.bookable_ids ?? [])
    const eventStart = buildDateTime(form.start_date, form.is_all_day ? null : form.start_time)
    const eventEnd = buildDateTime(form.end_date, form.is_all_day ? null : form.end_time)
    if (bookableIds.length && eventStart && eventEnd) {
      await db.from('bookings').insert(
        bookableIds.map((bid: string) => ({
          bookable_id: bid,
          event_id: data.id,
          type: 'EVENT_DRIVEN',
          status: 'CONFIRMED',
          start_at: eventStart,
          end_at: eventEnd,
          purpose: form.title.trim(),
          is_all_day: form.is_all_day,
        })),
      )
    }

    toast.add({ severity: 'success', summary: 'Event created!', life: 3000 })
    navigateTo(`/events/${data.id}`)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not create event', detail: err?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

async function saveDraft() {
  if (!form.title.trim()) {
    toast.add({ severity: 'warn', summary: 'Enter a title first', life: 2000 })
    return
  }
  await saveEvent()
}

// ── Mount ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  ensureDraft()
  ;(db.from as any)('organisations').select('currency').eq('id', orgId.value).single()
    .then(({ data }: any) => { orgCurrency.value = data?.currency || 'NZD' })
  const [{ data: catData }, { data: bookableData }] = await Promise.all([
    db.from('categories').select('id, name, color').eq('org_id', orgId.value).order('name'),
    db.from('bookables').select('id, name').eq('org_id', orgId.value).order('name'),
  ])
  categories.value = catData ?? []
  for (const b of (bookableData ?? [])) availabilityMap[b.id] = 'available'
})
</script>
