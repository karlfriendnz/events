<template>
  <!-- While the settings drawer is open the page gives up its right-hand 420px
       instead of being covered: the calendar shifts left and stays fully visible,
       so you watch a filter bite as you set it. -->
  <div class="p-3 sm:p-6 flex flex-col h-full transition-[margin] duration-200"
    :class="showCalSettings ? 'md:mr-[420px]' : ''">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
        <!-- WHICH calendar, before HOW you're looking at it. ONLY when the left rail
             is hidden — i.e. embedded in the old platform, where its Events flyout
             (View events / each calendar / New calendar) doesn't exist and a club
             otherwise has no route to switch calendars or make one. Standalone the
             flyout is right there, and a second control saying the same thing is
             clutter. Hidden on /programme, a single fixed view. -->
        <Select
          v-if="!isProgramme && railHidden"
          :model-value="activeCalendarValue"
          :options="calendarPickerOptions"
          option-label="label"
          option-value="value"
          size="small"
          class="hidden md:inline-flex w-40 shrink-0"
          @update:model-value="onCalendarPick" />
        <!-- View selector is desktop-only; mobile is forced to the agenda list
             view. /programme is List-only, so it's hidden there entirely. -->
        <Select
          v-if="!isProgramme"
          :model-value="calSettings.defaultView"
          :options="calViews"
          option-label="label"
          option-value="value"
          size="small"
          class="hidden md:inline-flex w-32 shrink-0"
          @update:model-value="setCalView" />
        <div class="hidden md:flex items-center gap-1 min-w-0">
          <Button icon="pi pi-chevron-left" severity="secondary" text size="small" @click="prev" />
          <span class="text-sm font-semibold text-gray-800 sm:min-w-36 text-center truncate">{{ calendarTitle }}</span>
          <Button icon="pi pi-chevron-right" severity="secondary" text size="small" @click="next" />
          <!-- Light blue, on request — it's the "jump back to now" anchor, and a
               soft tint sets it apart from the plain grey nav buttons without
               shouting like the primary New Event button does. -->
          <Button label="Today" size="small" class="ml-1 shrink-0"
            style="background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8" @click="goToday" />
        </div>
        <span class="md:hidden text-base font-semibold text-gray-900">{{ t('event', true) }}</span>
      </div>
      <div class="flex items-center gap-2">
        <IconField class="flex-1 sm:flex-none">
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" :placeholder="`Search ${t('event', true, true)}…`" size="small" class="w-full sm:w-48" />
        </IconField>
        <Button
          icon="pi pi-sliders-h"
          severity="secondary"
          outlined
          size="small"
          class="hidden md:inline-flex"
          v-tooltip.bottom="'Calendar Settings'"
          @click="openCalSettings"
        />
        <Button
          :label="isNarrow ? undefined : newButtonText"
          icon="pi pi-plus"
          size="small"
          class="shrink-0"
          @click="openEventTypeModal()"
          style="background:var(--brand-primary); border-color:var(--brand-primary)"
        />
      </div>
    </div>

    <!-- Calendar settings — a left slide-out, not a modal, so the calendar stays
         visible while you tune it. Display / Filter / Export. -->
    <!-- Non-modal + non-dismissable on purpose: the calendar stays live beside it
         (you can see a filter bite as you set it), and a click on a Select/date
         overlay — which teleports OUTSIDE the drawer — no longer slams it shut. -->
    <Drawer v-model:visible="showCalSettings" position="right" :modal="false" :dismissable="false"
      :style="{ width: '95vw', maxWidth: '420px' }" :pt="{ content: { class: 'p-0 flex flex-col' } }">
      <template #header>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">Calendar settings</p>
          <p v-if="activeCalendar" class="text-xs text-gray-500 truncate">{{ activeCalendar.name }}</p>
        </div>
      </template>

      <!-- Tabs — always shown for normal settings; hidden only during the name-first step of CREATING a calendar -->
      <div v-if="editingCalendarId || calDetailsRevealed || !creatingNewCal" class="flex border-b border-gray-200 px-4 shrink-0">
        <button v-for="tb in CAL_TABS" :key="tb.key"
          class="px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors"
          :class="calTab === tb.key ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'"
          @click="calTab = tb.key">
          <i :class="`pi ${tb.icon} mr-1.5 text-xs`" />{{ tb.label }}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">

        <!-- ── Display ───────────────────────────────────────────── -->
        <div v-if="calTab === 'display'" class="flex flex-col gap-5">
          <!-- No picker or "＋ New calendar" here: this drawer is the settings for the
               calendar you're LOOKING at, and an add-another control read as part of
               them. Both live in the CALENDAR SELECT in the page header, beside the
               view selector — picking a calendar is navigation, not a setting. (They
               were rail-only, which left a club with no route to either while the
               module runs inside the old platform and the rail is hidden.) The select's
               "＋ New calendar" opens this drawer on this pane via startNewCalendar(),
               the same flow the left menu's item uses. -->

          <!-- Create / edit a calendar — shown only when editing an existing calendar or creating a new one -->
          <div v-if="editingCalendarId || creatingNewCal" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-sm font-semibold text-gray-700">
                {{ editingCalendarId ? `Edit "${newCalendarName || 'calendar'}"` : 'New calendar' }}
              </label>
              <button v-if="editingCalendarId" class="text-xs text-red-500 hover:text-red-700 hover:underline"
                @click="deleteCalendar">Delete</button>
              <button v-else class="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                @click="creatingNewCal = false; calDetailsRevealed = false">Cancel</button>
            </div>
            <InputText v-model="newCalendarName" placeholder="Calendar name" class="w-full" @keyup.enter="newCalendarName.trim() && (calDetailsRevealed = true)" />

            <!-- New calendar: name first, then Next reveals the rest. -->
            <Button v-if="creatingNewCal && !calDetailsRevealed" label="Next" icon="pi pi-arrow-right" icon-pos="right"
              :disabled="!newCalendarName.trim()" class="mt-2 w-full justify-center"
              style="background:var(--brand-primary);border-color:var(--brand-primary)"
              @click="calDetailsRevealed = true" />

            <!-- Calendar-specific config (revealed after Next, or when editing) -->
            <template v-if="editingCalendarId || calDetailsRevealed">
              <div class="flex flex-col gap-1.5 mt-2">
                <label class="text-xs font-medium text-gray-600">Categories in this calendar</label>
                <ChipMultiSelect v-model="newCalendarCategoryIds" :options="allCategories"
                  option-label="name" option-value="id" chip-color-field="color"
                  placeholder="Any category"   class="w-full">
                  <template #option="{ option }">
                    <div class="flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: option.color || '#94a3b8' }" />
                      <span>{{ option.name }}</span>
                    </div>
                  </template>
                </ChipMultiSelect>
                <p class="text-xs text-gray-500">
                  The calendar shows these categories. New {{ t('event', true, true) }} created here are tagged with the category
                  <template v-if="newCalendarCategoryIds.length === 1">automatically</template>
                  <template v-else-if="newCalendarCategoryIds.length > 1">(you'll pick which one)</template>.
                </p>
              </div>

              <div class="flex items-center justify-between mt-2">
                <div>
                  <p class="text-sm font-semibold text-gray-700">Pin to left menu</p>
                  <p class="text-xs text-gray-500">Show this calendar as its own item in the main menu.</p>
                </div>
                <ToggleSwitch v-model="newCalendarPin" />
              </div>

              <div v-if="newCalendarPin" class="flex items-end gap-3 mt-1">
                <div class="flex flex-col gap-1.5 flex-1 min-w-0">
                  <label class="text-xs font-medium text-gray-600">Menu icon</label>
                  <IconPicker v-model="newCalendarIcon" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-gray-600">Colour</label>
                  <input type="color" :value="newCalendarColor || '#1E2157'"
                    @input="newCalendarColor = ($event.target as HTMLInputElement).value"
                    class="w-10 h-9 rounded-md border border-gray-200 cursor-pointer p-0.5" />
                </div>
              </div>
            </template>
          </div>

          <!-- General display config — shown for normal settings + when editing/creating; hidden only during the name-first create step -->
          <template v-if="editingCalendarId || calDetailsRevealed || !creatingNewCal">
          <div class="border-t border-gray-100" />

          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-gray-700">"New" button text</label>
            <InputText v-model="calSettings.newButtonLabel" :placeholder="`New ${t('event', false)}`" class="w-full" />
            <p class="text-xs text-gray-500">What the create button says — e.g. "New Holiday programme".</p>
          </div>

          <div class="border-t border-gray-100" />

          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-gray-700">Colour events by</label>
            <SelectButton v-model="calSettings.colorBy" :options="colorByOptions"
              option-label="label" option-value="value" size="small" />
          </div>

          <div v-if="!isProgramme" class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-gray-700">Default view</label>
            <SelectButton
              v-model="calSettings.defaultView"
              :options="[{ label: 'Month', value: 'dayGridMonth' }, { label: 'Week', value: 'timeGridWeek' }, { label: 'Day', value: 'timeGridDay' }, { label: 'List', value: 'listWeek' }, { label: 'Table', value: 'table' }]"
              option-label="label" option-value="value" size="small" />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-gray-700">Week starts on</label>
            <SelectButton
              v-model="calSettings.weekStart"
              :options="[{ label: 'Sunday', value: 0 }, { label: 'Monday', value: 1 }]"
              option-label="label" option-value="value" size="small" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-gray-700">Show weekends</p>
              <p class="text-xs text-gray-500">Display Saturday and Sunday on the calendar</p>
            </div>
            <ToggleSwitch v-model="calSettings.showWeekends" />
          </div>
          </template>
        </div>

        <!-- ── Filter ────────────────────────────────────────────── -->
        <div v-else-if="calTab === 'filter'" class="flex flex-col gap-3">
          <p v-if="!calSettings.filters.length" class="text-sm text-gray-500">
            No filters — every {{ t('event', false, true) }} is showing. Add one below to narrow the calendar.
          </p>

          <!-- One row per active filter, separated by a divider (no boxes) -->
          <div v-for="f in calSettings.filters" :key="f.id" class="pb-3 border-b border-gray-100">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-semibold text-gray-700">
                <i :class="`pi ${filterDef(f.key)?.icon} text-xs text-gray-400 mr-1.5`" />{{ filterDef(f.key)?.label }}
              </p>
              <Button icon="pi pi-times" severity="secondary" text size="small"
                v-tooltip.left="'Remove filter'" @click="removeFilter(f.id)" />
            </div>

            <MultiSelect v-if="f.key === 'venue'" v-model="f.value" :options="bookableTree"
              option-label="name" option-value="id" placeholder="Any venue" display="chip" filter class="w-full">
              <template #option="{ option }">
                <div class="flex items-center gap-2" :style="{ paddingLeft: `${option._depth * 16}px` }">
                  <i v-if="option._hasChildren" class="pi pi-building text-xs text-gray-400" />
                  <i v-else-if="option._depth" class="pi pi-angle-right text-xs text-gray-300" />
                  <span :class="option._depth ? 'text-gray-700' : 'font-medium text-gray-800'">{{ option.name }}</span>
                </div>
              </template>
            </MultiSelect>

            <MultiSelect v-else-if="f.key === 'category'" v-model="f.value" :options="allCategories"
              option-label="name" option-value="id" placeholder="Any category" display="chip" filter class="w-full">
              <template #option="{ option }">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: option.color || '#94a3b8' }" />
                  <span>{{ option.name }}</span>
                </div>
              </template>
              <!-- The colour is how a category is recognised on the board, so the
                   CHOSEN ones carry it too — not just the list you chose them from. -->
              <template #chip="{ value, removeCallback }">
                <span class="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-px text-xs rounded-full bg-slate-100 text-slate-700">
                  <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: categoryColor(value) }" />
                  {{ categoriesById[value]?.name ?? value }}
                  <i class="pi pi-times-circle text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    @mousedown.stop.prevent @click.stop="removeCallback($event)" />
                </span>
              </template>
            </MultiSelect>

            <MultiSelect v-else-if="f.key === 'status'" v-model="f.value" :options="STATUS_OPTIONS"
              option-label="label" option-value="value" placeholder="Any status" display="chip" class="w-full" />

            <MultiSelect v-else-if="f.key === 'type'" v-model="f.value" :options="STYLE_OPTIONS"
              option-label="label" option-value="value" placeholder="Any type" display="chip" class="w-full" />

            <div v-else-if="f.key === 'dates'" class="flex flex-col gap-2">
              <DatePicker v-model="f.value" selection-mode="range" :manual-input="false"
                date-format="D d M yy" placeholder="Pick a date range" show-icon class="w-full" />
              <p class="text-xs text-gray-500">Only {{ t('event', true, true) }} starting inside this range.</p>
            </div>
          </div>

          <!-- Add another -->
          <div class="flex items-center gap-2 pt-1">
            <Select v-model="pendingFilterKey" :options="addableFilters" option-label="label" option-value="key"
              placeholder="Choose a filter…" class="flex-1 min-w-0" :disabled="!addableFilters.length" />
            <Button label="Add" icon="pi pi-plus" size="small" :disabled="!pendingFilterKey"
              @click="addFilter()" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
          </div>
          <p v-if="!addableFilters.length" class="text-xs text-gray-400">Every filter is already in use.</p>
        </div>

        <!-- ── Export — an accordion, one panel per way of getting the data out ── -->
        <div v-else-if="calTab === 'export'" class="flex flex-col gap-2">
          <p class="text-sm text-gray-600 mb-1">
            Everything here follows the calendar as you've filtered it —
            <span class="font-semibold text-gray-800">{{ exportRows.length }}</span>
            {{ exportRows.length === 1 ? t('event', false, true) : t('event', true, true) }} showing.
          </p>

          <div v-for="fmt in EXPORT_FORMATS" :key="fmt.value" class="border border-gray-200 rounded-lg overflow-hidden">
            <button type="button" class="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              @click="exportFormat = exportFormat === fmt.value ? '' : fmt.value">
              <i :class="`pi ${fmt.icon} text-xs text-gray-400`" />
              <span class="text-sm font-semibold text-gray-700 flex-1">{{ fmt.label }}</span>
              <i class="pi text-[10px] text-gray-400" :class="exportFormat === fmt.value ? 'pi-chevron-up' : 'pi-chevron-down'" />
            </button>

            <div v-if="exportFormat === fmt.value" class="px-3 pb-3 pt-1 border-t border-gray-100 flex flex-col gap-3">
              <p class="text-xs text-gray-500">{{ fmt.hint }}</p>

              <!-- File download (CSV / iCal) -->
              <Button v-if="fmt.value !== 'embed'" :label="`Download ${fmt.value.toUpperCase()}`" icon="pi pi-download"
                size="small" :disabled="!exportRows.length" @click="runExport"
                style="background:var(--brand-primary); border-color:var(--brand-primary)" />

              <!-- Website embed -->
              <template v-else>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-semibold text-gray-700">Opening view</label>
                  <SelectButton v-model="embedView" :options="EMBED_VIEWS"
                    option-label="label" option-value="value" size="small" />
                </div>

                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-semibold text-gray-700">Paste this into your website</label>
                    <Button :label="embedCopied ? 'Copied' : 'Copy'" :icon="embedCopied ? 'pi pi-check' : 'pi pi-copy'"
                      size="small" severity="secondary" outlined @click="copyEmbed" />
                  </div>
                  <Textarea :model-value="embedSnippet" readonly rows="5" class="w-full text-xs font-mono"
                    @focus="selectAll" />
                  <a :href="embedUrl" target="_blank" class="text-xs text-primary hover:underline">
                    Preview the embed <i class="pi pi-external-link text-[10px]" />
                  </a>
                </div>

                <div class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <i class="pi pi-info-circle text-amber-500 text-xs mt-0.5" />
                  <p class="text-xs text-amber-700">
                    The embed only ever shows <strong>published</strong> {{ t('event', true, true) }} — drafts and
                    cancellations stay private, whatever your Status filter says here. Your venue, category and
                    event-type filters do carry through. Visitors clicking an
                    {{ t('event', false, true) }} land on its public registration page (when it has one).
                  </p>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- ── Share — a governing/parent org shares this calendar with the clubs beneath it ── -->
        <div v-else-if="calTab === 'share'" class="flex flex-col gap-3">
          <p class="text-xs text-gray-500">
            Share a calendar with the clubs beneath you — each club accepts it from their dashboard and its
            {{ t('event', true, true) }} appear on their own calendar. Nothing shows for them until they accept.
          </p>
          <div v-if="!activeCalendar" class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <i class="pi pi-info-circle text-amber-500 text-xs mt-0.5" />
            <p class="text-xs text-amber-700">Open one of your calendars first (from the menu or the tabs), then share it here. The combined "all events" view can't be shared.</p>
          </div>
          <template v-else>
            <p class="text-xs font-semibold text-gray-600">Sharing "{{ activeCalendar.name }}" with:</p>
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
                @click="toggleCalendarShare(club)" />
            </div>
          </template>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between w-full">
          <Button label="Reset to defaults" severity="secondary" text size="small" @click="resetCalSettings" />
          <Button :label="creatingNewCal ? 'Create calendar' : editingCalendarId ? 'Save calendar' : 'Done'"
            size="small" :loading="creatingCalendar"
            :disabled="creatingNewCal && !newCalendarName.trim()" @click="applyCalSettings"
            style="background:var(--brand-primary); border-color:var(--brand-primary)" />
        </div>
      </template>
    </Drawer>

    <!-- Move-recurring dialog -->
    <Dialog v-model:visible="dropDialog.open" modal :header="`Move recurring ${t('event', false, true)}`" :style="{ width: '95vw', maxWidth: '480px' }">
      <div class="flex flex-col gap-3 py-2">
        <p class="text-sm text-gray-700">This {{ t('event', false, true) }} is part of a recurring series. What do you want to move?</p>
        <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
          :class="dropDialog.scope === 'this' ? 'border-primary bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
          <RadioButton v-model="dropDialog.scope" value="this" />
          <div>
            <p class="text-sm font-medium text-gray-800">Just this {{ t('event', false, true) }}</p>
            <p class="text-xs text-gray-500">Only this single occurrence is moved.</p>
          </div>
        </label>
        <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
          :class="dropDialog.scope === 'following' ? 'border-primary bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
          <RadioButton v-model="dropDialog.scope" value="following" />
          <div>
            <p class="text-sm font-medium text-gray-800">This and all following</p>
            <p class="text-xs text-gray-500">Move this {{ t('event', false, true) }} and every occurrence after it by the same offset.</p>
          </div>
        </label>
        <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
          :class="dropDialog.scope === 'all' ? 'border-primary bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
          <RadioButton v-model="dropDialog.scope" value="all" />
          <div>
            <p class="text-sm font-medium text-gray-800">All {{ t('event', true, true) }} in the series</p>
            <p class="text-xs text-gray-500">Shift every occurrence (including past ones) by the same offset.</p>
          </div>
        </label>
        <div v-if="dropDialog.pending?.conflicts?.length"
          class="flex items-start gap-2 mt-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <i class="pi pi-exclamation-triangle text-amber-500 text-xs mt-0.5" />
          <div class="text-xs text-amber-700">
            Heads up — there's already an {{ t('event', false, true) }} in this series on the new date: <strong>{{ dropDialog.pending.conflicts.join(', ') }}</strong>.
            Moving "this" only will create a duplicate.
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text size="small" @click="dropDialog.open = false; dropDialog.pending = null" />
        <Button label="Move" icon="pi pi-arrow-right" size="small" @click="performDropMove" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <!-- Mobile: upcoming-events list (the calendar grid is desktop-only) -->
    <div class="md:hidden flex-1 overflow-y-auto -mx-1 px-1" style="min-height:0">
      <div v-if="!mobileEventsList.length" class="card p-10 text-center text-gray-400">
        <i class="pi pi-calendar text-3xl mb-3 block" />
        <p>No upcoming {{ t('event', true, true) }}.</p>
        <button class="text-primary hover:underline mt-2 text-sm" @click="openEventTypeModal()">Create one →</button>
      </div>
      <div v-else class="space-y-2">
        <button v-for="ev in mobileEventsList" :key="ev.id" type="button"
          class="card w-full p-3 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
          @click="onCalendarEventClick(ev)">
          <div class="w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center text-white" :style="{ background: ev.color || 'var(--brand-primary)' }">
            <span class="text-[9px] uppercase leading-none">{{ evDow(ev.start_at) }}</span>
            <span class="text-lg font-bold leading-tight">{{ new Date(ev.start_at).getDate() }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-medium text-gray-800 truncate flex items-center gap-1.5">
              <i v-if="ev.is_shared" class="pi pi-share-alt text-primary text-xs shrink-0" />{{ ev.notes }}
            </p>
            <p class="text-xs text-gray-500 truncate">{{ ev.is_shared ? `Shared by ${ev.shared_from || 'a governing body'} · ` : '' }}{{ evWhen(ev.start_at) }}</p>
          </div>
          <i class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
        </button>
      </div>
    </div>

    <!-- Calendar view (desktop) -->
    <div v-if="!isTableView" class="hidden md:flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden flex-1" style="min-height:0" @wheel="onCalendarWheel">
      <BookingsCalendar
        :cal-date="calDate"
        :cal-view="bookingsCalView"
        :custom-events="bookingsCalEvents"
        :show-weekends="calSettings.showWeekends"
        @booking-click="onCalendarEventClick"
        @booking-drop="onCalendarEventDrop"
        @booking-hover="onCalendarEventHover"
        @booking-leave="hideTooltip"
        @slot-click="onCalendarSlotClick"
      />
    </div>

    <!-- Programme list (desktop) — a purpose-built table for programmes -->
    <div v-else-if="isProgramme" class="hidden md:flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden flex-1" style="min-height:0">
      <div class="overflow-y-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="sticky top-0 bg-gray-50 border-b border-gray-200 text-left z-10">
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Programme</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Runs</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Days</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Sessions</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Registrations</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="e in exportRows" :key="e.id" class="hover:bg-gray-50 cursor-pointer" @click="navigateTo(`/events/${e.id}?tab=dates`)">
              <td class="px-4 py-2.5 font-medium text-gray-800">
                <span class="inline-flex items-center gap-2 min-w-0">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: categoriesById[e.category_id]?.color ?? '#6D28D9' }" />
                  <span class="truncate">{{ e.title || 'Untitled programme' }}</span>
                </span>
              </td>
              <td class="px-4 py-2.5 text-gray-600 whitespace-nowrap">{{ progRuns(e) }}</td>
              <td class="px-4 py-2.5 text-center text-gray-600">{{ progStat(e.id).days || '—' }}</td>
              <td class="px-4 py-2.5 text-center text-gray-600">{{ progStat(e.id).types || '—' }}</td>
              <td class="px-4 py-2.5 text-center text-gray-600">{{ progStat(e.id).registrations }}</td>
              <td class="px-4 py-2.5 text-gray-600 whitespace-nowrap">{{ progFee(e.id) }}</td>
              <td class="px-4 py-2.5"><span class="text-[11px] px-2 py-0.5 rounded-full font-medium" :class="statusClass(e.status)">{{ (e.status || 'DRAFT').toLowerCase() }}</span></td>
            </tr>
            <tr v-if="!exportRows.length">
              <td colspan="7" class="px-4 py-16 text-center text-sm text-gray-400">No programmes yet — click "New" to create one.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Table view (desktop) — a spreadsheet of exactly what the calendar shows -->
    <div v-else class="hidden md:flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden flex-1" style="min-height:0">
      <div class="overflow-y-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="sticky top-0 bg-gray-50 border-b border-gray-200 text-left z-10">
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t('event', false) }}</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Venue</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
              <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="e in exportRows" :key="e.id" class="hover:bg-gray-50 cursor-pointer" @click="openEvent(e)">
              <td class="px-4 py-2.5 font-medium text-gray-800">
                <span class="inline-flex items-center gap-2 min-w-0">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: categoriesById[e.category_id]?.color ?? '#94a3b8' }" />
                  <i v-if="e.is_shared" class="pi pi-share-alt text-primary text-xs shrink-0" v-tooltip.top="`Shared by ${e.shared_from || 'a governing body'}`" />
                  <span class="truncate">{{ e.title || 'Untitled' }}</span>
                </span>
              </td>
              <td class="px-4 py-2.5 text-gray-600 whitespace-nowrap">{{ tableDate(e) }}</td>
              <td class="px-4 py-2.5 text-gray-600 whitespace-nowrap">{{ tableTime(e) }}</td>
              <td class="px-4 py-2.5 text-gray-600 truncate max-w-[220px]">{{ venueNamesFor(e) || '—' }}</td>
              <td class="px-4 py-2.5 text-gray-600">{{ categoriesById[e.category_id]?.name ?? '—' }}</td>
              <td class="px-4 py-2.5"><span class="text-[11px] px-2 py-0.5 rounded-full font-medium" :class="statusClass(e.status)">{{ (e.status || 'DRAFT').toLowerCase() }}</span></td>
            </tr>
            <tr v-if="!exportRows.length">
              <td colspan="6" class="px-4 py-16 text-center text-sm text-gray-400">No {{ t('event', true, true) }} to show.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Event hover tooltip -->
    <ClientOnly>
    <Teleport to="body">
      <div v-if="tooltip.visible" ref="tooltipEl" class="fixed z-50 pointer-events-none"
        :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
        <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-72">
          <!-- Banner image -->
          <div v-if="tooltip.event?.banner_url" class="h-32 overflow-hidden">
            <!-- Re-place on load: an image that arrives after the first measurement
                 makes the card ~130px taller, which can push it off the bottom. -->
            <img :src="tooltip.event.banner_url" class="w-full h-full object-cover" @load="placeTooltip" />
          </div>
          <!-- Category colour bar (only when no banner) -->
          <div v-else class="h-1 rounded-full mx-4 mt-4" :style="{ background: tooltip.event?.category?.color ?? '#1E2157' }" />
          <div class="p-4">
          <p class="font-semibold text-gray-900 text-sm leading-snug mb-2">{{ tooltip.event?.title }}</p>
          <div class="space-y-1.5 text-xs text-gray-500">
            <div v-if="tooltip.event?.start_at" class="flex items-center gap-2">
              <i class="pi pi-calendar w-3.5 shrink-0" />
              <span>{{ formatDate(tooltip.event.start_at) }}<span v-if="tooltip.event.end_at && tooltip.event.start_at !== tooltip.event.end_at" class="text-gray-400"> – {{ formatDate(tooltip.event.end_at) }}</span></span>
              <span v-if="!tooltip.event.is_all_day" class="text-gray-400">{{ formatTime(tooltip.event.start_at) }}<span v-if="tooltip.event.end_at"> – {{ formatTime(tooltip.event.end_at) }}</span></span>
            </div>
            <div v-if="tooltip.event?.address || tooltip.event?.meeting_link" class="flex items-center gap-2">
              <i class="pi pi-map-marker w-3.5 shrink-0" />
              <span class="truncate">{{ tooltip.event.address || tooltip.event.meeting_link }}</span>
            </div>
            <div v-if="tooltip.event?.category" class="flex items-center gap-2">
              <i class="pi pi-tag w-3.5 shrink-0" />
              <span class="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                :style="{ background: tooltip.event.category.color ?? '#1E2157' }">
                {{ tooltip.event.category.name }}
              </span>
            </div>
            <div v-if="tooltip.event?.description" class="flex items-start gap-2 pt-1 border-t border-gray-100">
              <i class="pi pi-align-left w-3.5 shrink-0 mt-0.5" />
              <!-- The description is stored as HTML (RichTextEditor). This is a
                   two-line summary, not a rendered document, so show its TEXT. -->
              <span class="line-clamp-2 leading-relaxed">{{ plainText(tooltip.event.description) }}</span>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
            <span class="text-xs text-gray-500 flex items-center gap-1.5">
              <i class="pi pi-users w-3.5" />
              {{ attendeeCount(tooltip.event?.id) }} {{ attendeeCount(tooltip.event?.id) === 1 ? 'attendee' : 'attendees' }}
            </span>
            <span class="text-xs text-gray-400">Click to open</span>
          </div>
          </div>
        </div>
      </div>
    </Teleport>
    </ClientOnly>

    <!-- Row menu -->
    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- New event: three ways in — describe it to the AI, walk the wizard, or
         build it yourself. (createWithAi() + /api/ai-parse-event already
         existed; the AI box had simply never been rendered anywhere.) -->
    <Dialog v-model:visible="showEventNameModal" :header="`New ${t('event', false, true)}`" modal :style="{ width: '95vw', maxWidth: '560px' }">
      <div class="space-y-5 pt-1">

        <!-- 1. Describe it — hidden for now (flip AI_EVENT_BOX to bring it back;
             createWithAi() + /api/ai-parse-event are live and working). -->
        <div v-if="AI_EVENT_BOX" class="rounded-xl border border-gray-200 overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-100">
            <i class="pi pi-sparkles text-violet-500 text-sm" />
            <span class="text-sm font-semibold text-gray-800">Describe your {{ t('event', false, true) }}</span>
            <span class="text-xs text-gray-500">— we'll fill in the details</span>
          </div>
          <div class="p-4 space-y-2">
            <Textarea
              v-model="aiPrompt"
              rows="3"
              autoResize
              class="w-full text-sm"
              :placeholder="`e.g. Junior training every Tuesday 4–5pm at the main hall, starting next week, $5 per session`" />
            <p v-if="aiError" class="text-xs text-red-500">{{ aiError }}</p>
            <div class="flex justify-end">
              <Button
                label="Create with AI"
                icon="pi pi-sparkles"
                size="small"
                :loading="aiLoading"
                :disabled="!aiPrompt.trim()"
                style="background:var(--brand-primary);border-color:var(--brand-primary)"
                @click="createWithAi" />
            </div>
          </div>
        </div>

        <div v-if="AI_EVENT_BOX" class="flex items-center gap-3">
          <div class="flex-1 h-px bg-gray-100" />
          <span class="text-xs text-gray-400 uppercase tracking-wide">or start from scratch</span>
          <div class="flex-1 h-px bg-gray-100" />
        </div>

        <!-- Just pick how you want to build it — the name is asked for inside
             each builder, so asking here first was a gate for no reason. -->
        <!-- A 2x2 GRID, but the cells are separated by HAIRLINES rather than each
             drawing its own border — four bordered tiles read as four competing
             buttons. gap-px over a gray surface (the same trick the group stats card
             uses) gives one clean divider between cells and none around the outside.
             Quick event leads (the fast path) and carries the accent. -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 rounded-xl overflow-hidden">
          <!-- Quick event: name . date . location . invitees, all in one modal. -->
          <button type="button" class="group bg-white text-left p-4 transition-colors hover:bg-[#F5F8FA]"
            @click="openQuick">
            <span class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2 transition-colors group-hover:bg-primary/15">
              <i class="pi pi-bolt text-primary text-sm" />
            </span>
            <span class="flex items-center gap-2">
              <span class="text-sm font-semibold text-gray-900">Quick {{ t('event', false, true) }}</span>
              <span class="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">Fastest</span>
            </span>
            <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">Name, date, location &amp; invitees &mdash; all on one screen.</span>
          </button>

          <button type="button" class="group bg-white text-left p-4 transition-colors hover:bg-[#F5F8FA]"
            @click="startWizard">
            <span class="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
              <i class="pi pi-list-check text-primary text-sm" />
            </span>
            <span class="block text-sm font-semibold text-gray-900">Create basic {{ t('event', false, true) }}</span>
            <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">Guided, one step at a time.</span>
          </button>

          <button type="button" class="group bg-white text-left p-4 transition-colors hover:bg-[#F5F8FA]"
            @click="startHolidayProgramme">
            <span class="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
              <i class="pi pi-sun text-emerald-700 text-sm" />
            </span>
            <span class="block text-sm font-semibold text-gray-900">Programme</span>
            <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">Runs across many days &mdash; book sessions per day.</span>
          </button>

          <!-- LAST on purpose: it is the only one you cannot actually use yet.
               Shows to EVERYONE, but as a promise rather than a door — disabled +
               "Coming soon". It was previously governing-orgs-only and live for
               them; see the note on startAdvanced() before re-enabling. -->
          <button type="button" disabled
            class="group bg-white text-left p-4 opacity-60 cursor-not-allowed">
            <span class="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center mb-2">
              <i class="pi pi-sliders-v text-amber-700 text-sm" />
            </span>
            <span class="flex items-center gap-2">
              <span class="text-sm font-semibold text-gray-900">Advanced {{ t('event', false, true) }}</span>
              <span class="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">Coming soon</span>
            </span>
            <span class="block text-xs text-gray-500 mt-0.5 leading-relaxed">Sessions, fees, forms, discounts and automation.</span>
          </button>
        </div>
      </div>
    </Dialog>

    <!-- Quick event: the whole thing on one screen — name, date, location,
         invitees — then create. A draft is created on open so the reusable
         invitee manager can write to a real event id; Create publishes it,
         Cancel deletes the draft (onQuickClose) so nothing is left behind. -->
    <!-- 1200px; top-anchoring comes from the global modal rule in main.css. -->
    <Dialog v-model:visible="quickOpen" :header="`Quick ${t('event', false, true)}`" modal
      :style="{ width: '95vw', maxWidth: '1200px' }" @show="focusQuickName" @hide="onQuickClose">
      <div class="space-y-3 pt-1">
        <!-- Two tiny steps: essentials, then people. Keeps step 1 phone-simple. -->
        <div class="flex items-center gap-1.5 text-xs mb-1">
          <span :class="quickStep === 1 ? 'text-primary font-semibold' : 'text-gray-400'">1 · Details</span>
          <i class="pi pi-angle-right text-[10px] text-gray-300" />
          <span :class="quickStep === 2 ? 'text-primary font-semibold' : 'text-gray-400'">2 · Invitees</span>
        </div>

        <!-- Step 1 · Details. Every field shares one w-20 left-label column so
             Name / When / Location line up (stacks to label-above on mobile). -->
        <div v-show="quickStep === 1" class="space-y-3">
          <!-- Name -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
            <span class="field-label shrink-0 sm:w-20">Name <span class="text-red-500">*</span></span>
            <!-- `autofocus` is the FRAMEWORK-NATIVE path: PrimeVue's Dialog looks for
                 [autofocus] inside itself when it opens and focuses it, with no timers
                 of ours involved. focusQuickName() (@show) stays as the belt to this
                 braces — between them, one of the two always wins the race against the
                 closing New-event dialog handing focus back to its trigger. -->
            <InputText ref="quickNameInput" v-model="quickForm.name" autofocus :placeholder="`${t('event', false)} name`" class="flex-1 min-w-0"
              @keydown.enter="quickNext" />
          </div>

          <!-- When -->
          <DateTimeEditor
            v-model:startDate="quickForm.start_date"
            v-model:endDate="quickForm.end_date"
            v-model:startTime="quickForm.start_time"
            v-model:endTime="quickForm.end_time"
            v-model:isAllDay="quickForm.is_all_day"
            v-model:repeat="quickForm.repeat"
            v-model:exdates="quickForm.exdates"
            :divider="false" no-past-today
            label="When" required label-width="sm:w-20" row-padding="px-0 py-1" />

          <!-- Recurring indicator — shows the rule when the event repeats; click to
               preview every occurrence that will be created (the series). -->
          <div v-if="quickForm.repeat" class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
            <span class="field-label shrink-0 sm:w-20" />
            <button type="button"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-full pl-2.5 pr-2.5 py-1 transition-colors w-max"
              @click="openSeriesPreview">
              <i class="pi pi-sync text-[10px]" />
              {{ quickRepeatSummary }}
              <span class="text-primary/60">· view series</span>
              <i class="pi pi-chevron-right text-[9px]" />
            </button>
          </div>

          <!-- Category + Discipline — the same row the wizards use, so the quickest
               create flow classifies an event exactly like the slower ones (and can
               make a category on the spot). Disciplines bind to the draft row. -->
          <EventCategoryRow v-model="quickForm.category_ids" :categories="allCategories"
            :event-id="quickDraftId" label-width="5rem"
            @created="c => allCategories.push(c)" />

          <!-- Visibility — who can see this event (defaults to Internal). The picker
               and its option loaders now live in <EventVisibilityPicker>, shared with
               the basic + advanced wizards. -->
          <EventVisibilityPicker
            v-model="quickForm.visibility"
            v-model:type-keys="quickForm.visibility_type_keys"
            v-model:group-ids="quickForm.visibility_group_ids"
            v-model:person-ids="quickForm.visibility_person_ids" />

          <!-- Location — collapsed to a slim row (label left, pill right) -->
          <div v-if="!quickShowLocation" class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
            <span class="field-label shrink-0 sm:w-20">Location</span>
            <button type="button"
              class="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm hover:border-primary hover:bg-[#F0F4FF] transition-colors"
              @click="quickShowLocation = true">
              <i class="pi pi-map-marker text-gray-400 shrink-0" />
              <span class="flex-1 text-left truncate" :class="quickLocationSummary ? 'text-gray-800' : 'text-gray-500'">{{ quickLocationSummary || 'Add location' }}</span>
              <i class="pi text-gray-300 text-xs" :class="quickLocationSummary ? 'pi-pencil' : 'pi-plus'" />
            </button>
          </div>
          <div v-else class="flex flex-col sm:flex-row sm:gap-4">
            <span class="field-label shrink-0 sm:w-20 sm:pt-2.5">Location</span>
            <div class="flex-1 min-w-0">
              <div class="flex justify-end mb-1">
                <button type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="quickShowLocation = false">Done</button>
              </div>
              <LocationEditor v-model="quickForm.locations" :multi="false" />
            </div>
          </div>
        </div>

        <!-- Step 2 · Invitees (optional — the picker only mounts on this step) -->
        <div v-show="quickStep === 2">
          <p class="text-xs text-gray-500 mb-2">Add people now, or skip — you can invite anyone later.</p>
          <div class="max-h-[55vh] overflow-y-auto -mx-1 px-1">
            <EventInviteeManager v-if="quickDraftId && quickStep === 2" :event-id="quickDraftId" :show-invite="false" />
          </div>
        </div>
      </div>
      <!-- Footer: the step-back control sits LEFT (it goes backwards, so it reads
           against the flow), the forward action right. -->
      <template #footer>
        <div class="flex items-center gap-3 w-full">
          <template v-if="quickStep === 1">
            <Button label="Cancel" severity="secondary" text @click="quickOpen = false" />
            <span class="flex-1" />
            <Button label="Next" icon="pi pi-arrow-right" icon-pos="right"
              :disabled="!quickForm.name.trim() || !quickForm.start_date"
              style="background:var(--brand-primary);border-color:var(--brand-primary)"
              @click="quickNext" />
          </template>
          <template v-else>
            <Button label="Back" icon="pi pi-arrow-left" severity="secondary" text @click="quickStep = 1" />
            <span class="flex-1" />
            <!-- Ticked by default — you picked these people to tell them. Untick to
                 create quietly. Sending runs AFTER the event is created (and after the
                 series is materialised) and never blocks the create. -->
            <label class="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600 hover:text-gray-800">
              <Checkbox v-model="quickSendInvite" binary input-id="quick-send-invite" />
              Send invite
            </label>
            <Button label="Create event" icon="pi pi-check" :loading="creatingQuick"
              style="background:var(--brand-primary);border-color:var(--brand-primary)"
              @click="createQuickEvent" />
          </template>
        </div>
      </template>
    </Dialog>

    <!-- Series preview — the occurrences a recurring quick event will create. -->
    <Dialog v-model:visible="seriesPreviewOpen" modal
      :header="`Series · ${seriesPreviewRows.length} ${seriesPreviewRows.length === 1 ? t('event', false) : t('event', true)}`"
      :style="{ width: '95vw', maxWidth: '520px' }">
      <p class="text-xs text-gray-500 mb-3">{{ quickRepeatSummary }} — these occurrences are created when you add the {{ t('event', false, true) }}.</p>
      <div class="border border-gray-200 rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
        <table class="w-full text-sm">
          <tbody class="divide-y divide-gray-100">
            <tr v-for="(d, i) in seriesPreviewRows" :key="i" class="hover:bg-gray-50">
              <td class="px-3 py-2 text-gray-400 w-10 text-right tabular-nums">{{ i + 1 }}</td>
              <td class="px-3 py-2 font-medium text-gray-800">{{ d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }}</td>
              <td v-if="!quickForm.is_all_day && quickForm.start_time" class="px-3 py-2 text-gray-500 text-right whitespace-nowrap">
                {{ quickForm.start_time.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}
              </td>
            </tr>
            <tr v-if="!seriesPreviewRows.length"><td class="px-3 py-6 text-center text-gray-400">No occurrences in the next year.</td></tr>
          </tbody>
        </table>
      </div>
    </Dialog>

    <!-- Is the event split into parts people sign up to separately? That — not
         how many DAYS it spans — is what decides the simple vs multi-session
         builder. A one-day event can be split into 3 sessions; a 4-day camp is
         one session per day. The user never sees the word "multi-session". -->
    <Dialog v-model:visible="showSessionCountModal" header="Is this event split into sessions?" modal :style="{ width: '95vw', maxWidth: '580px' }">
      <div class="space-y-4 pt-1">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button"
            class="text-left border-2 rounded-xl p-4 transition-colors hover:border-primary hover:bg-[#F0F4FF] flex flex-col items-start"
            @click="chooseSingleSession">
            <!-- Fixed-height box so both cards' icons sit on the same baseline
                 regardless of each artwork's aspect ratio. -->
            <div class="h-[39px] flex items-center mb-3">
              <IconsIconEventSingle class="w-[46px] h-[39px] text-primary" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900">No — it's one single event</h3>
            <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">
              People sign up to the whole thing. A game, a prizegiving, an AGM, a one-off training.
            </p>
          </button>
          <button type="button"
            class="text-left border-2 rounded-xl p-4 transition-colors hover:border-primary hover:bg-[#F0F4FF] flex flex-col items-start"
            @click="chooseMultiSession">
            <div class="h-[39px] flex items-center mb-3">
              <IconsIconEventSessions class="w-[46px] h-[39px] text-primary" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900">Yes — it's split into sessions</h3>
            <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">
              People can sign up to some sessions or all of them. Three sessions in one day, or one a day across a
              four-day camp — either way.
            </p>
          </button>
        </div>
        <div class="flex justify-start pt-1">
          <Button label="Back" icon="pi pi-arrow-left" size="small" severity="secondary" text @click="backToNewEvent" />
        </div>
      </div>
    </Dialog>

    <!-- Event type picker modal -->
    <Dialog v-model:visible="showEventTypeModal" :header="`Create new ${t('event', false, true)}`" modal :style="{ width: '95vw', maxWidth: '680px' }">

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          class="border-2 rounded-xl p-5 cursor-pointer hover:border-primary hover:bg-[#F0F4FF] transition-colors group"
          @click="createBasicEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
            <i class="pi pi-calendar text-primary text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Invite Only</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Simple single-page setup. Covers all essentials without the wizard steps.</p>
        </div>
        <div
          class="border-2 rounded-xl p-5 cursor-pointer hover:border-primary hover:bg-[#F0F4FF] transition-colors group"
          @click="createMultiSessionEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3">
            <i class="pi pi-clone text-green-700 text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Multi Session</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Ideal for holiday programmes. Multiple sessions under one event with shared registration.</p>
        </div>
        <div v-if="isGoverningOrg"
          class="border-2 rounded-xl p-5 cursor-pointer hover:border-primary hover:bg-[#F0F4FF] transition-colors group"
          @click="createAdvancedEvent"
        >
          <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
            <i class="pi pi-list text-purple-700 text-lg" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Advanced Event</h3>
          <p class="text-xs text-gray-500 leading-relaxed">Full wizard with fees, forms, discounts, automation and more.</p>
        </div>
      </div>

      <div class="flex items-center gap-2 mt-5 pt-4 border-t border-gray-100">
        <Checkbox v-model="useWizard" :binary="true" inputId="use-wizard" />
        <label for="use-wizard" class="text-sm text-gray-600 cursor-pointer select-none">
          Use step-by-step wizard
        </label>
        <span class="text-xs text-gray-400 ml-1">(guides you through one section at a time)</span>
      </div>
    </Dialog>

    <!-- Demo Data Prompt -->
    <Dialog v-model:visible="showDemoPrompt" header="Welcome to FriendlyManager!" modal :closable="false" :style="{ width: '95vw', maxWidth: '460px' }">
      <div class="py-2 space-y-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <i class="pi pi-sparkles text-primary" />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-800 mb-1">Your calendar is empty.</p>
            <p class="text-sm text-gray-500">Would you like to load some sample {{ t('event', true, true) }} and categories so you can explore the app, or start with a blank slate?</p>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Start Fresh" severity="secondary" text :loading="installingDemo" @click="dismissDemoPrompt" />
        <Button label="Install Demo Data" icon="pi pi-download" :loading="installingDemo" @click="installDemoData" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'


// Auto-imported composables must be called BELOW the import block: Vite rewrites
// imports in place rather than hoisting them, so a call above them resolves to
// an undefined binding ("useOrg is not defined") at runtime.
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const eventsApi = useEventsApi()
const bookingsApi = useBookingsApi()
const calendarApi = useWaitlistsApi() // calendars + calendar_categories writes seam
const toast = useToast()
const confirm = useConfirm()
const route = useRoute()

// The seam returns camelCase FMEvents; this component (and its computeds/template)
// read snake_case throughout, so map each loaded event back to the shape they expect.
// `category` is attached from the separately-loaded category catalogue (the old query
// embedded it via a join).
function toEventRow(e: any) {
  return {
    id: e.id,
    org_id: e.orgId,
    title: e.title,
    description: e.description ?? null,
    style: e.style,
    status: e.status,
    start_at: e.startAt,
    end_at: e.endAt,
    is_public: e.isPublic,
    is_programme: e.isProgramme,
    is_all_day: e.isAllDay ?? false,
    form_id: e.formId ?? null,
    member_group_id: e.memberGroupId ?? null,
    category_id: e.categoryId ?? null,
    banner_url: e.bannerUrl ?? null,
    location_type: e.locationType ?? null,
    address: e.address ?? null,
    meeting_link: e.meetingLink ?? null,
    age_min: e.ageMin ?? null,
    age_max: e.ageMax ?? null,
    recurrence_rule: e.recurrenceRule ?? null,
    recurrence_parent_id: e.recurrenceParentId ?? null,
    created_via: e.createdVia ?? null,
    exdates: e.exdates ?? [],
    category: e.categoryId ? (categoriesById.value[e.categoryId] ?? null) : null,
  }
}

// This same board serves /programme (aliased below). A "programme" is just an
// event with is_programme=true; on /programme we scope to those + lock the view
// to List, on /events we exclude them. Everything else is identical.
const isProgramme = computed(() => route.path === '/programme')
// Drive the top-bar breadcrumbs directly: 'Programme' on /programme, empty on
// /events (so the pageTitles map shows 'Events'). useBreadcrumbs() with no arg
// just hands back the shared state ref.
const breadcrumbsState = useBreadcrumbs()
watchEffect(() => { breadcrumbsState.value = isProgramme.value ? [{ label: 'Programme' }] : [] })
onUnmounted(() => { breadcrumbsState.value = [] })


const events = ref<any[]>([])
const separateSessions = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const showCalSettings = useCalendarSettingsOpen()
const showEventNameModal = ref(false)
const showEventTypeModal = ref(false)
const showSessionCountModal = ref(false)
const useWizard = ref(true)
const newEventName = ref('')
const clickedDate = ref<string | null>(null)
const clickedEndDate = ref<string | null>(null)
// The "Describe your event" AI box on the New event modal. Parked for now —
// createWithAi() + /api/ai-parse-event work; flip this to surface it again.
const AI_EVENT_BOX = false

const aiPrompt = ref('')
const aiLoading = ref(false)
const aiError = ref('')

async function createWithAi() {
  if (!aiPrompt.value.trim()) return
  aiLoading.value = true
  aiError.value = ''
  try {
    const result = await $fetch<any>('/api/ai-parse-event', {
      method: 'POST',
      body: { description: aiPrompt.value },
    })
    sessionStorage.setItem('ai_event_prefill', JSON.stringify(result))
    showEventNameModal.value = false
    showEventTypeModal.value = false
    aiPrompt.value = ''
    const params = new URLSearchParams()
    if (clickedDate.value) params.set('date', clickedDate.value)
    if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
    params.set('prefill', '1')
    const q = `?${params}`
    navigateTo(`/events/new${q}`)
  } catch (e: any) {
    aiError.value = e?.data?.message ?? 'Something went wrong'
  } finally {
    aiLoading.value = false
  }
}
const viewMode = ref('calendar')
const calendarRef = ref()

// When creating within a named calendar that maps to exactly ONE category, new
// events are auto-tagged with it. (Multiple categories → the user picks in the wizard.)
const activeCalendarStampCategory = computed(() => {
  const cats = activeCalendar.value?.categoryIds ?? []
  return cats.length === 1 ? cats[0] : null
})

function openEventTypeModal(date?: string, endDate?: string) {
  clickedDate.value = date ?? null
  clickedEndDate.value = endDate ?? null
  // A programme IS a multi-session event — creating one goes straight to the
  // multi-session builder, skipping the "how do you want to build it?" modal.
  if (isProgramme.value) {
    const params = new URLSearchParams({ programme: '1' })
    if (date) params.set('date', date)
    if (endDate) params.set('endDate', endDate)
    if (activeCalendarStampCategory.value) params.set('category', activeCalendarStampCategory.value)
    navigateTo(`/events/new-multi?${params}`)
    return
  }
  newEventName.value = ''
  showEventNameModal.value = true
}

// Both routes ask how often it runs first. The answer decides which builder they
// land in (single vs multi-session); the user never sees those words.
//   wizard + once     → the stepped basic wizard
//   wizard + several  → the multi-session wizard
//   custom + once     → the full advanced form
//   custom + several  → the multi-session form
const creationMode = ref<'wizard' | 'custom'>('wizard')

// For now every event is assumed to be a single session — the "Is this event
// split into sessions?" modal is skipped and both routes go straight down the
// single-session path. (The modal + chooseMultiSession stay in place to restore
// later: point these back at showSessionCountModal.value = true.)
function startWizard() {
  creationMode.value = 'wizard'
  showEventNameModal.value = false
  chooseSingleSession()
}
// NB there is no startCustom() any more — "Custom event" was removed from the New
// event modal. The one-page custom editor itself STAYS: `creationMode 'custom'` and
// /events/new-basic?mode=full are still how openEvent() reopens an existing
// single-session event, so the route has to keep working. Only the way IN is gone.
// Advanced = the full event editor page (/events/:id), not the modal builder.
// Create the draft row here (same shape new-advanced's ensureDraft used) and
// land the user on it. openEvent() routes created_via:'advanced' back here too.
//
// NOTHING CALLS THIS RIGHT NOW — the Advanced card in the New event modal is
// disabled and badged "Coming soon". It is kept, working, because that badge is a
// promise: re-enabling is deleting `disabled` on the card and putting @click back.
// It WAS live for governing orgs before the badge went on, so if they need it back
// the fix is to restore the old `v-if="isGoverningOrg"` gate rather than rebuild it.
const creatingAdvanced = ref(false)
async function startAdvanced() {
  if (creatingAdvanced.value) return
  creatingAdvanced.value = true
  showEventNameModal.value = false
  try {
    const payload: any = {
      orgId: orgId.value,
      // No name is asked for up front any more — the builder collects it, so the
      // row starts as a draft placeholder (same convention as the wizards).
      title: newEventName.value.trim() || '(draft)',
      status: 'DRAFT',
      style: 'ADVANCED',
      createdVia: 'advanced',
      isProgramme: isProgramme.value,
    }
    if (activeCalendarStampCategory.value) payload.categoryId = activeCalendarStampCategory.value
    if (clickedDate.value) payload.startAt = clickedDate.value
    if (clickedEndDate.value) payload.endAt = clickedEndDate.value
    const created = await eventsApi.create(payload)
    navigateTo(`/events/${created.id}`)
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Could not create the event', detail: error?.message, life: 4000 })
    showEventNameModal.value = true
  } finally {
    creatingAdvanced.value = false
  }
}
// Holiday programme = a multi-session event → straight to the multi-session
// builder (reachable from any events board, incl. a pinned "Holiday Programme"
// calendar, now that Programme is no longer a hardcoded menu item).
function startHolidayProgramme() {
  showEventNameModal.value = false
  const params = new URLSearchParams({ programme: '1' })
  if (newEventName.value.trim()) params.set('name', newEventName.value.trim())
  if (activeCalendarStampCategory.value) params.set('category', activeCalendarStampCategory.value)
  // CARRY THE SELECTED DATES. Dragging a range on the calendar and then choosing
  // Programme threw the range away — every other way in passes these (the wizard, the
  // custom page, the quick modal all read clickedDate/clickedEndDate), and new-multi
  // has always read ?date= / ?endDate= into its Programme dates. Only this entry point
  // never sent them, so the one flow where a date RANGE matters most started blank.
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  navigateTo(`/events/new-multi?${params}`)
}

// ── Quick event: name · date · location · invitees, all in one modal ─────────
// A draft row is created on open (like the wizards' ensureDraft) so the reusable
// <EventInviteeManager> — which writes invitees against a real event id — can be
// mounted directly. "Create" flips it to PUBLISHED + saves the details; cancelling
// deletes the draft (onQuickClose) so an abandoned modal leaves nothing behind.
const quickOpen = ref(false)

/**
 * Take me to what a review comment is about (see composables/useReviewGoto).
 *
 * Several comments on this board were left INSIDE a dialog — the New-event
 * chooser, the Quick-event modal — and a closed dialog has no element to scroll
 * to, so clicking those comments did nothing at all. Reopening the dialog is
 * what makes them reachable.
 *
 * Matched on the dialog's captured title against a short explicit list. The
 * titles are terminology-driven (`t('event')`), so a club that renames Event to
 * Fixture gets "New fixture" — hence matching on the STABLE part ("new" /
 * "quick") rather than the whole string, which would silently stop matching the
 * moment a club renamed anything.
 */
useReviewGoto(({ dialog }) => {
  const d = dialog?.trim().toLowerCase()
  if (!d) return
  if (d.startsWith('quick')) quickOpen.value = true
  else if (d.startsWith('new')) showEventNameModal.value = true
})

const quickNameInput = ref<any>(null)
/**
 * Put the cursor in the name box when the Quick event dialog opens.
 *
 * WHY THIS IS NOT JUST ONE focus() CALL. Opening Quick event closes the New event
 * dialog and opens this one in the same tick. PrimeVue's Dialog RESTORES FOCUS to
 * whatever was focused before it opened when it hides — so the closing dialog hands
 * focus back to the "New event" button a frame or two later, stealing it from the
 * field we just focused. A single `nextTick(() => input.focus())` therefore appears
 * to work and then silently loses: the cursor ends up nowhere and your first
 * keystrokes go to the page.
 *
 * So: focus on this dialog's own `show` (which fires after PrimeVue's own focus
 * handling), then again on the next frame, then once more after the closing
 * dialog's leave transition has finished. Re-focusing an already-focused input is
 * a no-op, so the extra passes cost nothing when nothing steals it.
 */
function focusQuickName() {
  const put = () => {
    const c: any = quickNameInput.value
    const el: HTMLElement | undefined = c?.$el ?? c
    if (!el) return
    const active = document.activeElement as HTMLElement | null
    // Only stand down for a field the USER chose. PrimeVue parks focus on the
    // dialog container / its close button when it opens, and an earlier version of
    // this guard treated "focus is somewhere inside .p-dialog" as "leave it alone" —
    // which is true of PrimeVue's own initial focus, so it never focused at all.
    if (active && active !== el && /^(input|textarea|select)$/i.test(active.tagName)) return
    el.focus?.()
  }
  put()
  requestAnimationFrame(put)
  setTimeout(put, 180)
}
const creatingQuick = ref(false)
const quickDraftId = ref<string | null>(null)
const quickCreated = ref(false)
const quickForm = reactive<{
  name: string
  start_date: Date | null; start_time: Date | null
  end_date: Date | null; end_time: Date | null
  is_all_day: boolean
  repeat: string; exdates: string[]
  category_id: string | null
  category_ids: string[]
  visibility: string
  visibility_type_keys: string[]
  visibility_person_ids: string[]
  visibility_group_ids: string[]
  locations: any[]
}>({
  name: '', start_date: null, start_time: null, end_date: null, end_time: null,
  is_all_day: false,
  repeat: '', exdates: [],
  category_id: null,
  category_ids: [] as string[],
  visibility: 'internal',   // a quick event defaults to internal
  visibility_type_keys: [] as string[],
  visibility_person_ids: [] as string[],
  visibility_group_ids: [] as string[],
  locations: [{ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] }],
})

