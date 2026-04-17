<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">

    <!-- Top bar -->
    <div class="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <NuxtLink to="/events" class="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <i class="pi pi-chevron-left text-xs" /> Events
        </NuxtLink>
        <span class="text-gray-300">/</span>
        <span v-if="loading" class="text-sm text-gray-400">Loading…</span>
        <span v-else class="text-sm font-medium" :class="event?.title ? 'text-gray-800' : 'text-gray-400 italic'">{{ event?.title || 'New Event' }}</span>
        <Tag v-if="event" :value="event.status" :severity="statusSeverity(event.status)" class="text-xs" />
      </div>
      <div class="flex items-center gap-2">
        <Button v-if="event?.status === 'DRAFT'" label="Publish" icon="pi pi-send" size="small"
          @click="publishEvent" style="background:#34B66D; border-color:#34B66D" />
        <Button icon="pi pi-ellipsis-v" severity="secondary" text size="small" @click="e => moreMenu.toggle(e)" />
        <Menu ref="moreMenu" :model="moreMenuItems" :popup="true" />
      </div>
    </div>

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

    <!-- Content -->
    <div class="flex-1 flex flex-col min-h-0 bg-[#F5F8FA]">

      <!-- OVERVIEW TAB -->
      <div v-if="activeTab === 'overview'" class="overflow-y-auto flex-1">
        <!-- No-banner title strip (shown when not editing and event has no image) -->
        <div v-if="!overviewEditing && !event?.banner_url" class="max-w-[1140px] mx-auto px-6 py-5 flex items-center gap-3 bg-white border-b border-gray-200">
          <h1 class="text-2xl font-semibold text-gray-900 flex-1">{{ event?.title }}</h1>
          <Button label="Edit" icon="pi pi-pen-to-square" size="small" severity="secondary" outlined @click="overviewEditing = true" />
        </div>
        <!-- Hero banner (only when editing or event has an image) -->
        <div v-if="overviewEditing || event?.banner_url" class="max-w-[1140px] mx-auto relative overflow-hidden" style="height:300px">
          <div v-if="overviewEditing && editForm.banner_url" class="absolute inset-0">
            <img :src="editForm.banner_url" class="w-full h-full object-cover" />
          </div>
          <div v-else-if="!overviewEditing && event?.banner_url" class="absolute inset-0">
            <img :src="event.banner_url" class="w-full h-full object-cover" />
          </div>
          <div v-else class="absolute inset-0 bg-gradient-to-br from-[#1E2157] to-[#2e38a8]" />
          <!-- Banner upload overlay in edit mode -->
          <div v-if="overviewEditing" class="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer" @click.self="bannerInput?.click()">
            <div class="flex flex-col items-center gap-2 text-white pointer-events-none">
              <i class="pi pi-camera text-2xl" />
              <span class="text-sm font-medium">Change banner</span>
            </div>
            <input ref="bannerInput" type="file" accept="image/*" class="hidden" @change="handleBannerUpload" />
          </div>
          <!-- Title + Edit/Save/Cancel all on one line -->
          <div class="absolute bottom-0 left-0 right-0 bg-black/60 px-6 py-4 flex items-center gap-3">
            <InputText v-if="overviewEditing" v-model="editForm.title"
              class="flex-1 !text-white !text-xl !font-semibold !bg-transparent !border-0 !border-b !border-white/40 !rounded-none !px-0 focus:!ring-0"
              placeholder="Event title" />
            <h1 v-else class="text-2xl font-semibold text-white flex-1">{{ event?.title }}</h1>
            <template v-if="overviewEditing">
              <Button label="Cancel" size="small" text class="!text-white/80 hover:!text-white" @click="cancelOverviewEdit" />
              <Button label="Save" icon="pi pi-check" size="small" :loading="saving" @click="saveOverview"
                class="!bg-white !text-[#1E2157] !border-white hover:!bg-white/90 font-semibold" />
            </template>
            <Button v-else label="Edit" icon="pi pi-pen-to-square" size="small"
              class="!text-white !border-white/50 hover:!bg-white/10"
              severity="secondary" outlined @click="overviewEditing = true" />
          </div>
          <!-- Date badge -->
          <div v-if="event?.start_at && !overviewEditing" class="absolute bottom-4 right-6 bg-white rounded-xl shadow-lg px-4 py-3 text-center min-w-[72px]">
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

            <!-- Name row -->
            <div>
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
            :categories="allCategories"
            :savingField="savingField"
            :feesLoading="feesLoading"
            :showLocation="event?.style !== 'ADVANCED'"
            @save="saveField"
            @fees-change="syncFees"
            @new-category="showNewCategoryDialog = true"
          />

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
            <div class="px-5 pt-5 pb-3">
              <h2 class="text-base font-bold text-gray-900">Registration Forms</h2>
              <p class="text-xs text-gray-400 mt-0.5">Configure a form for each registration group.</p>
            </div>
            <div class="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
              <!-- Member group header -->
              <p class="px-2 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Member</p>
              <button
                v-for="group in evtFormGroupsMember" :key="group.id"
                type="button"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left"
                :class="selectedFormGroupId === group.id
                  ? 'bg-[#1E2157]/5 border-[#1E2157]/20 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'"
                @click="selectEvtFormGroup(group.id)">
                <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  :class="group.noRegistrations ? 'bg-orange-50' : group.complete ? 'bg-green-50' : 'bg-red-50'">
                  <i class="pi text-base"
                    :class="group.noRegistrations ? 'pi-ban text-orange-400' : group.complete ? 'pi-check text-green-500' : 'pi-exclamation-circle text-red-400'" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800 truncate">{{ group.name }}</p>
                  <p class="text-xs mt-0.5" :class="group.noRegistrations ? 'text-orange-400' : group.complete ? 'text-green-500' : 'text-gray-400'">
                    {{ group.noRegistrations ? 'No registrations' : group.complete ? 'Complete' : `${group.filledCount} of ${group.totalCount} sections saved` }}
                  </p>
                </div>
                <div v-if="!group.noRegistrations && !group.complete" class="shrink-0 flex flex-col items-end gap-1">
                  <span class="text-xs font-bold text-gray-400">{{ group.filledCount }}/{{ group.totalCount }}</span>
                  <div class="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full bg-[#1ab4e8] transition-all" :style="`width:${group.totalCount ? (group.filledCount/group.totalCount)*100 : 0}%`" />
                  </div>
                </div>
                <i v-else class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
              </button>

              <!-- Public group header -->
              <p class="px-2 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Public / Guest</p>
              <button
                v-for="group in evtFormGroupsPublic" :key="group.id"
                type="button"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left"
                :class="selectedFormGroupId === group.id
                  ? 'bg-[#1E2157]/5 border-[#1E2157]/20 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'"
                @click="selectEvtFormGroup(group.id)">
                <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  :class="group.noRegistrations ? 'bg-orange-50' : group.complete ? 'bg-green-50' : 'bg-red-50'">
                  <i class="pi text-base"
                    :class="group.noRegistrations ? 'pi-ban text-orange-400' : group.complete ? 'pi-check text-green-500' : 'pi-exclamation-circle text-red-400'" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800 truncate">{{ group.name }}</p>
                  <p class="text-xs mt-0.5" :class="group.noRegistrations ? 'text-orange-400' : group.complete ? 'text-green-500' : 'text-gray-400'">
                    {{ group.noRegistrations ? 'No registrations' : group.complete ? 'Complete' : `${group.filledCount} of ${group.totalCount} sections saved` }}
                  </p>
                </div>
                <div v-if="!group.noRegistrations && !group.complete" class="shrink-0 flex flex-col items-end gap-1">
                  <span class="text-xs font-bold text-gray-400">{{ group.filledCount }}/{{ group.totalCount }}</span>
                  <div class="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div class="h-full rounded-full bg-[#1ab4e8] transition-all" :style="`width:${group.totalCount ? (group.filledCount/group.totalCount)*100 : 0}%`" />
                  </div>
                </div>
                <i v-else class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
              </button>
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
                    <h2 class="text-base font-bold text-gray-900">{{ currentEvtFormGroupName }}</h2>
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
                    <p class="text-xs mt-0.5" :class="s.complete ? 'text-green-500' : 'text-gray-400'">{{ s.complete ? 'Saved' : 'Not configured' }}</p>
                  </div>
                  <i class="pi text-sm shrink-0" :class="s.complete ? 'pi-check-circle text-green-500' : 'pi-chevron-right text-gray-300'" />
                </button>
              </div>
              <div class="px-4 py-4 border-t border-gray-100 space-y-2 shrink-0">
                <button type="button" class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors" @click="evtFormShowSections = false">Done</button>
                <button type="button" class="w-full text-center text-xs text-gray-400 hover:text-[#182e59] transition-colors py-1" @click="changeEvtFormType()">Change form type</button>
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

          </template>

        </div>

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
                <button type="button" class="text-sm text-gray-400 hover:text-[#182e59] transition-colors" @click="chooseEvtFormType('skip')">Skip - I'll do this later</button>
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

            <!-- Sessions section (if event has sessions marked to display) -->
            <div v-if="sessions.some((s: any) => s.display_on_form !== false)" class="px-6 py-8 space-y-3">
              <h3 class="text-sm font-bold text-gray-800">{{ currentEvtFormDesign.sessionsHeading || 'Sessions' }}</h3>
              <div class="space-y-2">
                <div
                  v-for="session in sessions.filter((s: any) => s.display_on_form !== false)" :key="session.id"
                  class="flex items-start gap-4 border border-gray-200 rounded-xl px-4 py-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800">{{ session.title || 'Untitled Session' }}</p>
                    <div v-if="session.description" class="text-sm text-gray-500 mt-0.5 leading-relaxed" v-html="session.description" />
                  </div>
                  <div class="shrink-0 text-right">
                    <template v-if="session.fees && session.fees.length">
                      <p class="text-[10px] text-gray-400">from</p>
                      <p class="text-sm font-bold text-[#1E2157]">${{ Math.min(...session.fees.map((f: any) => f.amount)).toFixed(2) }}</p>
                    </template>
                    <p v-else class="text-sm font-semibold text-gray-400">Free</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Form fields: accordion preview (scratch mode only) -->
            <div v-if="evtFormGroupModes[selectedFormGroupId] === 'scratch'" class="">

              <!-- Heading -->
              <div class="px-6 pt-8 pb-5">
                <h3 class="text-sm font-bold text-gray-800">{{ currentEvtFormDesign.formHeading || 'Fill in the form to register' }}</h3>
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
                    <span class="text-sm font-bold w-[72px] text-right tabular-nums shrink-0" :class="(evtOrderRows[personIdx - 1] ?? []).reduce((s, r) => s + r.amount, 0) === 0 ? 'text-red-500' : 'text-[#1E2157]'">
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
                          class="space-y-1 group">
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
                            v-model="evtPersonValues[personIdx - 1][field.label]"
                            :placeholder="field.placeholder || ''"
                            rows="3"
                            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors resize-none" />
                          <!-- Select/Dropdown -->
                          <select
                            v-else-if="field.field_type === 'select'"
                            v-model="evtPersonValues[personIdx - 1][field.label]"
                            class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors bg-white">
                            <option value="" disabled>{{ field.placeholder || 'Select...' }}</option>
                            <option v-for="opt in (field.options ?? [])" :key="opt" :value="opt">{{ opt }}</option>
                          </select>
                          <!-- Checkbox -->
                          <label
                            v-else-if="field.field_type === 'checkbox'"
                            class="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              v-model="evtPersonValues[personIdx - 1][field.label]"
                              class="w-4 h-4 rounded border-gray-300 accent-[#1E2157]" />
                            <span class="text-sm text-gray-600">{{ field.placeholder || field.label }}</span>
                          </label>
                          <!-- Date -->
                          <input
                            v-else-if="field.field_type === 'date'"
                            type="date"
                            v-model="evtPersonValues[personIdx - 1][field.label]"
                            class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
                          <!-- Text/Email/Tel/Number -->
                          <input
                            v-else
                            :type="field.field_type"
                            v-model="evtPersonValues[personIdx - 1][field.label]"
                            :placeholder="field.placeholder || ''"
                            class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
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
                        <span class="tabular-nums w-[72px] text-right mr-9 shrink-0 text-[#1E2157]">${{ evtOrderRows[personIdx - 1].reduce((s, r) => s + r.amount, 0).toFixed(2) }}</span>
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
              <h3 class="text-sm font-bold text-gray-800">Terms and Conditions</h3>
              <FormsTermsConsentBlock
                v-for="tc in evtFormTermsShown" :key="tc.label"
                :label="tc.label"
                :agree-text="tc.agreeText"
                :agreed="evtPreviewTermsAgreed.has(tc.label)"
                @update:agreed="toggleEvtPreviewAgree(tc.label)" />
            </div>

            <!-- Payment: interactive radio selection -->
            <div v-if="evtFormPayment.plan.enabled || evtFormPayment.credit_card.enabled || evtFormPayment.invoice.enabled || evtFormPayment.coupon.enabled" class="px-6 py-8 space-y-2">
              <h3 class="text-sm font-bold text-gray-800 mb-3">Payment</h3>

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
            <div v-if="evtFormGroupModes[selectedFormGroupId] === 'simple'" class="px-6 py-6 border-t border-gray-100 space-y-5">

              <!-- Number of people -->
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Number of people</p>
                  <p class="text-xs text-gray-400 mt-0.5">How many are you registering?</p>
                </div>
                <div class="flex items-center gap-2 border border-gray-200 rounded-lg overflow-hidden">
                  <button type="button"
                    class="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30"
                    :disabled="simplePersonCount <= 1"
                    @click="simplePersonCount = Math.max(1, simplePersonCount - 1)">
                    <i class="pi pi-minus text-xs" />
                  </button>
                  <span class="w-7 text-center text-sm font-semibold text-gray-800">{{ simplePersonCount }}</span>
                  <button type="button"
                    class="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                    @click="simplePersonCount++">
                    <i class="pi pi-plus text-xs" />
                  </button>
                </div>
              </div>

              <!-- Cost summary -->
              <div class="border border-gray-200 rounded-xl overflow-hidden">
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <p class="text-xs font-bold text-gray-500 uppercase tracking-widest">Cost Summary</p>
                </div>
                <div class="px-4 py-3 space-y-2">
                  <div class="flex items-center text-sm">
                    <span class="flex-1 text-gray-500">Registration Fee × {{ simplePersonCount }}</span>
                    <span class="tabular-nums font-medium text-gray-700">${{ (EVT_BASE_REGISTRATION_FEE * simplePersonCount).toFixed(2) }}</span>
                  </div>
                </div>
                <div class="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center">
                  <span class="flex-1 text-sm font-bold text-gray-800">Total</span>
                  <span class="tabular-nums text-sm font-bold text-[#1E2157]">${{ (EVT_BASE_REGISTRATION_FEE * simplePersonCount).toFixed(2) }}</span>
                </div>
              </div>

              <!-- Response -->
              <div class="space-y-2">
                <p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your Response</p>
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
              <div class="flex items-center">
                <span class="flex-1 text-sm font-bold text-gray-900">Total</span>
                <span class="tabular-nums w-[72px] text-right mr-[53px] shrink-0 text-sm font-bold text-[#1E2157]">${{ evtOrderTotal.toFixed(2) }}</span>
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
      <div v-else-if="activeTab === 'discounts'" class="max-w-4xl mx-auto px-6 py-6 space-y-5 overflow-y-auto flex-1">
        <div class="flex items-center justify-between">
          <div><h2 class="text-base font-semibold text-gray-900">Event Discounts</h2><p class="text-sm text-gray-500 mt-0.5">Create discount rules for this event.</p></div>
          <Button icon="pi pi-plus" label="Add Discount" size="small" @click="showDiscountDialog = true" style="background:#1E2157; border-color:#1E2157" />
        </div>
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div v-if="eventDiscounts.length === 0" class="py-12 text-center text-gray-400">
            <i class="pi pi-tag text-2xl mb-2 block" />
            <p class="text-sm">No discounts yet</p>
          </div>
          <div v-else>
            <div class="grid px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide" style="grid-template-columns:2fr 1fr 2fr 1.5fr 1fr 80px 60px">
              <span>Name</span><span>Discount Type</span><span>Conditions</span><span>Valid From</span><span>Coupon Code</span><span class="text-center">Enabled</span><span />
            </div>
            <div v-for="(disc, idx) in eventDiscounts" :key="disc.id ?? idx" class="grid px-4 py-3 border-b border-gray-100 last:border-0 items-center text-sm" style="grid-template-columns:2fr 1fr 2fr 1.5fr 1fr 80px 60px">
              <div>
                <p class="font-medium text-gray-800">{{ disc.name || '—' }}</p>
                <p class="text-xs text-gray-500 mt-0.5">{{ disc.form_text }}</p>
              </div>
              <span class="text-gray-700">{{ disc.modifier_type === 'PERCENT' ? `${disc.modifier_value}% off` : `$${disc.modifier_value} off` }}</span>
              <div class="flex flex-wrap gap-1">
                <span v-for="c in disc.conditions" :key="c" class="bg-[#D9DBFF] text-gray-700 text-xs px-2.5 py-0.5 rounded-full">{{ c }}</span>
                <span v-if="!disc.conditions?.length" class="text-gray-400">—</span>
              </div>
              <span class="text-gray-600 text-xs">{{ disc.valid_from_label }}</span>
              <span class="text-gray-600 font-mono text-xs">{{ disc.code || '—' }}</span>
              <div class="flex justify-center"><ToggleSwitch v-model="disc.is_active" size="small" /></div>
              <div class="flex gap-1 justify-end">
                <Button icon="pi pi-pencil" text size="small" severity="secondary" @click="editDiscount(idx)" />
                <Button icon="pi pi-trash" text size="small" severity="danger" @click="deleteDiscount(idx)" />
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3.5">
          <ToggleSwitch v-model="evtDiscountSettings.one_discount_only" />
          <span class="text-sm text-gray-700">Only one discount will be applied when registering</span>
        </div>
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
        <div class="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <span class="text-sm font-bold text-gray-900">Sessions</span>
            <div class="flex items-center gap-1">
              <Button v-if="masterSessions.length" icon="pi pi-file-import" size="small" text severity="secondary" v-tooltip.bottom="'From Master'" @click="showPickMaster = true" />
              <Button icon="pi pi-plus" size="small" @click="addSession" style="background:#1E2157;border-color:#1E2157" />
            </div>
          </div>

          <!-- List -->
          <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
            <div v-if="!sessions.length" class="py-8 text-center">
              <i class="pi pi-calendar-plus text-2xl text-gray-300 block mb-2" />
              <p class="text-xs text-gray-400 mb-3">No sessions yet</p>
              <Button label="Add First" icon="pi pi-plus" size="small" @click="addSession" style="background:#1E2157;border-color:#1E2157" />
            </div>
            <div v-for="(session, sIdx) in sessions" :key="session.id"
              class="group/item flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none"
              :class="{
                'bg-[#1E2157] text-white shadow-sm': viewingSession?.id === session.id,
                'hover:bg-gray-100': viewingSession?.id !== session.id,
                'opacity-40': draggingSessionIdx === sIdx,
                'ring-2 ring-[#1E2157] ring-inset ring-offset-0': dragOverSessionIdx === sIdx && draggingSessionIdx !== sIdx,
              }"
              draggable="true"
              @dragstart.stop="onSessionDragStart(sIdx)"
              @dragover.prevent="onSessionDragOver(sIdx)"
              @drop.prevent="onSessionDrop(sIdx)"
              @dragend="onSessionDragEnd"
              @click="openSession(session)">
              <i class="pi pi-bars text-xs cursor-grab shrink-0 transition-colors"
                :class="viewingSession?.id === session.id ? 'text-white/30' : 'text-gray-300'"
                @click.stop />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <i v-if="session.is_master" class="pi pi-crown text-[9px] shrink-0"
                    :class="viewingSession?.id === session.id ? 'text-yellow-300' : 'text-yellow-500'" />
                  <i v-else-if="session.master_id" class="pi pi-link text-[9px] shrink-0"
                    :class="viewingSession?.id === session.id ? 'text-purple-300' : 'text-purple-400'" />
                  <span class="text-sm font-medium truncate"
                    :class="viewingSession?.id === session.id ? 'text-white' : 'text-gray-800'">
                    {{ session.title || 'Untitled Session' }}
                  </span>
                </div>
                <div class="flex flex-col gap-0.5 mt-0.5 text-[10px]"
                  :class="viewingSession?.id === session.id ? 'text-white/50' : 'text-gray-400'">
                  <!-- Date row -->
                  <div class="flex items-center gap-1.5">
                    <i class="pi pi-calendar text-[9px] shrink-0" />
                    <template v-if="session.start_at">
                      <span>{{ new Date(session.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) }}</span>
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
                    </template>
                    <span v-else class="italic opacity-60">No date</span>
                  </div>
                  <!-- Location row -->
                  <div class="flex items-center gap-1.5 truncate">
                    <i class="pi pi-map-marker text-[9px] shrink-0" />
                    <span v-if="session.location_type === 'ADDRESS' && session.address" class="truncate">{{ session.address }}</span>
                    <span v-else-if="session.location_type === 'ONLINE' && session.meeting_link" class="truncate">Online</span>
                    <span v-else class="italic opacity-60">No location</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" @click.stop>
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
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-4 py-3 border-t border-gray-100 shrink-0">
            <Button label="Save Sessions" icon="pi pi-check" :loading="savingSessions" @click="saveSessions" class="w-full" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>

        <!-- Right: session detail -->
        <div class="flex-1 overflow-hidden flex flex-col">
          <!-- Empty state -->
          <div v-if="!viewingSession" class="flex-1 flex flex-col items-center justify-center text-center gap-2 text-gray-400 bg-[#F5F8FA]">
            <i class="pi pi-calendar text-3xl text-gray-300" />
            <p class="text-sm font-medium">Select a session to edit</p>
          </div>

          <!-- Session editor -->
          <SessionEditor
            v-else
            :session="viewingSession"
            :allSessions="sessions"
            :tabs="sessionTabs"
            :event-id="id"
            :showOutsideEventDates="!!(event?.start_at && event?.end_at)"
            @delete="removeSession(sessions.indexOf(viewingSession))"
            @syncFromMaster="syncSessionFromMaster(viewingSession)"
            @goToMaster="masterId => { const m = sessions.find((s: any) => s.id === masterId); if (m) openSession(m) }"
            @dateChange="syncSessionDates(viewingSession)"
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
              <div class="grid grid-cols-2 gap-6">
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

            <template #tab-discounts>
              <div class="space-y-4">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm text-gray-500">Discount codes that can be applied to this session's fees.</p>
                  <div class="flex items-center gap-2 shrink-0">
                    <template v-if="viewingSession.master_id">
                      <button v-if="isFieldLocked('discounts')" type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors" @click="unlockField('discounts')"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
                      <button v-else type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors" :class="masterFieldDiffers('discounts') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'" @click="pullFieldFromMaster('discounts')"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
                    </template>
                    <Button label="Add Discount" icon="pi pi-plus" size="small" :disabled="isFieldLocked('discounts')" @click="addSessionDiscount()" style="background:#1E2157;border-color:#1E2157" />
                  </div>
                </div>
                <div v-if="(viewingSession.discounts ?? []).length" class="border border-gray-200 rounded-xl overflow-hidden" :class="{ 'opacity-60 pointer-events-none': isFieldLocked('discounts') }">
                  <table class="w-full text-sm">
                    <thead><tr class="bg-gray-50 border-b border-gray-200">
                      <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Code</th>
                      <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                      <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Value</th>
                      <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Max uses</th>
                      <th class="w-12" />
                    </tr></thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-for="disc in viewingSession.discounts" :key="disc.id" class="hover:bg-gray-50">
                        <td class="px-4 py-2.5"><InputText v-model="disc.code" size="small" placeholder="e.g. MEMBER20" class="w-full uppercase" /></td>
                        <td class="px-4 py-2.5"><Select v-model="disc.type" :options="[{label:'% off',value:'PERCENT'},{label:'$ off',value:'FIXED'}]" option-label="label" option-value="value" size="small" class="w-28" /></td>
                        <td class="px-4 py-2.5"><div class="flex items-center gap-1"><span class="text-gray-400 text-sm">{{ disc.type === 'PERCENT' ? '%' : '$' }}</span><InputNumber v-model="disc.value" :min="0" size="small" class="w-20" /></div></td>
                        <td class="px-4 py-2.5"><InputNumber v-model="disc.max_uses" :min="1" size="small" placeholder="∞" class="w-20" /></td>
                        <td class="px-4 py-2.5 text-right"><Button icon="pi pi-trash" size="small" text severity="danger" @click="viewingSession.discounts.splice(viewingSession.discounts.indexOf(disc), 1)" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="py-10 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  <i class="pi pi-tag text-2xl mb-2 block text-gray-300" />No discounts set for this session
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
      <div v-else-if="activeTab === 'attendance'" class="flex-1 min-h-0 flex flex-col px-6 py-6 max-w-5xl mx-auto w-full overflow-y-auto">
        <div class="bg-white rounded-xl border border-gray-200 flex flex-col flex-1 overflow-hidden">

          <!-- Toolbar (sticky) -->
          <div class="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200 shrink-0">
            <div class="flex items-center gap-3">
              <h2 class="text-base font-semibold text-gray-900">Attendees</h2>
              <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="attendanceSearch" placeholder="Search members…" size="small" class="w-48" />
              </IconField>
            </div>
            <div class="flex items-center">
              <button class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" @click="showSendComms = true">
                <i class="pi pi-envelope text-lg" />
                <span class="text-[10px] font-medium">Email All</span>
              </button>
              <button class="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" @click="showSubGroupsDialog = true">
                <i class="pi pi-users text-lg" />
                <span class="text-[10px] font-medium">Sub Groups</span>
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
                  <th class="pl-3 pr-1 py-3 w-6 text-gray-300"><i class="pi pi-bars text-xs" /></th>
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

              <!-- Flat view (no sub groups) -->
              <tbody v-if="subGroups.length === 0" class="divide-y divide-gray-100">
                <tr v-for="inv in filteredSortedAttendees" :key="inv.id"
                  draggable="true" @dragstart="onDragStart($event, inv.id)"
                  class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': inv.attended }">
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
                  <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.attended" binary @change="toggleAttendance(inv)" /></td>
                  <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!inv.attended" @change="toggleSignOut(inv)" /></td>
                  <td class="py-2.5">
                    <div class="flex items-center gap-2 text-gray-400">
                      <button class="hover:text-gray-700 transition-colors" v-tooltip.top="'Email'" @click="openInviteeEmail(inv)"><i class="pi pi-envelope text-sm" /></button>
                      <button class="hover:text-[#1E2157] transition-colors" v-tooltip.top="'Notes'"><i class="pi pi-comments text-sm text-[#1E2157]" /></button>
                    </div>
                  </td>
                </tr>
              </tbody>

              <!-- Grouped view -->
              <template v-else>
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
                    class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': inv.attended }">
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
                    <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.attended" binary @change="toggleAttendance(inv)" /></td>
                    <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!inv.attended" @change="toggleSignOut(inv)" /></td>
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
                    class="hover:bg-gray-50 transition-colors" :class="{ 'bg-green-50': inv.attended }">
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
                    <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.attended" binary @change="toggleAttendance(inv)" /></td>
                    <td class="py-2.5 pr-3 text-center"><Checkbox :model-value="inv.signed_out" binary :disabled="!inv.attended" @change="toggleSignOut(inv)" /></td>
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
      </div>


    </div>
  </div>

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

  <!-- Discount Rule Dialog -->
  <Dialog v-model:visible="showDiscountDialog" :header="editingDiscountIdx !== null ? 'Edit Discount Rule' : 'Create Discount Rule'" modal style="width:600px" @hide="resetDiscountDraft">
    <div class="space-y-4 py-2">
      <div class="grid grid-cols-2 gap-x-10 gap-y-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-gray-700">Name</label>
          <InputText v-model="discountDraft.name" placeholder="Enter name of discount" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-gray-700">Registration form text</label>
          <InputText v-model="discountDraft.form_text" placeholder="Text shown on registration form" class="w-full" />
        </div>
        <div class="flex items-center gap-3 col-span-2">
          <label class="text-sm text-gray-700 w-36 shrink-0">Enabled</label>
          <ToggleSwitch v-model="discountDraft.is_active" />
        </div>
        <div class="flex items-center gap-3 col-span-2">
          <label class="text-sm text-gray-700 w-36 shrink-0">Value</label>
          <InputNumber v-model="discountDraft.modifier_value" placeholder="0" class="w-32" />
        </div>
        <div class="col-span-2">
          <div class="flex items-center gap-10">
            <label class="text-sm text-gray-700 w-36 shrink-0">Discount Type</label>
            <div class="flex gap-0">
              <button v-for="t in discountTypes" :key="t.value" type="button" class="px-4 py-2 text-sm font-semibold border transition-colors first:rounded-l-md last:rounded-r-md" :class="discountDraft.modifier_type === t.value ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'" @click="discountDraft.modifier_type = t.value">{{ t.label }}</button>
            </div>
          </div>
        </div>
        <div class="col-span-2">
          <div class="flex items-center gap-10">
            <label class="text-sm text-gray-700 w-36 shrink-0">Per</label>
            <div class="flex gap-0">
              <button v-for="p in perOptions" :key="p.value" type="button" class="px-4 py-2 text-sm font-semibold border transition-colors first:rounded-l-md last:rounded-r-md" :class="discountDraft.per === p.value ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'" @click="discountDraft.per = p.value">{{ p.label }}</button>
            </div>
          </div>
        </div>
        <div class="col-span-2">
          <label class="text-sm text-gray-700 block mb-2">Conditions</label>
          <div class="flex gap-2">
            <Select v-model="discountDraft.condition_to_add" :options="conditionOptions" option-label="label" option-value="value" placeholder="Choose conditions" class="w-72" />
            <Button label="Add" size="small" severity="secondary" outlined :disabled="!discountDraft.condition_to_add" @click="addDiscountCondition" />
          </div>
          <div v-if="discountDraft.conditions.length" class="flex flex-wrap gap-2 mt-2">
            <span v-for="(c, i) in discountDraft.conditions" :key="i" class="bg-[#D9DBFF] text-sm px-3 py-1 rounded-full flex items-center gap-1.5">
              {{ c }}<i class="pi pi-times text-xs cursor-pointer" @click="discountDraft.conditions.splice(i, 1)" />
            </span>
          </div>
        </div>
        <div class="col-span-2">
          <label class="text-sm text-gray-700 block mb-2">Coupon Code</label>
          <InputText v-model="discountDraft.code" placeholder="e.g. SAVE20 (leave blank for automatic)" class="w-full" />
        </div>
        <div class="col-span-2">
          <label class="text-sm text-gray-700 block mb-2">Valid between</label>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <span class="text-xs text-gray-500">From</span>
              <div class="flex gap-0">
                <button type="button" class="px-3 py-1.5 text-sm font-semibold border rounded-l-md transition-colors" :class="discountDraft.valid_from_type === 'now' ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600'" @click="discountDraft.valid_from_type = 'now'">Now</button>
                <button type="button" class="px-3 py-1.5 text-sm font-semibold border rounded-r-md transition-colors" :class="discountDraft.valid_from_type === 'custom' ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600'" @click="discountDraft.valid_from_type = 'custom'">Custom Date</button>
              </div>
              <DatePicker v-if="discountDraft.valid_from_type === 'custom'" v-model="discountDraft.valid_from" show-icon date-format="dd/mm/yy" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <span class="text-xs text-gray-500">To</span>
              <div class="flex gap-0">
                <button type="button" class="px-3 py-1.5 text-sm font-semibold border rounded-l-md transition-colors" :class="discountDraft.expires_type === 'event' ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600'" @click="discountDraft.expires_type = 'event'">Start of Event</button>
                <button type="button" class="px-3 py-1.5 text-sm font-semibold border rounded-r-md transition-colors" :class="discountDraft.expires_type === 'custom' ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600'" @click="discountDraft.expires_type = 'custom'">Custom Date</button>
              </div>
              <DatePicker v-if="discountDraft.expires_type === 'custom'" v-model="discountDraft.expires_at" show-icon date-format="dd/mm/yy" class="w-full" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 col-span-2">
          <label class="text-sm text-gray-700 w-36 shrink-0">Save as template</label>
          <ToggleSwitch v-model="discountDraft.save_as_template" />
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showDiscountDialog = false; resetDiscountDraft()" />
      <Button :label="editingDiscountIdx !== null ? 'Update' : 'Add Discount'" :disabled="!discountDraft.name" @click="saveDiscountDraft" style="background:#1E2157; border-color:#1E2157" />
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
  <Dialog v-model:visible="showSubGroupsDialog" header="Manage Sub Groups" modal style="width:500px">
    <div class="flex flex-col gap-5 py-2">
      <!-- Create new group -->
      <div class="flex flex-col gap-2">
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
          <Button label="Add" :disabled="!newGroupName.trim()" size="small" @click="addSubGroup" style="background:#1E2157; border-color:#1E2157" />
        </div>
      </div>
      <!-- Existing groups list -->
      <div v-if="subGroups.length" class="flex flex-col gap-2">
        <label class="text-sm font-semibold text-gray-700">Groups ({{ subGroups.length }})</label>
        <div v-for="grp in subGroups" :key="grp.id" class="flex flex-col bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
          <!-- Group header row -->
          <div class="flex items-center gap-3 px-4 py-3">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: grp.color }" />
            <span class="flex-1 text-sm font-medium text-gray-700">{{ grp.name }}</span>
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
      <Button label="Done" @click="showSubGroupsDialog = false" style="background:#1E2157; border-color:#1E2157" />
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
            <RichTextEditor v-model="editingSubSession.description" placeholder="Describe this sub-session…" />
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
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()
const route = useRoute()
const id = route.params.id as string
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000002'

