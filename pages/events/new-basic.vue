<template>
  <!-- STEPPED = a modal over the app. The wizard is a focused task, so the left
       rail and page chrome are covered by the scrim rather than framing it.
       Teleported to <body> because rendered in place it sits inside <main>,
       which is below the nav rail (z-60) — the rail stayed clickable through
       the scrim. `app-modal-overlay` is the hook <ReviewWidget> uses to know a
       modal is up (so its floating comment trigger appears).

       FULL = an ordinary page inside the app shell. No teleport, no scrim: it's
       somewhere you sit and edit, not a task you're pushed through. -->
  <!-- Host for full mode. Teleport's `to` is switched rather than `disabled`:
       a disabled Teleport at a page root under Suspense crashes Vue's
       moveTeleport ("insertBefore: parameter 1 is not of type 'Node'"). -->
  <div id="event-form-host" />

  <Teleport :to="stepped ? 'body' : '#event-form-host'">
  <div :class="stepped
      ? 'app-modal-overlay fixed inset-0 flex items-stretch sm:items-center justify-center sm:p-6 bg-slate-900/45 backdrop-blur-[2px]'
      : ''"
    :style="stepped ? 'z-index: 1000' : ''">
  <div :class="stepped
      ? 'flex flex-col bg-white w-full h-full sm:h-[92vh] sm:max-w-[1200px] sm:rounded-xl shadow-2xl overflow-hidden'
      : 'flex flex-col bg-white h-[calc(100vh-3.5rem)]'">

    <!-- ── Stepped header (step nav + progress bar) — same brand bar as the
         desktop header and every dialog. ── -->
    <div v-if="stepped" class="shrink-0 bg-white border-b border-gray-200">
      <div class="modal-header-bar flex items-center gap-3 !py-2.5">
        <span class="modal-header-title flex-1">{{ form.title.trim() || 'Create Event' }}</span>
        <!-- Bin the event outright — closing only leaves the draft behind. -->
        <button
          class="w-9 h-9 flex items-center justify-center rounded-lg text-white/75 hover:text-white hover:bg-red-500/60 transition-colors"
          v-tooltip.bottom="'Delete this event'"
          aria-label="Delete event"
          @click="confirmDeleteOpen = true">
          <i class="pi pi-trash text-sm" />
        </button>
        <button
          class="w-9 h-9 flex items-center justify-center rounded-lg text-white/75 hover:text-white hover:bg-white/15 transition-colors"
          v-tooltip.bottom="'Close — your progress is kept'"
          aria-label="Close"
          @click="navigateTo('/events')">
          <i class="pi pi-times text-sm" />
        </button>
      </div>

      <!-- Every step on show, not "step 2 of 6": the point of a wizard header is
           knowing what's coming and how far in you are. Visited steps are
           clickable; the numbered-circle treatment matches the advanced builder. -->
      <div class="flex items-center px-4 md:px-6 py-3 gap-0 overflow-x-auto no-scrollbar">
        <template v-for="(s, idx) in mobileSteps" :key="s.key">
          <div class="flex items-center gap-2 shrink-0"
            :class="idx < mobileStep ? 'cursor-pointer' : ''"
            @click="idx < mobileStep && (mobileStep = idx)">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
              :class="idx < mobileStep
                ? 'bg-primary text-white'
                : idx === mobileStep
                  ? 'bg-primary text-white ring-4 ring-primary/20'
                  : 'bg-gray-100 text-gray-400'">
              <i v-if="idx < mobileStep" class="pi pi-check text-[10px]" />
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span class="text-xs font-medium whitespace-nowrap hidden sm:inline"
              :class="idx <= mobileStep ? 'text-gray-800' : 'text-gray-400'">
              {{ s.label }}
            </span>
          </div>
          <div v-if="idx < mobileSteps.length - 1" class="flex-1 min-w-[16px] h-px mx-2 shrink-0"
            :class="idx < mobileStep ? 'bg-primary' : 'bg-gray-200'" />
        </template>
      </div>
    </div>

    <Dialog v-model:visible="confirmDeleteOpen" header="Delete this event?" modal
      :style="{ width: '95vw', maxWidth: '420px' }">
      <p class="text-sm text-gray-600">
        <span class="font-medium text-gray-800">{{ form.title.trim() || 'This event' }}</span> will be deleted, along
        with anything set up on it so far. This can't be undone.
      </p>
      <template #footer>
        <Button label="Keep it" size="small" severity="secondary" text @click="confirmDeleteOpen = false" />
        <Button label="Delete event" icon="pi pi-trash" size="small" severity="danger"
          :loading="deleting" @click="deleteEvent" />
      </template>
    </Dialog>

    <!-- Full mode: a plain action row, no brand bar. -->
    <div v-if="!stepped" class="shrink-0 border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-end gap-2">
      <button
        class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        v-tooltip.bottom="'Delete this event'"
        @click="confirmDeleteOpen = true">
        <i class="pi pi-trash text-sm" />
      </button>
      <Button label="Save Event" icon="pi pi-check" size="small" :loading="saving"
        :disabled="!step1Complete"
        v-tooltip.bottom="step1Complete ? undefined : (dateInvalidReason || 'Give the event a name.')"
        style="background:var(--brand-primary); border-color:var(--brand-primary)"
        @click="saveEvent" />
    </div>

    <!-- ── Body: form on the left, live summary rail on the right ── -->
    <div class="flex-1 min-h-0 flex">

    <!-- ── Scrollable content ── -->
    <div class="flex-1 min-w-0 overflow-y-auto bg-[#F5F8FA]">
      <div class="mx-auto px-4 sm:px-6 py-5 sm:py-6"
        :class="stepped ? 'max-w-[1540px]' : 'max-w-[900px] space-y-8'">

        <!-- ─ Event Info ─ -->
        <div :class="isStep('info') ? 'px-1' : 'hidden'">
          <div class="mb-3">
            <h2 class="section-title">Event info</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Event info') }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Title -->
            <div class="px-5 py-4 border-b border-gray-100">
              <!-- Label sits LEFT of the field, in the stepped view too (it only
                   stacks on a genuinely narrow screen). -->
              <div class="grid grid-cols-1 sm:grid-cols-[120px_1fr] items-center gap-1.5 sm:gap-4">
                <label class="field-label">Event Title <span class="text-red-400">*</span></label>
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
                :minStartDate="today"
                :minEndDate="form.start_date ?? today"
                label="Date"
                required
                label-width="w-[120px]"
                label-class="text-gray-800 font-semibold"
                row-padding="px-0 py-2"
              />
              <!-- Why you can't proceed — a disabled button with no reason is a
                   dead end. Only nags once the user has engaged with the form. -->
              <div v-if="dateInvalidReason && (form.title.trim() || form.start_date)"
                class="py-1 sm:pl-[136px]">
                <span class="inline-flex items-center gap-2 rounded-md bg-red-50 border border-red-100 px-2.5 py-1.5">
                  <i class="pi pi-exclamation-circle text-red-500 text-xs" />
                  <span class="text-xs font-medium text-red-600">{{ dateInvalidReason }}</span>
                </span>
              </div>
            </div>
            <!-- Description -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div :class="isMobile ? 'space-y-1.5' : 'grid grid-cols-[120px_1fr] gap-4'">
                <label class="field-label pt-1">Description</label>
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
                  <label class="field-label block mb-1.5">Category</label>
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
                    <label class="field-label block mb-1.5">Discipline</label>
                    <DisciplineLinker v-if="draftEventId" entity-type="event" :entity-id="draftEventId" />
                    <p v-else class="text-sm text-gray-400 flex items-center gap-2">
                      <i class="pi pi-spin pi-spinner text-xs" /> Preparing…
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <!-- Age limit -->
            <div class="px-5 py-4">
              <div :class="isMobile ? 'space-y-1.5' : 'grid grid-cols-[120px_1fr] items-center gap-4'">
                <label class="field-label">Age limit</label>
                <div class="flex items-center gap-2 flex-wrap">
                  <InputNumber v-model="form.ageMin" :min="0" :max="120" placeholder="Min" class="w-24" inputClass="w-24" />
                  <span class="text-sm text-gray-400">to</span>
                  <InputNumber v-model="form.ageMax" :min="0" :max="120" placeholder="Max" class="w-24" inputClass="w-24" />
                  <span class="text-xs text-gray-400">years — optional; validated at signup</span>
                </div>
              </div>
            </div>
            <!-- Banner -->
            <div class="px-5 py-4">
              <div :class="isMobile ? 'space-y-1.5' : 'grid grid-cols-[120px_1fr] gap-4'">
                <label class="field-label pt-1">Banner</label>
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
        <div :class="isStep('location') ? 'px-1' : 'hidden'">
          <div class="mb-3">
            <h2 class="section-title">Location</h2>
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

        <!-- ─ Fees ─ -->
        <div :class="isStep('fees') ? 'px-1' : 'hidden'">
          <div class="mb-3">
            <h2 class="section-title">Fees</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Fees') }}</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700">Are attendees charged?</p>
                <p class="text-xs text-gray-500 mt-0.5">Enable to add fee components to this event</p>
              </div>
              <div class="flex gap-0">
                <button class="px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors" :class="!form.is_paid ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'" @click="setFees(false)">Free</button>
                <button class="px-4 py-2 text-sm font-medium border rounded-r-lg transition-colors" :class="form.is_paid ? 'bg-primary border-primary text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'" @click="setFees(true)">Charged</button>
              </div>
            </div>
            <!-- The app's one fee table (drag-to-reorder, Xero account picker,
                 token insert, mobile card layout). This step used to hand-roll
                 its own copy, which drifted from the other nine usages. -->
            <FeeLineItemsTable v-if="form.is_paid" v-model="form.fees" />
          </div>

          <!-- Discounts — the SAME <EventDiscountDialog> + condition model as
               the advanced event editor (useEventDiscounts). One discount
               system, not a wizard-only variant. -->
          <div v-if="form.is_paid" class="bg-white rounded-xl border border-gray-200 p-5 space-y-4 mt-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-gray-700">Discounts</p>
                <p class="text-xs text-gray-500 mt-0.5">Early bird, members only, siblings, promo codes — set who qualifies.</p>
              </div>
              <Button label="Add discount" icon="pi pi-plus" size="small" severity="secondary" outlined @click="openDiscount" />
            </div>

            <div v-if="!form.discounts.length" class="text-center py-4 text-sm text-gray-400">
              No discounts. Everyone pays the full {{ money(totalFees) }}.
            </div>

            <div v-else class="space-y-2">
              <div v-for="(d, idx) in form.discounts" :key="d.id"
                class="border border-gray-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-gray-800">{{ d.name || 'Untitled discount' }}</span>
                    <span class="shrink-0 font-semibold text-primary text-sm">{{ discountAmountLabel(d) }}</span>
                  </div>
                  <div class="flex flex-wrap gap-1 mt-1.5">
                    <span v-for="(c, ci) in d.conditions.filter(x => x.key)" :key="ci"
                      class="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-primary/8 text-primary">{{ conditionLabel(c) }}</span>
                    <span v-if="!d.conditions.filter(x => x.key).length" class="text-xs text-gray-400 italic">Always applied</span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1.5">{{ discountSummary(d) }}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <Button icon="pi pi-pencil" text size="small" severity="secondary" @click="editDiscount(idx)" />
                  <Button icon="pi pi-trash" text size="small" severity="danger" @click="form.discounts.splice(idx, 1)" />
                </div>
              </div>
            </div>
          </div>

          <!-- One-discount-only setting (same as the advanced editor) -->
          <div v-if="form.is_paid" class="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3.5 mt-4">
            <div>
              <p class="text-sm font-medium text-gray-700">Limit to one discount per registration</p>
              <p class="text-xs text-gray-400 mt-0.5">When multiple rules match, only the best discount is applied.</p>
            </div>
            <ToggleSwitch v-model="discountSettings.one_discount_only" />
          </div>

          <EventDiscountDialog v-model:visible="discountFlowOpen" :edit="discountEditDraft" :currency-symbol="currencySymbol" @save="onDiscountSave" />
        </div>

        <!-- ─ Invitees ─ -->
        <div :class="isStep('invitees') ? 'px-1' : 'hidden'">
          <div class="mb-3">
            <h2 class="section-title">Who it's for</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc("Who it's for") }}</p>
          </div>
          <!-- One step, four questions, in the order you'd actually ask them:
               can the public register? → what do they fill in? → when is sign-up
               open? → and who from the club are we inviting? -->

          <!-- 1. Public registrations -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-800">Public registrations</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  Can anyone with the link sign up, or is this for your club only?
                </p>
              </div>
              <!-- Same control as Registration form style below — one visual
                   language for "pick one of two" on this step. -->
              <SelectButton :model-value="invitePublic" :options="publicOptions"
                option-label="label" option-value="value" :allow-empty="false" class="shrink-0"
                @update:model-value="setInvitePublic" />
            </div>
          </div>

          <!-- 2. Registration form style. RSVP = no form at all (the answer is the
               invitee's status); Custom form = the designer on the next step.
               The public can't RSVP — a stranger has no profile to look up — so
               saying yes above forces Custom form. -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-800">Registration form style</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ attendeeAction === 'form'
                    ? 'Ask them whatever you need — one form, for everyone.'
                    : 'They just reply yes or no. Nothing to fill in.' }}
                </p>
              </div>
              <SelectButton :model-value="attendeeAction" :options="attendeeActionOptions"
                option-label="label" option-value="value" option-disabled="disabled"
                :allow-empty="false" class="shrink-0"
                @update:model-value="setAttendeeAction" />
            </div>
            <p v-if="invitePublic" class="text-xs text-gray-500 mt-3 flex items-start gap-1.5">
              <i class="pi pi-info-circle text-gray-300 text-xs mt-0.5" />
              The public don't have a profile you can look up, so they have to fill in a form — yes/no on its own
              wouldn't tell you who they are.
            </p>
          </div>

          <!-- 3. Sign-up window. No toggle: there is ALWAYS a window, and the sane
               one is "from now until the event starts" — so that's what it's
               seeded with (see seedSignupWindow). The user just adjusts it. -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <p class="text-sm font-medium text-gray-800">When can people sign up?</p>
            <p class="text-xs text-gray-500 mt-0.5">Open from now until the event starts. Change it if you want a different window.</p>
            <DateTimeEditor
              class="mt-3 pt-3 border-t border-gray-100"
              v-model:startDate="regOpenDate"
              v-model:startTime="regOpenTime"
              v-model:endDate="regCloseDate"
              v-model:endTime="regCloseTime"
              :show-all-day="false"
              :show-repeat="false"
              :min-start-date="today"
              :min-end-date="regOpenDate ?? today"
              label="Sign up"
              start-label="Opens"
              end-label="Closes"
              label-width="w-[120px]"
              row-padding="px-0 py-2" />
          </div>

        </div>

        <!-- ─ Choose invitees ─
             Its own step: picking the people is a job in itself (classes,
             individuals, a searchable roster) and deserves the whole page.
             No heading here — <EventInviteeManager> brings its own. -->
        <div :class="isStep('people') ? 'px-1' : 'hidden'">
          <div v-if="!draftEventId" class="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
            <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
            Setting up invitees…
          </div>
          <EventInviteeManager v-else :event-id="draftEventId" :show-invite="false" />
        </div>

        <!-- ─ Registration form ─
             Only exists when the event actually collects one — the "what do they
             need to do?" choice on the Invitees step is what turns it on (either
             they picked "fill in a form", or the event was opened to the public,
             which forces one). An RSVP-only event never sees this step. -->
        <div v-if="form.use_registration_form" :class="isStep('form') ? 'px-1' : 'hidden'">
          <div class="mb-3">
            <h2 class="section-title">Registration form</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Registration form') }}</p>
          </div>
          <!-- ONE form, ONE builder. This is the same <FormDesigner> the advanced
               event uses — it opens with its own "Basic / start from scratch /
               preset" chooser (so the wizard doesn't need to duplicate it), owns
               who-registers, the fields and the profile-vs-event connection of
               each one, and autosaves straight to registration_forms.config +
               events.form_id. Both audiences fill THIS form: a member simply gets
               it pre-filled from their profile, the public gets it blank. -->
          <div v-if="!draftEventId" class="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
            <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
            Setting up the form…
          </div>
          <!-- flex column + definite height so FormDesigner's absolute two-panel
               layout resolves (otherwise it collapses to nothing). -->
          <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style="height:70vh; min-height:560px">
            <FormDesigner :event-id="draftEventId" :discount-settings="discountSettings" :age-min="form.ageMin" :age-max="form.ageMax" embedded class="flex-1 min-h-0" />
          </div>
        </div>

        <!-- ─ Settings ─ -->
        <div :class="isStep('settings') ? 'px-1' : 'hidden'">
          <div class="mb-3">
            <h2 class="section-title">Settings</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Settings') }}</p>
          </div>
          <!-- Visibility used to be its own step. It's the same KIND of question as
               everything else here — how the event behaves once it exists — so it
               lives with the other finishing touches instead of costing a click. -->
          <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-800 mb-3">Visibility</h3>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <!-- Honesty notice: these choices are saved but not yet enforced. -->
            <div class="flex items-start gap-2 mb-4 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <i class="pi pi-info-circle text-amber-500 text-xs mt-0.5" />
              <p class="text-xs text-amber-800">
                These choices are saved with the event, but aren't enforced yet — the public events page is still
                being built. For now, anyone with the registration link can sign up.
              </p>
            </div>
            <!-- Two columns in the stepped wizard too — only a phone-width screen
                 needs them stacked. -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div v-for="vis in visibilityOptions" :key="vis.key" class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-gray-700">{{ vis.label }}</p>
                  <p class="text-xs text-gray-500">{{ vis.desc }}</p>
                </div>
                <ToggleSwitch v-model="form[vis.key]" />
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
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

            <!-- ── Tell them ──
                 Sending belongs at the END: you pick the people on an earlier
                 step, then decide to tell them once everything else is settled.
                 The email adapts to the event (RSVP buttons vs a Register link)
                 and can be sent later from the event's own Invitees tab. -->
            <div v-if="draftEventId" class="pt-6 border-t border-gray-100">
              <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                <div class="flex-1">
                  <p class="text-sm font-medium text-gray-800">Invitation email</p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {{ attendeeAction === 'form'
                      ? 'Email your invitees a link to the registration form.'
                      : 'Email your invitees — they reply yes or no in one click.' }}
                    You can also send it later from the event.
                  </p>
                </div>
                <Button label="Send invitation" icon="pi pi-send" outlined class="shrink-0 w-full sm:w-auto justify-center"
                  @click="invitationOpen = true" />
              </div>
            </div>
          </div>
        </div>

        <EventInvitationDialog v-if="draftEventId" v-model:visible="invitationOpen" :event-id="draftEventId" />

        <!-- Desktop bottom spacer -->
        <div v-if="!isMobile" class="h-4" />
      </div>
    </div>

    <!-- ── Live summary rail — what the event looks like so far. Mirrors the
         booking wizard's invoice panel. Hidden on narrow screens, where the
         form itself needs the full width. ── -->
    <aside v-if="stepped" class="hidden lg:flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white overflow-y-auto">
      <!-- Banner -->
      <div v-if="form.banner_url" class="h-28 shrink-0 bg-gray-100">
        <img :src="form.banner_url" class="w-full h-full object-cover" />
      </div>

      <div class="p-5 space-y-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wide text-gray-400">Your event</p>
          <h3 class="text-base font-semibold mt-0.5" :class="form.title.trim() ? 'text-gray-900' : 'text-gray-300'">
            {{ form.title.trim() || 'Untitled event' }}
          </h3>
          <div v-if="summaryCategories.length" class="flex flex-wrap gap-1 mt-2">
            <span v-for="c in summaryCategories" :key="c.id"
              class="px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
              :style="{ background: c.color || '#1E2157' }">{{ c.name }}</span>
          </div>
        </div>

        <div class="border-t border-gray-100 pt-3 space-y-3">
          <!-- Each row greys out until it's actually been filled in, so the rail
               doubles as a checklist of what's left. -->
          <div class="flex gap-2.5">
            <i class="pi pi-calendar text-xs mt-1 shrink-0" :class="form.start_date ? 'text-primary' : 'text-gray-300'" />
            <div class="min-w-0">
              <p class="text-sm" :class="form.start_date ? 'text-gray-800' : 'text-gray-400'">{{ summaryWhen }}</p>
              <p v-if="summaryRepeat" class="text-xs text-gray-400">{{ summaryRepeat }}</p>
              <p v-if="summarySkipped" class="text-xs text-red-500 mt-0.5">{{ summarySkipped }}</p>
            </div>
          </div>

          <div class="flex gap-2.5">
            <i class="pi pi-map-marker text-xs mt-1 shrink-0" :class="summaryWhere ? 'text-primary' : 'text-gray-300'" />
            <p class="text-sm min-w-0 break-words" :class="summaryWhere ? 'text-gray-800' : 'text-gray-400'">
              {{ summaryWhere || 'No location yet' }}
            </p>
          </div>

          <!-- Fees only appear once the user has actually answered the fees
               question — "Free event" on a rail the user hasn't reached yet
               reads as a decision they never made. -->
          <div v-if="feesTouched" class="flex gap-2.5">
            <i class="pi pi-wallet text-xs mt-1 shrink-0" :class="form.is_paid ? 'text-primary' : 'text-gray-300'" />
            <div class="min-w-0 flex-1">
              <p class="text-sm" :class="form.is_paid ? 'text-gray-800' : 'text-gray-400'">
                {{ form.is_paid ? 'Charged' : 'Free event' }}
              </p>
              <template v-if="form.is_paid">
                <div v-for="fee in summaryFees" :key="fee.id" class="flex justify-between gap-2 text-xs text-gray-500 mt-0.5">
                  <span class="truncate">{{ fee.name || 'Unnamed fee' }}</span>
                  <span class="tabular-nums shrink-0">{{ money(fee.amount ?? 0) }}</span>
                </div>
                <div v-if="summaryFees.length" class="flex justify-between gap-2 text-xs font-semibold text-gray-800 mt-1 pt-1 border-t border-gray-100">
                  <span>Total</span><span class="tabular-nums">{{ money(totalFees) }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- What attendees have to do. ("Sign-up required" used to live here —
               now that every event has a sign-up window it told the user nothing.) -->
          <div class="flex gap-2.5">
            <i class="pi text-xs mt-1 shrink-0 text-primary"
              :class="attendeeAction === 'form' ? 'pi-file-edit' : 'pi-check-circle'" />
            <p class="text-sm text-gray-800">
              {{ attendeeAction === 'form' ? 'Fills in a form' : 'Replies yes or no' }}
            </p>
          </div>

          <div v-if="form.is_public" class="flex gap-2.5">
            <i class="pi pi-globe text-xs mt-1 shrink-0 text-primary" />
            <p class="text-sm text-gray-800">Public event</p>
          </div>

          <div v-if="form.has_capacity && form.capacity_max" class="flex gap-2.5">
            <i class="pi pi-users text-xs mt-1 shrink-0 text-primary" />
            <p class="text-sm text-gray-800">Capped at {{ form.capacity_max }} attendees</p>
          </div>
        </div>

        <p v-if="dateInvalidReason" class="text-xs text-red-500 border-t border-gray-100 pt-3">{{ dateInvalidReason }}</p>
      </div>
    </aside>

    </div>

    <!-- ── Mobile bottom navigation ── -->
    <!-- Step nav — stepped mode only; the full page saves from its header. -->
    <div v-if="stepped" class="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
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
        :disabled="mobileStep === 0 && !step1Complete"
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

const events = useEventsApi()
const financesApi = useFinancesApi()
const bookingsApi = useBookingsApi()
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
// This page has TWO presentations of the same form:
//   stepped (default) — the wizard: one step at a time, Back/Next.
//   full  (?mode=full) — every section on one scrolling page. This is what the
//                        "Custom event" route opens.
// They share all the fields, validation and saving — only the chrome differs.
//
// `narrow` is a separate concern: a phone-width screen, where a label can't sit
// beside its field. It was previously conflated with "stepped", which is what
// made reopening a draft dump you into the wrong layout.
const stepped = computed(() => route.query.mode !== 'full')
// Created from /programme (the events board carries programme=1) → tag the row.
const isProgramme = route.query.programme === '1'
const narrow = ref(false)
// Kept as an alias so the field-layout branches below keep reading naturally.
const isMobile = narrow
const mobileStep = ref(0)

// The summary rail stays silent about fees until the user has actually answered
// the Free/Charged question — on mobile, reaching the step counts as arriving at
// it; on desktop, only picking an answer does.

const feesTouched = ref(false)
const setFees = (paid: boolean) => {
  form.is_paid = paid
  feesTouched.value = true
  // Charging? Seed the first line item with the event's name — that's what the
  // fee is for, and it saves retyping it. Only when there's nothing there yet.
  if (paid && !form.fees.length) {
    form.fees.push({
      id: crypto.randomUUID(),
      name: form.title.trim(),
      xero_code: '',
      amount: null,
    })
  }
}
// Once they've reached the Fees step, the summary rail can show Free/Charged.
watch(mobileStep, () => { if (isStep('fees')) feesTouched.value = true })

// The invitation email is sent from the LAST step: you pick the people on the
// Choose-invitees step, then decide to tell them once everything else is settled.
const invitationOpen = ref(false)

// ── Can the public register? ───────────────────────────────────────────────
// A Yes/No question, not an audience card: inviting people from your club is
// ALWAYS available (that's the Choose-invitees step), so the only real question
// is whether STRANGERS can sign up too. Front end of the existing is_public setting.
const invitePublic = ref(false)
// Say what each choice MEANS rather than yes/no — inviting your own club happens
// either way (that's the picker below); the question is whether strangers can too.
const publicOptions = [
  { label: 'Public and club', value: true },
  { label: 'Club only', value: false },
]

// ── And what do they have to DO? ───────────────────────────────────────────
// Two ends of one dial, NOT two mechanisms:
//   'rsvp' → "are you coming, yes or no". The answer is the invitee's own status
//            (CONFIRMED/DECLINED, written by /rsvp/:event/:person). No form row
//            exists at all — a form is the opt-in layer, not the baseline.
//   'form' → yes/no isn't enough and you need to ask things. ONE form serves both
//            audiences: members get it pre-filled from their profile, the public
//            get it blank.
// The public can't RSVP — a stranger has no profile to look up, so "yes" alone
// wouldn't tell you who turned up. Opening the event to them forces the form on.
const attendeeAction = ref<'rsvp' | 'form'>('rsvp')

// RSVP is disabled (not hidden) while the event is public, so the choice stays
// visible and the reason can be explained rather than the option just vanishing.
const attendeeActionOptions = computed(() => [
  { label: 'RSVP only', value: 'rsvp', disabled: invitePublic.value },
  { label: 'Custom form', value: 'form', disabled: false },
])

function setAttendeeAction(a: 'rsvp' | 'form') {
  if (!a) return                                   // SelectButton can emit null
  if (a === 'rsvp' && invitePublic.value) return   // not offerable — see above
  attendeeAction.value = a
  form.use_registration_form = a === 'form'
}

function setInvitePublic(v: boolean) {
  if (v === null || v === undefined) return        // SelectButton can emit null
  invitePublic.value = v
  form.is_public = v
  if (v) attendeeAction.value = 'form'             // strangers must identify themselves
  form.use_registration_form = v || attendeeAction.value === 'form'
}

// Step 1 needs a name AND a valid date before you can move on (or save). A date
// is valid when there's a start, and — if an end is given — it isn't before it.
const dateInvalidReason = computed(() => {
  if (!form.start_date) return 'Pick a start date for the event.'
  if (form.end_date && new Date(form.end_date as Date) < new Date(form.start_date as Date)) {
    return 'The end date is before the start date.'
  }
  // An event needs a time window — unless it's explicitly an all-day event.
  if (!form.is_all_day) {
    if (!form.start_time || !form.end_time) {
      return 'Set a start and end time, or mark it as an all-day event.'
    }
    const s = new Date(form.start_time as Date), e = new Date(form.end_time as Date)
    const sameDay = !form.end_date
      || new Date(form.end_date as Date).toDateString() === new Date(form.start_date as Date).toDateString()
    if (sameDay && e <= s) return 'The end time is before the start time.'
  }
  return ''
})
const step1Complete = computed(() => !!form.title.trim() && !dateInvalidReason.value)

function mobileNext() {
  // Don't advance past step 1 on an incomplete/invalid date.
  if (mobileStep.value === 0 && !step1Complete.value) {
    toast.add({ severity: 'warn', summary: 'Check the details', detail: dateInvalidReason.value || 'Give the event a name.', life: 3000 })
    return
  }
  if (mobileStep.value < mobileSteps.value.length - 1) {
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
  try {
    const data = await events.createCategory({
      orgId: orgId.value,
      name: newCategoryName.value.trim(),
      color: newCategoryColor.value,
    })
    categories.value.push({ id: data.id, name: data.name, color: data.color })
    form.category_ids.push(data.id)
    toast.add({ severity: 'success', summary: 'Calendar created', life: 2000 })
  } catch { /* dialog closes below */ }
  showNewCategoryDialog.value = false
  newCategoryName.value = ''
  newCategoryColor.value = '#1E2157'
  savingCategory.value = false
}
const bannerInput = ref<HTMLInputElement | null>(null)

import type { LocationEntry } from '~/composables/useLocation'
import type { FeeLineItem } from '~/composables/useFeeGroups'

// Availability checking for venue bookables
const allBookables = ref<any[]>([])
const availabilityMap = reactive<Record<string, 'available' | 'booked'>>({})
const checkingAvailability = ref(false)

// "Availability for: 11:09am" doesn't say which day, or for how long. Show the
// whole window: "Sat 12th Jan · 11:09am – 12:09pm".
function clockLabel(d: Date) {
  const h = d.getHours(); const m = d.getMinutes().toString().padStart(2, '0')
  return `${h % 12 || 12}:${m}${h >= 12 ? 'pm' : 'am'}`
}
function ordinalDay(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}
const availabilityTimeLabel = computed(() => {
  const parts: string[] = []
  if (form.start_date) {
    const d = new Date(form.start_date as Date)
    const day = d.toLocaleDateString('en-NZ', { weekday: 'short' })
    const mon = d.toLocaleDateString('en-NZ', { month: 'short' })
    parts.push(`${day} ${ordinalDay(d.getDate())} ${mon}`)
  }
  // An all-day event has no clock times — say so rather than "time not set".
  if (form.is_all_day) {
    parts.push('All day')
  } else if (form.start_time) {
    const start = new Date(form.start_time as Date)
    const end = form.end_time ? new Date(form.end_time as Date) : null
    parts.push(end ? `${clockLabel(start)} – ${clockLabel(end)}` : clockLabel(start))
  } else {
    parts.push('event time not set')
  }
  return parts.join(' · ')
})

async function recheckAvailability() {
  checkingAvailability.value = true
  for (const b of allBookables.value) availabilityMap[b.id] = 'available'
  await new Promise(r => setTimeout(r, 600))
  checkingAvailability.value = false
  toast.add({ severity: 'success', summary: 'Availability updated', life: 2000 })
}


// NOTE: these all persist to `events` but NOTHING reads them yet — there is no
// public events listing, and /r/event/:id serves any non-cancelled event
// regardless of is_public. The copy below describes the INTENDED behaviour;
// the step shows a "not enforced yet" notice so nobody is misled.
const visibilityOptions = [
  { key: 'is_public',           label: 'Public event',           desc: 'Anyone can find and register — shows on your public events page and is shareable by link. No login needed.' },
  { key: 'is_featured',         label: 'Featured',               desc: 'Pinned to the top of the events page and highlighted on member dashboards.' },
  { key: 'show_attendee_list',  label: 'Show attendee list',     desc: 'Registrants can see who else is coming, by name, on the event page.' },
  { key: 'show_attendee_count', label: 'Show attendee count',    desc: 'Shows how many have registered (and spots left) without naming them.' },
  { key: 'allow_interest',      label: 'Allow interest',         desc: 'Members can register interest without committing — useful before you open sign-ups.' },
  { key: 'hold_spot_enabled',   label: 'Hold-spot registration', desc: 'Holds a spot while payment or approval is pending, instead of releasing it.' },
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

// An event can't start in the past — the earliest selectable date is today.
const today = new Date()
today.setHours(0, 0, 0, 0)

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
// The sign-up window is always present — there's no "do they need to sign up?"
// toggle, because the honest default (open now, closes when the event starts)
// is what nearly every event wants. We SEED it rather than force it: once the
// user has touched either end, we stop moving it under them.
const signupTouched = ref(false)
function seedSignupWindow() {
  if (signupTouched.value) return
  if (!form.reg_open_at) form.reg_open_at = new Date()          // from now…
  if (form.start_date) form.reg_close_at = eventStartsAt()      // …until it starts
}
// The event's start as one Date (the wizard keeps date + time apart).
function eventStartsAt(): Date | null {
  if (!form.start_date) return null
  const d = new Date(form.start_date as Date)
  const t = form.is_all_day ? null : (form.start_time as Date | null)
  if (t) { d.setHours(t.getHours(), t.getMinutes(), 0, 0) } else { d.setHours(0, 0, 0, 0) }
  return d
}
const regOpenDate = computed({
  get: () => form.reg_open_at,
  set: (v: Date | null) => { signupTouched.value = true; form.reg_open_at = withDate(form.reg_open_at, v) },
})
const regOpenTime = computed({
  get: () => form.reg_open_at,
  set: (v: Date | null) => { signupTouched.value = true; form.reg_open_at = withTime(form.reg_open_at, v) },
})
const regCloseDate = computed({
  get: () => form.reg_close_at,
  set: (v: Date | null) => { signupTouched.value = true; form.reg_close_at = withDate(form.reg_close_at, v) },
})
const regCloseTime = computed({
  get: () => form.reg_close_at,
  set: (v: Date | null) => { signupTouched.value = true; form.reg_close_at = withTime(form.reg_close_at, v) },
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
  // Seeded from a named calendar's sole category (?category=…) when creating there.
  category_ids: (route.query.category ? [route.query.category as string] : []) as string[],
  ageMin: null as number | null,
  ageMax: null as number | null,
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
  // Shared FeeLineItem shape (id / name / xero_code / amount) so <FeeLineItemsTable> can drive it.
  fees: [] as FeeLineItem[],
  discounts: [] as WizardDiscount[],
  // Settings
  banner_url: '',
  custom_terms: [] as string[],
  admins: [] as { name: string; registrations: boolean; changes: boolean; notes: boolean }[],
  // Does this event collect a form at all? (RSVP-only events don't.) The form
  // itself is NOT drafted here — <FormDesigner> owns it and autosaves against the
  // draft event, exactly as it does on the advanced event.
  use_registration_form: false,
})

// Re-seed while the user is still choosing WHEN the event runs — moving the
// event's start should carry the sign-up deadline with it.
// MUST stay below `form`: a watch getter runs immediately at setup, so declaring
// it up with seedSignupWindow() reads `form` before initialisation → TDZ 500.
// immediate: a fresh wizard has no start date yet, but sign-ups still open NOW —
// without it the window renders empty until the user happens to touch the date.
watch(() => [form.start_date, form.start_time, form.is_all_day], () => seedSignupWindow(), { immediate: true })

// The wizard's steps. Keyed, not index-based, because the step list is DYNAMIC —
// the registration-form step only exists when the event actually collects a form
// (they chose "fill in a form", or opened it to the public, which forces one).
// `desc` tells the user what the step is for and is the single source of truth
// for the step count (Date isn't listed: it lives inside Event info now).
const ALL_STEPS: { key: string; label: string; desc: string; when?: () => boolean }[] = [
  { key: 'info',       label: 'Event info',        desc: 'Name the event, set when it runs, and how people find it.' },
  { key: 'location',   label: 'Location',          desc: 'Where is it happening? Pick a venue, an address, or make it online.' },
  { key: 'fees',       label: 'Fees',              desc: 'Add any charges for attending. Leave empty if the event is free.' },
  // Two steps: the SETTINGS (can the public register? what do they fill in? when
  // is sign-up open?) then the PEOPLE — picking invitees is a job in itself and
  // gets the whole page. Club invitees are always available, so it never hides.
  { key: 'invitees',   label: 'Who it\'s for',     desc: 'Choose who this event is for, and what they need to do to take part.' },
  { key: 'people',     label: 'Choose invitees',   desc: 'Pick the classes and people to invite.' },
  { key: 'form',       label: 'Registration form', desc: 'Build the form people fill in to sign up.',
    when: () => form.use_registration_form },
  { key: 'settings',   label: 'Settings',          desc: 'Visibility, terms, admins, and the finishing touches.' },
]
const mobileSteps = computed(() => ALL_STEPS.filter(s => !s.when || s.when()))

// A section shows when it's the current step (stepped view) or always (desktop).
// In full mode every section renders (one long page); stepped shows one at a time.
const isStep = (key: string) => !stepped.value || mobileSteps.value[mobileStep.value]?.key === key
const stepDesc = (label: string) =>
  ALL_STEPS.find(s => s.label.toLowerCase() === label.toLowerCase())?.desc ?? ''

// Dropping the form step (e.g. the event stops being public) must not strand the
// user past the end of the list.
watch(mobileSteps, steps => {
  if (mobileStep.value > steps.length - 1) mobileStep.value = Math.max(0, steps.length - 1)
})

// NOTE: the wizard's own default-field template + empty-form factory lived here.
// Both are gone: <FormDesigner> owns the form (including its "Basic" starter
// shape), so the wizard no longer carries a parallel definition of what a
// registration form is.

const totalFees = computed(() =>
  form.fees.reduce((sum, f) => sum + Number(f.amount ?? 0), 0)
)

// ── Discounts ──────────────────────────────────────────────────────────────
// The SAME modal + condition model as the advanced event editor
// (<EventDiscountDialog> + useEventDiscounts). One discount system, not a
// wizard-only variant; rows persist to `discounts` at saveEvent().
import type { DiscountDraft } from '~/composables/useEventDiscounts'
type WizardDiscount = DiscountDraft & { id: string }

const { conditionLabel } = useEventDiscounts()
// Best-discount-only policy — ON by default; persisted into the form config by
// <FormDesigner> (shared reactive), same as the advanced editor.
const discountSettings = reactive({ one_discount_only: true })
const discountFlowOpen = ref(false)
const discountEditIdx = ref<number | null>(null)
const discountEditDraft = ref<DiscountDraft | null>(null)

const toIsoDate = (d: Date) => new Date(d).toISOString().slice(0, 10)

function openDiscount() {
  discountEditIdx.value = null
  discountEditDraft.value = null
  discountFlowOpen.value = true
}

function editDiscount(idx: number) {
  discountEditIdx.value = idx
  discountEditDraft.value = JSON.parse(JSON.stringify(form.discounts[idx]))
  discountFlowOpen.value = true
}

function onDiscountSave(draft: DiscountDraft) {
  if (discountEditIdx.value !== null) {
    const keepId = form.discounts[discountEditIdx.value].id
    form.discounts.splice(discountEditIdx.value, 1, { id: keepId, ...draft })
  } else {
    form.discounts.push({ id: crypto.randomUUID(), ...draft })
  }
  discountEditIdx.value = null
  discountEditDraft.value = null
}

const currencySymbol = computed(() => {
  const parts = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: orgCurrency.value || 'NZD' })
    .formatToParts(0)
  return parts.find(p => p.type === 'currency')?.value ?? '$'
})

function discountAmountLabel(d: WizardDiscount) {
  const v = d.modifier_value ?? 0
  if (d.modifier_type === 'REPLACE') return `${money(v)}`
  return d.modifier_type === 'PERCENT' ? `${v}% off` : `${money(v)} off`
}

function discountSummary(d: WizardDiscount) {
  const v = d.modifier_value ?? 0
  if (!v) return 'Set an amount to see what this takes off.'
  const off = d.modifier_type === 'PERCENT' ? (totalFees.value * v) / 100 : Math.min(v, totalFees.value)
  const conds = d.conditions.filter(c => c.key).length
  const who = conds ? ` for anyone matching ${conds} ${conds === 1 ? 'condition' : 'conditions'}` : ' for everyone'
  return `They'd pay ${money(Math.max(0, totalFees.value - off))} instead of ${money(totalFees.value)}${who}.`
}

// ── Live summary rail ──────────────────────────────────────────────────────
const money = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: orgCurrency.value || 'NZD' }).format(n)

