<template>
  <!-- Rendered as a modal over the app: the wizard is a focused task, so the
       left rail + page chrome are covered by the scrim rather than framing it.
       `app-modal-overlay` is the hook <ReviewWidget> uses to know a modal is
       up (so its floating comment trigger appears). -->
  <!-- Teleported to <body>: rendered in place it sits inside <main>, which is
       below the nav rail (z-60), so the rail stayed clickable through the
       scrim. At body level it covers the whole app, like a real modal. -->
  <Teleport to="body">
  <div class="app-modal-overlay fixed inset-0 flex items-stretch sm:items-center justify-center sm:p-6 bg-slate-900/45 backdrop-blur-[2px]"
    style="z-index: 1000">
  <div class="flex flex-col bg-white w-full h-full sm:h-[92vh] sm:max-w-[1200px] sm:rounded-xl shadow-2xl overflow-hidden">

    <!-- ── Stepped header (step nav + progress bar) — same brand bar as the
         desktop header and every dialog. ── -->
    <div v-if="isMobile" class="shrink-0">
      <div class="modal-header-bar flex items-center gap-3 !py-2.5">
        <button
          class="w-9 h-9 flex items-center justify-center rounded-lg text-white/75 hover:text-white hover:bg-white/15 transition-colors"
          @click="mobileBack">
          <i class="pi pi-chevron-left text-sm" />
        </button>
        <div class="flex-1 text-center">
          <p class="text-[11px] text-white/60 font-medium uppercase tracking-wide">Step {{ mobileStep + 1 }} of {{ mobileSteps.length }}</p>
          <p class="modal-header-title leading-tight">{{ mobileSteps[mobileStep].label }}</p>
        </div>
        <button
          class="w-9 h-9 flex items-center justify-center rounded-lg text-white/75 hover:text-white hover:bg-white/15 transition-colors"
          @click="navigateTo('/events')">
          <i class="pi pi-times text-sm" />
        </button>
      </div>
    </div>

    <!-- ── Desktop header (solid brand bar — matches the global dialog chrome) ── -->
    <div v-else class="modal-header-bar flex items-center justify-between shrink-0">
      <span class="modal-header-title">Create new event</span>
      <div class="flex items-center gap-2">
        <!-- White on the solid header — a brand-coloured button would vanish into it. -->
        <Button label="Save Event" icon="pi pi-check" size="small" :loading="saving" :disabled="!form.title.trim()" @click="saveEvent"
          style="background:#fff; border-color:#fff; color:var(--brand-primary)" />
        <button
          class="w-7 h-7 rounded-md flex items-center justify-center text-white/75 hover:text-white hover:bg-white/15 transition-colors"
          aria-label="Close"
          @click="navigateTo('/events')">
          <i class="pi pi-times text-sm" />
        </button>
      </div>
    </div>

    <!-- ── Scrollable content ── -->
    <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div :class="isMobile ? 'h-full' : 'max-w-[1140px] mx-auto px-6 py-6 space-y-8'">

        <!-- ─ Event Info ─ -->
        <div :class="isMobile ? (mobileStep === 0 ? 'px-4 py-5 space-y-4' : 'hidden') : ''">
          <div class="mb-3">
            <h2 class="text-sm font-semibold text-gray-800">Event info</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Event info') }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Title -->
            <div class="px-5 py-4 border-b border-gray-100">
              <!-- Label sits LEFT of the field, in the stepped view too (it only
                   stacks on a genuinely narrow screen). -->
              <div class="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-1.5 sm:gap-4">
                <label class="text-sm font-semibold text-gray-800">Event Title <span class="text-red-400">*</span></label>
                <InputText v-model="form.title" placeholder="Enter the name of your event" class="w-full" autofocus />
              </div>
            </div>
            <!-- Date (lives on step 1, right after the name) -->
            <div class="px-5 py-4 border-b border-gray-100">
              <!-- No accordion: the fields ARE the summary. Each editor row carries
                   its own 120px label column, matching the card's, so every input
                   lines up with Event Title. -->
              <DateTimeEditor
                v-model:startDate="form.start_date"
                v-model:endDate="form.end_date"
                v-model:startTime="form.start_time"
                v-model:endTime="form.end_time"
                v-model:isAllDay="form.is_all_day"
                v-model:repeat="form.repeat"
                v-model:exdates="form.exdates"
                :minStartDate="twoWeeksAgo"
                :minEndDate="form.start_date ?? twoWeeksAgo"
                label="Date"
                required
                label-width="w-[120px]"
                label-class="text-gray-800 font-semibold"
                row-padding="px-0 py-2"
              />
              <!-- Sign-up window lives in the same box: it's a date range about
                   the same event. Only asked for once sign-up is required. -->
              <div class="flex items-center gap-4 py-2">
                <span class="text-sm text-gray-500 shrink-0 w-[120px]">Sign up</span>
                <div class="flex items-center gap-3">
                  <ToggleSwitch v-model="signupRequired" @update:model-value="onSignupRequired" />
                  <span class="text-sm text-gray-700">Attendees need to sign up to this event.</span>
                </div>
              </div>
              <DateTimeEditor
                v-if="signupRequired"
                v-model:startDate="regOpenDate"
                v-model:startTime="regOpenTime"
                v-model:endDate="regCloseDate"
                v-model:endTime="regCloseTime"
                :show-all-day="false"
                :show-repeat="false"
                label=""
                start-label="Opens"
                end-label="Closes"
                label-width="w-[120px]"
                row-padding="px-0 py-2" />
            </div>
            <!-- Description -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div :class="isMobile ? 'space-y-1.5' : 'grid grid-cols-[120px_1fr] gap-4'">
                <label class="text-sm font-semibold text-gray-800 pt-1">Description</label>
                <RichTextEditor v-model="form.description" placeholder="Describe your event here…" />
              </div>
            </div>
            <!-- Category + Discipline — two columns, sharing the field column.
                 Disciplines come from the governing body (club's sport → its NSO
                 chain), NOT a local list. <DisciplineLinker> resolves + persists
                 to event_disciplines itself, so it needs the draft event row. -->
            <div class="px-5 py-4 border-b border-gray-100">
              <!-- Both columns are titled above their field: with two side-by-side
                   controls there's no single left label that can name them. -->
              <div :class="isMobile ? 'space-y-1.5' : 'grid grid-cols-[120px_1fr] items-start gap-4'">
                <span />
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <!-- Category -->
                  <div class="min-w-0">
                  <label class="block text-sm font-semibold text-gray-800 mb-1.5">Category</label>
                  <div class="flex items-center gap-2 min-w-0">
                    <MultiSelect
                      v-model="form.category_ids"
                      :options="categories"
                      option-label="name"
                      option-value="id"
                      placeholder="Choose categories"
                      class="flex-1 min-w-0"
                      display="chip"
                      :max-selected-labels="3"
                    >
                      <template #chip="{ value }">
                        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white" :style="{ background: categories.find(c => c.id === value)?.color ?? '#1E2157' }">
                          {{ categories.find(c => c.id === value)?.name }}
                        </div>
                      </template>
                    </MultiSelect>
                    <Button icon="pi pi-plus" size="small" severity="secondary" outlined v-tooltip.top="'New calendar'" @click="showNewCategoryDialog = true" />
                  </div>
                  </div>
                  <!-- Discipline -->
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
              <div :class="isMobile ? 'space-y-1.5' : 'grid grid-cols-[120px_1fr] gap-4'">
                <label class="text-sm font-semibold text-gray-800 pt-1">Banner</label>
                <div>
                  <div v-if="!form.banner_url"
                    class="border-2 border-dashed border-gray-300 rounded-xl px-4 py-5 flex flex-col items-center gap-2 hover:border-primary transition-colors cursor-pointer"
                    @click="triggerBannerUpload">
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
                      <Button icon="pi pi-upload" severity="secondary" rounded size="small" class="absolute top-2 right-11" @click="triggerBannerUpload" />
                      <Button icon="pi pi-times" severity="danger" rounded size="small" class="absolute top-2 right-2" @click="form.banner_url = ''" />
                    </template>
                  </div>
                  <input ref="bannerInput" type="file" accept="image/*" class="hidden" @change="handleBannerUpload" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─ Location ─ -->
        <div :class="isMobile ? (mobileStep === 1 ? 'px-4 py-5' : 'hidden') : ''">
          <div class="mb-3">
            <h2 class="text-sm font-semibold text-gray-800">Location</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Location') }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <LocationEditor v-model="form.locations" :availabilityMap="availabilityMap">
              <template #bookable-header>
                <div class="flex items-center justify-between bg-blue-50 border-b border-blue-200 px-3 py-2">
                  <div class="flex items-center gap-2 text-sm text-blue-700">
                    <i class="pi pi-clock text-xs" />
                    <span>Availability for: <span class="font-medium">{{ availabilityTimeLabel }}</span></span>
                  </div>
                  <Button label="Re-check" icon="pi pi-refresh" size="small" severity="secondary" outlined :loading="checkingAvailability" @click="recheckAvailability" />
                </div>
              </template>
            </LocationEditor>
          </div>
        </div>

        <!-- ─ Invitees ─ -->
        <div :class="isMobile ? (mobileStep === 2 ? 'px-4 py-5' : 'hidden') : ''">
          <div class="mb-3">
            <h2 class="text-sm font-semibold text-gray-800">Invitees</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Invitees') }}</p>
          </div>
          <div v-if="!draftEventId" class="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
            <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
            Setting up invitees…
          </div>
          <EventInviteeManager v-else :event-id="draftEventId" />
        </div>

        <!-- ─ Visibility ─ -->
        <div :class="isMobile ? (mobileStep === 3 ? 'px-4 py-5' : 'hidden') : ''">
          <div class="mb-3">
            <h2 class="text-sm font-semibold text-gray-800">Visibility</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Visibility') }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <div :class="isMobile ? 'space-y-3' : 'grid grid-cols-2 gap-4'">
              <div v-for="vis in visibilityOptions" :key="vis.key" class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-gray-700">{{ vis.label }}</p>
                  <p class="text-xs text-gray-500">{{ vis.desc }}</p>
                </div>
                <ToggleSwitch v-model="form[vis.key]" />
              </div>
            </div>
            <div :class="isMobile ? 'space-y-3 mt-3' : 'flex gap-4 mt-4'">
              <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg flex-1">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-700">Limit capacity</p>
                  <div class="flex items-center gap-2">
                    <p class="text-xs text-gray-500">Set max attendees</p>
                    <template v-if="form.has_capacity">
                      <InputNumber v-model="form.capacity_max" :min="1" size="small" placeholder="Max" class="w-20" />
                      <span class="text-xs text-gray-500">spots</span>
                    </template>
                  </div>
                </div>
                <ToggleSwitch v-model="form.has_capacity" class="ml-3 shrink-0" />
              </div>
              <div v-if="form.has_capacity" class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg flex-1">
                <div>
                  <p class="text-sm font-medium text-gray-700">Enable waitlist</p>
                  <p class="text-xs text-gray-500">Overflow joins a waitlist</p>
                </div>
                <ToggleSwitch v-model="form.has_waitlist" class="ml-3 shrink-0" />
              </div>
            </div>
          </div>
        </div>

        <!-- ─ Registration form ─
             Toggle that lets the event owner choose whether to collect
             extra registration info via a custom form. When ON we render
             the same <FormBuilder> the advanced event uses; on save we
             persist the form to registration_forms / form_fields and
             link it via events.form_id. -->
        <div :class="isMobile ? (mobileStep === 3 ? 'px-4 py-5 mt-5' : 'hidden') : ''">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Registration form</h2>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0 pr-4">
                <p class="text-sm font-medium text-gray-700">Public registration form</p>
                <p class="text-xs text-gray-500 mt-0.5">Let people sign up themselves through a custom form (name, email, plus any extra questions you ask). Off by default — invitees still sign up via your invitee list.</p>
              </div>
              <ToggleSwitch v-model="form.use_registration_form" />
            </div>
            <p v-if="form.use_registration_form" class="text-[11px] text-gray-400 mt-3">
              Default fields below cover the basics. Add more by clicking "+ Add field" inside the builder. The form name defaults to the event title.
            </p>
          </div>
          <div v-if="form.use_registration_form" class="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden" style="min-height:560px">
            <FormBuilder v-model="form.registration_form"
              :context="{ title: form.title || 'Registration', description: form.description }"
              :allow-multiple-persons="false" />
          </div>
        </div>

        <!-- ─ Fees ─ -->
        <div :class="isMobile ? (mobileStep === 4 ? 'px-4 py-5' : 'hidden') : ''">
          <div class="mb-3">
            <h2 class="text-sm font-semibold text-gray-800">Fees</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Fees') }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700">Are attendees charged?</p>
                <p class="text-xs text-gray-500 mt-0.5">Enable to add fee components to this event</p>
              </div>
              <div class="flex gap-0">
                <button class="px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors" :class="!form.is_paid ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'" @click="form.is_paid = false">Free</button>
                <button class="px-4 py-2 text-sm font-medium border rounded-r-lg transition-colors" :class="form.is_paid ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'" @click="form.is_paid = true">Charged</button>
              </div>
            </div>
            <div v-if="form.is_paid" class="border border-gray-200 rounded-xl overflow-hidden">
              <div class="grid px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide" style="grid-template-columns:2fr 2fr 1fr 40px">
                <span>Fee Name</span><span>Account</span><span>Amount</span><span />
              </div>
              <div v-for="(fee, idx) in form.fees" :key="idx" class="grid px-4 py-2.5 border-b border-gray-100 items-center gap-3" style="grid-template-columns:2fr 2fr 1fr 40px">
                <InputText v-model="fee.name" placeholder="e.g. Tournament Fee" size="small" class="w-full" />
                <XeroAccountInput v-model="fee.account" placeholder="Account code" class="w-full"
                  input-class="w-full h-9 px-2.5 text-sm text-gray-800 placeholder-gray-400 border border-gray-300 rounded-md outline-none focus:border-primary" />
                <InputNumber v-model="fee.amount" mode="currency" :currency="orgCurrency" locale="en-NZ" size="small" class="w-full" input-class="text-right" />
                <Button icon="pi pi-trash" text severity="danger" size="small" @click="form.fees.splice(idx, 1)" />
              </div>
              <div class="grid px-4 py-2.5 border-b border-gray-200 font-semibold text-sm" style="grid-template-columns:2fr 2fr 1fr 40px">
                <span class="text-gray-700">Total</span><span /><span class="text-gray-900">${{ totalFees.toFixed(2) }}</span><span />
              </div>
              <div class="px-4 py-2.5">
                <Button icon="pi pi-plus" label="Add Fee" size="small" severity="secondary" text @click="addFee" />
              </div>
            </div>
          </div>
        </div>

        <!-- ─ Settings ─ -->
        <div :class="isMobile ? (mobileStep === 5 ? 'px-4 py-5' : 'hidden') : ''">
          <div class="mb-3">
            <h2 class="text-sm font-semibold text-gray-800">Settings</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Settings') }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-6">

            <!-- Terms & Conditions -->
            <div>
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Terms and Conditions</h3>
              <div class="space-y-2 mb-3">
                <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span class="text-sm text-gray-700">Club Terms and Conditions</span>
                  <span class="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Required</span>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span class="text-sm text-gray-700">Privacy Policy</span>
                  <span class="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Required</span>
                </div>
                <div v-for="(term, idx) in form.custom_terms" :key="idx"
                  class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg group">
                  <InputText v-model="form.custom_terms[idx]" size="small" class="flex-1 border-0 bg-transparent p-0 text-sm" placeholder="Custom terms..." />
                  <Button icon="pi pi-times" severity="danger" text size="small" rounded class="opacity-0 group-hover:opacity-100" @click="form.custom_terms.splice(idx, 1)" />
                </div>
              </div>
              <Button icon="pi pi-plus" label="Add Terms" size="small" severity="secondary" outlined @click="form.custom_terms.push('')" />
            </div>

            <!-- Event Administrators -->
            <div class="border-t border-gray-100 pt-5">
              <h3 class="text-sm font-semibold text-gray-800 mb-1">Event Administrators</h3>
              <p class="text-xs text-gray-500 mb-3">Choose the required access level for each event admin</p>
              <div class="border border-gray-200 rounded-xl overflow-hidden mb-3">
                <div class="grid px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide" style="grid-template-columns:1fr 100px 100px 100px 40px">
                  <span>Name</span><span class="text-center">Registrations</span><span class="text-center">Changes</span><span class="text-center">Notes</span><span />
                </div>
                <div v-for="(admin, idx) in form.admins" :key="idx" class="grid px-4 py-2.5 border-b border-gray-100 last:border-0 items-center" style="grid-template-columns:1fr 100px 100px 100px 40px">
                  <span class="text-sm text-blue-600 font-medium cursor-pointer hover:underline">{{ admin.name }}</span>
                  <div class="flex justify-center"><Checkbox v-model="admin.registrations" binary /></div>
                  <div class="flex justify-center">
                    <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer" :class="admin.changes ? 'border-primary bg-primary' : 'border-gray-300'" @click="admin.changes = !admin.changes">
                      <div v-if="admin.changes" class="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                  <div class="flex justify-center">
                    <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer" :class="admin.notes ? 'border-primary bg-primary' : 'border-gray-300'" @click="admin.notes = !admin.notes">
                      <div v-if="admin.notes" class="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                  <Button icon="pi pi-times" text severity="danger" size="small" rounded @click="form.admins.splice(idx, 1)" />
                </div>
                <div v-if="!form.admins.length" class="px-4 py-4 text-sm text-gray-400 text-center">No administrators added</div>
              </div>
              <Button icon="pi pi-plus" label="Add Coordinator" size="small" severity="secondary" outlined @click="showAddAdminDialog = true" />
            </div>
          </div>
        </div>

        <!-- Desktop bottom spacer -->
        <div v-if="!isMobile" class="h-4" />
      </div>
    </div>

    <!-- ── Mobile bottom navigation ── -->
    <div v-if="isMobile" class="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
      <Button
        v-if="mobileStep > 0"
        label="Back"
        icon="pi pi-chevron-left"
        severity="secondary"
        outlined
        class="flex-1"
        @click="mobileBack"
      />
      <div v-else class="flex-1" />
      <Button
        :label="mobileStep === mobileSteps.length - 1 ? 'Save Event' : 'Next'"
        :icon="mobileStep === mobileSteps.length - 1 ? 'pi pi-check' : 'pi pi-chevron-right'"
        icon-pos="right"
        :disabled="mobileStep === 0 && !form.title.trim()"
        :loading="saving && mobileStep === mobileSteps.length - 1"
        class="flex-1"
        style="background:var(--brand-primary); border-color:var(--brand-primary)"
        @click="mobileNext"
      />
    </div>
  </div>
  </div>
  </Teleport>

  <!-- Add Admin Dialog -->
  <Dialog v-model:visible="showAddAdminDialog" header="Add Event Administrator" modal :style="{ width: '95vw', maxWidth: '360px' }">
    <div class="flex flex-col gap-3 py-2">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">Name</label>
        <InputText v-model="adminDraft.name" placeholder="Search members..." autofocus />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">Permissions</label>
        <div class="flex items-center gap-2">
          <Checkbox v-model="adminDraft.registrations" binary input-id="adminReg" />
          <label for="adminReg" class="text-sm text-gray-700 cursor-pointer">View Registrations</label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox v-model="adminDraft.changes" binary input-id="adminChg" />
          <label for="adminChg" class="text-sm text-gray-700 cursor-pointer">Make Changes</label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox v-model="adminDraft.notes" binary input-id="adminNotes" />
          <label for="adminNotes" class="text-sm text-gray-700 cursor-pointer">Add Notes</label>
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showAddAdminDialog = false" />
      <Button label="Add" :disabled="!adminDraft.name.trim()" @click="addAdmin" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>
  </Dialog>

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
          <button v-for="color in categoryColorPalette" :key="color"
            class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            :class="newCategoryColor === color ? 'border-gray-900 scale-110' : 'border-transparent'"
            :style="{ background: color }"
            @click="newCategoryColor = color" />
          <div class="flex items-center gap-1.5">
            <input type="color" v-model="newCategoryColor" class="w-7 h-7 rounded cursor-pointer border border-gray-200" />
            <span class="text-xs text-gray-500">Custom</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: newCategoryColor }" />
        <span class="text-sm font-medium text-gray-700">{{ newCategoryName || 'Category name' }}</span>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showNewCategoryDialog = false" />
      <Button label="Create" :disabled="!newCategoryName.trim()" :loading="savingCategory" @click="createCategory" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
    </template>
  </Dialog>

  <Toast />
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

