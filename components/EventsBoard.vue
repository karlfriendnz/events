<template>
  <!-- While the settings drawer is open the page gives up its right-hand 420px
       instead of being covered: the calendar shifts left and stays fully visible,
       so you watch a filter bite as you set it. -->
  <div class="p-3 sm:p-6 flex flex-col h-full transition-[margin] duration-200"
    :class="showCalSettings ? 'md:mr-[420px]' : ''">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
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
          <Button label="Today" severity="secondary" outlined size="small" class="ml-1 shrink-0" @click="goToday" />
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

      <!-- Tabs -->
      <div class="flex border-b border-gray-200 px-4 shrink-0">
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
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-sm font-semibold text-gray-700">
                {{ editingCalendarId ? `Edit "${newCalendarName || 'calendar'}"` : 'New calendar' }}
              </label>
              <button v-if="editingCalendarId" class="text-xs text-red-500 hover:text-red-700 hover:underline"
                @click="deleteCalendar">Delete</button>
            </div>
            <InputText v-model="newCalendarName" placeholder="Calendar name" class="w-full" />
          </div>

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
                  <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: option.color ?? '#94a3b8' }" />
                  <span>{{ option.name }}</span>
                </div>
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
        <div v-else class="flex flex-col gap-2">
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
      </div>

      <template #footer>
        <div class="flex items-center justify-between w-full">
          <Button label="Reset to defaults" severity="secondary" text size="small" @click="resetCalSettings" />
          <Button label="Done" size="small" @click="applyCalSettings"
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
            <p class="font-medium text-gray-800 truncate">{{ ev.notes }}</p>
            <p class="text-xs text-gray-500 truncate">{{ evWhen(ev.start_at) }}</p>
          </div>
          <i class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
        </button>
      </div>
    </div>

    <!-- Calendar view (desktop) -->
    <div v-if="!isTableView" class="hidden md:flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden flex-1" style="min-height:0">
      <BookingsCalendar
        :cal-date="calDate"
        :cal-view="bookingsCalView"
        :custom-events="bookingsCalEvents"
        @booking-click="onCalendarEventClick"
        @booking-drop="onCalendarEventDrop"
        @booking-hover="onCalendarEventHover"
        @booking-leave="hideTooltip"
        @slot-click="onCalendarSlotClick"
      />
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
      <div v-if="tooltip.visible" class="fixed z-50 pointer-events-none"
        :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
        <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-72">
          <!-- Banner image -->
          <div v-if="tooltip.event?.banner_url" class="h-32 overflow-hidden">
            <img :src="tooltip.event.banner_url" class="w-full h-full object-cover" />
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
              <span class="line-clamp-2 leading-relaxed">{{ tooltip.event.description }}</span>
            </div>
          </div>
          <div class="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
            <span class="text-xs px-2 py-0.5 rounded-full font-medium"
              :class="tooltip.event?.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
              {{ tooltip.event?.status }}
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

        <!-- 2 + 3. Name it, then pick how you want to build it -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">{{ t('event', false) }} name</label>
          <InputText
            ref="eventNameInput"
            v-model="newEventName"
            placeholder="Enter name of event"
            class="w-full"
            @keydown.enter="startWizard" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button"
            class="text-left border-2 rounded-xl p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:bg-[#F0F4FF]"
            :disabled="!newEventName.trim()"
            @click="startWizard">
            <div class="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
              <i class="pi pi-list-check text-primary" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900">Create by wizard</h3>
            <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">Guided, one step at a time.</p>
          </button>
          <button type="button"
            class="text-left border-2 rounded-xl p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:bg-[#F0F4FF]"
            :disabled="!newEventName.trim()"
            @click="startCustom">
            <div class="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
              <i class="pi pi-sliders-h text-purple-700" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900">Custom {{ t('event', false, true) }}</h3>
            <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">Choose the type and set it up yourself.</p>
          </button>
          <button type="button"
            class="text-left border-2 rounded-xl p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary hover:bg-[#F0F4FF]"
            :disabled="!newEventName.trim()"
            @click="startAdvanced">
            <div class="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center mb-2">
              <i class="pi pi-sliders-v text-amber-700" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900">Advanced {{ t('event', false, true) }}</h3>
            <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">Sessions, fees, forms, discounts and automation.</p>
          </button>
        </div>
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
        <div
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

const db = useDb()
const toast = useToast()
const confirm = useConfirm()
const route = useRoute()

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