const summaryCategories = computed(() =>
  categories.value.filter(c => form.category_ids.includes(c.id)),
)
const summaryFees = computed(() => form.fees.filter(f => (f.name || '').trim() || f.amount))

const summaryWhen = computed(() => {
  if (!form.start_date) return 'No date yet'
  const d = new Date(form.start_date as Date)
  const day = d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
  if (form.is_all_day) return `${day} · All day`
  if (!form.start_time) return day
  const s = new Date(form.start_time as Date)
  const e = form.end_time ? new Date(form.end_time as Date) : null
  return `${day} · ${clockLabel(s)}${e ? ` – ${clockLabel(e)}` : ''}`
})

const summaryRepeat = computed(() => {
  if (!form.repeat || form.repeat === 'NONE') return ''
  return rruleToSummary(form.repeat)
})

// Skipped dates are part of "when the event runs" — the rail has to say so, or
// the repeat line quietly overstates the schedule.
const summarySkipped = computed(() => {
  const keys = [...(form.exdates ?? [])].sort()
  if (!keys.length || !form.repeat || form.repeat === 'NONE') return ''
  const label = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }
  const shown = keys.slice(0, 3).map(label).join(', ')
  const rest = keys.length - 3
  return `Skipping ${keys.length} ${keys.length === 1 ? 'date' : 'dates'}: ${shown}${rest > 0 ? ` +${rest} more` : ''}`
})

