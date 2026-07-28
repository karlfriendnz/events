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
  <!-- data-review-scope tells <ReviewWidget> WHICH screen a pin was dropped on:
       this route is a 7-step wizard AND a one-page custom form sharing one URL,
       so without it every comment looks like it came from the same place. -->
  <div :class="stepped
      ? 'app-modal-overlay fixed inset-0 flex items-stretch sm:items-center justify-center sm:p-6 bg-slate-900/45 backdrop-blur-[2px]'
      : ''"
    :data-review-scope="reviewScope"
    :style="stepped ? 'z-index: 1000' : ''">
  <!-- 1200px suits a form of labelled rows. The Registration form step is a
       two-panel EDITOR (section list + live preview of the real form) and every
       pixel taken off it comes out of the preview, so that step widens to the
       screen — the modal grows for the one step that needs the room. -->
  <div :class="stepped
      ? ['flex flex-col bg-white w-full h-full sm:h-[92vh] sm:rounded-xl shadow-2xl overflow-hidden',
         formFullBleed ? 'sm:max-w-none' : 'sm:max-w-[1200px]']
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
            :class="canJumpTo(idx) ? 'cursor-pointer' : ''"
            @click="jumpToStep(idx)">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
              :class="idx < mobileStep
                ? 'bg-primary text-white'
                : idx === mobileStep
                  ? 'bg-primary text-white ring-4 ring-primary/20'
                  : idx <= furthestStep
                    ? 'bg-primary/10 text-primary'  /* been there, can go back to it */
                    : 'bg-gray-100 text-gray-400'">
              <i v-if="idx < mobileStep" class="pi pi-check text-[10px]" />
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span class="text-xs font-medium whitespace-nowrap hidden sm:inline"
              :class="idx <= mobileStep ? 'text-gray-800' : (idx <= furthestStep ? 'text-primary' : 'text-gray-400')">
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

    <!-- ── Scrollable content ──
         The Registration form step runs FULL BLEED: the designer is a two-panel
         editor that manages its own scrolling, so the wizard's padding + max-width
         (and the outer scrollbar) only shrank it and left a border of dead space. -->
    <div class="flex-1 min-w-0 bg-[#F5F8FA]" :class="formFullBleed ? 'overflow-hidden flex' : 'overflow-y-auto'">
      <div :class="formFullBleed
        ? 'flex-1 min-w-0 flex flex-col'
        : ['mx-auto px-4 sm:px-6 py-5 sm:py-6', stepped ? 'max-w-[1540px]' : 'max-w-[900px] space-y-8']">

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
              <div class="grid grid-cols-1 sm:grid-cols-[100px_1fr] items-center gap-1.5 sm:gap-4">
                <label class="field-label">Event Title <span class="text-red-400">*</span></label>
                <InputText ref="titleInput" v-model="form.title" placeholder="Enter the name of your event" class="w-full" />
              </div>
            </div>
            <!-- Date (lives on step 1, right after the name).
                 ONE padding source per gap: every plain field block is py-4 (16px),
                 so any two neighbouring rows are 32px apart; the date/sign-up
                 editors carry NO padding here (py-0) and space their own rows
                 instead, so a two-row editor keeps the same rhythm as a one-row
                 field. (The plain rows had drifted to py-2 — restored on review.) -->
            <div class="px-5 py-0 border-b border-gray-100">
              <!-- No accordion: the fields ARE the summary. Each editor row carries
                   its own 100px label column, matching the card's, so every input
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
                no-past-today
                label="Date"
                required
                label-width="w-[100px]"
                label-class="text-gray-800 font-semibold"
                row-padding="px-0 py-2"
                divider
              />
              <!-- Why you can't proceed — a disabled button with no reason is a
                   dead end. Only nags once the user has engaged with the form. -->
              <div v-if="dateInvalidReason && (form.title.trim() || form.start_date)"
                class="py-1 sm:pl-[116px]">
                <span class="inline-flex items-center gap-2 rounded-md bg-red-50 border border-red-100 px-2.5 py-1.5">
                  <i class="pi pi-exclamation-circle text-red-500 text-xs" />
                  <span class="text-xs font-medium text-red-600">{{ dateInvalidReason }}</span>
                </span>
              </div>
            </div>
            <!-- Sign-up window. Nearly every event wants "from now until it starts",
                 and that answer needs no dates at all — so it's the default and the
                 two date fields stay out of the way until someone actually wants
                 something else. One either/or question, one SelectButton. -->
            <div class="px-5 py-4" :class="signupMode === 'custom' ? '' : 'border-b border-gray-100'">
              <div :class="isMobile ? 'space-y-1.5' : 'grid grid-cols-[100px_1fr] gap-4 items-center'">
                <label class="field-label">Sign up</label>
                <!-- The summary sits BESIDE the buttons, not under them: it's what
                     the chosen option means, and on its own line it read as a
                     separate note about the row. Wraps below on a narrow screen. -->
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
                  <SelectButton :model-value="signupMode" :options="SIGNUP_MODES"
                    option-label="label" option-value="value" :allow-empty="false"
                    class="w-max shrink-0" @update:model-value="setSignupMode" />
                  <p v-if="signupMode === 'auto'" class="field-help min-w-0">{{ signupAutoSummary }}</p>
                </div>
              </div>
            </div>
            <div v-if="signupMode === 'custom'" class="px-5 py-0 border-b border-gray-100">
              <DateTimeEditor
                v-model:startDate="regOpenDate"
                v-model:startTime="regOpenTime"
                v-model:endDate="regCloseDate"
                v-model:endTime="regCloseTime"
                :show-all-day="false"
                reserve-all-day-space
                :show-repeat="false"
                :min-start-date="today"
                :min-end-date="regOpenDate ?? today"
                :max-date="signupMaxDate"
                label=""
                start-label="Opens"
                end-label="Closes"
                label-width="w-[100px]"
                label-class="text-gray-800 font-semibold"
                row-padding="px-0 py-2"
                :mark-dates="[
                  { date: form.start_date, label: 'Event starts' },
                  { date: form.end_date, label: 'Event ends' },
                ]" />
            </div>
            <!-- Description -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div :class="isMobile ? 'space-y-1.5' : 'grid grid-cols-[100px_1fr] gap-4'">
                <label class="field-label pt-1">Description</label>
                <RichTextEditor v-model="form.description" placeholder="Describe your event here…" />
              </div>
            </div>
            <!-- Category + Discipline — two columns, sharing the field column.
                 Disciplines come from the governing body (club's sport → its NSO
                 chain), NOT a local list. <DisciplineLinker> resolves + persists
                 to event_disciplines itself, so it needs the draft event row. -->
            <div class="px-5 py-4 border-b border-gray-100">
              <!-- With BOTH controls each is titled above its own field — no single
                   left label can name two side-by-side things. But when the governing
                   body defines no disciplines there's only ONE field left, so it takes
                   the normal left label like every other row. -->
              <EventCategoryRow v-model="form.category_ids" :categories="categories"
                :event-id="draftEventId" :stacked="isMobile" label-width="100px"
                @created="c => categories.push(c)"
                @discipline-empty="v => disciplineEmpty = v" />
            </div>
            <!-- Age & gender restrictions were removed from the basic event.
                 "Who can see it" used to sit here, under Category. It moved to the
                 Choose-invitees step: seeing it and being invited to it are the same
                 question asked twice, and answering them three steps apart meant
                 picking an audience before you'd picked any people. -->
            <!-- The banner USED to be captured here. It's the registration form's
                 header image, so it's set on the Registration form step where you can
                 see it in place — asking for it on step 1 meant choosing a picture for
                 a page you hadn't seen. The value still lives on the event (the
                 designer writes it, the summary rail shows it). -->
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
          <!-- Behind a switch. Most events have no discounts at all, so the whole
               apparatus (a list, an Add button, and a rule about how several of them
               interact) sat there as a question nobody had asked. Off is the honest
               default; turning it on reveals the box and everything inside it. -->
          <div v-if="form.is_paid" class="bg-white rounded-xl border border-gray-200 mt-4">
            <div class="px-5 py-3.5 flex items-center justify-between gap-4"
              :class="useDiscounts ? 'border-b border-gray-100' : ''">
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-700">Discounts</p>
                <p class="text-xs text-gray-500 mt-0.5">Early bird, members only, siblings, promo codes — set who qualifies.</p>
              </div>
              <ToggleSwitch v-model="useDiscounts" class="shrink-0" />
            </div>

            <div v-if="useDiscounts" class="p-5 space-y-4">
            <div class="flex justify-end">
              <Button label="Add discount" icon="pi pi-plus" size="small" severity="secondary" outlined @click="openDiscount" />
            </div>

            <div v-if="!form.discounts.length" class="text-center py-4 text-sm text-gray-400">
              No discounts yet. Everyone pays the full {{ money(totalFees) }}.
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

            <!-- Lives INSIDE the box: it's a rule about how these discounts interact,
                 so it means nothing on an event that has none. It was a card of its
                 own, which read as a separate feature. -->
            <div class="flex items-center justify-between gap-4 pt-4 border-t border-gray-100">
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-700">Limit to one discount per registration</p>
                <p class="text-xs text-gray-400 mt-0.5">When several rules match, only the best discount is applied.</p>
              </div>
              <ToggleSwitch v-model="discountSettings.one_discount_only" class="shrink-0" />
            </div>
            </div>
          </div>

          <EventDiscountDialog v-model:visible="discountFlowOpen" :edit="discountEditDraft" :currency-symbol="currencySymbol"
            :event-age-min="form.ageMin" :event-age-max="form.ageMax" @save="onDiscountSave" />
        </div>

        <!-- ─ Who it's for + Choose invitees (one step) ─
             The public-registration toggle + form style sit above the invitee
             picker; picking the people is the main job of the step. -->
        <div :class="isStep('people') ? 'px-1' : 'hidden'">
          <!-- ONE card, not three. These are three parts of a single question — who
               this event is for — and as separate boxes they read as three unrelated
               settings, with the capacity toggle sitting in a grey box inside a white
               box for no reason. Broadest first: who can SEE it, then who can SIGN UP,
               then how many fit. NB there's no "RSVP or form?" question here — this
               step is about WHO; the Registration form step adds a form. -->
          <div class="bg-white rounded-xl border border-gray-200 mb-4">
            <div class="px-5 pt-4 pb-3 border-b border-gray-100">
              <h3 class="section-title">Who it's for</h3>
              <p class="field-help mt-0.5">Who can see it, who can sign up, and how many can come.</p>
            </div>
            <div class="divide-y divide-gray-100">
              <!-- Calendar visibility used to sit at the top of this card. It moved
                   to the Settings step, with the other display toggles it belongs
                   with: this step is about WHO you're inviting, and where the event
                   shows up on the calendar is a different question. -->
              <div class="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <!-- A switch, not two options. "Public and club / Club only" made you
                     read both labels to find the difference, when the question is
                     simply whether STRANGERS can sign up — off is club-only, which is
                     what most events are. NB turning it on forces a registration form:
                     someone with no profile has to identify themselves somehow. -->
                <div class="flex-1">
                  <p class="field-label">Public registrations</p>
                  <p class="field-help mt-0.5">Let anyone with the link sign up, not just your club.</p>
                </div>
                <ToggleSwitch :model-value="invitePublic" class="shrink-0"
                  @update:model-value="setInvitePublic" />
              </div>

              <!-- Capacity. Moved here from Settings: how many can come is a question
                   about the guest list, so it belongs beside the people being invited,
                   not under the display toggles two steps later. -->
              <!-- ONE row. The cap and the waitlist were stacked as two settings
                   with a rule between them, which made a cap look like a section.
                   They're one sentence — "cap it at 20, and take a waitlist after
                   that" — so the waitlist rides on the same row and only appears
                   once there IS a cap (a waitlist on an uncapped event has nothing
                   to overflow into). -->
              <div class="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div class="flex-1 min-w-0">
                  <p class="field-label">Limit capacity</p>
                  <p class="field-help mt-0.5">Cap how many people can attend.</p>
                </div>
                <div class="flex items-center gap-2 shrink-0 flex-wrap">
                  <template v-if="form.has_capacity">
                    <InputNumber v-model="form.capacity_max" :min="1" size="small" placeholder="Max" class="w-20" />
                    <span class="field-help">spots</span>
                    <span class="hidden sm:inline text-gray-200">|</span>
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                      <ToggleSwitch v-model="form.has_waitlist" />
                      <span class="field-help" v-tooltip.top="'Once it\'s full, extra sign-ups join a waitlist.'">Waitlist</span>
                    </label>
                    <span class="hidden sm:inline text-gray-200">|</span>
                  </template>
                  <ToggleSwitch v-model="form.has_capacity" />
                </div>
              </div>
            </div>
          </div>

          <!-- The invitee picker (classes, individuals, a searchable roster). It
               brings its own "Choose invitees" heading, so none is added here. -->
          <div v-if="!draftEventId" class="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
            <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
            Setting up invitees…
          </div>
          <EventInviteeManager v-else :event-id="draftEventId" :show-invite="false" />
        </div>

        <!-- ─ Registration form ─
             Straight into the builder's own "Choose a registration type" chooser —
             which already offers Invite only (the yes/no path) as its first option.
             An extra "this event just asks for a yes/no reply" screen in front of it
             was a step that asked the same question with fewer answers. -->
        <!-- No heading here: the step path above already says "Registration form",
             and the builder fills the panel — a title + blurb just pushed it down. -->
        <div :class="isStep('form') ? (formFullBleed ? 'flex-1 min-h-0 flex flex-col' : 'px-1') : 'hidden'">
          <!-- ONE form, ONE builder — the same <FormDesigner> the advanced event uses
               (its own chooser, autosaves to registration_forms.config + events.form_id). -->
          <div v-if="!draftEventId" class="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
            <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
            Setting up the form…
          </div>
          <!-- flex column + definite height so FormDesigner's absolute two-panel
               layout resolves (otherwise it collapses to nothing). -->
          <div v-else class="bg-white overflow-hidden flex flex-col"
            :class="formFullBleed ? 'flex-1 min-h-0' : 'rounded-xl border border-gray-200'"
            :style="formFullBleed ? '' : 'height:70vh; min-height:560px'">
            <FormDesigner :event-id="draftEventId" :discount-settings="discountSettings" :age-min="form.ageMin" :age-max="form.ageMax" :gender-restriction="form.genderRestriction" :live-event="liveEventForForm"
              :fee-line-items="form.is_paid ? form.fees : []" embedded basic class="flex-1 min-h-0"
              @invite-only="setInviteOnly" @update:event="onFormEventEdit"
              @back="mobileBack" @done="mobileNext" />
          </div>
        </div>

        <!-- ─ Settings ─ -->
        <div :class="isStep('settings') ? 'px-1' : 'hidden'">
          <div class="mb-3">
            <h2 class="section-title">Settings</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ stepDesc('Settings') }}</p>
          </div>
          <!-- Visibility — where the event shows up, and the display toggles. -->
          <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-800 mb-3">Visibility</h3>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <!-- The amber "these choices aren't enforced yet" notice was here.
                 Removed on review: it was scaffolding for us, not information a
                 club needs while creating an event, and it sat above the
                 controls telling people the thing they were about to do might
                 not work. (The caveat itself still stands — enforcing
                 visibility on the public events page is outstanding work.) -->
            <!-- Who sees it on the calendar. Leads the card: the toggles below are
                 details of HOW it appears, which only matter once it appears at all. -->
            <div class="pb-4 mb-4 border-b border-gray-100">
              <EventVisibilityPicker
                v-model="form.visibility"
                v-model:type-keys="form.visibility_type_keys"
                v-model:group-ids="form.visibility_group_ids"
                v-model:person-ids="form.visibility_person_ids"
                as-switch :hide-custom="false"
                label="Calendar visibility" label-width="sm:w-[150px]" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div v-for="vis in visibilityOptions" :key="vis.key" class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-gray-700">{{ vis.label }}</p>
                  <p class="text-xs text-gray-500">{{ vis.desc }}</p>
                </div>
                <ToggleSwitch v-model="form[vis.key]" />
              </div>
            </div>
            <!-- Capacity + waitlist used to sit here. They moved to the Choose
                 invitees step: "how many can come" is a question about the
                 GUEST LIST, and it belongs beside the people you're inviting
                 rather than buried under display toggles two steps later. -->
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

            <!-- Coordinators — the REAL thing (event_coordinators), the same
                 <EventCoordinators> the event page uses. What stood here was a mock:
                 a local form.admins list rendered as a table and never saved. -->
            <div v-if="draftEventId" class="border-t border-gray-100 pt-5">
              <EventCoordinators :event-id="draftEventId" embedded />
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
         form itself needs the full width — and on the Registration form step,
         where the form BUILDER needs it (same call new-multi makes by running
         that step full-bleed). ── -->
    <aside v-if="stepped && !isStep('form')" class="hidden lg:flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white overflow-y-auto">
      <!-- Banner -->
      <!-- Honours the chosen focal point. This rail is a DIFFERENT shape to the
           editor above it, which is the whole argument for storing a focal
           point rather than a crop: one value, framed correctly in both. -->
      <div v-if="form.banner_url" class="h-28 shrink-0 bg-gray-100">
        <img :src="form.banner_url" class="w-full h-full object-cover"
          :style="{ objectPosition: form.banner_position || '50% 50%' }" />
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

          <!-- "How they sign up" (RSVP vs form) used to be summarised here. It was
               reporting a DEFAULT nobody had chosen — the RSVP/form control isn't on
               any step any more, it's implied by making the event public or by
               building a form — so the rail was stating a decision as though it had
               been made. A summary of an unmade choice is worse than no line at all.
               If the choice becomes explicit again, this is where it would show. -->
          <div v-if="form.is_public" class="flex gap-2.5">
            <i class="pi pi-globe text-xs mt-1 shrink-0 text-primary" />
            <p class="text-sm text-gray-800">Public event</p>
          </div>

          <div v-if="form.has_capacity && form.capacity_max" class="flex gap-2.5">
            <i class="pi pi-users text-xs mt-1 shrink-0 text-primary" />
            <p class="text-sm text-gray-800">Capped at {{ form.capacity_max }} attendees</p>
          </div>
        </div>

        <!-- The date error is NOT repeated here. It already shows as a red box
             directly under the Date row, next to the control it's about; a copy
             in the summary rail just said the same thing twice. -->
      </div>
    </aside>

    </div>

    <!-- ── Mobile bottom navigation ── -->
    <!-- Step nav — stepped mode only; the full page saves from its header.
         HIDDEN on the Registration form step: the form builder is a task with its
         own screens (registration type → template → who's registering → the
         builder) and it carries its own footer, whose "Form complete" both finishes
         the form and moves this wizard on. Two footers stacked meant a Next that
         belonged to a flow you weren't looking at. -->
    <div v-if="stepped && !isStep('form')" class="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
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

  <!-- New Category lives inside <EventCategoryRow> — one dialog, every create flow. -->

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
// It's a plain yes/no now (a ToggleSwitch): inviting your own club happens either
// way — that's the picker below — so the only question is whether strangers can too.
// The old "Public and club / Club only" pair spelled that out as two options you had
// to compare; off = club only says the same thing at a glance.

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
// True once <DisciplineLinker> reports it has nothing to link — the Discipline column
// is then hidden and Category takes the full row.
// Default true so Category/Discipline start as one column and don't flash to
// two before <DisciplineLinker> mounts (v-if=draftEventId) and reports back.
const disciplineEmpty = ref(true)
const attendeeAction = ref<'rsvp' | 'form'>('rsvp')