function openEventTypeModal(date?: string, endDate?: string) {
  clickedDate.value = date ?? null
  clickedEndDate.value = endDate ?? null
  // A programme IS a multi-session event — creating one goes straight to the
  // multi-session builder, skipping the "how do you want to build it?" modal.
  if (isProgramme.value) {
    const params = new URLSearchParams({ programme: '1' })
    if (date) params.set('date', date)
    if (endDate) params.set('endDate', endDate)
    navigateTo(`/events/new-multi?${params}`)
    return
  }
  newEventName.value = ''
  showEventNameModal.value = true
}

function submitEventName() {
  if (!newEventName.value.trim()) return
  showEventNameModal.value = false
  showEventTypeModal.value = true
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
  if (!newEventName.value.trim()) return
  creationMode.value = 'wizard'
  showEventNameModal.value = false
  chooseSingleSession()
}
function startCustom() {
  if (!newEventName.value.trim()) return
  creationMode.value = 'custom'
  showEventNameModal.value = false
  chooseSingleSession()
}
// Advanced = the full event editor page (/events/:id), not the modal builder.
// Create the draft row here (same shape new-advanced's ensureDraft used) and
// land the user on it. openEvent() routes created_via:'advanced' back here too.
const creatingAdvanced = ref(false)
async function startAdvanced() {
  if (!newEventName.value.trim() || creatingAdvanced.value) return
  creatingAdvanced.value = true
  showEventNameModal.value = false
  try {
    const payload: any = {
      org_id: orgId.value,
      title: newEventName.value.trim(),
      status: 'DRAFT',
      style: 'ADVANCED',
      created_via: 'advanced',
      is_programme: isProgramme.value,
    }
    if (clickedDate.value) payload.start_at = clickedDate.value
    if (clickedEndDate.value) payload.end_at = clickedEndDate.value
    const { data, error } = await (db.from as any)('events').insert(payload).select('id').single()
    if (error || !data) {
      toast.add({ severity: 'error', summary: 'Could not create the event', detail: error?.message, life: 4000 })
      showEventNameModal.value = true
      return
    }
    navigateTo(`/events/${data.id}`)
  } finally {
    creatingAdvanced.value = false
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
      org_id: orgId.value,
      title: newEventName.value.trim(),
      status: 'DRAFT',
      style: 'BASIC',
      created_via: 'custom',    // opens in the full event page, not the wizard
      is_programme: isProgramme.value,
    }
    if (clickedDate.value) payload.start_at = clickedDate.value
    if (clickedEndDate.value) payload.end_at = clickedEndDate.value
    const { data, error } = await (db.from as any)('events').insert(payload).select('id').single()
    if (error || !data) {
      toast.add({ severity: 'error', summary: 'Could not create the event', detail: error?.message, life: 4000 })
      return
    }
    // Custom = the same form as the wizard, but every section on one page.
    navigateTo(`/events/new-basic?draft=${data.id}&mode=full`)
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

const CAL_TABS = [
  { key: 'display', label: 'Display', icon: 'pi-sliders-h' },
  { key: 'filter', label: 'Filter', icon: 'pi-filter' },
  { key: 'export', label: 'Export', icon: 'pi-download' },
]
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
  await navigator.clipboard.writeText(embedSnippet.value)
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
  { label: 'Calendar', value: 'category' },
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

const activeCalendar = computed(() => {
  const calId = route.query.calendar as string | undefined
  if (!calId) return null
  return namedCalendars.value.find(c => c.id === calId) ?? null
})

async function loadCalendars() {
  const [{ data: cals }, { data: cats }, { data: books }] = await Promise.all([
    (db.from as any)('calendars')
      .select('id, name, sort_order, calendar_categories(category_id)')
      .eq('org_id', orgId.value)
      .order('sort_order'),
    db.from('categories')
      .select('id, name, color, icon')
      .eq('org_id', orgId.value)
      .order('name'),
    (db.from as any)('bookables')
      .select('id, name, type, parent_id')   // parent_id: sub-venues nest under their venue
      .eq('org_id', orgId.value)
      .eq('type', 'VENUE')
      .neq('status', 'ARCHIVED')
      .neq('status', 'DELETED')
      .order('name'),
  ])
  allCategories.value = cats ?? []
  allBookables.value = books ?? []
  namedCalendars.value = (cals ?? []).map((c: any) => ({
    ...c,
    categoryIds: c.calendar_categories?.map((cc: any) => cc.category_id) ?? [],
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

function saveCalPrefs() {
  const calId = currentCalId()
  const all = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) ?? '{}')
  all[calId] = {
    colorBy: calSettings.colorBy,
    defaultView: calSettings.defaultView,
    weekStart: calSettings.weekStart,
    showWeekends: calSettings.showWeekends,
    newButtonLabel: calSettings.newButtonLabel,
    // Dates round-trip through JSON as ISO strings; restore revives them.
    filters: calSettings.filters.map(f => ({ ...f, value: f.value })),
  }
  localStorage.setItem(CAL_PREFS_KEY, JSON.stringify(all))
}

function restoreCalPrefs(calId: string | undefined) {
  const key = calId ?? 'all'
  const all = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) ?? '{}')
  const saved = all[key]
  if (!saved) return false

  calSettings.colorBy = saved.colorBy ?? 'category'
  calSettings.defaultView = saved.defaultView ?? 'dayGridMonth'
  calSettings.weekStart = saved.weekStart ?? 1
  calSettings.showWeekends = saved.showWeekends ?? true
  calSettings.newButtonLabel = saved.newButtonLabel ?? ''

  // Drop stale IDs (a venue/calendar deleted since the pref was saved) and revive
  // the date range, which JSON flattened to ISO strings.
  calSettings.filters = (saved.filters ?? [])
    .filter((f: CalFilter) => filterDef(f.key))
    .map((f: CalFilter) => {
      if (f.key === 'venue') return { ...f, value: (f.value ?? []).filter((id: string) => allBookables.value.some((b: any) => b.id === id)) }
      if (f.key === 'category') return { ...f, value: (f.value ?? []).filter((id: string) => allCategories.value.some((c: any) => c.id === id)) }
      if (f.key === 'dates') return { ...f, value: Array.isArray(f.value) ? f.value.map((d: any) => (d ? new Date(d) : null)) : null }
      return f
    })
  return true
}

function applyActiveCalendarFilter() {
  const calId = isProgramme.value ? 'programme' : (route.query.calendar as string | undefined)
  const hadSaved = restoreCalPrefs(calId)
  if (hadSaved) return

  // First visit to a NAMED calendar — start filtered to the calendars it covers.
  calSettings.filters = []
  const cal = calId ? namedCalendars.value.find(c => c.id === calId) : null
  if (cal?.categoryIds?.length) {
    calSettings.filters = [{ id: 'category-seed', key: 'category', value: [...cal.categoryIds] }]
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
const creatingCalendar = ref(false)
const editingCalendarId = ref<string | null>(null)

function openCalSettings() {
  const calId = route.query.calendar as string | undefined
  if (calId) {
    const cal = namedCalendars.value.find(c => c.id === calId)
    if (cal) {
      newCalendarName.value = cal.name
      newCalendarCategoryIds.value = [...(cal.categoryIds ?? [])]
      editingCalendarId.value = cal.id
    }
  } else {
    newCalendarName.value = ''
    newCalendarCategoryIds.value = []
    editingCalendarId.value = null
  }
  calTab.value = 'display'
  showCalSettings.value = true
}

function selectCalendarForEdit(cal: any) {
  newCalendarName.value = cal.name
  newCalendarCategoryIds.value = [...(cal.categoryIds ?? [])]
  editingCalendarId.value = cal.id
}

async function createNewCalendar() {
  if (!newCalendarName.value.trim()) return
  creatingCalendar.value = true
  const name = newCalendarName.value.trim()

  if (editingCalendarId.value) {
    const { error } = await (db.from as any)('calendars').update({ name }).eq('id', editingCalendarId.value)
    if (error) {
      creatingCalendar.value = false
      toast.add({ severity: 'error', summary: 'Failed to update calendar', detail: error.message, life: 3000 })
      return
    }
    await (db.from as any)('calendar_categories').delete().eq('calendar_id', editingCalendarId.value)
    if (newCalendarCategoryIds.value.length) {
      await (db.from as any)('calendar_categories').insert(
        newCalendarCategoryIds.value.map(cid => ({ calendar_id: editingCalendarId.value, category_id: cid }))
      )
    }
    toast.add({ severity: 'success', summary: 'Calendar updated', life: 2000 })
  } else {
    const { data, error } = await (db.from as any)('calendars').insert({
      org_id: orgId.value,
      name,
    }).select('id').single()
    if (error) {
      creatingCalendar.value = false
      toast.add({ severity: 'error', summary: 'Failed to create calendar', detail: error.message, life: 3000 })
      return
    }
    if (data && newCalendarCategoryIds.value.length) {
      await (db.from as any)('calendar_categories').insert(
        newCalendarCategoryIds.value.map(cid => ({ calendar_id: (data as any).id, category_id: cid }))
      )
    }
    toast.add({ severity: 'success', summary: `Calendar "${name}" created`, life: 2000 })
  }

  creatingCalendar.value = false
  newCalendarName.value = ''
  newCalendarCategoryIds.value = []
  editingCalendarId.value = null
  await loadCalendars()
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
      const { error } = await (db.from as any)('calendars').delete().eq('id', editingCalendarId.value!)
      if (error) {
        toast.add({ severity: 'error', summary: 'Failed to delete calendar', detail: error.message, life: 3000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Calendar deleted', life: 2000 })
      showCalSettings.value = false
      newCalendarName.value = ''
      newCalendarCategoryIds.value = []
      editingCalendarId.value = null
      await navigateTo('/events')
      await loadCalendars()
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
const isTableView = computed(() => calSettings.defaultView === 'table')
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
    extendedProps: e.extendedProps,
  }))
})

// Reopen an event where it was built. ONLY an unfinished wizard draft goes back
// to the wizard — a live event, or one made in the custom/advanced/multi builders,
// opens on the full event page. (created_via, migration 257: `style` couldn't tell
// a wizard draft from a Custom one — both are BASIC.)
function openEvent(evt: { id: string; status?: string; created_via?: string | null; style?: string }) {
  const unfinished = evt.status === 'DRAFT'

  // An unfinished wizard draft resumes in the wizard, on the step it was left on.
  if (unfinished && evt.created_via === 'wizard') {
    navigateTo(`/events/new-basic?draft=${evt.id}`)
    return
  }
  // Everything single-session — a finished wizard event, or a Custom one —
  // opens the SAME form as one long page.
  const singleSession = (evt.style ?? 'BASIC') === 'BASIC'
  if (singleSession && evt.created_via !== 'advanced' && evt.created_via !== 'multi') {
    navigateTo(`/events/new-basic?draft=${evt.id}&mode=full`)
    return
  }
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
  const { data: siblings } = await db.from('events')
    .select('id, title, start_at')
    .or(`id.eq.${parentId},recurrence_parent_id.eq.${parentId}`)
    .neq('id', targetEventId)
  return (siblings ?? [])
    .filter((s: any) => s.start_at?.slice(0, 10) === dayKey)
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

  const { data: eventRow } = await db.from('events').select('id, title, start_at, end_at, recurrence_parent_id').eq('id', eventId).single()
  if (!eventRow) return

  const parentId = eventRow.recurrence_parent_id ?? eventId
  const conflicts = await detectConflicts(eventId, eventRow.recurrence_parent_id ? parentId : null, newStart)

  // Check if this event is part of a series (has parent OR has children)
  const { count: childCount } = await (db.from as any)('events')
    .select('id', { count: 'exact', head: true })
    .eq('recurrence_parent_id', eventId)
  const inSeries = !!eventRow.recurrence_parent_id || (childCount ?? 0) > 0

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
  await db.from('events').update({
    start_at: newStart.toISOString(),
    end_at: newEnd.toISOString(),
  }).eq('id', eventRow.id)
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
    const { data: family } = await db.from('events')
      .select('id, start_at, end_at')
      .or(`id.eq.${parentId},recurrence_parent_id.eq.${parentId}`)
    const targets = (family ?? []).filter((e: any) => {
      if (dropDialog.scope === 'all') return true
      // 'following' = events at or after the dragged event's original start
      return e.start_at >= eventRow.start_at
    })
    for (const t of targets) {
      const ts = new Date(t.start_at); ts.setDate(ts.getDate() + dayDelta)
      const te = new Date(t.end_at ?? t.start_at); te.setDate(te.getDate() + dayDelta)
      await db.from('events').update({
        start_at: ts.toISOString(),
        end_at: te.toISOString(),
      }).eq('id', t.id)
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

function showTooltip(info: any) {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  const rect = info.el.getBoundingClientRect()
  // Position to the right of the event pill, flip left if near edge
  let x = rect.right + 10
  let y = rect.top
  if (x + 290 > window.innerWidth) x = rect.left - 300
  if (y + 280 > window.innerHeight) y = window.innerHeight - 290
  tooltip.event = info.event.extendedProps
  tooltip.x = x
  tooltip.y = y
  tooltipTimer = setTimeout(() => { tooltip.visible = true }, 200)
}

function hideTooltip() {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  tooltip.visible = false
}

// Hover handler for BookingsCalendar event bars/blocks
function onCalendarEventHover(item: any, ev: MouseEvent) {
  if (tooltipTimer) clearTimeout(tooltipTimer)
  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  let x = rect.right + 10
  let y = rect.top
  if (x + 290 > window.innerWidth) x = rect.left - 300
  if (y + 280 > window.innerHeight) y = window.innerHeight - 290
  tooltip.event = item.extendedProps ?? item
  tooltip.x = x
  tooltip.y = y
  tooltipTimer = setTimeout(() => { tooltip.visible = true }, 200)
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
  const [{ data, error }, { data: sessionData, error: sessionError }] = await Promise.all([
    db.from('events')
      .select('*, category:categories!category_id(id, name, color, icon)')
      .eq('org_id', orgId.value)
      .eq('is_programme', isProgramme.value)   // /programme = programmes only; /events excludes them
      .neq('status', 'ARCHIVED')
      .order('start_at', { ascending: true, nullsFirst: false }),
    db.from('sessions')
      .select('*, event:events!event_id(id, title, status, org_id, category_id, is_programme)')
      .eq('show_as_separate_event', true)
      .is('parent_session_id', null)
      .not('start_at', 'is', null),
  ])
  if (error) console.error('events load error:', error)
  if (sessionError) console.error('sessions load error:', sessionError)
  events.value = data ?? []
  separateSessions.value = (sessionData ?? []).filter((s: any) => {
    const ev = s.event
    return ev && ev.status !== 'ARCHIVED' && ev.org_id === orgId.value && !!ev.is_programme === isProgramme.value
  })
  loading.value = false
}


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
  await db.from('events').update({ status: 'PUBLISHED' }).eq('id', id)
  toast.add({ severity: 'success', summary: `${t('event', false)} published`, life: 3000 })
  load()
}

async function archiveEvent(id: string) {
  await db.from('events').update({ status: 'ARCHIVED' }).eq('id', id)
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

    // Categories
    const { data: cats } = await db.from('categories').insert([
      { org_id: orgId.value, name: 'Swim Training', color: '#3B82F6' },
      { org_id: orgId.value, name: 'Competitions', color: '#8B5CF6' },
      { org_id: orgId.value, name: 'Social Events', color: '#10B981' },
    ]).select('id, name')

    const catByName = Object.fromEntries((cats ?? []).map((c: any) => [c.name, c.id]))

    // Events
    await db.from('events').insert([
      {
        org_id: orgId.value, style: 'BASIC', status: 'PUBLISHED',
        title: 'Swim Squad Training',
        category_id: catByName['Swim Training'],
        start_at: iso(addDays(2), 7), end_at: iso(addDays(2), 8),
        is_all_day: false,
      },
      {
        org_id: orgId.value, style: 'BASIC', status: 'PUBLISHED',
        title: 'Junior Development Training',
        category_id: catByName['Swim Training'],
        start_at: iso(addDays(5), 16), end_at: iso(addDays(5), 17, 30),
        is_all_day: false,
      },
      {
        org_id: orgId.value, style: 'BASIC', status: 'PUBLISHED',
        title: 'Regional Championships',
        category_id: catByName['Competitions'],
        start_at: iso(addDays(14), 8), end_at: iso(addDays(15), 17),
        is_all_day: false,
      },
      {
        org_id: orgId.value, style: 'BASIC', status: 'DRAFT',
        title: 'End of Season Dinner',
        category_id: catByName['Social Events'],
        start_at: iso(addDays(21), 18, 30), end_at: iso(addDays(21), 22),
        is_all_day: false,
      },
    ])

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
  if (prog) calSettings.defaultView = 'listWeek'
  load()
})

onMounted(async () => {
  if (isProgramme.value) calSettings.defaultView = 'listWeek'
  await Promise.all([load(), loadCalendars()])
  calendarTitle.value = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })

  // Show demo data prompt only if no events and not previously dismissed.
  // Never on /programme — an empty programme list is normal, not a blank calendar.
  if (!isProgramme.value && events.value.length === 0 && !localStorage.getItem(DEMO_PROMPTED_KEY)) {
    showDemoPrompt.value = true
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