definePageMeta({ layout: 'default' })

const db = useDb()
const toast = useToast()
const route = useRoute()
const orgCurrency = ref('NZD')

const saving = ref(false)
const draftEventId = ref<string | null>(null)
const categories = ref<any[]>([])
const showAddAdminDialog = ref(false)
const showNewCategoryDialog = ref(false)
const newCategoryName = ref('')
const newCategoryColor = ref('#1E2157')
const savingCategory = ref(false)

// ── Mobile wizard ──────────────────────────────────────────────────────────
const forceWizard = route.query.wizard === '1'
const isMobile = ref(false)
const mobileStep = ref(0)
// The wizard's steps. `desc` tells the user what this step is for — shown at the
// top of each section (and it's the single source of truth for the step count,
// which is why Date isn't listed: it lives inside Event Info now).
const mobileSteps = [
  { label: 'Event info', desc: 'Name the event, set when it runs, and how people find it.' },
  { label: 'Location', desc: 'Where is it happening? Pick a venue, an address, or make it online.' },
  { label: 'Invitees', desc: 'Choose who gets invited. You can add more people after it is created.' },
  { label: 'Visibility', desc: 'Decide who can see this event and whether the public can find it.' },
  { label: 'Fees', desc: 'Add any charges for attending. Leave empty if the event is free.' },
  { label: 'Settings', desc: 'Registration form, terms, and the finishing touches.' },
]
const stepDesc = (label: string) => mobileSteps.find(s => s.label.toLowerCase() === label.toLowerCase())?.desc ?? ''