function setInvitePublic(v: boolean) {
  if (v === null || v === undefined) return        // SelectButton can emit null
  invitePublic.value = v
  form.is_public = v
  if (v) attendeeAction.value = 'form'             // strangers must identify themselves
  form.use_registration_form = v || attendeeAction.value === 'form'
}

// "Invite only" — the pure invite path: no strangers (is_public off) and no form at
// all. RSVP means the answer IS the invitee's status (written at /rsvp/:event/:person),
// so this reuses the existing RSVP path — use_registration_form stays false, the
// Registration-form step is gated out, and saveEvent() never writes a form_id (it only
// ever clears it). Forms' audience chooser calls this when "Invite only" is picked.
function setInviteOnly() {
  invitePublic.value = false
  form.is_public = false
  attendeeAction.value = 'rsvp'
  form.use_registration_form = false
}

// Step 1 needs a name AND a valid date before you can move on (or save). A date
// is valid when there's a start, and — if an end is given — it isn't before it.
const dateInvalidReason = computed(() => {
  if (!form.start_date) return 'Pick a start date for the event.'
  // The event can't START in the past. <DateTimeEditor> already stops you
  // picking a past TIME when the date is today, but choosing an earlier DATE
  // walked straight round that — you could create an event for last week.
  // (An all-day event compares DATES only: "today, all day" is still valid at
  // 4pm, where a datetime compare would call it past.)
  const startAt = new Date(form.start_date as Date)
  if (form.is_all_day) {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    const startDay = new Date(startAt)
    startDay.setHours(0, 0, 0, 0)
    if (startDay < midnight) return 'The start date is in the past.'
  } else if (form.start_time) {
    const t = new Date(form.start_time as Date)
    startAt.setHours(t.getHours(), t.getMinutes(), 0, 0)
    if (startAt.getTime() < Date.now()) return 'The start date and time are in the past.'
  }
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
    // `<` not `<=`: an end EQUAL to the start is allowed (a zero-length slot is a real
    // thing to record — a check-in, a briefing), only an end BEFORE it is wrong.
    if (sameDay && e < s) return 'The end time is before the start time.'
  }
  // The sign-up window gets the SAME rule as the event's own times: closing may equal
  // opening, never precede it. Both ends are full datetimes, so one compare covers the
  // date and the time — and the editor's red ring alone didn't stop you pressing Next.
  if (form.reg_open_at && form.reg_close_at
    && new Date(form.reg_close_at as Date) < new Date(form.reg_open_at as Date)) {
    return 'Sign-ups close before they open.'
  }
  return ''
})
const step1Complete = computed(() => !!form.title.trim() && !dateInvalidReason.value)