// ---- Tabs ----
const allTabs = [
  { key: 'overview',       label: 'Overview',       icon: 'pi-info-circle' },
  { key: 'sessions',       label: 'Sessions',       icon: 'pi-calendar-clock' },
  { key: 'invitees',       label: 'Invitees',       icon: 'pi-users' },
  { key: 'forms',          label: 'Forms',          icon: 'pi-file-edit' },
  { key: 'discounts',      label: 'Discounts',      icon: 'pi-tag' },
  { key: 'automation',     label: 'Automation',     icon: 'pi-bolt' },
  { key: 'settings',       label: 'Settings',       icon: 'pi-cog' },
  { key: 'communication',  label: 'Communication',  icon: 'pi-envelope' },
  { key: 'attendance',     label: 'Attendance',     icon: 'pi-check-square' },
]

const basicTabs = ['overview', 'invitees', 'attendance', 'communication', 'settings']

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
  return allTabs
})
const activeTab = ref((useRoute().query.tab as string) || 'overview')
const overviewEditing = ref(false)

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
    update.is_all_day = editForm.value.is_all_day
    update.start_at = buildDateTime(editForm.value.start_date, editForm.value.start_time)
    update.end_at = buildDateTime(editForm.value.end_date, editForm.value.end_time)
    update.recurrence_rule = editForm.value.repeat || null
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
    await loadEvent()
    toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
  }
  fieldEditing[field] = false
  savingField.value = null
}