const quickStep = ref(1)                 // 1 = details, 2 = invitees
const quickSendInvite = ref(true)        // ticked by default: email the invitees on create
const quickShowLocation = ref(false)     // location starts collapsed to a slim row
const quickLocationSummary = computed(() => {
  const l: any = quickForm.locations[0]
  if (!l) return ''
  if (l.type === 'ONLINE') return l.meeting_link ? 'Online' : ''
  if (l.type === 'BOOKABLE') return l.venue_name || (l.bookable_ids?.length ? 'Venue booked' : '')
  return l.address || l.venue_name || ''
})
function quickNext() {
  if (!quickForm.name.trim() || !quickForm.start_date) return
  quickStep.value = 2
}

// Merge a separate date + time (the DateTimeEditor's shape) into one ISO string.
function quickBuildDateTime(date: Date | null, time: Date | null, allDay: boolean): string | null {
  if (!date) return null
  const d = new Date(date)
  if (time && !allDay) d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  else d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// Best-effort: resolve the signed-in user to a person and make them a coordinator of
// the event. Never blocks creation — an event without a coordinator is fine, an event
// that failed to save because of one is not.
async function ensureCreatorCoordinator(eventId: string) {
  try {
    const email = useSupabaseUser().value?.email
    if (!email || !orgId.value) return
    const person = await usePeopleApi().findByEmail(orgId.value, email)
    if (!person?.id) return
    const existing = await eventsApi.eventCoordinators(eventId)
    if (Array.isArray(existing) && existing.some((c: any) => c.personId === person.id)) return
    // NO NOTIFICATIONS. Being the person who made the event is not a request to be
    // emailed about it — someone running a term of weekly sessions would be subscribing
    // themselves to every registration, payment and cancellation on all of them without
    // ever asking. They're on the event as its coordinator, and can turn any of the four
    // on from the event page if they want them.
    await eventsApi.addEventCoordinator(eventId, person.id, [])
  } catch { /* a missing coordinator must never fail the create */ }
}

async function openQuick() {
  if (creatingQuick.value) return
  quickForm.name = newEventName.value.trim()
  quickForm.start_date = clickedDate.value ? new Date(clickedDate.value) : null
  quickForm.start_time = null
  quickForm.end_date = clickedEndDate.value ? new Date(clickedEndDate.value) : quickForm.start_date
  quickForm.end_time = null
  quickForm.is_all_day = false
  quickForm.repeat = ''
  quickForm.exdates = []
  quickForm.locations = [{ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] }]
  quickCreated.value = false
  quickStep.value = 1
  quickSendInvite.value = true    // each new event starts from "tell the people I invite"
  quickShowLocation.value = false
  quickForm.category_id = activeCalendarStampCategory.value || null
  quickForm.category_ids = activeCalendarStampCategory.value ? [activeCalendarStampCategory.value] : []
  try {
    const payload: any = {
      orgId: orgId.value,
      title: quickForm.name || 'Untitled event',
      status: 'DRAFT',
      style: 'BASIC',
      createdVia: 'quick',
      isProgramme: isProgramme.value,
    }
    if (activeCalendarStampCategory.value) payload.categoryId = activeCalendarStampCategory.value
    const created = await eventsApi.create(payload)
    quickDraftId.value = created.id
    showEventNameModal.value = false
    quickOpen.value = true
    // The cursor is placed by the dialog's own @show (focusQuickName) — doing it
    // here instead loses the race against the closing New-event dialog handing
    // focus back to its trigger.
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Could not start the event', detail: error?.message, life: 4000 })
  }
}