/**
 * Jumping around the wizard.
 *
 * Only BACKWARDS steps used to be clickable, which made the header a progress bar
 * rather than navigation: having gone Fees → Settings you couldn't get back to
 * Settings without pressing Next through everything between. Once a step has been
 * REACHED it stays reachable, forwards or back.
 *
 * The one hard gate is step 1: nothing downstream is meaningful without a name and
 * a valid date, so blanking the title strands you there exactly as Next does.
 */
const furthestStep = ref(0)
watch(mobileStep, v => { if (v > furthestStep.value) furthestStep.value = v })
const canJumpTo = (idx: number) =>
  idx !== mobileStep.value && idx <= furthestStep.value && (idx === 0 || step1Complete.value)
function jumpToStep(idx: number) {
  if (!canJumpTo(idx)) return
  mobileStep.value = idx
  nextTick(() => { document.querySelector('.overflow-y-auto')?.scrollTo(0, 0) })
}

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

// Creating a category is <EventCategoryRow>'s job now (it owns the dialog and hands
// the new row back via @created) — the wizard just keeps its own list in step.


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
// "Public event" is deliberately NOT here. Who can see the event is already
// asked once, on the Choose-invitees step, by the <EventVisibilityPicker> ("Public and club" /
// "Club only") — a second toggle saying the same thing further down let the two
// disagree, and left the reader wondering which one actually won.
const visibilityOptions = [
  { key: 'is_featured',         label: 'Featured',               desc: 'Pinned to the top of the events page and highlighted on member dashboards.' },
  { key: 'show_attendee_list',  label: 'Show attendee list',     desc: 'Registrants can see who else is coming, by name, on the event page.' },
  { key: 'show_attendee_count', label: 'Show attendee count',    desc: 'Shows how many have registered (and spots left) without naming them.' },
  { key: 'allow_interest',      label: 'Allow interest',         desc: 'Members can register interest without committing — useful before you open sign-ups.' },
  { key: 'hold_spot_enabled',   label: 'Hold-spot registration', desc: 'Holds a spot while payment or approval is pending, instead of releasing it.' },
]



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