// ---- Core event ----
const event = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const allCategories = ref<any[]>([])
const moreMenu = ref()
const moreMenuItems = computed(() => [
  { label: 'Duplicate', icon: 'pi pi-copy', command: () => {} },
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

const evtFormGroupModes = reactive<Record<string, string>>({
  'member-general': '',
  'public-general': '',
})
const selectedFormGroupId = ref('member-general')
const evtFormShowSections = ref(false)
const evtSelectedFormSection = ref('')
const evtFormFieldsTab = ref('existing')
const evtFormTermsSelections = ref<string[]>([])
// Preview interactivity
const evtPreviewPayment = ref<string | null>(null)
const evtPreviewPlanFreq = ref<string>('')
const evtPreviewTermsAgreed = ref<Set<string>>(new Set())
const evtPreviewResponse = ref<string | null>(null)
const simplePersonCount = ref(1)
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
const EVT_BASE_REGISTRATION_FEE = 25

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
    const rows: OrderRow[] = [{ label: 'Registration Fee', amount: EVT_BASE_REGISTRATION_FEE }]
    for (const field of currentEvtFormFields.value) {
      for (const rule of field.financial_rules) {
        if (evaluateEvtConditions(rule.conditions, i)) {
          const amt = parseFloat(rule.amount) || 0
          rows.push({ label: rule.fee_name || field.label, amount: rule.fee_type === 'discount' ? -amt : amt })
        }
      }
    }
    result.push(rows)
  }
  return result
})