async function createQuickEvent() {
  if (!quickForm.name.trim() || !quickForm.start_date || !quickDraftId.value || creatingQuick.value) return
  creatingQuick.value = true
  try {
    const loc: any = quickForm.locations[0] || {}
    const patch: any = {
      title: quickForm.name.trim(),
      status: 'PUBLISHED',
      isAllDay: quickForm.is_all_day,
      startAt: quickBuildDateTime(quickForm.start_date, quickForm.start_time, quickForm.is_all_day),
      endAt: quickBuildDateTime(quickForm.end_date || quickForm.start_date, quickForm.end_time, quickForm.is_all_day),
      recurrenceRule: quickForm.repeat || null,
      exdates: quickForm.exdates ?? [],
      categoryId: quickForm.category_ids[0] || quickForm.category_id || null,
      categoryIds: quickForm.category_ids.length ? quickForm.category_ids : null,
      visibility: quickForm.visibility || 'internal',
      visibilityTypeKeys: quickForm.visibility === 'custom' && quickForm.visibility_type_keys.length ? quickForm.visibility_type_keys : null,
      visibilityPersonIds: quickForm.visibility === 'custom' && quickForm.visibility_person_ids.length ? quickForm.visibility_person_ids : null,
      visibilityGroupIds: quickForm.visibility === 'custom' && quickForm.visibility_group_ids.length ? quickForm.visibility_group_ids : null,
      locations: quickForm.locations,
      locationType: loc.type ?? 'ADDRESS',
      // The flat column feeds the calendar/list views, which never see the locations
      // array — so it carries the venue name too (same join the sessions repo uses).
      address: loc.type === 'ADDRESS' ? ([loc.venue_name, loc.address].filter(Boolean).join(', ') || null) : null,
      meetingLink: loc.type === 'ONLINE' ? (loc.meeting_link || null) : null,
    }
    await eventsApi.update(quickDraftId.value, patch)
    // The person creating it coordinates it — added to the MASTER before the series is
    // generated, so generateSeries carries them onto every occurrence. (The event page
    // seeds lazily on first open; that's too late for children created here.)
    await ensureCreatorCoordinator(quickDraftId.value)
    // Recurring? Materialise the occurrence series (master + child rows) — a repeat
    // rule alone created NOTHING before, so a no-end-date recurring event vanished.
    // Mirrors the event page's Generate Series; bounded to +1yr when the rule has no
    // UNTIL/COUNT (never infinite). generateSeries delete-then-inserts → re-run safe.
    if (quickForm.repeat && patch.startAt) {
      try {
        const { expandRrule, dateKey } = await import('~/composables/useRecurrence')
        const startDt = new Date(patch.startAt)
        const duration = patch.endAt ? (new Date(patch.endAt).getTime() - startDt.getTime()) : 0
        const { seriesWindowEnd } = await import('~/composables/useRecurrence')
        const windowEnd = seriesWindowEnd(quickForm.repeat, startDt)
        const exdateSet = new Set(quickForm.exdates ?? [])
        const masterKey = dateKey(startDt)
        const occ = expandRrule(quickForm.repeat, startDt, windowEnd, 200)
          .filter((d) => { const k = dateKey(d); return k !== masterKey && !exdateSet.has(k) })
          .map((d) => {
            const cs = new Date(d); cs.setHours(startDt.getHours(), startDt.getMinutes(), 0, 0)
            return { startAt: cs.toISOString(), endAt: patch.endAt ? new Date(cs.getTime() + duration).toISOString() : null }
          })
        if (occ.length) await eventsApi.generateSeries(quickDraftId.value, occ)
      } catch { /* best-effort — the master event is already created */ }
    }
    quickCreated.value = true
    const id = quickDraftId.value
    // "Send invite" ticked → mail the people just invited. Best-effort by design: the
    // event exists either way, so a mail failure toasts rather than losing the create.
    // Only the MASTER is mailed — one invitation for the run, not one per occurrence.
    if (quickSendInvite.value) await sendQuickInvites(id)
    quickOpen.value = false
    navigateTo(`/events/view/${id}`)
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Could not create the event', detail: error?.message, life: 4000 })
  } finally {
    creatingQuick.value = false
  }
}