/**
 * "From now until it starts" or "Custom".
 *
 * The window itself always exists — this only decides whether the club has to SEE
 * it. In `auto` the two ends keep following the event (move the event, the window
 * moves with it); the moment someone picks `custom` the dates are theirs and
 * nothing shifts them again.
 */
const signupMode = ref<'auto' | 'custom'>('auto')
const SIGNUP_MODES = [
  { label: 'Now until it starts', value: 'auto' },
  { label: 'Custom', value: 'custom' },
]
function setSignupMode(v: 'auto' | 'custom' | null) {
  if (!v) return
  signupMode.value = v
  if (v === 'auto') {
    // Back to following the event — forget any hand-picked dates, or the summary
    // would claim "now until it starts" while holding last week's numbers.
    signupTouched.value = false
    form.reg_open_at = null
    form.reg_close_at = null
    seedSignupWindow()
  }
}
const signupAutoSummary = computed(() => {
  const starts = form.start_date as Date | null
  if (!starts) return 'Opens straight away and closes when the event starts.'
  const d = new Date(starts).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' })
  return `Opens straight away and closes on ${d}, when the event starts.`
})

function seedSignupWindow() {
  if (signupTouched.value) return
  // Sign-up dates default to MIDNIGHT, not the current clock time. "Opens 27 Jul"
  // means the whole of the 27th — seeding 2:14pm because that happens to be when
  // the event was made is an arbitrary cut-off nobody chose, and it reads as noise
  // in a field the club mostly thinks about in whole days.
  if (!form.reg_open_at) form.reg_open_at = atMidnight(new Date())   // from today…
  // …to midnight on the day it starts. BOTH ends are whole days by default: the
  // close used to inherit the event's own start time, so a 6pm event closed sign-ups
  // at 18:00 — a precise-looking rule nobody actually chose. NB this means the
  // default now closes at the START of the event's day; set a time to say otherwise.
  const starts = eventStartsAt()
  if (starts) form.reg_close_at = atMidnight(starts)
}
function atMidnight(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
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
  genderRestriction: null as string | null,
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
  // Who can see it (mig 287) — same model as the quick event.
  visibility: 'internal',
  visibility_type_keys: [] as string[],
  visibility_group_ids: [] as string[],
  visibility_person_ids: [] as string[],
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
  // CSS object-position for the banner — which part of it shows once cropped
  // to a box. Empty = centre (the browser default).
  banner_position: '',
  custom_terms: [] as string[],
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

// Seed a default 9:00–11:00 window whenever the event has a DATE but no time — a basic
// event created from a calendar day-click arrives with `start_date` (from ?date=) but
// null times, so the time wheels read empty and step 1 blocks on "set a start and end
// time" for a window the user never had a reason to open. Only fills a time that's
// still null (never clobbers a chosen/cleared one — the watcher tracks the DATE, not
// the times, so editing or clearing a time is never re-seeded). buildDateTime uses only
// the clock, so the seed's day is irrelevant. MUST stay below `form` (TDZ, as above).
/**
 * Sign-ups can't open or close AFTER the event has finished — registering for
 * something that already happened isn't a window, it's a dead link. The end date when
 * there is one, else the start (a one-day event ends the day it begins).
 */
const signupMaxDate = computed<Date | null>(() => {
  const d = (form.end_date ?? form.start_date) as Date | null
  if (!d) return null
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)   // the whole of the last day is still "before the end"
  return out
})
// Moving the event EARLIER can strand a sign-up date past the new end — the picker's
// cap only guards what you choose next, not what was already chosen.
watch(signupMaxDate, (max) => {
  if (!max) return
  if (form.reg_open_at && new Date(form.reg_open_at as Date) > max) form.reg_open_at = new Date(max)
  if (form.reg_close_at && new Date(form.reg_close_at as Date) > max) form.reg_close_at = new Date(max)
})