const evtOrderTotal = computed(() =>
  evtOrderRows.value.reduce((sum, rows) => sum + rows.reduce((s, r) => s + r.amount, 0), 0)
)

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
  'member-general': { style: 'single', header: 'event', headerImage: '', icons: { date: true, time: true, cost: true, location: true, criteria: true }, description: 'event', customDescription: '', background: 'default', backgroundImage: '', backgroundColor: '#fefefe', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundOverlay: 1, sponsors: 'show', showSessions: true, sessionsHeading: 'Sessions', formHeading: 'Fill in the form to register', addPersonColor: '#0e43a3' },
  'public-general': { style: 'single', header: 'event', headerImage: '', icons: { date: true, time: true, cost: true, location: true, criteria: true }, description: 'event', customDescription: '', background: 'default', backgroundImage: '', backgroundColor: '#fefefe', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundOverlay: 1, sponsors: 'show', showSessions: true, sessionsHeading: 'Sessions', formHeading: 'Fill in the form to register', addPersonColor: '#0e43a3' },
})
const currentEvtFormDesign = computed(() => evtFormGroupDesigns[selectedFormGroupId.value] ?? evtFormGroupDesigns['member-general'])

function handleEvtFormImageUpload(field: 'headerImage' | 'backgroundImage', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { currentEvtFormDesign.value[field] = ev.target?.result as string }
  reader.readAsDataURL(file)
}