const summaryWhere = computed(() => {
  const locs = form.locations ?? []
  if (!locs.length) return ''
  const s = locationSummary(locs)
  // The helper returns this sentinel when nothing is filled in yet — treat it
  // as "empty" so the rail greys the row out instead of asserting a location.
  return s === 'No location' ? '' : s
})

// <FeeLineItemsTable> owns add/remove/reorder now; kept for the AI prefill path.
function addFee() {
  form.fees.push({ id: crypto.randomUUID(), name: '', xero_code: '', amount: null })
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

// NOTE: the wizard used to hand-roll its own form save here (a flat form_fields
// insert), which meant an event created in the wizard and an event created in the
// advanced builder wrote TWO DIFFERENT SHAPES to the same events.form_id — and
// every form feature had to be built twice. The wizard now mounts the same
// <FormDesigner> the advanced event uses, and the designer owns the whole
// lifecycle (create the registration_forms row, stamp events.form_id, autosave
// its config jsonb). There is one form schema in the app again.

async function saveEvent() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      categoryId: form.category_ids[0] ?? null,
      secondaryCategoryId: form.category_ids[1] ?? null,
      ageMin: form.ageMin ?? null,
      ageMax: form.ageMax ?? null,
      isAllDay: form.is_all_day,
      startAt: buildDateTime(form.start_date, form.is_all_day ? null : form.start_time),
      endAt: buildDateTime(form.end_date, form.is_all_day ? null : form.end_time),
      recurrenceRule: form.repeat || null,
      exdates: form.exdates ?? [],
      locations: form.locations,
      locationType: (form.locations[0]?.type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE',
      address: form.locations[0]?.type === 'ADDRESS' ? (form.locations[0].address || null) : null,
      meetingLink: form.locations[0]?.type === 'ONLINE' ? (form.locations[0].meeting_link || null) : null,
      capacityMax: form.has_capacity ? (form.capacity_max ?? null) : null,
      hasWaitlist: form.has_waitlist,
      isPublic: form.is_public,
      isFeatured: form.is_featured,
      showAttendeeList: form.show_attendee_list,
      showAttendeeCount: form.show_attendee_count,
      allowInterest: form.allow_interest,
      holdSpotEnabled: form.hold_spot_enabled,
      regOpenAt: form.reg_open_at ?? null,
      regCloseAt: form.reg_close_at ?? null,
      // The form is owned by <FormDesigner>, which stamps events.form_id on the
      // draft row the moment it creates the form — so don't write it here or we'd
      // clobber it with a stale value. We only ever CLEAR it: the event stopped
      // collecting a form (they picked RSVP-only after building one).
      ...(form.use_registration_form ? {} : { formId: null }),
      status: 'DRAFT',
    }

    let evtId: string
    if (draftEventId.value) {
      await events.update(draftEventId.value, payload)
      evtId = draftEventId.value
    } else {
      const data = await events.create({ ...payload, orgId: orgId.value, style: 'BASIC', createdVia: 'wizard', isProgramme } as any)
      evtId = data.id
    }

    if (form.is_paid && form.fees.length) {
      for (const f of form.fees.filter(f => f.name.trim())) {
        await events.createFeeComponent({
          eventId: evtId,
          name: f.name.trim(),
          amount: f.amount ?? 0,
          xeroCode: f.xero_code || null,
        })
      }

      // Discounts — same shape (and modal) the advanced event editor writes.
      // Persisted via the finances seam (discounts table is finances-owned).
      const discountRows = form.discounts
        .filter(d => d.name.trim())
        .map(d => ({
          eventId: evtId,
          type: 'CODE' as const,
          name: d.name.trim(),
          formText: d.form_text?.trim() || null,
          isActive: d.is_active,
          modifierValue: d.modifier_value ?? 0,
          modifierType: d.modifier_type,
          applyTo: d.apply_to,
          conditions: JSON.parse(JSON.stringify(d.conditions.filter(c => c.key))),
          expiresAt: d.expires_type === 'custom' && d.expires_at ? toIsoDate(d.expires_at) : null,
        }))
      for (const dr of discountRows) await financesApi.createDiscount(dr as any)
    }

    // Sync venue bookings — create EVENT_DRIVEN booking rows so the event
    // shows up on each linked venue's bookings calendar.
    const bookableIds: string[] = (form.locations ?? [])
      .filter((l: any) => l.type === 'BOOKABLE')
      .flatMap((l: any) => l.bookable_ids ?? [])
    if (bookableIds.length && payload.startAt && payload.endAt) {
      // Clear any existing event-driven bookings so a re-save doesn't duplicate them.
      await bookingsApi.removeEventDrivenBookings(evtId)
      await bookingsApi.createBookings(
        bookableIds.map(bid => ({
          bookableId: bid,
          eventId: evtId,
          type: 'EVENT_DRIVEN',
          status: 'CONFIRMED',
          startAt: payload.startAt,
          endAt: payload.endAt,
          purpose: payload.title,
          isAllDay: payload.isAllDay,
        })) as any,
      )
    }

    // Finished — stop offering to resume it.
    forgetDraft()
    toast.add({ severity: 'success', summary: 'Event saved!', life: 3000 })
    // Land on the same form as one page, not the tabbed editor — it's the event
    // they just built, so they should see all of it and be able to keep editing.
    navigateTo(`/events/new-basic?draft=${evtId}&mode=full`)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: err?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  financesApi.orgCurrency(orgId.value)
    .then((c: string) => { orgCurrency.value = c || 'NZD' })
    .catch(() => {})

  narrow.value = window.innerWidth < 768
  const onResize = () => { narrow.value = window.innerWidth < 768 }
  window.addEventListener('resize', onResize)
  onUnmounted(() => window.removeEventListener('resize', onResize))

  const [catData, bookableData] = await Promise.all([
    events.categories(orgId.value),
    bookingsApi.bookables(orgId.value),
  ])
  categories.value = catData.map(c => ({ id: c.id, name: c.name, color: c.color }))
  allBookables.value = (bookableData ?? []).map((b: any) => ({ id: b.id, name: b.name, parent_id: b.parentId ?? null }))
  for (const b of allBookables.value) availabilityMap[b.id] = 'available'

  // Resume an unfinished draft if there is one, rather than stranding it and
  // starting another. Falls through to a fresh draft when there's nothing to
  // pick up (or the stored one has since been deleted/published).
  if (await resumeDraft()) return

  // Create a draft event so EventInviteeManager has an ID to work with
  const data = await events.create({
    orgId: orgId.value,
    title: form.title || '(draft)',
    style: 'BASIC',
    status: 'DRAFT',
    createdVia: 'wizard',      // reopening a wizard draft returns to the wizard
    isProgramme,               // created from /programme → it's a programme
  })
  if (data) {
    draftEventId.value = data.id
    rememberDraft()
  }
})