function mobileNext() {
  if (mobileStep.value < mobileSteps.length - 1) {
    mobileStep.value++
    // Scroll content area back to top on step change
    nextTick(() => {
      document.querySelector('.overflow-y-auto')?.scrollTo(0, 0)
    })
  } else {
    saveEvent()
  }
}

function mobileBack() {
  if (mobileStep.value > 0) {
    mobileStep.value--
    nextTick(() => {
      document.querySelector('.overflow-y-auto')?.scrollTo(0, 0)
    })
  } else {
    navigateTo('/events')
  }
}

// ──────────────────────────────────────────────────────────────────────────

const categoryColorPalette = [
  '#1E2157', '#3B82F6', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#6B7280', '#1EA97C', '#F97316', '#84CC16',
]

async function createCategory() {
  if (!newCategoryName.value.trim()) return
  savingCategory.value = true
  const { data, error } = await db.from('categories').insert({
    org_id: orgId.value,
    name: newCategoryName.value.trim(),
    color: newCategoryColor.value,
  }).select('id, name, color').single()
  if (!error && data) {
    categories.value.push(data)
    form.category_ids.push(data.id)
    toast.add({ severity: 'success', summary: 'Calendar created', life: 2000 })
  }
  showNewCategoryDialog.value = false
  newCategoryName.value = ''
  newCategoryColor.value = '#1E2157'
  savingCategory.value = false
}
const bannerInput = ref<HTMLInputElement | null>(null)

