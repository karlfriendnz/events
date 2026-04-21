<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">

    <!-- Pill tab navigation -->
    <div class="bg-white border-b border-gray-200 px-6 py-3 shrink-0 flex justify-center">
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

    <!-- Actions row -->
    <div class="bg-white border-b border-gray-200 px-6 py-2 shrink-0 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Tag v-if="event" :value="event.status" :severity="statusSeverity(event.status)" class="text-xs" />
      </div>
      <div class="flex items-center gap-2">
        <Button v-if="event?.status === 'DRAFT'" :label="event?.publish_at ? 'Scheduled' : 'Publish'" :icon="event?.publish_at ? 'pi pi-clock' : 'pi pi-send'" size="small"
          @click="showPublishDialog = true; publishSendInvite = false; publishToWebsite = false; publishScheduled = false; publishAtDate = null; publishAtTime = null" :style="event?.publish_at ? 'background:#F59E0B;border-color:#F59E0B' : 'background:#34B66D;border-color:#34B66D'" />
        <Button icon="pi pi-ellipsis-v" severity="secondary" text size="small" @click="e => moreMenu.toggle(e)" />
        <Menu ref="moreMenu" :model="moreMenuItems" :popup="true" />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 flex flex-col min-h-0 bg-[#F5F8FA]">

      <!-- OVERVIEW TAB -->
      <div v-if="activeTab === 'overview'" class="overflow-y-auto flex-1">
        <!-- Hero banner (always visible, always inline-editable) -->
        <div class="max-w-[1140px] mx-auto relative overflow-hidden group/banner" style="height:300px">
          <!-- Background: image or gradient -->
          <div class="absolute inset-0">
            <img v-if="event?.banner_url" :src="event.banner_url" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full bg-gradient-to-br from-[#1E2157] to-[#2e38a8]" />
          </div>
          <!-- Change banner overlay (hover) -->
          <div class="absolute inset-0 bg-black/0 group-hover/banner:bg-black/25 transition-colors flex items-center justify-center cursor-pointer"
            @click="bannerInput?.click()">
            <div class="opacity-0 group-hover/banner:opacity-100 transition-opacity flex flex-col items-center gap-2 text-white pointer-events-none">
              <i class="pi pi-camera text-2xl" />
              <span class="text-sm font-medium">{{ uploadingBanner ? 'Uploading…' : 'Change banner' }}</span>
            </div>
          </div>
          <input ref="bannerInput" type="file" accept="image/*" class="hidden" @change="handleBannerUpload" />
          <!-- Title (inline editable) -->
          <div class="absolute bottom-0 left-0 right-0 bg-black/60 px-6 py-4 flex items-center gap-3" @click.stop>
            <input
              v-model="editForm.title"
              class="flex-1 text-xl font-semibold text-white bg-transparent border-0 border-b border-transparent hover:border-white/30 focus:border-white/60 outline-none placeholder-white/50 transition-colors py-0.5"
              placeholder="Event title"
              @blur="saveBannerTitle"
              @keydown.enter="($event.target as HTMLInputElement).blur()" />
          </div>
          <!-- Date badge -->
          <div v-if="event?.start_at" class="absolute bottom-4 right-6 bg-white rounded-xl shadow-lg px-4 py-3 text-center min-w-[72px]">
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ formatDay(event.start_at) }}</p>
            <p class="text-3xl font-bold text-gray-900 leading-none">{{ formatDayNum(event.start_at) }}</p>
            <p class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ formatMonth(event.start_at) }}</p>
          </div>
        </div>

        <!-- Info card -->
        <div class="max-w-[1140px] mx-auto px-6 py-6 space-y-5">
          <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

            <!-- Attendees row -->
            <div class="flex items-center px-6 py-4 gap-6">
              <span class="text-sm font-semibold text-gray-700 w-28 shrink-0">Attendees</span>
              <div class="flex items-center gap-6 flex-1">
                <div class="flex items-center gap-2 bg-[#E9F8F3] text-[#1EA97C] rounded-full px-4 py-1.5">
                  <i class="pi pi-users text-sm font-bold" />
                  <span class="text-sm font-bold">{{ confirmedInvitees.length }}</span>
                </div>
                <span class="text-sm text-gray-500">
                  <span class="font-semibold text-gray-700">Interested</span>
                  <span class="ml-2">{{ interestedCount }}</span>
                </span>
                <span v-if="event?.has_waitlist && waitlistedCount > 0" class="text-sm text-gray-500">
                  <span class="font-semibold text-amber-600">Waitlisted</span>
                  <span class="ml-2">{{ waitlistedCount }}</span>
                </span>
                <span v-if="event?.capacity_max" class="text-sm text-gray-500">
                  of <span class="font-medium text-gray-700">{{ event.capacity_max }}</span> capacity
                </span>
              </div>
              <Button label="Take Attendance" icon="pi pi-check-square" size="small"
                style="background:#2494D2; border-color:#2494D2" @click="activeTab = 'attendance'" />
            </div>

            <!-- Name row (hidden for advanced events — title lives in the banner) -->
            <div v-if="event?.style !== 'ADVANCED'">
              <div class="flex items-center px-6 py-4 gap-6 group hover:bg-gray-50/50 transition-colors"
                :class="fieldEditing.title ? '' : 'cursor-pointer'"
                @click="!fieldEditing.title && startFieldEdit('title')">
                <span class="text-sm font-semibold text-gray-700 w-28 shrink-0">Name</span>
                <span class="text-sm text-gray-700 flex-1">{{ event?.title ?? '—' }}</span>
                <i v-if="!fieldEditing.title" class="pi pi-pencil text-xs text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
              </div>
              <div v-if="fieldEditing.title" class="border-t border-gray-100 pl-40 pr-6 py-4 space-y-3" @click.stop>
                <InputText v-model="editForm.title" class="w-full" autofocus
                  @keydown.enter="saveField('title')" @keydown.esc="cancelFieldEdit('title')" />
                <div class="flex justify-end gap-2">
                  <Button label="Cancel" size="small" severity="secondary" text @click="cancelFieldEdit('title')" />
                  <Button label="Save" icon="pi pi-check" size="small" :loading="savingField === 'title'" @click="saveField('title')" style="background:#1E2157;border-color:#1E2157" />
                </div>
              </div>
            </div>

          </div>

          <EventDetailsCard
            v-model:startDate="editForm.start_date"
            v-model:endDate="editForm.end_date"
            v-model:startTime="editForm.start_time"
            v-model:endTime="editForm.end_time"
            v-model:isAllDay="editForm.is_all_day"
            v-model:repeat="editForm.repeat"
            v-model:locations="editForm.locations"
            v-model:categoryIds="editForm.category_ids"
            v-model:description="editForm.description"
            v-model:feeLineItems="feeLineItems"
            v-model:regOpenAt="editForm.reg_open_at"
            v-model:regCloseAt="editForm.reg_close_at"
            :categories="allCategories"
            :savingField="savingField"
            :feesLoading="feesLoading"
            :showLocation="event?.style !== 'ADVANCED'"
            :eventId="id"
            @save="saveField"
            @fees-change="syncFees"
            @new-category="showNewCategoryDialog = true"
          />

          <!-- Ticketed event toggle (ADVANCED only) -->
          <div v-if="event?.style === 'ADVANCED'" class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div class="flex items-center px-6 py-4 gap-6">
              <span class="text-sm font-semibold text-gray-700 w-28 shrink-0">Ticketed Event</span>
              <div class="flex items-center gap-3 flex-1">
                <ToggleSwitch v-model="hasTickets" @update:modelValue="saveHasTickets" />
                <span class="text-sm text-gray-500">{{ hasTickets ? 'Tickets enabled — Tickets tab is active' : 'No tickets for this event' }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- INVITEES TAB -->
      <div v-else-if="activeTab === 'invitees'" class="px-6 py-6 overflow-y-auto flex-1">
        <EventInviteeManager :event-id="id" />
      </div>

      <!-- FORMS TAB -->
      <div v-else-if="activeTab === 'forms'" class="flex flex-col flex-1 min-h-0">

        <!-- Two-panel body -->
        <div class="flex flex-1 min-h-0">

        <!-- Left panel -->
        <div class="w-[420px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

          <!-- Group list -->
          <template v-if="!evtFormShowSections">
            <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-2">
              <div>
                <h2 class="text-base font-bold text-gray-900">Registration Forms</h2>
                <p class="text-xs text-gray-400 mt-0.5">Configure a form for each registration group.</p>
              </div>
              <button type="button"
                class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[#1E2157] hover:bg-[#2a2f6e] text-white transition-colors mt-0.5"
                v-tooltip.left="'Add form'"
                @click="openAddFormDialog">
                <i class="pi pi-plus text-xs" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
              <div
                v-for="group in evtFormGroups" :key="group.id"
                class="group/fg w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left cursor-pointer"
                :class="selectedFormGroupId === group.id
                  ? 'bg-[#1E2157]/5 border-[#1E2157]/20 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'"
                @click="selectEvtFormGroup(group.id)">
                <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  :class="group.noRegistrations ? 'bg-orange-50' : group.complete ? 'bg-green-50' : group.notSetUp ? 'bg-gray-100' : 'bg-red-50'">
                  <i class="pi text-base"
                    :class="group.noRegistrations ? 'pi-ban text-orange-400' : group.complete ? 'pi-check text-green-500' : group.notSetUp ? 'pi-plus-circle text-gray-400' : 'pi-exclamation-circle text-red-400'" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <input
                      :value="evtFormGroupsList.find(g => g.id === group.id)?.name"
                      class="text-sm font-semibold text-gray-800 bg-transparent border-0 outline-none min-w-0 truncate p-0 focus:ring-0 cursor-pointer focus:cursor-text"
                      @click.stop
                      @input="e => { const g = evtFormGroupsList.find(x => x.id === group.id); if (g) g.name = (e.target as HTMLInputElement).value }"
                    />
                    <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                      :class="evtFormGroupsList.find(g => g.id === group.id)?.person_type === 'member' ? 'bg-[#1E2157]/10 text-[#1E2157]' : evtFormGroupsList.find(g => g.id === group.id)?.person_type === 'guest' ? 'bg-amber-100 text-amber-700' : 'bg-green-50 text-green-700'">
                      {{ evtFormGroupsList.find(g => g.id === group.id)?.person_type ?? 'public' }}
                    </span>
                  </div>
                  <p class="text-xs mt-0.5" :class="group.noRegistrations ? 'text-orange-400' : group.complete ? 'text-green-500' : group.notSetUp ? 'text-gray-400' : 'text-gray-500'">
                    {{ group.noRegistrations ? 'No registrations' : group.complete ? 'Complete' : group.notSetUp ? 'Not set up' : `${group.filledCount} of ${group.totalCount} sections saved` }}
                  </p>
                </div>
                <div v-if="!group.noRegistrations && !group.notSetUp && !group.complete" class="shrink-0 flex flex-col items-end gap-1">
                  <span class="text-xs font-bold text-gray-400">{{ group.filledCount }}/{{ group.totalCount }}</span>
                  <div class="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full bg-[#1ab4e8] transition-all" :style="`width:${group.totalCount ? (group.filledCount/group.totalCount)*100 : 0}%`" />
                  </div>
                </div>
                <template v-else>
                  <button v-if="evtFormGroups.length > 1" type="button"
                    class="opacity-0 group-hover/fg:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    @click.stop="formToDelete = group.id">
                    <i class="pi pi-trash text-xs" />
                  </button>
                  <i v-else class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
                </template>
              </div>
            </div>
          </template>

          <!-- Section nav / section settings (after form type chosen) -->
          <template v-else>

            <!-- Section nav: shown when no section is selected -->
            <template v-if="!evtSelectedFormSection">
              <!-- Header -->
              <div class="px-5 pt-5 pb-4 border-b border-gray-100">
                <button type="button" class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#0e43a3] transition-colors mb-2" @click="evtFormShowSections = false">
                  <i class="pi pi-chevron-left text-[10px]" />
                  All Forms
                </button>
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <input
                        :value="currentEvtFormGroupName"
                        class="text-base font-bold text-gray-900 bg-transparent border-0 outline-none p-0 focus:ring-0"
                        @input="e => { const g = evtFormGroupsList.find(x => x.id === selectedFormGroupId); if (g) g.name = (e.target as HTMLInputElement).value }"
                      />
                      <span class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                        :class="currentFormPersonType === 'member' ? 'bg-[#1E2157]/10 text-[#1E2157]' : currentFormPersonType === 'guest' ? 'bg-amber-100 text-amber-700' : 'bg-green-50 text-green-700'">
                        {{ currentFormPersonType }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-400 mt-0.5">{{ evtFormSectionCompletedCount }} of {{ evtFormSections.length }} sections complete</p>
                  </div>
                  <div class="shrink-0 mt-1">
                    <div class="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div class="h-full rounded-full bg-[#1ab4e8] transition-all" :style="`width:${evtFormSections.length ? (evtFormSectionCompletedCount/evtFormSections.length)*100 : 0}%`" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                <button
                  v-for="s in evtFormSections" :key="s.id"
                  type="button"
                  class="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl border transition-all text-left group"
                  :class="s.complete ? 'border-green-100 bg-green-50/30 hover:bg-green-50/60' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'"
                  @click="evtSelectedFormSection = s.id">
                  <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                    :class="s.complete ? 'bg-green-100' : 'bg-gray-100 group-hover:bg-gray-200'">
                    <i class="pi text-sm" :class="[s.icon, s.complete ? 'text-green-600' : 'text-gray-500']" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800">{{ s.label }}</p>
                    <p class="text-xs mt-0.5" :class="s.complete ? 'text-green-500' : 'text-gray-400'">{{ s.subtitle ?? (s.complete ? 'Saved' : 'Not configured') }}</p>
                  </div>
                  <i class="pi text-sm shrink-0" :class="s.complete ? 'pi-check-circle text-green-500' : 'pi-chevron-right text-gray-300'" />
                </button>
              </div>
              <div class="px-4 py-4 border-t border-gray-100 space-y-2 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="evtFormShowSections = false">Done</button>
                <div class="flex items-center justify-between pt-1">
                  <button type="button" class="text-xs text-gray-400 hover:text-[#182e59] transition-colors" @click="changeEvtFormType()">Change form type</button>
                  <button v-if="evtFormGroups.length > 1" type="button" class="text-xs text-red-400 hover:text-red-600 transition-colors" @click="formToDelete = selectedFormGroupId">Delete form</button>
                </div>
              </div>
            </template>

            <!-- DESIGN section settings -->
            <template v-else-if="evtSelectedFormSection === 'design'">
              <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
                <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="evtSelectedFormSection = ''">
                  <i class="pi pi-chevron-left text-sm" />
                </button>
                <div class="flex-1">
                  <p class="text-sm font-bold text-gray-900">Design</p>
                  <p class="text-xs text-gray-400">Customise the look of your form</p>
                </div>
                <button type="button" class="px-3 py-1.5 bg-[#1ab4e8] hover:bg-[#16a0d0] text-white text-xs font-semibold rounded-lg transition-colors" @click="saveEvtFormSection('design')">Save</button>
              </div>
              <div class="px-4 py-4 space-y-5 overflow-y-auto flex-1">
                <!-- Form Style -->
                <div>
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Form Style</p>
                  <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
                    <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" :class="currentEvtFormDesign.style === 'single' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'" @click="currentEvtFormDesign.style = 'single'">Single Page</button>
                    <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" :class="currentEvtFormDesign.style === 'tabs' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'" @click="currentEvtFormDesign.style = 'tabs'">Tabs</button>
                  </div>
                </div>

                <!-- Header -->
                <div>
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Header Image</p>
                  <div class="flex p-1 bg-gray-100 rounded-xl gap-1 mb-2">
                    <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" :class="currentEvtFormDesign.header === 'event' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'" @click="currentEvtFormDesign.header = 'event'">Use Event Image</button>
                    <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" :class="currentEvtFormDesign.header === 'custom' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'" @click="currentEvtFormDesign.header = 'custom'">Custom Upload</button>
                  </div>
                  <div v-if="currentEvtFormDesign.header === 'custom'">
                    <label class="flex items-center gap-3 border border-dashed border-gray-200 rounded-xl p-3 cursor-pointer hover:border-[#0e43a3] hover:bg-blue-50/30 transition-colors">
                      <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <i class="pi pi-upload text-gray-400 text-sm" />
                      </div>
                      <div>
                        <p class="text-xs font-semibold text-gray-700">Upload header image</p>
                        <p class="text-[11px] text-gray-400">PNG, JPG up to 5MB</p>
                      </div>
                      <input type="file" accept="image/*" class="hidden" @change="handleEvtFormImageUpload('headerImage', $event)" />
                    </label>
                    <img v-if="currentEvtFormDesign.headerImage" :src="currentEvtFormDesign.headerImage" class="w-full h-20 object-cover rounded-xl mt-2" />
                  </div>
                </div>

                <!-- Top Icons -->
                <div>
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Event Info Icons</p>
                  <div class="grid grid-cols-2 gap-y-1 gap-x-2">
                    <label v-for="icon in ['date','time','cost','location','criteria']" :key="icon"
                      class="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
                      <Checkbox v-model="currentEvtFormDesign.icons[icon]" binary />
                      <span class="text-sm text-gray-700 capitalize">{{ icon }}</span>
                    </label>
                  </div>
                </div>

                <!-- Description -->
                <div>
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Description</p>
                  <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
                    <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" :class="currentEvtFormDesign.description === 'event' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'" @click="currentEvtFormDesign.description = 'event'">From Event</button>
                    <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" :class="currentEvtFormDesign.description === 'custom' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'" @click="currentEvtFormDesign.description = 'custom'">Custom</button>
                  </div>
                  <p v-if="currentEvtFormDesign.description === 'custom'" class="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
                    <i class="pi pi-arrow-right text-[10px]" />Edit the text directly in the preview →
                  </p>
                </div>

                <!-- Form Heading -->
                <div>
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Form Heading</p>
                  <input v-model="currentEvtFormDesign.formHeading" type="text" placeholder="Fill in the form to register" class="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                </div>

                <!-- Add Person Button -->
                <div>
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Add Person Button</p>
                  <div class="flex items-center gap-2 p-2 border border-gray-200 rounded-xl">
                    <input type="color" v-model="currentEvtFormDesign.addPersonColor" class="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
                    <span class="text-xs text-gray-500 font-mono flex-1">{{ currentEvtFormDesign.addPersonColor }}</span>
                    <button type="button" class="text-xs text-gray-400 hover:text-gray-600 transition-colors" @click="currentEvtFormDesign.addPersonColor = '#0e43a3'">Reset</button>
                  </div>
                </div>

                <!-- Background -->
                <div>
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Page Background</p>
                  <FormsSegmentedControl
                    v-model="currentEvtFormDesign.background"
                    :options="[{ label: 'Default', value: 'default' }, { label: 'Colour', value: 'colour' }, { label: 'Image', value: 'custom' }]"
                    class="mb-2" />

                  <!-- Colour picker -->
                  <div v-if="currentEvtFormDesign.background === 'colour'" class="flex items-center gap-2 p-2 border border-gray-200 rounded-xl">
                    <input
                      type="color"
                      v-model="currentEvtFormDesign.backgroundColor"
                      class="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
                    <span class="text-xs text-gray-500 font-mono flex-1">{{ currentEvtFormDesign.backgroundColor }}</span>
                    <button type="button" class="text-xs text-gray-400 hover:text-gray-600 transition-colors" @click="currentEvtFormDesign.backgroundColor = '#f0f2f5'">Reset</button>
                  </div>

                  <!-- Image upload + controls -->
                  <template v-if="currentEvtFormDesign.background === 'custom'">
                    <FormsImageUploadField
                      v-model="currentEvtFormDesign.backgroundImage"
                      placeholder="Upload background image"
                      class="mb-3" />
                    <div v-if="currentEvtFormDesign.backgroundImage" class="space-y-3">
                      <!-- Fade Overlay -->
                      <div>
                        <div class="flex items-center justify-between mb-1.5">
                          <p class="text-xs font-semibold text-gray-600">Fade Overlay</p>
                          <span class="text-xs text-gray-400 font-mono">{{ Math.round(currentEvtFormDesign.backgroundOverlay * 100) }}%</span>
                        </div>
                        <input
                          type="range" min="0" max="1" step="0.05"
                          v-model.number="currentEvtFormDesign.backgroundOverlay"
                          class="w-full accent-[#1E2157]" />
                      </div>
                    </div>
                  </template>
                </div>

                <!-- Sponsors -->
                <div>
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sponsors</p>
                  <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
                    <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" :class="currentEvtFormDesign.sponsors === 'show' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'" @click="currentEvtFormDesign.sponsors = 'show'">Show</button>
                    <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" :class="currentEvtFormDesign.sponsors === 'hide' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'" @click="currentEvtFormDesign.sponsors = 'hide'">Hide</button>
                  </div>
                </div>

                <button type="button" class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtFormSection('design')">Save Design</button>
              </div>
            </template>

            <!-- FIELDS section settings -->
            <template v-else-if="evtSelectedFormSection === 'fields'">

              <!-- ── FIELD EDITOR: shown when a field is selected ── -->
              <template v-if="evtEditingField">
                <!-- Header -->
                <div class="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 shrink-0">
                  <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" @click="evtSelectedFieldId = null">
                    <i class="pi pi-chevron-left text-sm" />
                  </button>
                  <p class="flex-1 text-sm font-bold text-gray-900 truncate">{{ evtEditingField.label || 'Untitled Field' }}</p>
                  <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#0e43a3] transition-colors" title="Duplicate" @click="duplicateEvtFormField(evtEditingField.id)">
                    <i class="pi pi-copy text-sm" />
                  </button>
                  <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete" @click="removeEvtFormField(evtEditingField.id); evtSelectedFieldId = null">
                    <i class="pi pi-trash text-sm" />
                  </button>
                </div>

                <!-- Tabs: Details / Advanced -->
                <div class="flex border-b border-gray-100 shrink-0">
                  <button type="button"
                    class="flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2"
                    :class="evtFieldEditorTab === 'details' ? 'text-[#1E2157] border-[#1E2157]' : 'text-gray-400 hover:text-gray-600 border-transparent'"
                    @click="evtFieldEditorTab = 'details'">Details</button>
                  <button type="button"
                    class="flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2"
                    :class="evtFieldEditorTab === 'advanced' ? 'text-[#1E2157] border-[#1E2157]' : 'text-gray-400 hover:text-gray-600 border-transparent'"
                    @click="evtFieldEditorTab = 'advanced'">Advanced</button>
                </div>

                <!-- Details tab -->
                <div v-if="evtFieldEditorTab === 'details'" class="overflow-y-auto flex-1 px-4 py-4 space-y-5">
                  <!-- Name -->
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-1.5">
                      <label class="text-sm font-semibold text-gray-800">Name <span class="text-red-400">*</span></label>
                      <i class="pi pi-info-circle text-gray-300 text-xs" title="Used in reporting and system exports" />
                    </div>
                    <input v-model="evtEditingField.system_name" type="text" placeholder="e.g. email_address" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                  </div>
                  <!-- Label -->
                  <div class="space-y-1.5">
                    <label class="text-sm font-semibold text-gray-800">Label <span class="text-red-400">*</span></label>
                    <input v-model="evtEditingField.label" type="text" placeholder="Displayed to registrants" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                  </div>
                  <!-- Required -->
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-gray-800">Required?</span>
                    <ToggleSwitch v-model="evtEditingField.is_required" />
                  </div>
                  <!-- Width -->
                  <div class="space-y-2">
                    <span class="text-sm font-semibold text-gray-800">Width</span>
                    <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                      <button type="button"
                        class="flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors border-r border-gray-200"
                        :class="evtEditingField.col_span === 1 ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'"
                        @click="evtEditingField.col_span = 1">
                        <span class="flex gap-0.5"><span class="w-3 h-3 rounded-sm bg-current opacity-80" /><span class="w-3 h-3 rounded-sm bg-current opacity-30" /></span>
                        Half
                      </button>
                      <button type="button"
                        class="flex-1 py-2 flex items-center justify-center gap-1.5 transition-colors"
                        :class="evtEditingField.col_span === 2 ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'"
                        @click="evtEditingField.col_span = 2">
                        <span class="flex gap-0.5"><span class="w-3 h-3 rounded-sm bg-current opacity-80" /><span class="w-3 h-3 rounded-sm bg-current opacity-80" /></span>
                        Full
                      </button>
                    </div>
                  </div>
                  <!-- Input Type -->
                  <div class="space-y-2">
                    <div class="flex items-center gap-1.5">
                      <label class="text-sm font-semibold text-gray-800">Input Type <span class="text-red-400">*</span></label>
                      <i class="pi pi-info-circle text-gray-300 text-xs" />
                    </div>
                    <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                      <button v-for="t in evtInputTypesFor(evtEditingField)" :key="t.value" type="button"
                        class="flex-1 py-2 transition-colors border-r border-gray-200 last:border-0"
                        :class="evtEditingField.field_type === t.value ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'"
                        @click="evtEditingField.field_type = t.value">{{ t.label }}</button>
                    </div>
                  </div>
                  <!-- Placeholder -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-800">Placeholder</span>
                      <ToggleSwitch v-model="evtEditingField.has_placeholder" />
                    </div>
                    <input v-if="evtEditingField.has_placeholder" v-model="evtEditingField.placeholder" type="text" placeholder="Enter a placeholder text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                  </div>
                  <!-- Helper Text -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-800">Helper Text</span>
                      <ToggleSwitch v-model="evtEditingField.has_helper_text" />
                    </div>
                    <input v-if="evtEditingField.has_helper_text" v-model="evtEditingField.helper_text" type="text" placeholder="Enter helper text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                  </div>
                  <!-- Min / Max Length -->
                  <template v-if="['text','email','tel','textarea','number'].includes(evtEditingField.field_type)">
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-semibold text-gray-800 flex-1">Min Length</span>
                      <input v-model="evtEditingField.min_length" type="text" placeholder="—" class="w-20 h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] text-center" />
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-semibold text-gray-800 flex-1">Max Length</span>
                      <input v-model="evtEditingField.max_length" type="text" placeholder="—" class="w-20 h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] text-center" />
                    </div>
                  </template>
                  <!-- Connected to -->
                  <div class="space-y-2">
                    <div class="flex items-center gap-1.5">
                      <label class="text-sm font-semibold text-gray-800">Connected to <span class="text-red-400">*</span></label>
                      <i class="pi pi-info-circle text-gray-300 text-xs" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <button v-for="conn in connectionOptions" :key="conn.value" type="button"
                        class="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all text-center"
                        :class="evtEditingField.connected_to === conn.value ? 'border-[#1E2157] bg-[#1E2157]' : 'border-gray-200 hover:border-gray-300 bg-white'"
                        @click="evtEditingField.connected_to = conn.value">
                        <i class="pi text-lg" :class="[conn.icon, evtEditingField.connected_to === conn.value ? 'text-white' : 'text-gray-400']" />
                        <span class="text-[10px] font-semibold leading-tight whitespace-pre-line" :class="evtEditingField.connected_to === conn.value ? 'text-white' : 'text-gray-500'">{{ conn.label }}</span>
                      </button>
                    </div>
                    <div v-if="evtEditingField.connected_to === 'profile'" class="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                      <p class="text-xs text-blue-700 flex-1 leading-relaxed">Shows on the attendee's profile, updates with each use, pulls data from the user if set.</p>
                    </div>
                    <div v-if="evtEditingField.connected_to === 'event'" class="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                      <p class="text-xs text-blue-700 flex-1 leading-relaxed">Stored against this event only. Data is specific to this registration and won't carry across events.</p>
                    </div>
                  </div>
                </div>

                <!-- Advanced tab -->
                <div v-else class="overflow-y-auto flex-1 px-4 py-4 space-y-5">
                  <!-- Visibility Conditions -->
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-800">Visibility Conditions</span>
                      <ToggleSwitch v-model="evtEditingField.has_visibility_conditions" @update:modelValue="v => { if (v) addEvtVisibilityCondition(evtEditingField) }" />
                    </div>
                    <template v-if="evtEditingField.has_visibility_conditions">
                      <div v-for="(cond, idx) in (evtEditingField.visibility_conditions ?? [])" :key="cond.id" class="space-y-2">
                        <p class="text-xs font-semibold text-gray-500">{{ idx === 0 ? 'When' : 'and when' }}</p>
                        <div class="flex items-center gap-2">
                          <select v-model="cond.field" class="flex-1 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700">
                            <option value="" disabled>Select field…</option>
                            <option v-for="f in evtConditionFieldOptions.filter(x => x.id !== evtEditingField.id && x.label !== evtEditingField.label)" :key="f.id" :value="f.label">{{ f.label }}</option>
                          </select>
                          <button type="button" class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors shrink-0" @click="removeEvtVisibilityCondition(evtEditingField, cond.id)">
                            <i class="pi pi-times text-xs" />
                          </button>
                        </div>
                        <div class="flex items-center gap-2">
                          <select v-model="cond.operator" class="w-28 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700 shrink-0">
                            <option v-for="op in evtConditionOperators" :key="op" :value="op">{{ op }}</option>
                          </select>
                          <input v-if="!['Is Empty','Is Not Empty'].includes(cond.operator)" v-model="cond.value" type="text" placeholder="Value" class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                        </div>
                      </div>
                      <button type="button" class="w-full py-2.5 rounded-xl bg-[#1E2157] hover:bg-[#161a45] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2" @click="addEvtVisibilityCondition(evtEditingField)">
                        <i class="pi pi-plus text-xs" />Add Condition
                      </button>
                    </template>
                  </div>

                  <!-- Financial Increase -->
                  <div class="space-y-3 pb-2">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-gray-800">Financial Increase</span>
                      <ToggleSwitch v-model="evtEditingField.has_financial_increase" @update:modelValue="v => { if (v) addEvtFinancialRule(evtEditingField) }" />
                    </div>
                    <template v-if="evtEditingField.has_financial_increase">
                      <div v-for="rule in (evtEditingField.financial_rules ?? [])" :key="rule.id" class="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-gray-50/60">
                        <div v-for="(cond, idx) in rule.conditions" :key="cond.id" class="space-y-2">
                          <p class="text-xs font-semibold text-gray-500">{{ idx === 0 ? 'When' : 'and when' }}</p>
                          <div class="flex items-center gap-2">
                            <select v-model="cond.field" class="flex-1 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700">
                              <option value="" disabled>Select field…</option>
                              <option v-for="f in evtConditionFieldOptions.filter(x => x.id !== evtEditingField.id && x.label !== evtEditingField.label)" :key="f.id" :value="f.label">{{ f.label }}</option>
                            </select>
                            <button type="button" class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 transition-colors shrink-0" @click="removeEvtFinancialCondition(rule, cond.id)">
                              <i class="pi pi-times text-xs" />
                            </button>
                          </div>
                          <div class="flex items-center gap-2">
                            <select v-model="cond.operator" class="w-28 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700 shrink-0">
                              <option v-for="op in evtConditionOperators" :key="op" :value="op">{{ op }}</option>
                            </select>
                            <input v-if="!['Is Empty','Is Not Empty'].includes(cond.operator)" v-model="cond.value" type="text" placeholder="Value" class="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                          </div>
                        </div>
                        <button type="button" class="text-xs text-[#0e43a3] font-semibold flex items-center gap-1 hover:underline" @click="addEvtFinancialCondition(rule)">
                          <i class="pi pi-plus text-[10px]" />and when
                        </button>
                        <div class="border-t border-gray-200 pt-2.5 space-y-2">
                          <select v-model="rule.account_code" class="w-full h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700">
                            <option value="" disabled>Account Code</option>
                            <option v-for="ac in evtAccountCodes" :key="ac" :value="ac">{{ ac }}</option>
                          </select>
                          <input v-model="rule.fee_name" type="text" placeholder="Name of fee" class="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                          <div class="flex items-center gap-2">
                            <select v-model="rule.fee_type" class="w-32 h-9 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white text-gray-700 shrink-0">
                              <option value="increase">Increase Fee</option>
                              <option value="discount">Discount</option>
                            </select>
                            <div class="flex-1 relative">
                              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                              <input v-model="rule.amount" type="number" min="0" step="0.01" placeholder="0.00" class="w-full h-9 pl-6 pr-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                            </div>
                          </div>
                        </div>
                        <button type="button" class="text-xs text-red-400 hover:text-red-600 font-medium flex items-center gap-1" @click="removeEvtFinancialRule(evtEditingField, rule.id)">
                          <i class="pi pi-trash text-[10px]" />Remove rule
                        </button>
                      </div>
                      <button type="button" class="w-full py-2.5 rounded-xl bg-[#1E2157] hover:bg-[#161a45] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2" @click="addEvtFinancialRule(evtEditingField)">
                        <i class="pi pi-dollar text-xs" />Add Financial Rule
                      </button>
                    </template>
                  </div>
                </div>
              </template>

              <!-- ── FIELD LIBRARY: shown when no field is selected ── -->
              <template v-else>
                <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
                  <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="evtSelectedFormSection = ''">
                    <i class="pi pi-chevron-left text-sm" />
                  </button>
                  <div class="flex-1">
                    <p class="text-sm font-bold text-gray-900">Form</p>
                    <p class="text-xs text-gray-400">Choose what data to collect</p>
                  </div>
                  <button type="button" class="px-3 py-1.5 bg-[#1ab4e8] hover:bg-[#16a0d0] text-white text-xs font-semibold rounded-lg transition-colors" @click="saveEvtFormSection('fields')">Save</button>
                </div>
                <div class="flex border-b border-gray-100 shrink-0">
                  <button type="button" class="flex-1 py-2.5 text-xs font-semibold transition-colors" :class="evtFormFieldsTab === 'existing' ? 'text-[#0e43a3] border-b-2 border-[#0e43a3]' : 'text-gray-400 hover:text-gray-600'" @click="evtFormFieldsTab = 'existing'; evtNewBlockType = null">Existing Fields</button>
                  <button type="button" class="flex-1 py-2.5 text-xs font-semibold transition-colors" :class="evtFormFieldsTab === 'new' ? 'text-[#0e43a3] border-b-2 border-[#0e43a3]' : 'text-gray-400 hover:text-gray-600'" @click="evtFormFieldsTab = 'new'">Create New</button>
                </div>

                <!-- Existing Fields tab -->
                <div v-if="evtFormFieldsTab === 'existing'" class="px-4 py-3 overflow-y-auto space-y-4 flex-1">
                  <p class="text-xs text-gray-400 flex items-center gap-1.5"><i class="pi pi-info-circle text-[11px]" />Drag fields onto the form or click <i class="pi pi-plus text-[10px]" /></p>
                  <div v-for="(fields, group) in { 'System Fields': systemFields, 'Person Fields': personFields, 'Previous Event Fields': previousEventFields }" :key="group">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">{{ group }}</p>
                    <div class="space-y-0.5">
                      <div
                        v-for="f in fields" :key="f"
                        :draggable="!isEvtFieldAdded(f)"
                        class="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-transparent transition-all group"
                        :class="isEvtFieldAdded(f)
                          ? 'opacity-40 cursor-default'
                          : 'hover:bg-blue-50/40 hover:border-blue-100 cursor-grab active:cursor-grabbing'"
                        @dragstart="startEvtFieldDrag($event, f)"
                        @dragend="onEvtFieldDragEnd">
                        <i class="pi pi-bars text-gray-300 text-xs" :class="{ 'opacity-0': isEvtFieldAdded(f) }" />
                        <i class="pi text-xs shrink-0" :class="[evtFieldMeta[f]?.icon ?? 'pi-minus', isEvtFieldAdded(f) ? 'text-green-400' : 'text-gray-300']" />
                        <span class="flex-1 text-sm" :class="isEvtFieldAdded(f) ? 'text-gray-500' : 'text-gray-700'">{{ f }}</span>
                        <span v-if="evtAlwaysPresentFields.includes(f)" class="text-[10px] text-gray-400">Always</span>
                        <span v-else-if="currentEvtFormFields.some(x => x.label === f)" class="text-[10px] text-green-500 font-medium">Added</span>
                        <button
                          v-else
                          type="button"
                          class="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-[#0e43a3] opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-blue-50"
                          @click="addEvtFormField(f)">
                          <i class="pi pi-plus text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Create New tab: block picker -->
                <div v-if="evtFormFieldsTab === 'new'" class="overflow-y-auto flex-1 flex flex-col">

                  <!-- Top row: Section / Image / Text / Button icon buttons -->
                  <div class="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Add a block</p>
                    <div class="grid grid-cols-4 gap-1.5">
                      <button
                        v-for="bt in [
                          { type: 'section', label: 'Section', icon: 'pi-th-large',      color: 'bg-purple-50 text-purple-500', activeColor: 'bg-purple-100 ring-purple-300' },
                          { type: 'image',   label: 'Image',   icon: 'pi-image',         color: 'bg-green-50 text-green-500',  activeColor: 'bg-green-100 ring-green-300' },
                          { type: 'text',    label: 'Text',    icon: 'pi-align-left',    color: 'bg-orange-50 text-orange-500', activeColor: 'bg-orange-100 ring-orange-300' },
                          { type: 'button',  label: 'Button',  icon: 'pi-external-link', color: 'bg-pink-50 text-pink-500',    activeColor: 'bg-pink-100 ring-pink-300' },
                        ]" :key="bt.type"
                        type="button"
                        class="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all"
                        :class="evtNewBlockType === bt.type
                          ? 'border-[#1E2157] ' + bt.activeColor + ' ring-2'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 ' + bt.color.split(' ')[0] + '/30'"
                        @click="evtNewBlockType = (evtNewBlockType === bt.type ? null : bt.type) as any">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="bt.color">
                          <i class="pi text-sm" :class="bt.icon" />
                        </div>
                        <span class="text-[10px] font-semibold text-gray-600">{{ bt.label }}</span>
                      </button>
                    </div>

                    <!-- Section sub-form -->
                    <div v-if="evtNewBlockType === 'section'" class="mt-3 space-y-2.5">
                      <input v-model="evtNewSectionDraft.label" type="text" placeholder="Section label e.g. Personal Details" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      <textarea v-model="evtNewSectionDraft.description" rows="2" placeholder="Optional description" class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors resize-none" />
                      <button type="button" class="w-full py-2 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors disabled:opacity-40" :disabled="!evtNewSectionDraft.label.trim()" @click="saveEvtNewSection">Add Section</button>
                    </div>

                    <!-- Image sub-form -->
                    <div v-else-if="evtNewBlockType === 'image'" class="mt-3 space-y-2.5">
                      <FormsImageUploadField v-model="evtNewImageDraft.src" />
                      <input v-model="evtNewImageDraft.alt" type="text" placeholder="Alt text" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                        <button v-for="a in ['left','center','right']" :key="a" type="button" class="flex-1 py-1.5 transition-colors border-r border-gray-200 last:border-0 capitalize" :class="evtNewImageDraft.align === a ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtNewImageDraft.align = a">{{ a }}</button>
                      </div>
                      <button type="button" class="w-full py-2 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtNewBlock('image')">Add Image</button>
                    </div>

                    <!-- Text sub-form -->
                    <div v-else-if="evtNewBlockType === 'text'" class="mt-3 space-y-2.5">
                      <textarea v-model="evtNewTextDraft.content" rows="3" placeholder="Enter text content..." class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors resize-none" />
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                        <button v-for="s in [['sm','Small'],['base','Normal'],['lg','Large']]" :key="s[0]" type="button" class="flex-1 py-1.5 transition-colors border-r border-gray-200 last:border-0" :class="evtNewTextDraft.size === s[0] ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtNewTextDraft.size = s[0]">{{ s[1] }}</button>
                      </div>
                      <button type="button" class="w-full py-2 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors disabled:opacity-40" :disabled="!evtNewTextDraft.content.trim()" @click="saveEvtNewBlock('text')">Add Text</button>
                    </div>

                    <!-- Button sub-form -->
                    <div v-else-if="evtNewBlockType === 'button'" class="mt-3 space-y-2.5">
                      <input v-model="evtNewButtonDraft.label" type="text" placeholder="Button label" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      <input v-model="evtNewButtonDraft.url" type="url" placeholder="https://..." class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                        <button v-for="s in [['primary','Primary'],['secondary','Secondary'],['link','Link']]" :key="s[0]" type="button" class="flex-1 py-1.5 transition-colors border-r border-gray-200 last:border-0" :class="evtNewButtonDraft.style === s[0] ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtNewButtonDraft.style = s[0]">{{ s[1] }}</button>
                      </div>
                      <button type="button" class="w-full py-2 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors disabled:opacity-40" :disabled="!evtNewButtonDraft.label.trim()" @click="saveEvtNewBlock('button')">Add Button</button>
                    </div>
                  </div>

                  <!-- Custom Field — always visible below -->
                  <div class="px-4 py-4 space-y-3 flex-1">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Custom Field</p>
                    <div class="space-y-1.5">
                      <input v-model="evtNewFieldDraft.label" type="text" placeholder="Field label e.g. Preferred Name" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                      <button
                        v-for="ft in customFieldTypes" :key="ft.value"
                        type="button"
                        class="py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors text-left"
                        :class="evtNewFieldDraft.field_type === ft.value ? 'bg-[#1E2157] text-white border-[#1E2157]' : 'border-gray-200 text-gray-600 hover:border-[#0e43a3] hover:text-[#0e43a3]'"
                        @click="evtNewFieldDraft.field_type = ft.value">
                        {{ ft.label }}
                      </button>
                    </div>
                    <input v-model="evtNewFieldDraft.placeholder" type="text" placeholder="Placeholder text (optional)" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                    <button
                      type="button"
                      class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors disabled:opacity-40"
                      :disabled="!evtNewFieldDraft.label.trim()"
                      @click="saveEvtNewField">
                      Add Field to Form
                    </button>
                  </div>

                </div>
              </template>

            </template>

            <!-- TERMS section settings -->
            <template v-else-if="evtSelectedFormSection === 'terms'">
              <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
                <button type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500" @click="evtSelectedFormSection = ''">
                  <i class="pi pi-chevron-left text-sm" />
                </button>
                <div class="flex-1">
                  <p class="text-sm font-bold text-gray-900">Terms &amp; Conditions</p>
                  <p class="text-xs text-gray-400">Manage consent checkboxes</p>
                </div>
              </div>
              <div class="px-4 py-3 space-y-1.5 overflow-y-auto flex-1">
                <!-- Club T&C — always required, locked -->
                <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 opacity-60 cursor-not-allowed">
                  <div class="w-5 h-5 rounded border-2 border-[#0e43a3] bg-[#0e43a3] shrink-0 flex items-center justify-center">
                    <i class="pi pi-check text-white text-[9px]" />
                  </div>
                  <span class="text-sm text-gray-700 flex-1">Club T&amp;C</span>
                  <span class="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md">Required</span>
                </div>
                <!-- Required terms -->
                <div v-for="tc in availableTerms.filter(t => t.required)" :key="tc.label"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div class="w-5 h-5 rounded border-2 border-[#0e43a3] bg-[#0e43a3] opacity-60 shrink-0 flex items-center justify-center cursor-not-allowed">
                    <i class="pi pi-check text-white text-[9px]" />
                  </div>
                  <span class="text-sm text-gray-700 flex-1">{{ tc.label }}</span>
                  <span class="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md">Required</span>
                </div>
                <!-- Optional terms -->
                <div v-for="tc in availableTerms.filter(t => !t.required)" :key="tc.label"
                  class="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer"
                  :class="evtFormTermsSelections.includes(tc.label) ? 'bg-blue-50/40 border-blue-100' : 'border-gray-100 hover:bg-gray-50'"
                  @click="toggleEvtTerms(tc.label)">
                  <div class="w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors"
                    :class="evtFormTermsSelections.includes(tc.label) ? 'border-[#0e43a3] bg-[#0e43a3]' : 'border-gray-300'">
                    <i v-if="evtFormTermsSelections.includes(tc.label)" class="pi pi-check text-white text-[9px]" />
                  </div>
                  <span class="text-sm text-gray-700 flex-1">{{ tc.label }}</span>
                  <button type="button" class="text-xs font-medium text-gray-400 hover:text-[#0e43a3] transition-colors px-2 py-0.5 rounded hover:bg-blue-50" @click.stop="openEvtEditTC(tc)">Edit</button>
                </div>
                <button type="button" class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-200 hover:border-[#0e43a3] hover:bg-blue-50/30 text-gray-400 hover:text-[#0e43a3] transition-all mt-1" @click="showEvtTCModal = true">
                  <i class="pi pi-plus text-xs" />
                  <span class="text-sm font-medium">Add new T&amp;C</span>
                </button>
              </div>
              <div class="px-4 pb-4 pt-3 border-t border-gray-100 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtFormSection('terms')">Save</button>
              </div>
            </template>

            <!-- PAYMENT section settings -->
            <template v-else-if="evtSelectedFormSection === 'payment'">
              <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                <button type="button" class="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-[#0e43a3] transition-colors" @click="evtSelectedFormSection = ''">
                  <i class="pi pi-chevron-left text-sm" />
                  Payment Options
                </button>
                <button type="button" class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                  <i class="pi pi-cog text-sm" />
                </button>
              </div>
              <div class="overflow-y-auto flex-1 px-4 py-3 space-y-3">

                <!-- Invoice -->
                <div class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div class="flex items-start gap-2">
                    <i class="pi pi-credit-card text-gray-400 text-sm shrink-0 mt-0.5" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700">Enable pay by <strong>Invoice</strong></p>
                      <span class="text-[10px] font-semibold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Default</span>
                    </div>
                    <ToggleSwitch v-model="evtFormPayment.invoice.enabled" class="shrink-0" />
                  </div>
                  <template v-if="evtFormPayment.invoice.enabled">
                    <div class="space-y-1.5">
                      <label class="text-xs text-gray-500">Choose bank account</label>
                      <select class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white">
                        <option value="">Choose</option>
                        <option value="main">Club Main Account</option>
                      </select>
                    </div>
                    <div v-if="evtFormPayment.invoice.bank_account" class="text-xs text-gray-600 space-y-0.5 bg-gray-50 rounded-lg px-3 py-2">
                      <p><span class="text-gray-400">Bank Account:</span> 01-2015-454848485-551</p>
                      <p><span class="text-gray-400">Bank Name:</span> Club Name</p>
                    </div>
                  </template>
                </div>

                <!-- Credit Card -->
                <div class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div class="flex items-start gap-2">
                    <i class="pi pi-credit-card text-gray-400 text-sm shrink-0 mt-0.5" />
                    <span class="flex-1 text-sm font-medium text-gray-700">Enable pay by <strong>Credit Card</strong></span>
                    <ToggleSwitch v-model="evtFormPayment.credit_card.enabled" class="shrink-0" />
                  </div>
                </div>

                <!-- Payment Plan -->
                <div class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-calendar text-gray-400 text-sm shrink-0" />
                    <span class="flex-1 text-sm font-medium text-gray-700">Enable pay by <strong>Payment Plan</strong></span>
                    <ToggleSwitch v-model="evtFormPayment.plan.enabled" />
                  </div>
                  <template v-if="evtFormPayment.plan.enabled">
                    <div class="space-y-2">
                      <p class="text-xs text-gray-500">Select all payment frequency options available to participants</p>
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                        <button type="button" class="flex-1 py-1.5 transition-colors" :class="evtFormPayment.plan.frequencies.includes('weekly') ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="toggleEvtPlanFrequency('weekly')">Weekly</button>
                        <button type="button" class="flex-1 py-1.5 border-x border-gray-200 transition-colors" :class="evtFormPayment.plan.frequencies.includes('fortnightly') ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="toggleEvtPlanFrequency('fortnightly')">Fortnightly</button>
                        <button type="button" class="flex-1 py-1.5 transition-colors" :class="evtFormPayment.plan.frequencies.includes('monthly') ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="toggleEvtPlanFrequency('monthly')">Monthly</button>
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <p class="text-xs text-gray-500">When do payments need to be paid by?</p>
                      <input v-model="evtFormPayment.plan.due_date" type="date" placeholder="Choose last date" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3]" />
                    </div>
                    <div class="space-y-1.5">
                      <p class="text-xs text-gray-500">What is the first payment amount?</p>
                      <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                        <button type="button" class="flex-1 py-1.5 transition-colors" :class="evtFormPayment.plan.first_amount === 'scheduled' ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtFormPayment.plan.first_amount = 'scheduled'">Equal payments</button>
                        <button type="button" class="flex-1 py-1.5 border-l border-gray-200 transition-colors" :class="evtFormPayment.plan.first_amount === 'custom' ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtFormPayment.plan.first_amount = 'custom'">Custom</button>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- Payment Plan Schedule (shown when plan enabled) -->
                <div v-if="evtFormPayment.plan.enabled" class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <p class="text-xs font-semibold text-gray-700">Payment Plan Schedule</p>
                  <div class="space-y-1.5">
                    <p class="text-xs text-gray-500">What is the minimum amount people must pay?</p>
                    <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                      <button type="button" class="flex-1 py-1.5 transition-colors" :class="evtFormPayment.plan.schedule_min === 'scheduled' ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtFormPayment.plan.schedule_min = 'scheduled'">Equal payments</button>
                      <button type="button" class="flex-1 py-1.5 border-l border-gray-200 transition-colors" :class="evtFormPayment.plan.schedule_min === 'custom' ? 'bg-[#1E2157] text-white' : 'text-gray-600 hover:bg-gray-50'" @click="evtFormPayment.plan.schedule_min = 'custom'">Custom</button>
                    </div>
                  </div>
                  <div v-if="evtFormPayment.plan.schedule_min === 'custom'" class="flex items-center gap-2">
                    <div class="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
                      <button type="button" class="px-3 py-1.5 bg-[#1E2157] text-white">Scheduled</button>
                      <button type="button" class="px-3 py-1.5 border-l border-gray-200 text-gray-600 hover:bg-gray-50">Custom</button>
                    </div>
                    <div class="flex items-center h-9 border border-gray-200 rounded-lg px-2 gap-1">
                      <span class="text-gray-400 text-xs">$</span>
                      <input v-model="evtFormPayment.plan.schedule_min_value" type="text" inputmode="decimal" placeholder="0.00" class="w-16 text-sm text-right outline-none bg-transparent" />
                    </div>
                  </div>
                </div>

                <!-- Coupon -->
                <div class="border border-gray-200 rounded-xl p-3 space-y-3">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-tag text-gray-400 text-sm shrink-0" />
                    <span class="flex-1 text-sm font-medium text-gray-700">Enable pay by <strong>Coupon</strong></span>
                    <ToggleSwitch v-model="evtFormPayment.coupon.enabled" />
                  </div>
                  <template v-if="evtFormPayment.coupon.enabled">
                    <div class="space-y-1.5">
                      <p class="text-xs text-gray-500">How many coupons are required to purchase this event</p>
                      <select v-model="evtFormPayment.coupon.quantity" class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white">
                        <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
                      </select>
                    </div>
                  </template>
                </div>

              </div>
              <div class="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-lg bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtFormSection('payment')">Save</button>
              </div>
            </template>

            <!-- SESSIONS section settings -->
            <template v-else-if="evtSelectedFormSection === 'sessions'">
              <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                <button type="button" class="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-[#0e43a3] transition-colors" @click="evtSelectedFormSection = ''">
                  <i class="pi pi-chevron-left text-sm" />
                  Sessions
                </button>
                <div class="flex items-center gap-2">
                  <button type="button" class="text-xs text-[#0e43a3] hover:underline transition-colors" @click="evtSelectAllFormSessions">Reset</button>
                  <span class="text-gray-300">·</span>
                  <button type="button" class="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors" @click="() => { const map: Record<string, SessionDisplayMode> = {}; sessions.value.filter((s: any) => s.display_on_form !== false).forEach((s: any) => { const sid = s.id ?? s._savedId; if (sid) map[sid] = 'hidden' }); evtFormGroupSessions[selectedFormGroupId.value] = map }">Hide all</button>
                </div>
              </div>
              <div class="overflow-y-auto flex-1 px-4 py-4 space-y-3">
                <!-- Layout selector -->
                <div class="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                  <p class="text-xs font-semibold text-gray-600">Session layout</p>
                  <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    <button type="button"
                      class="flex-1 px-2 py-1.5 flex items-center justify-center gap-1.5 transition-colors"
                      :class="(currentEvtFormDesign.sessionsLayout ?? 'list') === 'list' ? 'bg-[#0e43a3] text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="currentEvtFormDesign.sessionsLayout = 'list'">
                      <i class="pi pi-list text-[10px]" />List
                    </button>
                    <button type="button"
                      class="flex-1 px-2 py-1.5 flex items-center justify-center gap-1.5 border-l border-gray-200 transition-colors"
                      :class="currentEvtFormDesign.sessionsLayout === 'date-table' ? 'bg-[#0e43a3] text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="currentEvtFormDesign.sessionsLayout = 'date-table'">
                      <i class="pi pi-table text-[10px]" />Date Table
                    </button>
                    <button type="button"
                      class="flex-1 px-2 py-1.5 flex items-center justify-center gap-1.5 border-l border-gray-200 transition-colors"
                      :class="currentEvtFormDesign.sessionsLayout === 'group-picker' ? 'bg-[#0e43a3] text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="currentEvtFormDesign.sessionsLayout = 'group-picker'">
                      <i class="pi pi-sitemap text-[10px]" />Groups
                    </button>
                  </div>
                  <p v-if="currentEvtFormDesign.sessionsLayout === 'date-table'" class="text-[11px] text-gray-400">Sessions grouped by date (rows) and session type (columns). Best for multi-day programmes.</p>
                  <template v-if="currentEvtFormDesign.sessionsLayout === 'group-picker'">
                    <p class="text-[11px] text-gray-400">Sessions shown as a group picker with a term/category dropdown. Best for club memberships and term-based registrations.</p>
                    <div class="space-y-1">
                      <label class="text-[11px] font-semibold text-gray-500">Term / period label</label>
                      <input v-model="currentEvtFormDesign.sessionsGroupLabel" type="text" placeholder="e.g. Rec Term 2 2026"
                        class="w-full h-8 px-2.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] bg-white" />
                    </div>
                  </template>
                </div>
                <p class="text-xs text-gray-500">Control how each session appears on this form.</p>
                <div v-if="formPanelSessionsWithHeaders.length" class="border border-gray-200 rounded-xl overflow-hidden">
                  <template v-for="item in formPanelSessionsWithHeaders" :key="item.type === 'session' ? ((item as any).session.id ?? (item as any).session._savedId) : (item as any).label">
                    <!-- Date header -->
                    <div v-if="item.type === 'header'" class="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{{ (item as any).label }}</span>
                    </div>
                    <!-- Session row -->
                    <div v-else
                      class="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 transition-colors"
                      :class="getSessionMode((item as any).session.id ?? (item as any).session._savedId) === 'hidden' ? 'bg-white opacity-50' : 'bg-white'">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 truncate">{{ (item as any).session.title || 'Untitled Session' }}</p>
                      </div>
                      <div class="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-semibold shrink-0">
                        <button type="button"
                          class="px-2 py-1.5 transition-colors flex items-center gap-1"
                          :class="getSessionMode((item as any).session.id ?? (item as any).session._savedId) === 'select' ? 'bg-[#0e43a3] text-white' : 'text-gray-500 hover:bg-gray-50'"
                          @click="setSessionMode((item as any).session.id ?? (item as any).session._savedId, 'select')">
                          <i class="pi pi-check-square text-[10px]" />Select
                        </button>
                        <button type="button"
                          class="px-2 py-1.5 border-l border-gray-200 transition-colors flex items-center gap-1"
                          :class="getSessionMode((item as any).session.id ?? (item as any).session._savedId) === 'info' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'"
                          @click="setSessionMode((item as any).session.id ?? (item as any).session._savedId, 'info')">
                          <i class="pi pi-info-circle text-[10px]" />Info
                        </button>
                        <button type="button"
                          class="px-2 py-1.5 border-l border-gray-200 transition-colors flex items-center gap-1"
                          :class="getSessionMode((item as any).session.id ?? (item as any).session._savedId) === 'hidden' ? 'bg-gray-500 text-white' : 'text-gray-500 hover:bg-gray-50'"
                          @click="setSessionMode((item as any).session.id ?? (item as any).session._savedId, 'hidden')">
                          <i class="pi pi-eye-slash text-[10px]" />Hide
                        </button>
                      </div>
                    </div>
                  </template>
                </div>
                <p v-else class="text-xs text-gray-400 text-center py-4">No sessions available for this form type</p>
              </div>
              <div class="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-lg bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="saveEvtFormSection('sessions')">Save</button>
              </div>
            </template>

          </template>

        </div>

        <!-- Add form dialog -->
        <Dialog v-model:visible="showAddFormDialog" modal header="New Form" :style="{ width: '400px' }">
          <div class="space-y-4 py-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Form name</label>
              <InputText v-model="newFormName" class="w-full" placeholder="e.g. Member Registration" autofocus
                @keydown.enter="confirmAddEvtFormGroup" @keydown.esc="showAddFormDialog = false" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Form type</label>
              <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
                <button v-for="pt in [{ value: 'member', label: 'Member' }, { value: 'guest', label: 'Guest' }, { value: 'public', label: 'Public' }]"
                  :key="pt.value"
                  type="button"
                  class="flex-1 px-4 py-2 transition-colors border-r border-gray-200 last:border-r-0"
                  :class="newFormPersonType === pt.value ? 'bg-[#1E2157] text-white' : 'text-gray-500 bg-white hover:bg-gray-50'"
                  @click="newFormPersonType = pt.value">
                  {{ pt.label }}
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-1.5">Controls which session fees are shown on this form</p>
            </div>
          </div>
          <template #footer>
            <Button label="Cancel" severity="secondary" text @click="showAddFormDialog = false" />
            <Button label="Create Form" icon="pi pi-plus" @click="confirmAddEvtFormGroup" style="background:#1E2157;border-color:#1E2157" />
          </template>
        </Dialog>

        <!-- Delete form confirm dialog -->
        <Dialog :visible="formToDelete !== null" @update:visible="v => { if (!v) formToDelete = null }" modal header="Delete Form" :style="{ width: '360px' }">
          <p class="text-sm text-gray-600 py-2">Delete <strong>{{ evtFormGroupsList.find(g => g.id === formToDelete)?.name }}</strong>? This cannot be undone.</p>
          <template #footer>
            <Button label="Cancel" severity="secondary" text @click="formToDelete = null" />
            <Button label="Delete" icon="pi pi-trash" severity="danger" @click="formToDelete && removeEvtFormGroup(formToDelete)" />
          </template>
        </Dialog>

        <!-- Right panel -->
        <div class="relative flex-1 overflow-hidden bg-[#EBEFFA]"
          :style="currentEvtFormDesign.background === 'custom' && currentEvtFormDesign.backgroundImage
            ? `background-image:url('${currentEvtFormDesign.backgroundImage}');background-size:cover;background-position:center;background-repeat:no-repeat`
            : currentEvtFormDesign.background === 'colour'
              ? `background:${currentEvtFormDesign.backgroundColor}`
              : ''">

          <!-- Background fade overlay (pinned — does not scroll) -->
          <div
            v-if="currentEvtFormDesign.background === 'custom' && currentEvtFormDesign.backgroundImage && currentEvtFormDesign.backgroundOverlay > 0"
            class="absolute inset-0 pointer-events-none z-0"
            :style="`background: linear-gradient(to top, rgba(235,239,250,${currentEvtFormDesign.backgroundOverlay}) 0%, transparent 100%)`" />

          <!-- Scrollable content wrapper -->
          <div class="absolute inset-0 overflow-y-auto z-10">

          <!-- Picker: shown until a form type is chosen for this group -->
          <div v-if="!evtFormGroupModes[selectedFormGroupId]" class="flex items-center justify-center py-16 px-6">
            <div class="bg-white rounded-xl shadow-lg overflow-hidden w-full max-w-[580px]">
              <div class="bg-[#182e59] px-6 py-4 text-center">
                <h2 class="text-[17px] font-semibold text-white leading-snug">Create a registration form</h2>
              </div>
              <div class="p-5 space-y-3">
                <button type="button" class="w-full flex items-start gap-5 border border-gray-200 rounded-lg px-4 py-5 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group" @click="chooseEvtFormType('simple')">
                  <div class="shrink-0 w-10 h-10 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]"><i class="pi pi-file-edit text-2xl" /></div>
                  <div><p class="text-sm font-bold text-gray-800">Simple Registration form</p><p class="text-xs text-gray-500 mt-1">No Additional data capture required, just simple Yes / No</p></div>
                </button>
                <button type="button" class="w-full flex items-start gap-5 border border-gray-200 rounded-lg px-4 py-5 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group" @click="chooseEvtFormType('scratch')">
                  <div class="shrink-0 w-10 h-10 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]"><i class="pi pi-history text-2xl" /></div>
                  <div><p class="text-sm font-bold text-gray-800">Start from previous form</p><p class="text-xs text-gray-500 mt-1">Choose a previous used registration form</p></div>
                </button>
                <button type="button" class="w-full flex items-start gap-5 border border-gray-200 rounded-lg px-4 py-5 text-left hover:border-[#182e59] hover:bg-blue-50/30 transition-colors group" @click="chooseEvtFormType('scratch')">
                  <div class="shrink-0 w-10 h-10 flex items-center justify-center text-gray-400 group-hover:text-[#182e59]"><i class="pi pi-plus-circle text-2xl" /></div>
                  <div><p class="text-sm font-bold text-gray-800">Start from scratch</p><p class="text-xs text-gray-500 mt-1">Create the registration form from a blank canvas</p></div>
                </button>
                <button type="button" class="w-full flex items-start gap-5 border border-gray-200 rounded-lg px-4 py-5 text-left hover:border-red-200 hover:bg-red-50/30 transition-colors group" @click="chooseEvtFormType('none')">
                  <div class="shrink-0 w-10 h-10 flex items-center justify-center text-gray-400 group-hover:text-red-400"><i class="pi pi-ban text-2xl" /></div>
                  <div><p class="text-sm font-bold text-gray-800">No {{ currentEvtFormGroupName }}</p><p class="text-xs text-gray-500 mt-1">Disable registrations for this group</p></div>
                </button>
              </div>
              <div class="px-6 pb-5 flex justify-center">
              </div>
            </div>
          </div>

          <!-- No registrations state -->
          <div v-else-if="evtFormGroupModes[selectedFormGroupId] === 'none'" class="flex items-center justify-center py-16 px-6">
            <div class="bg-white rounded-xl shadow-lg p-8 text-center w-full max-w-sm">
              <i class="pi pi-ban text-5xl text-gray-200 mb-5" />
              <p class="text-base font-semibold text-gray-700">No {{ currentEvtFormGroupName }}</p>
              <p class="text-sm text-gray-400 mt-2">Registrations are disabled for this group.</p>
              <button type="button" class="mt-5 text-sm text-[#0e43a3] hover:underline transition-colors" @click="changeEvtFormType()">Change form type</button>
            </div>
          </div>

          <!-- Rich form preview (simple + scratch) -->
          <div v-else class="relative z-10 max-w-[1000px] mx-auto my-6 bg-white rounded-lg shadow-lg overflow-hidden">

            <!-- Event header: image or colour banner -->
            <div class="relative overflow-hidden" style="height:220px">
              <template v-if="currentEvtFormDesign.header === 'custom'">
                <div v-if="!currentEvtFormDesign.headerImage" class="absolute inset-0 bg-gray-200 flex flex-col items-center justify-center gap-2">
                  <i class="pi pi-image text-gray-400 text-sm" />
                  <span class="text-sm text-gray-400">Custom header image</span>
                </div>
                <img v-else :src="currentEvtFormDesign.headerImage" class="absolute inset-0 w-full h-full object-cover" />
              </template>
              <template v-else>
                <div class="absolute inset-0 bg-gradient-to-br from-[#1E2157] to-[#2e38a8]" />
                <img v-if="event?.banner_url" :src="event.banner_url" class="absolute inset-0 w-full h-full object-cover" />
              </template>
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div class="absolute bottom-5 left-6 right-6">
                <p class="text-white text-sm font-bold drop-shadow">{{ event?.title || 'Event Title' }}</p>
              </div>
            </div>

            <!-- Event details row -->
            <div class="px-6 pt-7 pb-5">
              <div class="grid grid-cols-3 gap-3">
                <div v-if="currentEvtFormDesign.icons.date" class="flex items-start gap-2">
                  <i class="pi pi-calendar text-gray-400 text-sm mt-0.5 shrink-0" />
                  <div class="text-sm"><p class="font-semibold text-gray-600">Date:</p><p class="text-gray-500">{{ event?.start_at ? new Date(event.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '19th July 2025' }}</p></div>
                </div>
                <div v-if="currentEvtFormDesign.icons.time" class="flex items-start gap-2">
                  <i class="pi pi-clock text-gray-400 text-sm mt-0.5 shrink-0" />
                  <div class="text-sm"><p class="font-semibold text-gray-600">Time:</p><p class="text-gray-500">{{ event?.start_at ? new Date(event.start_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }) : '1:34 pm' }}</p></div>
                </div>
                <div v-if="currentEvtFormDesign.icons.cost" class="flex items-start gap-2">
                  <i class="pi pi-dollar text-gray-400 text-sm mt-0.5 shrink-0" />
                  <div class="text-sm"><p class="font-semibold text-gray-600">Cost:</p><p class="text-gray-500">{{ event?.is_paid ? 'Paid' : '$25.00' }}</p></div>
                </div>
                <div v-if="currentEvtFormDesign.icons.location" class="flex items-start gap-2">
                  <i class="pi pi-map-marker text-gray-400 text-sm mt-0.5 shrink-0" />
                  <div class="text-sm"><p class="font-semibold text-gray-600">Location:</p><p class="text-gray-500">{{ event?.location || 'Bay park › Conference room 1' }}</p></div>
                </div>
                <div v-if="currentEvtFormDesign.icons.criteria" class="flex items-start gap-2">
                  <i class="pi pi-user text-gray-400 text-sm mt-0.5 shrink-0" />
                  <div class="text-sm"><p class="font-semibold text-gray-600">Invitee Restrictions:</p><p class="text-gray-500">18+ invite</p></div>
                </div>
              </div>
            </div>

            <!-- Description: event mode -->
            <div v-if="currentEvtFormDesign.description === 'event'" class="px-6 py-5">
              <p class="text-sm text-gray-600 leading-relaxed">{{ event?.description || 'Event description will appear here once added in event details.' }}</p>
            </div>

            <!-- Description: custom mode (editable inline) -->
            <div v-else-if="currentEvtFormDesign.description === 'custom'" class="px-6 py-5">
              <RichTextEditor
                v-model="currentEvtFormDesign.customDescription"
                placeholder="Enter a custom description for this registration form..." />
            </div>

            <!-- Ticket picker (shown when event has tickets enabled) -->
            <div v-if="hasTickets && ticketTypes.length" class="px-6 pt-6 pb-2">
              <h3 class="text-sm font-bold text-gray-800 mb-3">Select Tickets</h3>
              <div class="space-y-2">
                <div v-for="tt in ticketTypes.filter(t => t.is_active && !t.session_id)" :key="tt.id"
                  class="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                  <div>
                    <p class="text-sm font-semibold text-gray-800">{{ tt.name }}</p>
                    <p v-if="tt.description" class="text-xs text-gray-500 mt-0.5">{{ tt.description }}</p>
                  </div>
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="text-sm font-semibold text-gray-700">{{ tt.price === 0 ? 'Free' : `$${tt.price.toFixed(2)}` }}</span>
                    <div class="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-50 text-lg leading-none">−</button>
                      <span class="w-8 text-center text-sm font-semibold text-gray-800">0</span>
                      <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-50 text-lg leading-none">+</button>
                    </div>
                  </div>
                </div>
                <div v-if="!ticketTypes.filter(t => t.is_active && !t.session_id).length" class="text-xs text-gray-400 italic py-2">
                  No event-level ticket types active yet.
                </div>
              </div>
              <!-- Ticket subtotal -->
              <div class="mt-3 flex justify-end text-sm font-semibold text-gray-700">
                Tickets: <span class="ml-2 text-[#1E2157]">$0.00</span>
              </div>
            </div>

            <!-- Form fields: accordion preview (scratch mode only) -->
            <div v-if="evtFormGroupModes[selectedFormGroupId] === 'scratch'" class="">

              <!-- Heading -->
              <div class="px-6 pt-8 pb-5">
                <h3 class="text-xl font-bold text-gray-800">{{ currentEvtFormDesign.formHeading || 'Fill in the form to register' }}</h3>
              </div>

              <!-- Person accordions -->
              <div class="px-6 space-y-4">

                <div
                  v-for="personIdx in evtAccordionPersonCount" :key="personIdx"
                  class="border border-gray-200 rounded-xl overflow-hidden">

                  <!-- Accordion header -->
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                    :class="evtAccordionOpenIdx === personIdx - 1 ? 'bg-gray-50' : 'bg-white'"
                    @click="evtAccordionOpenIdx = evtAccordionOpenIdx === personIdx - 1 ? -1 : personIdx - 1">
                    <i class="pi text-gray-400 text-sm shrink-0" :class="evtAccordionOpenIdx === personIdx - 1 ? 'pi-chevron-up' : 'pi-chevron-down'" />
                    <div class="w-7 h-7 rounded-full bg-[#1E2157]/10 flex items-center justify-center shrink-0">
                      <i class="pi pi-user text-[#1E2157] text-sm" />
                    </div>
                    <span class="flex-1 text-sm font-semibold text-gray-800">
                      {{ (evtPersonValues[personIdx - 1]?.['_first_name'] || evtPersonValues[personIdx - 1]?.['_last_name'])
                          ? [evtPersonValues[personIdx - 1]['_first_name'], evtPersonValues[personIdx - 1]['_last_name']].filter(Boolean).join(' ')
                          : 'Person ' + personIdx }}
                    </span>
                    <span class="text-sm font-bold w-[72px] text-right tabular-nums shrink-0" :class="(evtOrderRows[personIdx - 1] ?? []).reduce((s, r) => s + r.amount, 0) === 0 ? 'text-gray-400' : 'text-[#1E2157]'">
                      ${{ (evtOrderRows[personIdx - 1] ?? []).reduce((s, r) => s + r.amount, 0).toFixed(2) }}
                    </span>
                    <button
                      v-if="evtAccordionPersonCount > 1"
                      type="button"
                      class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      @click.stop="removeEvtAccordionPerson(personIdx - 1)">
                      <i class="pi pi-times text-sm" />
                    </button>
                    <div v-else class="w-6 shrink-0" />
                  </button>

                  <!-- Accordion body -->
                  <div v-if="evtAccordionOpenIdx === personIdx - 1" class="px-4 py-5 border-t border-gray-100 space-y-4"
                    @dragover.prevent="dropZoneActive = true"
                    @dragleave="dropZoneActive = false"
                    @drop="onDropField">

                    <!-- Always-present First + Last Name side-by-side -->
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1">
                        <label class="text-sm font-semibold text-gray-600">First Name <span class="text-red-400">*</span></label>
                        <input
                          v-model="evtPersonValues[personIdx - 1]['_first_name']"
                          type="text"
                          placeholder="John"
                          class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      </div>
                      <div class="space-y-1">
                        <label class="text-sm font-semibold text-gray-600">Last Name <span class="text-red-400">*</span></label>
                        <input
                          v-model="evtPersonValues[personIdx - 1]['_last_name']"
                          type="text"
                          placeholder="Smith"
                          class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                      </div>
                    </div>

                    <!-- Dynamic fields / blocks -->
                    <div ref="fieldListEl" class="grid grid-cols-2 gap-3">
                      <template v-for="field in currentEvtFormFields" :key="field.id">
                        <!-- Section header block -->
                        <div v-if="field.field_type === 'section'"
                          class="col-span-2 pt-2 pb-1 group relative cursor-pointer rounded-lg px-2 -mx-2 hover:bg-blue-50/40 transition-colors"
                          @click="openEvtFieldEditor(field.id)">
                          <p class="text-sm font-bold text-gray-800">{{ field.label }}</p>
                          <p v-if="field.placeholder" class="text-sm text-gray-400 mt-0.5">{{ field.placeholder }}</p>
                          <i class="pi pi-pencil absolute top-2 right-2 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <!-- Image block -->
                        <div v-else-if="field.field_type === 'image'"
                          class="col-span-2 group relative cursor-pointer rounded-lg hover:ring-2 hover:ring-[#0e43a3]/30 transition-all"
                          :class="'text-' + (field.options?.[2] ?? 'center')"
                          @click="openEvtFieldEditor(field.id)">
                          <img v-if="field.options?.[0]" :src="field.options[0]" :alt="field.options[1]" class="max-w-full rounded-lg inline-block" />
                          <div v-else class="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300">
                            <i class="pi pi-image text-sm" />
                          </div>
                          <i class="pi pi-pencil absolute top-2 right-2 text-sm text-gray-400 bg-white rounded shadow px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <!-- Text block -->
                        <div v-else-if="field.field_type === 'text'"
                          class="col-span-2 group relative cursor-pointer rounded-lg px-2 -mx-2 hover:bg-blue-50/40 transition-colors"
                          @click="openEvtFieldEditor(field.id)">
                          <p class="text-gray-600 whitespace-pre-wrap" :class="'text-' + (field.options?.[1] ?? 'base')">{{ field.options?.[0] || 'Text block' }}</p>
                          <i class="pi pi-pencil absolute top-1 right-2 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <!-- Button block -->
                        <div v-else-if="field.field_type === 'button'"
                          class="col-span-2 group relative cursor-pointer"
                          @click="openEvtFieldEditor(field.id)">
                          <span
                            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors pointer-events-none"
                            :class="field.options?.[2] === 'secondary' ? 'border border-[#1E2157] text-[#1E2157]' : field.options?.[2] === 'link' ? 'text-[#0e43a3] underline' : 'bg-[#1E2157] text-white'">
                            {{ field.options?.[0] || 'Button' }}
                            <i class="pi pi-external-link text-sm" />
                          </span>
                          <i class="pi pi-pencil absolute top-1 right-0 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <!-- Regular form field -->
                        <div v-else
                          :class="field.col_span === 2 ? 'col-span-2' : ''"
                          class="space-y-1 group cursor-pointer rounded-lg px-2 -mx-2 hover:ring-2 hover:ring-[#0e43a3]/20 hover:bg-blue-50/20 transition-all"
                          @click="openEvtFieldEditor(field.id)">
                          <!-- Label: click opens editor (hidden for checkboxes — text is inline) -->
                          <div v-if="field.field_type !== 'checkbox'" class="flex items-center gap-1 cursor-pointer" @click="openEvtFieldEditor(field.id)">
                            <label class="text-sm font-semibold text-gray-600 cursor-pointer">
                              {{ field.label }}
                              <span v-if="field.is_required" class="text-red-400 ml-0.5">*</span>
                            </label>
                            <i class="pi pi-pencil text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                          </div>
                          <!-- Textarea -->
                          <textarea
                            v-if="field.field_type === 'textarea'"
                            :placeholder="field.placeholder || ''"
                            rows="3"
                            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none transition-colors resize-none pointer-events-none" />
                          <!-- Select/Dropdown -->
                          <select
                            v-else-if="field.field_type === 'select'"
                            class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none transition-colors bg-white pointer-events-none">
                            <option value="" disabled selected>{{ field.placeholder || 'Select...' }}</option>
                            <option v-for="opt in (field.options ?? [])" :key="opt" :value="opt">{{ opt }}</option>
                          </select>
                          <!-- Checkbox -->
                          <div
                            v-else-if="field.field_type === 'checkbox'"
                            class="flex items-center gap-2.5 pointer-events-none">
                            <input type="checkbox" class="w-4 h-4 rounded border-gray-300 accent-[#1E2157]" />
                            <span class="text-sm text-gray-600">{{ field.placeholder || field.label }}</span>
                          </div>
                          <!-- Date -->
                          <input
                            v-else-if="field.field_type === 'date'"
                            type="date"
                            class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none transition-colors pointer-events-none" />
                          <!-- Text/Email/Tel/Number -->
                          <input
                            v-else
                            :type="field.field_type"
                            :placeholder="field.placeholder || ''"
                            class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none transition-colors pointer-events-none" />
                        </div>
                      </template>
                    </div>

                    <!-- Drop zone: only shown when no fields added yet -->
                    <div
                      v-if="currentEvtFormFields.length === 0"
                      class="border-2 border-dashed rounded-xl py-6 text-center transition-all"
                      :class="dropZoneActive ? 'border-[#0e43a3] bg-blue-50/30' : 'border-gray-200 bg-[#fafaf9]'">
                      <i class="pi pi-arrow-circle-down mb-1.5 text-sm" :class="dropZoneActive ? 'text-[#0e43a3]' : 'text-gray-300'" />
                      <p class="text-sm font-semibold" :class="dropZoneActive ? 'text-[#0e43a3]' : 'text-gray-400'">{{ dropZoneActive ? 'Drop to add field' : 'Drag fields here' }}</p>
                      <button type="button" class="mt-1 text-sm text-[#0e43a3] hover:underline" @click="evtFormFieldsTab = 'new'; evtSelectedFormSection = 'fields'">or create a new field</button>
                    </div>

                    <!-- Sessions selection -->
                    <div v-if="sessions.some((s: any) => s.display_on_form !== false && sessionVisibleOnForm(s) && getSessionMode(s.id ?? s._savedId) !== 'hidden')" class="space-y-2 pt-6">
                      <p class="text-xl font-bold text-gray-800">{{ currentEvtFormDesign.sessionsHeading || 'Sessions' }}</p>
                      <p class="text-sm text-gray-500">Select the sessions you'd like to attend.</p>

                      <!-- DATE TABLE layout -->
                      <template v-if="currentEvtFormDesign.sessionsLayout === 'date-table' && formSessionDateTable.rows.length">
                        <div class="rounded-xl border border-gray-200 overflow-hidden bg-white">
                          <!-- Header row -->
                          <div class="grid border-b border-gray-200 bg-gray-50"
                            :style="`grid-template-columns: repeat(${formSessionDateTable.columns.length + 1}, 1fr)`">
                            <div class="px-3 py-2 text-xs font-semibold text-gray-500">Date</div>
                            <div v-for="(col, ci) in formSessionDateTable.columns" :key="col.key"
                              class="px-3 py-2 border-l border-gray-200">
                              <div class="flex items-start gap-2">
                                <!-- Select all checkbox -->
                                <button type="button"
                                  class="w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors mt-0.5"
                                  :class="isColumnFullySelected(personIdx - 1, ci)
                                    ? 'bg-[#1E2157] border-[#1E2157]'
                                    : 'border-gray-300 hover:border-[#1E2157]/50'"
                                  @click="toggleAllColumnSessions(personIdx - 1, ci)">
                                  <i v-if="isColumnFullySelected(personIdx - 1, ci)" class="pi pi-check text-white text-[8px]" />
                                </button>
                                <div>
                                  <p class="text-xs font-semibold text-gray-800">
                                    {{ col.title || col.startTime }}<span v-if="col.fee !== null" class="ml-1.5 font-normal text-[#1E2157]">${{ col.fee.toFixed(2) }}</span>
                                  </p>
                                  <p v-if="col.startTime" class="text-[11px] text-gray-400 mt-0.5">{{ col.startTime }}<template v-if="col.endTime"> – {{ col.endTime }}</template></p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <!-- Data rows -->
                          <div v-for="(row, ri) in formSessionDateTable.rows" :key="ri"
                            class="grid border-b border-gray-100 last:border-b-0"
                            :class="row.newWeek ? 'border-t-2 border-t-gray-300' : ''"
                            :style="`grid-template-columns: repeat(${formSessionDateTable.columns.length + 1}, 1fr)`">
                            <div class="px-3 py-2.5 flex items-center">
                              <p class="text-sm font-medium text-gray-800">{{ row.weekday }}, {{ row.dayMonth }}</p>
                            </div>
                            <div v-for="(s, ci) in row.cells" :key="ci"
                              class="border-l border-gray-100 px-3 py-2 flex items-center gap-2">
                              <template v-if="s">
                                <button type="button"
                                  class="w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors"
                                  :class="s.required || isSessionSelected(personIdx - 1, s.id ?? s._savedId, false)
                                    ? 'bg-[#1E2157] border-[#1E2157]'
                                    : 'border-gray-300 hover:border-[#1E2157]/50'"
                                  @click="!s.required && togglePreviewSession(personIdx - 1, s.id ?? s._savedId)">
                                  <i v-if="s.required || isSessionSelected(personIdx - 1, s.id ?? s._savedId, false)" class="pi pi-check text-white text-[8px]" />
                                </button>
                                <span v-if="!formSessionDateTable.columns[ci]?.title" class="text-xs text-gray-600 truncate">{{ s.title || 'Session' }}</span>
                              </template>
                            </div>
                          </div>
                        </div>
                      </template>

                      <!-- GROUP PICKER layout -->
                      <template v-else-if="currentEvtFormDesign.sessionsLayout === 'group-picker'">
                        <div class="space-y-3">
                          <!-- Term button + dropdown -->
                          <div class="relative">
                            <div class="flex items-center gap-3">
                              <button type="button"
                                class="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-semibold transition-colors"
                                style="background:#2494D2"
                                @click="evtGroupPickerOpen = !evtGroupPickerOpen">
                                {{ currentEvtFormDesign.sessionsGroupLabel || event?.title || 'Select term' }}
                                <i class="pi pi-chevron-down text-xs" />
                              </button>
                            </div>
                            <!-- Dropdown: two-panel flyout -->
                            <div v-if="evtGroupPickerOpen"
                              class="absolute left-0 top-full mt-1 z-10 flex bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                              @mouseleave="evtGroupPickerHover = null">
                              <!-- Left panel: group names -->
                              <div class="min-w-[200px]">
                                <button type="button"
                                  class="w-full text-left px-4 py-2.5 text-sm italic text-gray-500 hover:bg-gray-50 border-b border-gray-100"
                                  @click="evtGroupPickerOpen = false">Show All</button>
                                <div v-for="grp in formSessionGroupPicker" :key="grp.title"
                                  class="border-b border-gray-50 last:border-0"
                                  @mouseenter="evtGroupPickerHover = grp.title">
                                  <button type="button"
                                    class="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-4 transition-colors"
                                    :class="evtGroupPickerHover === grp.title ? 'bg-gray-50' : 'hover:bg-gray-50'"
                                    @click="() => {
                                      const s = grp.items[0]
                                      if (s) togglePreviewSession(personIdx - 1, s.id ?? s._savedId)
                                      if (!grp.hasChildren) evtGroupPickerOpen = false
                                    }">
                                    <span :class="grp.items.some((s: any) => isSessionSelected(personIdx - 1, s.id ?? s._savedId, false)) ? 'text-[#2494D2] font-medium' : 'text-gray-800'">
                                      {{ grp.title }}
                                    </span>
                                    <i v-if="grp.hasChildren" class="pi pi-chevron-right text-xs text-gray-400 shrink-0" />
                                  </button>
                                </div>
                              </div>
                              <!-- Right panel: child dates for hovered group -->
                              <div v-if="formSessionGroupPicker.find(g => g.title === evtGroupPickerHover)?.hasChildren"
                                class="border-l border-gray-100 min-w-[160px] flex flex-col justify-center">
                                <button v-for="s in formSessionGroupPicker.find(g => g.title === evtGroupPickerHover)?.items"
                                  :key="s.id ?? s._savedId"
                                  type="button"
                                  class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                  :class="isSessionSelected(personIdx - 1, s.id ?? s._savedId, false) ? 'text-[#2494D2] font-medium' : 'text-gray-700'"
                                  @click="togglePreviewSession(personIdx - 1, s.id ?? s._savedId); evtGroupPickerOpen = false">
                                  <i v-if="isSessionSelected(personIdx - 1, s.id ?? s._savedId, false)" class="pi pi-check text-xs text-[#2494D2] shrink-0" />
                                  <span>{{ s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : s.title || evtGroupPickerHover }}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>

                      <!-- LIST layout (default) -->
                      <template v-else>
                        <!-- Info sessions -->
                        <template v-for="s in sessions.filter((s: any) => s.display_on_form !== false && sessionVisibleOnForm(s) && getSessionMode(s.id ?? s._savedId) === 'info')" :key="(s.id ?? s._savedId) + '-info'">
                          <div class="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                            <i class="pi pi-info-circle text-amber-500 text-sm shrink-0 mt-0.5" />
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-semibold text-gray-800">{{ s.title || 'Untitled Session' }}</p>
                              <p v-if="s.start_at" class="text-xs text-gray-500 mt-0.5">{{ new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }}<template v-if="s.end_at"> · {{ new Date(s.start_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}–{{ new Date(s.end_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}</template></p>
                              <div v-if="s.description" class="text-xs text-gray-500 mt-0.5" v-html="s.description" />
                            </div>
                          </div>
                        </template>

                        <!-- Selectable sessions grouped by date with clickable headers -->
                        <template v-for="item in formPanelSessionsWithHeaders.filter(i => i.type === 'header' || getSessionMode((i as any).session?.id ?? (i as any).session?._savedId) === 'select')" :key="item.type === 'header' ? (item as any).label + '-hdr' : ((item as any).session.id ?? (item as any).session._savedId) + '-sel'">
                          <!-- Date header — click to select/deselect all sessions for this date -->
                          <button v-if="item.type === 'header'" type="button"
                            class="w-full flex items-center gap-2 px-1 pt-2 pb-1 hover:opacity-75 transition-opacity"
                            @click="toggleDateSessions(personIdx - 1, (item as any).label)">
                            <div class="w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors"
                              :class="isDateFullySelected(personIdx - 1, (item as any).label) ? 'bg-[#1E2157] border-[#1E2157]' : 'border-gray-300 hover:border-[#1E2157]/50'">
                              <i v-if="isDateFullySelected(personIdx - 1, (item as any).label)" class="pi pi-check text-white text-[8px]" />
                            </div>
                            <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">{{ (item as any).label }}</span>
                          </button>
                          <!-- Session card -->
                          <template v-else>
                        <template v-for="s in [(item as any).session]" :key="(s.id ?? s._savedId) + '-sel'">
                          <button
                            type="button"
                            class="w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
                            :class="[
                              s.required
                                ? 'border-[#1E2157]/20 bg-[#1E2157]/5 cursor-default'
                                : isSessionSelected(personIdx - 1, s.id ?? s._savedId, false)
                                  ? 'border-[#1E2157]/30 bg-[#1E2157]/5 hover:bg-[#1E2157]/8'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            ]"
                            @click="!s.required && togglePreviewSession(personIdx - 1, s.id ?? s._savedId)">
                            <!-- Checkbox indicator -->
                            <div class="shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                              :class="s.required || isSessionSelected(personIdx - 1, s.id ?? s._savedId, false)
                                ? 'bg-[#1E2157] border-[#1E2157]'
                                : 'border-gray-300'">
                              <i v-if="s.required || isSessionSelected(personIdx - 1, s.id ?? s._savedId, false)" class="pi pi-check text-white text-[8px]" />
                            </div>
                            <!-- Session info -->
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 flex-wrap">
                                <p class="text-sm font-semibold text-gray-800">{{ s.title || 'Untitled Session' }}</p>
                                <span v-if="s.required" class="text-[10px] font-bold uppercase tracking-wide text-[#1E2157]/60 bg-[#1E2157]/10 px-1.5 py-0.5 rounded">Required</span>
                              </div>
                              <p v-if="s.start_at" class="text-xs text-gray-500 mt-0.5">{{ new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }}<template v-if="s.end_at"> · {{ new Date(s.start_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}–{{ new Date(s.end_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }}</template></p>
                              <div v-if="s.description" class="text-xs text-gray-500 mt-0.5 line-clamp-1" v-html="s.description" />
                            </div>
                            <!-- Price -->
                            <div class="shrink-0 text-right">
                              <template v-if="s._feesConfig?.is_charged">
                                <template v-if="s._feesConfig.all_charged_equally">
                                  <p class="text-sm font-bold text-[#1E2157]">${{ (s._feesConfig.base_fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0).toFixed(2) }}</p>
                                </template>
                                <template v-else>
                                  <template v-if="s._feesConfig.groups?.find((g: any) => g.person_type === currentFormPersonType)">
                                    <p class="text-sm font-bold text-[#1E2157]">${{ (s._feesConfig.groups.find((g: any) => g.person_type === currentFormPersonType)?.fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0).toFixed(2) }}</p>
                                  </template>
                                  <p v-else class="text-xs text-gray-400 italic">No fee set</p>
                                </template>
                              </template>
                              <p v-else class="text-xs text-gray-400">Free</p>
                            </div>
                          </button>
                        </template>
                          </template>
                          </template>
                      </template>
                    </div>

                    <!-- Per-person order summary -->
                    <div v-if="evtOrderRows[personIdx - 1]?.length" class="mt-2 pt-3 border-t border-gray-100 space-y-1">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Order Summary</p>
                      <div v-for="row in evtOrderRows[personIdx - 1]" :key="row.label" class="flex items-center text-sm">
                        <span class="flex-1 text-gray-500">{{ row.label }}</span>
                        <span class="tabular-nums w-[72px] text-right mr-9 shrink-0" :class="row.amount < 0 ? 'text-green-600 font-medium' : 'text-gray-700'">
                          {{ row.amount < 0 ? '-' : '' }}${{ Math.abs(row.amount).toFixed(2) }}
                        </span>
                      </div>
                      <div class="flex items-center pt-1.5 border-t border-gray-100 text-sm font-bold">
                        <span class="flex-1 text-gray-700">Person {{ personIdx }} total</span>
                        <span class="tabular-nums w-[72px] text-right mr-9 shrink-0 text-[#1E2157]">
                          ${{ evtOrderRows[personIdx - 1].reduce((s, r) => s + r.amount, 0).toFixed(2) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <!-- Add Another Person -->
              <div class="px-6 py-5">
                <button
                  type="button"
                  class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                  :style="`background:${currentEvtFormDesign.addPersonColor || '#0e43a3'}`"
                  @click="addEvtAccordionPerson">
                  <i class="pi pi-plus text-[10px]" />
                  Add Another Person
                </button>
              </div>

            </div>

            <!-- Terms & Conditions: interactive individual checkbox per term -->
            <div class="px-6 py-8 space-y-3">
              <h3 class="text-xl font-bold text-gray-800">Terms and Conditions</h3>
              <FormsTermsConsentBlock
                v-for="tc in evtFormTermsShown" :key="tc.label"
                :label="tc.label"
                :agree-text="tc.agreeText"
                :agreed="evtPreviewTermsAgreed.has(tc.label)"
                @update:agreed="toggleEvtPreviewAgree(tc.label)" />
            </div>

            <!-- Payment: interactive radio selection (scratch mode only — simple mode renders this below the total) -->
            <div v-if="(evtFormPayment.plan.enabled || evtFormPayment.credit_card.enabled || evtFormPayment.invoice.enabled || evtFormPayment.coupon.enabled) && evtFormGroupModes[selectedFormGroupId] !== 'simple'" class="px-6 py-8 space-y-2">
              <h3 class="text-xl font-bold text-gray-800 mb-3">Payment</h3>

              <!-- Payment Plan -->
              <FormsPaymentOptionCard
                v-if="evtFormPayment.plan.enabled"
                icon="pi-calendar"
                title="Payment Plan"
                :selected="evtPreviewPayment === 'plan'"
                @click="evtPreviewPayment = 'plan'">
                <template #header>
                  <span class="text-sm text-gray-400 font-medium">$120.00 total</span>
                </template>
                <div v-if="evtFormPayment.plan.frequencies.length > 1" class="flex items-center gap-2">
                  <label class="text-sm text-gray-500 shrink-0">Payment frequency</label>
                  <select
                    v-model="evtPreviewPlanFreq"
                    class="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#0e43a3] transition-colors cursor-pointer">
                    <option v-for="f in evtFormPayment.plan.frequencies" :key="f" :value="f">
                      {{ f === 'weekly' ? 'Weekly' : f === 'fortnightly' ? 'Fortnightly' : f === 'monthly' ? 'Monthly' : f }}
                    </option>
                  </select>
                </div>
                <div v-if="evtPreviewPlanFreq === 'weekly' || evtPreviewPlanFreq === 'fortnightly'" class="flex items-center gap-2">
                  <label class="text-sm text-gray-500 shrink-0">Payment day</label>
                  <select
                    v-model="evtPreviewPlanDay"
                    class="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#0e43a3] transition-colors cursor-pointer">
                    <option v-for="d in weekDays" :key="d" :value="d">{{ d }}</option>
                  </select>
                </div>
                <div v-else-if="evtPreviewPlanFreq === 'monthly'" class="flex items-center gap-2">
                  <label class="text-sm text-gray-500 shrink-0">Payment date</label>
                  <select
                    v-model="evtPreviewPlanDate"
                    class="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-[#0e43a3] transition-colors cursor-pointer">
                    <option v-for="n in monthDates" :key="n" :value="n">{{ ordinal(n) }} of the month</option>
                  </select>
                </div>
                <p class="text-sm text-gray-500">Your registration fee will be split into equal payments charged to your card automatically.</p>
                <div class="rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <div class="bg-gray-50 px-3 py-1.5 flex gap-2 font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                    <span class="flex-1">Payment</span><span class="w-32">Due Date</span><span class="w-16 text-right">Amount</span>
                  </div>
                  <div v-for="([label, date], i) in evtPlanScheduleRows" :key="i"
                    class="px-3 py-2 flex gap-2 border-t border-gray-100 text-gray-700" :class="i === 0 ? 'bg-blue-50/30' : ''">
                    <span class="flex-1">{{ label }}</span><span class="w-32 text-gray-500">{{ date }}</span><span class="w-16 text-right font-medium">$30.00</span>
                  </div>
                  <div class="px-3 py-2 flex gap-2 border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-700">
                    <span class="flex-1">Total</span><span class="w-32" /><span class="w-16 text-right">$120.00</span>
                  </div>
                </div>
                <p class="text-[11px] text-gray-500 font-medium pt-1">Card for automatic payments</p>
                <div class="space-y-2">
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0 text-sm">Name On Card</span><div class="flex-1 h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-id-card text-gray-300 text-sm" /><span class="text-gray-400 text-sm">John Smith</span></div></div>
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0 text-sm">Card Number</span><div class="flex-1 h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-credit-card text-gray-300 text-sm" /><span class="text-gray-400 text-sm">1234 1234 1234 1234</span></div></div>
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0 text-sm">Expiry / CVC</span><div class="flex items-center gap-2"><div class="h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-calendar text-gray-300 text-sm" /><span class="text-gray-400 text-sm">12 / 26</span></div><div class="h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-lock text-gray-300 text-sm" /><span class="text-gray-400 text-sm">999</span></div></div></div>
                </div>
                <p class="text-[11px] text-gray-400">You will receive an email reminder 3 days before each payment.</p>
              </FormsPaymentOptionCard>

              <!-- Credit Card -->
              <FormsPaymentOptionCard
                v-if="evtFormPayment.credit_card.enabled"
                icon="pi-credit-card"
                title="Pay by Credit Card"
                :selected="evtPreviewPayment === 'credit_card'"
                @click="evtPreviewPayment = 'credit_card'">
                <div class="space-y-2 text-sm">
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0">Name On Card</span><div class="flex-1 h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-id-card text-gray-300" /><span class="text-gray-400">John Smith</span></div></div>
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0">Card Number</span><div class="flex-1 h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-credit-card text-gray-300" /><span class="text-gray-400">1234 1234 1234 1234</span></div></div>
                  <div class="flex items-center gap-3"><span class="text-gray-500 w-24 shrink-0">Expiration</span><div class="flex items-center gap-2"><div class="h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-calendar text-gray-300" /><span class="text-gray-400">12 / 26</span></div><span class="text-gray-500">CVC</span><div class="h-8 border border-gray-200 rounded px-2 flex items-center gap-1.5 bg-white"><i class="pi pi-lock text-gray-300" /><span class="text-gray-400">999</span></div></div></div>
                </div>
              </FormsPaymentOptionCard>

              <!-- Invoice -->
              <FormsPaymentOptionCard
                v-if="evtFormPayment.invoice.enabled"
                icon="pi-file-edit"
                title="Pay by Invoice"
                :selected="evtPreviewPayment === 'invoice'"
                @click="evtPreviewPayment = 'invoice'">
                <p class="text-sm text-gray-500">An invoice will be emailed to you after registration. Please make a direct bank transfer using the details below.</p>
                <div class="rounded-lg border border-gray-200 bg-white text-sm divide-y divide-gray-100 overflow-hidden">
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Bank</span><span class="text-gray-700 font-medium">ANZ Bank New Zealand</span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Account Name</span><span class="text-gray-700 font-medium">City Sports Club Inc.</span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Account Number</span><span class="text-gray-700 font-medium font-mono tracking-wide">01-2015-0454848-00</span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Reference</span><span class="text-gray-700">Your full name + <span class="font-mono bg-gray-100 px-1 rounded">REG-2025-0041</span></span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Amount Due</span><span class="text-gray-700 font-semibold text-[#0e43a3]">$120.00</span></div>
                  <div class="px-3 py-2 flex gap-2"><span class="text-gray-400 w-28 shrink-0">Payment Due</span><span class="text-gray-700">17 May 2025 <span class="text-gray-400">(30 days)</span></span></div>
                </div>
                <p class="text-[11px] text-gray-400">Once payment has been made, please email <span class="text-[#0e43a3]">accounts@citysportsclub.org.nz</span> with your receipt. Your registration will be confirmed upon payment.</p>
              </FormsPaymentOptionCard>

              <!-- Coupon -->
              <FormsPaymentOptionCard
                v-if="evtFormPayment.coupon.enabled"
                icon="pi-tag"
                :title="`Pay by Coupon (${evtFormPayment.coupon.quantity} coupon${evtFormPayment.coupon.quantity !== 1 ? 's' : ''} required)`"
                :selected="evtPreviewPayment === 'coupon'"
                @click="evtPreviewPayment = 'coupon'" />
            </div>

            <!-- Accept / Decline / Maybe (simple registration mode) -->
            <div v-if="evtFormGroupModes[selectedFormGroupId] === 'simple'" class="border-t border-gray-100">

              <!-- People table -->
              <div class="px-6 pt-6">
                <div class="border border-gray-200 rounded-xl overflow-hidden">
                  <!-- Header row -->
                  <div class="grid gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    :class="evtBaseRegistrationFee > 0 ? 'grid-cols-[1fr_1fr_auto_auto]' : 'grid-cols-[1fr_1fr_auto]'">
                    <span>First Name</span>
                    <span>Last Name</span>
                    <span v-if="evtBaseRegistrationFee > 0" class="w-16 text-right">Fee</span>
                    <span class="w-6" />
                  </div>
                  <!-- Person rows -->
                  <div v-for="(person, idx) in simplePersonNames" :key="idx"
                    class="grid gap-2 items-center px-3 py-1.5 border-b border-gray-100 last:border-0"
                    :class="evtBaseRegistrationFee > 0 ? 'grid-cols-[1fr_1fr_auto_auto]' : 'grid-cols-[1fr_1fr_auto]'">
                    <input v-model="person.first" type="text" placeholder="First name"
                      class="h-8 px-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors w-full" />
                    <input v-model="person.last" type="text" placeholder="Last name"
                      class="h-8 px-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors w-full" />
                    <span v-if="evtBaseRegistrationFee > 0" class="w-16 text-right text-sm tabular-nums text-gray-700">${{ evtBaseRegistrationFee.toFixed(2) }}</span>
                    <button
                      v-if="simplePersonNames.length > 1"
                      type="button"
                      class="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      @click="simplePersonNames.splice(idx, 1); simplePersonCount--">
                      <i class="pi pi-times text-xs" />
                    </button>
                    <div v-else class="w-6" />
                  </div>
                </div>
              </div>

              <!-- Add Person button -->
              <div class="px-6 py-4">
                <button
                  type="button"
                  class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                  :style="`background:${currentEvtFormDesign.addPersonColor || '#0e43a3'}`"
                  @click="simplePersonCount++">
                  <i class="pi pi-plus text-xs" />
                  Add Another Person
                </button>
              </div>

              <!-- Discounts + Total (only shown when there is a fee) -->
              <template v-if="evtBaseRegistrationFee > 0">
                <template v-if="evtTotalDiscountSavings > 0">
                  <div class="px-6 pt-4 border-t border-gray-100 space-y-1">
                    <div v-for="disc in evtDiscountSummaryLines" :key="disc.formText"
                      class="flex items-center text-sm text-green-600">
                      <span class="flex-1 flex items-center gap-1.5"><i class="pi pi-tag text-xs" />{{ disc.formText }}</span>
                      <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0 font-medium">−${{ disc.amount.toFixed(2) }}</span>
                    </div>
                    <div class="flex items-center pt-1 border-t border-dashed border-gray-200 text-sm font-semibold text-green-700">
                      <span class="flex-1">Total savings</span>
                      <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0">−${{ evtTotalDiscountSavings.toFixed(2) }}</span>
                    </div>
                  </div>
                  <div class="px-6 pb-5 flex items-center border-t border-gray-100 pt-4">
                    <span class="flex-1 text-sm font-bold text-gray-900">Total</span>
                    <span class="tabular-nums w-[72px] text-right mr-[53px] text-sm font-bold text-[#1E2157]">${{ Math.max(0, evtBaseRegistrationFee * simplePersonCount - evtTotalDiscountSavings).toFixed(2) }}</span>
                  </div>
                </template>
                <div v-else class="px-6 pb-5 flex items-center border-t border-gray-100 pt-4">
                  <span class="flex-1 text-sm font-bold text-gray-900">Total</span>
                  <span class="tabular-nums w-[72px] text-right mr-[53px] text-sm font-bold text-[#1E2157]">${{ (evtBaseRegistrationFee * simplePersonCount).toFixed(2) }}</span>
                </div>
              </template>

              <!-- Payment options (simple mode) -->
              <div v-if="evtFormPayment.plan.enabled || evtFormPayment.credit_card.enabled || evtFormPayment.invoice.enabled || evtFormPayment.coupon.enabled" class="px-6 pb-6 space-y-2">
                <h3 class="text-sm font-bold text-gray-800 mb-3">Payment</h3>
                <FormsPaymentOptionCard v-if="evtFormPayment.plan.enabled" icon="pi-calendar" title="Payment Plan" :selected="evtPreviewPayment === 'plan'" @click="evtPreviewPayment = 'plan'" />
                <FormsPaymentOptionCard v-if="evtFormPayment.credit_card.enabled" icon="pi-credit-card" title="Pay by Credit Card" :selected="evtPreviewPayment === 'credit_card'" @click="evtPreviewPayment = 'credit_card'" />
                <FormsPaymentOptionCard v-if="evtFormPayment.invoice.enabled" icon="pi-file-edit" title="Pay by Invoice" :selected="evtPreviewPayment === 'invoice'" @click="evtPreviewPayment = 'invoice'" />
                <FormsPaymentOptionCard v-if="evtFormPayment.coupon.enabled" icon="pi-tag" :title="`Pay by Coupon (${evtFormPayment.coupon.quantity} coupon${evtFormPayment.coupon.quantity !== 1 ? 's' : ''} required)`" :selected="evtPreviewPayment === 'coupon'" @click="evtPreviewPayment = 'coupon'" />
              </div>

              <!-- Response -->
              <div class="px-6 pb-6 space-y-2">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Response</p>
                <div class="flex gap-2">
                  <button type="button"
                    class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    :class="evtPreviewResponse === 'accept' ? 'bg-[#34B66D] text-white ring-2 ring-[#34B66D] ring-offset-1' : 'bg-[#34B66D]/10 text-[#34B66D] hover:bg-[#34B66D] hover:text-white'"
                    @click="evtPreviewResponse = evtPreviewResponse === 'accept' ? null : 'accept'">Accept</button>
                  <button type="button"
                    class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    :class="evtPreviewResponse === 'decline' ? 'bg-red-500 text-white ring-2 ring-red-400 ring-offset-1' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'"
                    @click="evtPreviewResponse = evtPreviewResponse === 'decline' ? null : 'decline'">Decline</button>
                  <button type="button"
                    class="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    :class="evtPreviewResponse === 'maybe' ? 'bg-gray-500 text-white ring-2 ring-gray-400 ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-500 hover:text-white'"
                    @click="evtPreviewResponse = evtPreviewResponse === 'maybe' ? null : 'maybe'">Maybe</button>
                </div>
              </div>

            </div>

            <!-- Submit button (scratch / advanced mode) -->
            <div v-else class="px-6 py-6 border-t border-gray-100 space-y-4">
              <!-- Discount summary lines -->
              <template v-if="evtTotalDiscountSavings > 0">
                <div v-for="disc in evtDiscountSummaryLines" :key="disc.formText"
                  class="flex items-center text-sm text-green-600">
                  <span class="flex-1 flex items-center gap-1.5"><i class="pi pi-tag text-xs" />{{ disc.formText }}</span>
                  <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0 font-medium">−${{ disc.amount.toFixed(2) }}</span>
                </div>
                <div class="flex items-center pt-1 border-t border-dashed border-gray-200 text-sm font-semibold text-green-700">
                  <span class="flex-1">Total savings</span>
                  <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0">−${{ evtTotalDiscountSavings.toFixed(2) }}</span>
                </div>
                <div class="border-t border-gray-100" />
              </template>
              <div class="flex items-center">
                <span class="flex-1 text-sm font-bold text-gray-900">Total</span>
                <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0 text-sm font-bold text-[#1E2157]">${{ Math.max(0, evtOrderTotal - evtTotalDiscountSavings).toFixed(2) }}</span>
              </div>
              <button type="button" class="w-full py-3 rounded-lg bg-[#1E2157] text-white text-sm font-semibold hover:bg-[#161a45] transition-colors">Submit Registration</button>
            </div>

          </div>

          </div><!-- end scrollable wrapper -->
        </div>

        </div>

        <!-- Sticky bottom nav -->
        <div v-if="evtFormGroupModes[selectedFormGroupId] && evtFormGroupModes[selectedFormGroupId] !== 'skip'" class="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white shrink-0">
          <button type="button" class="px-5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Back</button>
          <button type="button" class="px-5 py-2 bg-[#1E2157] text-white rounded-lg text-sm font-semibold hover:bg-[#161a45] transition-colors">Next: Configure Discounts</button>
        </div>

      </div>

      <!-- DISCOUNTS TAB -->
      <div v-else-if="activeTab === 'discounts'" class="overflow-y-auto flex-1 w-full">
        <div class="mx-auto px-6 py-6 space-y-4" style="max-width:1140px">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-gray-900">Event Discounts</h2>
            <p class="text-xs text-gray-500 mt-0.5">Create rules that automatically apply savings at checkout.</p>
          </div>
          <Button icon="pi pi-plus" label="Add Discount" size="small" @click="showDiscountTemplatePicker = true; editingDiscountIdx = null" style="background:#1E2157; border-color:#1E2157" />
        </div>

        <!-- Discount table -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-left">
                <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Discount</th>
                <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conditions</th>
                <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Redeemed</th>
                <th class="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Active</th>
                <th class="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="eventDiscounts.length === 0">
                <td colspan="6" class="px-4 py-14 text-center">
                  <div class="flex flex-col items-center gap-2 text-gray-400">
                    <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-1">
                      <i class="pi pi-tag text-gray-400" />
                    </div>
                    <p class="text-sm font-medium text-gray-500">No discount rules yet</p>
                    <p class="text-xs text-gray-400">Click "Add Discount" to create your first rule.</p>
                  </div>
                </td>
              </tr>
              <tr v-for="(disc, idx) in eventDiscounts" :key="disc.id ?? idx"
                class="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors group">
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-800">{{ disc.name || '—' }}</p>
                  <p v-if="disc.form_text" class="text-xs text-gray-400 mt-0.5">{{ disc.form_text }}</p>
                </td>
                <td class="px-4 py-3 whitespace-nowrap font-semibold text-[#1E2157]">
                  {{ disc.modifier_type === 'PERCENT' ? `${disc.modifier_value}% off` : `$${disc.modifier_value} off` }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="(c, ci) in disc.conditions" :key="ci"
                      class="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
                      :class="disc.is_active ? 'bg-[#1E2157]/8 text-[#1E2157]' : 'bg-gray-100 text-gray-400'">
                      {{ conditionLabel(c) }}
                    </span>
                    <span v-if="!disc.conditions?.length" class="text-xs text-gray-400 italic">Always applied</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-center text-gray-600 tabular-nums">{{ disc.redeem_count ?? 0 }}</td>
                <td class="px-4 py-3 text-center">
                  <ToggleSwitch v-model="disc.is_active" size="small" @change="disc.id && db.from('discounts').update({ is_active: disc.is_active }).eq('id', disc.id)" />
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button icon="pi pi-pencil" text size="small" severity="secondary" @click="editDiscount(idx)" />
                    <Button icon="pi pi-trash" text size="small" severity="danger" @click="deleteDiscount(idx)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- One-discount-only setting -->
        <div class="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-3.5">
          <div>
            <p class="text-sm font-medium text-gray-700">Limit to one discount per registration</p>
            <p class="text-xs text-gray-400 mt-0.5">When multiple rules match, only the best discount is applied.</p>
          </div>
          <ToggleSwitch v-model="evtDiscountSettings.one_discount_only" />
        </div>

        <!-- Registration form preview -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <i class="pi pi-eye text-gray-400 text-xs" />
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registration form preview</h3>
          </div>
          <div class="px-5 py-4 space-y-4">
            <div v-if="eventDiscounts.length === 0" class="text-sm text-gray-400 py-2 text-center">Add discounts above to see a preview.</div>
            <template v-else>

              <!-- Order summary mockup -->
              <div class="space-y-1.5">
                <div class="rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <div class="flex justify-between px-4 py-2.5 border-b border-gray-100 text-gray-600">
                    <span>Morning session × 1</span><span class="font-medium text-gray-800">$25.00</span>
                  </div>
                  <div v-for="disc in eventDiscounts.filter(d => d.is_active)" :key="disc.name"
                    class="flex justify-between px-4 py-2.5 bg-green-50 border-b border-green-100 text-green-700 last:border-b-0">
                    <span class="flex items-center gap-1.5"><i class="pi pi-tag text-xs" />{{ disc.form_text || disc.name }}</span>
                    <span class="font-semibold">−{{ disc.modifier_type === 'PERCENT' ? `${disc.modifier_value}%` : `$${disc.modifier_value}` }}</span>
                  </div>
                  <div class="flex justify-between px-4 py-2.5 bg-gray-50 font-semibold text-gray-800 border-t border-gray-100">
                    <span>Total</span><span class="text-gray-500 font-normal text-xs self-center">calculated at checkout</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        </div>
      </div>

      <!-- TICKETS TAB -->
      <div v-else-if="activeTab === 'tickets'" class="max-w-4xl mx-auto px-6 py-6 space-y-4 overflow-y-auto flex-1">

        <!-- Header + enable toggle -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-gray-900">Tickets</h2>
            <p class="text-xs text-gray-500 mt-0.5">Sell entry tickets for this event, optionally per session.</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-600">Enable ticketing</span>
            <ToggleSwitch v-model="hasTickets" @update:modelValue="saveHasTickets" />
          </div>
        </div>

        <!-- Disabled state -->
        <div v-if="!hasTickets" class="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center gap-3 text-gray-400">
          <div class="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
            <i class="pi pi-ticket text-gray-400 text-xl" />
          </div>
          <p class="text-sm font-medium text-gray-500">Ticketing is off for this event</p>
          <p class="text-xs text-gray-400">Toggle "Enable ticketing" above to start selling tickets.</p>
        </div>

        <template v-else>

          <!-- Event-level tickets -->
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-gray-700">Event Tickets</h3>
                <p class="text-xs text-gray-400 mt-0.5">Admission to the whole event regardless of sessions.</p>
              </div>
              <Button label="Add ticket type" icon="pi pi-plus" size="small" severity="secondary" outlined
                @click="openTicketDialog(null, null)" />
            </div>

            <div v-if="!eventLevelTickets.length" class="py-10 text-center text-gray-400">
              <p class="text-sm">No event-level ticket types yet.</p>
            </div>
            <div v-else>
              <!-- Column headers -->
              <div class="grid px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                style="grid-template-columns: 1fr 90px 90px 120px 80px 60px">
                <span>Name</span><span>Price</span><span>Capacity</span><span>On sale</span><span class="text-center">Active</span><span />
              </div>
              <div v-for="(tt, idx) in eventLevelTickets" :key="tt.id"
                class="grid px-5 py-3 border-b border-gray-100 last:border-0 items-center text-sm group hover:bg-gray-50/50"
                style="grid-template-columns: 1fr 90px 90px 120px 80px 60px">
                <div>
                  <p class="font-medium text-gray-800">{{ tt.name }}</p>
                  <p v-if="tt.description" class="text-xs text-gray-400 mt-0.5">{{ tt.description }}</p>
                </div>
                <span class="text-gray-700 font-medium">{{ tt.price === 0 ? 'Free' : `$${tt.price.toFixed(2)}` }}</span>
                <span class="text-gray-600">{{ tt.capacity ?? '∞' }}</span>
                <span class="text-xs text-gray-500">{{ ticketOnSaleLabel(tt) }}</span>
                <div class="flex justify-center"><ToggleSwitch v-model="tt.is_active" size="small" @update:modelValue="saveTicketType(tt)" /></div>
                <div class="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button icon="pi pi-pencil" text size="small" severity="secondary" @click="openTicketDialog(tt, null)" />
                  <Button icon="pi pi-trash" text size="small" severity="danger" @click="deleteTicketType(tt.id)" />
                </div>
              </div>
            </div>
          </div>

          <!-- Session-level tickets -->
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
              <h3 class="text-sm font-semibold text-gray-700">Session Tickets</h3>
              <p class="text-xs text-gray-400 mt-0.5">Different ticket types per session — e.g. Morning $15, Afternoon $20.</p>
            </div>

            <div v-if="!sessions.length" class="py-8 text-center text-gray-400 text-sm">
              No sessions yet — add sessions first.
            </div>
            <template v-else>
              <div v-for="sess in sessions" :key="sess.id" class="border-b border-gray-100 last:border-0">
                <!-- Session header row -->
                <div class="flex items-center justify-between px-5 py-2.5 bg-gray-50/60">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-calendar text-gray-400 text-xs" />
                    <span class="text-sm font-medium text-gray-700">{{ sess.title }}</span>
                    <span class="text-xs text-gray-400">{{ ticketSessionDateLabel(sess) }}</span>
                  </div>
                  <Button label="Add" icon="pi pi-plus" size="small" text severity="secondary"
                    @click="openTicketDialog(null, sess.id)" />
                </div>
                <!-- Tickets for this session -->
                <div v-if="!sessionTicketMap[sess.id]?.length" class="px-5 py-3 text-xs text-gray-400 italic">
                  No ticket types for this session.
                </div>
                <div v-else>
                  <div v-for="tt in sessionTicketMap[sess.id]" :key="tt.id"
                    class="grid px-5 py-2.5 border-t border-gray-100 items-center text-sm group hover:bg-gray-50/50"
                    style="grid-template-columns: 1fr 90px 90px 120px 80px 60px">
                    <div>
                      <p class="font-medium text-gray-800">{{ tt.name }}</p>
                      <p v-if="tt.description" class="text-xs text-gray-400 mt-0.5">{{ tt.description }}</p>
                    </div>
                    <span class="text-gray-700 font-medium">{{ tt.price === 0 ? 'Free' : `$${tt.price.toFixed(2)}` }}</span>
                    <span class="text-gray-600">{{ tt.capacity ?? '∞' }}</span>
                    <span class="text-xs text-gray-500">{{ ticketOnSaleLabel(tt) }}</span>
                    <div class="flex justify-center"><ToggleSwitch v-model="tt.is_active" size="small" @update:modelValue="saveTicketType(tt)" /></div>
                    <div class="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button icon="pi pi-pencil" text size="small" severity="secondary" @click="openTicketDialog(tt, sess.id)" />
                      <Button icon="pi pi-trash" text size="small" severity="danger" @click="deleteTicketType(tt.id)" />
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Orders summary -->
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-700">Ticket Sales</h3>
              <span v-if="ticketOrders.length" class="text-xs font-semibold text-gray-500">{{ ticketOrders.length }} order{{ ticketOrders.length !== 1 ? 's' : '' }}</span>
            </div>
            <div v-if="!ticketOrders.length" class="py-10 text-center text-gray-400 text-sm">
              No ticket purchases yet.
            </div>
            <div v-else>
              <div class="grid px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                style="grid-template-columns: 1fr 1fr 80px 100px 80px 80px">
                <span>Registrant</span><span>Tickets</span><span>Total</span><span>Status</span><span>QR</span><span>Check-in</span>
              </div>
              <div v-for="order in ticketOrders" :key="order.id"
                class="grid px-5 py-3 border-b border-gray-100 last:border-0 items-center text-sm"
                style="grid-template-columns: 1fr 1fr 80px 100px 80px 80px">
                <div>
                  <p class="font-medium text-gray-800">{{ order.guest_name || order.person_name || '—' }}</p>
                  <p class="text-xs text-gray-400 mt-0.5">{{ order.guest_email }}</p>
                </div>
                <div class="flex flex-wrap gap-1">
                  <span v-for="item in order.items" :key="item.id"
                    class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {{ item.quantity }}× {{ item.ticket_type_name }}
                  </span>
                </div>
                <span class="font-medium text-gray-800">${{ order.total_amount?.toFixed(2) }}</span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0"
                    :class="order.status === 'CONFIRMED' ? 'bg-green-500' : order.status === 'CANCELLED' ? 'bg-red-400' : 'bg-amber-400'" />
                  <span class="text-xs text-gray-600 capitalize">{{ order.status?.toLowerCase() }}</span>
                </span>
                <Button icon="pi pi-qrcode" text size="small" severity="secondary" @click="showQr(order)" />
                <Button v-if="!order.checked_in_at" icon="pi pi-check" text size="small" severity="secondary"
                  @click="checkInOrder(order.id)" />
                <span v-else class="text-xs text-green-600 font-medium flex items-center gap-1">
                  <i class="pi pi-check-circle text-xs" /> In
                </span>
              </div>
            </div>
          </div>

        </template>
      </div>

      <!-- AUTOMATION TAB -->
      <div v-else-if="activeTab === 'automation'" class="max-w-2xl mx-auto px-6 py-6 space-y-5 overflow-y-auto flex-1">
        <div><h2 class="text-base font-semibold text-gray-900">Automation</h2><p class="text-sm text-gray-500 mt-0.5">Set up automated communications.</p></div>
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <div v-for="auto in automations" :key="auto.key" class="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div><p class="text-sm font-medium text-gray-700">{{ auto.label }}</p><p class="text-xs text-gray-500 mt-0.5">{{ auto.description }}</p></div>
            <ToggleSwitch v-model="evtAutomation[auto.key]" />
          </div>
        </div>
      </div>

      <!-- SESSIONS TAB -->
      <div v-else-if="activeTab === 'sessions'" class="flex flex-1 min-h-0 overflow-hidden">

        <!-- Left: session list -->
        <div class="w-[170px] md:w-48 lg:w-[340px] shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <span class="text-sm font-bold text-gray-900">Sessions</span>
            <div class="flex items-center gap-1.5">
              <Button v-if="selectedSessionIds.size > 0"
                :label="`Delete ${selectedSessionIds.size}`" icon="pi pi-trash" size="small" severity="danger" outlined
                @click="deleteSelectedSessions()" />
              <Button label="Add Session" icon="pi pi-plus" size="small" @click="e => addSessionMenu.toggle(e)" style="background:#1E2157;border-color:#1E2157" />
              <Menu ref="addSessionMenu" :model="addSessionMenuItems" :popup="true" />
            </div>
          </div>

          <!-- List -->
          <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
            <div v-if="!sessions.length" class="p-3 flex flex-col gap-2">
              <button
                class="w-full text-left rounded-xl border-2 border-dashed border-gray-200 hover:border-[#1E2157] hover:bg-[#1E2157]/5 transition-all p-4 group"
                @click="addSession">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#1E2157]/10 flex items-center justify-center shrink-0 transition-colors">
                    <i class="pi pi-calendar-plus text-gray-400 group-hover:text-[#1E2157] transition-colors" />
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-gray-700 group-hover:text-[#1E2157] transition-colors">Single Session</p>
                    <p class="text-xs text-gray-400 mt-0.5">One date and time</p>
                  </div>
                </div>
              </button>
              <button
                class="w-full text-left rounded-xl border-2 border-dashed border-gray-200 hover:border-[#1E2157] hover:bg-[#1E2157]/5 transition-all p-4 group"
                @click="showBulkSessions = true">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#1E2157]/10 flex items-center justify-center shrink-0 transition-colors">
                    <i class="pi pi-clone text-gray-400 group-hover:text-[#1E2157] transition-colors" />
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-gray-700 group-hover:text-[#1E2157] transition-colors">Bulk Sessions</p>
                    <p class="text-xs text-gray-400 mt-0.5">Repeat across a date range</p>
                  </div>
                </div>
              </button>
            </div>
            <template v-for="(session, sIdx) in sessionsSortedByDate" :key="session.id">
              <div v-if="sIdx > 0 && sessionDayKey(session) !== sessionDayKey(sessionsSortedByDate[sIdx - 1])"
                class="mx-3 my-2 border-t-2 border-gray-100" />
            <div
              class="group/item flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none"
              :class="{
                'bg-[#1E2157] text-white shadow-sm': viewingSession?.id === session.id,
                'hover:bg-gray-100': viewingSession?.id !== session.id,
              }"
              @click="openSession(session)">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <i v-if="session.is_master" class="pi pi-crown text-[9px] shrink-0"
                    :class="viewingSession?.id === session.id ? 'text-yellow-300' : 'text-yellow-500'" />
                  <i v-else-if="session.master_id" class="pi pi-link text-[9px] shrink-0"
                    :class="viewingSession?.id === session.id ? 'text-purple-300' : 'text-purple-400'" />
                  <span class="text-sm font-medium truncate"
                    :class="viewingSession?.id === session.id ? 'text-white' : 'text-gray-800'">
                    <template v-if="session.start_at">{{ new Date(session.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }} — </template>{{ session.title || 'Untitled Session' }}
                  </span>
                  <span v-if="session.session_kind === 'pre_event'"
                    class="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    :class="viewingSession?.id === session.id ? 'bg-orange-400/30 text-orange-200' : 'bg-orange-100 text-orange-600'">
                    Pre
                  </span>
                  <span v-else-if="session.session_kind === 'post_event'"
                    class="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    :class="viewingSession?.id === session.id ? 'bg-purple-400/30 text-purple-200' : 'bg-purple-100 text-purple-600'">
                    Post
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" :class="selectedSessionIds.has(session.id) ? '!opacity-100' : ''" @click.stop>
                <button type="button"
                  class="w-5 h-5 flex items-center justify-center rounded transition-colors"
                  :class="viewingSession?.id === session.id ? 'text-white/60 hover:bg-white/20' : 'text-gray-400 hover:bg-gray-200'"
                  @click="duplicateSession(sIdx)">
                  <i class="pi pi-copy text-[10px]" />
                </button>
                <button type="button"
                  class="w-5 h-5 flex items-center justify-center rounded transition-colors"
                  :class="viewingSession?.id === session.id ? 'text-white/60 hover:bg-white/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'"
                  @click="removeSession(sIdx)">
                  <i class="pi pi-trash text-[10px]" />
                </button>
                <!-- Bulk select checkbox -->
                <div class="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer"
                  :class="selectedSessionIds.has(session.id) ? 'bg-[#1E2157] border-[#1E2157]' : viewingSession?.id === session.id ? 'border-white/60 hover:border-white' : 'border-gray-300 hover:border-gray-500'"
                  @click="selectedSessionIds.has(session.id) ? selectedSessionIds.delete(session.id) : selectedSessionIds.add(session.id)">
                  <i v-if="selectedSessionIds.has(session.id)" class="pi pi-check text-white text-[8px]" />
                </div>
              </div>
            </div>
            </template>
          </div>

          <!-- Footer: auto-save status -->
          <div class="px-4 py-3 border-t border-gray-100 shrink-0 flex items-center justify-end gap-1.5 text-xs text-gray-400 h-11">
            <template v-if="sessionSaveStatus === 'saving'">
              <i class="pi pi-spin pi-spinner text-xs" />
              <span>Saving…</span>
            </template>
            <template v-else-if="sessionSaveStatus === 'saved'">
              <i class="pi pi-check text-xs text-green-500" />
              <span class="text-green-500">Saved</span>
            </template>
            <template v-else-if="sessionSaveStatus === 'error'">
              <i class="pi pi-exclamation-circle text-xs text-red-500" />
              <span class="text-red-500">Save failed</span>
            </template>
          </div>
        </div>

        <!-- Right: session detail -->
        <div class="flex-1 overflow-hidden flex flex-col">
          <!-- Empty state -->
          <div v-if="!viewingSession" class="flex-1 flex flex-col items-center justify-center text-center gap-6 bg-[#F5F8FA] px-12">
            <div>
              <i class="pi pi-calendar text-4xl text-gray-200 block mb-3" />
              <p class="text-sm font-semibold text-gray-500">No sessions yet</p>
              <p class="text-xs text-gray-400 mt-1">Choose how you'd like to add sessions to this event.</p>
            </div>
            <div class="flex flex-col gap-3 w-full max-w-xs">
              <button
                class="w-full text-left rounded-xl border-2 border-dashed border-gray-200 hover:border-[#1E2157] hover:bg-white transition-all p-4 group"
                @click="addSession">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-white group-hover:bg-[#1E2157]/10 flex items-center justify-center shrink-0 transition-colors border border-gray-200">
                    <i class="pi pi-calendar-plus text-gray-400 group-hover:text-[#1E2157] transition-colors" />
                  </div>
                  <div class="text-left">
                    <p class="text-sm font-semibold text-gray-700 group-hover:text-[#1E2157] transition-colors">Single Session</p>
                    <p class="text-xs text-gray-400 mt-0.5">One date and time</p>
                  </div>
                </div>
              </button>
              <button
                class="w-full text-left rounded-xl border-2 border-dashed border-gray-200 hover:border-[#1E2157] hover:bg-white transition-all p-4 group"
                @click="showBulkSessions = true">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-white group-hover:bg-[#1E2157]/10 flex items-center justify-center shrink-0 transition-colors border border-gray-200">
                    <i class="pi pi-clone text-gray-400 group-hover:text-[#1E2157] transition-colors" />
                  </div>
                  <div class="text-left">
                    <p class="text-sm font-semibold text-gray-700 group-hover:text-[#1E2157] transition-colors">Bulk Sessions</p>
                    <p class="text-xs text-gray-400 mt-0.5">Repeat across a date range</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Session editor -->
          <SessionEditor
            v-else
            :session="viewingSession"
            :allSessions="sessions"
            :tabs="sessionTabs"
            :event-id="id"
            :showOutsideEventDates="!!(event?.start_at && event?.end_at)"
            :eventStartDate="event?.start_at ? new Date(event.start_at) : null"
            :eventEndDate="event?.end_at ? new Date(event.end_at) : null"
            @delete="removeSession(sessions.indexOf(viewingSession))"
            @syncFromMaster="syncSessionFromMaster(viewingSession)"
            @goToMaster="masterId => { const m = sessions.find((s: any) => s.id === masterId); if (m) openSession(m) }"
            @dateChange="syncSessionDates(viewingSession)"
            @takeAttendance="(sid) => { activeTab = 'attendance'; selectAttendanceSession(sid) }"
          >
            <template #overview-extra>
              <!-- Sub-sessions -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sub-sessions</h2>
                  <Button label="Add Sub-session" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addSubSession(viewingSession)" />
                </div>
                <div v-if="viewingSession.sub_sessions?.length" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-gray-50 border-b border-gray-200">
                        <th class="w-8" />
                        <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Name</th>
                        <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Date</th>
                        <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Time</th>
                        <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Location</th>
                        <th class="w-20" />
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-for="(sub, subIdx) in viewingSession.sub_sessions" :key="sub.id"
                        class="group/sub hover:bg-gray-50 transition-colors cursor-pointer"
                        :class="{
                          'opacity-40': draggingSubKey === `${viewingSession.id}:${subIdx}`,
                          'bg-[#1E2157]/5': dragOverSubKey === `${viewingSession.id}:${subIdx}` && draggingSubKey !== `${viewingSession.id}:${subIdx}`,
                        }"
                        draggable="true"
                        @dragstart="onSubDragStart(viewingSession, subIdx)"
                        @dragover.prevent="onSubDragOver(viewingSession, subIdx)"
                        @drop.prevent="onSubDrop(viewingSession, subIdx)"
                        @dragend="onSubDragEnd"
                        @click="openSubSession(viewingSession, sub)">
                        <td class="pl-3 pr-1 py-2.5 text-gray-300 cursor-grab" @click.stop><i class="pi pi-bars text-xs" /></td>
                        <td class="px-4 py-2.5">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-medium text-gray-800 hover:text-[#1E2157]">{{ sub.title || 'Untitled' }}</span>
                            <span v-if="sub.required" class="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">Required</span>
                          </div>
                        </td>
                        <td class="px-4 py-2.5 text-sm text-gray-500">{{ sub._date ? new Date(sub._date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—' }}</td>
                        <td class="px-4 py-2.5 text-sm text-gray-500">
                          <span v-if="sub._startTime">{{ new Date(sub._startTime).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }) }}</span>
                          <span v-else>—</span>
                        </td>
                        <td class="px-4 py-2.5 text-sm text-gray-500 truncate max-w-[140px]">{{ sub.address || sub.meeting_link || '—' }}</td>
                        <td class="px-4 py-2.5 text-right" @click.stop>
                          <div class="flex items-center justify-end gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                            <Button icon="pi pi-pencil" size="small" text severity="secondary" @click="openSubSession(viewingSession, sub)" />
                            <Button icon="pi pi-trash" size="small" text severity="danger" @click="viewingSession.sub_sessions.splice(subIdx, 1)" />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="bg-white border border-gray-200 rounded-xl py-6 text-center text-sm text-gray-400">
                  No sub-sessions yet — click "Add Sub-session" to break this session into parts
                </div>
              </div>
            </template>

            <template #tab-invitees>
              <div v-if="viewingSession._inviteeModes?.includes('groups')" class="grid grid-cols-2 gap-6">
                <!-- LEFT: Group selector -->
                <div class="space-y-3">
                  <p class="text-sm font-semibold text-gray-800">Choose Invitees</p>
                  <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="sessionInviteeSearch" placeholder="Search invitees…" size="small" class="w-full" @click.stop />
                  </IconField>
                  <div v-if="!invitees.length" class="bg-white border border-gray-200 rounded-xl py-10 text-center text-sm text-gray-400">
                    <i class="pi pi-users text-3xl mb-3 block text-gray-300" />No invitees on this event yet.
                  </div>
                  <div v-else class="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <template v-for="sg in subGroups" :key="sg.id">
                      <div v-if="sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).length"
                        class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: sg.color ?? '#94a3b8' }" />
                        <span class="flex-1 text-sm font-semibold text-gray-800">{{ sg.name }}</span>
                        <span class="text-xs text-gray-400 mr-2">{{ sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).length }} people</span>
                        <Button
                          :label="sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).every(inv => (viewingSession.invitee_ids ?? []).includes(inv.id)) ? 'Added' : 'Add all'"
                          :icon="sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).every(inv => (viewingSession.invitee_ids ?? []).includes(inv.id)) ? 'pi pi-check' : 'pi pi-plus'"
                          size="small"
                          :severity="sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).every(inv => (viewingSession.invitee_ids ?? []).includes(inv.id)) ? 'success' : 'secondary'"
                          outlined
                          @click="() => { const ids = sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).map(inv => inv.id); const all = ids.every(id => (viewingSession.invitee_ids ?? []).includes(id)); viewingSession.invitee_ids = viewingSession.invitee_ids ?? []; if (all) { viewingSession.invitee_ids = viewingSession.invitee_ids.filter((id: string) => !ids.includes(id)) } else { ids.forEach((id: string) => { if (!(viewingSession.invitee_ids ?? []).includes(id)) viewingSession.invitee_ids.push(id) }) } }"
                        />
                      </div>
                    </template>
                    <div v-if="sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id]).length"
                      class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <i class="pi pi-users text-gray-400 text-xs shrink-0" />
                      <span class="flex-1 text-sm font-semibold text-gray-800">All invitees</span>
                      <span class="text-xs text-gray-400 mr-2">{{ sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id]).length }} people</span>
                      <Button
                        :label="sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id]).every(inv => (viewingSession.invitee_ids ?? []).includes(inv.id)) ? 'Added' : 'Add all'"
                        :icon="sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id]).every(inv => (viewingSession.invitee_ids ?? []).includes(inv.id)) ? 'pi pi-check' : 'pi pi-plus'"
                        size="small"
                        :severity="sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id]).every(inv => (viewingSession.invitee_ids ?? []).includes(inv.id)) ? 'success' : 'secondary'"
                        outlined
                        @click="() => { const ids = sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id]).map(inv => inv.id); const all = ids.every(id => (viewingSession.invitee_ids ?? []).includes(id)); viewingSession.invitee_ids = viewingSession.invitee_ids ?? []; if (all) { viewingSession.invitee_ids = viewingSession.invitee_ids.filter((id: string) => !ids.includes(id)) } else { ids.forEach((id: string) => { if (!(viewingSession.invitee_ids ?? []).includes(id)) viewingSession.invitee_ids.push(id) }) } }"
                      />
                    </div>
                  </div>
                </div>
                <!-- RIGHT: Selected invitees -->
                <div class="space-y-3">
                  <div class="flex items-center gap-3">
                    <div class="flex-1">
                      <h2 class="text-sm font-semibold text-gray-800">Session Invitees</h2>
                      <p class="text-xs text-gray-500 mt-0.5">{{ (viewingSession.invitee_ids ?? []).length }} people selected</p>
                    </div>
                    <Button v-if="(viewingSession.invitee_ids ?? []).length" label="Clear all" size="small" text severity="secondary" @click="viewingSession.invitee_ids = []" />
                  </div>
                  <div v-if="!(viewingSession.invitee_ids ?? []).length" class="bg-white rounded-xl border border-gray-200 py-14 text-center text-sm text-gray-400">
                    <i class="pi pi-users text-3xl mb-3 block text-gray-300" />Use the selector on the left to add people
                  </div>
                  <template v-else>
                    <div v-for="sg in subGroups" :key="sg.id"
                      v-if="invitees.filter(inv => (viewingSession.invitee_ids ?? []).includes(inv.id) && inviteeGroupMap[inv.id] === sg.id).length"
                      class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div class="flex items-center gap-2.5 px-4 py-3">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: sg.color ?? '#94a3b8' }" />
                        <span class="font-semibold text-gray-800 text-sm">{{ sg.name }}</span>
                        <span class="bg-[#2494D2] text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">{{ invitees.filter(inv => (viewingSession.invitee_ids ?? []).includes(inv.id) && inviteeGroupMap[inv.id] === sg.id).length }}</span>
                        <div class="flex-1" />
                        <Button label="Remove" icon="pi pi-times" size="small" severity="danger" outlined @click="() => { const ids = invitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).map(inv => inv.id); viewingSession.invitee_ids = (viewingSession.invitee_ids ?? []).filter((id: string) => !ids.includes(id)) }" />
                      </div>
                      <div class="px-4 pb-3 flex flex-wrap gap-2">
                        <span v-for="inv in invitees.filter(inv => (viewingSession.invitee_ids ?? []).includes(inv.id) && inviteeGroupMap[inv.id] === sg.id)" :key="inv.id"
                          class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm bg-[#1E2157] text-white cursor-pointer select-none hover:bg-[#2a2f6b] transition-colors"
                          @click="viewingSession.invitee_ids = (viewingSession.invitee_ids ?? []).filter((id: string) => id !== inv.id)">
                          {{ inv.person?.first_name }} {{ inv.person?.last_name }}<i class="pi pi-times text-xs ml-0.5 opacity-70" />
                        </span>
                      </div>
                    </div>
                    <div v-if="invitees.filter(inv => (viewingSession.invitee_ids ?? []).includes(inv.id) && !inviteeGroupMap[inv.id]).length"
                      class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div class="flex items-center gap-2.5 px-4 py-3">
                        <i class="pi pi-users text-gray-400 text-xs" />
                        <span class="font-semibold text-gray-800 text-sm">All invitees</span>
                        <span class="bg-[#2494D2] text-white text-xs font-bold px-2 py-0.5 rounded-full ml-1">{{ invitees.filter(inv => (viewingSession.invitee_ids ?? []).includes(inv.id) && !inviteeGroupMap[inv.id]).length }}</span>
                        <div class="flex-1" />
                        <Button label="Remove" icon="pi pi-times" size="small" severity="danger" outlined @click="() => { const ids = invitees.filter(inv => !inviteeGroupMap[inv.id]).map(inv => inv.id); viewingSession.invitee_ids = (viewingSession.invitee_ids ?? []).filter((id: string) => !ids.includes(id)) }" />
                      </div>
                      <div class="px-4 pb-3 flex flex-wrap gap-2">
                        <span v-for="inv in invitees.filter(inv => (viewingSession.invitee_ids ?? []).includes(inv.id) && !inviteeGroupMap[inv.id])" :key="inv.id"
                          class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm bg-[#1E2157] text-white cursor-pointer select-none hover:bg-[#2a2f6b] transition-colors"
                          @click="viewingSession.invitee_ids = (viewingSession.invitee_ids ?? []).filter((id: string) => id !== inv.id)">
                          {{ inv.person?.first_name }} {{ inv.person?.last_name }}<i class="pi pi-times text-xs ml-0.5 opacity-70" />
                        </span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>

          </SessionEditor>
        </div>
      </div>

      <!-- SETTINGS TAB -->
      <div v-else-if="activeTab === 'settings'" class="max-w-2xl mx-auto px-6 py-6 space-y-5 overflow-y-auto flex-1">
        <div><h2 class="text-base font-semibold text-gray-900">Settings &amp; Permissions</h2><p class="text-sm text-gray-500 mt-0.5">Control access, capacity, and registration windows.</p></div>

        <!-- Capacity -->
        <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-700">Capacity</h3>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.has_capacity" />
            <span class="text-sm text-gray-600">{{ editForm.has_capacity ? 'Limited capacity' : 'No capacity limit' }}</span>
          </div>
          <InputNumber v-if="editForm.has_capacity" v-model="editForm.capacity_max" placeholder="Max attendees" class="w-48" :min="1" />
          <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
            <ToggleSwitch v-model="editForm.has_waitlist" />
            <span class="text-sm text-gray-600">{{ editForm.has_waitlist ? 'Waitlist enabled' : 'No waitlist' }}</span>
          </div>
        </div>

        <!-- Visibility & Access -->
        <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-700">Visibility &amp; Access</h3>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.is_public" />
            <div><p class="text-sm font-medium text-gray-700">Public event</p><p class="text-xs text-gray-500">Visible to anyone, not just members</p></div>
          </div>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.allow_guests" />
            <div><p class="text-sm font-medium text-gray-700">Allow guests</p><p class="text-xs text-gray-500">Non-members can register</p></div>
          </div>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.is_featured" />
            <div><p class="text-sm font-medium text-gray-700">Featured event</p><p class="text-xs text-gray-500">Highlighted in the event list</p></div>
          </div>
        </div>

        <!-- Permissions -->
        <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-700">Permissions</h3>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.show_attendee_list" />
            <div><p class="text-sm font-medium text-gray-700">Show attendee list</p><p class="text-xs text-gray-500">Registered members can see who else is attending</p></div>
          </div>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.show_attendee_count" />
            <div><p class="text-sm font-medium text-gray-700">Show attendee count</p><p class="text-xs text-gray-500">Display the number of registrations publicly</p></div>
          </div>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.allow_interest" />
            <div><p class="text-sm font-medium text-gray-700">Allow expressions of interest</p><p class="text-xs text-gray-500">Members can indicate interest before registration opens</p></div>
          </div>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.hold_spot_enabled" />
            <div><p class="text-sm font-medium text-gray-700">Hold-spot registration</p><p class="text-xs text-gray-500">Allow members to hold a spot pending confirmation</p></div>
          </div>
        </div>

        <!-- Registration Window -->
        <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-700">Registration Window</h3>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="editForm.phased_registration" />
            <div><p class="text-sm font-medium text-gray-700">Phased registration</p><p class="text-xs text-gray-500">Members get early access before public registration opens</p></div>
          </div>
          <div v-if="editForm.phased_registration" class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-700">Member-only window (days)</label>
              <InputNumber v-model="editForm.member_window_days" :min="1" :max="365" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-700">Public opens at</label>
              <DatePicker v-model="editForm.public_opens_at" show-icon show-time hour-format="12" date-format="dd/mm/yy" class="w-full" placeholder="Public registration date" />
            </div>
          </div>
        </div>

        <!-- Save -->
        <div class="flex justify-end">
          <Button label="Save Changes" icon="pi pi-check" :loading="saving" @click="saveEdit" style="background:#1E2157; border-color:#1E2157" />
        </div>
      </div>

      <!-- COMMUNICATION TAB -->
      <div v-else-if="activeTab === 'communication'" class="max-w-5xl mx-auto px-6 py-6 space-y-8 overflow-y-auto flex-1">

        <!-- Header -->
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-bold text-gray-900">Send and Schedule Communication</h2>
            <p class="text-sm text-gray-500 mt-0.5">Below are a list of all communications that have been sent to your invitees</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <Button label="Create email" icon="pi pi-envelope" size="small" severity="secondary" outlined @click="showSendComms = true" />
            <Button label="Send App notifications" icon="pi pi-send" size="small" @click="showSendComms = true" style="background:#34B66D; border-color:#34B66D" />
          </div>
        </div>

        <div v-if="commsLoading" class="py-8 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>

        <template v-else>
          <!-- Sent Communications -->
          <div>
            <h3 class="text-sm font-bold text-gray-800 mb-3">Sent Communication</h3>
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 bg-gray-50">
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-32">Type</th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-48">Subject</th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-28">
                      <span class="flex items-center gap-1.5"><i class="pi pi-users text-gray-400" /> Recipients</span>
                    </th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600">Description</th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-44">
                      <span class="flex items-center gap-1.5"><i class="pi pi-calendar text-gray-400" /> Sent</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-if="!sentCommunications.length">
                    <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">No messages sent yet</td>
                  </tr>
                  <tr v-for="c in sentCommunications" :key="c.id" class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <span class="text-sm text-[#1E2157] font-medium cursor-pointer hover:underline">{{ c.channel === 'EMAIL' ? 'Email' : 'App message' }}</span>
                    </td>
                    <td class="px-4 py-3">
                      <span class="text-sm text-[#1E2157] cursor-pointer hover:underline">{{ c.subject }}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ c.recipient_count ?? '—' }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ c.body ? c.body.slice(0, 80) + (c.body.length > 80 ? '…' : '') : '—' }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ formatDateTime(c.sent_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Scheduled Communications -->
          <div>
            <h3 class="text-sm font-bold text-gray-800 mb-3">Scheduled Communication</h3>
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 bg-gray-50">
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-32">Type</th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-48">Subject</th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-28">
                      <span class="flex items-center gap-1.5"><i class="pi pi-users text-gray-400" /> Recipients</span>
                    </th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-44">
                      <span class="flex items-center gap-1.5"><i class="pi pi-calendar text-gray-400" /> Scheduled</span>
                    </th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-44">
                      <span class="flex items-center gap-1.5"><i class="pi pi-calendar text-gray-400" /> Date / Time</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-if="!scheduledCommunications.length">
                    <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">No scheduled messages</td>
                  </tr>
                  <tr v-for="c in scheduledCommunications" :key="c.id" class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <span class="text-sm text-[#1E2157] font-medium cursor-pointer hover:underline">{{ c.channel === 'EMAIL' ? 'Email' : 'App message' }}</span>
                    </td>
                    <td class="px-4 py-3">
                      <span class="text-sm text-[#1E2157] cursor-pointer hover:underline">{{ c.subject }}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700">{{ c.recipient_count ?? '—' }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ c.schedule_label ?? '—' }}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{{ formatDateTime(c.scheduled_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>

      <!-- ATTENDANCE TAB -->
      <div v-else-if="activeTab === 'attendance'" class="flex-1 min-h-0 flex overflow-hidden">

        <!-- Left: Session list (only when event has sessions) -->
        <div v-if="attendanceInSessionMode"
          class="w-[170px] md:w-48 lg:w-[260px] shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-100 shrink-0">
            <span class="text-sm font-bold text-gray-900">Sessions</span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
            <template v-for="(session, sIdx) in attendanceSessions" :key="session.id">
              <div v-if="sIdx > 0 && session.start_at && attendanceSessions[sIdx - 1].start_at &&
                new Date(session.start_at).toDateString() !== new Date(attendanceSessions[sIdx - 1].start_at).toDateString()"
                class="mx-3 my-2 border-t-2 border-gray-100" />
              <div
                class="group/item flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none"
                :class="{
                  'bg-[#1E2157] text-white shadow-sm': selectedAttendanceSessionId === session.id,
                  'hover:bg-gray-100': selectedAttendanceSessionId !== session.id,
                }"
                @click="selectAttendanceSession(session.id)">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate"
                    :class="selectedAttendanceSessionId === session.id ? 'text-white' : 'text-gray-800'">
                    <template v-if="session.start_at">{{ new Date(session.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) }} — </template>{{ session.title || 'Untitled' }}
                  </p>
                  <p class="text-xs truncate mt-0.5"
                    :class="selectedAttendanceSessionId === session.id ? 'text-white/60' : 'text-gray-400'">
                    {{ Object.values(sessionAttendanceData[session.id] ?? {}).length }}/{{ invitees.length }} present
                  </p>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Right: Attendance table -->
        <div class="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
        <div class="bg-white rounded-xl border border-gray-200 flex flex-col flex-1 overflow-hidden" :class="attendanceInSessionMode ? 'rounded-none border-0' : 'mx-6 my-6 max-w-5xl self-center w-full'">

          <!-- Toolbar (sticky) -->
          <div class="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200 shrink-0">
            <div class="flex items-center gap-3">
              <h2 class="text-base font-semibold text-gray-900">
                <template v-if="selectedAttendanceSessionId">
                  {{ attendanceSessions.find(s => s.id === selectedAttendanceSessionId)?.title || 'Attendance' }}
                </template>
                <template v-else>Attendees</template>
              </h2>
              <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="attendanceSearch" placeholder="Search members…" size="small" class="w-48" />
              </IconField>
            </div>
            <div class="flex items-center">
              <button class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" @click="openQrDialog">
                <i class="pi pi-qrcode text-lg" />
                <span class="text-[10px] font-medium">QR Code</span>
              </button>
              <button v-if="attendanceViewMode === 'sub_groups'" class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" @click="showSubGroupsDialog = true">
                <i class="pi pi-users text-lg" />
                <span class="text-[10px] font-medium">Add Subgroup</span>
              </button>
              <!-- View mode toggle -->
              <button v-for="mode in attendanceViewModes" :key="mode.value"
                class="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg transition-colors"
                :class="attendanceViewMode === mode.value ? 'text-[#1E2157] bg-[#EFF6FF]' : 'text-gray-600 hover:bg-gray-100'"
                @click="setAttendanceViewMode(mode.value)">
                <i :class="`pi ${mode.icon} text-lg`" />
                <span class="text-[10px] font-medium">{{ mode.label }}</span>
              </button>

              <button class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" @click="printAttendanceRoll">
                <i class="pi pi-print text-lg" />
                <span class="text-[10px] font-medium">Print Roll</span>
              </button>
              <button class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <i class="pi pi-table text-lg" />
                <span class="text-[10px] font-medium">Columns</span>
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="inviteesLoading" class="py-12 flex justify-center shrink-0"><i class="pi pi-spin pi-spinner text-gray-400 text-xl" /></div>

          <!-- Empty -->
          <div v-else-if="!invitees.length" class="py-14 text-center text-sm text-gray-400 shrink-0">
            <i class="pi pi-users text-3xl mb-3 block" />No invitees yet
          </div>

          <!-- Table -->
          <div v-else class="overflow-auto flex-1">
            <table class="w-full text-sm">
              <thead class="sticky top-0 z-10 bg-white">
                <tr class="border-b border-gray-200">
                  <th class="pl-3 pr-1 py-3 w-8">
                    <button v-if="attendanceViewMode !== 'all'"
                      class="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      :title="allAttendanceGroupsCollapsed ? 'Expand all groups' : 'Collapse all groups'"
                      @click="allAttendanceGroupsCollapsed ? expandAllAttendanceGroups() : collapseAllAttendanceGroups()">
                      <i class="pi pi-chevron-up text-xs transition-transform duration-200"
                        :class="allAttendanceGroupsCollapsed ? 'rotate-180' : ''" />
                    </button>
                    <i v-else class="pi pi-bars text-xs text-gray-300" />
                  </th>
                  <th class="pl-1 pr-2 py-3 w-8">
                    <Checkbox v-model="attendanceSelectAll" binary @change="toggleAttendanceSelectAll" />
                  </th>
                  <th class="py-3 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-40">
                    <button class="flex items-center gap-1 hover:text-gray-900 transition-colors" @click="toggleAttendanceSort">
                      Members
                      <i :class="`pi text-[10px] ${attendanceSort.dir === 'asc' ? 'pi-sort-up-fill text-[#1E2157]' : 'pi-sort-down-fill text-[#1E2157]'}`" />
                    </button>
                  </th>
                  <th class="py-3 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-14">Age</th>
                  <th class="py-3 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-24">Gender</th>
                  <th class="py-3 pr-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-20">Photos</th>
                  <th class="py-3 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-36">Ticket Type</th>
                  <th class="py-3 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Paid</th>
                  <th class="py-3 pr-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-20">Signed In</th>
                  <th class="py-3 pr-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-16">Out</th>
                  <th class="py-3 w-20" />
                </tr>
              </thead>

              <!-- Member group view -->
              <template v-if="attendanceViewMode === 'member_groups'">
                <tbody v-for="mg in memberGroupAttendanceSections" :key="mg.group?.id ?? '__none__'" class="divide-y divide-gray-100">
                  <tr class="border-b border-gray-200 cursor-pointer select-none"
                    :style="{ background: (mg.group?.color ?? '#94a3b8') + '18' }"
                    @click="expandedMemberGroups[mg.group?.id ?? '__none__'] = !expandedMemberGroups[mg.group?.id ?? '__none__']">
                    <td colspan="11" class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <i class="pi text-xs transition-transform" :class="expandedMemberGroups[mg.group?.id ?? '__none__'] === false ? 'pi-chevron-right' : 'pi-chevron-down'" :style="{ color: mg.group?.color ?? '#94a3b8' }" />
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: mg.group?.color ?? '#94a3b8' }" />
                        <span class="text-xs font-semibold uppercase tracking-wide" :style="{ color: mg.group?.color ?? '#6b7280' }">{{ mg.group?.name ?? 'No Group' }}</span>
                        <span class="text-xs text-gray-400">({{ mg.invitees.length }})</span>
                        <span class="ml-auto text-xs text-gray-400">
                          {{ mg.invitees.filter(inv => isAttendedForContext(inv)).length }}/{{ mg.invitees.length }} present
                        </span>
                      </div>
                    </td>
                  </tr>
                  <template v-if="expandedMemberGroups[mg.group?.id ?? '__none__'] !== false">
                    <tr v-for="inv in mg.invitees" :key="inv.id"
                      class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': isAttendedForContext(inv) }">
                      <td class="pl-3 pr-1 py-2.5 text-gray-300 cursor-grab"><i class="pi pi-bars text-xs" /></td>
                      <td class="pl-1 pr-2 py-2.5"><Checkbox v-model="attendanceSelected" :value="inv.id" /></td>
                      <td class="py-2.5 pr-3 font-medium text-gray-800">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</td>
                      <td class="py-2.5 pr-3 text-gray-500">—</td>
                      <td class="py-2.5 pr-3 text-gray-500">—</td>
                      <td class="py-2.5 pr-3 text-center text-gray-300">—</td>
                      <td class="py-2.5 pr-3 text-xs text-gray-600">{{ inv.ticket_type ?? '—' }}</td>
                      <td class="py-2.5 pr-3">
                        <span v-if="inv.paid_at" class="flex items-center gap-1.5 text-sm">
                          <i class="pi pi-check-circle text-[#1E2157]" /><span>${{ Number(inv.fee_amount ?? 0).toFixed(2) }}</span>
                        </span>
                        <i v-else class="pi pi-times-circle text-red-500" />
                      </td>
                      <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="isAttendedForContext(inv)" binary @change="toggleAttendance(inv)" /></td>
                      <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!isAttendedForContext(inv)" @change="toggleSignOut(inv)" /></td>
                      <td class="py-2.5">
                        <div class="flex items-center gap-2 text-gray-400">
                          <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                          <button class="hover:text-[#1E2157] transition-colors" v-tooltip.top="'Notes'"><i class="pi pi-comments text-sm text-[#1E2157]" /></button>
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </template>

              <!-- Flat view -->
              <tbody v-else-if="attendanceViewMode === 'all'" class="divide-y divide-gray-100">
                <tr v-for="inv in filteredSortedAttendees" :key="inv.id"
                  draggable="true" @dragstart="onDragStart($event, inv.id)"
                  class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': isAttendedForContext(inv) }">
                  <td class="pl-3 pr-1 py-2.5 text-gray-300 cursor-grab"><i class="pi pi-bars text-xs" /></td>
                  <td class="pl-1 pr-2 py-2.5"><Checkbox v-model="attendanceSelected" :value="inv.id" /></td>
                  <td class="py-2.5 pr-3 font-medium text-gray-800">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</td>
                  <td class="py-2.5 pr-3 text-gray-500">—</td>
                  <td class="py-2.5 pr-3 text-gray-500">—</td>
                  <td class="py-2.5 pr-3 text-center text-gray-300">—</td>
                  <td class="py-2.5 pr-3 text-xs text-gray-600">{{ inv.ticket_type ?? '—' }}</td>
                  <td class="py-2.5 pr-3">
                    <span v-if="inv.paid_at" class="flex items-center gap-1.5 text-sm">
                      <i class="pi pi-check-circle text-[#1E2157]" /><span>${{ Number(inv.fee_amount ?? 0).toFixed(2) }}</span>
                    </span>
                    <i v-else class="pi pi-times-circle text-red-500" />
                  </td>
                  <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="isAttendedForContext(inv)" binary @change="toggleAttendance(inv)" /></td>
                  <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!isAttendedForContext(inv)" @change="toggleSignOut(inv)" /></td>
                  <td class="py-2.5">
                    <div class="flex items-center gap-2 text-gray-400">
                      <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                      <button class="hover:text-[#1E2157] transition-colors" v-tooltip.top="'Notes'"><i class="pi pi-comments text-sm text-[#1E2157]" /></button>
                    </div>
                  </td>
                </tr>
              </tbody>

              <!-- Sub-groups view -->
              <template v-else-if="attendanceViewMode === 'sub_groups'">
                <!-- One tbody per group -->
                <tbody v-for="section in groupedInvitees.groups" :key="section.group.id"
                  @dragover.prevent
                  @drop.prevent="onDropOnGroup(section.group.id)"
                  @dragenter="dragOverGroupId = section.group.id"
                  @dragleave="dragOverGroupId = '__none__'"
                  class="divide-y divide-gray-100">
                  <tr class="border-b border-gray-200 transition-colors cursor-pointer select-none"
                    :class="dragOverGroupId === section.group.id ? 'brightness-95' : ''"
                    :style="{ background: section.group.color + '18' }"
                    @click="expandedSubGroups[section.group.id] = !expandedSubGroups[section.group.id]">
                    <td colspan="11" class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <i class="pi text-xs transition-transform" :class="expandedSubGroups[section.group.id] === false ? 'pi-chevron-right' : 'pi-chevron-down'" :style="{ color: section.group.color }" />
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: section.group.color }" />
                        <span class="text-xs font-semibold uppercase tracking-wide" :style="{ color: section.group.color }">{{ section.group.name }}</span>
                        <span class="text-xs text-gray-400">({{ section.invitees.length }})</span>
                        <span v-if="dragOverGroupId === section.group.id" class="ml-auto text-xs font-medium" :style="{ color: section.group.color }">Drop {{ draggingMultiple ? `${attendanceSelected.length} people` : '' }} here</span>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="expandedSubGroups[section.group.id] !== false" v-for="inv in section.invitees" :key="inv.id"
                    draggable="true" @dragstart="onDragStart($event, inv.id)"
                    class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': isAttendedForContext(inv) }">
                    <td class="pl-3 pr-1 py-2.5 text-gray-300 cursor-grab"><i class="pi pi-bars text-xs" /></td>
                    <td class="pl-1 pr-2 py-2.5"><Checkbox v-model="attendanceSelected" :value="inv.id" /></td>
                    <td class="py-2.5 pr-3 font-medium text-gray-800">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</td>
                    <td class="py-2.5 pr-3 text-gray-500">—</td>
                    <td class="py-2.5 pr-3 text-gray-500">—</td>
                    <td class="py-2.5 pr-3 text-center text-gray-300">—</td>
                    <td class="py-2.5 pr-3 text-xs text-gray-600">{{ inv.ticket_type ?? '—' }}</td>
                    <td class="py-2.5 pr-3">
                      <span v-if="inv.paid_at" class="flex items-center gap-1.5 text-sm">
                        <i class="pi pi-check-circle text-[#1E2157]" /><span>${{ Number(inv.fee_amount ?? 0).toFixed(2) }}</span>
                      </span>
                      <i v-else class="pi pi-times-circle text-red-500" />
                    </td>
                    <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="isAttendedForContext(inv)" binary @change="toggleAttendance(inv)" /></td>
                    <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!isAttendedForContext(inv)" @change="toggleSignOut(inv)" /></td>
                    <td class="py-2.5">
                      <div class="flex items-center gap-2 text-gray-400">
                        <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                        <button class="hover:text-[#1E2157] transition-colors" v-tooltip.top="'Notes'"><i class="pi pi-comments text-sm text-[#1E2157]" /></button>
                      </div>
                    </td>
                  </tr>
                </tbody>

                <!-- Ungrouped section -->
                <tbody
                  @dragover.prevent
                  @drop.prevent="onDropOnGroup(null)"
                  @dragenter="dragOverGroupId = 'ungrouped'"
                  @dragleave="dragOverGroupId = '__none__'"
                  class="divide-y divide-gray-100">
                  <tr class="border-b border-gray-200 transition-colors"
                    :class="dragOverGroupId === 'ungrouped' ? 'bg-blue-50' : 'bg-gray-50'">
                    <td colspan="11" class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ungrouped</span>
                        <span class="text-xs text-gray-400">({{ groupedInvitees.ungrouped.length }})</span>
                        <span v-if="dragOverGroupId === 'ungrouped'" class="ml-auto text-xs text-blue-500 font-medium">Drop {{ draggingMultiple ? `${attendanceSelected.length} people` : '' }} to ungroup</span>
                      </div>
                    </td>
                  </tr>
                  <tr v-for="inv in groupedInvitees.ungrouped" :key="inv.id"
                    draggable="true" @dragstart="onDragStart($event, inv.id)"
                    class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': isAttendedForContext(inv) }">
                    <td class="pl-3 pr-1 py-2.5 text-gray-300 cursor-grab"><i class="pi pi-bars text-xs" /></td>
                    <td class="pl-1 pr-2 py-2.5"><Checkbox v-model="attendanceSelected" :value="inv.id" /></td>
                    <td class="py-2.5 pr-3 font-medium text-gray-800">{{ inv.person?.first_name }} {{ inv.person?.last_name }}</td>
                    <td class="py-2.5 pr-3 text-gray-500">—</td>
                    <td class="py-2.5 pr-3 text-gray-500">—</td>
                    <td class="py-2.5 pr-3 text-center text-gray-300">—</td>
                    <td class="py-2.5 pr-3 text-xs text-gray-600">{{ inv.ticket_type ?? '—' }}</td>
                    <td class="py-2.5 pr-3">
                      <span v-if="inv.paid_at" class="flex items-center gap-1.5 text-sm">
                        <i class="pi pi-check-circle text-[#1E2157]" /><span>${{ Number(inv.fee_amount ?? 0).toFixed(2) }}</span>
                      </span>
                      <i v-else class="pi pi-times-circle text-red-500" />
                    </td>
                    <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="isAttendedForContext(inv)" binary @change="toggleAttendance(inv)" /></td>
                    <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!isAttendedForContext(inv)" @change="toggleSignOut(inv)" /></td>
                    <td class="py-2.5">
                      <div class="flex items-center gap-2 text-gray-400">
                        <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                        <button class="hover:text-[#1E2157] transition-colors" v-tooltip.top="'Notes'"><i class="pi pi-comments text-sm text-[#1E2157]" /></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </template>
            </table>
          </div>

          <!-- Footer -->
          <div v-if="invitees.length" class="px-4 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
            <p class="text-xs text-gray-500">
              <span class="font-semibold text-green-600">{{ attendedCount }}</span> signed in
              · <span class="font-semibold text-gray-700">{{ invitees.length }}</span> total
              <span v-if="attendanceSelected.length" class="ml-3 text-[#1E2157] font-medium">{{ attendanceSelected.length }} selected</span>
            </p>
            <div class="flex gap-2 items-center">
              <Button v-if="attendanceSelected.length" label="Mark Selected In" icon="pi pi-check" size="small" severity="success" outlined @click="markSelectedIn" />
              <Button label="Action" icon="pi pi-chevron-down" icon-pos="right" size="small"
                style="background:#1E2157; border-color:#1E2157"
                @click="e => attendanceActionMenu.toggle(e)" />
              <Menu ref="attendanceActionMenu" :model="attendanceActionMenuItems" :popup="true" />
            </div>
          </div>
        </div>
        </div><!-- right panel -->
      </div>

      <!-- Reporting tab -->
      <div v-else-if="activeTab === 'reporting'" class="max-w-4xl mx-auto px-6 py-6 space-y-5 overflow-y-auto flex-1">

        <!-- Loading state -->
        <div v-if="reportingLoading && !reportingLoaded" class="flex items-center justify-center py-20">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-300" />
        </div>

        <template v-else>
          <!-- Summary stat cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p class="text-xs text-gray-400 mb-1">Total registrations</p>
              <p class="text-2xl font-semibold text-gray-800">{{ reportingStats.total }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p class="text-xs text-gray-400 mb-1">Confirmed</p>
              <p class="text-2xl font-semibold text-green-600">{{ reportingStats.confirmed }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p class="text-xs text-gray-400 mb-1">Revenue (total)</p>
              <p class="text-2xl font-semibold text-gray-800">${{ reportingStats.totalRevenue.toFixed(2) }}</p>
              <p v-if="reportingStats.paidRevenue !== reportingStats.totalRevenue" class="text-xs text-gray-400 mt-0.5">${{ reportingStats.paidRevenue.toFixed(2) }} paid</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p class="text-xs text-gray-400 mb-1">Check-in rate</p>
              <p class="text-2xl font-semibold text-gray-800">
                <span v-if="reportingAttendanceRate() !== null">{{ reportingAttendanceRate() }}%</span>
                <span v-else class="text-gray-300">—</span>
              </p>
              <p v-if="reportingStats.checkedIn" class="text-xs text-gray-400 mt-0.5">{{ reportingStats.checkedIn }} of {{ reportingStats.confirmed }} checked in</p>
            </div>
          </div>

          <!-- Status breakdown + session enrollment side-by-side -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <!-- Registration status breakdown -->
            <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <h3 class="text-sm font-semibold text-gray-700 mb-4">Registration status</h3>
              <div v-if="!reportingStats.total" class="text-sm text-gray-400 italic">No registrations yet</div>
              <div v-else class="space-y-3">
                <div v-for="s in [
                  { label: 'Confirmed',   count: reportingStats.confirmed,  color: 'bg-green-500' },
                  { label: 'Pending',     count: reportingStats.pending,    color: 'bg-yellow-400' },
                  { label: 'Waitlisted',  count: reportingStats.waitlisted, color: 'bg-blue-400' },
                  { label: 'Cancelled',   count: reportingStats.cancelled,  color: 'bg-red-400' },
                ]" :key="s.label" class="flex items-center gap-3">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="s.color" />
                  <span class="flex-1 text-sm text-gray-600">{{ s.label }}</span>
                  <span class="text-sm font-semibold text-gray-800">{{ s.count }}</span>
                  <div class="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full" :class="s.color"
                      :style="`width:${reportingStats.total ? Math.round(s.count / reportingStats.total * 100) : 0}%`" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Session enrollment -->
            <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <h3 class="text-sm font-semibold text-gray-700 mb-4">Session enrollment</h3>
              <div v-if="!reportingSessionRows.length" class="text-sm text-gray-400 italic">No session enrolments recorded</div>
              <div v-else class="space-y-3">
                <div v-for="row in reportingSessionRows.slice(0, 8)" :key="row.title" class="flex items-center gap-3">
                  <span class="flex-1 text-sm text-gray-600 truncate">{{ row.title }}</span>
                  <span class="text-sm font-semibold text-gray-800 shrink-0">{{ row.enrolled }}<span v-if="row.capacity" class="text-gray-400 font-normal"> / {{ row.capacity }}</span></span>
                  <div class="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
                    <div class="h-full rounded-full bg-[#1E2157]"
                      :style="`width:${row.capacity ? Math.min(100, Math.round(row.enrolled / row.capacity * 100)) : 100}%`" />
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Recent registrations -->
          <div class="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">Recent registrations</h3>
            <div v-if="!reportingRecentRegistrations.length" class="text-sm text-gray-400 italic">No registrations yet</div>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="text-xs text-gray-400 border-b border-gray-100">
                  <th class="text-left pb-2 font-medium">Name / email</th>
                  <th class="text-left pb-2 font-medium">Status</th>
                  <th class="text-right pb-2 font-medium">Amount</th>
                  <th class="text-right pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="reg in reportingRecentRegistrations" :key="reg.id" class="border-b border-gray-50 last:border-0">
                  <td class="py-2 pr-3">
                    <p class="text-gray-800">{{ reg.guest_name || '—' }}</p>
                    <p v-if="reg.guest_email" class="text-xs text-gray-400">{{ reg.guest_email }}</p>
                  </td>
                  <td class="py-2 pr-3">
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                      :class="{
                        'bg-green-100 text-green-700': reg.status === 'CONFIRMED',
                        'bg-yellow-100 text-yellow-700': reg.status === 'PENDING',
                        'bg-blue-100 text-blue-700': reg.status === 'WAITLISTED',
                        'bg-red-100 text-red-700': reg.status === 'CANCELLED',
                        'bg-gray-100 text-gray-600': !['CONFIRMED','PENDING','WAITLISTED','CANCELLED'].includes(reg.status),
                      }">{{ reg.status }}</span>
                  </td>
                  <td class="py-2 pr-3 text-right text-gray-700">${{ Number(reg.total_amount ?? 0).toFixed(2) }}</td>
                  <td class="py-2 text-right text-gray-400 text-xs">{{ new Date(reg.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </template>
      </div>

      <!-- NOTES & TASKS TAB -->
      <div v-else-if="activeTab === 'notes'" class="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full space-y-6">

        <!-- Notes -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p class="text-sm font-semibold text-gray-800">Notes</p>
            <button v-if="!editingNotes" class="text-xs text-[#1E2157] hover:underline" @click="startEditNotes">Edit</button>
            <div v-else class="flex gap-2">
              <button class="text-xs text-gray-400 hover:text-gray-600" @click="cancelEditNotes">Cancel</button>
              <button class="text-xs font-semibold text-[#1E2157] hover:underline" :disabled="savingNotes" @click="saveNotes">
                {{ savingNotes ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
          <div class="px-5 py-4">
            <textarea v-if="editingNotes"
              v-model="notesText"
              rows="8"
              placeholder="Add notes about this event…"
              class="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#1E2157] resize-none transition-colors"
            />
            <div v-else-if="event?.notes" class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{{ event.notes }}</div>
            <p v-else class="text-sm text-gray-400 italic">No notes yet. Click Edit to add some.</p>
          </div>
        </div>

        <!-- Tasks -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-gray-800">Tasks</p>
              <span v-if="eventTasks.length" class="text-xs text-gray-400">({{ eventTasks.filter(t => t.done).length }}/{{ eventTasks.length }} done)</span>
            </div>
          </div>

          <!-- Task list -->
          <div v-if="eventTasks.length" class="divide-y divide-gray-50">
            <div v-for="task in eventTasks" :key="task.id"
              class="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 group transition-colors">
              <button class="mt-0.5 shrink-0" @click="toggleTask(task)">
                <span class="w-4.5 h-4.5 flex items-center justify-center">
                  <i :class="`pi text-base ${task.done ? 'pi-check-circle text-green-500' : 'pi-circle text-gray-300 group-hover:text-gray-400'}`" />
                </span>
              </button>
              <div class="flex-1 min-w-0">
                <input
                  v-if="editingTaskId === task.id"
                  v-model="editingTaskText"
                  class="w-full text-sm text-gray-800 border-0 outline-none bg-transparent p-0 focus:ring-0"
                  @keydown.enter="saveTaskEdit(task)"
                  @keydown.escape="editingTaskId = null"
                  @blur="saveTaskEdit(task)"
                  autofocus
                />
                <p v-else
                  class="text-sm cursor-text"
                  :class="task.done ? 'line-through text-gray-400' : 'text-gray-800'"
                  @click="startEditTask(task)">
                  {{ task.text }}
                </p>
                <p v-if="task.due_date" class="text-xs text-gray-400 mt-0.5">Due {{ formatTaskDate(task.due_date) }}</p>
              </div>
              <button class="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-colors shrink-0" @click="deleteTask(task.id)">
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
          </div>
          <div v-else class="px-5 py-6 text-center text-sm text-gray-400">No tasks yet</div>

          <!-- Add task input -->
          <div class="px-5 py-3 border-t border-gray-100">
            <div class="flex items-center gap-2">
              <i class="pi pi-plus text-gray-300 text-xs shrink-0" />
              <input
                v-model="newTaskText"
                placeholder="Add a task…"
                class="flex-1 text-sm text-gray-700 border-0 outline-none bg-transparent p-0 focus:ring-0 placeholder-gray-300"
                @keydown.enter="addTask"
              />
              <button v-if="newTaskText.trim()" class="text-xs font-semibold text-[#1E2157] hover:underline shrink-0" @click="addTask">Add</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Publish Confirm Dialog -->
  <Dialog v-model:visible="showPublishDialog" header="Publish event" modal style="width:460px" @show="onPublishDialogOpen">
    <div class="flex flex-col gap-4 py-2">

      <!-- Invitee count summary -->
      <div class="flex items-center gap-3 rounded-lg bg-[#F5F8FA] border border-gray-200 px-4 py-3">
        <i class="pi pi-users text-gray-400 text-base" />
        <div v-if="publishInviteeCount === null" class="text-sm text-gray-400 italic">Loading invitees…</div>
        <div v-else class="text-sm text-gray-700">
          <span class="font-semibold text-gray-900">{{ publishInviteeCount }}</span>
          {{ publishInviteeCount === 1 ? 'invitee' : 'invitees' }} on this event
        </div>
      </div>

      <!-- Publish to website -->
      <div class="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <Checkbox v-model="publishToWebsite" :binary="true" inputId="publishToWebsite" />
        <div>
          <label for="publishToWebsite" class="text-sm text-gray-700 cursor-pointer font-medium leading-snug">Publish to website</label>
          <p class="text-xs text-gray-400 mt-0.5">Make this event publicly visible on your website</p>
        </div>
      </div>

      <!-- Send invite email -->
      <div class="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <Checkbox v-model="publishSendInvite" :binary="true" inputId="publishSendInvite" />
        <div>
          <label for="publishSendInvite" class="text-sm text-gray-700 cursor-pointer font-medium leading-snug">Send invite email</label>
          <p class="text-xs text-gray-400 mt-0.5">Email all eligible invitees when published</p>
        </div>
      </div>

      <!-- Scheduled publish date -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <Checkbox v-model="publishScheduled" :binary="true" inputId="publishScheduled" />
          <label for="publishScheduled" class="text-sm text-gray-700 cursor-pointer font-medium">Schedule publish date</label>
        </div>
        <div v-if="publishScheduled" class="flex gap-2 mt-1 pl-6">
          <DatePicker v-model="publishAtDate" placeholder="Date" dateFormat="dd/mm/yy" showIcon class="flex-1" />
          <DatePicker v-model="publishAtTime" placeholder="Time" timeOnly showIcon class="w-32" />
        </div>
        <p v-if="publishScheduled" class="text-xs text-gray-400 pl-6">Event status will stay as Draft until this date and time.</p>
      </div>

    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text size="small" @click="showPublishDialog = false" />
      <Button :label="publishScheduled ? 'Schedule' : 'Publish now'" :icon="publishScheduled ? 'pi pi-clock' : 'pi pi-send'"
        size="small" :loading="publishingEvent"
        @click="confirmPublish" style="background:#34B66D;border-color:#34B66D" />
    </template>
  </Dialog>

  <!-- Assign to Sub-group Dialog -->
  <Dialog v-model:visible="showAddToSubGroupDialog" header="Assign to Sub-group" modal style="width:440px" @hide="addToSubGroupTarget = null">
    <div class="flex flex-col gap-4 py-2">

      <!-- Selected people summary -->
      <div class="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5">
        <i class="pi pi-users text-[#1E2157] text-sm" />
        <span class="text-sm font-medium text-gray-700">{{ addToSubGroupPeople.length }} {{ addToSubGroupPeople.length === 1 ? 'person' : 'people' }} selected</span>
        <div class="flex gap-1.5 ml-auto flex-wrap justify-end">
          <span v-for="inv in addToSubGroupPeople.slice(0, 4)" :key="inv.id"
            class="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-600">
            {{ inv.person?.first_name }} {{ inv.person?.last_name }}
          </span>
          <span v-if="addToSubGroupPeople.length > 4" class="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
            +{{ addToSubGroupPeople.length - 4 }} more
          </span>
        </div>
      </div>

      <!-- No sub-groups state -->
      <div v-if="!subGroups.length" class="py-4 text-center text-sm text-gray-400">
        <i class="pi pi-sitemap text-2xl text-gray-300 block mb-2" />
        No sub-groups created yet. Go to the Sub Groups button in the toolbar to create one first.
      </div>

      <!-- Group picker -->
      <div v-else class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Choose a sub-group</label>
        <div class="flex flex-col gap-2">
          <div v-for="grp in subGroups" :key="grp.id"
            class="flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors"
            :class="addToSubGroupTarget === grp.id
              ? 'border-[#1E2157] bg-[#1E2157]/5'
              : 'border-gray-200 hover:border-gray-300 bg-white'"
            @click="addToSubGroupTarget = grp.id">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: grp.color }" />
            <span class="flex-1 text-sm font-medium text-gray-700">{{ grp.name }}</span>
            <span class="text-xs text-gray-400">{{ groupedInvitees.groups.find(g => g.group.id === grp.id)?.invitees.length ?? 0 }} members</span>
            <i v-if="addToSubGroupTarget === grp.id" class="pi pi-check text-[#1E2157] text-sm" />
          </div>
        </div>
      </div>

    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showAddToSubGroupDialog = false" />
      <Button label="Assign" icon="pi pi-check" :disabled="!addToSubGroupTarget || !subGroups.length" @click="executeAddToSubGroup" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- Discount Template Picker -->
  <Dialog v-model:visible="showDiscountTemplatePicker" header="Add Discount" modal style="width:560px">
    <div class="py-1 space-y-4">
      <p class="text-sm text-gray-500">Start from a template or build your own from scratch.</p>
      <div class="grid grid-cols-2 gap-3">
        <button v-for="tpl in discountTemplates" :key="tpl.label"
          class="text-left rounded-xl border border-gray-200 hover:border-[#1E2157] hover:bg-[#1E2157]/5 transition-all px-4 py-3.5 group"
          @click="openDiscountWithTemplate(tpl.preset)">
          <div class="flex items-center gap-2.5 mb-1.5">
            <div class="w-7 h-7 rounded-lg bg-[#1E2157]/10 group-hover:bg-[#1E2157]/15 flex items-center justify-center shrink-0 transition-colors">
              <i class="pi text-[#1E2157] text-sm" :class="tpl.icon" />
            </div>
            <span class="text-sm font-semibold text-gray-800">{{ tpl.label }}</span>
          </div>
          <p class="text-xs text-gray-500 leading-relaxed">{{ tpl.description }}</p>
        </button>
      </div>
      <button class="w-full text-left rounded-xl border border-dashed border-gray-300 hover:border-gray-400 px-4 py-3 flex items-center gap-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        @click="openBlankDiscount">
        <i class="pi pi-plus-circle text-gray-400" />
        Start from scratch
      </button>
    </div>
  </Dialog>

  <!-- Discount Rule Dialog -->
  <Dialog v-model:visible="showDiscountDialog" modal style="width:860px;padding:0" :pt="{ header: { class: 'hidden' }, content: { class: 'p-0' }, footer: { class: 'hidden' } }" @hide="resetDiscountDraft">
    <div class="flex flex-col" style="max-height:88vh">

      <!-- Custom header -->
      <div class="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-[#1E2157] flex items-center justify-center shrink-0">
            <i class="pi pi-tag text-white" style="font-size:11px" />
          </div>
          <h2 class="text-sm font-semibold text-gray-800">{{ editingDiscountIdx !== null ? 'Edit Discount Rule' : 'New Discount Rule' }}</h2>
        </div>
        <button class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          @click="showDiscountDialog = false; resetDiscountDraft()">
          <i class="pi pi-times text-xs" />
        </button>
      </div>

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto">

        <!-- Names row -->
        <div class="px-5 py-4 grid grid-cols-2 gap-4 border-b border-gray-100">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name <span class="text-red-400 normal-case font-normal tracking-normal">*</span></label>
            <InputText v-model="discountDraft.name" placeholder="e.g. Family Deal" class="w-full text-sm h-9" autofocus />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Form label</label>
            <InputText v-model="discountDraft.form_text" placeholder="What registrants see on the form" class="w-full text-sm h-9" />
          </div>
        </div>

        <!-- Amount section -->
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Discount amount</p>
          <div class="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <div class="grid" style="grid-template-columns: auto 120px 1fr">
              <!-- Type toggle -->
              <div class="flex border-r border-gray-200">
                <button v-for="t in discountTypes" :key="t.value" type="button"
                  class="px-5 py-2.5 text-sm font-semibold transition-all border-r border-gray-200 last:border-r-0"
                  :class="discountDraft.modifier_type === t.value ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                  @click="discountDraft.modifier_type = t.value">{{ t.label }}</button>
              </div>
              <!-- Value -->
              <div class="relative flex items-center border-r border-gray-200">
                <span v-if="discountDraft.modifier_type === 'FLAT'" class="absolute left-3 text-gray-400 text-sm pointer-events-none">$</span>
                <InputNumber v-model="discountDraft.modifier_value" placeholder="0" :min="0"
                  :max="discountDraft.modifier_type === 'PERCENT' ? 100 : undefined"
                  :suffix="discountDraft.modifier_type === 'PERCENT' ? '%' : ''"
                  inputClass="h-10 text-sm font-semibold text-center w-full border-0 shadow-none rounded-none"
                  :class="discountDraft.modifier_type === 'FLAT' ? 'pl-5' : ''"
                  :pt="{ root: { class: 'w-full' }, input: { style: 'border:none; box-shadow:none; border-radius:0' } }" />
              </div>
              <!-- Applied to -->
              <div class="flex items-center px-3 gap-2">
                <span class="text-xs text-gray-400 shrink-0 font-medium">applied to</span>
                <Select v-model="discountDraft.apply_to" :options="applyToOptions" option-label="label" option-value="value"
                  class="flex-1 text-sm"
                  :pt="{ root: { style: 'border:none; box-shadow:none; background:transparent' } }" />
              </div>
            </div>
          </div>
        </div>

        <!-- Conditions section -->
        <div class="px-5 py-4 border-b border-gray-100">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Conditions</p>
            <span v-if="discountDraft.conditions.length > 1"
              class="text-xs font-semibold text-[#1E2157] bg-[#1E2157]/10 px-2.5 py-1 rounded-full">
              All must be met
            </span>
          </div>

          <div v-if="discountDraft.conditions.length" class="rounded-lg border border-gray-200 overflow-hidden mb-3">
            <!-- Column headers -->
            <div class="grid bg-gray-50 border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide"
              style="grid-template-columns: 300px 190px 200px 32px">
              <span class="pl-1">Condition</span>
              <span>Operator</span>
              <span>Value</span>
              <span />
            </div>

            <div v-for="(cond, i) in discountDraft.conditions" :key="i"
              class="grid items-center px-3 border-b border-gray-100 last:border-0 group hover:bg-gray-50/60 transition-colors"
              style="grid-template-columns: 300px 190px 200px 32px">

              <!-- Condition selector -->
              <div class="py-2 pr-2">
                <Select
                  :modelValue="cond.key"
                  :options="conditionTypeOptions"
                  optionLabel="label"
                  optionValue="key"
                  placeholder="Choose condition…"
                  class="w-full text-sm"
                  :pt="{ root: { style: 'border: none; box-shadow: none; background: transparent; padding: 0' } }"
                  @update:modelValue="v => onConditionKeyChange(cond, v)" />
              </div>

              <!-- Operator -->
              <div class="py-2 pr-2 border-l border-gray-100">
                <template v-if="cond.key && getValueType(cond.key) === 'boolean'">
                  <div class="flex rounded-md border border-gray-200 overflow-hidden text-xs font-semibold bg-white">
                    <button type="button" class="flex-1 py-1.5 border-r border-gray-200 transition-all"
                      :class="cond.operator === 'is_true' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="cond.operator = 'is_true'">Yes</button>
                    <button type="button" class="flex-1 py-1.5 transition-all"
                      :class="cond.operator === 'is_false' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                      @click="cond.operator = 'is_false'">No</button>
                  </div>
                </template>
                <Select v-else-if="cond.key" v-model="cond.operator" :options="getOperatorOptions(cond.key)"
                  optionLabel="label" optionValue="value" class="w-full text-sm"
                  :pt="{ root: { style: 'border: none; box-shadow: none; background: transparent; padding: 0' } }" />
                <div v-else class="h-9" />
              </div>

              <!-- Value -->
              <div class="py-2 pr-2 pl-2 border-l border-gray-100">
                <template v-if="cond.key && getValueType(cond.key) !== 'boolean'">
                  <!-- number: full width -->
                  <InputNumber v-if="getValueType(cond.key) === 'number'"
                    v-model="cond.value" :min="0" inputClass="h-9 text-sm w-full px-3" class="w-full"
                    :pt="{ root: { class: 'w-full' } }" />

                  <!-- currency -->
                  <div v-else-if="getValueType(cond.key) === 'currency'" class="flex items-center gap-1.5">
                    <span class="text-sm text-gray-400 shrink-0">$</span>
                    <InputNumber v-model="cond.value" :min="0" :minFractionDigits="2" :maxFractionDigits="2"
                      inputClass="h-9 text-sm w-full px-3" class="flex-1" :pt="{ root: { class: 'flex-1' } }" />
                  </div>

                  <!-- range -->
                  <div v-else-if="getValueType(cond.key) === 'range'" class="flex items-center gap-1.5">
                    <InputNumber :modelValue="cond.value?.min"
                      @update:modelValue="v => { if (!cond.value) cond.value = {}; cond.value.min = v }"
                      :min="0" placeholder="Min" inputClass="h-9 text-sm text-center w-full px-2" class="flex-1" />
                    <span class="text-gray-300 text-sm shrink-0">–</span>
                    <InputNumber :modelValue="cond.value?.max"
                      @update:modelValue="v => { if (!cond.value) cond.value = {}; cond.value.max = v }"
                      :min="0" placeholder="Max" inputClass="h-9 text-sm text-center w-full px-2" class="flex-1" />
                  </div>

                  <!-- datetime: full width -->
                  <DatePicker v-else-if="getValueType(cond.key) === 'datetime'"
                    v-model="cond.value" showTime hourFormat="12" dateFormat="dd/mm/yy"
                    inputClass="h-9 text-sm px-3 w-full" class="w-full" />

                  <!-- string -->
                  <InputText v-else-if="getValueType(cond.key) === 'string'"
                    v-model="cond.value" placeholder="e.g. SAVE20" class="w-full font-mono text-sm h-9 px-3" />

                  <!-- enum -->
                  <Select v-else-if="getValueType(cond.key) === 'enum'"
                    v-model="cond.value" :options="getConditionOptions(cond.key)" class="w-full text-sm"
                    :pt="{ root: { style: 'border: none; box-shadow: none; background: transparent; padding: 0' } }" />

                  <!-- array -->
                  <MultiSelect v-else-if="getValueType(cond.key) === 'array'"
                    v-model="cond.value" :options="getConditionOptions(cond.key)"
                    placeholder="Select…" class="w-full text-sm" />
                </template>
                <div v-else class="h-9" />
              </div>

              <!-- Delete -->
              <div class="flex justify-center border-l border-gray-100">
                <button class="w-7 h-7 flex items-center justify-center rounded-md text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                  @click="discountDraft.conditions.splice(i, 1)">
                  <i class="pi pi-times text-xs" />
                </button>
              </div>
            </div>
          </div>

          <button type="button"
            class="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-[#1E2157] border border-dashed border-gray-200 hover:border-[#1E2157]/30 hover:bg-[#1E2157]/[0.02] rounded-lg py-2.5 transition-all"
            @click="addDiscountCondition">
            <i class="pi pi-plus text-xs" /> Add condition
          </button>
        </div>

        <!-- Valid window -->
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Validity window</p>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active from</label>
              <Select v-model="discountDraft.valid_from_type"
                :options="[{label:'Immediately (once saved)', value:'now'},{label:'Specific date…', value:'custom'}]"
                option-label="label" option-value="value" class="w-full text-sm" />
              <DatePicker v-if="discountDraft.valid_from_type === 'custom'" v-model="discountDraft.valid_from"
                show-icon date-format="dd/mm/yy" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expires</label>
              <Select v-model="discountDraft.expires_type"
                :options="[{label:'When event starts', value:'event'},{label:'Specific date…', value:'custom'}]"
                option-label="label" option-value="value" class="w-full text-sm" />
              <DatePicker v-if="discountDraft.expires_type === 'custom'" v-model="discountDraft.expires_at"
                show-icon date-format="dd/mm/yy" class="w-full" />
            </div>
          </div>
        </div>

        <!-- Settings toggles -->
        <div class="px-5 py-3.5 flex items-center justify-between">
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <ToggleSwitch v-model="discountDraft.is_active" />
            Enabled
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <ToggleSwitch v-model="discountDraft.save_as_template" />
            Save as template
          </label>
        </div>
      </div>

      <!-- Footer buttons -->
      <div class="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 shrink-0">
        <Button label="Cancel" severity="secondary" outlined size="small" @click="showDiscountDialog = false; resetDiscountDraft()" />
        <Button :label="editingDiscountIdx !== null ? 'Save Changes' : 'Add Discount'" size="small" :disabled="!discountDraft.name" @click="saveDiscountDraft" style="background:#1E2157; border-color:#1E2157" />
      </div>

    </div>
  </Dialog>

  <!-- Ticket Type Dialog -->
  <Dialog v-model:visible="showTicketDialog" :header="editingTicket?.id ? 'Edit Ticket Type' : 'New Ticket Type'" modal style="width:520px" @hide="ticketDraft = null">
    <div v-if="ticketDraft" class="flex flex-col gap-4 py-2">
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5 col-span-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name <span class="text-red-400">*</span></label>
          <InputText v-model="ticketDraft.name" placeholder="e.g. Adult, Child, Family Pass" class="w-full text-sm h-9" autofocus />
        </div>
        <div class="flex flex-col gap-1.5 col-span-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
          <InputText v-model="ticketDraft.description" placeholder="Optional details shown on the form" class="w-full text-sm h-9" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</label>
          <div class="relative flex items-center">
            <span class="absolute left-3 text-gray-400 text-sm pointer-events-none">$</span>
            <InputNumber v-model="ticketDraft.price" :min="0" :minFractionDigits="2" :maxFractionDigits="2"
              placeholder="0.00" inputClass="pl-6 h-9 text-sm w-full" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Capacity <span class="text-gray-300 font-normal">(blank = unlimited)</span></label>
          <InputNumber v-model="ticketDraft.capacity" :min="1" placeholder="∞" inputClass="h-9 text-sm w-full px-3" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales open</label>
          <DatePicker v-model="ticketDraft.sales_open_at" showTime hourFormat="12" dateFormat="dd/mm/yy"
            placeholder="Immediately" inputClass="h-9 text-sm px-3 w-full" class="w-full" show-icon />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales close</label>
          <DatePicker v-model="ticketDraft.sales_close_at" showTime hourFormat="12" dateFormat="dd/mm/yy"
            placeholder="At event start" inputClass="h-9 text-sm px-3 w-full" class="w-full" show-icon />
        </div>
        <div v-if="ticketDraft.session_id !== undefined" class="flex flex-col gap-1.5 col-span-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Session</label>
          <Select v-model="ticketDraft.session_id" :options="[{ label: 'Event-level (all sessions)', value: null }, ...sessions.map(s => ({ label: s.title, value: s.id }))]"
            optionLabel="label" optionValue="value" class="w-full text-sm" />
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <ToggleSwitch v-model="ticketDraft.is_active" />
        Active (visible on registration form)
      </label>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" outlined size="small" @click="showTicketDialog = false" />
      <Button :label="editingTicket?.id ? 'Save' : 'Add Ticket Type'" size="small" icon="pi pi-check"
        :disabled="!ticketDraft?.name" @click="saveTicketType(ticketDraft)"
        style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- QR Code Dialog -->
  <Dialog v-model:visible="showQrDialog" header="Ticket QR Code" modal style="width:340px">
    <div v-if="qrOrder" class="flex flex-col items-center gap-4 py-4">
      <div class="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
        <div class="text-center">
          <i class="pi pi-qrcode text-4xl text-gray-400 block mb-2" />
          <p class="text-xs font-mono text-gray-500 break-all px-2">{{ qrOrder.ticket_id }}</p>
        </div>
      </div>
      <div class="text-center">
        <p class="text-sm font-semibold text-gray-800">{{ qrOrder.guest_name || qrOrder.person_name }}</p>
        <p class="text-xs text-gray-500 mt-0.5">{{ qrOrder.guest_email }}</p>
      </div>
      <div class="flex flex-wrap justify-center gap-1.5">
        <span v-for="item in qrOrder.items" :key="item.id"
          class="text-xs bg-[#1E2157]/10 text-[#1E2157] font-medium px-2.5 py-1 rounded-full">
          {{ item.quantity }}× {{ item.ticket_type_name }}
        </span>
      </div>
    </div>
    <template #footer>
      <Button label="Close" severity="secondary" outlined size="small" @click="showQrDialog = false" />
      <Button label="Print" icon="pi pi-print" size="small" style="background:#1E2157; border-color:#1E2157" @click="window.print()" />
    </template>
  </Dialog>

  <!-- Add Invitee dialog -->
  <!-- Send Email Dialog -->
  <Dialog v-model:visible="showSendEmail" header="Send Email" modal style="width:520px">
    <div class="flex flex-col gap-4 py-2">
      <div class="bg-[#1E2157]/5 border border-[#1E2157]/10 rounded-xl px-4 py-2.5 flex items-center gap-2">
        <i class="pi pi-users text-[#1E2157] text-sm" />
        <span class="text-sm text-[#1E2157] font-medium">{{ bulkSelected.length }} recipient{{ bulkSelected.length !== 1 ? 's' : '' }} selected</span>
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-gray-700">Subject</label>
        <InputText v-model="emailDraft.subject" placeholder="e.g. Important update about the event" class="w-full" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-gray-700">Message</label>
        <Textarea v-model="emailDraft.body" rows="6" class="w-full" placeholder="Write your email here…" auto-resize />
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showSendEmail = false" />
      <Button label="Send Email" icon="pi pi-send" :disabled="!emailDraft.subject || !emailDraft.body" @click="showSendEmail = false" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <Dialog v-model:visible="showAddInvitee" header="Add Invitee" modal style="width:400px" @show="loadPersons">
    <div class="flex flex-col gap-4 py-2">
      <Select v-model="newInviteePerson" :options="availablePersons" option-label="full_name" option-value="id"
        placeholder="Select a member" filter class="w-full" />
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showAddInvitee = false" />
      <Button label="Add" :disabled="!newInviteePerson" :loading="addingInvitee" @click="handleAddInvitee" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- Send message dialog -->
  <Dialog v-model:visible="showSendComms" header="Send Message" modal style="width:560px">
    <div class="flex flex-col gap-4 py-2">
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Channel</label>
          <Select v-model="newComms.channel" :options="[{ label: 'Email', value: 'EMAIL' }, { label: 'SMS', value: 'SMS' }]" option-label="label" option-value="value" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Send to</label>
          <Select v-model="newComms.audience" :options="audienceOptions" option-label="label" option-value="value" class="w-full" />
        </div>
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">Subject</label>
        <InputText v-model="newComms.subject" placeholder="Message subject" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">Message</label>
        <Textarea v-model="newComms.body" rows="5" placeholder="Write your message…" class="w-full" />
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showSendComms = false" />
      <Button label="Send" :loading="sendingComms" :disabled="!newComms.subject || !newComms.body" @click="handleSendComms" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- Check-in QR Code dialog -->
  <Dialog v-model:visible="showCheckinQrDialog" header="Check-in QR Code" modal style="width:360px">
    <div class="flex flex-col items-center gap-4 py-2">
      <p class="text-sm text-gray-500 text-center">Members scan this code to self check-in to the event.</p>
      <canvas ref="qrCanvas" class="rounded-xl border border-gray-100" />
      <p class="text-xs text-gray-400 text-center break-all">{{ qrUrl }}</p>
    </div>
    <template #footer>
      <Button label="Download" icon="pi pi-download" severity="secondary" text @click="downloadQr" />
      <Button label="Close" @click="showCheckinQrDialog = false" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- New Category dialog -->
  <Dialog v-model:visible="showNewCategoryDialog" header="New Category" modal style="width:360px">
    <div class="flex flex-col gap-4 py-1">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">Name</label>
        <InputText v-model="newCategoryName" placeholder="Category name" autofocus />
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-for="color in categoryColorPalette" :key="color"
          class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
          :class="newCategoryColor === color ? 'border-gray-900 scale-110' : 'border-transparent'"
          :style="{ background: color }"
          @click="newCategoryColor = color" />
      </div>
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: newCategoryColor }" />
        <span class="text-sm font-medium text-gray-700">{{ newCategoryName || 'Category name' }}</span>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showNewCategoryDialog = false" />
      <Button label="Create" :disabled="!newCategoryName.trim()" :loading="savingCategory" @click="createCategory" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- Sub Groups dialog -->
  <Dialog v-model:visible="showSubGroupsDialog" header="Manage Sub Groups" modal style="width:520px">
    <div class="flex flex-col gap-5 py-2">
      <!-- Create new group -->
      <div class="flex flex-col gap-3">
        <label class="text-sm font-semibold text-gray-700">Create Group</label>
        <div class="flex items-center gap-2 flex-wrap">
          <InputText v-model="newGroupName" placeholder="Group name…" class="flex-1 min-w-0" @keydown.enter="addSubGroup" />
          <div class="flex gap-1.5 flex-shrink-0">
            <button v-for="color in groupColorPalette" :key="color"
              class="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 shrink-0"
              :class="newGroupColor === color ? 'border-gray-700 scale-110' : 'border-transparent'"
              :style="{ background: color }"
              @click="newGroupColor = color" />
          </div>
        </div>
        <!-- Scope selector (only shown when event has sessions) -->
        <div v-if="attendanceSessions.length" class="flex flex-col gap-2">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">Apply to</label>
          <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button type="button"
              class="flex-1 px-3 py-2 transition-colors"
              :class="newGroupScope === 'all' ? 'bg-[#1E2157] text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="newGroupScope = 'all'; newGroupSessionIds = []">All sessions</button>
            <button type="button"
              class="flex-1 px-3 py-2 transition-colors border-l border-gray-200"
              :class="newGroupScope === 'this' ? 'bg-[#1E2157] text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="newGroupScope = 'this'; newGroupSessionIds = []">This session</button>
            <button type="button"
              class="flex-1 px-3 py-2 transition-colors border-l border-gray-200"
              :class="newGroupScope === 'multiple' ? 'bg-[#1E2157] text-white font-medium' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="newGroupScope = 'multiple'">Select sessions</button>
          </div>
          <!-- Session picker for multiple -->
          <MultiSelect
            v-if="newGroupScope === 'multiple'"
            v-model="newGroupSessionIds"
            :options="attendanceSessions"
            :option-label="s => (s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' — ' : '') + (s.title || 'Untitled')"
            option-value="id"
            placeholder="Choose sessions…"
            display="chip"
            class="w-full"
          />
          <p v-if="newGroupScope === 'this' && selectedAttendanceSessionId" class="text-xs text-gray-400">
            Will apply to: {{ attendanceSessions.find(s => s.id === selectedAttendanceSessionId)?.title || 'current session' }}
          </p>
        </div>
        <div class="flex justify-end">
          <Button label="Add Group" :disabled="!newGroupName.trim() || (newGroupScope === 'multiple' && !newGroupSessionIds.length)" size="small" @click="addSubGroup" style="background:#1E2157; border-color:#1E2157" />
        </div>
      </div>
      <!-- Existing groups list -->
      <div v-if="subGroups.length" class="flex flex-col gap-2">
        <label class="text-sm font-semibold text-gray-700">Groups ({{ subGroups.length }})</label>
        <div v-for="grp in subGroups" :key="grp.id" class="flex flex-col bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
          <!-- Group header row -->
          <div class="flex items-center gap-3 px-4 py-3">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: grp.color }" />
            <span class="text-sm font-medium text-gray-700">{{ grp.name }}</span>
            <span v-if="attendanceSessions.length"
              class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
              :class="(!grp.session_ids || grp.session_ids.length === 0) ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'">
              {{ (!grp.session_ids || grp.session_ids.length === 0) ? 'All sessions' : grp.session_ids.length === 1 ? '1 session' : `${grp.session_ids.length} sessions` }}
            </span>
            <span class="flex-1" />
            <span class="text-xs text-gray-400">
              {{ groupedInvitees.groups.find(g => g.group.id === grp.id)?.invitees.length ?? 0 }} members
            </span>
            <Button icon="pi pi-trash" size="small" text severity="danger" rounded @click="removeSubGroup(grp.id)" />
          </div>
          <!-- Managers row -->
          <div class="border-t border-gray-200 px-4 py-2.5 flex items-center gap-2 flex-wrap bg-white">
            <span class="text-xs text-gray-500 shrink-0">Managers:</span>
            <!-- Manager chips -->
            <div v-for="mgr in (grp.managers ?? [])" :key="mgr.id"
              class="flex items-center gap-1 bg-gray-100 rounded-full pl-2 pr-1 py-0.5">
              <span class="text-xs text-gray-700">{{ mgr.name }}</span>
              <button class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                @click="removeSubGroupManager(grp.id, mgr.id)">
                <i class="pi pi-times text-[9px]" />
              </button>
            </div>
            <!-- Add manager picker -->
            <Select
              v-model="addingManagerForGroup[grp.id]"
              :options="availableManagersFor(grp)"
              option-label="full_name"
              option-value="id"
              placeholder="+ Add manager"
              size="small"
              class="text-xs h-6"
              style="min-width:140px; font-size:12px"
              @change="onAddManager(grp.id, $event.value)"
            />
          </div>
        </div>
      </div>
      <div v-else class="py-4 text-center text-sm text-gray-400">
        <i class="pi pi-users text-2xl mb-2 block text-gray-300" />
        No groups yet. Create one above.
      </div>
      <p v-if="subGroups.length" class="text-xs text-gray-400 -mt-2">
        Drag attendees between groups in the attendance table.
      </p>
    </div>
    <template #footer>
      <Button label="Save" :loading="savingSubGroups" icon="pi pi-check" @click="saveSubGroups" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- From Master picker -->
  <Dialog :visible="showPickMaster" header="Create Session from Master" modal style="width:520px" @update:visible="v => { if (!v) showPickMaster = false }">
    <div class="flex flex-col gap-3 py-2">
      <p class="text-sm text-gray-500">Choose a master session — your new session will inherit its settings, fees, location and description.</p>
      <div v-for="master in masterSessions" :key="master.id"
        class="flex items-center gap-3 p-3 bg-white border-2 rounded-xl transition-colors cursor-pointer hover:border-[#1E2157]"
        @click="createSessionFromMaster(master); showPickMaster = false">
        <div class="w-9 h-9 rounded-full bg-yellow-50 flex items-center justify-center shrink-0"><i class="pi pi-crown text-yellow-500 text-sm" /></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800">{{ master.title || 'Untitled' }}</p>
          <p class="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
            <span v-if="master.address || master.meeting_link">{{ master.address || master.meeting_link }}</span>
            <span v-if="(master.fees ?? []).length">{{ master.fees.length }} fee{{ master.fees.length !== 1 ? 's' : '' }}</span>
            <span>{{ sessions.filter(s => s.master_id === master.id).length }} session{{ sessions.filter(s => s.master_id === master.id).length !== 1 ? 's' : '' }} linked</span>
          </p>
        </div>
        <i class="pi pi-arrow-right text-gray-300 shrink-0" />
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showPickMaster = false" />
    </template>
  </Dialog>

  <!-- Bulk Sessions Dialog -->
  <Dialog v-model:visible="showBulkSessions" header="Add Bulk Sessions" modal style="width:960px" :closable="!savingBulk">
    <div class="flex flex-col gap-5 py-2">
      <!-- Dates row -->
      <div class="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4 space-y-3">
        <h3 class="text-sm font-semibold text-gray-700">Date Range</h3>
        <div class="flex items-center gap-3 flex-wrap">
          <DatePicker v-model="bulkForm.startDate" placeholder="Start date" dateFormat="dd/mm/yy" class="w-40" />
          <span class="text-sm text-gray-400">to</span>
          <DatePicker v-model="bulkForm.endDate" placeholder="End date" dateFormat="dd/mm/yy" class="w-40" :minDate="bulkForm.startDate ?? undefined" />
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none ml-1">
            <Checkbox v-model="bulkForm.includeWeekends" :binary="true" />
            Include weekends
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none ml-1">
            <Checkbox v-model="bulkForm.excludePublicHolidays" :binary="true" />
            Exclude public holidays
          </label>
        </div>
        <p v-if="bulkSessionDays.length > 0" class="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 w-fit">
          <i class="pi pi-calendar-clock mr-1.5" />
          <strong>{{ bulkSessionDays.length }}</strong> day{{ bulkSessionDays.length !== 1 ? 's' : '' }} in programme
          <span v-if="!bulkForm.includeWeekends" class="text-green-600"> (weekdays only)</span>
          <span v-if="bulkForm.excludePublicHolidays" class="text-green-600"> (excl. public holidays)</span>
        </p>
      </div>

      <!-- Session Templates -->
      <BulkSessionTemplates
        :modelValue="bulkTemplates"
        :bookableTree="bookableTree"
        :daysCount="bulkSessionDays.length"
        @update:modelValue="v => { bulkTemplates.splice(0, bulkTemplates.length, ...v) }" />

      <!-- Preview -->
      <div v-if="bulkCanCreate" class="bg-[#1E2157]/5 border border-[#1E2157]/20 rounded-xl px-5 py-4">
        <p class="text-sm font-semibold text-[#1E2157] mb-2">Ready to create</p>
        <ul class="text-sm text-gray-600 space-y-1">
          <li><i class="pi pi-clock text-[#1E2157] mr-2 text-xs" />{{ bulkSessionDays.length }} days · {{ bulkNamedTemplates.length }} session template{{ bulkNamedTemplates.length !== 1 ? 's' : '' }} per day</li>
          <li><i class="pi pi-list text-[#1E2157] mr-2 text-xs" /><strong>{{ bulkTotalSessions }}</strong> sessions will be added to this event</li>
        </ul>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showBulkSessions = false" :disabled="savingBulk" />
      <Button label="Create Sessions" icon="pi pi-check" :loading="savingBulk" :disabled="!bulkCanCreate"
        @click="createBulkSessions" style="background:#1E2157;border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- Session Invitees Dialog -->
  <Dialog :visible="!!managingSessionInvitees" :header="`Invitees — ${managingSessionInvitees?.title || 'Session'}`" modal style="width:700px" @update:visible="v => { if (!v) managingSessionInvitees = null }">
    <div v-if="managingSessionInvitees" class="flex flex-col gap-4 py-2">

      <!-- Search + count -->
      <div class="flex items-center gap-3">
        <IconField class="flex-1">
          <InputIcon class="pi pi-search" />
          <InputText v-model="sessionInviteeSearch" placeholder="Search invitees…" size="small" class="w-full" />
        </IconField>
        <span class="text-sm text-gray-500 shrink-0">
          <span class="font-semibold text-[#1E2157]">{{ sessionInviteePicker.length }}</span> / {{ invitees.length }} selected
        </span>
        <Button v-if="sessionInviteePicker.length < invitees.length" label="Select all" size="small" text severity="secondary"
          @click="sessionInviteePicker = invitees.map(i => i.id)" />
        <Button v-else label="Clear all" size="small" text severity="secondary"
          @click="sessionInviteePicker = []" />
      </div>

      <!-- Empty state -->
      <div v-if="!invitees.length" class="py-10 text-center text-sm text-gray-400">
        <i class="pi pi-users text-3xl mb-3 block text-gray-300" />
        No invitees on this event yet.
      </div>

      <!-- Invitee pills, grouped by sub-group -->
      <div v-else class="space-y-3 max-h-96 overflow-y-auto pr-1">

        <!-- Groups -->
        <template v-for="sg in subGroups" :key="sg.id">
          <div v-if="sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).length" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div class="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: sg.color }" />
              <span class="text-sm font-semibold text-gray-700">{{ sg.name }}</span>
              <span class="text-xs text-gray-400 ml-auto">{{ sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id).length }}</span>
            </div>
            <div class="px-4 py-3 flex flex-wrap gap-2">
              <span v-for="inv in sessionFilteredInvitees.filter(inv => inviteeGroupMap[inv.id] === sg.id)" :key="inv.id"
                class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm cursor-pointer select-none transition-colors"
                :class="sessionInviteePicker.includes(inv.id) ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                @click="sessionInviteePicker.includes(inv.id) ? sessionInviteePicker.splice(sessionInviteePicker.indexOf(inv.id), 1) : sessionInviteePicker.push(inv.id)">
                {{ inv.person?.first_name }} {{ inv.person?.last_name }}
                <i class="pi text-xs ml-0.5" :class="sessionInviteePicker.includes(inv.id) ? 'pi-check' : 'pi-plus'" />
              </span>
            </div>
          </div>
        </template>

        <!-- Ungrouped / all when no sub-groups -->
        <div v-if="sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id]).length" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div v-if="subGroups.length" class="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <i class="pi pi-user text-gray-400 text-xs" />
            <span class="text-sm font-semibold text-gray-700">Ungrouped</span>
            <span class="text-xs text-gray-400 ml-auto">{{ sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id]).length }}</span>
          </div>
          <div class="px-4 py-3 flex flex-wrap gap-2">
            <span v-for="inv in sessionFilteredInvitees.filter(inv => !inviteeGroupMap[inv.id])" :key="inv.id"
              class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm cursor-pointer select-none transition-colors"
              :class="sessionInviteePicker.includes(inv.id) ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              @click="sessionInviteePicker.includes(inv.id) ? sessionInviteePicker.splice(sessionInviteePicker.indexOf(inv.id), 1) : sessionInviteePicker.push(inv.id)">
              {{ inv.person?.first_name }} {{ inv.person?.last_name }}
              <i class="pi text-xs ml-0.5" :class="sessionInviteePicker.includes(inv.id) ? 'pi-check' : 'pi-plus'" />
            </span>
          </div>
        </div>

        <div v-if="!sessionFilteredInvitees.length" class="py-6 text-center text-sm text-gray-400">No invitees match your search.</div>
      </div>

    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="managingSessionInvitees = null" />
      <Button label="Save" icon="pi pi-check" @click="saveSessionInvitees" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- Sub-session Detail Dialog -->
  <Dialog :visible="!!editingSubSession" :header="editingSubSession?.title || 'Sub-session Details'" modal style="width:760px;max-height:92vh" :draggable="false" @update:visible="v => { if (!v) editingSubSession = null }">
    <template #header>
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-8 h-8 rounded-full bg-[#1E2157]/10 flex items-center justify-center shrink-0">
          <i class="pi pi-list text-[#1E2157] text-sm" />
        </div>
        <div class="min-w-0">
          <p class="font-semibold text-gray-900 truncate">{{ editingSubSession?.title || 'Untitled Sub-session' }}</p>
          <p class="text-xs text-gray-400">Sub-session of <span class="font-medium">{{ editingSubSessionParent?.title || 'Session' }}</span></p>
        </div>
      </div>
    </template>
    <div v-if="editingSubSession" class="flex flex-col" style="height:calc(92vh - 160px)">
      <!-- Tab nav -->
      <div class="flex gap-1.5 pb-4 border-b border-gray-100 flex-wrap shrink-0">
        <button v-for="t in sessionTabs" :key="t.key"
          class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
          :class="subSessionTab === t.key ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          @click="subSessionTab = t.key">
          <i :class="`pi ${t.icon} text-xs`" />{{ t.label }}
        </button>
      </div>
      <div class="flex-1 overflow-y-auto pt-5">

        <!-- OVERVIEW -->
        <div v-if="subSessionTab === 'overview'" class="space-y-5">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</label>
            <InputText v-model="editingSubSession.title" placeholder="Sub-session name" class="w-full" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
              <DatePicker v-model="editingSubSession._date" :manual-input="false" show-icon date-format="dd/mm/yy" placeholder="Select date" class="w-full"
                :min-date="editingSubSessionParent?._startDate ?? undefined"
                :max-date="editingSubSessionParent?._endDate ?? undefined" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</label>
              <div class="flex items-center gap-2">
                <DatePicker v-model="editingSubSession._startTime" time-only show-icon hour-format="12" placeholder="Start" class="flex-1" />
                <span class="text-gray-400 text-xs shrink-0">–</span>
                <DatePicker v-model="editingSubSession._endTime" time-only show-icon hour-format="12" placeholder="End" class="flex-1" />
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</label>
            <div class="flex gap-2 flex-wrap">
              <button v-for="lt in locationTypes" :key="lt.value" type="button"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                :class="editingSubSession.location_type === lt.value ? 'border-[#1E2157] bg-[#1E2157]/5 text-[#1E2157]' : 'border-gray-200 text-gray-600 hover:border-gray-300'"
                @click="editingSubSession.location_type = lt.value">
                <i :class="`pi ${lt.icon} text-xs`" />{{ lt.label }}
              </button>
            </div>
            <InputText v-if="editingSubSession.location_type === 'ADDRESS'" v-model="editingSubSession.address" placeholder="Enter address…" class="w-full" />
            <InputText v-else-if="editingSubSession.location_type === 'ONLINE'" v-model="editingSubSession.meeting_link" placeholder="https://zoom.us/j/…" class="w-full" />
            <p v-else class="text-sm text-gray-500 italic">Bookable venue selector coming soon</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
            <RichTextEditor :modelValue="editingSubSession.description ?? ''" @update:modelValue="editingSubSession.description = $event" placeholder="Describe this sub-session…" />
          </div>
        </div>

        <!-- INVITEES (subset of parent session invitees) -->
        <div v-else-if="subSessionTab === 'invitees'" class="space-y-4">
          <p class="text-sm text-gray-500">Select from <span class="font-medium text-gray-700">{{ editingSubSessionParent?.title }}</span>'s invitees.</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="inv in invitees.filter(i => (editingSubSessionParent?.invitee_ids ?? invitees.map(x => x.id)).includes(i.id))" :key="inv.id"
              class="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm cursor-pointer select-none transition-colors"
              :class="(editingSubSession.invitee_ids ?? []).includes(inv.id) ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
              @click="(editingSubSession.invitee_ids ?? []).includes(inv.id) ? editingSubSession.invitee_ids.splice(editingSubSession.invitee_ids.indexOf(inv.id),1) : (editingSubSession.invitee_ids=editingSubSession.invitee_ids??[])&&editingSubSession.invitee_ids.push(inv.id)">
              {{ inv.person?.first_name }} {{ inv.person?.last_name }}
              <i class="pi text-xs ml-0.5" :class="(editingSubSession.invitee_ids ?? []).includes(inv.id) ? 'pi-check' : 'pi-plus'" />
            </span>
            <p v-if="!invitees.filter(i => (editingSubSessionParent?.invitee_ids ?? []).includes(i.id)).length && (editingSubSessionParent?.invitee_ids ?? []).length === 0" class="text-sm text-gray-400 italic">Add invitees to the parent session first.</p>
          </div>
        </div>

        <!-- FEES -->
        <div v-else-if="subSessionTab === 'fees'" class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-sm text-gray-500">Additional fees for this sub-session.</p>
            <Button label="Add Fee" icon="pi pi-plus" size="small" @click="(editingSubSession.fees=editingSubSession.fees??[]).push({id:crypto.randomUUID(),name:'',amount:0,type:'STANDARD'})" style="background:#1E2157;border-color:#1E2157" />
          </div>
          <div v-if="(editingSubSession.fees ?? []).length" class="border border-gray-200 rounded-xl overflow-hidden">
            <table class="w-full text-sm">
              <thead><tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Name</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
                <th class="w-12" />
              </tr></thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="fee in editingSubSession.fees" :key="fee.id" class="hover:bg-gray-50">
                  <td class="px-4 py-2.5"><InputText v-model="fee.name" size="small" placeholder="Fee name" class="w-full" /></td>
                  <td class="px-4 py-2.5"><Select v-model="fee.type" :options="[{label:'Standard',value:'STANDARD'},{label:'Early Bird',value:'EARLY_BIRD'},{label:'Member',value:'MEMBER'}]" option-label="label" option-value="value" size="small" class="w-36" /></td>
                  <td class="px-4 py-2.5"><div class="flex items-center gap-1"><span class="text-gray-400 text-sm">$</span><InputNumber v-model="fee.amount" :min="0" :max-fraction-digits="2" size="small" class="w-24" /></div></td>
                  <td class="px-4 py-2.5 text-right"><Button icon="pi pi-trash" size="small" text severity="danger" @click="editingSubSession.fees.splice(editingSubSession.fees.indexOf(fee),1)" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="py-10 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl"><i class="pi pi-dollar text-2xl mb-2 block text-gray-300" />No fees</div>
        </div>

        <!-- DISCOUNTS -->
        <div v-else-if="subSessionTab === 'discounts'" class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-sm text-gray-500">Discount codes for this sub-session.</p>
            <Button label="Add Discount" icon="pi pi-plus" size="small" @click="(editingSubSession.discounts=editingSubSession.discounts??[]).push({id:crypto.randomUUID(),code:'',type:'PERCENT',value:0,max_uses:null})" style="background:#1E2157;border-color:#1E2157" />
          </div>
          <div v-if="(editingSubSession.discounts ?? []).length" class="border border-gray-200 rounded-xl overflow-hidden">
            <table class="w-full text-sm">
              <thead><tr class="bg-gray-50 border-b border-gray-200">
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Code</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Value</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Max uses</th>
                <th class="w-12" />
              </tr></thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="disc in editingSubSession.discounts" :key="disc.id" class="hover:bg-gray-50">
                  <td class="px-4 py-2.5"><InputText v-model="disc.code" size="small" placeholder="e.g. MEMBER20" class="w-full uppercase" /></td>
                  <td class="px-4 py-2.5"><Select v-model="disc.type" :options="[{label:'% off',value:'PERCENT'},{label:'$ off',value:'FIXED'}]" option-label="label" option-value="value" size="small" class="w-28" /></td>
                  <td class="px-4 py-2.5"><div class="flex items-center gap-1"><span class="text-gray-400 text-sm">{{ disc.type === 'PERCENT' ? '%' : '$' }}</span><InputNumber v-model="disc.value" :min="0" size="small" class="w-20" /></div></td>
                  <td class="px-4 py-2.5"><InputNumber v-model="disc.max_uses" :min="1" size="small" placeholder="∞" class="w-20" /></td>
                  <td class="px-4 py-2.5 text-right"><Button icon="pi pi-trash" size="small" text severity="danger" @click="editingSubSession.discounts.splice(editingSubSession.discounts.indexOf(disc),1)" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="py-10 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl"><i class="pi pi-tag text-2xl mb-2 block text-gray-300" />No discounts</div>
        </div>

        <!-- SETTINGS -->
        <div v-else-if="subSessionTab === 'settings'" class="space-y-4">
          <div class="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            <div class="flex items-center justify-between px-4 py-3">
              <div><p class="text-sm font-medium text-gray-700">Required</p><p class="text-xs text-gray-500">Attendees must register for this sub-session</p></div>
              <ToggleSwitch v-model="editingSubSession.required" />
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <div><p class="text-sm font-medium text-gray-700">Public</p><p class="text-xs text-gray-500">Visible to all session registrants</p></div>
              <ToggleSwitch v-model="editingSubSession.is_public" />
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <div><p class="text-sm font-medium text-gray-700">Show attendee list</p><p class="text-xs text-gray-500">Registrants can see who else is attending</p></div>
              <ToggleSwitch v-model="editingSubSession.show_attendee_list" />
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-700">Limit capacity</p>
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-xs text-gray-500">Set max registrations</p>
                  <template v-if="editingSubSession._hasCapacity">
                    <InputNumber v-model="editingSubSession.capacity_max" :min="1" size="small" placeholder="Max" class="w-20" />
                    <span class="text-xs text-gray-500">spots</span>
                  </template>
                </div>
              </div>
              <ToggleSwitch v-model="editingSubSession._hasCapacity" class="ml-3 shrink-0" @update:model-value="v => { if (!v) editingSubSession.capacity_max = null }" />
            </div>
            <div v-if="editingSubSession._hasCapacity" class="flex items-center justify-between px-4 py-3">
              <div><p class="text-sm font-medium text-gray-700">Enable waitlist</p><p class="text-xs text-gray-500">Overflow joins a waitlist</p></div>
              <ToggleSwitch v-model="editingSubSession.has_waitlist" />
            </div>
          </div>
        </div>

      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="editingSubSession = null" />
      <Button label="Save" icon="pi pi-check" @click="saveSubSession" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- Edit T&C Agree Text Dialog -->
  <Dialog :visible="evtEditingTCLabel !== null" header="Edit Checkbox Text" modal style="width:420px" @update:visible="evtEditingTCLabel = null">
    <div class="py-2 space-y-3">
      <p class="text-sm text-gray-500">Update the text shown next to the agree checkbox for <strong>{{ evtEditingTCLabel }}</strong>.</p>
      <InputText v-model="evtTCEditAgreeText" placeholder="e.g. I agree to the Photos Policy" class="w-full" @keyup.enter="saveEvtEditTC" />
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="evtEditingTCLabel = null" />
      <Button label="Save" @click="saveEvtEditTC" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- Create T&C Modal -->
  <Dialog v-model:visible="showEvtTCModal" header="Create New T&C" modal style="width:520px">
    <div class="space-y-4 py-2">
      <div>
        <label class="text-sm font-medium text-gray-700 block mb-1.5">T&C Name <span class="text-red-500">*</span></label>
        <InputText v-model="evtTCDraft.label" placeholder="e.g. Media Release Policy" class="w-full" />
      </div>
      <div>
        <label class="text-sm font-medium text-gray-700 block mb-1.5">Terms Text</label>
        <Textarea v-model="evtTCDraft.text" placeholder="Enter the full terms and conditions text…" auto-resize rows="5" class="w-full text-sm" />
      </div>
      <div>
        <label class="text-sm font-medium text-gray-700 block mb-1.5">Agree Button Text</label>
        <InputText v-model="evtTCDraft.agreeText" placeholder="e.g. I agree to the Media Release Policy" class="w-full" />
        <p class="text-xs text-gray-400 mt-1">Leave blank to use default: "I agree to the [T&C Name]"</p>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showEvtTCModal = false" />
      <Button label="Create T&C" :disabled="!evtTCDraft.label.trim()" @click="saveEvtTCDraft" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <Toast />
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const id = route.params.id as string

// ---- Tabs ----
const allTabs = [
  { key: 'overview',       label: 'Overview',       icon: 'pi-info-circle' },
  { key: 'sessions',       label: 'Sessions',       icon: 'pi-calendar-clock' },
  { key: 'discounts',      label: 'Discounts',      icon: 'pi-tag' },
  { key: 'tickets',        label: 'Tickets',        icon: 'pi-ticket' },
  { key: 'forms',          label: 'Forms',          icon: 'pi-file-edit' },
  { key: 'invitees',       label: 'Invitees',       icon: 'pi-users' },
  { key: 'communication',  label: 'Communication',  icon: 'pi-envelope' },
  { key: 'automation',     label: 'Automation',     icon: 'pi-bolt' },
  { key: 'attendance',     label: 'Attendance',     icon: 'pi-check-square' },
  { key: 'reporting',      label: 'Reporting',      icon: 'pi-chart-bar' },
  { key: 'notes',          label: 'Notes & Tasks',  icon: 'pi-clipboard' },
]

const basicTabs = ['overview', 'invitees', 'attendance', 'communication', 'notes', 'settings']

import type { LocationEntry } from '~/composables/useLocation'
function defaultLocation(): LocationEntry { return { type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] } }

const twoWeeksAgo = new Date()
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
twoWeeksAgo.setHours(0, 0, 0, 0)


const eventDateDisplay = computed(() => {
  const isAllDay = event.value?.is_all_day
  const startRaw = event.value?.start_at ? new Date(event.value.start_at) : null
  const endRaw   = event.value?.end_at   ? new Date(event.value.end_at)   : null
  const startTimeRaw = startRaw
  const endTimeRaw   = endRaw

  if (!startRaw) return { start: '—', end: null, days: null }

  const startDate = new Date(startRaw as any)
  const endDate   = endRaw ? new Date(endRaw as any) : null
  const sameDay   = endDate ? startDate.toDateString() === endDate.toDateString() : true

  const fDate = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const fTime = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })

  let start = ''
  let end: string | null = null

  if (isAllDay) {
    start = fDate(startDate)
    if (endDate && !sameDay) end = fDate(endDate)
  } else {
    const st = startTimeRaw ? fTime(new Date(startTimeRaw as any)) : ''
    const et = endTimeRaw   ? fTime(new Date(endTimeRaw as any))   : ''
    if (sameDay || !endDate) {
      start = fDate(startDate) + (st ? `, ${st}` : '')
      if (et) end = et
    } else {
      start = fDate(startDate) + (st ? `, ${st}` : '')
      end = fDate(endDate) + (et ? `, ${et}` : '')
    }
  }

  const days = (isAllDay && endDate)
    ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    : null

  return { start, end, days }
})


const tabs = computed(() => {
  if (event.value?.style === 'BASIC') {
    return allTabs.filter(t => basicTabs.includes(t.key))
  }
  return allTabs.filter(t => t.key !== 'tickets' || hasTickets.value)
})
const activeTab = ref((useRoute().query.tab as string) || 'overview')
const overviewEditing = ref(false)

// ── Notes ────────────────────────────────────────────────────────────
const editingNotes = ref(false)
const notesText = ref('')
const savingNotes = ref(false)

function startEditNotes() {
  notesText.value = event.value?.notes ?? ''
  editingNotes.value = true
}
function cancelEditNotes() {
  editingNotes.value = false
}
async function saveNotes() {
  savingNotes.value = true
  const { error } = await db.from('events').update({ notes: notesText.value }).eq('id', id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 3000 })
  } else {
    if (event.value) event.value.notes = notesText.value
    editingNotes.value = false
  }
  savingNotes.value = false
}

// ── Tasks ────────────────────────────────────────────────────────────
const eventTasks = ref<{ id: string; text: string; done: boolean; due_date: string | null }[]>([])
const newTaskText = ref('')
const editingTaskId = ref<string | null>(null)
const editingTaskText = ref('')

async function loadTasks() {
  const { data } = await db.from('event_tasks').select('*').eq('event_id', id).order('created_at')
  eventTasks.value = data ?? []
}

async function addTask() {
  const text = newTaskText.value.trim()
  if (!text) return
  const { data } = await db.from('event_tasks').insert({ event_id: id, text, done: false }).select('*').single()
  if (data) eventTasks.value.push(data)
  newTaskText.value = ''
}

async function toggleTask(task: any) {
  const done = !task.done
  await db.from('event_tasks').update({ done }).eq('id', task.id)
  task.done = done
}

function startEditTask(task: any) {
  editingTaskId.value = task.id
  editingTaskText.value = task.text
}

async function saveTaskEdit(task: any) {
  const text = editingTaskText.value.trim()
  if (!text) { editingTaskId.value = null; return }
  await db.from('event_tasks').update({ text }).eq('id', task.id)
  task.text = text
  editingTaskId.value = null
}

async function deleteTask(taskId: string) {
  await db.from('event_tasks').delete().eq('id', taskId)
  eventTasks.value = eventTasks.value.filter(t => t.id !== taskId)
}

function formatTaskDate(date: string) {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---- Per-field inline editing (overview card) ----
const fieldEditing = reactive<Record<string, boolean>>({})
const savingField = ref<string | null>(null)

function startFieldEdit(field: string) {
  if (!event.value) return
  if (field === 'title') editForm.value.title = event.value.title ?? ''
  if (field === 'description') editForm.value.description = event.value.description ?? ''
  if (field === 'category') {
    editForm.value.category_ids = [event.value.category_id, event.value.secondary_category_id].filter(Boolean) as string[]
  }
  if (field === 'location') {
    const locs = event.value.locations
    editForm.value.locations = Array.isArray(locs) && locs.length ? JSON.parse(JSON.stringify(locs)) : [defaultLocation()]
  }
  if (field === 'date') {
    const startDate = event.value.start_at ? new Date(event.value.start_at) : null
    const endDate = event.value.end_at ? new Date(event.value.end_at) : null
    editForm.value.start_date = startDate
    editForm.value.start_time = startDate
    editForm.value.end_date = endDate
    editForm.value.end_time = endDate
    editForm.value.is_all_day = event.value.is_all_day ?? false
    editForm.value.repeat = event.value.recurrence_rule ?? ''
  }
  if (field === 'capacity') {
    editForm.value.has_capacity = !!event.value.capacity_max
    editForm.value.capacity_max = event.value.capacity_max ?? null
  }
  if (field === 'visibility') {
    editForm.value.is_public = event.value.is_public ?? false
    editForm.value.is_featured = event.value.is_featured ?? false
    editForm.value.show_attendee_list = event.value.show_attendee_list ?? false
    editForm.value.show_attendee_count = event.value.show_attendee_count ?? true
    editForm.value.allow_interest = event.value.allow_interest ?? false
    editForm.value.hold_spot_enabled = event.value.hold_spot_enabled ?? false
    editForm.value.has_waitlist = event.value.has_waitlist ?? false
    editForm.value.allow_guests = event.value.allow_guests ?? false
    editForm.value.phased_registration = event.value.phased_registration ?? false
    editForm.value.member_window_days = event.value.member_window_days ?? 40
    editForm.value.public_opens_at = event.value.public_opens_at ? new Date(event.value.public_opens_at) : null
  }
  if (field === 'signup') {
    editForm.value.reg_open_at = event.value.reg_open_at ? new Date(event.value.reg_open_at) : null
    editForm.value.reg_close_at = event.value.reg_close_at ? new Date(event.value.reg_close_at) : null
  }
  if (field === 'fees') {
    loadFees()
  }
  fieldEditing[field] = true
}

function cancelFieldEdit(field: string) {
  fieldEditing[field] = false
}

function getVenuePath(bookableId: string): string {
  const node = allBookables.value.find(b => b.id === bookableId)
  if (!node) return bookableId
  if (!node.parent_id) return node.name
  return `${getVenuePath(node.parent_id)} > ${node.name}`
}

const locationSummary = computed(() => {
  const locs: any[] = event.value?.locations ?? []
  if (!locs.length) return '—'
  return locs.map((loc: any) => {
    if (loc.type === 'ADDRESS') return [loc.venue_name, loc.address].filter(Boolean).join(', ') || 'Address'
    if (loc.type === 'ONLINE') return loc.meeting_link || 'Online'
    if (loc.type === 'BOOKABLE') {
      const ids: string[] = loc.bookable_ids ?? []
      if (!ids.length) return 'My venue'
      // Only show topmost selected nodes — if a parent is also selected, skip the child
      const topLevel = ids.filter(id => {
        const node = allBookables.value.find(b => b.id === id)
        return !node?.parent_id || !ids.includes(node.parent_id)
      })
      return topLevel.map(id => getVenuePath(id)).join(', ') || 'My venue'
    }
    return '—'
  }).join(' · ') || '—'
})

async function saveField(field: string) {
  savingField.value = field
  const update: Record<string, any> = {}
  if (field === 'title') update.title = editForm.value.title
  if (field === 'description') update.description = editForm.value.description
  if (field === 'category') {
    update.category_id = editForm.value.category_ids[0] ?? null
    update.secondary_category_id = editForm.value.category_ids[1] ?? null
  }
  if (field === 'location') {
    update.locations = editForm.value.locations
  }
  if (field === 'date') {
    // Treat as all-day if no time is set (multi-day range without explicit times)
    const hasTime = !!(editForm.value.start_time || editForm.value.end_time)
    const isAllDay = editForm.value.is_all_day || !hasTime
    update.is_all_day = isAllDay
    update.start_at = buildDateTime(editForm.value.start_date, isAllDay ? null : editForm.value.start_time)
    update.end_at = buildDateTime(editForm.value.end_date, isAllDay ? null : editForm.value.end_time)
    update.recurrence_rule = editForm.value.repeat || null
  }
  if (field === 'signup') {
    update.reg_open_at = editForm.value.reg_open_at ?? null
    update.reg_close_at = editForm.value.reg_close_at ?? null
  }
  if (field === 'capacity') {
    update.capacity_max = editForm.value.has_capacity ? (editForm.value.capacity_max ?? null) : null
  }
  if (field === 'visibility') {
    update.is_public = editForm.value.is_public
    update.is_featured = editForm.value.is_featured
    update.show_attendee_list = editForm.value.show_attendee_list
    update.show_attendee_count = editForm.value.show_attendee_count
    update.allow_interest = editForm.value.allow_interest
    update.hold_spot_enabled = editForm.value.hold_spot_enabled
    update.has_waitlist = editForm.value.has_waitlist
  }
  const { error } = await db.from('events').update(update).eq('id', id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Error saving', detail: error.message, life: 4000 })
  } else {
    // Patch only the saved fields on event.value — avoids resetting unsaved editForm fields
    if (event.value) Object.assign(event.value, update)
    toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
    if (field === 'location') await syncVenueBookings()
    if (field === 'date') await updateVenueBookingTimes()
  }
  fieldEditing[field] = false
  savingField.value = null
}

async function syncVenueBookings() {
  const locations: any[] = event.value?.locations ?? []
  const bookableIds: string[] = locations
    .filter((l: any) => l.type === 'BOOKABLE')
    .flatMap((l: any) => l.bookable_ids ?? [])
  const layouts: Record<string, string> = Object.assign(
    {},
    ...locations.filter((l: any) => l.type === 'BOOKABLE').map((l: any) => l.bookable_layouts ?? {})
  )

  const { data: existing } = await db.from('bookings')
    .select('id, bookable_id, status')
    .eq('event_id', id)
    .eq('type', 'EVENT_DRIVEN')

  const existingActive = (existing ?? []).filter((b: any) => b.status !== 'CANCELLED')
  const existingIds = existingActive.map((b: any) => b.bookable_id as string)

  const toAdd = bookableIds.filter(bid => !existingIds.includes(bid))
  const toCancel = existingActive.filter((b: any) => !bookableIds.includes(b.bookable_id))

  const startAt = event.value?.start_at ?? null
  const endAt = event.value?.end_at ?? null

  if (toAdd.length && startAt && endAt) {
    await db.from('bookings').insert(
      toAdd.map(bid => ({
        bookable_id: bid,
        event_id: id,
        type: 'EVENT_DRIVEN',
        status: 'CONFIRMED',
        start_at: startAt,
        end_at: endAt,
        layout_name: layouts[bid] ?? null,
        purpose: event.value?.title ?? null,
        is_all_day: event.value?.is_all_day ?? false,
      }))
    )
  }

  if (toCancel.length) {
    await db.from('bookings')
      .update({ status: 'CANCELLED' })
      .in('id', toCancel.map((b: any) => b.id))
  }

  // Update layout on still-active bookings if it changed
  for (const b of existingActive.filter((b: any) => bookableIds.includes(b.bookable_id))) {
    const newLayout = layouts[b.bookable_id] ?? null
    await db.from('bookings').update({ layout_name: newLayout }).eq('id', b.id)
  }
}

async function updateVenueBookingTimes() {
  const startAt = event.value?.start_at ?? null
  const endAt = event.value?.end_at ?? null
  if (!startAt || !endAt) return
  await db.from('bookings')
    .update({ start_at: startAt, end_at: endAt, is_all_day: event.value?.is_all_day ?? false })
    .eq('event_id', id)
    .eq('type', 'EVENT_DRIVEN')
    .neq('status', 'CANCELLED')
}

const breadcrumbs = useBreadcrumbs()

// ---- Core event ----
const event = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const allCategories = ref<any[]>([])
const moreMenu = ref()
const moreMenuItems = computed(() => [
  { label: 'Duplicate', icon: 'pi pi-copy', command: () => {} },
  ...(event.value?.status === 'PUBLISHED' ? [{ separator: true }, { label: 'Unpublish', icon: 'pi pi-eye-slash', command: unpublishEvent }] : []),
  { separator: true },
  { label: 'Archive', icon: 'pi pi-trash', class: 'text-red-500', command: archiveEvent },
])

// ---- Edit form ----
const editForm = ref<any>({
  title: '',
  description: '',
  category_ids: [] as string[],
  is_all_day: false,
  start_date: null as Date | null,
  start_time: null as Date | null,
  end_date: null as Date | null,
  end_time: null as Date | null,
  repeat: '' as string,
  locations: [{ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] as string[] }] as LocationEntry[],
  is_public: false,
  is_featured: false,
  show_attendee_list: false,
  show_attendee_count: true,
  allow_interest: false,
  hold_spot_enabled: false,
  has_waitlist: false,
  has_capacity: false,
  capacity_max: null as number | null,
  custom_terms: [] as string[],
  allow_guests: false,
  phased_registration: false,
  member_window_days: 40,
  public_opens_at: null as Date | null,
  reg_open_at: null as Date | null,
  reg_close_at: null as Date | null,
})

const locationTypes = [
  { value: 'ADDRESS', label: 'Address', icon: 'pi-map-marker' },
  { value: 'BOOKABLE', label: 'Venue', icon: 'pi-building' },
  { value: 'ONLINE', label: 'Online', icon: 'pi-video' },
]

const settingsOptions = [
  { key: 'is_public', label: 'Public event', desc: 'Visible to anyone' },
  { key: 'is_featured', label: 'Featured', desc: 'Highlighted on member profiles' },
  { key: 'show_attendee_list', label: 'Show attendee list', desc: 'Members can see who is attending' },
  { key: 'show_attendee_count', label: 'Show attendee count', desc: 'Display registration numbers' },
  { key: 'allow_interest', label: 'Allow interest', desc: 'Members can indicate interest' },
  { key: 'hold_spot_enabled', label: 'Hold-spot registration', desc: 'Allow pending confirmation spots' },
]

// ---- Forms tab ----
const evtForm = reactive({
  form_name: 'Registration Form',
  form_fields: [] as { field_type: string; label: string; is_required: boolean; sort_order: number }[],
  has_terms: false,
  terms_text: '',
  payment_options: [] as string[],
  selectedFieldType: null as string | null,
})

const fieldTypes = [
  { label: 'Short Text', value: 'TEXT' },
  { label: 'Long Text', value: 'TEXTAREA' },
  { label: 'Number', value: 'NUMBER' },
  { label: 'Date', value: 'DATE' },
  { label: 'Checkbox', value: 'CHECKBOX' },
  { label: 'Select', value: 'SELECT' },
  { label: 'File Upload', value: 'FILE' },
]

const paymentOptions = [
  { label: 'Credit / Debit Card', value: 'card' },
  { label: 'Bank Transfer', value: 'bank' },
  { label: 'Cash on the Day', value: 'cash' },
  { label: 'Invoice', value: 'invoice' },
]

function fieldTypeIcon(type: string) {
  const map: Record<string, string> = { TEXT: 'pi-font', TEXTAREA: 'pi-align-left', NUMBER: 'pi-hashtag', DATE: 'pi-calendar', CHECKBOX: 'pi-check-square', SELECT: 'pi-list', FILE: 'pi-paperclip' }
  return map[type] ?? 'pi-circle'
}

function addFormField() {
  if (!evtForm.selectedFieldType) return
  const labels: Record<string, string> = { TEXT: 'Short answer', TEXTAREA: 'Long answer', NUMBER: 'Number', DATE: 'Date', CHECKBOX: 'Checkbox', SELECT: 'Dropdown', FILE: 'File upload' }
  evtForm.form_fields.push({ field_type: evtForm.selectedFieldType, label: labels[evtForm.selectedFieldType] ?? 'Field', is_required: false, sort_order: evtForm.form_fields.length })
  evtForm.selectedFieldType = null
}

const evtFormGroupsList = ref<{ id: string; name: string; person_type: string }[]>([
  { id: 'member-general', name: 'Member Registration', person_type: 'member' },
  { id: 'public-general', name: 'Public Registration', person_type: 'public' },
])
const evtFormGroupModes = reactive<Record<string, string>>({
  'member-general': '',
  'public-general': '',
})
type SessionDisplayMode = 'select' | 'info' | 'hidden'
const evtFormGroupSessions = reactive<Record<string, Record<string, SessionDisplayMode>>>({
  'member-general': {},
  'public-general': {},
})
const currentFormGroupSessions = computed(() => evtFormGroupSessions[selectedFormGroupId.value] ?? {})

function getSessionMode(sessionId: string): SessionDisplayMode {
  return currentFormGroupSessions.value[sessionId] ?? 'select'
}
function setSessionMode(sessionId: string, mode: SessionDisplayMode) {
  if (!evtFormGroupSessions[selectedFormGroupId.value]) evtFormGroupSessions[selectedFormGroupId.value] = {}
  evtFormGroupSessions[selectedFormGroupId.value][sessionId] = mode
}

function evtSelectAllFormSessions() {
  const map: Record<string, SessionDisplayMode> = {}
  sessions.value.filter((s: any) => s.display_on_form !== false).forEach((s: any) => {
    const sid = s.id ?? s._savedId
    if (sid) map[sid] = evtFormGroupSessions[selectedFormGroupId.value]?.[sid] ?? 'select'
  })
  evtFormGroupSessions[selectedFormGroupId.value] = map
}

const selectedFormGroupId = ref('member-general')
const evtFormShowSections = ref(false)
const evtSelectedFormSection = ref('')
watch(
  () => evtSelectedFormSection.value,
  (section) => {
    if (section !== 'sessions') return
    if (!Object.keys(evtFormGroupSessions[selectedFormGroupId.value] ?? {}).length) evtSelectAllFormSessions()
  }
)
const evtFormFieldsTab = ref('existing')
const evtFormTermsSelections = ref<string[]>([])
// Preview interactivity
const evtPreviewSessionSelections = ref<Record<number, Record<string, boolean>>>({})
function isSessionSelected(personIdx: number, sessionId: string, required: boolean): boolean {
  if (required) return true
  return evtPreviewSessionSelections.value[personIdx]?.[sessionId] ?? false
}
function togglePreviewSession(personIdx: number, sessionId: string) {
  const personMap = { ...(evtPreviewSessionSelections.value[personIdx] ?? {}) }
  personMap[sessionId] = !personMap[sessionId]
  evtPreviewSessionSelections.value = { ...evtPreviewSessionSelections.value, [personIdx]: personMap }
}
function isDateFullySelected(personIdx: number, dateLabel: string): boolean {
  const sessionsForDate = sessions.value.filter((s: any) => {
    const dl = s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
    return dl === dateLabel && !s.required && s.display_on_form !== false && sessionVisibleOnForm(s) && getSessionMode(s.id ?? s._savedId) === 'select'
  })
  return sessionsForDate.length > 0 && sessionsForDate.every((s: any) => evtPreviewSessionSelections.value[personIdx]?.[s.id ?? s._savedId])
}
function toggleDateSessions(personIdx: number, dateLabel: string) {
  const sessionsForDate = sessions.value.filter((s: any) => {
    const dl = s.start_at ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
    return dl === dateLabel && !s.required && s.display_on_form !== false && sessionVisibleOnForm(s) && getSessionMode(s.id ?? s._savedId) === 'select'
  })
  const allSelected = sessionsForDate.every((s: any) => evtPreviewSessionSelections.value[personIdx]?.[s.id ?? s._savedId])
  const personMap = { ...(evtPreviewSessionSelections.value[personIdx] ?? {}) }
  for (const s of sessionsForDate) personMap[s.id ?? s._savedId] = !allSelected
  evtPreviewSessionSelections.value = { ...evtPreviewSessionSelections.value, [personIdx]: personMap }
}
function isColumnFullySelected(personIdx: number, colIdx: number): boolean {
  const col = formSessionDateTable.value.columns[colIdx]
  if (!col) return false
  const colSessions = formSessionDateTable.value.rows
    .map(r => r.cells[colIdx])
    .filter((s): s is any => !!s && !s.required)
  return colSessions.length > 0 && colSessions.every((s: any) => evtPreviewSessionSelections.value[personIdx]?.[s.id ?? s._savedId])
}
function toggleAllColumnSessions(personIdx: number, colIdx: number) {
  const colSessions = formSessionDateTable.value.rows
    .map(r => r.cells[colIdx])
    .filter((s): s is any => !!s && !s.required)
  const allSelected = isColumnFullySelected(personIdx, colIdx)
  const personMap = { ...(evtPreviewSessionSelections.value[personIdx] ?? {}) }
  for (const s of colSessions) {
    personMap[s.id ?? s._savedId] = !allSelected
  }
  evtPreviewSessionSelections.value = { ...evtPreviewSessionSelections.value, [personIdx]: personMap }
}
const evtPreviewPayment = ref<string | null>(null)
const evtPreviewPlanFreq = ref<string>('')
const evtPreviewTermsAgreed = ref<Set<string>>(new Set())
const evtPreviewResponse = ref<string | null>(null)
const evtGroupPickerOpen = ref(false)
const evtGroupPickerHover = ref<string | null>(null)

function sessionFeeAmount(s: any): number | null {
  if (!s._feesConfig?.is_charged) return null
  if (s._feesConfig.all_charged_equally) {
    return (s._feesConfig.base_fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0)
  }
  const grp = s._feesConfig.groups?.find((g: any) => g.person_type === currentFormPersonType.value)
  if (grp) return (grp.fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0)
  return null
}

const formSessionDateTable = computed(() => {
  const visible = sessions.value.filter((s: any) =>
    s.display_on_form !== false &&
    sessionVisibleOnForm(s) &&
    getSessionMode(s.id ?? s._savedId) !== 'hidden' &&
    s.start_at  // exclude sessions without a date/time (they'd create an empty column)
  )
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })

  // Key columns by time range so sessions at the same time are in the same column
  const timeKeyOf = (s: any) => `${fmtTime(s.start_at)}|${s.end_at ? fmtTime(s.end_at) : ''}`
  const uniqueTimeKeys = [...new Set(visible.map(timeKeyOf))]
  const dateKeys = [...new Set(
    visible.filter((s: any) => s.start_at).map((s: any) => new Date(s.start_at).toDateString())
  )].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  const columns = uniqueTimeKeys.map(tk => {
    const inCol = visible.filter((s: any) => timeKeyOf(s) === tk)
    const rep = inCol[0]
    const fee = rep ? sessionFeeAmount(rep) : null
    // Use a common title only if every session in this time slot shares the same title
    const titles = [...new Set(inCol.map((s: any) => s.title || 'Untitled'))]
    return {
      key: tk,
      title: titles.length === 1 ? titles[0] : null,
      startTime: rep?.start_at ? fmtTime(rep.start_at) : null,
      endTime: rep?.end_at ? fmtTime(rep.end_at) : null,
      fee,
    }
  })

  const isoWeek = (d: Date) => {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
    return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  const rows = dateKeys.map((dk, i) => {
    const date = new Date(dk)
    const weekday = date.toLocaleDateString('en-AU', { weekday: 'long' })
    const dayMonth = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    const week = isoWeek(date)
    const prevWeek = i > 0 ? isoWeek(new Date(dateKeys[i - 1])) : week
    return {
      label: `${weekday} ${dayMonth}`,
      weekday,
      dayMonth,
      newWeek: i > 0 && week !== prevWeek,
      cells: uniqueTimeKeys.map(tk => {
        const s = visible.find((s: any) =>
          timeKeyOf(s) === tk &&
          s.start_at &&
          new Date(s.start_at).toDateString() === dk
        )
        return s ?? null
      }),
    }
  })

  return { columns, rows }
})

const formSessionGroupPicker = computed(() => {
  const visible = sessions.value.filter((s: any) =>
    s.display_on_form !== false &&
    sessionVisibleOnForm(s) &&
    getSessionMode(s.id ?? s._savedId) !== 'hidden'
  )
  const titleMap = new Map<string, any[]>()
  for (const s of visible) {
    const t = s.title || 'Untitled'
    if (!titleMap.has(t)) titleMap.set(t, [])
    titleMap.get(t)!.push(s)
  }
  return [...titleMap.entries()].map(([title, items]) => ({ title, items, hasChildren: items.length > 1 }))
})

const formPanelSessionsWithHeaders = computed(() => {
  const visible = sessions.value.filter((s: any) => s.display_on_form !== false && sessionVisibleOnForm(s))
  const result: Array<{ type: 'header'; label: string } | { type: 'session'; session: any }> = []
  let lastDate = ''
  for (const s of visible) {
    const dateLabel = s.start_at
      ? new Date(s.start_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
      : ''
    if (dateLabel && dateLabel !== lastDate) {
      result.push({ type: 'header', label: dateLabel })
      lastDate = dateLabel
    }
    result.push({ type: 'session', session: s })
  }
  return result
})

const simplePersonCount = ref(1)
const simpleOpenIdx = ref(0)
const simplePersonNames = ref<{ first: string; last: string }[]>([{ first: '', last: '' }])

watch(simplePersonCount, (n, prev) => {
  while (simplePersonNames.value.length < n) simplePersonNames.value.push({ first: '', last: '' })
  if (simplePersonNames.value.length > n) simplePersonNames.value.splice(n)
  if (n > prev) simpleOpenIdx.value = n - 1
})
function toggleEvtPreviewAgree(label: string) {
  const s = new Set(evtPreviewTermsAgreed.value)
  if (s.has(label)) s.delete(label); else s.add(label)
  evtPreviewTermsAgreed.value = s
}
const evtFormPayment = reactive({
  invoice: { enabled: false, bank_account: '' },
  plan: { enabled: false, frequencies: [] as string[], due_date: '', first_amount: 'scheduled', schedule_min: 'scheduled', schedule_min_value: '' },
  credit_card: { enabled: false },
  coupon: { enabled: false, quantity: 2 },
})

function toggleEvtPlanFrequency(f: string) {
  const idx = evtFormPayment.plan.frequencies.indexOf(f)
  if (idx >= 0) evtFormPayment.plan.frequencies.splice(idx, 1)
  else evtFormPayment.plan.frequencies.push(f)
}

watch(() => evtFormPayment.plan.frequencies, (freqs) => {
  if (freqs.length > 0 && !freqs.includes(evtPreviewPlanFreq.value)) evtPreviewPlanFreq.value = freqs[0]
  else if (freqs.length === 0) evtPreviewPlanFreq.value = ''
}, { immediate: true })


const evtPreviewPlanDay = ref('Monday')
const evtPreviewPlanDate = ref(1)
const weekDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const monthDates = Array.from({ length: 28 }, (_, i) => i + 1)
function ordinal(n: number) {
  const s = ['th','st','nd','rd']; const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
const evtPlanScheduleRows = computed(() => {
  const freq = evtPreviewPlanFreq.value
  const today = new Date()
  const fmt = (d: Date) => d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
  const rows: Array<[string, string]> = [['Payment 1', 'Due today']]
  if (freq === 'weekly' || freq === 'fortnightly') {
    const dayIdx = weekDays.indexOf(evtPreviewPlanDay.value)
    const domIdx = dayIdx === 6 ? 0 : dayIdx + 1
    const current = today.getDay()
    let diff = domIdx - current; if (diff <= 0) diff += 7
    const step = freq === 'weekly' ? 7 : 14
    for (let i = 1; i < 4; i++) {
      const d = new Date(today); d.setDate(today.getDate() + diff + (i - 1) * step)
      rows.push([`Payment ${i + 1}`, fmt(d)])
    }
  } else {
    for (let i = 1; i < 4; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, evtPreviewPlanDate.value)
      rows.push([`Payment ${i + 1}`, fmt(d)])
    }
  }
  return rows
})

// ── Form Fields ─────────────────────────────────────────────────────────────

interface FieldCondition {
  id: string
  field: string
  operator: string
  value: string
}

interface FinancialRule {
  id: string
  conditions: FieldCondition[]
  account_code: string
  fee_name: string
  fee_type: 'increase' | 'discount'
  amount: string
}

interface FormField {
  id: string
  label: string
  field_type: string
  is_required: boolean
  placeholder: string
  options?: string[]
  col_span?: 1 | 2
  // Extended editor fields
  system_name?: string
  has_placeholder?: boolean
  has_helper_text?: boolean
  helper_text?: string
  min_length?: number | null
  max_length?: number | null
  connected_to?: string
  has_visibility_conditions?: boolean
  visibility_conditions: FieldCondition[]
  financial_rules: FinancialRule[]
  has_financial_increase?: boolean
}

interface OrderRow { label: string; amount: number }

const evtFieldMeta: Record<string, { field_type: string; icon: string; placeholder: string; options?: string[] }> = {
  'First Name':           { field_type: 'text',     icon: 'pi-user',       placeholder: 'John' },
  'Last Name':            { field_type: 'text',     icon: 'pi-user',       placeholder: 'Smith' },
  'Email Address':        { field_type: 'email',    icon: 'pi-envelope',   placeholder: 'john@example.com' },
  'Phone Number':         { field_type: 'tel',      icon: 'pi-phone',      placeholder: '+64 21 000 0000' },
  'Date of Birth':        { field_type: 'date',     icon: 'pi-calendar',   placeholder: '' },
  'Member Number':        { field_type: 'text',     icon: 'pi-hashtag',    placeholder: 'e.g. M12345' },
  'Club':                 { field_type: 'text',     icon: 'pi-shield',     placeholder: 'Club name' },
  'Emergency Contact':    { field_type: 'text',     icon: 'pi-heart',      placeholder: 'Name and phone number' },
  'Medical Notes':        { field_type: 'textarea', icon: 'pi-file-edit',  placeholder: 'Any medical conditions we should know about' },
  'Dietary Requirements': { field_type: 'textarea', icon: 'pi-tag',        placeholder: 'e.g. Vegetarian, Gluten free' },
  'T-Shirt Size':         { field_type: 'select',   icon: 'pi-box',        placeholder: 'Select size', options: ['XS','S','M','L','XL','XXL'] },
  'Bus Pickup Location':  { field_type: 'select',   icon: 'pi-map-marker', placeholder: 'Select pickup location', options: ['City Centre','North Shore','South','West'] },
  'Team Name':            { field_type: 'text',     icon: 'pi-users',      placeholder: 'Team name' },
}

const evtAlwaysPresentFields = ['First Name', 'Last Name']

const evtFormGroupFields = reactive<Record<string, FormField[]>>({})
const currentEvtFormFields = computed(() => evtFormGroupFields[selectedFormGroupId.value] ?? [])

// All fields eligible as condition targets (always-present + added fields)
const evtConditionFieldOptions = computed(() => {
  const always = evtAlwaysPresentFields.map(label => ({ id: label, label }))
  const added = currentEvtFormFields.value.filter(f => !evtAlwaysPresentFields.includes(f.label))
  return [...always, ...added]
})

function ensureEvtGroupFields() {
  const gid = selectedFormGroupId.value
  if (!evtFormGroupFields[gid]) evtFormGroupFields[gid] = []
  return evtFormGroupFields[gid]
}

function isEvtFieldAdded(label: string) {
  return evtAlwaysPresentFields.includes(label) || currentEvtFormFields.value.some(f => f.label === label)
}

function addEvtFormField(label: string) {
  if (isEvtFieldAdded(label)) return
  const meta = evtFieldMeta[label] ?? { field_type: 'text', icon: 'pi-minus', placeholder: '' }
  ensureEvtGroupFields().push({ id: crypto.randomUUID(), label, field_type: meta.field_type, is_required: false, placeholder: meta.placeholder, options: meta.options, col_span: 1, visibility_conditions: [], financial_rules: [] })
}

function removeEvtFormField(id: string) {
  const fields = evtFormGroupFields[selectedFormGroupId.value]
  if (!fields) return
  const idx = fields.findIndex(f => f.id === id)
  if (idx >= 0) fields.splice(idx, 1)
}

function duplicateEvtFormField(id: string) {
  const fields = evtFormGroupFields[selectedFormGroupId.value]
  if (!fields) return
  const idx = fields.findIndex(f => f.id === id)
  if (idx < 0) return
  const original = fields[idx]
  const copy: FormField = {
    ...original,
    id: crypto.randomUUID(),
    label: original.label + ' (copy)',
    system_name: original.system_name ? original.system_name + '_copy' : undefined,
    visibility_conditions: original.visibility_conditions.map(c => ({ ...c, id: crypto.randomUUID() })),
    financial_rules: original.financial_rules.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      conditions: r.conditions.map(c => ({ ...c, id: crypto.randomUUID() })),
    })),
  }
  fields.splice(idx + 1, 0, copy)
  evtSelectedFieldId.value = copy.id
}

function toggleEvtFieldRequired(id: string) {
  const fields = evtFormGroupFields[selectedFormGroupId.value]
  const f = fields?.find(f => f.id === id)
  if (f) f.is_required = !f.is_required
}

const isDraggingField = ref(false)
const dropZoneActive = ref(false)

function startEvtFieldDrag(e: DragEvent, label: string) {
  e.dataTransfer!.effectAllowed = 'copy'
  e.dataTransfer!.setData('application/x-field', label)
  isDraggingField.value = true
}

function onEvtFieldDragEnd() {
  isDraggingField.value = false
  dropZoneActive.value = false
}

function onDropField(e: DragEvent) {
  e.preventDefault()
  const label = e.dataTransfer?.getData('application/x-field')
  if (label) addEvtFormField(label)
  isDraggingField.value = false
  dropZoneActive.value = false
}

const evtNewFieldDraft = reactive({ label: '', field_type: 'text', placeholder: '' })
const customFieldTypes = [
  { value: 'text',     label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email',    label: 'Email' },
  { value: 'tel',      label: 'Phone' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
]

const evtSelectedFieldId = ref<string | null>(null)
const evtEditingField = computed(() => currentEvtFormFields.value.find(f => f.id === evtSelectedFieldId.value) ?? null)

function saveEvtNewField() {
  if (!evtNewFieldDraft.label.trim()) return
  const field: FormField = {
    id: crypto.randomUUID(),
    label: evtNewFieldDraft.label.trim(),
    field_type: evtNewFieldDraft.field_type,
    is_required: false,
    placeholder: evtNewFieldDraft.placeholder.trim(),
    connected_to: 'none',
    col_span: 1,
    visibility_conditions: [],
    financial_rules: [],
  }
  ensureEvtGroupFields().push(field)
  evtNewFieldDraft.label = ''
  evtNewFieldDraft.placeholder = ''
  evtNewFieldDraft.field_type = 'text'
  evtSelectedFieldId.value = field.id
}

// Used by the block picker's Custom Field sub-panel "Add Field to Form" button
function saveEvtNewFieldBlock() {
  saveEvtNewField()
  evtNewBlockType.value = null
}

function openEvtFieldEditor(id: string) {
  evtSelectedFieldId.value = id
  evtSelectedFormSection.value = 'fields'
}

function evtInputTypesFor(field: FormField) {
  if (['text','email','tel','number'].includes(field.field_type)) {
    return [
      { value: 'text',   label: 'Text' },
      { value: 'number', label: 'Number' },
      { value: 'email',  label: 'Email' },
      { value: 'tel',    label: 'Phone' },
    ]
  }
  if (field.field_type === 'textarea') {
    return [{ value: 'textarea', label: 'Long Text' }, { value: 'text', label: 'Short Text' }]
  }
  if (['select','checkbox'].includes(field.field_type)) {
    return [{ value: 'select', label: 'Dropdown' }, { value: 'checkbox', label: 'Checkbox' }]
  }
  if (field.field_type === 'date') {
    return [{ value: 'date', label: 'Date' }]
  }
  return [{ value: field.field_type, label: field.field_type }]
}

const connectionOptions = [
  { value: 'profile', label: 'Profile\nData', icon: 'pi-users' },
  { value: 'event',   label: 'This\nEvent',   icon: 'pi-calendar' },
] as const

// ── Field Editor Tab ─────────────────────────────────────────────────────────
const evtFieldEditorTab = ref<'details' | 'advanced'>('details')

// ── Condition / Rule helpers ──────────────────────────────────────────────────
const evtConditionFields = ['Attendee type', 'Gender', 'Age', 'Member type', 'Club', 'Division', 'Grade', 'Session']
const evtConditionOperators = ['Equals', 'Is Not', 'Contains', 'Is Empty', 'Is Not Empty']
const evtAccountCodes = ['ACC-001', 'ACC-002', 'ACC-003', 'ACC-004', 'ACC-005']

function makeEvtCondition(): FieldCondition {
  return { id: crypto.randomUUID(), field: '', operator: 'Equals', value: '' }
}
function makeEvtFinancialRule(): FinancialRule {
  return { id: crypto.randomUUID(), conditions: [makeEvtCondition()], account_code: '', fee_name: '', fee_type: 'increase', amount: '' }
}
function addEvtVisibilityCondition(field: FormField | null) {
  if (!field) return
  field.visibility_conditions.push(makeEvtCondition())
}
function removeEvtVisibilityCondition(field: FormField | null, id: string) {
  if (!field) return
  const idx = field.visibility_conditions.findIndex(c => c.id === id)
  if (idx >= 0) field.visibility_conditions.splice(idx, 1)
}
function addEvtFinancialRule(field: FormField | null) {
  if (!field) return
  field.financial_rules.push(makeEvtFinancialRule())
}
function removeEvtFinancialRule(field: FormField | null, id: string) {
  if (!field) return
  const idx = field.financial_rules.findIndex(r => r.id === id)
  if (idx >= 0) field.financial_rules.splice(idx, 1)
}
function addEvtFinancialCondition(rule: FinancialRule) {
  rule.conditions.push(makeEvtCondition())
}
function removeEvtFinancialCondition(rule: FinancialRule, id: string) {
  const idx = rule.conditions.findIndex(c => c.id === id)
  if (idx >= 0) rule.conditions.splice(idx, 1)
}

// ── Block state (Create New panel) ────────────────────────────────────────────
const evtNewBlockType = ref<'section' | 'image' | 'text' | 'button' | 'field' | null>(null)
const evtBlockTypes = [
  { type: 'section', label: 'Section',      description: 'Group fields under a heading',  icon: 'pi-th-large',      color: 'bg-purple-50 text-purple-500' },
  { type: 'image',   label: 'Image',        description: 'Upload an image or banner',     icon: 'pi-image',         color: 'bg-green-50 text-green-500' },
  { type: 'text',    label: 'Text',         description: 'Add instructional text',        icon: 'pi-align-left',    color: 'bg-orange-50 text-orange-500' },
  { type: 'button',  label: 'Button',       description: 'Add a link button',             icon: 'pi-external-link', color: 'bg-pink-50 text-pink-500' },
  { type: 'field',   label: 'Custom Field', description: 'Collect a piece of data',       icon: 'pi-list',          color: 'bg-blue-50 text-blue-500' },
] as const

const evtNewSectionDraft = reactive({ label: '', description: '', has_visibility: false, conditions: [] as FieldCondition[] })
const evtNewImageDraft = reactive({ src: '', alt: '', align: 'center' })
const evtNewTextDraft = reactive({ content: '', size: 'base' })
const evtNewButtonDraft = reactive({ label: '', url: '', style: 'primary' })

function saveEvtNewSection() {
  if (!evtNewSectionDraft.label.trim()) return
  ensureEvtGroupFields().push({
    id: crypto.randomUUID(),
    label: evtNewSectionDraft.label.trim(),
    field_type: 'section',
    is_required: false,
    placeholder: evtNewSectionDraft.description.trim(),
    col_span: 2,
    visibility_conditions: evtNewSectionDraft.has_visibility ? [...evtNewSectionDraft.conditions] : [],
    financial_rules: [],
  })
  Object.assign(evtNewSectionDraft, { label: '', description: '', has_visibility: false, conditions: [] })
  evtNewBlockType.value = null
}

function saveEvtNewBlock(type: 'image' | 'text' | 'button') {
  const drafts: Record<string, any> = { image: evtNewImageDraft, text: evtNewTextDraft, button: evtNewButtonDraft }
  const draft = drafts[type]
  ensureEvtGroupFields().push({
    id: crypto.randomUUID(),
    label: type === 'image' ? (evtNewImageDraft.alt || 'Image') : type === 'text' ? 'Text Block' : evtNewButtonDraft.label || 'Button',
    field_type: type,
    is_required: false,
    placeholder: '',
    col_span: 2,
    visibility_conditions: [],
    financial_rules: [],
    options: type === 'image' ? [evtNewImageDraft.src, evtNewImageDraft.alt, evtNewImageDraft.align]
              : type === 'text' ? [evtNewTextDraft.content, evtNewTextDraft.size]
              : [evtNewButtonDraft.label, evtNewButtonDraft.url, evtNewButtonDraft.style],
  })
  if (type === 'image') Object.assign(evtNewImageDraft, { src: '', alt: '', align: 'center' })
  if (type === 'text') Object.assign(evtNewTextDraft, { content: '', size: 'base' })
  if (type === 'button') Object.assign(evtNewButtonDraft, { label: '', url: '', style: 'primary' })
  evtNewBlockType.value = null
}

// ── Accordion / person preview ────────────────────────────────────────────────
const evtAccordionPersonCount = ref(1)
const evtAccordionOpenIdx = ref(0)
const evtPersonValues = ref<Record<string, any>[]>([{}])

function addEvtAccordionPerson() {
  evtAccordionPersonCount.value++
  evtPersonValues.value.push({})
  evtAccordionOpenIdx.value = evtAccordionPersonCount.value - 1
}
function removeEvtAccordionPerson(idx: number) {
  if (evtAccordionPersonCount.value <= 1) return
  evtAccordionPersonCount.value--
  evtPersonValues.value.splice(idx, 1)
  if (evtAccordionOpenIdx.value >= evtAccordionPersonCount.value) {
    evtAccordionOpenIdx.value = evtAccordionPersonCount.value - 1
  }
}

// ── Order / financial preview ─────────────────────────────────────────────────
// Base registration fee = sum of all event-level fee components
const evtBaseRegistrationFee = computed(() =>
  feeLineItems.value.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
)

function getEvtPersonFieldValue(personIdx: number, fieldLabel: string): string {
  return evtPersonValues.value[personIdx]?.[fieldLabel] ?? ''
}

function evaluateEvtConditions(conditions: FieldCondition[], personIdx: number): boolean {
  return conditions.every(c => {
    const val = getEvtPersonFieldValue(personIdx, c.field)
    if (c.operator === 'Is Empty') return !val
    if (c.operator === 'Is Not Empty') return !!val
    if (c.operator === 'Equals') return val === c.value
    if (c.operator === 'Is Not') return val !== c.value
    if (c.operator === 'Contains') return val.includes(c.value)
    return true
  })
}

const evtOrderRows = computed<OrderRow[][]>(() => {
  const result: OrderRow[][] = []
  for (let i = 0; i < evtAccordionPersonCount.value; i++) {
    // Start with the actual event fee components as rows
    const rows: OrderRow[] = feeLineItems.value.length
      ? feeLineItems.value.map(f => ({ label: f.name || 'Registration Fee', amount: Number(f.amount) || 0 }))
      : [{ label: 'Registration Fee', amount: 0 }]
    // Add field-level financial rules on top
    for (const field of currentEvtFormFields.value) {
      for (const rule of field.financial_rules) {
        if (evaluateEvtConditions(rule.conditions, i)) {
          const amt = parseFloat(rule.amount) || 0
          rows.push({ label: rule.fee_name || field.label, amount: rule.fee_type === 'discount' ? -amt : amt })
        }
      }
    }
    // Add selected (or required) session fees — one line per session with date/time
    const visibleSessions = sessions.value.filter((s: any) =>
      s.display_on_form !== false &&
      sessionVisibleOnForm(s) &&
      getSessionMode(s.id ?? s._savedId) !== 'hidden'
    )
    for (const s of visibleSessions) {
      const sid = s.id ?? s._savedId
      if (s.required || evtPreviewSessionSelections.value[i]?.[sid]) {
        const fee = sessionFeeAmount(s) ?? 0
        const title = s.title || 'Session'
        let dateStr = ''
        if (s.start_at) {
          const d = new Date(s.start_at)
          dateStr = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
          dateStr += ' ' + d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
        }
        rows.push({ label: dateStr ? `${title} · ${dateStr}` : title, amount: fee })
      }
    }
    result.push(rows)
  }
  return result
})

const evtOrderTotal = computed(() =>
  evtOrderRows.value.reduce((sum, rows) => sum + rows.reduce((s, r) => s + r.amount, 0), 0)
)

const evtTotalDiscountSavings = computed(() =>
  evtDiscountSummaryLines.value.reduce((sum, d) => sum + d.amount, 0)
)

function evalDiscountOp(actual: number, op: string, expected: number): boolean {
  switch (op) {
    case '>=': return actual >= expected
    case '>':  return actual > expected
    case '<=': return actual <= expected
    case '<':  return actual < expected
    case '=':  return actual === expected
    default:   return true
  }
}

const evtApplicableDiscounts = computed<{ name: string; formText: string; amount: number }[][]>(() => {
  const personCount = evtAccordionPersonCount.value
  return Array.from({ length: personCount }, (_, i) => {
    const rows = evtOrderRows.value[i] ?? []
    const positiveAmounts = rows.filter(r => r.amount > 0).map(r => r.amount)
    const personTotal = rows.reduce((s, r) => s + r.amount, 0)

    const selectedSessionCount = sessions.value.filter((s: any) => {
      const sid = s.id ?? s._savedId
      return s.display_on_form !== false &&
        sessionVisibleOnForm(s) &&
        getSessionMode(sid) !== 'hidden' &&
        (s.required || evtPreviewSessionSelections.value[i]?.[sid])
    }).length

    const applicableDiscounts: { name: string; formText: string; amount: number }[] = []

    for (const disc of eventDiscounts.value.filter((d: any) => d.is_active)) {
      let met = true
      for (const cond of (disc.conditions ?? [])) {
        switch (cond.key) {
          case 'registration_group_size_min':
            if (!evalDiscountOp(personCount, cond.operator, cond.value)) met = false; break
          case 'booked_session_count_min':
            if (!evalDiscountOp(selectedSessionCount, cond.operator, cond.value)) met = false; break
          case 'registration_date_before':
            if (cond.value && new Date() > new Date(cond.value)) met = false; break
          case 'registration_total_value_min':
            if (!evalDiscountOp(personTotal, cond.operator, Number(cond.value))) met = false; break
          case 'promo_code':
            met = false; break
          // participant/membership conditions can't be evaluated from form state — assume met
        }
      }
      if (!met) continue

      const v = Number(disc.modifier_value ?? 0)
      let amount = 0
      switch (disc.apply_to ?? 'per_session') {
        case 'per_session':
          amount = disc.modifier_type === 'PERCENT'
            ? positiveAmounts.reduce((s: number, a: number) => s + a * v / 100, 0)
            : positiveAmounts.length * v
          break
        case 'per_person':
          amount = disc.modifier_type === 'PERCENT' ? personTotal * v / 100 : v
          break
        case 'cheapest_item':
          if (positiveAmounts.length) {
            const cheapest = Math.min(...positiveAmounts)
            amount = disc.modifier_type === 'PERCENT' ? cheapest * v / 100 : Math.min(v, cheapest)
          }
          break
        case 'most_expensive_item':
          if (positiveAmounts.length) {
            const expensive = Math.max(...positiveAmounts)
            amount = disc.modifier_type === 'PERCENT' ? expensive * v / 100 : Math.min(v, expensive)
          }
          break
        case 'registration_total':
          amount = disc.modifier_type === 'PERCENT' ? personTotal * v / 100 : Math.min(v, personTotal)
          break
      }

      if (amount > 0) applicableDiscounts.push({ name: disc.name, formText: disc.form_text || disc.name, amount })
    }

    return applicableDiscounts
  })
})

// Aggregated discount lines for display: sums each discount across all persons,
// and respects one_discount_only by keeping only the best per person before summing.
const evtDiscountSummaryLines = computed<{ formText: string; amount: number }[]>(() => {
  const all = evtApplicableDiscounts.value
  const map = new Map<string, { formText: string; amount: number }>()
  for (const perPerson of all) {
    const relevant = evtDiscountSettings.one_discount_only && perPerson.length > 1
      ? [perPerson.reduce((a, b) => a.amount >= b.amount ? a : b)]
      : perPerson
    for (const disc of relevant) {
      const existing = map.get(disc.name)
      if (existing) existing.amount += disc.amount
      else map.set(disc.name, { formText: disc.formText, amount: disc.amount })
    }
  }
  return Array.from(map.values())
})

const systemFields = ['First Name', 'Last Name', 'Email Address', 'Phone Number', 'Date of Birth']
const personFields = ['Member Number', 'Club', 'Emergency Contact', 'Medical Notes', 'Dietary Requirements']
const previousEventFields = ['T-Shirt Size', 'Bus Pickup Location', 'Team Name']
const availableTerms = ref([
  { label: 'NZ Sport Terms', required: true, agreeText: 'I agree to NZ Sport Terms' },
  { label: 'Photos Policy', required: false, agreeText: 'I agree to the Photos Policy' },
  { label: 'Waiver Agreement', required: false, agreeText: 'I agree to the Waiver Agreement' },
])

const evtFormTermsShown = computed(() => [
  { label: 'Club T&C', agreeText: 'I agree to the Club T&C' },
  ...availableTerms.value.filter(t => t.required).map(t => ({ label: t.label, agreeText: t.agreeText })),
  ...availableTerms.value.filter(t => !t.required && evtFormTermsSelections.value.includes(t.label)).map(t => ({ label: t.label, agreeText: t.agreeText })),
])

const showEvtTCModal = ref(false)
const evtTCDraft = reactive({ label: '', text: '', agreeText: '' })
function saveEvtTCDraft() {
  if (!evtTCDraft.label.trim()) return
  availableTerms.value.push({ label: evtTCDraft.label.trim(), required: false, agreeText: evtTCDraft.agreeText.trim() || `I agree to the ${evtTCDraft.label.trim()}` })
  evtFormTermsSelections.value.push(evtTCDraft.label.trim())
  showEvtTCModal.value = false
  Object.assign(evtTCDraft, { label: '', text: '', agreeText: '' })
}

const evtEditingTCLabel = ref<string | null>(null)
const evtTCEditAgreeText = ref('')
function openEvtEditTC(tc: { label: string; agreeText: string }) {
  evtEditingTCLabel.value = tc.label
  evtTCEditAgreeText.value = tc.agreeText
}
function saveEvtEditTC() {
  const idx = availableTerms.value.findIndex(t => t.label === evtEditingTCLabel.value)
  if (idx >= 0) availableTerms.value[idx].agreeText = evtTCEditAgreeText.value.trim() || `I agree to the ${availableTerms.value[idx].label}`
  evtEditingTCLabel.value = null
}

function toggleEvtTerms(label: string) {
  const idx = evtFormTermsSelections.value.indexOf(label)
  if (idx === -1) evtFormTermsSelections.value.push(label)
  else evtFormTermsSelections.value.splice(idx, 1)
}
const evtFormGroupDesigns = reactive<Record<string, any>>({
  'member-general': { style: 'single', header: 'event', headerImage: '', icons: { date: true, time: true, cost: true, location: true, criteria: true }, description: 'event', customDescription: '', background: 'default', backgroundImage: '', backgroundColor: '#fefefe', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundOverlay: 1, sponsors: 'show', showSessions: true, sessionsHeading: 'Sessions', sessionsLayout: 'list', sessionsGroupLabel: '', formHeading: 'Fill in the form to register', addPersonColor: '#0e43a3' },
  'public-general': { style: 'single', header: 'event', headerImage: '', icons: { date: true, time: true, cost: true, location: true, criteria: true }, description: 'event', customDescription: '', background: 'default', backgroundImage: '', backgroundColor: '#fefefe', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundOverlay: 1, sponsors: 'show', showSessions: true, sessionsHeading: 'Sessions', sessionsLayout: 'list', sessionsGroupLabel: '', formHeading: 'Fill in the form to register', addPersonColor: '#0e43a3' },
})
const currentEvtFormDesign = computed(() => evtFormGroupDesigns[selectedFormGroupId.value] ?? evtFormGroupDesigns['member-general'])

function handleEvtFormImageUpload(field: 'headerImage' | 'backgroundImage', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { currentEvtFormDesign.value[field] = ev.target?.result as string }
  reader.readAsDataURL(file)
}

const evtFormGroups = computed(() =>
  evtFormGroupsList.value.map(({ id, name }) => {
    const mode = evtFormGroupModes[id] ?? ''
    const saved = evtFormSectionSaved[id] ?? {}
    const totalCount = mode === 'simple' ? 3 : 4
    const allSaved = mode === 'simple'
      ? (!!saved.design && !!saved.terms && !!saved.payment)
      : !!(mode && saved.design && saved.fields && saved.terms && saved.payment)
    return {
      id, name,
      complete: allSaved,
      noRegistrations: mode === 'none',
      notSetUp: !mode,
      filledCount: Object.keys(saved).length,
      totalCount,
    }
  })
)

const showAddFormDialog = ref(false)
const newFormName = ref('')
const newFormPersonType = ref('member')

function openAddFormDialog() {
  newFormName.value = ''
  newFormPersonType.value = 'member'
  showAddFormDialog.value = true
}

function confirmAddEvtFormGroup() {
  const name = newFormName.value.trim() || `Form ${evtFormGroupsList.value.length + 1}`
  const newId = crypto.randomUUID()
  evtFormGroupsList.value.push({ id: newId, name, person_type: newFormPersonType.value })
  evtFormGroupModes[newId] = ''
  evtFormGroupSessions[newId] = {}
  evtFormGroupDesigns[newId] = { ...evtFormGroupDesigns['member-general'] }
  showAddFormDialog.value = false
  selectEvtFormGroup(newId)
}

const formToDelete = ref<string | null>(null)

function removeEvtFormGroup(id: string) {
  const idx = evtFormGroupsList.value.findIndex(g => g.id === id)
  if (idx === -1) return
  evtFormGroupsList.value.splice(idx, 1)
  if (selectedFormGroupId.value === id) {
    selectedFormGroupId.value = evtFormGroupsList.value[0]?.id ?? 'member-general'
    evtFormShowSections.value = false
  }
  formToDelete.value = null
}

const currentEvtFormGroupName = computed(() =>
  evtFormGroupsList.value.find(g => g.id === selectedFormGroupId.value)?.name ?? ''
)

const currentFormPersonType = computed(() =>
  evtFormGroupsList.value.find(g => g.id === selectedFormGroupId.value)?.person_type ?? 'public'
)

function sessionVisibleOnForm(s: any): boolean {
  const modes: string[] = s._inviteeModes ?? ['all_members']
  const pt = currentFormPersonType.value
  if (pt === 'public')  return modes.includes('public')
  if (pt === 'member')  return modes.includes('all_members') || modes.includes('groups')
  if (pt === 'guest')   return modes.includes('invitees')
  return true
}

const evtFormSectionSaved = reactive<Record<string, Record<string, boolean>>>({})

function saveEvtFormSection(sectionId: string) {
  const gid = selectedFormGroupId.value
  if (!evtFormSectionSaved[gid]) evtFormSectionSaved[gid] = {}
  evtFormSectionSaved[gid][sectionId] = true
  evtSelectedFormSection.value = ''
  persistEvtFormConfig()
}

function buildEvtFormConfig() {
  return {
    groups: evtFormGroupsList.value,
    modes: { ...evtFormGroupModes },
    designs: { ...evtFormGroupDesigns },
    sessions: { ...evtFormGroupSessions },
    sectionSaved: { ...evtFormSectionSaved },
    payment: JSON.parse(JSON.stringify(evtFormPayment)),
    terms: evtFormTermsSelections.value,
    discountSettings: { ...evtDiscountSettings },
    groupFields: JSON.parse(JSON.stringify(evtFormGroupFields)),
  }
}

let _formSaveTimer: ReturnType<typeof setTimeout> | null = null
function persistEvtFormConfig() {
  if (_formSaveTimer) clearTimeout(_formSaveTimer)
  _formSaveTimer = setTimeout(async () => {
    const formId = event.value?.form_id
    if (!formId) return
    await db.from('registration_forms').update({ config: buildEvtFormConfig() }).eq('id', formId)
  }, 600)
}

async function loadEvtFormConfig() {
  const formId = event.value?.form_id
  if (!formId) return
  const { data } = await db.from('registration_forms').select('config').eq('id', formId).single()
  const c = data?.config
  if (!c || !Object.keys(c).length) return
  if (c.groups?.length) {
    evtFormGroupsList.value = c.groups
    c.groups.forEach((g: any) => {
      if (!(g.id in evtFormGroupModes)) evtFormGroupModes[g.id] = ''
      if (!(g.id in evtFormGroupDesigns)) evtFormGroupDesigns[g.id] = { ...evtFormGroupDesigns['member-general'] }
    })
  }
  if (c.modes) Object.assign(evtFormGroupModes, c.modes)
  if (c.designs) {
    Object.keys(c.designs).forEach(k => { evtFormGroupDesigns[k] = c.designs[k] })
  }
  if (c.sessions) Object.assign(evtFormGroupSessions, c.sessions)
  if (c.sectionSaved) Object.assign(evtFormSectionSaved, c.sectionSaved)
  if (c.payment) {
    Object.assign(evtFormPayment.invoice, c.payment.invoice ?? {})
    Object.assign(evtFormPayment.plan, c.payment.plan ?? {})
    Object.assign(evtFormPayment.credit_card, c.payment.credit_card ?? {})
    Object.assign(evtFormPayment.coupon, c.payment.coupon ?? {})
  }
  if (c.terms) evtFormTermsSelections.value = c.terms
  if (c.discountSettings) Object.assign(evtDiscountSettings, c.discountSettings)
  if (c.groupFields) {
    Object.keys(c.groupFields).forEach(k => { evtFormGroupFields[k] = c.groupFields[k] })
  }
}

const evtFormSections = computed(() => {
  const mode = evtFormGroupModes[selectedFormGroupId.value]
  const saved = evtFormSectionSaved[selectedFormGroupId.value] ?? {}
  const eligibleSessions = sessions.value.filter((s: any) => s.display_on_form !== false)
  const hasSessions = eligibleSessions.length > 0
  const sessionMap = evtFormGroupSessions[selectedFormGroupId.value] ?? {}
  const visibleCount = eligibleSessions.filter((s: any) => {
    const mode = sessionMap[s.id ?? s._savedId]
    return !mode || mode !== 'hidden'
  }).length
  const selectCount = eligibleSessions.filter((s: any) => {
    const m = sessionMap[s.id ?? s._savedId] ?? 'select'
    return m === 'select'
  }).length
  const infoCount = eligibleSessions.filter((s: any) => {
    const m = sessionMap[s.id ?? s._savedId] ?? 'select'
    return m === 'info'
  }).length
  const sessionsComplete = hasSessions
  const parts = []
  if (selectCount) parts.push(`${selectCount} selectable`)
  if (infoCount) parts.push(`${infoCount} info`)
  const sessionsSubtitle = hasSessions ? (parts.length ? parts.join(', ') : `${eligibleSessions.length} selectable`) : 'Not configured'
  if (mode === 'simple') return [
    ...(hasSessions ? [{ id: 'sessions', index: 1, label: 'Sessions', icon: 'pi-calendar', complete: sessionsComplete, subtitle: sessionsSubtitle }] : []),
    { id: 'design', index: hasSessions ? 2 : 1, label: 'Design', icon: 'pi-pencil', complete: !!saved.design, subtitle: null },
    { id: 'terms', index: hasSessions ? 3 : 2, label: 'Terms & Conditions', icon: 'pi-file', complete: !!saved.terms, subtitle: null },
    { id: 'payment', index: hasSessions ? 4 : 3, label: 'Payment Options', icon: 'pi-credit-card', complete: !!saved.payment, subtitle: null },
  ]
  return [
    ...(hasSessions ? [{ id: 'sessions', index: 1, label: 'Sessions', icon: 'pi-calendar', complete: sessionsComplete, subtitle: sessionsSubtitle }] : []),
    { id: 'design', index: hasSessions ? 2 : 1, label: 'Design', icon: 'pi-pencil', complete: !!saved.design, subtitle: null },
    { id: 'fields', index: hasSessions ? 3 : 2, label: 'Form', icon: 'pi-list', complete: !!saved.fields, subtitle: null },
    { id: 'terms', index: hasSessions ? 4 : 3, label: 'Terms & Conditions', icon: 'pi-file', complete: !!saved.terms, subtitle: null },
    { id: 'payment', index: hasSessions ? 5 : 4, label: 'Payment Options', icon: 'pi-credit-card', complete: !!saved.payment, subtitle: null },
  ]
})

const evtFormSectionCompletedCount = computed(() => evtFormSections.value.filter(s => s.complete).length)

function selectEvtFormGroup(id: string) {
  selectedFormGroupId.value = id
  evtSelectedFormSection.value = ''
  evtFormShowSections.value = !!evtFormGroupModes[id] && evtFormGroupModes[id] !== 'none'
}

function chooseEvtFormType(mode: string) {
  evtFormGroupModes[selectedFormGroupId.value] = mode
  evtFormShowSections.value = mode !== 'none'
  evtSelectedFormSection.value = ''
}

function changeEvtFormType() {
  evtFormGroupModes[selectedFormGroupId.value] = ''
  evtFormShowSections.value = false
  evtSelectedFormSection.value = ''
}

function toggleEvtPaymentOption(value: string) {
  const idx = evtForm.payment_options.indexOf(value)
  if (idx >= 0) evtForm.payment_options.splice(idx, 1)
  else evtForm.payment_options.push(value)
}

// ---- Tickets tab ----
const hasTickets = ref(false)
const ticketTypes = ref<any[]>([])
const ticketOrders = ref<any[]>([])
const showTicketDialog = ref(false)
const showQrDialog = ref(false)
const qrOrder = ref<any>(null)
const editingTicket = ref<any>(null)
const ticketDraft = ref<any>(null)

const eventLevelTickets = computed(() => ticketTypes.value.filter(t => !t.session_id))
const sessionTicketMap = computed(() => {
  const map: Record<string, any[]> = {}
  for (const tt of ticketTypes.value.filter(t => t.session_id)) {
    if (!map[tt.session_id]) map[tt.session_id] = []
    map[tt.session_id].push(tt)
  }
  return map
})

function ticketOnSaleLabel(tt: any) {
  if (tt.sales_open_at && tt.sales_close_at)
    return `${new Date(tt.sales_open_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${new Date(tt.sales_close_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
  if (tt.sales_open_at)
    return `From ${new Date(tt.sales_open_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
  if (tt.sales_close_at)
    return `Until ${new Date(tt.sales_close_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
  return 'Always'
}

function ticketSessionDateLabel(sess: any) {
  if (!sess.start_at) return ''
  return new Date(sess.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
}

async function saveHasTickets(val: boolean) {
  const id = route.params.id as string
  await db.from('events').update({ has_tickets: val }).eq('id', id)
}

function openTicketDialog(tt: any | null, sessionId: string | null) {
  editingTicket.value = tt
  ticketDraft.value = tt
    ? { ...tt }
    : { name: '', description: '', price: 0, capacity: null, sales_open_at: null, sales_close_at: null, is_active: true, session_id: sessionId, event_id: route.params.id }
  showTicketDialog.value = true
}

async function saveTicketType(tt: any) {
  if (!tt?.name) return
  const id = route.params.id as string
  const payload = {
    event_id: id,
    session_id: tt.session_id ?? null,
    name: tt.name,
    description: tt.description || null,
    price: tt.price ?? 0,
    capacity: tt.capacity ?? null,
    sales_open_at: tt.sales_open_at ?? null,
    sales_close_at: tt.sales_close_at ?? null,
    is_active: tt.is_active ?? true,
  }
  if (tt.id) {
    await db.from('ticket_types').update(payload).eq('id', tt.id)
  } else {
    const { data } = await db.from('ticket_types').insert(payload).select('id').single()
    if (data?.id) tt.id = data.id
  }
  showTicketDialog.value = false
  await loadTicketTypes()
}

async function deleteTicketType(id: string) {
  await db.from('ticket_types').delete().eq('id', id)
  await loadTicketTypes()
}

async function loadTicketTypes() {
  const id = route.params.id as string
  const { data } = await db.from('ticket_types').select('*').eq('event_id', id).order('sort_order').order('created_at')
  ticketTypes.value = data ?? []
}

async function loadTicketOrders() {
  const id = route.params.id as string
  const { data } = await db
    .from('registrations')
    .select(`id, guest_name, guest_email, status, total_amount, ticket_id, checked_in_at,
      registration_ticket_items(id, quantity, unit_price, subtotal, ticket_types(name))`)
    .eq('event_id', id)
    .not('ticket_id', 'is', null)
    .order('created_at', { ascending: false })
  ticketOrders.value = (data ?? []).map((r: any) => ({
    ...r,
    items: (r.registration_ticket_items ?? []).map((i: any) => ({
      ...i,
      ticket_type_name: i.ticket_types?.name ?? '—',
    })),
  }))
}

function showQr(order: any) {
  qrOrder.value = order
  showQrDialog.value = true
}

async function checkInOrder(registrationId: string) {
  await db.from('registrations').update({ checked_in_at: new Date().toISOString() }).eq('id', registrationId)
  await loadTicketOrders()
}

// ---- Discounts tab ----
const eventDiscounts = ref<any[]>([])
const evtDiscountSettings = reactive({ one_discount_only: false })

// Auto-save form config whenever any form-builder state changes
watch(
  [evtFormPayment, evtFormTermsSelections, evtDiscountSettings],
  () => persistEvtFormConfig(),
  { deep: true }
)
watch(
  [evtFormGroupModes, evtFormGroupDesigns, evtFormGroupSessions, evtFormGroupsList, evtFormGroupFields],
  () => persistEvtFormConfig(),
  { deep: true }
)

async function loadDiscounts() {
  const { data } = await db.from('discounts').select('*').eq('event_id', id).order('created_at')
  if (data) eventDiscounts.value = data
}
const showDiscountDialog = ref(false)
const editingDiscountIdx = ref<number | null>(null)

const discountTypes = [
  { label: '% Off', value: 'PERCENT' },
  { label: '$ Off', value: 'FLAT' },
]
const applyToOptions = [
  { label: 'Per Person', value: 'per_person' },
  { label: 'Per Session', value: 'per_session' },
  { label: 'Cheapest Item', value: 'cheapest_item' },
  { label: 'Most Expensive', value: 'most_expensive_item' },
  { label: 'Order Total', value: 'registration_total' },
]
// Config-driven condition system — each entry maps to {key, operator, value} stored in JSONB
const CONDITION_DEFS: Record<string, { label: string; group: string; operators: string[]; valueType: string; options?: string[] }> = {
  participant_age_min:                      { label: 'Participant min age',              group: 'Participant',   operators: ['>=', '>'],            valueType: 'number' },
  participant_age_max:                      { label: 'Participant max age',              group: 'Participant',   operators: ['<=', '<'],            valueType: 'number' },
  participant_age_between:                  { label: 'Participant age range',            group: 'Participant',   operators: ['between'],            valueType: 'range'  },
  participant_member_status:                { label: 'Membership status',                group: 'Participant',   operators: ['is', 'is_not'],       valueType: 'enum',   options: ['active_member', 'member', 'non_member', 'inactive_member'] },
  participant_membership_type:              { label: 'Membership type',                  group: 'Participant',   operators: ['in', 'not_in'],       valueType: 'array',  options: ['junior', 'senior', 'family', 'social', 'associate'] },
  participant_category:                     { label: 'Participant category',             group: 'Participant',   operators: ['in', 'not_in'],       valueType: 'array',  options: ['junior', 'masters', 'open', 'recreational'] },
  registration_group_size_min:              { label: 'Group size (people)',              group: 'Registration',  operators: ['>=', '>', '='],       valueType: 'number' },
  registration_total_value_min:             { label: 'Cart total ($)',                   group: 'Registration',  operators: ['>=', '>'],            valueType: 'currency'},
  booked_day_count_min:                     { label: 'Days booked',                      group: 'Registration',  operators: ['>=', '>'],            valueType: 'number' },
  booked_session_count_min:                 { label: 'Sessions booked',                  group: 'Registration',  operators: ['>=', '>'],            valueType: 'number' },
  ticket_quantity_min:                      { label: 'Ticket quantity',                  group: 'Registration',  operators: ['>=', '>', '='],       valueType: 'number' },
  registration_date_before:                 { label: 'Register before',                  group: 'Registration',  operators: ['<=', '<'],            valueType: 'datetime'},
  registration_within_first_n_registrations:{ label: 'Within first N registrations',    group: 'Registration',  operators: ['<='],                 valueType: 'number' },
  promo_code:                               { label: 'Promo code',                       group: 'Registration',  operators: ['equals'],             valueType: 'string' },
  event_category:                           { label: 'Event category',                   group: 'Event/Session', operators: ['in', 'not_in'],       valueType: 'array',  options: ['holiday_programme', 'tournament', 'workshop', 'class', 'camp'] },
  session_category:                         { label: 'Session category',                 group: 'Event/Session', operators: ['in', 'not_in'],       valueType: 'array',  options: ['morning', 'afternoon', 'full_day', 'skills', 'fitness'] },
  ticket_type:                              { label: 'Ticket type',                      group: 'Event/Session', operators: ['in', 'not_in'],       valueType: 'array',  options: ['adult', 'child', 'family_pass', 'concession'] },
  day_index:                                { label: 'Event day number',                 group: 'Event/Session', operators: ['in', 'not_in'],       valueType: 'array'  },
  usage_limit_per_discount:                 { label: 'Total uses cap',                   group: 'Limits',        operators: ['<=', '<'],            valueType: 'number' },
  usage_limit_per_participant:              { label: 'Per-person uses cap',              group: 'Limits',        operators: ['<=', '<'],            valueType: 'number' },
  combinable_with_other_discounts:          { label: 'Combinable with other discounts',  group: 'Limits',        operators: ['is_true', 'is_false'], valueType: 'boolean'},
}

const OPERATOR_LABELS: Record<string, string> = {
  '>=': '≥ at least', '>': '> more than', '<=': '≤ at most', '<': '< less than',
  '=': '= exactly', 'is': 'is', 'is_not': 'is not',
  'in': 'is one of', 'not_in': 'is not one of',
  'is_true': 'yes', 'is_false': 'no',
  'between': 'between', 'equals': 'equals',
}

const conditionTypeGroups = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const [key, def] of Object.entries(CONDITION_DEFS)) {
    if (!groups[def.group]) groups[def.group] = []
    groups[def.group].push({ key, label: def.label })
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
})

const conditionTypeOptions = computed(() =>
  Object.entries(CONDITION_DEFS).map(([key, def]) => ({ key, label: def.label }))
)

function getConditionDef(key: string) { return CONDITION_DEFS[key] }
function getOperatorOptions(key: string) {
  return (CONDITION_DEFS[key]?.operators ?? []).map(op => ({ value: op, label: OPERATOR_LABELS[op] ?? op }))
}
function getValueType(key: string) { return CONDITION_DEFS[key]?.valueType ?? 'number' }
function getConditionOptions(key: string) { return CONDITION_DEFS[key]?.options ?? [] }

function onConditionKeyChange(cond: any, newKey: string) {
  cond.key = newKey
  const def = CONDITION_DEFS[newKey]
  if (!def) return
  cond.operator = def.operators[0]
  if (def.valueType === 'number' || def.valueType === 'currency') cond.value = null
  else if (def.valueType === 'range')    cond.value = { min: null, max: null }
  else if (def.valueType === 'boolean')  cond.value = true
  else if (def.valueType === 'enum')     cond.value = null
  else if (def.valueType === 'array')    cond.value = []
  else if (def.valueType === 'string')   cond.value = ''
  else if (def.valueType === 'datetime') cond.value = null
}

function conditionLabel(c: any): string {
  if (!c?.key) return '?'
  const def = CONDITION_DEFS[c.key]
  if (!def) return c.key
  const opLabel = OPERATOR_LABELS[c.operator] ?? c.operator ?? ''
  let valLabel = ''
  if (def.valueType === 'boolean') valLabel = ''
  else if (def.valueType === 'range') valLabel = `${c.value?.min ?? '?'}–${c.value?.max ?? '?'}`
  else if (def.valueType === 'array') valLabel = Array.isArray(c.value) ? c.value.join(', ') : ''
  else if (def.valueType === 'datetime') valLabel = c.value ? new Date(c.value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '?'
  else valLabel = String(c.value ?? '?')
  return [def.label, opLabel, valLabel].filter(Boolean).join(' ')
}

function discountFormSummary(disc: any): string {
  const conds = (disc.conditions ?? []) as any[]
  const parts = conds.filter(c => c.key).map(c => conditionLabel(c))
  if (!parts.length) return ''
  const applyLabel: Record<string, string> = {
    cheapest_item: 'cheapest item', most_expensive_item: 'most expensive item',
    per_person: 'per person', per_session: 'per session', registration_total: 'off total',
  }
  const apply = applyLabel[disc.apply_to ?? 'per_person'] ?? ''
  return parts.join(' + ') + (apply ? ` — ${apply}` : '')
}

const discountTemplates = [
  {
    label: 'Weekly package',
    description: 'Book 5+ sessions, 20% off per session',
    icon: 'pi-calendar-clock',
    preset: { name: 'Weekly Package', form_text: '20% off when you book a full week', modifier_value: 20, modifier_type: 'PERCENT', apply_to: 'per_session',
      conditions: [{ key: 'booked_session_count_min', operator: '>=', value: 5 }] },
  },
  {
    label: 'Sibling discount',
    description: 'Register 2+ people, cheapest gets 10% off',
    icon: 'pi-users',
    preset: { name: 'Sibling Discount', form_text: '10% off for additional registrants', modifier_value: 10, modifier_type: 'PERCENT', apply_to: 'cheapest_item',
      conditions: [{ key: 'registration_group_size_min', operator: '>=', value: 2 }] },
  },
  {
    label: 'Family deal',
    description: 'Register 3+ people, cheapest gets 25% off',
    icon: 'pi-heart',
    preset: { name: 'Family Deal', form_text: '25% off the cheapest registration', modifier_value: 25, modifier_type: 'PERCENT', apply_to: 'cheapest_item',
      conditions: [{ key: 'registration_group_size_min', operator: '>=', value: 3 }] },
  },
  {
    label: 'Early bird',
    description: 'Register before a cut-off date, % off total',
    icon: 'pi-stopwatch',
    preset: { name: 'Early Bird', form_text: 'Early bird discount', modifier_value: 10, modifier_type: 'PERCENT', apply_to: 'registration_total',
      conditions: [{ key: 'registration_date_before', operator: '<=', value: null }] },
  },
  {
    label: 'Promo code',
    description: 'Registrant enters a code at checkout',
    icon: 'pi-ticket',
    preset: { name: 'Promo Code', form_text: 'Promo code discount', modifier_value: 15, modifier_type: 'PERCENT', apply_to: 'registration_total',
      conditions: [{ key: 'promo_code', operator: 'equals', value: '' }] },
  },
  {
    label: 'Age-based',
    description: 'Auto-applies for a specific age range',
    icon: 'pi-user',
    preset: { name: 'Age Discount', form_text: 'Age-based discount', modifier_value: 10, modifier_type: 'PERCENT', apply_to: 'per_person',
      conditions: [{ key: 'participant_age_between', operator: 'between', value: { min: null, max: null } }] },
  },
  {
    label: 'Member discount',
    description: 'Only applies to active members',
    icon: 'pi-id-card',
    preset: { name: 'Member Discount', form_text: 'Member discount', modifier_value: 10, modifier_type: 'PERCENT', apply_to: 'per_person',
      conditions: [{ key: 'participant_member_status', operator: 'is', value: 'active_member' }] },
  },
  {
    label: 'First 50 registrations',
    description: 'Discount for the first 50 people to register',
    icon: 'pi-bolt',
    preset: { name: 'First 50', form_text: 'Early registration bonus', modifier_value: 15, modifier_type: 'PERCENT', apply_to: 'registration_total',
      conditions: [{ key: 'registration_within_first_n_registrations', operator: '<=', value: 50 }] },
  },
]

const showDiscountTemplatePicker = ref(false)

const makeDiscountDraft = () => ({
  name: '', form_text: '', is_active: true,
  modifier_value: null as number | null, modifier_type: 'PERCENT', apply_to: 'per_person',
  conditions: [] as any[], condition_to_add: null as string | null,
  valid_from_type: 'now', valid_from: null as Date | null,
  expires_type: 'event', expires_at: null as Date | null, save_as_template: false,
})
const discountDraft = reactive(makeDiscountDraft())

function resetDiscountDraft() {
  Object.assign(discountDraft, makeDiscountDraft())
  editingDiscountIdx.value = null
}

function openDiscountWithTemplate(preset: any) {
  resetDiscountDraft()
  Object.assign(discountDraft, {
    name: preset.name, form_text: preset.form_text,
    modifier_value: preset.modifier_value, modifier_type: preset.modifier_type,
    apply_to: preset.apply_to,
    conditions: JSON.parse(JSON.stringify(preset.conditions)),
  })
  showDiscountTemplatePicker.value = false
  showDiscountDialog.value = true
}

function openBlankDiscount() {
  resetDiscountDraft()
  showDiscountTemplatePicker.value = false
  showDiscountDialog.value = true
}

function addDiscountCondition() {
  discountDraft.conditions.push({ key: null, operator: null, value: null })
}

function editDiscount(idx: number) {
  const d = eventDiscounts.value[idx]
  Object.assign(discountDraft, { ...d, conditions: JSON.parse(JSON.stringify(d.conditions ?? [])), condition_to_add: null })
  editingDiscountIdx.value = idx
  showDiscountDialog.value = true
}

async function saveDiscountDraft() {
  if (!discountDraft.name) return
  const payload = {
    event_id: id,
    type: 'CODE' as const,
    name: discountDraft.name,
    form_text: discountDraft.form_text,
    is_active: discountDraft.is_active,
    modifier_value: discountDraft.modifier_value ?? 0,
    modifier_type: discountDraft.modifier_type,
    apply_to: discountDraft.apply_to,
    conditions: JSON.parse(JSON.stringify(discountDraft.conditions)),
    expires_at: discountDraft.expires_at ?? null,
  }
  const existing = editingDiscountIdx.value !== null ? eventDiscounts.value[editingDiscountIdx.value] : null
  if (existing?.id) {
    await db.from('discounts').update(payload).eq('id', existing.id)
  } else {
    await db.from('discounts').insert(payload)
  }
  await loadDiscounts()
  showDiscountDialog.value = false
  resetDiscountDraft()
}

async function deleteDiscount(idx: number) {
  const disc = eventDiscounts.value[idx]
  if (disc?.id) await db.from('discounts').delete().eq('id', disc.id)
  eventDiscounts.value.splice(idx, 1)
}

// ---- Automation tab ----
const automations = [
  { key: 'confirmation', label: 'Confirmation Email', description: 'Send a confirmation email when someone registers' },
  { key: 'reminder_24h', label: '24-Hour Reminder', description: 'Remind registrants 24 hours before the event' },
  { key: 'reminder_1h', label: '1-Hour Reminder', description: 'Send a reminder 1 hour before the event starts' },
  { key: 'follow_up', label: 'Post-Event Follow-up', description: 'Send a follow-up email after the event' },
  { key: 'waitlist_notify', label: 'Waitlist Notification', description: 'Notify waitlisted members when a spot opens' },
]
const evtAutomation = reactive<Record<string, boolean>>({
  confirmation: true, reminder_24h: false, reminder_1h: false, follow_up: false, waitlist_notify: false,
})

// ---- Reporting tab ----
const reportingLoaded = ref(false)
const reportingLoading = ref(false)
const reportingStats = ref({
  total: 0,
  confirmed: 0,
  pending: 0,
  cancelled: 0,
  waitlisted: 0,
  checkedIn: 0,
  totalRevenue: 0,
  paidRevenue: 0,
})
const reportingSessionRows = ref<any[]>([])
const reportingRecentRegistrations = ref<any[]>([])

async function loadReporting() {
  if (reportingLoading.value) return
  reportingLoading.value = true
  const eventId = route.params.id as string
  try {
    const { data: regs } = await db
      .from('registrations')
      .select('id, status, total_amount, paid_amount, checked_in_at, created_at, guest_name, guest_email, person_id')
      .eq('event_id', eventId)
    const rows = regs ?? []
    reportingStats.value = {
      total: rows.length,
      confirmed: rows.filter((r: any) => r.status === 'CONFIRMED').length,
      pending: rows.filter((r: any) => r.status === 'PENDING').length,
      cancelled: rows.filter((r: any) => r.status === 'CANCELLED').length,
      waitlisted: rows.filter((r: any) => r.status === 'WAITLISTED').length,
      checkedIn: rows.filter((r: any) => r.checked_in_at).length,
      totalRevenue: rows.filter((r: any) => r.status !== 'CANCELLED').reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0),
      paidRevenue: rows.reduce((s: number, r: any) => s + Number(r.paid_amount ?? 0), 0),
    }
    reportingRecentRegistrations.value = [...rows]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    if (sessions.value.length) {
      const { data: regSessions } = await db
        .from('registration_sessions')
        .select('session_id, status, registration_id')
        .in('session_id', sessions.value.map((s: any) => s.id ?? s._savedId).filter(Boolean))
      const rsRows = regSessions ?? []
      reportingSessionRows.value = sessions.value
        .filter((s: any) => s.id)
        .map((s: any) => ({
          title: s.title || 'Untitled session',
          enrolled: rsRows.filter((r: any) => r.session_id === s.id && r.status === 'CONFIRMED').length,
          capacity: s.capacity_max ?? null,
        }))
        .filter((r: any) => r.enrolled > 0)
        .sort((a: any, b: any) => b.enrolled - a.enrolled)
    }
    reportingLoaded.value = true
  } finally {
    reportingLoading.value = false
  }
}

function reportingAttendanceRate() {
  const conf = reportingStats.value.confirmed
  if (!conf) return null
  return Math.round((reportingStats.value.checkedIn / conf) * 100)
}

// ---- Bookables (venues) ----
// allBookables is kept here only for locationSummary venue-name resolution
const allBookables = ref<any[]>([])

const bookableTree = computed(() => {
  function buildChildren(parentId: string | null): any[] {
    return allBookables.value
      .filter(b => (b.parent_id ?? null) === parentId)
      .map(b => {
        const children = buildChildren(b.id)
        return { key: b.id, label: b.name, ...(children.length ? { children } : {}) }
      })
  }
  return buildChildren(null)
})
const checkingAvailability = ref(false)

async function recheckAvailability() {
  checkingAvailability.value = true
  await new Promise(r => setTimeout(r, 600))
  checkingAvailability.value = false
  toast.add({ severity: 'success', summary: 'Availability updated', life: 2000 })
}

// ---- Invitees ----
const invitees = ref<any[]>([])
const inviteesLoading = ref(false)
const showAddInvitee = ref(false)
const addingInvitee = ref(false)
const newInviteePerson = ref('')
const availablePersons = ref<any[]>([])
const inviteeSearch = ref('')
const inviteeStatusFilter = ref('ALL')

// ---- Bulk selection (used by Send Email / Send Comms dialogs) ----
const bulkSelected = ref<string[]>([])
const bulkDeleting = ref(false)

function toggleBulkSelect(id: string) {
  const i = bulkSelected.value.indexOf(id)
  i >= 0 ? bulkSelected.value.splice(i, 1) : bulkSelected.value.push(id)
}

function toggleSelectAll() {
  if (bulkSelected.value.length === filteredInvitees.value.length) {
    bulkSelected.value = []
  } else {
    bulkSelected.value = filteredInvitees.value.map(i => i.id)
  }
}

async function bulkDelete() {
  if (!bulkSelected.value.length) return
  bulkDeleting.value = true
  const { error } = await db.from('invitees').delete().in('id', bulkSelected.value)
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 })
  } else {
    toast.add({ severity: 'success', summary: `${bulkSelected.value.length} invitee${bulkSelected.value.length > 1 ? 's' : ''} removed`, life: 3000 })
    bulkSelected.value = []
    loadInvitees()
  }
  bulkDeleting.value = false
}

const statusFilterOptions = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Invited', value: 'INVITED' },
  { label: 'Declined', value: 'DECLINED' },
]

const confirmedInvitees = computed(() =>
  invitees.value.filter(i => ['CONFIRMED', 'HOLD'].includes(i.status))
)
const interestedCount = computed(() =>
  invitees.value.filter(i => i.status === 'INTERESTED').length
)
const waitlistedCount = computed(() =>
  invitees.value.filter(i => i.status === 'WAITLISTED').length
)
const attendedCount = computed(() =>
  invitees.value.filter(i => i.attended).length
)
const filteredInvitees = computed(() => {
  let list = invitees.value
  if (inviteeStatusFilter.value !== 'ALL') list = list.filter(i => i.status === inviteeStatusFilter.value)
  if (inviteeSearch.value) {
    const q = inviteeSearch.value.toLowerCase()
    list = list.filter(i => {
      const name = `${i.person?.first_name} ${i.person?.last_name}`.toLowerCase()
      return name.includes(q) || i.person?.email?.toLowerCase().includes(q)
    })
  }
  return list
})

const inviteeStats = computed(() => [
  { label: 'Invited', count: invitees.value.length, color: 'text-gray-800' },
  { label: 'Confirmed', count: confirmedInvitees.value.length, color: 'text-green-600' },
  { label: 'Declined', count: invitees.value.filter(i => i.status === 'DECLINED').length, color: 'text-red-500' },
  { label: 'Interested', count: interestedCount.value, color: 'text-blue-600' },
])

// ---- Fees ----
const feesLoading = ref(false)
const feeLineItems = ref<import('~/composables/useFeeGroups').FeeLineItem[]>([])

// ---- Communications ----
const communications = ref<any[]>([])
const sentCommunications = computed(() => communications.value.filter(c => c.sent_at && !c.scheduled_at))
const scheduledCommunications = computed(() => communications.value.filter(c => c.scheduled_at && !c.sent_at))
const commsLoading = ref(false)
const showSendComms = ref(false)

// Check-in QR Code
const showCheckinQrDialog = ref(false)
const qrCanvas = ref<HTMLCanvasElement | null>(null)
const qrUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/events/${id}/check-in`
})
async function openQrDialog() {
  showCheckinQrDialog.value = true
  await nextTick()
  if (qrCanvas.value) {
    const QRCode = (await import('qrcode')).default
    QRCode.toCanvas(qrCanvas.value, qrUrl.value, { width: 280, margin: 2, color: { dark: '#1E2157', light: '#ffffff' } })
  }
}
function downloadQr() {
  if (!qrCanvas.value) return
  const link = document.createElement('a')
  link.download = `${event.value?.title ?? 'event'}-checkin-qr.png`
  link.href = qrCanvas.value.toDataURL('image/png')
  link.click()
}
const showSendEmail = ref(false)
const emailDraft = reactive({ subject: '', body: '' })
const sendingComms = ref(false)
const newComms = ref({ channel: 'EMAIL', audience: 'ALL', subject: '', body: '' })
const audienceOptions = [
  { label: 'All invitees', value: 'ALL' },
  { label: 'Confirmed only', value: 'CONFIRMED' },
  { label: 'Invited (not confirmed)', value: 'INVITED' },
]

// ---- Session-level attendance ----
const selectedAttendanceSessionId = ref<string | null>(null)
const sessionAttendanceData = ref<Record<string, Record<string, any>>>({}) // sessionId → inviteeId → row

// Attendance view mode
const attendanceViewModes = [
  { label: 'All', value: 'all', icon: 'pi-list' },
  { label: 'Sub Groups', value: 'sub_groups', icon: 'pi-sitemap' },
  { label: 'By Group', value: 'member_groups', icon: 'pi-th-large' },
]
const attendanceViewMode = ref<'all' | 'sub_groups' | 'member_groups'>('all')
const attendanceGroupByMemberGroup = computed(() => attendanceViewMode.value === 'member_groups')
const expandedMemberGroups = ref<Record<string, boolean>>({})
const memberGroupsForInvitees = ref<{ personId: string; group: { id: string; name: string; color: string } }[]>([])

const memberGroupAttendanceSections = computed(() => {
  const personGroupMap: Record<string, { id: string; name: string; color: string } | null> = {}
  for (const inv of filteredSortedAttendees.value) {
    if (!inv.person_id) continue
    const entry = memberGroupsForInvitees.value.find(m => m.personId === inv.person_id)
    personGroupMap[inv.id] = entry?.group ?? null
  }
  const groupMap: Record<string, { group: { id: string; name: string; color: string } | null; invitees: any[] }> = {}
  for (const inv of filteredSortedAttendees.value) {
    const grp = personGroupMap[inv.id]
    const key = grp?.id ?? '__none__'
    if (!groupMap[key]) groupMap[key] = { group: grp, invitees: [] }
    groupMap[key].invitees.push(inv)
  }
  return Object.values(groupMap).sort((a, b) => {
    if (!a.group) return 1; if (!b.group) return -1
    return (a.group.name ?? '').localeCompare(b.group.name ?? '')
  })
})

function collapseAllAttendanceGroups() {
  if (attendanceViewMode.value === 'member_groups') {
    for (const sec of memberGroupAttendanceSections.value) {
      expandedMemberGroups.value[sec.group?.id ?? '__none__'] = false
    }
  } else {
    for (const grp of effectiveSubGroups.value) {
      expandedSubGroups[grp.id] = false
    }
  }
}

function expandAllAttendanceGroups() {
  if (attendanceViewMode.value === 'member_groups') {
    for (const sec of memberGroupAttendanceSections.value) {
      expandedMemberGroups.value[sec.group?.id ?? '__none__'] = true
    }
  } else {
    for (const grp of effectiveSubGroups.value) {
      expandedSubGroups[grp.id] = true
    }
  }
}

const allAttendanceGroupsCollapsed = computed(() => {
  if (attendanceViewMode.value === 'member_groups') {
    return memberGroupAttendanceSections.value.every(
      sec => expandedMemberGroups.value[sec.group?.id ?? '__none__'] === false
    )
  }
  return effectiveSubGroups.value.every(grp => expandedSubGroups[grp.id] === false)
})

async function setAttendanceViewMode(mode: 'all' | 'sub_groups' | 'member_groups') {
  attendanceViewMode.value = mode
  if (mode === 'member_groups' && !memberGroupsForInvitees.value.length) {
    const personIds = invitees.value.map((inv: any) => inv.person_id).filter(Boolean)
    if (personIds.length) {
      const { data } = await db.from('member_group_memberships')
        .select('person_id, member_groups!inner(id, name, color)')
        .in('person_id', personIds)
      memberGroupsForInvitees.value = (data ?? []).map((m: any) => ({
        personId: m.person_id,
        group: m.member_groups,
      }))
    }
  }
}

const attendanceSessions = computed(() =>
  [...sessions.value.filter((s: any) => !s.is_master)].sort((a: any, b: any) => {
    if (!a.start_at) return 1
    if (!b.start_at) return -1
    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  })
)

// True when working in session mode
const attendanceInSessionMode = computed(() => attendanceSessions.value.length > 0)

const activeSessionAttendanceMap = computed(() =>
  selectedAttendanceSessionId.value ? (sessionAttendanceData.value[selectedAttendanceSessionId.value] ?? {}) : {}
)

function isAttendedForContext(inv: any) {
  if (attendanceInSessionMode.value && selectedAttendanceSessionId.value) {
    return !!activeSessionAttendanceMap.value[inv.id]
  }
  return !!inv.attended
}

async function selectAttendanceSession(sessionId: string) {
  selectedAttendanceSessionId.value = sessionId
  if (!sessionAttendanceData.value[sessionId]) {
    const { data } = await db.from('attendance').select('*').eq('session_id', sessionId)
    const map: Record<string, any> = {}
    for (const row of (data ?? [])) map[row.invitee_id] = row
    sessionAttendanceData.value = { ...sessionAttendanceData.value, [sessionId]: map }
  }
}

async function toggleSessionAttendance(inv: any, sessionId: string) {
  const map = sessionAttendanceData.value[sessionId] ?? {}
  if (map[inv.id]) {
    await db.from('attendance').delete().eq('id', map[inv.id].id)
    const updated = { ...map }
    delete updated[inv.id]
    sessionAttendanceData.value = { ...sessionAttendanceData.value, [sessionId]: updated }
  } else {
    const { data } = await db.from('attendance').insert({
      invitee_id: inv.id, session_id: sessionId, is_present: true, checked_in_at: new Date().toISOString(),
    }).select().single()
    if (data) sessionAttendanceData.value = { ...sessionAttendanceData.value, [sessionId]: { ...map, [inv.id]: data } }
  }
}

// ---- Attendance selection ----
const attendanceSelected = ref<string[]>([])
const attendanceSelectAll = ref(false)
const attendanceSearch = ref('')
const attendanceSort = ref<{ dir: 'asc' | 'desc' }>({ dir: 'asc' })

function toggleAttendanceSort() {
  attendanceSort.value.dir = attendanceSort.value.dir === 'asc' ? 'desc' : 'asc'
}

const filteredSortedAttendees = computed(() => {
  const q = attendanceSearch.value.trim().toLowerCase()
  let result = invitees.value
  if (q) {
    result = result.filter(inv => {
      const name = `${inv.person?.first_name ?? ''} ${inv.person?.last_name ?? ''}`.toLowerCase()
      return name.includes(q)
    })
  }
  return [...result].sort((a, b) => {
    const nameA = `${a.person?.last_name ?? ''} ${a.person?.first_name ?? ''}`.toLowerCase()
    const nameB = `${b.person?.last_name ?? ''} ${b.person?.first_name ?? ''}`.toLowerCase()
    return attendanceSort.value.dir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
  })
})

// ---- Assign to sub-group ----
const showAddToSubGroupDialog = ref(false)
const addToSubGroupTarget = ref<string | null>(null)

const addToSubGroupPeople = computed(() =>
  attendanceSelected.value.map(id => invitees.value.find(i => i.id === id)).filter(Boolean)
)

async function executeAddToSubGroup() {
  for (const invId of attendanceSelected.value) {
    inviteeGroupMap.value[invId] = addToSubGroupTarget.value
    await db.from('invitees').update({ sub_group_id: addToSubGroupTarget.value }).eq('id', invId)
  }
  attendanceSelected.value = []
  attendanceSelectAll.value = false
  showAddToSubGroupDialog.value = false
  addToSubGroupTarget.value = null
}

// ---- Attendance action menu ----
const attendanceActionMenu = ref()
const attendanceActionMenuItems = computed(() => [
  { label: 'Mark Selected In', icon: 'pi pi-check', command: markSelectedIn },
  { separator: true },
  { label: 'Assign to Sub-group', icon: 'pi pi-user-plus', command: () => { showAddToSubGroupDialog.value = true } },
  { separator: true },
  { label: 'Send Email', icon: 'pi pi-envelope', command: () => { showSendComms.value = true } },
])

function toggleAttendanceSelectAll() {
  attendanceSelected.value = attendanceSelectAll.value ? invitees.value.map(i => i.id) : []
}

async function toggleSignOut(inv: any) {
  if (!isAttendedForContext(inv)) {
    toast.add({ severity: 'warn', summary: 'Sign in first', detail: 'Please mark this person as signed in before signing them out.', life: 3000 })
    return
  }
  const newVal = !inv.signed_out
  await db.from('invitees').update({ signed_out: newVal } as any).eq('id', inv.id)
  inv.signed_out = newVal
}

async function markSelectedIn() {
  await Promise.all(
    attendanceSelected.value.map(invId => db.from('invitees').update({ attended: true }).eq('id', invId))
  )
  invitees.value.forEach(i => { if (attendanceSelected.value.includes(i.id)) i.attended = true })
  attendanceSelected.value = []
  attendanceSelectAll.value = false
}

function personAge(person: any) {
  if (!person?.date_of_birth) return '—'
  const dob = new Date(person.date_of_birth)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

function openInviteeEmail(inv: any) {
  newComms.value.subject = ''
  newComms.value.body = `Hi ${inv.person?.first_name},\n\n`
  showSendComms.value = true
}

function printAttendanceRoll() {
  window.print()
}

// ---- Sub Groups ----
const subGroups = ref<{ id: string; name: string; color: string; managers?: { id: string; name: string }[]; session_ids?: string[] | null }[]>([])
const inviteeGroupMap = ref<Record<string, string | null>>({})
const expandedSubGroups = reactive<Record<string, boolean>>({})
const showSubGroupsDialog = ref(false)
const addingManagerForGroup = reactive<Record<string, string | null>>({})
const newGroupName = ref('')
const newGroupColor = ref('#3B82F6')
const newGroupScope = ref<'all' | 'this' | 'multiple'>('all')
const newGroupSessionIds = ref<string[]>([])
const draggingInviteeId = ref<string | null>(null)
const draggingMultiple = ref(false)
const dragOverGroupId = ref<string>('__none__')

const groupColorPalette = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#F97316',
]

// Sub-groups filtered to those that apply to the current attendance context
const effectiveSubGroups = computed(() => {
  const sid = selectedAttendanceSessionId.value
  return subGroups.value.filter(g => {
    if (!g.session_ids || g.session_ids.length === 0) return true // null/empty = all sessions
    if (!sid) return false
    return g.session_ids.includes(sid)
  })
})

const groupedInvitees = computed(() => {
  const ungrouped = invitees.value.filter(inv => !inviteeGroupMap.value[inv.id])
  const groups = effectiveSubGroups.value.map(g => ({
    group: g,
    invitees: invitees.value.filter(inv => inviteeGroupMap.value[inv.id] === g.id),
  }))
  return { ungrouped, groups }
})

function addSubGroup() {
  if (!newGroupName.value.trim()) return
  let sessionIds: string[] | null = null
  if (newGroupScope.value === 'this' && selectedAttendanceSessionId.value) {
    sessionIds = [selectedAttendanceSessionId.value]
  } else if (newGroupScope.value === 'multiple') {
    sessionIds = [...newGroupSessionIds.value]
  }
  subGroups.value.push({
    id: crypto.randomUUID(),
    name: newGroupName.value.trim(),
    color: newGroupColor.value,
    session_ids: sessionIds,
  })
  newGroupName.value = ''
  newGroupColor.value = '#3B82F6'
  newGroupScope.value = 'all'
  newGroupSessionIds.value = []
}

function removeSubGroup(groupId: string) {
  subGroups.value = subGroups.value.filter(g => g.id !== groupId)
  Object.keys(inviteeGroupMap.value).forEach(invId => {
    if (inviteeGroupMap.value[invId] === groupId) delete inviteeGroupMap.value[invId]
  })
}

function availableManagersFor(grp: typeof subGroups.value[0]) {
  const existing = new Set((grp.managers ?? []).map(m => m.id))
  return invitees.value
    .filter(inv => inv.person && !existing.has(inv.person.id))
    .map(inv => ({ id: inv.person.id, full_name: `${inv.person.first_name} ${inv.person.last_name}` }))
}

function onAddManager(groupId: string, personId: string) {
  const grp = subGroups.value.find(g => g.id === groupId)
  if (!grp || !personId) return
  const inv = invitees.value.find(i => i.person?.id === personId)
  if (!inv) return
  if (!grp.managers) grp.managers = []
  grp.managers.push({ id: personId, name: `${inv.person.first_name} ${inv.person.last_name}` })
  addingManagerForGroup[groupId] = null
}

function removeSubGroupManager(groupId: string, personId: string) {
  const grp = subGroups.value.find(g => g.id === groupId)
  if (!grp) return
  grp.managers = (grp.managers ?? []).filter(m => m.id !== personId)
}

const savingSubGroups = ref(false)
async function saveSubGroups() {
  savingSubGroups.value = true
  const { error } = await db.from('events').update({ sub_groups: subGroups.value }).eq('id', id)
  if (error) toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 3000 })
  savingSubGroups.value = false
  showSubGroupsDialog.value = false
}

function onDragStart(e: DragEvent, invId: string) {
  draggingInviteeId.value = invId
  draggingMultiple.value = attendanceSelected.value.includes(invId) && attendanceSelected.value.length > 1
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

async function onDropOnGroup(groupId: string | null) {
  const ids = draggingMultiple.value
    ? [...attendanceSelected.value]
    : draggingInviteeId.value ? [draggingInviteeId.value] : []
  for (const id of ids) {
    if (groupId === null) {
      delete inviteeGroupMap.value[id]
    } else {
      inviteeGroupMap.value[id] = groupId
    }
    // Persist to DB
    await db.from('invitees').update({ sub_group_id: groupId }).eq('id', id)
  }
  if (draggingMultiple.value) {
    attendanceSelected.value = []
    attendanceSelectAll.value = false
  }
  draggingInviteeId.value = null
  draggingMultiple.value = false
  dragOverGroupId.value = '__none__'
}

// ---- Sessions ----
const sessions = ref<any[]>([])
const selectedSessionIds = ref<Set<string>>(new Set())
const sessionsSortedByDate = computed(() =>
  [...sessions.value].sort((a, b) => {
    const ta = a.start_at ? new Date(a.start_at).getTime() : Infinity
    const tb = b.start_at ? new Date(b.start_at).getTime() : Infinity
    return ta - tb
  })
)
function sessionDayKey(s: any): string {
  return s.start_at ? new Date(s.start_at).toDateString() : '__nodate__'
}
const savingSessions = ref(false)
const sessionSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let sessionSaveTimer: ReturnType<typeof setTimeout> | null = null
let sessionSavedClearTimer: ReturnType<typeof setTimeout> | null = null
let _suppressAutoSave = false
const draggingSessionIdx = ref<number | null>(null)
const dragOverSessionIdx = ref<number | null>(null)
const draggingSubKey = ref<string | null>(null)
const dragOverSubKey = ref<string | null>(null)

function formatSessionDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatSessionTime(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

function syncSessionDates(session: any) {
  if (!session._startDate) return
  const sd = new Date(session._startDate)
  const ed = session._endDate ? new Date(session._endDate) : new Date(sd)
  if (!session.is_all_day && session._startTime) {
    const st = new Date(session._startTime)
    sd.setHours(st.getHours(), st.getMinutes(), 0, 0)
  } else {
    sd.setHours(0, 0, 0, 0)
  }
  if (!session.is_all_day && session._endTime) {
    const et = new Date(session._endTime)
    ed.setHours(et.getHours(), et.getMinutes(), 0, 0)
  } else {
    ed.setHours(0, 0, 0, 0)
  }
  session.start_at = sd.toISOString()
  session.end_at = ed.toISOString()
}

function makeSessionLocations(s: any): LocationEntry[] {
  return [{ type: (s.location_type ?? 'ADDRESS') as LocationEntry['type'], venue_name: '', address: s.address ?? '', meeting_link: s.meeting_link ?? '', bookable_ids: s.bookable_id ? [s.bookable_id] : [] }]
}

function makeFreshSession(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    start_at: null,
    end_at: null,
    is_all_day: false,
    location_type: 'ADDRESS',
    address: '',
    meeting_link: '',
    _locations: [{ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] as string[] }] as LocationEntry[],
    capacity_max: null,
    sub_sessions: [],
    invitee_ids: [],
    required: false,
    is_master: false,
    master_id: null as string | null,
    // Fees
    fees: [] as { id: string; name: string; amount: number; type: string }[],
    // Discounts
    discounts: [] as { id: string; code: string; type: 'PERCENT' | 'FIXED'; value: number; max_uses: number | null }[],
    // Settings
    is_public: true,
    show_attendee_list: false,
    has_waitlist: false,
    show_as_separate_event: false,
    // Session kind: 'regular' | 'pre_event' | 'post_event'
    session_kind: 'regular' as 'regular' | 'pre_event' | 'post_event',
    repeat: '',
    // UI helpers
    _expanded: false,
    _editingTitle: false,
    _startDate: null,
    _endDate: null,
    _startTime: null,
    _endTime: null,
    _hasCapacity: false,
    _locked_fields: [] as string[],
    display_on_form: true,
    ...overrides,
  }
}

// ---- Master sessions ----
// Fields copied from master to linked sessions (no dates/sort_order/master flags)
const MASTER_FIELDS = ['title', 'description', 'location_type', 'address', 'meeting_link', 'fees', 'discounts',
  'is_public', 'show_attendee_list', 'has_waitlist', 'required', '_hasCapacity', 'capacity_max',
  'show_as_separate_event', 'display_on_form', '_inviteeModes', '_inviteeGroups', '_eligibility']

const masterSessions = computed(() => sessions.value.filter(s => s.is_master))
const showPickMaster = ref(false)
const addSessionMenu = ref()
const addSessionMenuItems = computed(() => [
  { label: 'Single Session', icon: 'pi pi-calendar-plus', command: () => addSession() },
  { label: 'Bulk Sessions',  icon: 'pi pi-clone',         command: () => { showBulkSessions.value = true } },
  ...(masterSessions.value.length ? [{ label: 'From Master', icon: 'pi pi-file-import', command: () => { showPickMaster.value = true } }] : []),
])

// ---- Bulk sessions ----
const showBulkSessions = ref(false)
const savingBulk = ref(false)

watch(showBulkSessions, open => {
  if (open) {
    bulkForm.startDate = event.value?.start_at ? new Date(event.value.start_at) : null
    bulkForm.endDate = event.value?.end_at ? new Date(event.value.end_at) : null
  }
})

function makeBulkTime(h: number, m = 0) { const d = new Date(); d.setHours(h, m, 0, 0); return d }

const NZ_PUBLIC_HOLIDAYS_2025_2026 = [
  '2025-04-18','2025-04-19','2025-04-20','2025-04-21','2025-04-25',
  '2025-06-02','2025-10-27','2025-12-25','2025-12-26',
  '2026-01-01','2026-01-02','2026-02-06','2026-04-03','2026-04-04',
  '2026-04-05','2026-04-06','2026-04-27','2026-06-01','2026-10-26',
  '2026-12-25','2026-12-26',
].map(s => s)

const bulkForm = reactive({
  startDate: null as Date | null,
  endDate: null as Date | null,
  includeWeekends: true,
  excludePublicHolidays: false,
})

const bulkTemplates = reactive([
  { name: 'Morning',   cost: null as number | null, startTime: makeBulkTime(9),  endTime: makeBulkTime(12), limit: null as number | null, bookableId: null as string | null },
  { name: 'Afternoon', cost: null as number | null, startTime: makeBulkTime(13), endTime: makeBulkTime(17), limit: null as number | null, bookableId: null as string | null },
])

const bulkSessionDays = computed(() => {
  if (!bulkForm.startDate || !bulkForm.endDate) return []
  const days: Date[] = []
  const cur = new Date(bulkForm.startDate); cur.setHours(0, 0, 0, 0)
  const end = new Date(bulkForm.endDate); end.setHours(23, 59, 59, 999)
  while (cur <= end) {
    const dow = cur.getDay()
    const iso = cur.toISOString().slice(0, 10)
    const isWeekend = dow === 0 || dow === 6
    const isHoliday = bulkForm.excludePublicHolidays && NZ_PUBLIC_HOLIDAYS_2025_2026.includes(iso)
    if (!isHoliday && (bulkForm.includeWeekends || !isWeekend)) days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
})

const bulkNamedTemplates = computed(() => bulkTemplates.filter(t => t.name.trim()))
const bulkTotalSessions = computed(() => bulkSessionDays.value.length * bulkNamedTemplates.value.length)
const bulkCanCreate = computed(() => bulkForm.startDate !== null && bulkForm.endDate !== null && bulkSessionDays.value.length > 0 && bulkNamedTemplates.value.length > 0)

function bulkBuildDatetime(day: Date, timePicker: Date | null, fallbackHour = 0): string {
  const d = new Date(day)
  d.setHours(timePicker ? timePicker.getHours() : fallbackHour, timePicker ? timePicker.getMinutes() : 0, 0, 0)
  return d.toISOString()
}

async function createBulkSessions() {
  if (!bulkCanCreate.value || !event.value?.id) return
  savingBulk.value = true
  try {
    const days = bulkSessionDays.value
    let sortOrder = sessions.value.length

    for (const tpl of bulkNamedTemplates.value) {
      const locationType = tpl.bookableId ? 'BOOKABLE' : 'ADDRESS'
      const baseSession = {
        event_id: event.value.id,
        title: tpl.name.trim(),
        capacity_max: tpl.limit ?? null,
        bookable_id: tpl.bookableId ?? null,
        location_type: locationType,
        is_required: false,
        is_public: event.value.is_public ?? true,
        display_on_form: true,
      }
      const { data: master, error: masterErr } = await db.from('sessions').insert({
        ...baseSession,
        start_at: bulkBuildDatetime(days[0], tpl.startTime, 9),
        end_at: bulkBuildDatetime(days[0], tpl.endTime, 17),
        is_master: true,
        master_id: null,
        sort_order: sortOrder++,
      }).select('id').single()
      if (masterErr || !master?.id) throw masterErr ?? new Error('Failed to create master session')

      let linkedIds: string[] = []
      if (days.length > 1) {
        const linked = days.slice(1).map(day => ({
          ...baseSession,
          start_at: bulkBuildDatetime(day, tpl.startTime, 9),
          end_at: bulkBuildDatetime(day, tpl.endTime, 17),
          is_master: false,
          master_id: master.id,
          sort_order: sortOrder++,
        }))
        const { data: linkedData, error: linkedErr } = await db.from('sessions').insert(linked).select('id')
        if (linkedErr) throw linkedErr
        linkedIds = (linkedData ?? []).map((r: any) => r.id)
      }

      // If a cost is set, create a fee_components row for every session in this template
      if (tpl.cost && tpl.cost > 0) {
        const allSessionIds = [master.id, ...linkedIds]
        const feeRows = allSessionIds.map((sessionId, i) => {
          const sessionDate = new Date(i === 0 ? bulkBuildDatetime(days[0], tpl.startTime, 9) : bulkBuildDatetime(days[i], tpl.startTime, 9))
          const dateLabel = sessionDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
          return {
            session_id: sessionId,
            name: `${dateLabel} — ${tpl.name.trim()}`,
            amount: tpl.cost,
            sort_order: 0,
          }
        })
        const { error: feeErr } = await db.from('fee_components').insert(feeRows)
        if (feeErr) throw feeErr
      }
    }

    toast.add({ severity: 'success', summary: 'Sessions created', detail: `${bulkTotalSessions.value} sessions added`, life: 4000 })
    showBulkSessions.value = false
    // Reset form
    bulkForm.startDate = null; bulkForm.endDate = null; bulkForm.includeWeekends = true; bulkForm.excludePublicHolidays = false
    bulkTemplates.splice(0, bulkTemplates.length,
      { name: 'Morning', cost: null, startTime: makeBulkTime(9), endTime: makeBulkTime(12), limit: null, bookableId: null },
      { name: 'Afternoon', cost: null, startTime: makeBulkTime(13), endTime: makeBulkTime(17), limit: null, bookableId: null })
    await loadSessions()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.message ?? 'Something went wrong', life: 5000 })
  } finally {
    savingBulk.value = false
  }
}

function createSessionFromMaster(master: any) {
  const session = makeFreshSession({ title: master.title || 'New Session' })
  MASTER_FIELDS.forEach(f => { if (master[f] !== undefined) (session as any)[f] = JSON.parse(JSON.stringify(master[f])) })
  session.master_id = master.id
  session._locked_fields = [...MASTER_FIELDS]
  sessions.value.push(session)
  showPickMaster.value = false
  openSession(session)
}

function syncSessionFromMaster(session: any) {
  const master = sessions.value.find(s => (s._savedId ?? s.id) === session.master_id || s.id === session.master_id)
  if (!master) return
  MASTER_FIELDS.forEach(f => { if (master[f] !== undefined) session[f] = JSON.parse(JSON.stringify(master[f])) })
  // All master fields are locked (inherited) unless explicitly unlocked
  session._locked_fields = [...MASTER_FIELDS]
}

function pullFieldFromMaster(fields: string | string[]) {
  const master = sessions.value.find(s => s.id === viewingSession.value?.master_id)
  if (!master || !viewingSession.value) return
  const keys = Array.isArray(fields) ? fields : [fields]
  keys.forEach(f => {
    if (master[f] !== undefined) viewingSession.value[f] = JSON.parse(JSON.stringify(master[f]))
  })
  // Lock the fields
  const locked = viewingSession.value._locked_fields ?? []
  keys.forEach(f => { if (!locked.includes(f)) locked.push(f) })
  viewingSession.value._locked_fields = locked
}

function unlockField(fields: string | string[]) {
  if (!viewingSession.value) return
  const keys = Array.isArray(fields) ? fields : [fields]
  viewingSession.value._locked_fields = (viewingSession.value._locked_fields ?? []).filter((f: string) => !keys.includes(f))
}

function isFieldLocked(field: string): boolean {
  return (viewingSession.value?._locked_fields ?? []).includes(field)
}

function masterFieldDiffers(field: string): boolean {
  const master = sessions.value.find(s => s.id === viewingSession.value?.master_id)
  if (!master || !viewingSession.value) return false
  return JSON.stringify(viewingSession.value[field]) !== JSON.stringify(master[field])
}

// ---- Session detail drawer ----
const viewingSession = ref<any>(null)

function openSession(session: any) {
  if (!session._locations) session._locations = makeSessionLocations(session)
  // Always pull latest values from master before opening a linked session
  if (session.master_id) syncSessionFromMaster(session)
  viewingSession.value = session
}

const sessionTabs = [
  { key: 'overview',  label: 'Overview',  icon: 'pi-info-circle' },
  { key: 'invitees',  label: 'Invitees',  icon: 'pi-users' },
  { key: 'fees',      label: 'Fees',      icon: 'pi-dollar' },
  { key: 'settings',  label: 'Settings',  icon: 'pi-cog' },
]

function addSession() {
  const isFirst = sessions.value.length === 0
  const eventStart = event.value?.start_at ? new Date(event.value.start_at) : null
  const session = makeFreshSession({
    title: `Session ${sessions.value.length + 1}`,
    is_master: isFirst,
    _startDate: eventStart,
    _endDate: eventStart,
    _startTime: eventStart,
    _endTime: eventStart,
    start_at: event.value?.start_at ?? null,
    end_at: event.value?.start_at ?? null,
  })
  sessions.value.push(session)
  nextTick(() => openSession(session))
}

function duplicateSession(idx: number) {
  const clone = JSON.parse(JSON.stringify(sessions.value[idx]))
  clone.id = crypto.randomUUID()
  clone.title = clone.title + ' (copy)'
  clone.sub_sessions = (clone.sub_sessions ?? []).map((s: any) => ({ ...s, id: crypto.randomUUID() }))
  sessions.value.splice(idx + 1, 0, clone)
}

function removeSession(idx: number) {
  const deleted = sessions.value[idx]
  sessions.value.splice(idx, 1)
  selectedSessionIds.value.delete(deleted.id)
  if (viewingSession.value?.id === deleted.id) {
    viewingSession.value = sessions.value.length ? sessions.value[0] : null
  }
  toast.add({ severity: 'success', summary: `"${deleted.title || 'Untitled Session'}" deleted`, life: 3000 })
}

async function deleteSelectedSessions() {
  const ids = [...selectedSessionIds.value]
  if (!ids.length) return
  const toRemove = sessions.value.filter(s => ids.includes(s.id))
  sessions.value = sessions.value.filter(s => !ids.includes(s.id))
  selectedSessionIds.value.clear()
  if (viewingSession.value && ids.includes(viewingSession.value.id)) {
    viewingSession.value = sessions.value.length ? sessions.value[0] : null
  }
  const dbIds = toRemove.filter(s => s._savedId || (!s._tempId)).map(s => s._savedId ?? s.id)
  if (dbIds.length) await db.from('sessions').delete().in('id', dbIds)
  toast.add({ severity: 'success', summary: `${ids.length} session${ids.length !== 1 ? 's' : ''} deleted`, life: 3000 })
}


function addSubSession(session: any) {
  if (!session.sub_sessions) session.sub_sessions = []
  const sub = {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    address: '',
    meeting_link: '',
    location_type: 'ADDRESS',
    capacity_max: null,
    _hasCapacity: false,
    required: false,
    is_public: true,
    show_attendee_list: false,
    has_waitlist: false,
    invitee_ids: [],
    fees: [],
    discounts: [],
    _date: session._startDate ?? null,
    _startTime: null,
    _endTime: null,
  }
  session.sub_sessions.push(sub)
  // Open the modal immediately so user can fill in details
  openSubSession(session, sub)
}

// ---- Sub-session detail modal ----
const editingSubSession = ref<any>(null)
const editingSubSessionParent = ref<any>(null)
const subSessionTab = ref('overview')

function openSubSession(session: any, sub: any) {
  editingSubSessionParent.value = session
  editingSubSession.value = { ...sub }
  subSessionTab.value = 'overview'
}

function saveSubSession() {
  if (!editingSubSessionParent.value || !editingSubSession.value) return
  const subs = editingSubSessionParent.value.sub_sessions
  const idx = subs.findIndex((s: any) => s.id === editingSubSession.value.id)
  if (idx !== -1) subs[idx] = { ...editingSubSession.value }
  editingSubSession.value = null
  editingSubSessionParent.value = null
}

// ---- Session drag-to-reorder ----
function onSessionDragStart(idx: number) { draggingSessionIdx.value = idx }
function onSessionDragOver(idx: number) { dragOverSessionIdx.value = idx }
function onSessionDrop(toIdx: number) {
  const from = draggingSessionIdx.value
  if (from === null || from === toIdx) return
  const moved = sessions.value.splice(from, 1)[0]
  sessions.value.splice(toIdx, 0, moved)
  draggingSessionIdx.value = null
  dragOverSessionIdx.value = null
}
function onSessionDragEnd() { draggingSessionIdx.value = null; dragOverSessionIdx.value = null }

// ---- Session invitees ----
const managingSessionInvitees = ref<any>(null)
const sessionInviteePicker = ref<string[]>([])
const sessionInviteeSearch = ref('')

const sessionFilteredInvitees = computed(() => {
  const q = sessionInviteeSearch.value.toLowerCase().trim()
  if (!q) return invitees.value
  return invitees.value.filter(inv => {
    const name = `${inv.person?.first_name ?? ''} ${inv.person?.last_name ?? ''}`.toLowerCase()
    return name.includes(q)
  })
})

function sessionInviteeList(session: any) {
  return invitees.value.filter(inv => (session.invitee_ids ?? []).includes(inv.id))
}

function openSessionInvitees(session: any) {
  if (!session.invitee_ids) session.invitee_ids = []
  managingSessionInvitees.value = session
  sessionInviteePicker.value = [...session.invitee_ids]
  sessionInviteeSearch.value = ''
}

function saveSessionInvitees() {
  if (!managingSessionInvitees.value) return
  managingSessionInvitees.value.invitee_ids = [...sessionInviteePicker.value]
  managingSessionInvitees.value = null
}

// ---- Sub-session drag-to-reorder ----
function onSubDragStart(session: any, subIdx: number) { draggingSubKey.value = `${session.id}:${subIdx}` }
function onSubDragOver(session: any, subIdx: number) { dragOverSubKey.value = `${session.id}:${subIdx}` }
function onSubDrop(session: any, toIdx: number) {
  if (!draggingSubKey.value) return
  const [sid, fromStr] = draggingSubKey.value.split(':')
  if (sid !== session.id) return
  const from = parseInt(fromStr)
  if (from === toIdx) return
  const moved = session.sub_sessions.splice(from, 1)[0]
  session.sub_sessions.splice(toIdx, 0, moved)
  draggingSubKey.value = null
  dragOverSubKey.value = null
}
function onSubDragEnd() { draggingSubKey.value = null; dragOverSubKey.value = null }

async function loadSessions() {
  const { data } = await db.from('sessions').select('*').eq('event_id', id).is('parent_session_id', null).order('sort_order')
  if (data && data.length) {
    // Load sub-sessions and session-level fees in parallel
    const sessionIds = data.map(s => s.id)
    const [{ data: subs }, { data: sessionFees }] = await Promise.all([
      db.from('sessions').select('*').eq('event_id', id).not('parent_session_id', 'is', null),
      db.from('fee_components').select('*').in('session_id', sessionIds).order('sort_order'),
    ])
    // Group fees by session_id
    const feesBySession: Record<string, any[]> = {}
    for (const fee of sessionFees ?? []) {
      if (!feesBySession[fee.session_id]) feesBySession[fee.session_id] = []
      feesBySession[fee.session_id].push(fee)
    }
    sessions.value = data.map(s => ({
      ...s,
      required: s.is_required ?? false,
      display_on_form: s.display_on_form ?? true,
      _savedId: s.id,
      _isNew: false,
      _expanded: true,
      _editingTitle: false,
      _startDate: s.start_at ? new Date(s.start_at) : null,
      _endDate: s.end_at ? new Date(s.end_at) : null,
      _startTime: s.start_at ? new Date(s.start_at) : null,
      _endTime: s.end_at ? new Date(s.end_at) : null,
      _hasCapacity: !!s.capacity_max,
      repeat: s.recurrence_rule ?? '',
      _locations: makeSessionLocations(s),
      _inviteeModes: s.invitee_modes ?? ['all_members'],
      _inviteeGroups: s.invitee_groups ?? [],
      _eligibility: s.eligibility && Object.keys(s.eligibility).length ? s.eligibility : { restricted: false, conditions: [] },
      _locked_fields: s.master_id ? [...MASTER_FIELDS] : [],
      _feesConfig: (() => {
        const fees = feesBySession[s.id] ?? []
        if (!fees.length) return { is_charged: false, all_charged_equally: true, base_fees: [], groups: [] }
        return {
          is_charged: true,
          all_charged_equally: true,
          base_fees: fees.map((f: any) => ({ id: f.id, name: f.name, xero_code: f.xero_code ?? '', amount: f.amount })),
          groups: [],
        }
      })(),
      sub_sessions: (subs ?? []).filter(sub => sub.parent_session_id === s.id).map(sub => ({
        ...sub,
        _date: sub.start_at ? new Date(sub.start_at) : null,
        _startTime: sub.start_at ? new Date(sub.start_at) : null,
        _endTime: sub.end_at ? new Date(sub.end_at) : null,
      })),
    }))
  } else {
    sessions.value = []
  }
  // Auto-open the session from URL param, or fall back to the first session
  if (sessions.value.length && !viewingSession.value) {
    const targetId = route.query.sessionId as string | undefined
    const target = targetId ? sessions.value.find((s: any) => s.id === targetId || s._savedId === targetId) : null
    _suppressAutoSave = true
    openSession(target ?? sessions.value[0])
    await nextTick()
    _suppressAutoSave = false
  }
}

function buildSessionPayload(s: any, idx: number) {
  syncSessionDates(s)
  const locType = (s._locations?.[0]?.type ?? s.location_type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE'
  const loc = s._locations?.[0]
  return {
    event_id: id,
    title: s.title || `Session ${idx + 1}`,
    description: s.description || null,
    start_at: s.start_at,
    end_at: s.end_at,
    is_all_day: s.is_all_day,
    location_type: locType,
    address: locType === 'ADDRESS' ? (loc?.address || s.address || null) : null,
    meeting_link: locType === 'ONLINE' ? (loc?.meeting_link || s.meeting_link || null) : null,
    bookable_id: locType === 'BOOKABLE' ? (loc?.bookable_ids?.[0] || s.bookable_id || null) : null,
    capacity_max: s._hasCapacity ? (s.capacity_max ?? null) : null,
    has_waitlist: s._hasCapacity ? (s.has_waitlist ?? false) : false,
    is_required: s.required ?? false,
    is_public: s.is_public ?? true,
    show_attendee_list: s.show_attendee_list ?? false,
    show_as_separate_event: s.show_as_separate_event ?? false,
    display_on_form: s.display_on_form ?? true,
    invitee_modes: s._inviteeModes ?? ['all_members'],
    invitee_groups: s._inviteeGroups ?? [],
    eligibility: s._eligibility ?? {},
    sort_order: idx,
    is_master: s.is_master ?? false,
    master_id: s.master_id ?? null,
    admins: s.admins ?? [],
  }
}

// Fields propagated from master → linked sessions (everything except dates, sort_order, is_master, master_id)
const MASTER_INHERIT_DB_FIELDS = [
  'title', 'description', 'location_type', 'address', 'meeting_link', 'bookable_id',
  'is_public', 'show_attendee_list', 'has_waitlist', 'is_required',
  'capacity_max', 'show_as_separate_event', 'display_on_form',
  'invitee_modes', 'invitee_groups', 'eligibility', 'admins',
] as const

async function propagateMasterToLinked(masterId: string, payload: Record<string, any>) {
  const inheritPayload: Record<string, any> = {}
  for (const f of MASTER_INHERIT_DB_FIELDS) inheritPayload[f] = payload[f] ?? null
  // Update DB for all linked sessions
  await db.from('sessions').update(inheritPayload).eq('master_id', masterId).eq('event_id', id)
  // Sync in-memory linked sessions — suppress auto-save so mutating viewingSession doesn't schedule a spurious save
  _suppressAutoSave = true
  const master = sessions.value.find((s: any) => (s._savedId ?? s.id) === masterId)
  for (const linked of sessions.value.filter((s: any) => s.master_id === masterId)) {
    for (const f of MASTER_INHERIT_DB_FIELDS) (linked as any)[f] = inheritPayload[f]
    // Keep UI helpers in sync
    ;(linked as any).required = inheritPayload.is_required ?? false
    ;(linked as any)._hasCapacity = !!inheritPayload.capacity_max
    // Sync _locations so SessionEditor re-renders with the updated location
    if (master?._locations) {
      linked._locations = JSON.parse(JSON.stringify(master._locations))
    }
    // Propagate client-side-only fields from master unconditionally
    if (master) {
      for (const f of ['_inviteeModes', '_inviteeGroups', '_eligibility', '_feesConfig'] as const) {
        linked[f] = master[f] ? JSON.parse(JSON.stringify(master[f])) : master[f]
      }
    }
  }
  await nextTick()
  _suppressAutoSave = false

  // Propagate fee_components to linked sessions in DB
  if (master) {
    const linkedSessions = sessions.value.filter((s: any) => s.master_id === masterId)
    const masterFees: any[] = master._feesConfig?.base_fees ?? []
    for (const linked of linkedSessions) {
      const linkedId = linked._savedId ?? linked.id
      if (!linkedId) continue
      await db.from('fee_components').delete().eq('session_id', linkedId)
      const namedFees = masterFees.filter((f: any) => f.name?.trim())
      if (namedFees.length && master._feesConfig?.is_charged) {
        await db.from('fee_components').insert(
          namedFees.map((f: any, i: number) => ({
            session_id: linkedId,
            name: f.name.trim(),
            xero_code: f.xero_code ?? null,
            amount: f.amount ?? 0,
            sort_order: i,
          }))
        )
      }
    }
  }
}

async function saveSession(s: any) {
  const idx = sessions.value.indexOf(s)
  const payload = buildSessionPayload(s, idx >= 0 ? idx : 0)
  if (s._isNew || !s._savedId) {
    const { data, error: insertError } = await db.from('sessions').insert(payload).select('id').single()
    if (insertError) throw new Error(insertError.message)
    if (data) {
      s._savedId = data.id
      s._isNew = false
      for (let j = 0; j < (s.sub_sessions ?? []).length; j++) {
        const sub = s.sub_sessions[j]
        await db.from('sessions').insert({
          event_id: id,
          parent_session_id: data.id,
          title: sub.title || `Sub-session ${j + 1}`,
          start_at: sub._date && sub._startTime ? (() => { const d = new Date(sub._date); const t = new Date(sub._startTime); d.setHours(t.getHours(), t.getMinutes()); return d.toISOString() })() : null,
          end_at: sub._date && sub._endTime ? (() => { const d = new Date(sub._date); const t = new Date(sub._endTime); d.setHours(t.getHours(), t.getMinutes()); return d.toISOString() })() : null,
          location_type: 'ADDRESS',
          address: sub.address || null,
          sort_order: j,
          is_required: true,
        })
      }
    }
  } else {
    const sessionId = s._savedId ?? s.id
    const { error } = await db.from('sessions').update(payload).eq('id', sessionId)
    if (error) throw new Error(error.message)
    // Save fee_components for this session
    await saveSessionFees(sessionId, s._feesConfig)
    // If this is a master session, propagate shared fields to all linked sessions
    if (s.is_master) {
      await propagateMasterToLinked(sessionId, payload)
    }
  }
}

async function saveSessionFees(sessionId: string, feesConfig: any) {
  await db.from('fee_components').delete().eq('session_id', sessionId)
  const fees: any[] = (feesConfig?.base_fees ?? []).filter((f: any) => f.name?.trim())
  if (feesConfig?.is_charged && fees.length) {
    const { error } = await db.from('fee_components').insert(
      fees.map((f: any, i: number) => ({
        session_id: sessionId,
        name: f.name.trim(),
        xero_code: f.xero_code ?? null,
        amount: f.amount ?? 0,
        sort_order: i,
      }))
    )
    if (error) throw new Error(error.message)
  }
}

async function saveSessions() {
  savingSessions.value = true
  try {
    for (const s of sessions.value) {
      await saveSession(s)
    }
    toast.add({ severity: 'success', summary: 'Sessions saved', life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: e?.message ?? String(e), life: 5000 })
  } finally {
    savingSessions.value = false
  }
}

// ---- Notes ----
const notes = ref<{ text: string; created_at: string }[]>([])
function addNote() {
  notes.value.unshift({ text: '', created_at: new Date().toLocaleDateString('en-AU') })
}

// ---- Banner upload ----
const { uploadFile } = useUpload()
const bannerInput = ref<HTMLInputElement | null>(null)
const uploadingBanner = ref(false)

async function handleBannerUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingBanner.value = true
  try {
    const url = await uploadFile(file)
    editForm.value.banner_url = url
    if (event.value) event.value.banner_url = url
    await db.from('events').update({ banner_url: url }).eq('id', id)
  } finally {
    uploadingBanner.value = false
    if (bannerInput.value) bannerInput.value.value = ''
  }
}

async function saveBannerTitle() {
  const title = editForm.value.title.trim()
  if (!title || title === event.value?.title) return
  await db.from('events').update({ title }).eq('id', id)
  if (event.value) event.value.title = title
}

// ---- Category creation ----
const showNewCategoryDialog = ref(false)
const newCategoryName = ref('')
const newCategoryColor = ref('#1E2157')
const savingCategory = ref(false)
const categoryColorPalette = [
  '#1E2157', '#3B82F6', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#6B7280', '#1EA97C', '#F97316', '#84CC16',
]
async function createCategory() {
  if (!newCategoryName.value.trim()) return
  savingCategory.value = true
  const { data, error } = await db.from('categories').insert({
    org_id: orgId.value, name: newCategoryName.value.trim(), color: newCategoryColor.value,
  }).select('id, name, color').single()
  if (!error && data) {
    allCategories.value.push(data)
    editForm.value.category_ids.push(data.id)
    toast.add({ severity: 'success', summary: 'Calendar created', life: 2000 })
  }
  showNewCategoryDialog.value = false
  newCategoryName.value = ''
  newCategoryColor.value = '#1E2157'
  savingCategory.value = false
}

// ---- Formatters ----
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}
function formatDay(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { weekday: 'short' }).toUpperCase()
}
function formatDayNum(d: string) { return new Date(d).getDate() }
function formatMonth(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { month: 'short' }).toUpperCase()
}

function statusSeverity(s: string) {
  return { DRAFT: 'secondary', PUBLISHED: 'success', CANCELLED: 'danger', ARCHIVED: 'warn' }[s] ?? 'secondary'
}
function inviteeSeverity(s: string) {
  return { CONFIRMED: 'success', INVITED: 'info', DECLINED: 'danger', HOLD: 'warn', INTERESTED: 'secondary' }[s ?? 'INVITED'] ?? 'secondary'
}

// ---- Load event ----
async function loadEvent() {
  loading.value = true
  const { data } = await db
    .from('events')
    .select('*, category:categories!category_id(id, name, color, icon), secondary_category:categories!secondary_category_id(id, name, color)')
    .eq('id', id)
    .single()
  event.value = data
  if (data) {
    hasTickets.value = data.has_tickets ?? false
    const startDate = data.start_at ? new Date(data.start_at) : null
    const endDate = data.end_at ? new Date(data.end_at) : null
    editForm.value = {
      title: data.title ?? '',
      description: data.description ?? '',
      banner_url: data.banner_url ?? '',
      category_ids: [data.category_id, data.secondary_category_id].filter(Boolean),
      is_all_day: data.is_all_day ?? false,
      start_date: startDate,
      start_time: startDate,
      end_date: endDate,
      end_time: endDate,
      locations: data.locations ?? [{ type: data.location_type ?? 'ADDRESS', venue_name: data.venue_name ?? '', address: data.address ?? '', meeting_link: data.meeting_link ?? '', bookable_ids: data.bookable_id ? [data.bookable_id] : [] }],
      is_public: data.is_public ?? false,
      is_featured: data.is_featured ?? false,
      show_attendee_list: data.show_attendee_list ?? false,
      show_attendee_count: data.show_attendee_count ?? true,
      allow_interest: data.allow_interest ?? false,
      hold_spot_enabled: data.hold_spot_enabled ?? false,
      has_waitlist: data.has_waitlist ?? false,
      has_capacity: !!data.capacity_max,
      capacity_max: data.capacity_max,
      custom_terms: (() => { try { const p = JSON.parse(data.tc_content ?? '[]'); return Array.isArray(p) ? p : [] } catch { return data.tc_content ? [data.tc_content] : [] } })(),
      allow_guests: data.allow_guests ?? false,
      phased_registration: data.phased_registration ?? false,
      member_window_days: data.member_window_days ?? 40,
      public_opens_at: data.public_opens_at ? new Date(data.public_opens_at) : null,
      reg_open_at: data.reg_open_at ? new Date(data.reg_open_at) : null,
      reg_close_at: data.reg_close_at ? new Date(data.reg_close_at) : null,
      repeat: data.recurrence_rule ?? '',
    }
    // Load sub-groups
    subGroups.value = Array.isArray(data.sub_groups) ? data.sub_groups : []
  }
  loading.value = false
  breadcrumbs.value = [{ label: 'Events', to: '/events' }, { label: event.value?.title ?? 'Event' }]
}

async function loadInvitees() {
  inviteesLoading.value = true
  const { data } = await db
    .from('invitees')
    .select('*, person:persons(id, first_name, last_name, email)')
    .eq('event_id', id)
    .order('invited_at')
  invitees.value = data ?? []
  memberGroupsForInvitees.value = []
  // Restore sub-group assignments from DB
  const map: Record<string, string> = {}
  for (const inv of invitees.value) {
    if (inv.sub_group_id) map[inv.id] = inv.sub_group_id
  }
  inviteeGroupMap.value = map
  inviteesLoading.value = false
}

async function loadFees() {
  feesLoading.value = true
  const { data } = await db.from('fee_components').select('*').eq('event_id', id).is('session_id', null).order('sort_order')
  if (data && data.length) {
    feeLineItems.value = data.map((f: any) => ({ id: f.id, name: f.name, xero_code: f.xero_code ?? '', amount: f.amount }))
  } else {
    // Seed a default fee line item named after the event
    const defaultFee = { id: crypto.randomUUID(), name: event.value?.title ?? '', xero_code: '', amount: null }
    feeLineItems.value = [defaultFee]
    await db.from('fee_components').insert({ id: defaultFee.id, event_id: id, name: defaultFee.name, xero_code: null, amount: 0, sort_order: 0, session_id: null })
  }
  feesLoading.value = false
}

let syncFeesTimer: ReturnType<typeof setTimeout> | null = null
function syncFees(items: import('~/composables/useFeeGroups').FeeLineItem[]) {
  feeLineItems.value = items
  if (syncFeesTimer) clearTimeout(syncFeesTimer)
  syncFeesTimer = setTimeout(async () => {
    const existing = feeLineItems.value.map(f => f.id)
    if (existing.length) {
      await db.from('fee_components').delete().eq('event_id', id).is('session_id', null).not('id', 'in', `(${existing.join(',')})`)
    } else {
      await db.from('fee_components').delete().eq('event_id', id).is('session_id', null)
    }
    for (let i = 0; i < feeLineItems.value.length; i++) {
      const f = feeLineItems.value[i]
      await db.from('fee_components').upsert({
        id: f.id, event_id: id, name: f.name, xero_code: f.xero_code || null, amount: f.amount ?? 0, sort_order: i, session_id: null,
      })
    }
  }, 600)
}

async function loadComms() {
  commsLoading.value = true
  const { data } = await db.from('communications').select('*').eq('event_id', id).order('sent_at', { ascending: false })
  if (data && data.length) {
    communications.value = data
  } else {
    // Demo data
    communications.value = [
      { id: 'demo-1', channel: 'EMAIL',   subject: 'Invitation',        body: 'A special email list to send to our alumni', recipient_count: 25, sent_at: '2025-01-10T12:32:00Z', scheduled_at: null },
      { id: 'demo-2', channel: 'APP',     subject: 'Event Reminder',    body: 'Don\'t forget your event is coming up this weekend.', recipient_count: 25, sent_at: '2025-01-12T09:00:00Z', scheduled_at: null },
      { id: 'demo-3', channel: 'EMAIL',   subject: 'Last Chance to Register', body: 'Registrations close tomorrow — make sure you\'ve signed up.', recipient_count: 40, sent_at: '2025-01-14T08:00:00Z', scheduled_at: null },
      { id: 'demo-4', channel: 'APP',     subject: 'Invitation',        body: 'A special email list to send to our alumni', recipient_count: 25, sent_at: null, scheduled_at: '2025-01-20T12:32:00Z', schedule_label: '3 hours before event' },
      { id: 'demo-5', channel: 'EMAIL',   subject: 'Post-Event Survey', body: 'We\'d love your feedback on the event.', recipient_count: 25, sent_at: null, scheduled_at: '2025-01-22T18:00:00Z', schedule_label: '1 day after event' },
    ]
  }
  commsLoading.value = false
}

async function loadPersons() {
  const existingIds = new Set(invitees.value.map(i => i.person_id))
  const { data } = await db.from('persons').select('id, first_name, last_name, email').eq('org_id', orgId.value)
  availablePersons.value = (data ?? [])
    .filter(p => !existingIds.has(p.id))
    .map(p => ({ ...p, full_name: `${p.first_name} ${p.last_name}` }))
}

async function loadCategories() {
  const { data } = await db.from('categories').select('id, name, color').eq('org_id', orgId.value).order('name')
  allCategories.value = data ?? []
}

// ---- Actions ----
const showPublishDialog = ref(false)
const publishSendInvite = ref(false)
const publishToWebsite = ref(false)
const publishScheduled = ref(false)
const publishAtDate = ref<Date | null>(null)
const publishAtTime = ref<Date | null>(null)
const publishingEvent = ref(false)
const publishInviteeCount = ref<number | null>(null)

async function onPublishDialogOpen() {
  publishInviteeCount.value = null
  const { count } = await db.from('invitees').select('id', { count: 'exact', head: true }).eq('event_id', id)
  publishInviteeCount.value = count ?? 0
}

async function confirmPublish() {
  publishingEvent.value = true
  try {
    let publishAt: string | null = null
    if (publishScheduled.value && publishAtDate.value) {
      const d = new Date(publishAtDate.value)
      if (publishAtTime.value) {
        d.setHours(publishAtTime.value.getHours(), publishAtTime.value.getMinutes(), 0, 0)
      } else {
        d.setHours(0, 0, 0, 0)
      }
      publishAt = d.toISOString()
    }

    const update: Record<string, any> = {
      is_public: publishToWebsite.value,
      publish_at: publishAt,
    }
    if (!publishScheduled.value) {
      update.status = 'PUBLISHED'
    }
    await db.from('events').update(update).eq('id', id)

    if (publishScheduled.value && publishAt) {
      toast.add({ severity: 'success', summary: 'Publish scheduled', detail: `Will go live on ${new Date(publishAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`, life: 5000 })
    } else if (publishSendInvite.value) {
      toast.add({ severity: 'info', summary: 'Published', detail: 'Invite emails have been queued.', life: 4000 })
    } else {
      toast.add({ severity: 'success', summary: 'Event published', life: 3000 })
    }
    showPublishDialog.value = false
    loadEvent()
  } finally {
    publishingEvent.value = false
  }
}

async function unpublishEvent() {
  await db.from('events').update({ status: 'DRAFT' }).eq('id', id)
  toast.add({ severity: 'success', summary: 'Event unpublished', detail: 'Reverted to draft.', life: 3000 })
  loadEvent()
}

async function archiveEvent() {
  await db.from('events').update({ status: 'ARCHIVED' }).eq('id', id)
  toast.add({ severity: 'success', summary: 'Event archived', life: 3000 })
  navigateTo('/events')
}

function buildDateTime(date: Date | null, time: Date | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (time && !editForm.value.is_all_day) d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  else d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function saveOverview() {
  await saveEdit()
  overviewEditing.value = false
}

function cancelOverviewEdit() {
  // Reset form fields to current event values
  if (event.value) {
    editForm.value.title = event.value.title ?? ''
    editForm.value.description = event.value.description ?? ''
    editForm.value.banner_url = event.value.banner_url ?? ''
    editForm.value.category_ids = [event.value.category_id, event.value.secondary_category_id].filter(Boolean)
  }
  overviewEditing.value = false
}

async function saveEdit() {
  saving.value = true
  const { error } = await db.from('events').update({
    title: editForm.value.title,
    description: editForm.value.description || null,
    banner_url: editForm.value.banner_url || null,
    category_id: editForm.value.category_ids[0] ?? null,
    secondary_category_id: editForm.value.category_ids[1] ?? null,
    is_all_day: editForm.value.is_all_day,
    start_at: buildDateTime(editForm.value.start_date, editForm.value.start_time),
    end_at: buildDateTime(editForm.value.end_date, editForm.value.end_time),
    locations: editForm.value.locations,
    location_type: (editForm.value.locations[0]?.type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE',
    address: editForm.value.locations[0]?.type === 'ADDRESS' ? (editForm.value.locations[0].address || null) : null,
    meeting_link: editForm.value.locations[0]?.type === 'ONLINE' ? (editForm.value.locations[0].meeting_link || null) : null,
    bookable_id: editForm.value.locations[0]?.type === 'BOOKABLE' ? (editForm.value.locations[0].bookable_ids[0] ?? null) : null,
    is_public: editForm.value.is_public,
    is_featured: editForm.value.is_featured,
    show_attendee_list: editForm.value.show_attendee_list,
    show_attendee_count: editForm.value.show_attendee_count,
    allow_interest: editForm.value.allow_interest,
    hold_spot_enabled: editForm.value.hold_spot_enabled,
    has_waitlist: editForm.value.has_waitlist,
    allow_guests: editForm.value.allow_guests,
    phased_registration: editForm.value.phased_registration,
    member_window_days: editForm.value.member_window_days,
    public_opens_at: editForm.value.public_opens_at ?? null,
    capacity_max: editForm.value.has_capacity ? (editForm.value.capacity_max ?? null) : null,
    tc_content: editForm.value.custom_terms.filter((t: string) => t.trim()).length
      ? JSON.stringify(editForm.value.custom_terms.filter((t: string) => t.trim()))
      : null,
    sub_groups: subGroups.value,
  }).eq('id', id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 3000 })
  } else {
    toast.add({ severity: 'success', summary: 'Event updated', life: 3000 })
    loadEvent()
  }
  saving.value = false
}

async function handleAddInvitee() {
  if (!newInviteePerson.value) return
  addingInvitee.value = true
  const { error } = await db.from('invitees').insert({
    event_id: id,
    person_id: newInviteePerson.value,
    status: 'INVITED',
  })
  if (error) {
    const msg = error.code === '23505' ? 'This person is already invited.' : error.message
    toast.add({ severity: 'error', summary: 'Could not add invitee', detail: msg, life: 4000 })
  } else {
    toast.add({ severity: 'success', summary: 'Invitee added', life: 3000 })
    showAddInvitee.value = false
    newInviteePerson.value = ''
    loadInvitees()
  }
  addingInvitee.value = false
}

async function removeInvitee(inviteeId: string) {
  await db.from('invitees').delete().eq('id', inviteeId)
  toast.add({ severity: 'success', summary: 'Invitee removed', life: 3000 })
  loadInvitees()
}

async function setInviteeStatus(inviteeId: string, status: string) {
  await db.from('invitees').update({ status }).eq('id', inviteeId)
  loadInvitees()
}

async function toggleAttendance(inv: any) {
  if (attendanceInSessionMode.value && selectedAttendanceSessionId.value) {
    await toggleSessionAttendance(inv, selectedAttendanceSessionId.value)
    return
  }
  const newVal = !inv.attended
  await db.from('invitees').update({ attended: newVal }).eq('id', inv.id)
  inv.attended = newVal
}


async function handleSendComms() {
  if (!newComms.value.subject || !newComms.value.body) return
  sendingComms.value = true
  const audienceCount = newComms.value.audience === 'ALL'
    ? invitees.value.length
    : invitees.value.filter(i => i.status === newComms.value.audience).length
  const { error } = await db.from('communications').insert({
    event_id: id, channel: newComms.value.channel, subject: newComms.value.subject,
    body: newComms.value.body, recipient_count: audienceCount, status: 'SENT', sent_at: new Date().toISOString(),
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Message sent', life: 3000 })
    showSendComms.value = false
    newComms.value = { channel: 'EMAIL', audience: 'ALL', subject: '', body: '' }
    loadComms()
  }
  sendingComms.value = false
}

// ---- Watch tab changes ----
watch(activeTab, (tab, oldTab) => {
  router.replace({ query: { ...route.query, tab } })
  if (tab === 'invitees' || tab === 'attendance') {
    if (!invitees.value.length) loadInvitees()
    if (tab === 'attendance') {
      if (!sessions.value.length) {
        loadSessions().then(() => {
          if (!selectedAttendanceSessionId.value && attendanceSessions.value.length) {
            selectAttendanceSession(attendanceSessions.value[0].id)
          }
        })
      } else if (!selectedAttendanceSessionId.value && attendanceSessions.value.length) {
        selectAttendanceSession(attendanceSessions.value[0].id)
      }
    }
  }
  if (tab === 'details') { loadCategories() }
  if (tab === 'sessions') {
    if (!sessions.value.length) loadSessions()
    else if (!viewingSession.value && sessions.value.length) openSession(sessions.value[0])
  }
  if (tab === 'forms') { if (!sessions.value.length) loadSessions(); loadDiscounts(); loadEvtFormConfig() }
  if (tab === 'tickets') { loadTicketTypes(); loadTicketOrders(); if (!sessions.value.length) loadSessions() }
  if (tab === 'communication') loadComms()
  if (tab === 'discounts') loadDiscounts()
  if (tab === 'reporting') { if (!sessions.value.length) loadSessions().then(loadReporting); else loadReporting() }
  if (tab === 'notes') loadTasks()
})

function triggerSessionAutoSave(session: any) {
  if (!session || _suppressAutoSave) return
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer)
  if (sessionSavedClearTimer) clearTimeout(sessionSavedClearTimer)
  sessionSaveStatus.value = 'saving'
  sessionSaveTimer = setTimeout(async () => {
    try {
      await saveSession(session)
      sessionSaveStatus.value = 'saved'
      sessionSavedClearTimer = setTimeout(() => { sessionSaveStatus.value = 'idle' }, 2000)
    } catch (e: any) {
      sessionSaveStatus.value = 'error'
      toast.add({ severity: 'error', summary: 'Session save failed', detail: e?.message ?? String(e), life: 5000 })
    }
  }, 800)
}

// Single deep watcher: distinguishes session switch (reference change) from user edits (deep mutation)
watch(viewingSession, async (session, oldSession) => {
  if (session === oldSession) {
    // Deep property mutation — user edited something, debounce auto-save
    if (session) triggerSessionAutoSave(session)
  } else {
    // Reference changed — session switch: flush save on old session, no spurious save on new
    if (sessionSaveTimer) {
      clearTimeout(sessionSaveTimer)
      sessionSaveTimer = null
    }
    if (oldSession) {
      try { await saveSession(oldSession) } catch {}
    }
  }
}, { deep: true })

onBeforeRouteLeave(() => {
  if (sessionSaveTimer && viewingSession.value) {
    clearTimeout(sessionSaveTimer)
    saveSession(viewingSession.value).catch(() => {})
  }
})

onMounted(async () => {
  await loadEvent()

  // Apply query-param date prefill and persist to DB
  if (route.query.date) {
    const startStr = route.query.date as string
    const endStr = route.query.endDate as string | undefined
    // Date-only strings (no time component) → treat as all-day
    const isAllDay = !startStr.includes('T')
    const start = new Date(startStr)
    const end = endStr ? new Date(endStr) : start
    editForm.value.start_date = start
    editForm.value.end_date = end
    editForm.value.is_all_day = isAllDay
    // Don't set start_time/end_time for all-day events
    if (!isAllDay) {
      editForm.value.start_time = start
      editForm.value.end_time = end
    }
    // Persist immediately so dates survive navigation
    const startAt = isAllDay ? `${startStr}T00:00:00.000Z` : start.toISOString()
    const endAt = isAllDay ? `${(endStr ?? startStr)}T00:00:00.000Z` : end.toISOString()
    await db.from('events').update({ start_at: startAt, end_at: endAt, is_all_day: isAllDay }).eq('id', id)
    if (event.value) { event.value.start_at = startAt; event.value.end_at = endAt; event.value.is_all_day = isAllDay }
  }

  // Apply AI prefill from sessionStorage
  if (route.query.prefill) {
    const raw = sessionStorage.getItem('ai_event_prefill')
    if (raw) {
      sessionStorage.removeItem('ai_event_prefill')
      try {
        const p = JSON.parse(raw)
        if (p.title) editForm.value.title = p.title
        if (p.description) editForm.value.description = p.description
        if (typeof p.is_all_day === 'boolean') editForm.value.is_all_day = p.is_all_day
        if (p.start_date) { const d = new Date(p.start_date); editForm.value.start_date = d; editForm.value.start_time = d }
        if (p.end_date) { const d = new Date(p.end_date); editForm.value.end_date = d; editForm.value.end_time = d }
        if (p.repeat) editForm.value.repeat = p.repeat
        if (p.location_type) editForm.value.locations[0].type = p.location_type
        if (p.venue_name) editForm.value.locations[0].venue_name = p.venue_name
        if (p.address) editForm.value.locations[0].address = p.address
        // Save the prefilled data to the DB immediately
        await db.from('events').update({
          title: editForm.value.title,
          description: editForm.value.description,
          is_all_day: editForm.value.is_all_day,
          start_at: editForm.value.start_date ? editForm.value.start_date.toISOString() : null,
          end_at: editForm.value.end_date ? editForm.value.end_date.toISOString() : null,
          recurrence_rule: editForm.value.repeat || null,
        }).eq('id', id)
        await loadEvent()
      } catch (e) { console.warn('AI prefill failed:', e) }
    }
  }

  if (activeTab.value === 'sessions' || activeTab.value === 'forms') loadSessions()
  if (activeTab.value === 'discounts' || activeTab.value === 'forms') loadDiscounts()
  if (activeTab.value === 'forms') loadEvtFormConfig()
  loadInvitees()
  loadCategories()
  loadFees()
  // Load bookables for locationSummary venue-name resolution
  const { data } = await db.from('bookables').select('id, name, parent_id').eq('org_id', orgId.value).eq('type', 'VENUE').eq('status', 'ACTIVE')
  allBookables.value = data ?? []

  // Auto-focus the title for new events without a title
  if (!event.value?.title && event.value?.style !== 'ADVANCED') {
    startFieldEdit('title')
  }
})

onUnmounted(() => { breadcrumbs.value = [] })
</script>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.15s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