// TIMES START BLANK, and the END follows the start.
//
// This used to seed 9:00–11:00 whenever a date existed, so an event dragged off the
// calendar arrived claiming a two-hour morning slot nobody chose — and the end time
// was already filled, so the wrong one got saved unless you noticed it. A date can
// come from the calendar (?date= / ?endDate=); a TIME never does.
//
// So: nothing is seeded on arrival, and picking a start time fills the end an hour
// later — only when the end is still blank, so a chosen end is never overwritten and
// clearing one doesn't immediately grow another. MUST stay below `form` (TDZ).
watch(() => form.start_time, (t) => {
  if (form.is_all_day || !t || form.end_time) return
  const e = new Date(t as Date)
  e.setHours(e.getHours() + 1)
  form.end_time = e
})

// The wizard's steps. Keyed, not index-based, because the step list is DYNAMIC —
// the registration-form step only exists when the event actually collects a form
// (they chose "fill in a form", or opened it to the public, which forces one).
// `desc` tells the user what the step is for and is the single source of truth
// for the step count (Date isn't listed: it lives inside Event info now).
const ALL_STEPS: { key: string; label: string; desc: string; when?: () => boolean }[] = [
  { key: 'info',       label: 'Event info',        desc: 'Name the event, set when it runs, and who can see it.' },
  { key: 'location',   label: 'Location',          desc: 'Where is it happening? Pick a venue, an address, or make it online.' },
  { key: 'fees',       label: 'Fees',              desc: 'Add any charges for attending. Leave empty if the event is free.' },
  // ONE step for the whole "who": can the public register? what form style? then
  // pick the club invitees. Club invitees are always available, so it never hides.
  { key: 'people',     label: 'Choose invitees',   desc: 'Who can register, and pick the classes and people to invite.' },
  // Always shown — an RSVP-only event still gets the step, with an "add a form"
  // prompt rather than the builder, so the form step is never silently missing.
  { key: 'form',       label: 'Registration form', desc: 'Build the form people fill in to sign up.' },
  { key: 'settings',   label: 'Settings',          desc: 'Visibility, terms, admins, and the finishing touches.' },
]
const mobileSteps = computed(() => ALL_STEPS.filter(s => !s.when || s.when()))