const evtFormGroupsMember = computed(() => {
  const gid = 'member-general'
  const mode = evtFormGroupModes[gid]
  const saved = evtFormSectionSaved[gid] ?? {}
  const totalCount = mode === 'simple' ? 3 : 4
  const allSaved = mode === 'simple'
    ? (!!saved.design && !!saved.terms && !!saved.payment)
    : !!(mode && saved.design && saved.fields && saved.terms && saved.payment)
  return [{
    id: gid,
    name: 'Member Registration',
    complete: allSaved,
    noRegistrations: mode === 'none',
    filledCount: Object.keys(saved).length,
    totalCount,
  }]
})
const evtFormGroupsPublic = computed(() => {
  const gid = 'public-general'
  const mode = evtFormGroupModes[gid]
  const saved = evtFormSectionSaved[gid] ?? {}
  const totalCount = mode === 'simple' ? 3 : 4
  const allSaved = mode === 'simple'
    ? (!!saved.design && !!saved.terms && !!saved.payment)
    : !!(mode && saved.design && saved.fields && saved.terms && saved.payment)
  return [{
    id: gid,
    name: 'Public Registration',
    complete: allSaved,
    noRegistrations: mode === 'none',
    filledCount: Object.keys(saved).length,
    totalCount,
  }]
})