// Mail the invitation to everyone just invited (the footer's "Send invite"). Uses the
// same endpoint + wording resolution as <EventInvitationDialog> — the event's override,
// else the club's default template, else the built-in copy — so a quick send and a
// composed send say the same thing. Nobody invited (or all already told) = a quiet note,
// not an error: the event is created either way.
async function sendQuickInvites(eventId: string) {
  try {
    const res: any = await $fetch('/api/send-event-invitations', { method: 'POST', body: { eventId } })
    if (res?.sent) {
      toast.add({
        severity: 'success',
        summary: `Invitation sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}`,
        detail: res.failed ? `${res.failed} failed to send.` : undefined,
        life: 4000,
      })
    } else if (res?.failed) {
      toast.add({ severity: 'warn', summary: 'Invitations could not be sent', detail: res.errors?.[0] ?? 'Every send failed.', life: 5000 })
    } else {
      toast.add({ severity: 'info', summary: 'No invitations to send', detail: 'Nobody invited has an email address we can reach.', life: 4000 })
    }
  } catch (e: any) {
    toast.add({
      severity: 'warn',
      summary: `${t('event', false)} created, but the invitation didn't send`,
      detail: e?.data?.message ?? e?.statusMessage ?? 'You can send it from the event page.',
      life: 5000,
    })
  }
}