// A section shows when it's the current step (stepped view) or always (desktop).
// In full mode every section renders (one long page); stepped shows one at a time.
// Full-bleed applies ONLY in the stepped view: in full mode every section renders on
// one page, where a step filling the viewport would swallow the others.
const formFullBleed = computed(() => stepped.value && mobileSteps.value[mobileStep.value]?.key === 'form')
const isStep = (key: string) => !stepped.value || mobileSteps.value[mobileStep.value]?.key === key

/**
 * What screen is showing, for review-comment capture. This route wears two very
 * different faces — the stepped wizard and the one-page custom form (?mode=full)
 * — and a reviewer's "remove this" means nothing without knowing which.
 */
const reviewScope = computed(() => {
  if (!stepped.value) return 'Custom event (one-page, ?mode=full)'
  const s = mobileSteps.value[mobileStep.value]
  return s ? `Step ${mobileStep.value + 1} of ${mobileSteps.value.length} · ${s.label}` : 'Basic event wizard'
})

/**
 * Jump to the step a review comment is about.
 *
 * Clicking a comment in the review panel asks to be taken to the thing it
 * points at — but most of this wizard isn't in the DOM at any given moment, so
 * there is nothing to scroll to until the right step is showing. The widget
 * fires `review:goto` with the scope its pin captured; we read the step out of
 * it and switch. Matching on the LABEL rather than the number, because steps
 * are conditional (`mobileSteps` filters) so "step 4" can mean different things
 * for different events, while "Fees" always means Fees.
 */