import type { LocationEntry } from '~/composables/useLocation'

// Availability checking for venue bookables
const allBookables = ref<any[]>([])
const availabilityMap = reactive<Record<string, 'available' | 'booked'>>({})
const checkingAvailability = ref(false)

const availabilityTimeLabel = computed(() => {
  if (!form.start_time) return 'event time not set'
  const t = new Date(form.start_time as Date)
  const h = t.getHours(); const m = t.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${m}${ampm}`
})

async function recheckAvailability() {
  checkingAvailability.value = true
  for (const b of allBookables.value) availabilityMap[b.id] = 'available'
  await new Promise(r => setTimeout(r, 600))
  checkingAvailability.value = false
  toast.add({ severity: 'success', summary: 'Availability updated', life: 2000 })
}


const visibilityOptions = [
  { key: 'is_public',           label: 'Public event',          desc: 'Visible to anyone' },
  { key: 'is_featured',         label: 'Featured',              desc: 'Highlighted on member profiles' },
  { key: 'show_attendee_list',  label: 'Show attendee list',    desc: 'Members can see who is attending' },
  { key: 'show_attendee_count', label: 'Show attendee count',   desc: 'Display registration numbers' },
  { key: 'allow_interest',      label: 'Allow interest',        desc: 'Members can indicate interest' },
  { key: 'hold_spot_enabled',   label: 'Hold-spot registration',desc: 'Allow pending confirmation spots' },
]

const adminDraft = reactive({ name: '', registrations: true, changes: false, notes: false })

function addAdmin() {
  form.admins.push({ ...adminDraft })
  Object.assign(adminDraft, { name: '', registrations: true, changes: false, notes: false })
  showAddAdminDialog.value = false
}

// Pre-fill date from query param
function parseDateParam(str: string | null): Date | null {
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

const twoWeeksAgo = new Date()
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
twoWeeksAgo.setHours(0, 0, 0, 0)

const dateOpen = ref(true)

// The sign-up window is stored as two single date-times, but <DateTimeEditor>
// models date and time separately. Split on read, merge on write — picking a
// time before a date seeds today so the value is never half-formed.
function withDate(base: Date | null, d: Date | null): Date | null {
  if (!d) return null
  const out = base ? new Date(base) : new Date(d)
  out.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
  if (!base) out.setHours(0, 0, 0, 0)
  return out
}
function withTime(base: Date | null, t: Date | null): Date | null {
  if (!t) return base ? null : null
  const out = base ? new Date(base) : new Date()
  out.setHours(t.getHours(), t.getMinutes(), 0, 0)
  return out
}
// Does this event require sign-up? Gates the sign-up window. Turning it off
// clears any window already picked so a stale one can't be saved.
const signupRequired = ref(false)
function onSignupRequired(v: boolean) {
  if (!v) {
    form.reg_open_at = null
    form.reg_close_at = null
  }
}
const regOpenDate = computed({
  get: () => form.reg_open_at,
  set: (v: Date | null) => { form.reg_open_at = withDate(form.reg_open_at, v) },
})
const regOpenTime = computed({
  get: () => form.reg_open_at,
  set: (v: Date | null) => { form.reg_open_at = withTime(form.reg_open_at, v) },
})
const regCloseDate = computed({
  get: () => form.reg_close_at,
  set: (v: Date | null) => { form.reg_close_at = withDate(form.reg_close_at, v) },
})
const regCloseTime = computed({
  get: () => form.reg_close_at,
  set: (v: Date | null) => { form.reg_close_at = withTime(form.reg_close_at, v) },
})

const formDateDisplay = computed(() => {
  const fDate = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const fTime = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
  const startDate = form.start_date ? new Date(form.start_date as any) : null
  const endDate   = form.end_date   ? new Date(form.end_date as any)   : null
  const startTime = form.start_time ? new Date(form.start_time as any) : null
  const endTime   = form.end_time   ? new Date(form.end_time as any)   : null
  if (!startDate) return { start: null, end: null, days: null }
  const sameDay = endDate ? startDate.toDateString() === endDate.toDateString() : true
  let start = '', end: string | null = null
  if (form.is_all_day) {
    start = fDate(startDate)
    if (endDate && !sameDay) end = fDate(endDate)
  } else {
    const st = startTime ? fTime(startTime) : ''
    const et = endTime   ? fTime(endTime)   : ''
    if (sameDay || !endDate) {
      start = fDate(startDate) + (st ? `, ${st}` : '')
      if (et) end = et
    } else {
      start = fDate(startDate) + (st ? `, ${st}` : '')
      end = fDate(endDate!) + (et ? `, ${et}` : '')
    }
  }
  const days = (form.is_all_day && endDate && !sameDay)
    ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    : null
  return { start, end, days }
})

const form = reactive({
  title: (route.query.name as string) ?? '',
  description: '',
  category_ids: [] as string[],
  // Dates
  is_all_day: false,
  start_date: parseDateParam(route.query.date as string ?? null),
  start_time: null as Date | null,
  end_date: parseDateParam(route.query.date as string ?? null),
  end_time: null as Date | null,
  repeat: '',
  exdates: [] as string[],
  // Locations (multi)
  locations: [{ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] as string[] }] as LocationEntry[],
  has_capacity: false,
  capacity_max: null as number | null,
  // Visibility
  is_public: false,
  is_featured: false,
  show_attendee_list: false,
  show_attendee_count: true,
  allow_interest: false,
  hold_spot_enabled: false,
  has_waitlist: false,
  // Sign-up window
  reg_open_at: null as Date | null,
  reg_close_at: null as Date | null,
  // Fees
  is_paid: false,
  fees: [] as { name: string; account: string; amount: number | null }[],
  // Settings
  banner_url: '',
  custom_terms: [] as string[],
  admins: [] as { name: string; registrations: boolean; changes: boolean; notes: boolean }[],
  // Registration form (gated by toggle). Mirrors the shape the
  // FormBuilder + /forms/[id].vue use, so save logic is portable.
  use_registration_form: false,
  registration_form: emptyRegistrationForm() as any,
})

// Mirrors emptyForm() / coreFields() from /pages/forms/[id].vue so
// the basic event ships with the same default registration template
// as the standalone form builder.
function freshFieldKey() { return crypto.randomUUID() }
function defaultRegistrationFields() {
  return [
    { _key: freshFieldKey(), field_type: 'text',     label: 'First Name',       is_required: true,  placeholder: 'John',                     has_placeholder: true,  helper_text: '', has_helper_text: false, col_span: 1, _optionsText: '', core: 'first_name' },
    { _key: freshFieldKey(), field_type: 'text',     label: 'Last Name',        is_required: true,  placeholder: 'Smith',                    has_placeholder: true,  helper_text: '', has_helper_text: false, col_span: 1, _optionsText: '', core: 'last_name'  },
    { _key: freshFieldKey(), field_type: 'text',     label: 'Email Address',    is_required: true,  placeholder: 'you@example.com',          has_placeholder: true,  helper_text: '', has_helper_text: false, col_span: 2, _optionsText: '', core: 'email'      },
    { _key: freshFieldKey(), field_type: 'text',     label: 'Phone Number',     is_required: false, placeholder: '+64…',                     has_placeholder: true,  helper_text: '', has_helper_text: false, col_span: 2, _optionsText: '', core: 'phone'      },
    { _key: freshFieldKey(), field_type: 'number',   label: 'People Attending', is_required: false, placeholder: '1',                        has_placeholder: true,  helper_text: 'How many people are attending?', has_helper_text: true, col_span: 1, _optionsText: '', core: 'attendees' },
    { _key: freshFieldKey(), field_type: 'textarea', label: 'Notes',            is_required: false, placeholder: 'Any special requirements…', has_placeholder: true, helper_text: '', has_helper_text: false, col_span: 2, _optionsText: '', core: 'notes'     },
  ]
}
function emptyRegistrationForm() {
  return {
    name: '',
    description: '',
    fields: defaultRegistrationFields(),
    terms: [] as any[],
    settings: {
      submitLabel: 'Submit',
      confirmMessage: '',
      formHeading: 'Fill in the form to register',
    },
    sectionSaved: { settings: false, fields: false, terms: false } as Record<string, boolean>,
  }
}

const totalFees = computed(() =>
  form.fees.reduce((sum, f) => sum + (f.amount ?? 0), 0)
)

function addFee() {
  form.fees.push({ name: '', account: '', amount: null })
}

const { uploadFile } = useUpload()
const uploadingBanner = ref(false)

function triggerBannerUpload() {
  bannerInput.value?.click()
}

async function handleBannerUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  form.banner_url = URL.createObjectURL(file)
  uploadingBanner.value = true
  try {
    form.banner_url = await uploadFile(file)
  } finally {
    uploadingBanner.value = false
  }
}

function buildDateTime(date: Date | null, time: Date | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (time) d.setHours((time as Date).getHours(), (time as Date).getMinutes(), 0, 0)
  else d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Persists the registration-form draft to registration_forms +
// form_fields and returns the form id. Mirrors /forms/[id].vue's save
// logic so a form created here is editable from /forms/:id afterward.
async function saveRegistrationForm(eventTitle: string): Promise<string | null> {
  const draft = form.registration_form
  const formName = draft.name?.trim() || `${eventTitle.trim() || 'Event'} registration`
  const config: any = {
    description: draft.description || null,
    terms: (draft.terms ?? []).map(({ _key, ...rest }: any) => rest),
    settings: { ...draft.settings },
    sectionSaved: { ...draft.sectionSaved },
  }
  const { data, error } = await (db.from as any)('registration_forms').insert({
    org_id: orgId.value,
    name: formName,
    config,
  }).select('id').single()
  if (error) throw error
  const formId = data.id

  if (draft.fields.length) {
    const typeToDb: Record<string, string> = {
      text: 'SHORT_TEXT', textarea: 'LONG_TEXT', select: 'SINGLE_SELECT',
      checkbox: 'TOGGLE', number: 'NUMBER', date: 'DATE', file: 'FILE',
    }
    const rows = draft.fields.map((f: any, idx: number) => ({
      form_id: formId,
      field_type: typeToDb[f.field_type] ?? 'SHORT_TEXT',
      label: f.label || 'Untitled',
      placeholder: f.has_placeholder ? (f.placeholder || null) : null,
      help_text: f.has_helper_text ? (f.helper_text || null) : null,
      is_required: !!f.is_required,
      sort_order: idx,
      page_number: 1,
      options: f.field_type === 'select'
        ? JSON.stringify((f._optionsText || '').split('\n').map((s: string) => s.trim()).filter(Boolean))
        : null,
    }))
    await (db.from as any)('form_fields').insert(rows)
  }
  // Per-field metadata (col_span, core, has_helper_text, etc.) lives in
  // registration_forms.config so it round-trips back through the builder.
  const fieldMeta = draft.fields.reduce((acc: any, f: any) => {
    acc[f.label] = {
      col_span: f.col_span,
      core: f.core,
      has_helper_text: f.has_helper_text,
      has_visibility_conditions: f.has_visibility_conditions,
      visibility_conditions: f.visibility_conditions,
      has_financial_increase: f.has_financial_increase,
      financial_rules: f.financial_rules,
    }
    return acc
  }, {})
  await (db.from as any)('registration_forms').update({
    config: { ...config, fieldMeta },
  }).eq('id', formId)
  return formId
}

async function saveEvent() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    let registrationFormId: string | null = null
    if (form.use_registration_form) {
      registrationFormId = await saveRegistrationForm(form.title)
    }
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category_id: form.category_ids[0] ?? null,
      secondary_category_id: form.category_ids[1] ?? null,
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
      is_public: form.is_public,
      is_featured: form.is_featured,
      show_attendee_list: form.show_attendee_list,
      show_attendee_count: form.show_attendee_count,
      allow_interest: form.allow_interest,
      hold_spot_enabled: form.hold_spot_enabled,
      reg_open_at: form.reg_open_at ?? null,
      reg_close_at: form.reg_close_at ?? null,
      form_id: registrationFormId,
      status: 'DRAFT',
    }

    let evtId: string
    if (draftEventId.value) {
      const { error } = await db.from('events').update(payload).eq('id', draftEventId.value)
      if (error) throw error
      evtId = draftEventId.value
    } else {
      const { data, error } = await db.from('events').insert({ ...payload, org_id: orgId.value, style: 'BASIC' }).select('id').single()
      if (error) throw error
      evtId = data.id
    }

    if (form.is_paid && form.fees.length) {
      const feeRows = form.fees.filter(f => f.name.trim()).map(f => ({
        event_id: evtId,
        name: f.name.trim(),
        amount: f.amount ?? 0,
        xero_code: f.account || null,
      }))
      if (feeRows.length) await db.from('fee_components').insert(feeRows)
    }

    // Sync venue bookings — create EVENT_DRIVEN booking rows so the event
    // shows up on each linked venue's bookings calendar.
    const bookableIds: string[] = (form.locations ?? [])
      .filter((l: any) => l.type === 'BOOKABLE')
      .flatMap((l: any) => l.bookable_ids ?? [])
    if (bookableIds.length && payload.start_at && payload.end_at) {
      // Replace any existing event-driven bookings for this event
      await db.from('bookings').delete().eq('event_id', evtId).eq('type', 'EVENT_DRIVEN')
      await db.from('bookings').insert(
        bookableIds.map(bid => ({
          bookable_id: bid,
          event_id: evtId,
          type: 'EVENT_DRIVEN',
          status: 'CONFIRMED',
          start_at: payload.start_at,
          end_at: payload.end_at,
          purpose: payload.title,
          is_all_day: payload.is_all_day,
        })),
      )
    }

    toast.add({ severity: 'success', summary: 'Event saved!', life: 3000 })
    navigateTo(`/events/${evtId}`)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: err?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  ;(db.from as any)('organisations').select('currency').eq('id', orgId.value).single()
    .then(({ data }: any) => { orgCurrency.value = data?.currency || 'NZD' })
  // Detect mobile — wizard also forced via ?wizard=1 query param
  isMobile.value = forceWizard || window.innerWidth < 768
  const onResize = () => { if (!forceWizard) isMobile.value = window.innerWidth < 768 }
  window.addEventListener('resize', onResize)
  onUnmounted(() => window.removeEventListener('resize', onResize))

  const [{ data: catData }, { data: bookableData }] = await Promise.all([
    db.from('categories').select('id, name, color').eq('org_id', orgId.value).order('name'),
    db.from('bookables').select('id, name, parent_id').eq('org_id', orgId.value).order('name'),
  ])
  categories.value = catData ?? []
  allBookables.value = bookableData ?? []
  for (const b of allBookables.value) availabilityMap[b.id] = 'available'

  // Create a draft event so EventInviteeManager has an ID to work with
  const { data } = await db.from('events').insert({
    org_id: orgId.value,
    title: '(draft)',
    style: 'BASIC',
    status: 'DRAFT',
  }).select('id').single()
  if (data) draftEventId.value = data.id
})
</script>