// Recurring chip → the occurrences this quick event will create (the "series").
// Reuses the same expandRrule the create path uses, so the preview matches exactly.
const quickRepeatSummary = computed(() => (quickForm.repeat ? rruleToSummary(quickForm.repeat) : ''))
const seriesPreviewOpen = ref(false)
const seriesPreviewRows = ref<Date[]>([])
async function openSeriesPreview() {
  if (!quickForm.repeat) return
  const startIso = quickBuildDateTime(quickForm.start_date, quickForm.start_time, quickForm.is_all_day)
  if (!startIso) return
  const { expandRrule, dateKey, seriesWindowEnd } = await import('~/composables/useRecurrence')
  const startDt = new Date(startIso)
  const windowEnd = seriesWindowEnd(quickForm.repeat, startDt)
  const exdateSet = new Set(quickForm.exdates ?? [])
  seriesPreviewRows.value = expandRrule(quickForm.repeat, startDt, windowEnd, 200).filter((d) => !exdateSet.has(dateKey(d)))
  seriesPreviewOpen.value = true
}

// Cancelling (or dismissing) an uncreated quick draft removes it — no orphans.
async function onQuickClose() {
  const id = quickDraftId.value
  quickDraftId.value = null
  if (!quickCreated.value && id) {
    try { await eventsApi.remove(id) } catch { /* best-effort cleanup */ }
  }
}

function backToNewEvent() {
  showSessionCountModal.value = false
  showEventNameModal.value = true
}
async function chooseSingleSession() {
  showSessionCountModal.value = false
  if (creationMode.value === 'wizard') {
    useWizard.value = true
    createBasicEvent()
  } else {
    await createCustomEvent()
  }
}

// "Custom" = the full event editor, not a wizard. The editor is keyed to an
// event id, so create the row first and land the user on it — the /events/:id
// edit view, just with a brand-new event in it.
const creatingCustom = ref(false)
async function createCustomEvent() {
  if (creatingCustom.value) return
  creatingCustom.value = true
  try {
    const payload: any = {
      orgId: orgId.value,
      title: newEventName.value.trim() || '(draft)',
      status: 'DRAFT',
      style: 'BASIC',
      createdVia: 'custom',    // opens in the full event page, not the wizard
      isProgramme: isProgramme.value,
    }
    if (activeCalendarStampCategory.value) payload.categoryId = activeCalendarStampCategory.value
    if (clickedDate.value) payload.startAt = clickedDate.value
    if (clickedEndDate.value) payload.endAt = clickedEndDate.value
    const created = await eventsApi.create(payload)
    // Custom = the same form as the wizard, but every section on one page.
    navigateTo(`/events/new-basic?draft=${created.id}&mode=full`)
  } catch (error: any) {
    toast.add({ severity: 'error', summary: 'Could not create the event', detail: error?.message, life: 4000 })
  } finally {
    creatingCustom.value = false
  }
}
function chooseMultiSession() {
  showSessionCountModal.value = false
  // Split into sessions:
  //   wizard → the guided multi-session wizard
  //   custom → the advanced event builder
  if (creationMode.value === 'custom') {
    createAdvancedEvent()
  } else {
    createMultiSessionEvent()
  }
}

function createBasicEvent() {
  showEventTypeModal.value = false
  const params = new URLSearchParams()
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  if (newEventName.value.trim()) params.set('name', newEventName.value.trim())
  if (useWizard.value) params.set('wizard', '1')
  if (isProgramme.value) params.set('programme', '1')
  if (activeCalendarStampCategory.value) params.set('category', activeCalendarStampCategory.value)
  const q = params.size ? `?${params}` : ''
  navigateTo(`/events/new-basic${q}`)
}

function createMultiSessionEvent() {
  showEventTypeModal.value = false
  const params = new URLSearchParams()
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  if (newEventName.value.trim()) params.set('name', newEventName.value.trim())
  if (isProgramme.value) params.set('programme', '1')
  if (activeCalendarStampCategory.value) params.set('category', activeCalendarStampCategory.value)
  const q = params.size ? `?${params}` : ''
  navigateTo(`/events/new-multi${q}`)
}

function createAdvancedEvent() {
  showEventTypeModal.value = false
  const params = new URLSearchParams()
  if (clickedDate.value) params.set('date', clickedDate.value)
  if (clickedEndDate.value) params.set('endDate', clickedEndDate.value)
  if (newEventName.value.trim()) params.set('name', newEventName.value.trim())
  if (isProgramme.value) params.set('programme', '1')
  if (activeCalendarStampCategory.value) params.set('category', activeCalendarStampCategory.value)
  const q = params.size ? `?${params}` : ''
  navigateTo(useWizard.value ? `/events/new-advanced${q}` : `/events/new${q}`)
}

// Calendar settings
// `filters` is a BUILT list — the user picks a filter, presses Add, and gets a row
// to fill in. No row for a dimension = no constraint on it, which is why an empty
// list shows everything.
type CalFilter = { id: string; key: string; value: any }

const calSettings = reactive({
  colorBy: 'category',
  defaultView: 'dayGridMonth',
  weekStart: 1,
  showWeekends: true,
  filters: [] as CalFilter[],
  newButtonLabel: '',   // overrides the "New event" button text (e.g. "New Holiday programme")
})

// The "New …" button text: the club's custom label, else the default.
const newButtonText = computed(() => calSettings.newButtonLabel?.trim() || `New ${t('event', false)}`)

// Share tab only for a governing/parent org that actually has clubs beneath it.
const CAL_TABS = computed(() => [
  { key: 'display', label: 'Display', icon: 'pi-sliders-h' },
  { key: 'filter', label: 'Filter', icon: 'pi-filter' },
  { key: 'export', label: 'Export', icon: 'pi-download' },
  ...(canShareCalendars.value ? [{ key: 'share', label: 'Share', icon: 'pi-share-alt' }] : []),
])
const calTab = ref('display')

const FILTER_DEFS = [
  { key: 'venue', label: 'Venue', icon: 'pi-map-marker', empty: () => [] as string[] },
  { key: 'category', label: 'Category', icon: 'pi-tag', empty: () => [] as string[] },
  { key: 'status', label: 'Status', icon: 'pi-flag', empty: () => [] as string[] },
  { key: 'type', label: 'Event type', icon: 'pi-sitemap', empty: () => [] as string[] },
  { key: 'dates', label: 'Date range', icon: 'pi-calendar', empty: () => null as any },
]
const STATUS_OPTIONS = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Completed', value: 'COMPLETED' },
]
const STYLE_OPTIONS = [
  { label: 'Basic', value: 'BASIC' },
  { label: 'Advanced', value: 'ADVANCED' },
  { label: 'Multi-session', value: 'MULTI_SESSION' },
  { label: 'Competition', value: 'SPORTS_COMPETITION' },
  { label: 'Holiday programme', value: 'HOLIDAY_PROGRAM' },
  { label: 'Attendance', value: 'ATTENDANCE' },
]

const pendingFilterKey = ref<string | null>(null)
const filterDef = (key: string) => FILTER_DEFS.find(d => d.key === key)
// One row per dimension — a second "Venue" filter would just be an AND against
// itself, so already-used dimensions drop out of the picker.
const addableFilters = computed(() =>
  FILTER_DEFS.filter(d => !calSettings.filters.some(f => f.key === d.key)),
)
function addFilter(key?: string) {
  const k = key ?? pendingFilterKey.value
  if (!k || calSettings.filters.some(f => f.key === k)) return
  calSettings.filters.push({ id: `${k}-${calSettings.filters.length}-${Math.random().toString(36).slice(2, 7)}`, key: k, value: filterDef(k)!.empty() })
  pendingFilterKey.value = null
}
function removeFilter(id: string) {
  calSettings.filters = calSettings.filters.filter(f => f.id !== id)
  saveCalPrefs()
}
function filterValue(key: string) {
  return calSettings.filters.find(f => f.key === key)?.value
}

// ── Export ────────────────────────────────────────────────────────────────
// What you see is what you get: the export walks the SAME list the calendar is
// rendering, so filters and the search box carry through with no extra plumbing.
const EXPORT_FORMATS = [
  { label: 'Website embed', value: 'embed', icon: 'pi-code', hint: 'A live calendar for your own website — it keeps updating as you add events.' },
  { label: 'Spreadsheet (CSV)', value: 'csv', icon: 'pi-file-excel', hint: 'A spreadsheet — one row per event, with dates, venue, status and category.' },
  { label: 'Calendar (iCal)', value: 'ics', icon: 'pi-calendar', hint: 'A calendar file you can import into Google Calendar, Outlook or Apple Calendar.' },
]
// '' = every panel collapsed. The accordion opens one at a time.
const exportFormat = ref<'csv' | 'ics' | 'embed' | ''>('embed')
const selectAll = (e: any) => e.target?.select?.()

// ── Website embed ─────────────────────────────────────────────────────────
// The snippet points at the PUBLIC /embed/calendar page and carries the filters
// the user built, so what they've narrowed to here is what their website shows.
// Status is deliberately NOT passed: the embed publishes published events only.
const EMBED_VIEWS = [
  { label: 'Month', value: 'month' },
  { label: 'Week', value: 'week' },
  { label: 'List', value: 'list' },
]
const embedView = ref('month')
const embedCopied = ref(false)

const embedUrl = computed(() => {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const params = new URLSearchParams({ org: orgId.value ?? '', view: embedView.value })
  const venues = filterValue('venue')
  const calendars = filterValue('category')
  const types = filterValue('type')
  if (venues?.length) params.set('venues', venues.join(','))
  if (calendars?.length) params.set('calendars', calendars.join(','))
  if (types?.length) params.set('types', types.join(','))
  return `${origin}/embed/calendar?${params.toString()}`
})

const embedSnippet = computed(() =>
  `<iframe src="${embedUrl.value}"\n  title="Events calendar"\n  width="100%" height="700"\n  style="border:0"\n  loading="lazy"></iframe>`,
)

async function copyEmbed() {
  await copyText(embedSnippet.value)
  embedCopied.value = true
  setTimeout(() => { embedCopied.value = false }, 2000)
}

const exportRows = computed(() =>
  (calendarEvents.value as any[])
    .filter(i => !i.extendedProps?._isSession)
    .map(i => i.extendedProps)
    .sort((a, b) => new Date(a.start_at ?? 0).getTime() - new Date(b.start_at ?? 0).getTime()),
)

function venueNamesFor(e: any) {
  const ids: string[] = []
  if (e.bookable_id) ids.push(e.bookable_id)
  for (const loc of e.locations ?? []) if (loc?.bookable_ids?.length) ids.push(...loc.bookable_ids)
  return [...new Set(ids)]
    .map(id => allBookables.value.find((b: any) => b.id === id)?.name)
    .filter(Boolean)
    .join(', ')
}

function download(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function runExport() {
  const rows = exportRows.value
  if (!rows.length) return
  const stamp = new Date().toISOString().slice(0, 10)

  if (exportFormat.value === 'csv') {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      ['Title', 'Starts', 'Ends', 'All day', 'Status', 'Type', 'Calendar', 'Venue'].join(','),
      ...rows.map(e => [
        e.title, e.start_at ?? '', e.end_at ?? '', e.is_all_day ? 'Yes' : 'No',
        e.status ?? '', e.style ?? 'BASIC',
        categoriesById.value[e.category_id]?.name ?? '', venueNamesFor(e),
      ].map(esc).join(',')),
    ]
    download(`events-${stamp}.csv`, 'text/csv;charset=utf-8', lines.join('\n'))
    toast.add({ severity: 'success', summary: `${rows.length} exported`, life: 2500 })
    return
  }

  // iCal — UTC basic-format timestamps, CRLF line endings (RFC 5545).
  const ical = (d: any) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const clean = (s: any) => String(s ?? '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FriendlyManager//Events//EN',
    ...rows.flatMap(e => [
      'BEGIN:VEVENT',
      `UID:${e.id}@friendlymanager`,
      `DTSTAMP:${ical(new Date())}`,
      `DTSTART:${ical(e.start_at ?? new Date())}`,
      `DTEND:${ical(e.end_at ?? e.start_at ?? new Date())}`,
      `SUMMARY:${clean(e.title)}`,
      venueNamesFor(e) ? `LOCATION:${clean(venueNamesFor(e))}` : null,
      'END:VEVENT',
    ].filter(Boolean) as string[]),
    'END:VCALENDAR',
  ].join('\r\n')
  download(`events-${stamp}.ics`, 'text/calendar;charset=utf-8', body)
  toast.add({ severity: 'success', summary: `${rows.length} exported`, life: 2500 })
}

const colorByOptions = [
  // "Category", not "Calendar" — the value is `category` and the colour comes
  // from the event's category (see the colour resolver below). The old label
  // named the wrong thing entirely.
  { label: 'Category', value: 'category' },
  { label: 'Status', value: 'status' },
  { label: 'Style', value: 'style' },
]

const namedCalendars = ref<any[]>([])
const allCategories = ref<any[]>([])
const allBookables = ref<any[]>([])

// Venues are a hierarchy (Main Hall › Room 1, Room 2), so the filter shows them
// as one — a flat alphabetical list hid which room belonged to which venue.
const bookableTree = computed(() => {
  const ids = new Set(allBookables.value.map((b: any) => b.id))
  const byParent: Record<string, any[]> = {}
  for (const b of allBookables.value) {
    // A venue whose parent isn't in the list (archived/deleted parent) would be
    // dropped by the walk below — treat it as a root so nothing vanishes.
    const parent = b.parent_id && ids.has(b.parent_id) ? b.parent_id : '__root'
    ;(byParent[parent] ??= []).push(b)
  }
  const out: any[] = []
  const walk = (parent: string, depth: number) => {
    for (const b of (byParent[parent] ?? []).sort((a, c) => a.name.localeCompare(c.name))) {
      out.push({ ...b, _depth: depth, _hasChildren: !!byParent[b.id]?.length })
      walk(b.id, depth + 1)
    }
  }
  walk('__root', 0)
  return out
})
const categoriesById = computed(() => Object.fromEntries(allCategories.value.map((c: any) => [c.id, c])))
// The ONE category-colour lookup for this board's pickers — a category with no colour
// (or one deleted since a filter saved its id) falls back to neutral grey rather than
// rendering a black dot. `||` not `??`: an empty-string colour is "unset", not a colour.
const categoryColor = (id: string) => (categoriesById.value[id]?.color as string | undefined) || '#94a3b8'

const activeCalendar = computed(() => {
  const calId = route.query.calendar as string | undefined
  if (!calId) return null
  return namedCalendars.value.find(c => c.id === calId) ?? null
})

// Embedded in the old platform, our left rail is hidden (that shell supplies the
// navigation) — so anything the rail was the ONLY way to reach needs a home here.
// Switching calendars and creating one were both rail-only.
const railHidden = useState<boolean>('fmEmbedSession', () => false)

// ── One person's events (?person=…) ────────────────────────────────────────
// The old platform's member profile has an Events tab, and it mounts this module
// with the member's id. `null` means "not loaded yet" — distinct from an empty set,
// which means "they're on nothing" — because the two must not look the same: one
// waits, the other says so.
const personScope = computed(() => String(route.query.person || ''))
const personEventIds = ref<Set<string> | null>(null)
watch(personScope, async (pid) => {
  if (!pid) { personEventIds.value = null; return }
  try {
    const ids = await $fetch<string[]>('/api/v1/events/for-person', { query: { personId: pid } })
    personEventIds.value = new Set(ids)
  } catch { personEventIds.value = new Set() }
}, { immediate: true })
const NEW_CALENDAR = '__new__'
// "All events" carries a real value, not ''. PrimeVue's Select reads an empty
// string as NOTHING SELECTED, so the control rendered blank on the default view —
// the one state it is in most of the time — instead of naming it.
const ALL_EVENTS = '__all__'
const calendarPickerOptions = computed(() => [
  { label: 'All events', value: ALL_EVENTS },
  ...namedCalendars.value.map((c: any) => ({ label: c.name, value: c.id })),
  // Creating sits at the bottom of the list of things you can pick, which is
  // where you look when the one you wanted isn't there.
  { label: '＋ New calendar', value: NEW_CALENDAR },
])
const activeCalendarValue = computed(() => (route.query.calendar as string) || ALL_EVENTS)
function onCalendarPick(id: string) {
  if (id === NEW_CALENDAR) {
    showCalSettings.value = true
    calTab.value = 'display'
    startNewCalendar()
    return
  }
  switchCalendar(id === ALL_EVENTS ? '' : id)
}
function switchCalendar(id: string) {
  navigateTo(id ? `/events?calendar=${encodeURIComponent(id)}` : '/events')
}