const currentEvtFormGroupName = computed(() =>
  [...evtFormGroupsMember.value, ...evtFormGroupsPublic.value]
    .find(g => g.id === selectedFormGroupId.value)?.name ?? ''
)

const evtFormSectionSaved = reactive<Record<string, Record<string, boolean>>>({})

function saveEvtFormSection(sectionId: string) {
  const gid = selectedFormGroupId.value
  if (!evtFormSectionSaved[gid]) evtFormSectionSaved[gid] = {}
  evtFormSectionSaved[gid][sectionId] = true
  evtSelectedFormSection.value = ''
}

const evtFormSections = computed(() => {
  const mode = evtFormGroupModes[selectedFormGroupId.value]
  const saved = evtFormSectionSaved[selectedFormGroupId.value] ?? {}
  if (mode === 'simple') return [
    { id: 'design', index: 1, label: 'Design', icon: 'pi-pencil', complete: !!saved.design },
    { id: 'terms', index: 2, label: 'Terms & Conditions', icon: 'pi-file', complete: !!saved.terms },
    { id: 'payment', index: 3, label: 'Payment Options', icon: 'pi-credit-card', complete: !!saved.payment },
  ]
  return [
    { id: 'design', index: 1, label: 'Design', icon: 'pi-pencil', complete: !!saved.design },
    { id: 'fields', index: 2, label: 'Form', icon: 'pi-list', complete: !!saved.fields },
    { id: 'terms', index: 3, label: 'Terms & Conditions', icon: 'pi-file', complete: !!saved.terms },
    { id: 'payment', index: 4, label: 'Payment Options', icon: 'pi-credit-card', complete: !!saved.payment },
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

// ---- Discounts tab ----
const eventDiscounts = ref<any[]>([])
const evtDiscountSettings = reactive({ one_discount_only: false })
const showDiscountDialog = ref(false)
const editingDiscountIdx = ref<number | null>(null)

const discountTypes = [
  { label: '% Off', value: 'PERCENT' },
  { label: '$ Off', value: 'FLAT' },
]
const perOptions = [
  { label: 'Per Person', value: 'person' },
  { label: 'Per Session', value: 'session' },
  { label: 'Entire Registration', value: 'registration' },
]
const conditionOptions = [
  { label: 'Requires coupon code', value: 'Requires coupon code' },
  { label: 'Books 4+ days', value: 'Books 4+ days' },
  { label: 'Early bird (register before deadline)', value: 'Early bird' },
  { label: 'Member type: Junior', value: 'Member type: Junior' },
  { label: 'Member type: Senior', value: 'Member type: Senior' },
  { label: 'Sibling registration', value: 'Sibling registration' },
  { label: 'Group booking (5+ members)', value: 'Group booking (5+ members)' },
]

const makeDiscountDraft = () => ({
  name: '', form_text: '', is_active: true,
  modifier_value: null as number | null, modifier_type: 'PERCENT', per: 'person',
  conditions: [] as string[], condition_to_add: null as string | null,
  code: '', valid_from_type: 'now', valid_from: null as Date | null,
  expires_type: 'event', expires_at: null as Date | null, save_as_template: false,
})
const discountDraft = reactive(makeDiscountDraft())

function resetDiscountDraft() {
  Object.assign(discountDraft, makeDiscountDraft())
  editingDiscountIdx.value = null
}

function addDiscountCondition() {
  if (discountDraft.condition_to_add && !discountDraft.conditions.includes(discountDraft.condition_to_add)) {
    discountDraft.conditions.push(discountDraft.condition_to_add)
  }
  discountDraft.condition_to_add = null
}

function editDiscount(idx: number) {
  const d = eventDiscounts.value[idx]
  Object.assign(discountDraft, { ...d, conditions: [...(d.conditions || [])], condition_to_add: null })
  editingDiscountIdx.value = idx
  showDiscountDialog.value = true
}

function saveDiscountDraft() {
  if (!discountDraft.name) return
  const label = discountDraft.valid_from_type === 'now' ? 'Now' : (discountDraft.valid_from ? new Date(discountDraft.valid_from).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'Custom')
  const entry = {
    name: discountDraft.name, form_text: discountDraft.form_text, is_active: discountDraft.is_active,
    modifier_value: discountDraft.modifier_value ?? 0, modifier_type: discountDraft.modifier_type,
    per: discountDraft.per, conditions: [...discountDraft.conditions], code: discountDraft.code || null,
    valid_from_type: discountDraft.valid_from_type, expires_type: discountDraft.expires_type,
    expires_at: discountDraft.expires_at, valid_from_label: label,
  }
  if (editingDiscountIdx.value !== null) eventDiscounts.value[editingDiscountIdx.value] = entry
  else eventDiscounts.value.push(entry)
  showDiscountDialog.value = false
  resetDiscountDraft()
}

function deleteDiscount(idx: number) {
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

// ---- Bookables (venues) ----
// allBookables is kept here only for locationSummary venue-name resolution
const allBookables = ref<any[]>([])
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
const showSendEmail = ref(false)
const emailDraft = reactive({ subject: '', body: '' })
const sendingComms = ref(false)
const newComms = ref({ channel: 'EMAIL', audience: 'ALL', subject: '', body: '' })
const audienceOptions = [
  { label: 'All invitees', value: 'ALL' },
  { label: 'Confirmed only', value: 'CONFIRMED' },
  { label: 'Invited (not confirmed)', value: 'INVITED' },
]

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
  if (!inv.attended) {
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
const subGroups = ref<{ id: string; name: string; color: string; managers?: { id: string; name: string }[] }[]>([])
const inviteeGroupMap = ref<Record<string, string | null>>({})
const expandedSubGroups = reactive<Record<string, boolean>>({})
const showSubGroupsDialog = ref(false)
const addingManagerForGroup = reactive<Record<string, string | null>>({})
const newGroupName = ref('')
const newGroupColor = ref('#3B82F6')
const draggingInviteeId = ref<string | null>(null)
const draggingMultiple = ref(false)
const dragOverGroupId = ref<string>('__none__')

const groupColorPalette = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#F97316',
]

const groupedInvitees = computed(() => {
  const ungrouped = invitees.value.filter(inv => !inviteeGroupMap.value[inv.id])
  const groups = subGroups.value.map(g => ({
    group: g,
    invitees: invitees.value.filter(inv => inviteeGroupMap.value[inv.id] === g.id),
  }))
  return { ungrouped, groups }
})

function addSubGroup() {
  if (!newGroupName.value.trim()) return
  subGroups.value.push({
    id: crypto.randomUUID(),
    name: newGroupName.value.trim(),
    color: newGroupColor.value,
  })
  newGroupName.value = ''
  newGroupColor.value = '#3B82F6'
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
const savingSessions = ref(false)
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
  session.start_at = toLocalISO(sd)
  session.end_at = toLocalISO(ed)
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
// Fields copied from master to linked sessions (no dates/invitees)
const MASTER_FIELDS = ['title', 'description', 'location_type', 'address', 'meeting_link', 'fees', 'discounts',
  'is_public', 'show_attendee_list', 'has_waitlist', 'required', '_hasCapacity', 'capacity_max']

const masterSessions = computed(() => sessions.value.filter(s => s.is_master))
const showPickMaster = ref(false)

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
  const master = sessions.value.find(s => s.id === session.master_id)
  if (!master) return
  MASTER_FIELDS.forEach(f => { if (master[f] !== undefined) session[f] = JSON.parse(JSON.stringify(master[f])) })
  // Re-lock any fields that were already locked
  session._locked_fields = session._locked_fields ?? []
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
  viewingSession.value = session
}

const sessionTabs = [
  { key: 'overview',  label: 'Overview',  icon: 'pi-info-circle' },
  { key: 'invitees',  label: 'Invitees',  icon: 'pi-users' },
  { key: 'fees',      label: 'Fees',      icon: 'pi-dollar' },
  { key: 'discounts', label: 'Discounts', icon: 'pi-tag' },
  { key: 'settings',  label: 'Settings',  icon: 'pi-cog' },
]

function addSession() {
  const isFirst = sessions.value.length === 0
  const session = makeFreshSession({ title: `Session ${sessions.value.length + 1}`, is_master: isFirst })
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
  if (viewingSession.value?.id === deleted.id) {
    viewingSession.value = sessions.value.length ? sessions.value[0] : null
  }
  toast.add({ severity: 'success', summary: `"${deleted.title || 'Untitled Session'}" deleted`, life: 3000 })
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
    // Load sub-sessions for each
    const { data: subs } = await db.from('sessions').select('*').eq('event_id', id).not('parent_session_id', 'is', null)
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
      sub_sessions: (subs ?? []).filter(sub => sub.parent_session_id === s.id).map(sub => ({
        ...sub,
        _date: sub.start_at ? new Date(sub.start_at) : null,
        _startTime: sub.start_at ? new Date(sub.start_at) : null,
        _endTime: sub.end_at ? new Date(sub.end_at) : null,
      })),
    }))
  } else {
    // Demo sessions
    sessions.value = [
      makeFreshSession({
        title: 'Morning Training',
        _startDate: new Date('2025-03-15'),
        _endDate: new Date('2025-03-15'),
        _startTime: new Date('2025-03-15T08:00:00'),
        _endTime: new Date('2025-03-15T10:00:00'),
        start_at: '2025-03-15T08:00:00Z',
        end_at: '2025-03-15T10:00:00Z',
        location_type: 'ADDRESS',
        address: 'Main Stadium, Court 1',
        _hasCapacity: true,
        capacity_max: 30,
        sub_sessions: [
          { id: crypto.randomUUID(), title: 'Warm-up & Drills', address: 'Court 1', _date: new Date('2025-03-15'), _startTime: new Date('2025-03-15T08:00:00'), _endTime: new Date('2025-03-15T08:30:00') },
          { id: crypto.randomUUID(), title: 'Skills Session', address: 'Court 1', _date: new Date('2025-03-15'), _startTime: new Date('2025-03-15T08:30:00'), _endTime: new Date('2025-03-15T09:30:00') },
          { id: crypto.randomUUID(), title: 'Scrimmage', address: 'Court 2', _date: new Date('2025-03-15'), _startTime: new Date('2025-03-15T09:30:00'), _endTime: new Date('2025-03-15T10:00:00') },
        ],
      }),
      makeFreshSession({
        title: 'Afternoon Match',
        _startDate: new Date('2025-03-15'),
        _endDate: new Date('2025-03-15'),
        _startTime: new Date('2025-03-15T14:00:00'),
        _endTime: new Date('2025-03-15T16:00:00'),
        start_at: '2025-03-15T14:00:00Z',
        end_at: '2025-03-15T16:00:00Z',
        location_type: 'ADDRESS',
        address: 'Main Stadium, Court 2',
        _expanded: false,
        sub_sessions: [],
      }),
    ]
  }
  // Auto-open first session when on the sessions tab
  if (sessions.value.length && !viewingSession.value) openSession(sessions.value[0])
}