// Take me to what a review comment is about — see useReviewGoto for the pattern.
useReviewGoto(({ stepLabel, dialog }) => {
  // 1. The right step FIRST — a dialog opened from the wrong step would be the
  //    wrong dialog, and some are only reachable from their own step anyway.
  if (stepLabel && stepped.value) {
    const idx = mobileSteps.value.findIndex(s => s.label.toLowerCase() === stepLabel)
    if (idx >= 0 && idx !== mobileStep.value) mobileStep.value = idx
  }

  // 2. Then re-open the dialog the comment was made in.
  //
  //    A short explicit list, on purpose: opening the wrong dialog because a
  //    title looked similar is worse than opening none. The wizard's OWN shell
  //    title is the event name ("Prize Giving"), so it never matches here — it
  //    isn't a dialog to open, it's the page you're already on.
  const d = dialog?.trim().toLowerCase()
  if (d === 'add discount' || d === 'new discount rule') openDiscount()
})
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
import { GENDER_RESTRICTION_OPTIONS } from '~/composables/useEventRestrictions'
type WizardDiscount = DiscountDraft & { id: string }

const { conditionLabel } = useEventDiscounts()
// Best-discount-only policy — ON by default; persisted into the form config by
// <FormDesigner> (shared reactive), same as the advanced editor.
const discountSettings = reactive({ one_discount_only: true })
// Does this event have discounts at all? Off by default — but ON whenever there are
// already discounts (resuming a draft, or an event that had some before), or the
// switch would hide rules that are live and still being applied.
const useDiscounts = ref(false)
watch(() => form.discounts.length, n => { if (n) useDiscounts.value = true })
// Turning it OFF clears them: a discount you can't see is a price change you can't
// explain. (Turning it back on starts from empty, as the box says.)
watch(useDiscounts, on => { if (!on && form.discounts.length) form.discounts.splice(0) })
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

// The event as it stands in THIS wizard — the draft row lags behind what's typed, so
// the form preview reads these instead of the stored values.
// The form banner lets you rename the event / set its banner from the preview; mirror
// those back into the wizard so its own fields (and the final save) agree.
function onFormEventEdit(patch: { title?: string; banner_url?: string | null }) {
  if (patch.title != null) form.title = patch.title
  if ('banner_url' in patch) form.banner_url = patch.banner_url || ''
}

