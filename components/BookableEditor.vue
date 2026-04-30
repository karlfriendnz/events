<template>
  <div class="flex flex-col h-full">

    <VenueTemplateDialog
      v-model="showTemplateDialog"
      :current-sections="form.sections"
      :current-layouts="layouts"
      @apply="onTemplateApply"
    />

    <!-- Mode add/edit dialog -->
    <Dialog v-model:visible="showModeDialog" modal :header="editingMode?.id ? 'Edit mode' : 'Add mode'"
      :style="{ width: '520px' }" :content-style="{ padding: 0 }">
      <div v-if="editingMode" class="p-6 space-y-5">

        <!-- Name -->
        <div class="flex items-center gap-4">
          <label class="text-sm font-semibold text-gray-700 w-28 shrink-0">Name <span class="text-red-400">*</span></label>
          <InputText v-model="editingMode.name" placeholder="e.g. Pickleball, 5-a-side" class="flex-1" />
        </div>

        <!-- Colour -->
        <div class="flex items-center gap-4">
          <label class="text-sm font-semibold text-gray-700 w-28 shrink-0">Colour</label>
          <div class="flex gap-2 flex-wrap">
            <button v-for="c in MODE_COLORS" :key="c" type="button"
              class="w-6 h-6 rounded-full ring-offset-2 transition-all"
              :style="{ background: c }"
              :class="editingMode.color === c ? 'ring-2 ring-gray-700' : 'hover:ring-2 hover:ring-gray-300'"
              @click="editingMode.color = c" />
          </div>
        </div>

        <!-- Description -->
        <div class="flex items-start gap-4">
          <label class="text-sm font-semibold text-gray-700 w-28 shrink-0 pt-1">Description</label>
          <InputText v-model="editingMode.description" placeholder="Shown to bookers (optional)" class="flex-1" />
        </div>

        <!-- Capacity -->
        <div class="flex items-center gap-4">
          <label class="text-sm font-semibold text-gray-700 w-28 shrink-0">Capacity</label>
          <div class="flex items-center gap-2">
            <InputNumber v-model="editingMode.min_players" :min="0" placeholder="Min" class="w-24" size="small" />
            <span class="text-gray-400 text-sm">–</span>
            <InputNumber v-model="editingMode.max_players" :min="0" placeholder="Max" class="w-24" size="small" />
            <span class="text-xs text-gray-400">people</span>
          </div>
        </div>

        <!-- Pricing -->
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pricing</p>
          <div class="bg-gray-50 rounded-xl divide-y divide-gray-100 border border-gray-200">

            <div class="flex items-center gap-3 px-4 py-3">
              <span class="text-sm text-gray-700 flex-1">Per hour</span>
              <InputNumber v-model="editingMode.price_per_hour" mode="currency" currency="GBP" locale="en-GB"
                placeholder="—" :min="0" size="small" class="w-32" />
              <span class="text-xs text-gray-400 w-16">/ hour</span>
            </div>

            <div class="flex items-center gap-3 px-4 py-3">
              <span class="text-sm text-gray-700 flex-1">Per slot</span>
              <InputNumber v-model="editingMode.price_per_slot" mode="currency" currency="GBP" locale="en-GB"
                placeholder="—" :min="0" size="small" class="w-32" />
              <span class="text-xs text-gray-400 w-16">/ slot</span>
            </div>

            <div class="flex items-center gap-3 px-4 py-3">
              <span class="text-sm text-gray-700 flex-1">One-off fee</span>
              <InputNumber v-model="editingMode.flat_fee" mode="currency" currency="GBP" locale="en-GB"
                placeholder="—" :min="0" size="small" class="w-32" />
              <span class="text-xs text-gray-400 w-16">flat</span>
            </div>

            <div class="flex items-center gap-3 px-4 py-3">
              <span class="text-sm text-gray-700 flex-1">Per person</span>
              <InputNumber v-model="editingMode.price_per_person" mode="currency" currency="GBP" locale="en-GB"
                placeholder="—" :min="0" size="small" class="w-32" />
              <span class="text-xs text-gray-400 w-16">/ person</span>
            </div>

          </div>
          <p class="text-xs text-gray-400 mt-2">Leave blank for any pricing type you don't use.</p>
        </div>

      </div>
      <template #footer>
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button v-if="editingMode?.id" type="button"
            class="text-sm text-red-400 hover:text-red-600 transition-colors"
            @click="deleteMode">
            Delete mode
          </button>
          <span v-else />
          <div class="flex gap-2">
            <Button label="Cancel" severity="secondary" outlined size="small" @click="showModeDialog = false" />
            <Button label="Save" icon="pi pi-check" size="small" :disabled="!editingMode?.name?.trim()"
              @click="saveModeDialog" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>
      </template>
    </Dialog>

    <!-- Tab bar (hidden in standalone mode — parent renders pill tabs) -->
    <div v-if="!standalone" class="flex items-center gap-1 px-4 pt-3 pb-0 bg-white border-b border-gray-200 shrink-0">
      <button
        v-for="tab in tabs" :key="tab.key"
        class="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
        :class="activeTab === tab.key
          ? 'border-[#1E2157] text-[#1E2157]'
          : 'border-transparent text-gray-500 hover:text-gray-800'"
        @click="activeTab = tab.key">
        <i :class="`pi ${tab.icon} text-xs`" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto">

      <!-- Details tab -->
      <div v-if="activeTab === 'details'" class="p-6">
        <div class="max-w-[1140px] mx-auto space-y-5">

          <!-- Card 1: Venue -->
          <div>
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Venue</p>
            <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

              <div class="flex items-center px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Name</span>
                <InputText v-model="form.name" placeholder="e.g. Field 1" class="flex-1" />
              </div>

              <div class="flex items-center px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Internal name</span>
                <InputText v-model="form.internal_name" placeholder="Optional internal reference" class="flex-1" />
              </div>

              <div class="flex items-start px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0 pt-1">Description</span>
                <Textarea v-model="form.description" placeholder="Describe this venue…" auto-resize rows="3" class="flex-1 text-sm" />
              </div>

              <div class="flex items-center px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Location</span>
                <InputText v-model="form.location" placeholder="Street address or area" class="flex-1" />
              </div>

              <div class="flex items-start px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0 pt-1">Features</span>
                <div class="flex-1 flex flex-wrap gap-2">
                  <div v-for="(feat, i) in form.features" :key="i" class="flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-3 py-1 text-sm">
                    <span>{{ feat }}</span>
                    <button type="button" class="text-blue-400 hover:text-red-500" @click="form.features.splice(i, 1)">
                      <i class="pi pi-times text-xs" />
                    </button>
                  </div>
                  <input v-model="newFeature" type="text" placeholder="Add feature…"
                    class="text-sm text-gray-700 bg-transparent border-0 outline-none placeholder-gray-400 min-w-24"
                    @keydown.enter.prevent="addFeature"
                    @keydown.comma.prevent="addFeature" />
                </div>
              </div>

              <!-- Photos inline -->
              <div class="flex items-start px-5 py-4 gap-6">
                <div class="w-32 shrink-0 pt-1">
                  <span class="text-sm font-semibold text-gray-700">Photos</span>
                  <label class="flex items-center gap-1 mt-1 text-xs text-[#1E2157] hover:underline cursor-pointer w-fit">
                    <i class="pi pi-upload text-xs" /> Add
                    <input type="file" accept="image/*" multiple class="hidden" :disabled="uploadingPhoto" @change="handlePhotoUpload" />
                  </label>
                </div>
                <div class="flex-1">
                  <div v-if="!form.images?.length && !uploadingPhoto" class="py-4 text-sm text-gray-400">
                    No photos yet
                  </div>
                  <div v-else class="grid grid-cols-4 gap-2">
                    <div v-for="(url, i) in form.images" :key="i" class="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img :src="url" class="w-full h-full object-cover" />
                      <div class="absolute top-1 left-1 flex gap-1">
                        <span v-if="form.main_image === url" class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#1E2157] text-white leading-none shadow">Main</span>
                        <span v-if="form.sponsor_image === url" class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500 text-white leading-none shadow">Sponsor</span>
                      </div>
                      <div class="absolute inset-x-0 bottom-0 flex items-center justify-between px-1 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div class="flex gap-1">
                          <button class="text-[9px] font-semibold px-1.5 py-0.5 rounded leading-none transition-colors"
                            :class="form.main_image === url ? 'bg-[#1E2157] text-white' : 'bg-black/60 text-white hover:bg-[#1E2157]'"
                            @click="setImageRole(url, 'main')">Main</button>
                          <button class="text-[9px] font-semibold px-1.5 py-0.5 rounded leading-none transition-colors"
                            :class="form.sponsor_image === url ? 'bg-amber-500 text-white' : 'bg-black/60 text-white hover:bg-amber-500'"
                            @click="setImageRole(url, 'sponsor')">Sponsor</button>
                        </div>
                        <button class="w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                          @click="removePhoto(i)">
                          <i class="pi pi-times text-[8px]" />
                        </button>
                      </div>
                    </div>
                    <div v-if="uploadingPhoto" class="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                      <i class="pi pi-spin pi-spinner text-gray-400 text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex justify-end px-5 py-3">
                <Button label="Save" icon="pi pi-check" size="small" :loading="saving" @click="save" style="background:#1E2157;border-color:#1E2157" />
              </div>
            </div>
          </div>

          <!-- Card 2: Layouts -->
          <div>
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Layouts</p>
            <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

              <div class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Split venue</p>
                  <p class="text-xs text-gray-500 mt-0.5">Divide this space into sections and bookable layouts</p>
                </div>
                <ToggleSwitch v-model="isSplitVenue" @update:modelValue="v => { save(); if (v) emit('navigate-tab', 'layouts') }" />
              </div>

              <div class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Multiple layouts</p>
                  <p class="text-xs text-gray-500 mt-0.5">Allow this venue to have more than one layout</p>
                </div>
                <ToggleSwitch v-model="form.allow_multiple_layouts" @update:modelValue="save" />
              </div>

              <div class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Sub-venues</p>
                  <p class="text-xs text-gray-500 mt-0.5">Allow this venue to have child sub-venues</p>
                </div>
                <ToggleSwitch v-model="form.allow_sub_venues" @update:modelValue="save" />
              </div>

            </div>
          </div>

          <!-- Card 3: Activities -->
          <div>
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Activities</p>
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div class="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Activities</p>
                  <p class="text-xs text-gray-500 mt-0.5">Activities that take place at this venue</p>
                </div>
                <MultiSelect v-model="linkedActivityIds" :options="allActivities" option-label="name" option-value="id"
                  placeholder="Add activity…" size="small" class="w-44"
                  @update:modelValue="saveActivityLinks" />
              </div>
              <div v-if="!linkedActivities.length" class="px-5 py-4 text-xs text-gray-400 italic">No activities linked</div>
              <div v-else class="divide-y divide-gray-50">
                <div v-for="a in linkedActivities" :key="a.id" class="px-5 py-3 flex items-center gap-3">
                  <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: a.color }" />
                  <span class="flex-1 text-sm font-medium text-gray-800 truncate">{{ a.name }}</span>
                  <button type="button" class="text-gray-300 hover:text-red-400 transition-colors" @click="unlinkActivity(a.id)">
                    <i class="pi pi-times text-xs" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 4: Settings -->
          <div>
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Settings</p>
            <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

              <div class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Status</p>
                  <p class="text-xs text-gray-500 mt-0.5">Archive to hide from booking</p>
                </div>
                <Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" size="small" class="w-36" @update:modelValue="save" />
              </div>

              <div class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Public</p>
                  <p class="text-xs text-gray-500 mt-0.5">Visible to members on public pages</p>
                </div>
                <ToggleSwitch v-model="form.is_public" @update:modelValue="save" />
              </div>

              <div class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Show in menu</p>
                  <p class="text-xs text-gray-500 mt-0.5">Add a quick link to this venue's bookings in the sidebar</p>
                </div>
                <ToggleSwitch v-model="form.show_in_menu" @update:modelValue="onShowInMenuToggle" />
              </div>

              <div class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Default bookings view</p>
                  <p class="text-xs text-gray-500 mt-0.5">Calendar view shown when opening the Bookings tab</p>
                </div>
                <Select v-model="form.default_booking_view" :options="bookingViewOptions"
                  option-label="label" option-value="value" size="small" class="w-36" @update:modelValue="save" />
              </div>

              <div class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Venue role</p>
                  <p class="text-xs text-gray-500 mt-0.5">Standalone venue, or part of a master/linked group</p>
                </div>
                <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium bg-white">
                  <button class="px-3 py-1.5 transition-colors"
                    :class="!localLinked && !props.bookable?.is_master ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                    @click="() => { localLinked.value = false; emit('set-role', 'standalone') }">Standalone</button>
                  <button class="px-3 py-1.5 transition-colors border-l border-gray-200 flex items-center gap-1"
                    :class="props.bookable?.is_master ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                    @click="() => { localLinked.value = false; emit('set-role', 'master') }">
                    <i class="pi pi-crown text-[9px]" /> Master
                  </button>
                  <button class="px-3 py-1.5 transition-colors border-l border-gray-200 flex items-center gap-1"
                    :class="(localLinked || props.bookable?.master_id) ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                    @click="() => { localLinked.value = true; emit('set-role', 'linked') }">
                    <i class="pi pi-link text-[9px]" /> Linked
                  </button>
                </div>
              </div>

              <div v-if="localLinked || props.bookable?.master_id" class="flex items-center justify-between px-5 py-4">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Master template</p>
                  <p class="text-xs text-gray-500 mt-0.5">Inherit details, pricing and rules from another bookable</p>
                </div>
                <Select v-model="form.master_id" :options="masterOptions" option-label="name" option-value="id"
                  placeholder="No master" size="small" class="w-52" show-clear @update:modelValue="save" />
              </div>

            </div>
          </div>

        </div><!-- end single col -->
      </div>

      <!-- Layouts tab -->
      <div v-else-if="activeTab === 'layouts'" class="flex flex-col h-full">

        <!-- Top bar: template + quick divide -->
        <div class="px-6 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0 bg-white">
          <button type="button"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-dashed border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors text-xs font-medium"
            @click="showTemplateDialog = true">
            <i class="pi pi-th-large text-xs" />
            Venue library
          </button>
          <div class="flex items-center gap-1.5 text-xs text-gray-400">
            <span>Quick divide:</span>
            <button v-for="n in [2, 3, 4, 6]" :key="n" type="button"
              class="px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 bg-white transition-colors"
              @click="quickDivide(n)">{{ n }}</button>
          </div>
          <div class="flex-1" />
          <Button label="Save layouts" icon="pi pi-check" size="small" :loading="savingLayouts"
            @click="saveLayouts" style="background:#1E2157;border-color:#1E2157" />
        </div>

        <!-- Sections bar -->
        <div class="px-6 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0 bg-gray-50">
          <span class="text-xs font-semibold text-gray-500 shrink-0">Sections</span>
          <div class="flex flex-wrap items-center gap-2 flex-1">
            <div v-for="(sec, i) in form.sections" :key="i" class="flex items-center gap-1 bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 text-xs">
              <span>{{ sec }}</span>
              <button type="button" class="text-indigo-400 hover:text-red-500" @click="form.sections.splice(i, 1); save()">
                <i class="pi pi-times text-[9px]" />
              </button>
            </div>
            <input v-model="newSection" type="text" placeholder="Add section…"
              class="text-xs text-gray-700 bg-transparent border-0 outline-none placeholder-gray-400 min-w-28"
              @keydown.enter.prevent="addSection(); save()"
              @keydown.comma.prevent="addSection(); save()" />
          </div>
        </div>

        <div v-if="loadingLayouts" class="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>

        <div v-else class="flex flex-1 min-h-0">

          <!-- Left: layout list (1/4) -->
          <div class="w-1/4 shrink-0 border-r border-gray-100 flex flex-col bg-gray-50">

            <!-- Layout rows (grouped) -->
            <div class="flex-1 overflow-y-auto py-2">
              <template v-for="item in groupedLayoutList"
                :key="item.index === -1 ? 'g-' + item.groupName : 'l-' + layouts[item.index]._key">
                <!-- Group header -->
                <div v-if="item.index === -1"
                  class="px-4 pt-3 pb-1 flex items-center gap-1.5">
                  <i class="pi pi-folder text-[9px] text-gray-300" />
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{{ item.groupName }}</p>
                </div>
                <!-- Layout row -->
                <button v-else
                  type="button"
                  class="w-full flex items-center gap-2.5 py-2.5 text-left transition-colors"
                  :class="[
                    layouts[item.index].group?.trim() ? 'pl-6 pr-3' : 'px-3',
                    activeLayoutIndex === item.index
                      ? 'bg-white border-r-2 border-[#1E2157] text-[#1E2157]'
                      : 'text-gray-600 hover:bg-white/70'
                  ]"
                  @click="activeLayoutIndex = item.index">
                  <i class="pi pi-th-large text-xs shrink-0"
                    :class="activeLayoutIndex === item.index ? 'text-[#1E2157]' : 'text-gray-300'" />
                  <span class="flex-1 text-sm font-medium truncate">{{ layouts[item.index].name || 'Unnamed' }}</span>
                  <span v-if="layouts[item.index].sections.length" class="text-[10px] shrink-0"
                    :class="activeLayoutIndex === item.index ? 'text-indigo-400' : 'text-gray-300'">
                    {{ layouts[item.index].sections.length }}×
                  </span>
                </button>
              </template>
            </div>

            <!-- Add layout -->
            <div class="p-3 border-t border-gray-100">
              <button type="button"
                class="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:border-[#1E2157] hover:text-[#1E2157] transition-colors"
                @click="addLayout">
                <i class="pi pi-plus text-xs" /> Add layout
              </button>
            </div>
          </div>

          <!-- Middle: layout details -->
          <div class="flex-1 border-r border-gray-100 overflow-y-auto">
            <div v-if="!layouts.length" class="flex items-center justify-center h-full text-gray-400 text-sm">
              <div class="text-center">
                <i class="pi pi-th-large text-3xl block mb-2 text-gray-300" />
                No layouts yet — add one
              </div>
            </div>

            <div v-else-if="activeLayout" class="p-6 space-y-5">

              <!-- Name -->
              <div class="flex items-center gap-4">
                <label class="text-sm font-semibold text-gray-700 w-28 shrink-0">Name</label>
                <InputText v-model="activeLayout.name" placeholder="e.g. Full Court, Half 1" class="flex-1" />
                <button type="button" class="text-gray-300 hover:text-red-500 transition-colors"
                  @click="removeLayout(activeLayoutIndex!)">
                  <i class="pi pi-trash" />
                </button>
              </div>

              <!-- Group -->
              <div class="flex items-center gap-4">
                <div class="w-28 shrink-0">
                  <label class="text-sm font-semibold text-gray-700">Group</label>
                  <p class="text-xs text-gray-400 mt-0.5">Optional — groups like "Halves"</p>
                </div>
                <InputText v-model="activeLayout.group" placeholder="e.g. Halves, Thirds" class="flex-1" />
              </div>

              <!-- Sections -->
              <div v-if="form.sections.length" class="flex items-start gap-4">
                <label class="text-sm font-semibold text-gray-700 w-28 shrink-0 pt-1">Uses sections</label>
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="sec in form.sections" :key="sec"
                    type="button"
                    class="px-2.5 py-1 rounded-full text-xs border transition-colors"
                    :class="activeLayout.sections.includes(sec)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'"
                    @click="toggleLayoutSection(activeLayout, sec)">
                    {{ sec }}
                  </button>
                  <button v-if="form.sections.length > 1" type="button"
                    class="px-2.5 py-1 rounded-full text-xs border border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                    @click="activeLayout.sections = activeLayout.sections.length === form.sections.length ? [] : [...form.sections]">
                    {{ activeLayout.sections.length === form.sections.length ? 'None' : 'All' }}
                  </button>
                </div>
              </div>

              <!-- Space diagram -->
              <div class="rounded-xl overflow-hidden border border-gray-200">
                <SpaceDiagram
                  :sections="form.sections"
                  :space-type="form.space_type"
                  :hovered-sections="activeLayout.sections"
                />
              </div>
            </div>
          </div>

          <!-- Right: modes -->
          <div class="w-1/3 shrink-0 overflow-y-auto">
            <div v-if="!activeLayout" class="flex items-center justify-center h-full text-gray-400 text-sm">
              <div class="text-center">
                <i class="pi pi-bolt text-3xl block mb-2 text-gray-300" />
                Select a layout
              </div>
            </div>
            <div v-else class="p-4 space-y-3">
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold text-gray-700">Modes</p>
                <div class="flex items-center gap-2">
                  <Select v-if="modes.length"
                    :model-value="null"
                    :options="modes"
                    option-label="name"
                    placeholder="Add existing…"
                    size="small"
                    class="w-36 text-xs"
                    @update:modelValue="addModeFromExisting" />
                  <button type="button"
                    class="flex items-center gap-1 text-xs text-[#1E2157] hover:underline whitespace-nowrap"
                    @click="addCustomMode">
                    <i class="pi pi-plus text-[10px]" /> New
                  </button>
                </div>
              </div>
              <div v-if="!activeLayout.modes.length" class="text-xs text-gray-400 italic py-2">
                No modes yet — e.g. Playing, Practicing, Tournament
              </div>
              <div class="space-y-3">
                <div v-for="(mode, mi) in activeLayout.modes" :key="mi"
                  class="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
                  <div class="flex items-center gap-2">
                    <div class="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <i class="pi pi-tag text-[9px] text-indigo-600" />
                    </div>
                    <InputText v-model="mode.name" placeholder="Mode name"
                      class="flex-1 text-sm font-medium" size="small" />
                    <button type="button" class="text-gray-300 hover:text-red-500 transition-colors"
                      @click="activeLayout.modes.splice(mi, 1)">
                      <i class="pi pi-times text-xs" />
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex flex-col gap-1">
                      <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Min players</label>
                      <InputNumber v-model="mode.min_players" :min="0" placeholder="—" class="w-full" size="small" />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Max players</label>
                      <InputNumber v-model="mode.max_players" :min="0" placeholder="—" class="w-full" size="small" />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Pricing</label>
                      <Select v-model="mode.price_type" :options="layoutModesPriceTypes" option-label="label" option-value="value"
                        class="w-full text-sm" size="small" />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                        {{ mode.price_type === 'PER_HOUR' ? 'Per hour' : mode.price_type === 'PER_PERSON' ? 'Per person' : 'Amount' }}
                      </label>
                      <InputNumber v-if="!['FREE','INCLUDED'].includes(mode.price_type)"
                        v-model="mode.price" mode="currency" currency="GBP" locale="en-GB"
                        class="w-full text-sm" size="small" />
                      <span v-else class="text-xs text-gray-400 italic pt-2">
                        {{ mode.price_type === 'FREE' ? 'No charge' : 'Uses layout price' }}
                      </span>
                    </div>
                    <div class="col-span-2 flex flex-col gap-1">
                      <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Description</label>
                      <InputText v-model="mode.description" placeholder="Short description…"
                        class="w-full text-sm" size="small" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modes tab -->
      <div v-else-if="activeTab === 'modes'" class="p-6">
        <div class="max-w-[1140px] mx-auto space-y-4">

          <div class="flex items-center justify-between">
            <p class="text-sm text-gray-500">Define the ways this resource can be booked — e.g. Pickleball, Dancing, 5-a-side.</p>
            <Button label="Add mode" icon="pi pi-plus" size="small" outlined
              @click="openModeDialog()" style="border-color:#1E2157;color:#1E2157" />
          </div>

          <div v-if="loadingModes" class="py-12 flex justify-center text-gray-400 text-sm">Loading…</div>

          <div v-else-if="!modes.length" class="py-12 text-center text-gray-400">
            <i class="pi pi-bolt text-3xl block mb-2 text-gray-300" />
            <p class="text-sm">No modes yet</p>
            <p class="text-xs mt-1">Add a mode to define booking types and pricing.</p>
          </div>

          <div v-else class="space-y-2">
            <div v-for="mode in modes" :key="mode._key"
              class="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4 hover:border-gray-300 transition-colors">
              <span class="w-4 h-4 rounded-full shrink-0" :style="{ background: mode.color }" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900">{{ mode.name }}</p>
                <p v-if="mode.description" class="text-xs text-gray-400 mt-0.5 truncate">{{ mode.description }}</p>
              </div>
              <!-- Capacity -->
              <div v-if="mode.min_players || mode.max_players" class="text-xs text-gray-400 shrink-0">
                <i class="pi pi-users text-xs mr-1" />
                {{ mode.min_players ?? '?' }}–{{ mode.max_players ?? '∞' }}
              </div>
              <!-- Pricing summary -->
              <div class="flex items-center gap-2 shrink-0">
                <span v-if="mode.price_per_hour != null" class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                  {{ formatPrice(mode.price_per_hour) }}/hr
                </span>
                <span v-if="mode.price_per_slot != null" class="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
                  {{ formatPrice(mode.price_per_slot) }}/slot
                </span>
                <span v-if="mode.flat_fee != null" class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                  +{{ formatPrice(mode.flat_fee) }} flat
                </span>
                <span v-if="mode.price_per_person != null" class="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                  {{ formatPrice(mode.price_per_person) }}/person
                </span>
                <span v-if="mode.price_per_hour == null && mode.price_per_slot == null && mode.flat_fee == null && mode.price_per_person == null"
                  class="text-xs text-gray-300">No pricing</span>
              </div>
              <button type="button" class="text-xs text-[#1E2157] hover:underline shrink-0"
                @click="openModeDialog(mode)">Edit</button>
            </div>
          </div>

        </div>
      </div>

      <!-- Rules tab -->
      <div v-else-if="activeTab === 'rules'" class="p-6 space-y-5">

        <!-- Max concurrent + notes -->
        <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div class="flex items-center px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-40 shrink-0">Max concurrent bookings</span>
            <InputNumber v-model="form.max_concurrent" :min="1" class="w-24" />
          </div>
          <div class="flex items-start px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-40 shrink-0 pt-1">Rules / notes</span>
            <Textarea v-model="form.rules" placeholder="Booking rules, setup notes…" auto-resize rows="4" class="flex-1 text-sm" />
          </div>
        </div>

        <!-- Booking limit -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <p class="text-sm font-semibold text-gray-800">Limit for number of bookings</p>
            <p class="text-xs text-gray-400 mt-0.5">Restrict how many times this venue can be booked per period</p>
          </div>
          <div class="px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <label v-for="opt in bookingLimitOptions" :key="opt.value"
              class="flex items-center gap-2 cursor-pointer">
              <input type="radio" :value="opt.value" v-model="form.booking_limit_type"
                class="accent-[#1E2157] w-4 h-4" />
              <span class="text-sm text-gray-700">{{ opt.label }}</span>
            </label>
          </div>
          <div v-if="form.booking_limit_type !== 'none'" class="px-5 pb-4 flex items-center gap-3">
            <span class="text-sm text-gray-500">Max bookings</span>
            <InputNumber v-model="form.booking_limit_count" :min="1" class="w-24" placeholder="e.g. 2" />
            <span class="text-sm text-gray-400">per {{ bookingLimitLabel }}</span>
          </div>
        </div>

        <!-- Options -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100">
            <p class="text-sm font-semibold text-gray-800">Options</p>
          </div>
          <div class="px-5 py-4 space-y-4">
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" v-model="form.disallow_concurrent" class="accent-[#1E2157] w-4 h-4 rounded" />
              <div>
                <p class="text-sm text-gray-700">Disallow concurrent bookings</p>
                <p class="text-xs text-gray-400 mt-0.5">A member cannot have two bookings at this venue at the same time</p>
              </div>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" v-model="form.disallow_consecutive" class="accent-[#1E2157] w-4 h-4 rounded" />
              <div>
                <p class="text-sm text-gray-700">Disallow consecutive bookings</p>
                <p class="text-xs text-gray-400 mt-0.5">A member cannot book back-to-back slots at this venue</p>
              </div>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" v-model="form.allow_modes_with_others" class="accent-[#1E2157] w-4 h-4 rounded" />
              <div>
                <p class="text-sm text-gray-700">Allow modes if making a booking with other members</p>
                <p class="text-xs text-gray-400 mt-0.5">Mode restrictions are relaxed when the booking includes other members</p>
              </div>
            </label>
          </div>
        </div>

      </div>


    </div>

    <!-- Footer (hidden in standalone mode — parent controls save) -->
    <div v-if="!standalone" class="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between bg-white">
      <button v-if="bookable?.id" type="button"
        class="text-sm text-red-400 hover:text-red-600 transition-colors"
        @click="$emit('delete')">
        Delete venue
      </button>
      <div v-else />
      <div class="flex gap-2">
        <Button label="Cancel" size="small" severity="secondary" text @click="$emit('cancel')" />
        <Button :label="bookable?.id ? 'Save changes' : 'Create venue'" icon="pi pi-check" size="small" :loading="saving"
          @click="save" style="background:#1E2157;border-color:#1E2157" />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { generateLayouts } from '~/data/venueTemplates'
const { orgId } = useOrg()
const props = defineProps<{
  bookable?: any
  parentId?: string | null
  standalone?: boolean
  initialTab?: string
  allBookables?: any[]
}>()

const emit = defineEmits<{
  saved: [bookable: any]
  cancel: []
  delete: []
  'set-role': [role: 'standalone' | 'master' | 'linked']
  'navigate-tab': [tab: string]
}>()

const db = useDb()

const tabs = [
  { key: 'details', label: 'Details', icon: 'pi-info-circle' },
  { key: 'layouts', label: 'Layouts', icon: 'pi-th-large' },
  { key: 'rules',   label: 'Rules',   icon: 'pi-file-edit' },
]

const statusOptions = [
  { label: 'Active',   value: 'ACTIVE' },
  { label: 'Draft',    value: 'DRAFT' },
  { label: 'Archived', value: 'ARCHIVED' },
]

const masterOptions = computed(() =>
  (props.allBookables ?? []).filter(b => b.id !== props.bookable?.id && b.status !== 'ARCHIVED' && b.status !== 'DELETED')
)

const bookingViewOptions = [
  { label: 'Month', value: 'dayGridMonth' },
  { label: 'Week',  value: 'timeGridWeek' },
  { label: 'Day',   value: 'timeGridDay' },
  { label: 'List',  value: 'listWeek' },
]

const activeTab = ref(props.initialTab ?? 'details')
const saving = ref(false)
const localLinked = ref(!!props.bookable?.master_id)
const newSport = ref('')
const newFeature = ref('')
const newSection = ref('')
const isSplitVenue = ref(false)
const hoveredLayout = ref<{ _key: string; sections: string[] } | null>(null)
const activeLayoutIndex = ref<number | null>(null)
const activeLayout = computed(() =>
  activeLayoutIndex.value !== null ? layouts.value[activeLayoutIndex.value] ?? null : null
)


const spaceTypes = [
  { value: 'generic',    label: 'Generic',    emoji: '⬜' },
  { value: 'football',   label: 'Football',   emoji: '⚽' },
  { value: 'basketball', label: 'Basketball', emoji: '🏀' },
  { value: 'pool',       label: 'Pool',       emoji: '🏊' },
  { value: 'hall',       label: 'Hall',       emoji: '🏛️' },
]


type LayoutMode = { name: string; description: string; min_players: number | null; max_players: number | null; price: number; price_type: string }

type VenueMode = {
  _key: string; id?: string; name: string; description: string; color: string
  min_players: number | null; max_players: number | null
  price_per_hour: number | null; price_per_slot: number | null
  flat_fee: number | null; price_per_person: number | null
}

const MODE_COLORS = ['#6366F1','#EF4444','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#F97316','#14B8A6','#84CC16']

const modes        = ref<VenueMode[]>([])
const loadingModes = ref(false)
const savingModes  = ref(false)
const showModeDialog = ref(false)
const editingMode    = ref<VenueMode | null>(null)

function formatPrice(n: number | null): string {
  if (n == null) return ''
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

function openModeDialog(mode?: VenueMode) {
  editingMode.value = mode
    ? { ...mode }
    : { _key: crypto.randomUUID(), name: '', description: '', color: MODE_COLORS[modes.value.length % MODE_COLORS.length], min_players: null, max_players: null, price_per_hour: null, price_per_slot: null, flat_fee: null, price_per_person: null }
  showModeDialog.value = true
}

async function saveModeDialog() {
  if (!editingMode.value?.name?.trim()) return
  const idx = modes.value.findIndex(m => m._key === editingMode.value!._key)
  if (idx >= 0) {
    modes.value[idx] = editingMode.value
  } else {
    modes.value.push(editingMode.value)
  }
  showModeDialog.value = false
  await saveModes()
}

async function deleteMode() {
  if (!editingMode.value) return
  const idx = modes.value.findIndex(m => m._key === editingMode.value!._key)
  if (idx >= 0) modes.value.splice(idx, 1)
  showModeDialog.value = false
  await saveModes()
}
const layouts = ref<Array<{
  _key: string; id?: string; name: string
  group: string
  sections: string[]
  modes: LayoutMode[]
}>>([])

// Flat list for the left column: group headers (index -1) interleaved with layout rows
const groupedLayoutList = computed(() => {
  const result: Array<{ groupName: string; index: number }> = []
  const seenGroups = new Set<string>()
  const ungrouped: number[] = []
  for (let i = 0; i < layouts.value.length; i++) {
    const g = layouts.value[i].group?.trim() || ''
    if (g) {
      if (!seenGroups.has(g)) { seenGroups.add(g); result.push({ groupName: g, index: -1 }) }
      result.push({ groupName: '', index: i })
    } else {
      ungrouped.push(i)
    }
  }
  for (const i of ungrouped) result.push({ groupName: '', index: i })
  return result
})

const loadingLayouts = ref(false)
const savingLayouts = ref(false)


const layoutModesPriceTypes = [
  { label: 'Included in layout', value: 'INCLUDED' },
  { label: 'Fixed price',        value: 'FIXED' },
  { label: 'Per hour',           value: 'PER_HOUR' },
  { label: 'Per person',         value: 'PER_PERSON' },
  { label: 'Free',               value: 'FREE' },
]

const showTemplateDialog = ref(false)

function addModeFromExisting(mode: VenueMode) {
  activeLayout.value?.modes.push({
    name: mode.name,
    description: mode.description ?? '',
    min_players: mode.min_players ?? null,
    max_players: mode.max_players ?? null,
    price: 0,
    price_type: 'INCLUDED',
  })
}

function addCustomMode() {
  activeLayout.value?.modes.push({ name: '', description: '', min_players: null, max_players: null, price: 0, price_type: 'INCLUDED' })
}

async function onTemplateApply(result: { space_type: string; sections: string[]; layouts: { name: string; sections: string[] }[] }) {
  form.space_type = result.space_type
  form.sections = result.sections
  layouts.value = result.layouts.map(l => ({
    _key: crypto.randomUUID(),
    name: l.name,
    group: l.group ?? '',
    sections: l.sections,
    modes: [] as LayoutMode[],
  }))
  activeLayoutIndex.value = layouts.value.length ? 0 : null
  // Persist sections to the bookable and layouts to the DB in one go
  await save()
  await saveLayouts()
}

function addLayout() {
  layouts.value.push({ _key: crypto.randomUUID(), name: '', group: '', sections: [], modes: [] as LayoutMode[] })
  activeLayoutIndex.value = layouts.value.length - 1
}

function quickDivide(n: number) {
  if (layouts.value.length || form.sections.length) {
    if (!confirm(`This will replace existing sections and layouts. Continue?`)) return
  }
  const parts = Array.from({ length: n }, (_, i) => String(i + 1))
  form.sections = parts
  const generated = generateLayouts(parts)
  layouts.value = generated.map(l => ({ _key: crypto.randomUUID(), name: l.name, group: '', sections: l.sections, modes: [] as LayoutMode[] }))
  activeLayoutIndex.value = layouts.value.length ? 0 : null
}

function toggleLayoutSection(layout: typeof layouts.value[0], section: string) {
  const idx = layout.sections.indexOf(section)
  if (idx === -1) layout.sections.push(section)
  else layout.sections.splice(idx, 1)
}

function removeLayout(i: number) {
  layouts.value.splice(i, 1)
  if (layouts.value.length === 0) activeLayoutIndex.value = null
  else activeLayoutIndex.value = Math.min(i, layouts.value.length - 1)
}

async function loadLayouts() {
  if (!props.bookable?.id) return
  loadingLayouts.value = true
  try {
    const layoutIdRows = (await (db.from as any)('bookable_layouts').select('id').eq('bookable_id', props.bookable.id)).data?.map((r: any) => r.id) ?? []
    const [{ data: layoutRows }, { data: modeRows }] = await Promise.all([
      (db.from as any)('bookable_layouts').select('*').eq('bookable_id', props.bookable.id).order('sort_order'),
      layoutIdRows.length ? (db.from as any)('bookable_layout_modes').select('*').in('layout_id', layoutIdRows).order('sort_order') : Promise.resolve({ data: [] }),
    ])
    layouts.value = (layoutRows ?? []).map((l: any) => {
      const modes: LayoutMode[] = (modeRows ?? []).filter((m: any) => m.layout_id === l.id).map((m: any) => ({
        name: m.name,
        description: m.description ?? '',
        min_players: m.min_players ?? null,
        max_players: m.max_players ?? null,
        price: Number(m.price ?? 0),
        price_type: m.price_type ?? 'INCLUDED',
      }))
      return { _key: l.id, id: l.id, name: l.name, group: l.group ?? '', sections: l.sections ?? [], modes }
    })
    if (layouts.value.length && activeLayoutIndex.value === null) {
      activeLayoutIndex.value = 0
    }
  } finally {
    loadingLayouts.value = false
  }
}

async function saveLayouts() {
  if (!props.bookable?.id) return
  savingLayouts.value = true
  try {
    // Replace all layouts for this bookable
    await (db.from as any)('bookable_layouts').delete().eq('bookable_id', props.bookable.id)
    if (!layouts.value.length) return
    const { data: inserted } = await (db.from as any)('bookable_layouts')
      .insert(layouts.value.filter(l => l.name.trim()).map((l, i) => ({
        bookable_id: props.bookable!.id,
        name: l.name.trim(),
        group: l.group?.trim() || null,
        sections: l.sections?.length ? l.sections : null,
        sort_order: i,
      })))
      .select()
    if (!inserted) return
    const modeRows: any[] = []
    inserted.forEach((row: any, i: number) => {
      const src = layouts.value.filter(l => l.name.trim())[i]
      ;(src.modes ?? []).filter((m: LayoutMode) => m.name?.trim()).forEach((m: LayoutMode, mi: number) => {
        modeRows.push({
          layout_id: row.id,
          name: m.name.trim(),
          description: m.description?.trim() || null,
          min_players: m.min_players ?? null,
          max_players: m.max_players ?? null,
          price: m.price ?? 0,
          price_type: m.price_type ?? 'INCLUDED',
          sort_order: mi,
        })
      })
    })
    if (modeRows.length) await (db.from as any)('bookable_layout_modes').insert(modeRows)
    // Refresh so ids are accurate
    await loadLayouts()
  } finally {
    savingLayouts.value = false
  }
}

async function loadModes() {
  if (!props.bookable?.id) return
  loadingModes.value = true
  try {
    const { data } = await (db.from as any)('bookable_modes')
      .select('*').eq('bookable_id', props.bookable.id).order('sort_order')
    modes.value = (data ?? []).map((m: any) => ({
      _key: m.id,
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      color: m.color ?? '#6366F1',
      min_players: m.min_players ?? null,
      max_players: m.max_players ?? null,
      price_per_hour: m.price_per_hour ?? null,
      price_per_slot: m.price_per_slot ?? null,
      flat_fee: m.flat_fee ?? null,
      price_per_person: m.price_per_person ?? null,
    }))
  } finally {
    loadingModes.value = false
  }
}

async function saveModes() {
  if (!props.bookable?.id) return
  savingModes.value = true
  try {
    await (db.from as any)('bookable_modes').delete().eq('bookable_id', props.bookable.id)
    const rows = modes.value.filter(m => m.name.trim()).map((m, i) => ({
      bookable_id: props.bookable!.id,
      name: m.name.trim(),
      description: m.description?.trim() || null,
      color: m.color,
      min_players: m.min_players,
      max_players: m.max_players,
      price_per_hour: m.price_per_hour,
      price_per_slot: m.price_per_slot,
      flat_fee: m.flat_fee,
      price_per_person: m.price_per_person,
      sort_order: i,
    }))
    if (rows.length) await (db.from as any)('bookable_modes').insert(rows)
    await loadModes()
  } finally {
    savingModes.value = false
  }
}

watch(activeTab, async (tab) => {
  if (tab === 'layouts') {
    await Promise.all([loadLayouts(), loadModes()])
    if (form.allow_multiple_layouts && !layouts.value.length && !form.sections.length) {
      showTemplateDialog.value = true
    }
  } else if (tab === 'modes') {
    await loadModes()
  } else {
    activeLayoutIndex.value = null
  }
})

const form = reactive({
  name: '',
  internal_name: '',
  description: '',
  location: '',
  sports: [] as string[],
  features: [] as string[],
  sections: [] as string[],
  space_type: 'generic',
  max_concurrent: 1,
  rules: '',
  booking_limit_type: 'none' as 'none' | 'per_time_range' | 'per_day' | 'per_week' | 'per_month',
  booking_limit_count: null as number | null,
  disallow_concurrent: false,
  disallow_consecutive: false,
  allow_modes_with_others: false,
  status: 'ACTIVE',
  is_public: false,
  show_in_menu: false,
  show_location: true,
  default_booking_view: 'dayGridMonth',
  allow_multiple_layouts: true,
  allow_sub_venues: false,
  master_id: null as string | null,
  images: [] as string[],
  main_image: null as string | null,
  sponsor_image: null as string | null,
})

const bookingLimitOptions = [
  { label: 'None',           value: 'none' },
  { label: 'Per time range', value: 'per_time_range' },
  { label: 'Per day',        value: 'per_day' },
  { label: 'Per week',       value: 'per_week' },
  { label: 'Per month',      value: 'per_month' },
]
const bookingLimitLabel = computed(() => {
  const map: Record<string, string> = { per_time_range: 'time range', per_day: 'day', per_week: 'week', per_month: 'month' }
  return map[form.booking_limit_type] ?? ''
})
watch(() => form.booking_limit_type, (t) => {
  if (t === 'none') form.booking_limit_count = null
})

const uploadingPhoto = ref(false)

watch(() => props.bookable, (b) => {
  if (b && activeTab.value === 'layouts') loadLayouts()
  if (b && activeTab.value === 'modes') loadModes()
  if (b) loadActivities()
  if (b) localLinked.value = !!b.master_id
  if (b) {
    form.name = b.name ?? ''
    form.internal_name = b.internal_name ?? ''
    form.description = b.description ?? ''
    form.location = b.location ?? ''
    form.sports = [...(b.sports ?? [])]
    form.features = [...(b.features ?? [])]
    form.sections = [...(b.sections ?? [])]
    isSplitVenue.value = (b.sections?.length ?? 0) > 0
      form.space_type = b.space_type ?? 'generic'
    form.max_concurrent = b.max_concurrent ?? 1
    form.rules = b.rules ?? ''
    form.booking_limit_type = b.booking_limit_type ?? 'none'
    form.booking_limit_count = b.booking_limit_count ?? null
    form.disallow_concurrent = b.disallow_concurrent ?? false
    form.disallow_consecutive = b.disallow_consecutive ?? false
    form.allow_modes_with_others = b.allow_modes_with_others ?? false
    form.status = b.status ?? 'ACTIVE'
    form.is_public = b.is_public ?? false
    form.show_in_menu = b.show_in_menu ?? false
    form.show_location = b.show_location ?? true
    form.default_booking_view = b.default_booking_view ?? 'dayGridMonth'
    form.allow_multiple_layouts = b.allow_multiple_layouts ?? true
    form.allow_sub_venues = b.allow_sub_venues ?? false
    form.master_id = b.master_id ?? null
    form.images = Array.isArray(b.images) ? [...b.images] : []
    form.main_image = b.main_image ?? null
    form.sponsor_image = b.sponsor_image ?? null
  } else {
    form.name = ''
    form.internal_name = ''
    form.description = ''
    form.location = ''
    form.sports = []
    form.features = []
    form.sections = []
    isSplitVenue.value = false
    form.space_type = 'generic'
    form.max_concurrent = 1
    form.rules = ''
    form.booking_limit_type = 'none'
    form.booking_limit_count = null
    form.disallow_concurrent = false
    form.disallow_consecutive = false
    form.allow_modes_with_others = false
    form.status = 'ACTIVE'
    form.is_public = false
    form.show_in_menu = false
    form.show_location = true
    form.default_booking_view = 'dayGridMonth'
    form.allow_multiple_layouts = true
    form.allow_sub_venues = false
    form.master_id = null
    form.images = []
    form.main_image = null
    form.sponsor_image = null
    activeTab.value = 'details'
  }
}, { immediate: true })

watch(() => props.initialTab, tab => {
  if (tab) activeTab.value = tab
})

const allActivities = ref<any[]>([])
const linkedActivityIds = ref<string[]>([])
const linkedActivities = computed(() => allActivities.value.filter(a => linkedActivityIds.value.includes(a.id)))

async function loadActivities() {
  if (!props.bookable?.id) return
  const [{ data: acts }, { data: links }] = await Promise.all([
    (db.from as any)('activities').select('id, name, color').eq('org_id', orgId.value).eq('status', 'ACTIVE').order('name'),
    (db.from as any)('activity_bookables').select('activity_id').eq('bookable_id', props.bookable.id),
  ])
  allActivities.value = acts ?? []
  linkedActivityIds.value = (links ?? []).map((l: any) => l.activity_id)
}

async function saveActivityLinks() {
  if (!props.bookable?.id) return
  await (db.from as any)('activity_bookables').delete().eq('bookable_id', props.bookable.id)
  if (linkedActivityIds.value.length) {
    await (db.from as any)('activity_bookables').insert(
      linkedActivityIds.value.map(aid => ({ activity_id: aid, bookable_id: props.bookable!.id }))
    )
  }
}

async function unlinkActivity(activityId: string) {
  linkedActivityIds.value = linkedActivityIds.value.filter(id => id !== activityId)
  await saveActivityLinks()
}

const { reload: reloadMenuBookables } = useMenuBookables()

async function onShowInMenuToggle() {
  await save()
  reloadMenuBookables()
}

function addSport() {
  const v = newSport.value.trim().replace(/,$/, '')
  if (v && !form.sports.includes(v)) form.sports.push(v)
  newSport.value = ''
}

function addFeature() {
  const v = newFeature.value.trim().replace(/,$/, '')
  if (v && !form.features.includes(v)) form.features.push(v)
  newFeature.value = ''
}

function addSection() {
  const v = newSection.value.trim().replace(/,$/, '')
  if (v && !form.sections.includes(v)) form.sections.push(v)
  newSection.value = ''
}

async function save() {
  if (!form.name.trim()) return
  // Flush any partially-typed section/sport/feature that hasn't been confirmed with Enter
  if (newSection.value.trim()) addSection()
  if (newSport.value.trim()) addSport()
  if (newFeature.value.trim()) addFeature()
  saving.value = true
  const payload = {
    org_id: orgId.value,
    name: form.name.trim(),
    internal_name: form.internal_name.trim() || null,
    description: form.description.trim() || null,
    location: form.location.trim() || null,
    sports: form.sports,
    features: form.features,
    sections: form.sections.length ? form.sections : null,
    space_type: form.space_type,
    max_concurrent: form.max_concurrent ?? 1,
    rules: form.rules.trim() || null,
    booking_limit_type: form.booking_limit_type,
    booking_limit_count: form.booking_limit_type !== 'none' ? form.booking_limit_count : null,
    disallow_concurrent: form.disallow_concurrent,
    disallow_consecutive: form.disallow_consecutive,
    allow_modes_with_others: form.allow_modes_with_others,
    status: form.status,
    is_public: form.is_public,
    show_in_menu: form.show_in_menu,
    show_location: form.show_location,
    default_booking_view: form.default_booking_view,
    allow_multiple_layouts: form.allow_multiple_layouts,
    allow_sub_venues: form.allow_sub_venues,
    master_id: form.master_id || null,
    images: form.images,
    main_image: form.main_image,
    sponsor_image: form.sponsor_image,
    type: 'VENUE',
    parent_id: props.parentId ?? props.bookable?.parent_id ?? null,
  }
  console.log('[save] sending sections:', JSON.stringify(payload.sections))
  try {
    if (props.bookable?.id) {
      const { data, error } = await db.from('bookables').update(payload).eq('id', props.bookable.id).select().single()
      if (error) throw error
      console.log('[save] returned sections:', JSON.stringify((data as any)?.sections))
      emit('saved', data)
    } else {
      const { data, error } = await db.from('bookables').insert(payload).select().single()
      if (error) throw error
      emit('saved', data)
    }
  } catch (err: any) {
    console.error('Save failed:', err)
    alert('Save failed: ' + (err?.message ?? err))
  } finally {
    saving.value = false
  }
}

async function handlePhotoUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files?.length) return
  uploadingPhoto.value = true
  try {
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await $fetch<{ url: string }>('/api/upload', { method: 'POST', body: fd })
      form.images.push(res.url)
    }
    await save()
  } finally {
    uploadingPhoto.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function removePhoto(index: number) {
  const url = form.images[index]
  form.images.splice(index, 1)
  if (form.main_image === url) form.main_image = null
  if (form.sponsor_image === url) form.sponsor_image = null
  await save()
}

async function setImageRole(url: string, role: 'main' | 'sponsor') {
  if (role === 'main') {
    form.main_image = form.main_image === url ? null : url
  } else {
    form.sponsor_image = form.sponsor_image === url ? null : url
  }
  await save()
}

defineExpose({ save, saving })
</script>