function buildSessionPayload(s: any, idx: number) {
  syncSessionDates(s)
  const locType = (s._locations?.[0]?.type ?? s.location_type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE'
  return {
    event_id: id,
    title: s.title || `Session ${idx + 1}`,
    description: s.description || null,
    start_at: s.start_at,
    end_at: s.end_at,
    is_all_day: s.is_all_day,
    location_type: locType,
    address: locType === 'ADDRESS' ? (s._locations?.[0]?.address || s.address || null) : null,
    meeting_link: locType === 'ONLINE' ? (s._locations?.[0]?.meeting_link || s.meeting_link || null) : null,
    capacity_max: s._hasCapacity ? (s.capacity_max ?? null) : null,
    has_waitlist: s._hasCapacity ? (s.has_waitlist ?? false) : false,
    is_required: s.required ?? false,
    is_public: s.is_public ?? true,
    show_attendee_list: s.show_attendee_list ?? false,
    show_as_separate_event: s.show_as_separate_event ?? false,
    sort_order: idx,
  }
}

async function saveSession(s: any) {
  const idx = sessions.value.indexOf(s)
  const payload = buildSessionPayload(s, idx >= 0 ? idx : 0)
  if (s._isNew || !s._savedId) {
    const { data } = await db.from('sessions').insert(payload).select('id').single()
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
    await db.from('sessions').update(payload).eq('id', s._savedId ?? s.id)
  }
}

async function saveSessions() {
  savingSessions.value = true
  for (const s of sessions.value) {
    await saveSession(s)
  }
  toast.add({ severity: 'success', summary: 'Sessions saved', life: 3000 })
  savingSessions.value = false
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
  editForm.value.banner_url = URL.createObjectURL(file)
  uploadingBanner.value = true
  try {
    editForm.value.banner_url = await uploadFile(file)
  } finally {
    uploadingBanner.value = false
    if (bannerInput.value) bannerInput.value.value = ''
  }
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
    org_id: DEFAULT_ORG_ID, name: newCategoryName.value.trim(), color: newCategoryColor.value,
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
      repeat: data.recurrence_rule ?? '',
    }
    // Load sub-groups
    subGroups.value = Array.isArray(data.sub_groups) ? data.sub_groups : []
  }
  loading.value = false
}