const liveEventForForm = computed(() => ({
  title: form.title?.trim() || null,
  start_at: form.start_date ? buildDateTime(form.start_date, form.is_all_day ? null : form.start_time) : null,
  end_at: form.end_date ? buildDateTime(form.end_date, form.is_all_day ? null : form.end_time) : null,
  is_all_day: form.is_all_day,
  description: form.description || null,
  banner_url: form.banner_url || null,
  banner_position: form.banner_position || null,
  location: summaryWhere.value || null,
}))

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

// Uploading the banner belongs to the Registration form designer now (it writes
// back through onFormEventEdit); the wizard only carries the value.

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
      bannerUrl: form.banner_url || null,   // was omitted → the uploaded banner was dropped on save
      bannerPosition: form.banner_position || null,
      categoryId: form.category_ids[0] ?? null,
      secondaryCategoryId: form.category_ids[1] ?? null,
      categoryIds: form.category_ids.length ? form.category_ids : null,
      ageMin: form.ageMin ?? null,
      ageMax: form.ageMax ?? null,
      genderRestriction: form.genderRestriction ?? null,
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
      visibility: form.visibility || 'internal',
      visibilityTypeKeys: form.visibility === 'custom' && form.visibility_type_keys.length ? form.visibility_type_keys : null,
      visibilityGroupIds: form.visibility === 'custom' && form.visibility_group_ids.length ? form.visibility_group_ids : null,
      visibilityPersonIds: form.visibility === 'custom' && form.visibility_person_ids.length ? form.visibility_person_ids : null,
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
      // "Save Event" = the wizard is COMPLETE → PUBLISHED (a completed event opens the
      // full view, not the wizard; openEvent treats only DRAFT as unfinished). The
      // in-progress draft stays DRAFT via ensureDraft; public visibility is still gated
      // by isPublic, so a Club-only event never leaks to the public embed.
      status: 'PUBLISHED',
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
          validFrom: d.valid_from_type === 'custom' && d.valid_from ? toIsoDate(d.valid_from) : null,
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
    // Land on the FULL event editor, not the one-page form.
    //
    // This used to reopen the same wizard as a single scrolling page, on the
    // reasoning that you'd want to keep editing what you just built. But the
    // wizard only covers what it takes to CREATE an event — once it exists the
    // work moves on to invitees, attendance, tickets, communication, which the
    // one-pager has no room for. Sending you back into the creation form makes
    // the event feel unfinished and hides everything you'd do next.
    navigateTo(`/events/${evtId}`)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: err?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

// The title is the first thing you'd type, so the cursor starts there. The plain
// `autofocus` attribute doesn't fire — the modal mounts on a client-side route
// change, not a page load — so focus it explicitly once it's painted.
const titleInput = ref<any>(null)
onMounted(async () => {
  nextTick(() => titleInput.value?.$el?.focus?.())
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
    banner_position: ev.bannerPosition || '',
    category_id: ev.categoryId,
    secondary_category_id: ev.secondaryCategoryId,
    age_min: ev.ageMin,
    age_max: ev.ageMax,
    gender_restriction: ev.genderRestriction,
    start_at: ev.startAt,
    end_at: ev.endAt,
    is_all_day: ev.isAllDay,
    capacity_max: ev.capacityMax,
    reg_open_at: ev.regOpenAt,
    reg_close_at: ev.regCloseAt,
    is_public: ev.isPublic,
    visibility: ev.visibility,
    visibility_type_keys: ev.visibilityTypeKeys,
    visibility_group_ids: ev.visibilityGroupIds,
    visibility_person_ids: ev.visibilityPersonIds,
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
  // Restore the categories, or saveEvent would write them back to null on resume.
  // Prefer the full multi-select array; fall back to primary + secondary.
  const evtCatIds = (evt as any).category_ids ?? (evt as any).categoryIds
  form.category_ids = (evtCatIds?.length ? evtCatIds : [evt.category_id, evt.secondary_category_id].filter(Boolean)) as string[]
  form.ageMin = evt.age_min ?? null
  form.ageMax = evt.age_max ?? null
  form.genderRestriction = evt.gender_restriction ?? null
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
  // A saved window is a deliberate one — don't let the seeder move it, and show the
  // dates rather than a summary claiming they follow the event.
  signupTouched.value = !!(evt.reg_open_at || evt.reg_close_at)
  if (signupTouched.value) signupMode.value = 'custom'

  // Restore the Invitees-step choices, or resuming a draft would silently drop
  // them: a public event would come back private, and an event whose form is
  // already built would lose the form step entirely (the step is gated on
  // use_registration_form). A linked form_id IS the evidence they chose "form".
  form.is_public = !!evt.is_public
  form.visibility = evt.visibility || (evt.is_public ? 'public' : 'internal')
  form.visibility_type_keys = evt.visibility_type_keys ?? []
  form.visibility_group_ids = evt.visibility_group_ids ?? []
  form.visibility_person_ids = evt.visibility_person_ids ?? []
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