// ── Share this calendar with clubs (governing/parent orgs) ──────────────────
// A governing org shares the OPEN calendar with the clubs beneath it; each club
// accepts from its dashboard and the calendar's events surface on its own calendar.
const { descendants } = useOrgHierarchy()
// Advanced event creation is limited to governing bodies (non-CLUB) for now.
const orgsApi = useOrganisationsApi()
const isGoverningOrg = ref(false)
async function loadOrgLevel() {
  if (!orgId.value) { isGoverningOrg.value = false; return }
  const o = await orgsApi.get(orgId.value).catch(() => null)
  isGoverningOrg.value = !!o?.orgLevel && o.orgLevel !== 'CLUB'
}
// Per-event attendee (invitee) totals for the calendar hover tooltip.
const inviteeCountsMap = ref<Record<string, number>>({})
function attendeeCount(id?: string | null) { return id ? (inviteeCountsMap.value[id] ?? 0) : 0 }
async function loadInviteeCounts() {
  if (!orgId.value) return
  const rows = await eventsApi.inviteeCountsByOrg(orgId.value).catch(() => [] as any[])
  const m: Record<string, number> = {}
  for (const r of rows) m[r.eventId] = r.total
  inviteeCountsMap.value = m
}
const shareClubs = ref<any[]>([])                  // descendant orgs we can share with
const canShareCalendars = computed(() => shareClubs.value.length > 0)
const shareRows = ref<any[]>([])                   // calendar_org_invitees for the open calendar
const shareBusy = ref<string | null>(null)
const shareStatusFor = (clubId: string) => shareRows.value.find(r => r.orgId === clubId)
async function loadShareClubs() {
  if (!orgId.value) { shareClubs.value = []; return }
  shareClubs.value = await descendants(orgId.value).catch(() => [])
}
async function loadCalendarShares() {
  const calId = activeCalendar.value?.id
  if (!calId) { shareRows.value = []; return }
  shareRows.value = await eventsApi.calendarInvitees(calId).catch(() => [])
}
async function toggleCalendarShare(club: any) {
  const calId = activeCalendar.value?.id
  if (!calId) return
  const existing = shareStatusFor(club.id)
  shareBusy.value = club.id
  try {
    if (existing) await eventsApi.removeCalendarInvitee(existing.id)
    else await eventsApi.addCalendarInvitee({ calendarId: calId, orgId: club.id, invitedByOrgId: orgId.value })
    await loadCalendarShares()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Failed to update sharing', detail: e?.message, life: 4000 })
  } finally { shareBusy.value = null }
}
// Load the invitee list when the Share tab is opened for a calendar.
watch(calTab, (tab) => { if (tab === 'share') loadCalendarShares() })
watch(() => activeCalendar.value?.id, () => { if (calTab.value === 'share') loadCalendarShares() })

async function loadCalendars() {
  // The `calendars` + `calendar_categories` read/writes go through the waitlists-domain
  // seam (calendar-writes seam); `bookables` (the VENUE list) comes through bookings.
  const [cals, cats, books] = await Promise.all([
    calendarApi.calendars(orgId.value),
    eventsApi.categories(orgId.value),
    bookingsApi.bookables(orgId.value),
  ])
  allCategories.value = cats ?? []
  // Active venues only (drop archived/deleted), mapped to the {id,name,type,parent_id}
  // shape the venue picker reads; parent_id nests sub-venues under their venue.
  allBookables.value = (books as any[])
    .filter(b => b.type === 'VENUE' && b.status !== 'ARCHIVED' && b.status !== 'DELETED')
    .map(b => ({ id: b.id, name: b.name, type: b.type, parent_id: b.parentId }))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  // Seam returns camelCase (pinToNav, categoryIds already hydrated) — map pin_to_nav
  // back for the template. The seam list is already ordered by sort_order.
  namedCalendars.value = (cals ?? []).map((c: any) => ({
    id: c.id, name: c.name, color: c.color, icon: c.icon,
    pin_to_nav: c.pinToNav, settings: c.settings,
    categoryIds: c.categoryIds ?? [],
  }))
  // Apply the active calendar's categories (or all categories if none selected)
  applyActiveCalendarFilter()
}

const CAL_PREFS_KEY = 'fm_cal_prefs_v1'
// /programme gets its OWN prefs bucket so its view/filters/button-label don't
// bleed into /events (both would otherwise be the 'all' calendar).
function currentCalId() {
  return isProgramme.value ? 'programme' : ((route.query.calendar as string) ?? 'all')
}

function calSettingsSnapshot() {
  return {
    colorBy: calSettings.colorBy,
    defaultView: calSettings.defaultView,
    weekStart: calSettings.weekStart,
    showWeekends: calSettings.showWeekends,
    newButtonLabel: calSettings.newButtonLabel,
    // Dates round-trip through JSON as ISO strings; restore revives them.
    filters: calSettings.filters.map(f => ({ ...f, value: f.value })),
  }
}

function saveCalPrefs() {
  const calId = currentCalId()
  const snap = calSettingsSnapshot()
  const all = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) ?? '{}')
  all[calId] = snap
  localStorage.setItem(CAL_PREFS_KEY, JSON.stringify(all))
  // A NAMED (real) calendar persists its settings to the row so every user + device
  // sees the same setup — the localStorage write above is just a fast local cache.
  const real = namedCalendars.value.find(c => c.id === calId)
  if (real) {
    // A named calendar persists its per-calendar settings to the row via the seam.
    calendarApi.updateCalendar(calId, { settings: snap }).then(() => { real.settings = snap }).catch(() => {})
  }
}

// Apply a saved settings object (from the DB row or localStorage) to calSettings.
function applyCalSettingsObject(saved: any) {
  calSettings.colorBy = saved.colorBy ?? 'category'
  calSettings.defaultView = saved.defaultView ?? 'dayGridMonth'
  calSettings.weekStart = saved.weekStart ?? 1
  calSettings.showWeekends = saved.showWeekends ?? true
  calSettings.newButtonLabel = saved.newButtonLabel ?? ''
  // Drop stale IDs (a venue/category deleted since) and revive the date range,
  // which JSON flattened to ISO strings.
  calSettings.filters = (saved.filters ?? [])
    .filter((f: CalFilter) => filterDef(f.key))
    .map((f: CalFilter) => {
      if (f.key === 'venue') return { ...f, value: (f.value ?? []).filter((id: string) => allBookables.value.some((b: any) => b.id === id)) }
      if (f.key === 'category') return { ...f, value: (f.value ?? []).filter((id: string) => allCategories.value.some((c: any) => c.id === id)) }
      if (f.key === 'dates') return { ...f, value: Array.isArray(f.value) ? f.value.map((d: any) => (d ? new Date(d) : null)) : null }
      return f
    })
}

function restoreCalPrefs(calId: string | undefined) {
  const key = calId ?? 'all'
  const all = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) ?? '{}')
  const saved = all[key]
  if (!saved) return false
  applyCalSettingsObject(saved)
  return true
}

function applyActiveCalendarFilter() {
  const calId = isProgramme.value ? 'programme' : (route.query.calendar as string | undefined)
  const real = calId ? namedCalendars.value.find(c => c.id === calId) : null
  // 1. A named calendar's own saved settings win (shared across users/devices).
  if (real?.settings) { applyCalSettingsObject(real.settings); return }
  // 2. Otherwise fall back to this browser's localStorage prefs.
  if (restoreCalPrefs(calId)) return
  // 3. First visit to a NAMED calendar — start filtered to the categories it covers.
  calSettings.filters = []
  if (real?.categoryIds?.length) {
    calSettings.filters = [{ id: 'category-seed', key: 'category', value: [...real.categoryIds] }]
  }
}

// Re-apply when user clicks a different calendar in the sidebar
watch(() => route.query.calendar, applyActiveCalendarFilter)

function resetCalSettings() {
  calSettings.colorBy = 'category'
  calSettings.defaultView = 'dayGridMonth'
  calSettings.weekStart = 1
  calSettings.showWeekends = true
  calSettings.filters = []
  calSettings.newButtonLabel = ''
  // Clear saved prefs for this calendar so defaults are used next time
  const calId = currentCalId()
  const all = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) ?? '{}')
  delete all[calId]
  localStorage.setItem(CAL_PREFS_KEY, JSON.stringify(all))
}

async function applyCalSettings() {
  if (newCalendarName.value.trim()) {
    await createNewCalendar()
  }
  saveCalPrefs()
  showCalSettings.value = false
  // The view, weekStart, showWeekends are reactive props on BookingsCalendar,
  // so calSettings updates flow through automatically.
}

// New calendar creation / editing (inside cal settings dialog)
const newCalendarName = ref('')
const newCalendarCategoryIds = ref<string[]>([])
const newCalendarPin = ref(false)
const newCalendarIcon = ref('')
const newCalendarColor = ref('')
const creatingCalendar = ref(false)
const editingCalendarId = ref<string | null>(null)
// Are we CREATING a new calendar? Opening settings normally shows the current view's
// display/filter/export settings — the "New calendar" pane appears ONLY when the user
// explicitly starts creating one (startNewCalendar), so settings ≠ create.
const creatingNewCal = ref(false)
// New-calendar flow: show ONLY the name first; the tabs + all other config reveal after
// "Next". Editing an existing calendar reveals everything immediately.
const calDetailsRevealed = ref(false)

// The left-menu "New calendar" item sets this; drop into the create flow + open the drawer.
const navNewCalendar = useState('nav-new-calendar', () => false)
function handleNavNewCalendar() {
  if (!navNewCalendar.value) return
  navNewCalendar.value = false
  showDemoPrompt.value = false
  startNewCalendar()
  showCalSettings.value = true
}
watch(navNewCalendar, handleNavNewCalendar)

function startNewCalendar() {
  editingCalendarId.value = null
  newCalendarName.value = ''
  newCalendarCategoryIds.value = []
  newCalendarPin.value = false
  newCalendarIcon.value = ''
  newCalendarColor.value = ''
  creatingNewCal.value = true
  calDetailsRevealed.value = false   // name first, then Next
  calTab.value = 'display'
}

// Bumped after any calendar is created/edited/deleted so the left-nav (which
// loads its own pinned calendars in the layout) reloads them live.
const navCalVersion = useState('nav-cal-version', () => 0)

function openCalSettings() {
  const calId = route.query.calendar as string | undefined
  if (calId) {
    const cal = namedCalendars.value.find(c => c.id === calId)
    if (cal) {
      newCalendarName.value = cal.name
      newCalendarCategoryIds.value = [...(cal.categoryIds ?? [])]
      newCalendarPin.value = !!cal.pin_to_nav
      newCalendarIcon.value = cal.icon ?? ''
      newCalendarColor.value = cal.color ?? ''
      editingCalendarId.value = cal.id
    }
  } else {
    newCalendarName.value = ''
    newCalendarCategoryIds.value = []
    newCalendarPin.value = false
    newCalendarIcon.value = ''
    newCalendarColor.value = ''
    editingCalendarId.value = null
  }
  calTab.value = 'display'
  creatingNewCal.value = false   // opening settings is NOT creating — show the current view's settings
  calDetailsRevealed.value = !!editingCalendarId.value   // editing → everything shown
  showCalSettings.value = true
}

function selectCalendarForEdit(cal: any) {
  calDetailsRevealed.value = true
  newCalendarName.value = cal.name
  newCalendarCategoryIds.value = [...(cal.categoryIds ?? [])]
  newCalendarPin.value = !!cal.pin_to_nav
  newCalendarIcon.value = cal.icon ?? ''
  newCalendarColor.value = cal.color ?? ''
  editingCalendarId.value = cal.id
}

async function createNewCalendar() {
  if (!newCalendarName.value.trim()) return
  creatingCalendar.value = true
  const name = newCalendarName.value.trim()

  // Seam (waitlists domain) owns calendar + calendar_categories writes.
  const navCols = {
    pinToNav: newCalendarPin.value,
    icon: newCalendarIcon.value.trim() || null,
    color: newCalendarColor.value.trim() || null,
  }
  try {
    if (editingCalendarId.value) {
      await calendarApi.updateCalendar(editingCalendarId.value, { name, ...navCols })
      await calendarApi.setCalendarCategories(orgId.value, editingCalendarId.value, newCalendarCategoryIds.value)
      toast.add({ severity: 'success', summary: 'Calendar updated', life: 2000 })
    } else {
      await calendarApi.createCalendar({
        orgId: orgId.value,
        name,
        ...navCols,
        categoryIds: newCalendarCategoryIds.value,
      })
      toast.add({ severity: 'success', summary: `Calendar "${name}" created`, life: 2000 })
    }
  } catch (e: any) {
    creatingCalendar.value = false
    toast.add({ severity: 'error', summary: `Failed to ${editingCalendarId.value ? 'update' : 'create'} calendar`, detail: e?.message, life: 3000 })
    return
  }

  creatingCalendar.value = false
  newCalendarName.value = ''
  newCalendarCategoryIds.value = []
  newCalendarPin.value = false
  newCalendarIcon.value = ''
  newCalendarColor.value = ''
  editingCalendarId.value = null
  creatingNewCal.value = false
  await loadCalendars()
  navCalVersion.value++
}

function deleteCalendar() {
  if (!editingCalendarId.value) return
  confirm.require({
    message: `Are you sure you want to delete "${newCalendarName.value}"? This cannot be undone.`,
    header: 'Delete Calendar',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await calendarApi.removeCalendar(orgId.value, editingCalendarId.value!)
      } catch (e: any) {
        toast.add({ severity: 'error', summary: 'Failed to delete calendar', detail: e?.message, life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Calendar deleted', life: 2000 })
      showCalSettings.value = false
      newCalendarName.value = ''
      newCalendarCategoryIds.value = []
      newCalendarPin.value = false
      newCalendarIcon.value = ''
      newCalendarColor.value = ''
      editingCalendarId.value = null
      await navigateTo('/events')
      await loadCalendars()
      navCalVersion.value++
    },
  })
}

const rowMenu = ref()
const menuItems = ref<any[]>([])
let menuEvent: any = null

const viewOptions = [
  { label: 'Calendar', value: 'calendar', icon: 'pi-calendar' },
  { label: 'List', value: 'list', icon: 'pi-list' },
]

const STYLE_LABELS: Record<string, string> = {
  BASIC: 'Basic',
  ADVANCED: 'Advanced',
  MULTI_SESSION: 'Multi-Session',
  SPORTS_COMPETITION: 'Competition',
  HOLIDAY_PROGRAM: 'Camp / Program',
  ATTENDANCE: 'Attendance',
  COMPETITION: 'Competition',
}

const styleOptions = Object.entries(STYLE_LABELS).map(([value, label]) => ({ value, label }))

const EVENT_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  PUBLISHED: '#1E2157',
  CANCELLED: '#ef4444',
  ARCHIVED: '#d1d5db',
}