// ── Resume an in-progress draft ────────────────────────────────────────────
// The wizard is a modal you can close mid-way. Remember WHICH draft you were on
// and WHICH step you'd reached, so reopening picks up where you left off instead
// of leaving an orphan "(draft)" behind and starting again.
const draftKey = computed(() => `fm_event_wizard:${orgId.value}`)

function rememberDraft() {
  if (!import.meta.client || !draftEventId.value) return
  localStorage.setItem(draftKey.value, JSON.stringify({
    eventId: draftEventId.value,
    step: mobileStep.value,
  }))
}
function forgetDraft() {
  if (import.meta.client) localStorage.removeItem(draftKey.value)
}

// ── Delete ─────────────────────────────────────────────────────────────────
const confirmDeleteOpen = ref(false)
const deleting = ref(false)

async function deleteEvent() {
  const id = draftEventId.value
  if (!id) { navigateTo('/events'); return }
  deleting.value = true
  try {
    // Deleting the event cascades to its child rows (invitees, disciplines, fees,
    // discounts, sessions, bookings) via ON DELETE CASCADE FKs in the schema.
    await events.remove(id)
    forgetDraft()
    confirmDeleteOpen.value = false
    toast.add({ severity: 'success', summary: 'Event deleted', life: 2500 })
    navigateTo('/events')
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not delete', detail: err?.message, life: 4000 })
  } finally {
    deleting.value = false
  }
}