async function loadInvitees() {
  inviteesLoading.value = true
  const { data } = await db
    .from('invitees')
    .select('*, person:persons(id, first_name, last_name, email)')
    .eq('event_id', id)
    .order('invited_at')
  invitees.value = data ?? []
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
  const { data } = await db.from('fee_components').select('*').eq('event_id', id).order('sort_order')
  feeLineItems.value = (data ?? []).map((f: any) => ({ id: f.id, name: f.name, xero_code: f.xero_code ?? '', amount: f.amount }))
  feesLoading.value = false
}

async function syncFees(items: import('~/composables/useFeeGroups').FeeLineItem[]) {
  feeLineItems.value = items
  // Upsert all rows; delete removed ones
  const existing = feeLineItems.value.map(f => f.id)
  await db.from('fee_components').delete().eq('event_id', id).not('id', 'in', `(${existing.join(',')})`)
  for (let i = 0; i < items.length; i++) {
    const f = items[i]
    await db.from('fee_components').upsert({
      id: f.id, event_id: id, name: f.name, xero_code: f.xero_code || null, amount: f.amount ?? 0, sort_order: i,
    })
  }
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
  const { data } = await db.from('persons').select('id, first_name, last_name, email').eq('org_id', DEFAULT_ORG_ID)
  availablePersons.value = (data ?? [])
    .filter(p => !existingIds.has(p.id))
    .map(p => ({ ...p, full_name: `${p.first_name} ${p.last_name}` }))
}

async function loadCategories() {
  const { data } = await db.from('categories').select('id, name, color').eq('org_id', DEFAULT_ORG_ID).order('name')
  allCategories.value = data ?? []
}

// ---- Actions ----
async function publishEvent() {
  await db.from('events').update({ status: 'PUBLISHED' }).eq('id', id)
  toast.add({ severity: 'success', summary: 'Event published', life: 3000 })
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
  // Auto-save session when leaving the sessions tab (fire-and-forget)
  if (oldTab === 'sessions' && viewingSession.value) {
    saveSession(viewingSession.value).catch(e => console.warn('Session auto-save on tab change failed:', e))
  }
  if (tab === 'invitees' || tab === 'attendance') { if (!invitees.value.length) loadInvitees() }
  if (tab === 'details') { loadCategories() }
  if (tab === 'sessions') {
    if (!sessions.value.length) loadSessions()
    else if (!viewingSession.value && sessions.value.length) openSession(sessions.value[0])
  }
  if (tab === 'communication') loadComms()
})

// Auto-save when switching between sessions
watch(viewingSession, async (newSession, oldSession) => {
  if (oldSession) {
    try { await saveSession(oldSession) } catch (e) { console.warn('Session auto-save failed:', e) }
  }
})

// Auto-save when navigating away from the page (fire-and-forget, never block navigation)
onBeforeRouteLeave(() => {
  if (activeTab.value === 'sessions' && viewingSession.value) {
    saveSession(viewingSession.value).catch(e => console.warn('Session auto-save on leave failed:', e))
  }
})

onMounted(async () => {
  await loadEvent()

  // Apply query-param date prefill
  if (route.query.date) {
    const d = new Date(route.query.date as string)
    editForm.value.start_date = d
    editForm.value.start_time = d
  }
  if (route.query.endDate) {
    const d = new Date(route.query.endDate as string)
    editForm.value.end_date = d
    editForm.value.end_time = d
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

  loadInvitees()
  loadCategories()
  loadFees()
  // Load bookables for locationSummary venue-name resolution
  const { data } = await db.from('bookables').select('id, name, parent_id').eq('org_id', DEFAULT_ORG_ID).eq('type', 'VENUE').eq('status', 'ACTIVE')
  allBookables.value = data ?? []

  // Auto-open name edit for new events
  if (!event.value?.title) {
    startFieldEdit('title')
  }
})
</script>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.15s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