function statusSeverity(s: string) {
  return { DRAFT: 'secondary', PUBLISHED: 'success', CANCELLED: 'danger', ARCHIVED: 'warn' }[s] ?? 'secondary'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const calendarTitle = ref('')

const calViews = [
  { label: 'Day',   value: 'timeGridDay' },
  { label: 'Week',  value: 'timeGridWeek' },
  { label: 'Month', value: 'dayGridMonth' },
  { label: 'List',  value: 'listWeek' },
  { label: 'Table', value: 'table' },
]

// Table view = a spreadsheet-style list of exactly what the calendar is showing.
// /programme is Table-only.
const isTableView = computed(() => isProgramme.value || calSettings.defaultView === 'table')
const tableDate = (e: any) => e.start_at
  ? new Date(e.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  : 'No date'
const tableTime = (e: any) => e.is_all_day ? 'All day'
  : (e.start_at ? new Date(e.start_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '—')
function statusClass(s?: string) {
  if (s === 'PUBLISHED') return 'bg-green-100 text-green-700'
  if (s === 'CANCELLED') return 'bg-red-100 text-red-600'
  if (s === 'ARCHIVED') return 'bg-gray-100 text-gray-400'
  return 'bg-amber-100 text-amber-700'   // DRAFT / default
}

// Map FullCalendar view names → BookingsCalendar's view set
const VIEW_MAP: Record<string, 'day' | 'week' | 'month' | 'list'> = {
  timeGridDay: 'day',
  timeGridWeek: 'week',
  dayGridMonth: 'month',
  listWeek: 'list',
}

const calDate = ref(new Date())
// On a phone the month/week grids are unusable — force the agenda (list) view.
const isNarrow = ref(false)
function updateNarrow() { if (import.meta.client) isNarrow.value = window.innerWidth < 768 }
onMounted(updateNarrow)
if (import.meta.client) {
  window.addEventListener('resize', updateNarrow)
  onBeforeUnmount(() => window.removeEventListener('resize', updateNarrow))
}
const bookingsCalView = computed<'day' | 'week' | 'month' | 'list'>(() =>
  // /programme is List-only, whatever the saved calendar prefs say.
  isProgramme.value ? 'list' : (VIEW_MAP[calSettings.defaultView] ?? 'month'),
)
// Mobile shows a purpose-built upcoming-events list instead of the calendar grid.
const mobileEventsList = computed(() => {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  return (bookingsCalEvents.value as any[])
    .filter(e => e.start_at && new Date(e.start_at) >= start)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
})
function evDow(iso: any) { return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' }) }
function evWhen(iso: any) { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }

// Map our events into the shape BookingsCalendar expects
const bookingsCalEvents = computed(() => {
  // Search actually FILTERS the calendar. It used to only tag non-matches with a
  // `fc-event-dimmed` class — styling for FullCalendar, which this page no longer
  // renders — so typing in the box did nothing at all.
  const q = search.value.trim().toLowerCase()
  return (calendarEvents.value as any[])
    .filter((e: any) => !q || (e.title ?? '').toLowerCase().includes(q))
    .map((e: any) => ({
    id: e.id,
    start_at: e.start,
    end_at: e.end,
    is_all_day: e.allDay ?? false,
    status: 'CONFIRMED',
    notes: e.title,
    color: e.backgroundColor,
    event: { id: e.extendedProps?.id, title: e.title },
    contact_name: null,
    activity_mode: null,
    is_shared: e.extendedProps?.is_shared ?? false,
    shared_from: e.extendedProps?.shared_from ?? null,
    extendedProps: e.extendedProps,
  }))
})

// Reopen an event where it was built. ONLY an unfinished wizard draft goes back
// to the wizard — a live event, or one made in the custom/advanced/multi builders,
// opens on the full event page. (created_via, migration 257: `style` couldn't tell
// a wizard draft from a Custom one — both are BASIC.)
function openEvent(evt: { id: string; status?: string; created_via?: string | null; style?: string; is_programme?: boolean; is_shared?: boolean; shared_from?: string | null; external_url?: string | null }) {
  // Some events open somewhere else entirely. A competition fixture is one line
  // of a draw, not an event page — the old platform's own calendar has always
  // sent a click on a game to its division's draw anchored at the round, so this
  // one does too. `_top` because that page lives in the platform AROUND this
  // iframe; loading it inside would nest the whole app in itself.
  if (evt.external_url) {
    if (import.meta.client) window.open(evt.external_url, '_top')
    return
  }
  // An event that still lives in the OLD platform. It rides in on the shared
  // feed, so it must be caught BEFORE the is_shared branch below — that page
  // loads from this module's own store and would find nothing.
  if (typeof evt.id === 'string' && evt.id.startsWith('legacy-')) {
    // The run-the-event view — the same one a Quick event opens in. A legacy event
    // has no fees breakdown, no form and no settings, but it DOES have people and
    // their attendance, and this is the layout where that is the main event rather
    // than a section that had to be hidden. The seam answers for `legacy-` ids, so
    // the details summary and the roll work unchanged.
    navigateTo(`/events/view/${evt.id}`)
    return
  }
  // A SHARED event belongs to another org (a national/governing body shared it, this
  // club accepted). The club sees the full event (read-only) AND invites its OWN people
  // on the club-scoped shared-event page — never the owner's editor.
  if (evt.is_shared) {
    navigateTo(`/events/shared/${evt.id}`)
    return
  }
  const unfinished = evt.status === 'DRAFT'

  // A quick event opens the simple run-the-event view — details, invitees, attendance.
  if (evt.created_via === 'quick') { navigateTo(`/events/view/${evt.id}`); return }

  // An unfinished wizard draft resumes in the wizard, on the step it was left on.
  if (unfinished && evt.created_via === 'wizard') {
    navigateTo(`/events/new-basic?draft=${evt.id}`)
    return
  }
  // An unfinished CUSTOM draft resumes where it was being built — the one-page form.
  // (A finished basic event does NOT: it opens the full editor below, same as an
  // advanced one. Once an event exists it's a thing you run, not a form you're
  // still filling in, and the tabs are where invitees/attendance/forms live.)
  const singleSession = (evt.style ?? 'BASIC') === 'BASIC'
  if (unfinished && singleSession && evt.created_via !== 'advanced' && evt.created_via !== 'multi') {
    navigateTo(`/events/new-basic?draft=${evt.id}&mode=full`)
    return
  }
  // A programme opens on its per-week availability (Dates) tab, not Overview —
  // matching the /programme board's row-click.
  if (evt.is_programme) { navigateTo(`/events/${evt.id}?tab=dates`); return }
  // Advanced / multi-session keep their own editor.
  navigateTo(`/events/${evt.id}`)
}

function onCalendarEventClick(item: any) {
  const ext = item.extendedProps
  if (ext?._isSession) {
    navigateTo(`/events/${ext._eventId}?tab=sessions`)
  } else if (ext?.id) {
    openEvent(ext)
  }
}

function onCalendarSlotClick(date: Date, endDate?: Date) {
  // Events can only be created from today onward — clicking or drag-selecting a PAST
  // day never opens the New-event modal (today itself is allowed).
  const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
  const clickedMid = new Date(date); clickedMid.setHours(0, 0, 0, 0)
  if (clickedMid.getTime() < todayMid.getTime()) return
  // Format as YYYY-MM-DD using local components (no timezone shift).
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const startStr = fmt(date)
  const endStr = endDate ? fmt(endDate) : undefined
  openEventTypeModal(startStr, endStr && endStr !== startStr ? endStr : undefined)
}

// ── Drag-and-drop event move ───────────────────────────────
const dropDialog = reactive({
  open: false,
  scope: 'this' as 'this' | 'following' | 'all',
  pending: null as null | { eventRow: any; newStart: Date; newEnd: Date; conflicts: string[] },
})

async function detectConflicts(targetEventId: string, parentId: string | null, newStart: Date) {
  if (!parentId) return []
  const dayKey = newStart.toISOString().slice(0, 10)
  const all = await eventsApi.list(orgId.value)
  return all
    .filter((s: any) => (s.id === parentId || s.recurrenceParentId === parentId) && s.id !== targetEventId)
    .filter((s: any) => s.startAt?.slice(0, 10) === dayKey)
    .map((s: any) => s.title || 'Untitled')
}

async function onCalendarEventDrop(item: any, newStart: Date, newEnd: Date) {
  const ext = item.extendedProps
  if (ext?._isSession) {
    toast.add({ severity: 'warn', summary: 'Sessions cannot be moved here', detail: `Open the ${t('event', false, true)} to edit individual sessions.`, life: 4000 })
    return
  }
  const eventId = ext?.id ?? item.id
  if (!eventId) return

  let fetched: any
  try { fetched = await eventsApi.get(eventId) } catch { return }
  if (!fetched) return
  const eventRow = toEventRow(fetched)

  const parentId = eventRow.recurrence_parent_id ?? eventId
  const conflicts = await detectConflicts(eventId, eventRow.recurrence_parent_id ? parentId : null, newStart)

  // Check if this event is part of a series (has parent OR has children)
  const all = await eventsApi.list(orgId.value)
  const childCount = all.filter((e: any) => e.recurrenceParentId === eventId).length
  const inSeries = !!eventRow.recurrence_parent_id || childCount > 0

  if (inSeries) {
    dropDialog.scope = 'this'
    dropDialog.pending = { eventRow, newStart, newEnd, conflicts }
    dropDialog.open = true
  } else {
    if (conflicts.length) {
      toast.add({ severity: 'warn', summary: 'Conflict', detail: `Already an ${t('event', false, true)} on this date: ${conflicts.join(', ')}`, life: 5000 })
    }
    await applyDateMove(eventRow, newStart, newEnd)
  }
}

async function applyDateMove(eventRow: any, newStart: Date, newEnd: Date) {
  await eventsApi.update(eventRow.id, {
    startAt: newStart.toISOString(),
    endAt: newEnd.toISOString(),
  })
  await load()
}

async function performDropMove() {
  if (!dropDialog.pending) return
  const { eventRow, newStart, newEnd, conflicts } = dropDialog.pending
  const oldStart = new Date(eventRow.start_at)
  const oldEnd = new Date(eventRow.end_at ?? eventRow.start_at)
  const dayDelta = Math.round((newStart.getTime() - oldStart.getTime()) / 86_400_000)
  const parentId = eventRow.recurrence_parent_id ?? eventRow.id

  if (dropDialog.scope === 'this') {
    if (conflicts.length) {
      toast.add({ severity: 'warn', summary: 'Conflict', detail: `Already an ${t('event', false, true)} on this date: ${conflicts.join(', ')}`, life: 5000 })
    }
    await applyDateMove(eventRow, newStart, newEnd)
  } else {
    // Get all related events (the parent + every child)
    const all = await eventsApi.list(orgId.value)
    const family = all.filter((e: any) => e.id === parentId || e.recurrenceParentId === parentId)
    const targets = family.filter((e: any) => {
      if (dropDialog.scope === 'all') return true
      // 'following' = events at or after the dragged event's original start
      return e.startAt >= eventRow.start_at
    })
    for (const t of targets) {
      const ts = new Date(t.startAt); ts.setDate(ts.getDate() + dayDelta)
      const te = new Date(t.endAt ?? t.startAt); te.setDate(te.getDate() + dayDelta)
      await eventsApi.update(t.id, {
        startAt: ts.toISOString(),
        endAt: te.toISOString(),
      })
    }
  }

  dropDialog.open = false
  dropDialog.pending = null
  await load()
  toast.add({ severity: 'success', summary: `${t('event', false)} moved`, life: 2500 })
}

function updateCalendarTitle() {
  const v = bookingsCalView.value
  if (v === 'day') {
    calendarTitle.value = calDate.value.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } else if (v === 'week') {
    const monday = new Date(calDate.value); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    calendarTitle.value = `${monday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  } else {
    calendarTitle.value = calDate.value.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  }
}
watch([calDate, bookingsCalView], updateCalendarTitle, { immediate: true })

function setCalView(view: string) {
  calSettings.defaultView = view
  saveCalPrefs()
}

// Hover tooltip
const tooltip = reactive({ visible: false, x: 0, y: 0, event: null as any })
let tooltipTimer: ReturnType<typeof setTimeout> | null = null
// The pill we're hovering, kept so the card can be re-placed once its real size is
// known (and again if the banner image loads and makes it taller).
let tooltipAnchor: DOMRect | null = null
const tooltipEl = ref<HTMLElement | null>(null)

const TOOLTIP_GAP = 10   // breathing room between the pill and the card
const TOOLTIP_EDGE = 8   // never touch the viewport edge

/**
 * Place the hover card so it is ALWAYS fully on screen.
 *
 * This used to be two copies of `if (y + 280 > innerHeight) y = innerHeight - 290`,
 * i.e. a guess that the card is 280px tall. With a banner image it's more like 430,
 * so on a row near the bottom the card ran off the screen and you couldn't read it —
 * and the guess was duplicated, so any fix had to be made twice.
 *
 * Now it measures the rendered card and flips: right of the pill by preference, left
 * if it won't fit; top-aligned by preference, bottom-aligned ("hovering up") if it
 * won't fit below. Clamping is the last resort, so the card can never be cut off.
 */
function placeTooltip() {
  const el = tooltipEl.value
  const r = tooltipAnchor
  if (!el || !r) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Horizontal: right of the pill → flip to its left → clamp inside the viewport.
  let x = r.right + TOOLTIP_GAP
  if (x + w > vw - TOOLTIP_EDGE) x = r.left - TOOLTIP_GAP - w
  if (x < TOOLTIP_EDGE) x = Math.max(TOOLTIP_EDGE, Math.min(vw - w - TOOLTIP_EDGE, r.right + TOOLTIP_GAP))

  // Vertical: aligned with the pill's top → flip to sit ABOVE (bottom edge level with
  // the pill's bottom) → clamp. The flip is what "hover up" means for a low row.
  let y = r.top
  if (y + h > vh - TOOLTIP_EDGE) y = r.bottom - h
  if (y < TOOLTIP_EDGE) y = TOOLTIP_EDGE
  if (y + h > vh - TOOLTIP_EDGE) y = Math.max(TOOLTIP_EDGE, vh - h - TOOLTIP_EDGE)

  tooltip.x = x
  tooltip.y = y
}

function openTooltip(rect: DOMRect, event: any) {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  tooltipAnchor = rect
  tooltip.event = event
  // Provisional spot; placeTooltip corrects it as soon as the card has a real size.
  tooltip.x = rect.right + TOOLTIP_GAP
  tooltip.y = rect.top
  tooltipTimer = setTimeout(() => {
    tooltip.visible = true
    nextTick(placeTooltip)
  }, 200)
}

function showTooltip(info: any) {
  openTooltip(info.el.getBoundingClientRect(), info.event.extendedProps)
}

function hideTooltip() {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  tooltip.visible = false
  tooltipAnchor = null
}

// Hover handler for BookingsCalendar event bars/blocks
function onCalendarEventHover(item: any, ev: MouseEvent) {
  openTooltip((ev.currentTarget as HTMLElement).getBoundingClientRect(), item.extendedProps ?? item)
}

function eventColor(e: any) {
  if (calSettings.colorBy === 'category') {
    return e.category?.color ?? '#1E2157'
  }
  if (calSettings.colorBy === 'style') {
    const styleColors: Record<string, string> = {
      BASIC: '#3B82F6', ADVANCED: '#8B5CF6', MULTI_SESSION: '#F59E0B',
      SPORTS_COMPETITION: '#EF4444', HOLIDAY_PROGRAM: '#10B981', ATTENDANCE: '#6B7280',
    }
    return styleColors[e.style] ?? '#1E2157'
  }
  return EVENT_COLORS[e.status] ?? '#1E2157'
}

// Every built filter must pass (AND). A filter with nothing chosen in it is
// inert — it's a row the user is still filling in, not "show nothing".
function passesFilters(e: any) {
  // ONE PERSON'S events (?person=…) — the old platform's profile has an Events tab
  // and mounts this module scoped to that member. Gated here rather than at load
  // so the sessions view and the exports narrow with it, for free. Null while the
  // id set is still loading: showing the whole club's calendar for a moment on a
  // member's own tab is exactly the wrong way round, so nothing shows until we know.
  if (personScope.value) {
    if (!personEventIds.value) return false
    if (!personEventIds.value.has(e.id)) return false
  }
  for (const f of calSettings.filters) {
    if (f.key === 'category') {
      if (!f.value?.length) continue
      if (!e.category_id || !f.value.includes(e.category_id)) return false
    }
    if (f.key === 'venue') {
      if (!f.value?.length) continue
      const ids: string[] = []
      if (e.bookable_id) ids.push(e.bookable_id)
      for (const loc of e.locations ?? []) {
        if (loc?.bookable_ids?.length) ids.push(...loc.bookable_ids)
      }
      if (!ids.some((id: string) => f.value.includes(id))) return false
    }
    if (f.key === 'status') {
      if (!f.value?.length) continue
      if (!f.value.includes(e.status)) return false
    }
    if (f.key === 'type') {
      if (!f.value?.length) continue
      if (!f.value.includes(e.style ?? 'BASIC')) return false
    }
    if (f.key === 'dates') {
      const [from, to] = f.value ?? []
      if (!from || !to) continue
      if (!e.start_at) return false
      const start = new Date(e.start_at).getTime()
      const lo = new Date(from); lo.setHours(0, 0, 0, 0)
      const hi = new Date(to); hi.setHours(23, 59, 59, 999)
      if (start < lo.getTime() || start > hi.getTime()) return false
    }
  }
  return true
}

const calendarEvents = computed(() => {
  const q = search.value.trim().toLowerCase()

  const eventItems = events.value
    .filter(passesFilters)
    .map(e => {
      const matches = !q || e.title.toLowerCase().includes(q)
      return {
        id: e.id,
        title: e.title,
        start: e.start_at ?? new Date().toISOString(),
        end: e.end_at ?? undefined,
        allDay: e.is_all_day ?? false,
        backgroundColor: eventColor(e),
        borderColor: 'transparent',
        textColor: '#ffffff',
        classNames: q && !matches ? ['fc-event-dimmed'] : [],
        extendedProps: e,
      }
    })

  // A session inherits its parent event's filterability — hiding an event but
  // leaving its sessions on the calendar would be nonsense.
  const sessionItems = separateSessions.value
    .filter(s => !s.event || passesFilters({ ...s.event, start_at: s.start_at }))
    .map(s => {
      const categoryColor = categoriesById.value[s.event?.category_id]?.color ?? '#1E2157'
      const category = categoriesById.value[s.event?.category_id] ?? null
      const matches = !q || (s.title || '').toLowerCase().includes(q) || (s.event?.title || '').toLowerCase().includes(q)
      return {
        id: `session-${s.id}`,
        title: s.title || 'Untitled Session',
        start: s.start_at ?? new Date().toISOString(),
        end: s.end_at ?? undefined,
        allDay: s.is_all_day ?? false,
        backgroundColor: categoryColor,
        borderColor: 'transparent',
        textColor: '#ffffff',
        classNames: q && !matches ? ['fc-event-dimmed'] : [],
        extendedProps: {
          ...s,
          _isSession: true,
          _eventId: s.event_id,
          category,
          status: `Session · ${s.event?.title ?? ''}`,
        },
      }
    })

  return [...eventItems, ...sessionItems]
})

const calendarOptions = ref({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: false,
  events: [] as any[],
  height: '100%',
  selectable: true,
  selectMirror: true,
  select: (info: any) => {
    const startStr = info.startStr.split('T')[0]
    // FullCalendar end is exclusive — subtract 1 day using local date parts to avoid UTC shift
    const [y, m, d] = info.endStr.split('T')[0].split('-').map(Number)
    const end = new Date(y, m - 1, d)
    end.setDate(end.getDate() - 1)
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    openEventTypeModal(startStr, startStr !== endStr ? endStr : undefined)
  },
  eventClick: (info: any) => {
    const props = info.event.extendedProps
    if (props._isSession) {
      navigateTo(`/events/${props._eventId}?tab=sessions&sessionId=${props.id}`)
    } else {
      navigateTo(`/events/${info.event.id}`)
    }
  },
  datesSet: (info: any) => {
    const d = info.view.currentStart
    calendarTitle.value = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  },
  eventDisplay: 'block',
  dayMaxEvents: 3,
  dayCellClassNames: 'hover:bg-gray-50 cursor-pointer',
  eventMouseEnter: (info: any) => showTooltip(info),
  eventMouseLeave: () => hideTooltip(),
})

function prev() {
  const v = bookingsCalView.value
  const d = new Date(calDate.value)
  if (v === 'day') d.setDate(d.getDate() - 1)
  else if (v === 'week') d.setDate(d.getDate() - 7)
  else d.setMonth(d.getMonth() - 1)
  calDate.value = d
}
function next() {
  const v = bookingsCalView.value
  const d = new Date(calDate.value)
  if (v === 'day') d.setDate(d.getDate() + 1)
  else if (v === 'week') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  calDate.value = d
}
function goToday() {
  calDate.value = new Date()
}
// Scroll down on the month calendar → next month, scroll up → previous. Throttled
// so one flick moves one month, not ten. Month view only (day/week scroll their grid).
let lastCalWheelAt = 0
function onCalendarWheel(e: WheelEvent) {
  if (bookingsCalView.value !== 'month' || Math.abs(e.deltaY) < 8) return
  e.preventDefault()
  const now = Date.now()
  if (now - lastCalWheelAt < 350) return
  lastCalWheelAt = now
  e.deltaY > 0 ? next() : prev()
}

let wheelTimer: ReturnType<typeof setTimeout> | null = null
let wheelAccum = 0
function handleCalendarWheel(e: WheelEvent) {
  const api = calendarRef.value?.getApi()
  if (!api) return
  const view = api.view.type
  if (view !== 'dayGridMonth') return
  wheelAccum += e.deltaY
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => {
    if (Math.abs(wheelAccum) >= 50) {
      if (wheelAccum > 0) api.incrementDate({ weeks: 1 })
      else api.incrementDate({ weeks: -1 })
    }
    wheelAccum = 0
    wheelTimer = null
  }, 50)
}

const filtered = computed(() => events.value.filter(e =>
  e.title.toLowerCase().includes(search.value.toLowerCase())
))

async function load() {
  loading.value = true
  // The org-wide "separate sessions" read (show_as_separate_event, top-level, dated,
  // joined to their event) goes through the events seam. Everything else too.
  const [evList, cats, sessionData, sharedList] = await Promise.all([
    eventsApi.list(orgId.value),
    eventsApi.categories(orgId.value),
    eventsApi.separateSessions(orgId.value).catch((e: any) => { console.error('sessions load error:', e); return [] }),
    // Events shared to this club (accepted from a national/governing body) — read-only.
    eventsApi.sharedEvents(orgId.value).catch(() => [] as any[]),
  ])
  // Seam returns camelCase; map to the snake_case shape the calendar item builder reads.
  const sessions = (sessionData ?? []).map((s: any) => ({
    ...s,
    start_at: s.startAt, end_at: s.endAt, is_all_day: s.isAllDay, event_id: s.eventId,
    event: s.event ? { ...s.event, org_id: s.event.orgId, category_id: s.event.categoryId, is_programme: s.event.isProgramme } : null,
  }))
  allCategories.value = cats ?? []
  // The seam returns ALL events newest-first; apply the filters the old query did
  // server-side (this programme mode, not archived) and the start_at ordering.
  // The PROGRAMME board shows only programmes. The EVENTS board shows everything,
  // programmes included: a holiday programme runs on real days at the club, so it
  // belongs on the club's calendar. It used to be `!!e.isProgramme === isProgramme`,
  // which read as a symmetry but meant /events silently hid them — the programme was
  // on the calendar's data, just filtered out of every view of it.
  const wanted = (e: any) => isProgramme.value ? !!e.isProgramme : true
  const ownRows = (evList ?? [])
    .filter((e: any) => wanted(e) && e.status !== 'ARCHIVED')
    .map(toEventRow)
  // Shared (accepted) events from a governing body — read-only, tagged with who shared them.
  const sharedRows = (sharedList ?? [])
    .filter((e: any) => wanted(e) && e.status !== 'ARCHIVED' && e.status !== 'CANCELLED')
    .map((e: any) => ({ ...toEventRow(e), is_shared: true, shared_from: e.sharedFromOrgName, discipline_name: e.disciplineName, external_url: e.externalUrl ?? null }))
  events.value = [...ownRows, ...sharedRows]
    .sort((a: any, b: any) => {
      // nullsFirst:false — undated events sort to the end.
      if (!a.start_at && !b.start_at) return 0
      if (!a.start_at) return 1
      if (!b.start_at) return -1
      return a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0
    })
  separateSessions.value = sessions.filter((s: any) => {
    const ev = s.event
    return ev && ev.status !== 'ARCHIVED' && ev.org_id === orgId.value && !!ev.is_programme === isProgramme.value
  })
  loading.value = false
  if (isProgramme.value) loadProgrammeStats(events.value.map((e: any) => e.id))
}

// Per-programme aggregates for the programme list table: session/type/day counts,
// capacity, registrations, and the cheapest ("from") fee.
interface ProgStat { sessions: number; types: number; days: number; capacity: number; registrations: number; fromFee: number | null }
const programmeStats = ref<Record<string, ProgStat>>({})
function progStat(id: string): ProgStat {
  return programmeStats.value[id] ?? { sessions: 0, types: 0, days: 0, capacity: 0, registrations: 0, fromFee: null }
}
async function loadProgrammeStats(eventIds: string[]) {
  programmeStats.value = {}
  if (!eventIds.length) return
  // Programmes are few, so fan out per-event through the seam (no bulk read needed).
  const perEvent = await Promise.all(eventIds.map(async (id) => ({
    id,
    sessions: await eventsApi.sessions(id),
    registrations: await eventsApi.registrations(id),
  })))
  const sessToEvent: Record<string, string> = {}
  const acc: Record<string, { sessions: number; types: number; days: Set<string>; capacity: number; registrations: number; fromFee: number | null }> = {}
  for (const id of eventIds) acc[id] = { sessions: 0, types: 0, days: new Set(), capacity: 0, registrations: 0, fromFee: null }
  for (const { id, sessions: sess, registrations: regs } of perEvent) {
    const a = acc[id]; if (!a) continue
    for (const s of sess) {
      sessToEvent[s.id] = id
      a.sessions++
      if (s.isMaster) a.types++
      if (s.startAt) a.days.add(new Date(s.startAt).toISOString().slice(0, 10))
      a.capacity += s.capacityMax ?? 0
    }
    a.registrations += regs.length
  }
  const sessionIds = Object.keys(sessToEvent)
  if (sessionIds.length) {
    const fees = await eventsApi.feeComponents({ sessionIds })
    for (const f of fees) {
      const a = acc[sessToEvent[f.sessionId as string]]; if (!a) continue
      const amt = Number(f.amount ?? 0)
      if (amt > 0 && (a.fromFee === null || amt < a.fromFee)) a.fromFee = amt
    }
  }
  const out: Record<string, ProgStat> = {}
  for (const id of eventIds) out[id] = { ...acc[id], days: acc[id].days.size }
  programmeStats.value = out
}

const progRuns = (e: any) => e.start_at
  ? `${new Date(e.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${e.end_at ? new Date(e.end_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '…'}`
  : 'No dates'
const progFee = (id: string) => { const f = progStat(id).fromFee; return f != null ? `From $${f.toFixed(2)}` : 'Free' }


function openMenu(event: Event, row: any) {
  menuEvent = row
  menuItems.value = [
    { label: menuEvent.status === 'DRAFT' ? 'Continue setup' : 'View', icon: menuEvent.status === 'DRAFT' ? 'pi pi-pencil' : 'pi pi-eye', command: () => openEvent(menuEvent) },
    ...(row.status === 'DRAFT' ? [{ label: 'Publish', icon: 'pi pi-send', command: () => publishEvent(menuEvent.id) }] : []),
    { separator: true },
    { label: 'Archive', icon: 'pi pi-trash', class: 'text-red-500', command: () => archiveEvent(menuEvent.id) },
  ]
  rowMenu.value.toggle(event)
}

async function publishEvent(id: string) {
  await eventsApi.update(id, { status: 'PUBLISHED' })
  toast.add({ severity: 'success', summary: `${t('event', false)} published`, life: 3000 })
  load()
}

async function archiveEvent(id: string) {
  await eventsApi.update(id, { status: 'ARCHIVED' })
  toast.add({ severity: 'success', summary: `${t('event', false)} archived`, life: 3000 })
  load()
}

// Keep calendarOptions.events in sync with the filtered computed list
watch(calendarEvents, (evts) => {
  calendarOptions.value.events = evts
}, { immediate: true })

// ---- Demo data prompt ----
const DEMO_PROMPTED_KEY = 'fm_demo_data_prompted_v1'
const showDemoPrompt = ref(false)
const installingDemo = ref(false)

function dismissDemoPrompt() {
  localStorage.setItem(DEMO_PROMPTED_KEY, '1')
  showDemoPrompt.value = false
}

async function installDemoData() {
  installingDemo.value = true
  try {
    const now = new Date()
    const addDays = (n: number) => {
      const d = new Date(now); d.setDate(d.getDate() + n); return d
    }
    const iso = (d: Date, h: number, m = 0) => {
      const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString()
    }

    // Categories — created one at a time through the seam.
    const catDefs = [
      { name: 'Swim Training', color: '#3B82F6' },
      { name: 'Competitions', color: '#8B5CF6' },
      { name: 'Social Events', color: '#10B981' },
    ]
    const cats = [] as any[]
    for (const c of catDefs) cats.push(await eventsApi.createCategory({ orgId: orgId.value, name: c.name, color: c.color }))
    const catByName = Object.fromEntries(cats.map((c: any) => [c.name, c.id]))

    // Events
    const eventDefs = [
      {
        style: 'BASIC', status: 'PUBLISHED', title: 'Swim Squad Training',
        categoryId: catByName['Swim Training'],
        startAt: iso(addDays(2), 7), endAt: iso(addDays(2), 8), isAllDay: false,
      },
      {
        style: 'BASIC', status: 'PUBLISHED', title: 'Junior Development Training',
        categoryId: catByName['Swim Training'],
        startAt: iso(addDays(5), 16), endAt: iso(addDays(5), 17, 30), isAllDay: false,
      },
      {
        style: 'BASIC', status: 'PUBLISHED', title: 'Regional Championships',
        categoryId: catByName['Competitions'],
        startAt: iso(addDays(14), 8), endAt: iso(addDays(15), 17), isAllDay: false,
      },
      {
        style: 'BASIC', status: 'DRAFT', title: 'End of Season Dinner',
        categoryId: catByName['Social Events'],
        startAt: iso(addDays(21), 18, 30), endAt: iso(addDays(21), 22), isAllDay: false,
      },
    ]
    for (const e of eventDefs) await eventsApi.create({ orgId: orgId.value, ...e })

    await Promise.all([load(), loadCalendars()])
    localStorage.setItem(DEMO_PROMPTED_KEY, '1')
    showDemoPrompt.value = false
    toast.add({ severity: 'success', summary: 'Demo data installed', detail: '4 sample events and 3 categories added.', life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not install demo data', detail: e?.message, life: 4000 })
  } finally {
    installingDemo.value = false
  }
}

// Set initial calendar title
// /events ↔ /programme are the same component (aliased), so switching between
// them doesn't remount — reload + relock the view when the mode flips.
watch(isProgramme, (prog) => {
  if (prog) calSettings.defaultView = 'table'
  load()
})

onMounted(async () => {
  if (isProgramme.value) calSettings.defaultView = 'table'
  await Promise.all([load(), loadCalendars(), loadShareClubs(), loadOrgLevel(), loadInviteeCounts()])
  calendarTitle.value = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  // A "New calendar" intent from the left menu takes priority over the empty-calendar welcome.
  const openingNewCal = navNewCalendar.value
  handleNavNewCalendar()

  // Show demo data prompt only if no events and not previously dismissed.
  // Never on /programme — an empty programme list is normal, not a blank calendar.
  // GATE on the app-wide prototype disclaimer being dismissed first: otherwise the two
  // modals stack and the disclaimer's mask sits over this one's buttons (the disclaimer
  // is a blocking modal, so this resolves within a couple of seconds).
  if (!openingNewCal && !isProgramme.value && events.value.length === 0 && !localStorage.getItem(DEMO_PROMPTED_KEY)) {
    const ackd = () => sessionStorage.getItem('prototype_acknowledged') === '1'
    /**
     * RE-CHECK AT FIRING TIME, not just at mount. Two reasons, both bugs we hit:
     *
     * 1. `events` IS USUALLY EMPTY AT MOUNT because the load hasn't come back yet.
     *    So a club with a full calendar still qualified here, and up to 30 seconds
     *    later got a "you have no events, want demo data?" modal over the top of it.
     *
     * 2. IT STOLE FOCUS MID-TASK. This fires on a 400ms poll waiting for the
     *    disclaimer, so it lands SECONDS after the page settles — long enough that
     *    you've opened Quick event and started typing. A modal opening takes focus,
     *    so the cursor vanished from the name field a few seconds in. It looked like
     *    the Quick-event dialog failing to hold focus, which is where two fixes went
     *    before this was found; the giveaway was that only Quick event was affected,
     *    because it's the only create flow that stays ON the board — the others
     *    navigate to their own route and leave this timer behind.
     *
     * A welcome prompt is the lowest-priority thing on the screen: it must never
     * interrupt work in progress, so it also stands down while any dialog is open.
     */
    const stillWanted = () => events.value.length === 0
      && !localStorage.getItem(DEMO_PROMPTED_KEY)
      && !quickOpen.value && !showEventNameModal.value
      && !document.querySelector('.p-dialog')
    if (ackd() && stillWanted()) { showDemoPrompt.value = true }
    else {
      let tries = 0
      const t = setInterval(() => {
        if (++tries > 75) { clearInterval(t); return }   // ~30s cap so it never polls forever
        if (!ackd()) return
        clearInterval(t)
        if (stillWanted()) showDemoPrompt.value = true
      }, 400)
    }
  }
})
</script>

<style>
.fc .fc-toolbar { display: none; }
.fc .fc-daygrid-day-top { padding: 6px 8px; }
.fc .fc-daygrid-day-number { font-size: 12px; color: #374151; font-weight: 500; }
.fc .fc-col-header-cell-cushion { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 0; }
.fc .fc-daygrid-event { border-radius: 4px; padding: 1px 6px; font-size: 12px; font-weight: 500; margin: 1px 4px; }
.fc .fc-day-today .fc-daygrid-day-frame { background: #f0f4ff; }
.fc .fc-day-today .fc-daygrid-day-number { color: var(--brand-primary); font-weight: 700; }
.fc-theme-standard td, .fc-theme-standard th { border-color: #e5e7eb; }
.fc-theme-standard .fc-scrollgrid { border-color: transparent; }
.fc .fc-event-dimmed { opacity: 0.15; transition: opacity 0.15s; }
.fc .fc-event-dimmed:hover { opacity: 0.5; }
</style>