// Step changes are what we're remembering — persist as they happen.
watch(mobileStep, rememberDraft)

async function resumeDraft(): Promise<boolean> {
  if (!import.meta.client) return false

  // ?draft=<id> — the user reopened an unfinished draft from the events list.
  // That's explicit, so it wins over whatever we last remembered.
  const explicit = route.query.draft as string | undefined

  let stored: { eventId?: string; step?: number } | null = null
  if (explicit) {
    stored = { eventId: explicit }
    // Reuse the remembered step if it's the same draft.
    try {
      const prev = JSON.parse(localStorage.getItem(draftKey.value) ?? 'null')
      if (prev?.eventId === explicit) stored.step = prev.step
    } catch { /* ignore */ }
  } else {
    // A fresh "new event" (name passed in) always starts clean.
    if (route.query.name) return false
    try { stored = JSON.parse(localStorage.getItem(draftKey.value) ?? 'null') } catch { /* ignore */ }
  }
  if (!stored?.eventId) return false

  const ev = await events.get(stored.eventId).catch(() => null)
  // Map the seam's camelCase back to the snake_case shape this function reads.
  const evt = ev && ev.orgId === orgId.value ? {
    ...ev,
    banner_url: ev.bannerUrl,
    category_id: ev.categoryId,
    secondary_category_id: ev.secondaryCategoryId,
    age_min: ev.ageMin,
    age_max: ev.ageMax,
    start_at: ev.startAt,
    end_at: ev.endAt,
    is_all_day: ev.isAllDay,
    capacity_max: ev.capacityMax,
    reg_open_at: ev.regOpenAt,
    reg_close_at: ev.regCloseAt,
    is_public: ev.isPublic,
    form_id: ev.formId,
  } : null

  if (!evt) { forgetDraft(); return false }
  // An explicit ?draft=<id> opens that event whatever its status — full mode is
  // how a saved single-session event is edited. Only the *remembered* draft has
  // to still be a draft (otherwise we'd resurrect a finished event).
  if (!explicit && evt.status !== 'DRAFT') { forgetDraft(); return false }

  draftEventId.value = evt.id
  form.title = evt.title === '(draft)' ? '' : (evt.title ?? '')
  form.description = evt.description ?? ''
  form.banner_url = evt.banner_url ?? ''
  // Restore the category, or saveEvent would write it back to null on resume.
  form.category_ids = [evt.category_id, evt.secondary_category_id].filter(Boolean) as string[]
  form.ageMin = evt.age_min ?? null
  form.ageMax = evt.age_max ?? null
  if (evt.start_at) {
    form.start_date = new Date(evt.start_at)
    form.start_time = new Date(evt.start_at)
  }
  if (evt.end_at) {
    form.end_date = new Date(evt.end_at)
    form.end_time = new Date(evt.end_at)
  }
  form.is_all_day = !!evt.is_all_day
  form.capacity_max = evt.capacity_max ?? null
  form.has_capacity = evt.capacity_max != null
  if (evt.reg_open_at) form.reg_open_at = new Date(evt.reg_open_at)
  if (evt.reg_close_at) form.reg_close_at = new Date(evt.reg_close_at)
  // A saved window is a deliberate one — don't let the seeder move it.
  signupTouched.value = !!(evt.reg_open_at || evt.reg_close_at)

  // Restore the Invitees-step choices, or resuming a draft would silently drop
  // them: a public event would come back private, and an event whose form is
  // already built would lose the form step entirely (the step is gated on
  // use_registration_form). A linked form_id IS the evidence they chose "form".
  form.is_public = !!evt.is_public
  invitePublic.value = !!evt.is_public
  form.use_registration_form = !!evt.form_id || !!evt.is_public
  attendeeAction.value = form.use_registration_form ? 'form' : 'rsvp'

  // Land them back on the step they'd reached.
  const step = Number(stored.step ?? 0)
  // mobileSteps is a computed — .length on the ref itself is undefined, which
  // produced a NaN step and hid every section.
  const lastStep = mobileSteps.value.length - 1
  mobileStep.value = Number.isFinite(step) ? Math.min(Math.max(step, 0), lastStep) : 0

  return true
}
</script>
