<template>
  <div class="p-6 space-y-4">
    <!-- Tabs + new button -->
    <div class="flex items-center gap-6">
      <div class="flex gap-0 border-b border-gray-200 flex-1">
        <button v-for="tab in tabs" :key="tab.value"
          class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
          :class="activeTab === tab.value
            ? 'border-[#1E2157] text-[#1E2157]'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          @click="activeTab = tab.value">
          <i :class="`pi ${tab.icon} text-xs`" />
          {{ tab.label }}
          <span class="text-xs rounded-full px-1.5 py-0.5"
            :class="activeTab === tab.value ? 'bg-[#EFF6FF] text-[#1E2157]' : 'bg-gray-100 text-gray-500'">
            {{ countByType[tab.value] ?? 0 }}
          </span>
        </button>
      </div>
      <Button :label="newLabel" icon="pi pi-plus" size="small" @click="openCreate" style="background:#1E2157; border-color:#1E2157" class="shrink-0" />
    </div>

    <!-- Single toolbar row: availability · view toggle · search -->
    <div class="flex items-center gap-2">
      <!-- Availability -->
      <i class="pi pi-calendar text-sm shrink-0" :class="availFilterActive ? 'text-[#1E2157]' : 'text-gray-400'" />
      <DatePicker v-model="availDate" placeholder="Availability date" date-format="D d M yy"
        size="small" show-button-bar class="w-40" />
      <Select v-model="availStart" :options="timeSlots" option-label="label" option-value="value"
        placeholder="From" size="small" class="w-36" :disabled="!availDate" />
      <span class="text-gray-300 text-sm">–</span>
      <Select v-model="availEnd" :options="timeSlots" option-label="label" option-value="value"
        placeholder="To" size="small" class="w-36" :disabled="!availDate" />
      <i v-if="availLoading" class="pi pi-spin pi-spinner text-sm text-gray-400" />
      <button v-if="availFilterActive" class="text-xs text-gray-400 hover:text-gray-600"
        @click="clearAvailability" title="Clear availability filter">
        <i class="pi pi-times text-xs" />
      </button>

      <!-- View toggle + search on right -->
      <div class="ml-auto flex items-center gap-2 shrink-0">
        <Select v-model="statusFilter" :options="statusOptions" option-label="label" option-value="value"
          placeholder="All statuses" size="small" class="w-36" />
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" :placeholder="`Search ${activeTab.toLowerCase()}s…`" size="small" class="w-52" />
        </IconField>
        <div class="flex rounded-lg border border-gray-200 overflow-hidden">
          <button class="px-2.5 py-1.5 transition-colors"
            :class="viewMode === 'list' ? 'bg-[#1E2157] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'"
            @click="viewMode = 'list'" title="List view">
            <i class="pi pi-list text-sm" />
          </button>
          <button class="px-2.5 py-1.5 border-l border-gray-200 transition-colors"
            :class="viewMode === 'grid' ? 'bg-[#1E2157] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'"
            @click="viewMode = 'grid'" title="Grid view">
            <i class="pi pi-th-large text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- VENUES tab -->
    <template v-if="activeTab === 'VENUE'">
      <!-- List view — fully recursive accordion -->
      <div v-if="viewMode === 'list'">
        <div v-if="loading" class="p-8 flex justify-center bg-white rounded-xl border border-gray-200">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        </div>
        <div v-else-if="!flatVenueList.length" class="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
          <i class="pi pi-building text-3xl mb-3 block" />
          <p class="text-sm">No venues yet.</p>
        </div>
        <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <div v-for="{ item, depth, hasChildren } in flatVenueList" :key="item.id"
            class="flex items-center gap-3 pr-5 py-3 hover:bg-gray-50 group transition-colors"
            :style="{ paddingLeft: `${depth * 2 + 1.25}rem` }"
            :class="{ 'bg-gray-50/40': depth > 0 }">
            <!-- Expand toggle or spacer -->
            <button v-if="hasChildren"
              class="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 shrink-0"
              @click="toggleVenueExpand(item.id)">
              <i class="pi text-xs" :class="isVenueExpanded(item.id) ? 'pi-chevron-down' : 'pi-chevron-right'" />
            </button>
            <span v-else class="w-5 shrink-0" />
            <!-- Icon -->
            <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              :class="depth === 0 ? 'bg-[#EFF6FF]' : 'bg-gray-100'">
              <i class="pi text-sm"
                :class="depth === 0 ? 'pi-building text-[#1E2157]' : 'pi-map-marker text-gray-500'" />
            </div>
            <!-- Name + meta -->
            <div class="flex-1 min-w-0 cursor-pointer" @click="navigateTo('/bookables/' + item.id)">
              <p class="text-sm font-medium text-gray-900" :class="{ 'font-semibold': depth === 0 }">{{ item.name }}</p>
              <p v-if="item.location" class="text-xs text-gray-400">{{ item.location }}</p>
            </div>
            <!-- Badges -->
            <div class="flex items-center gap-2">
              <span v-if="isTempClosed(item)"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center gap-1">
                <i class="pi pi-ban text-[10px]" />Closed
              </span>
              <span v-if="childVenues(item.id).length" class="text-xs text-gray-400">
                {{ childVenues(item.id).length }} sub-venue{{ childVenues(item.id).length !== 1 ? 's' : '' }}
              </span>
              <span v-if="childItems(item.id).length" class="text-xs text-amber-600 font-medium">
                {{ childItems(item.id).length }} item{{ childItems(item.id).length !== 1 ? 's' : '' }}
              </span>
              <span v-if="item.status === 'ACTIVE'"
                class="text-xs font-medium px-2 py-0.5 rounded-full border"
                :class="bookedIds.has(item.id) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'">
                {{ bookedIds.has(item.id) ? 'Booked' : 'Available' }}
              </span>
              <span v-else class="text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                {{ item.status === 'DRAFT' ? 'Draft' : 'Inactive' }}
              </span>
            </div>
            <!-- Actions -->
            <div class="flex gap-1 items-center ml-4">
              <Button v-if="bookedIds.has(item.id)" label="Booked" icon="pi pi-check" size="small"
                severity="secondary" outlined disabled />
              <Button v-else label="Book" icon="pi pi-calendar-plus" size="small"
                style="background:#1E2157;border-color:#1E2157"
                @click.stop="navigateTo(bookUrl(item.id))" />
            </div>
          </div>
        </div>
      </div>

      <!-- Grid view for venues -->
      <div v-else>
        <div v-if="loading" class="p-8 flex justify-center">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        </div>
        <div v-else-if="!filteredVenues.length" class="text-center py-12 text-gray-400">
          <i class="pi pi-building text-3xl mb-3 block" />
          <p class="text-sm">No venues yet.</p>
        </div>
        <div v-else class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="item in filteredVenues" :key="item.id"
            class="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#1E2157]/40 hover:shadow-sm transition-all cursor-pointer group"
            @click="navigateTo('/bookables/' + item.id)">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="getDepth(item) === 0 ? 'bg-[#EFF6FF]' : 'bg-gray-100'">
                <i :class="`pi ${getDepth(item) === 0 ? 'pi-building text-[#1E2157]' : 'pi-map-marker text-gray-500'} text-base`" />
              </div>
              <span v-if="item.status === 'ACTIVE'"
                class="text-xs font-medium px-2 py-0.5 rounded-full border"
                :class="bookedIds.has(item.id) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'">
                {{ bookedIds.has(item.id) ? 'Booked' : 'Available' }}
              </span>
              <span v-else class="text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                {{ item.status === 'DRAFT' ? 'Draft' : 'Inactive' }}
              </span>
            </div>
            <p class="text-sm font-semibold text-gray-900 mb-0.5">{{ item.name }}</p>
            <p v-if="item.location" class="text-xs text-gray-400 mb-1 truncate">{{ item.location }}</p>
            <p v-if="item.parent_id && getParentName(item)" class="text-xs text-gray-400 mb-1">
              <i class="pi pi-arrow-up text-xs mr-0.5" />{{ getParentName(item) }}
            </p>
            <span v-if="isTempClosed(item)"
              class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 mb-1">
              <i class="pi pi-ban text-[10px]" />Temporarily closed
            </span>
            <div class="flex items-center justify-between mt-3" @click.stop>
              <span v-if="item.max_concurrent > 1" class="text-xs text-gray-400">×{{ item.max_concurrent }}</span>
              <span v-else />
              <Button v-if="bookedIds.has(item.id)" label="Booked" icon="pi pi-check" size="small"
                severity="secondary" outlined disabled />
              <Button v-else label="Book" icon="pi pi-calendar-plus" size="small"
                style="background:#1E2157;border-color:#1E2157"
                @click="navigateTo(bookUrl(item.id))" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- PERSON tab -->
    <template v-else-if="activeTab === 'PERSON'">
      <!-- Grid view (default for persons) -->
      <div v-if="viewMode === 'grid'">
        <div v-if="loading" class="p-8 flex justify-center">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        </div>
        <div v-else-if="!filteredPersons.length" class="text-center py-12 text-gray-400">
          <i class="pi pi-user text-3xl mb-3 block" />
          <p class="text-sm">No bookable persons yet.</p>
        </div>
        <div v-else class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="item in filteredPersons" :key="item.id"
            class="bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400/60 hover:shadow-sm transition-all cursor-pointer group"
            @click="navigateTo('/bookables/' + item.id)">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <i class="pi pi-user text-green-600 text-base" />
              </div>
              <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small"
                  @click="navigateTo('/bookables/' + item.id)" />
              </div>
            </div>
            <p class="text-sm font-semibold text-gray-900 mb-0.5">{{ item.name }}</p>
            <p v-if="item.internal_name" class="text-xs text-gray-400 mb-0.5">{{ item.internal_name }}</p>
            <p v-if="item.location" class="text-xs text-gray-400 mb-2 truncate">{{ item.location }}</p>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-1.5">
                <span v-if="item.status === 'ACTIVE'"
                  class="text-xs font-medium px-2 py-0.5 rounded-full border"
                  :class="bookedIds.has(item.id) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'">
                  {{ bookedIds.has(item.id) ? 'Booked' : 'Available' }}
                </span>
                <Tag v-else :value="item.status" :severity="statusSeverity(item.status)" />
                <i :class="item.is_public ? 'pi pi-eye text-green-500 text-xs' : 'pi pi-eye-slash text-gray-300 text-xs'" />
              </div>
              <Button v-if="availFilterActive" label="Book" size="small"
                style="background:#1E2157;border-color:#1E2157"
                @click.stop="navigateTo(bookUrl(item.id))" />
            </div>
          </div>
        </div>
      </div>

      <!-- List view for persons -->
      <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div v-if="loading" class="p-8 flex justify-center">
          <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
        </div>
        <div v-else-if="!filteredPersons.length" class="text-center py-12 text-gray-400">
          <i class="pi pi-user text-3xl mb-3 block" />
          <p class="text-sm">No bookable persons yet.</p>
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div v-for="item in filteredPersons" :key="item.id"
            class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group cursor-pointer"
            @click="navigateTo('/bookables/' + item.id)">
            <div class="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <i class="pi pi-user text-green-600 text-sm" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-900">{{ item.name }}</p>
              <p v-if="item.internal_name" class="text-xs text-gray-400">{{ item.internal_name }}</p>
              <p v-if="item.location" class="text-xs text-gray-400">{{ item.location }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="item.status === 'ACTIVE'"
                class="text-xs font-medium px-2 py-0.5 rounded-full border"
                :class="bookedIds.has(item.id) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'">
                {{ bookedIds.has(item.id) ? 'Booked' : 'Available' }}
              </span>
              <Tag v-else :value="item.status" :severity="statusSeverity(item.status)" />
              <i :class="item.is_public ? 'pi pi-eye text-green-500 text-sm' : 'pi pi-eye-slash text-gray-300 text-sm'" />
            </div>
            <div class="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
              <Button v-if="availFilterActive" label="Book" size="small"
                style="background:#1E2157;border-color:#1E2157"
                @click="navigateTo(bookUrl(item.id))" />
              <Button icon="pi pi-pencil" severity="secondary" text rounded size="small"
                @click="navigateTo('/bookables/' + item.id)" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ITEM tab — category accordions -->
    <template v-else-if="activeTab === 'ITEM'">
      <div v-if="loading" class="p-8 flex justify-center bg-white rounded-xl border border-gray-200">
        <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
      </div>
      <div v-else-if="!filteredItems.length" class="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
        <i class="pi pi-box text-3xl mb-3 block" />
        <p class="text-sm">No bookable items yet.</p>
      </div>
      <div v-else class="space-y-2">
        <div v-for="group in itemsByCategory" :key="group.category"
          class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <!-- Category accordion header -->
          <div class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 group"
            @click="toggleItemCategory(group.category)">
            <button class="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 shrink-0">
              <i class="pi text-xs" :class="isItemCategoryExpanded(group.category) ? 'pi-chevron-down' : 'pi-chevron-right'" />
            </button>
            <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <i class="pi pi-tag text-amber-600 text-sm" />
            </div>
            <p class="text-sm font-semibold text-gray-900 flex-1">{{ group.category || 'Uncategorised' }}</p>
            <span class="text-xs text-gray-400">{{ group.items.length }} item{{ group.items.length !== 1 ? 's' : '' }}</span>
          </div>
          <!-- Category items — grid or list -->
          <div v-if="isItemCategoryExpanded(group.category)" class="border-t border-gray-100">
            <!-- Grid -->
            <div v-if="viewMode === 'grid'" class="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              <div v-for="item in group.items" :key="item.id"
                class="border border-gray-200 rounded-xl p-3 hover:border-amber-400/60 hover:shadow-sm transition-all cursor-pointer group"
                @click="navigateTo('/bookables/' + item.id)">
                <div class="flex items-start justify-between mb-2">
                  <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <i class="pi pi-box text-amber-600 text-sm" />
                  </div>
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                    <Button icon="pi pi-pencil" severity="secondary" text rounded size="small"
                      @click="navigateTo('/bookables/' + item.id)" />
                  </div>
                </div>
                <p class="text-sm font-medium text-gray-900 mb-0.5">{{ item.name }}</p>
                <p v-if="item.description" class="text-xs text-gray-400 line-clamp-2 mb-2">{{ item.description }}</p>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span v-if="item.status === 'ACTIVE'"
                      class="text-xs font-medium px-2 py-0.5 rounded-full border"
                      :class="bookedIds.has(item.id) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'">
                      {{ bookedIds.has(item.id) ? 'Booked' : 'Available' }}
                    </span>
                    <Tag v-else :value="item.status" :severity="statusSeverity(item.status)" />
                    <span v-if="item.max_concurrent > 1" class="text-xs text-gray-400">×{{ item.max_concurrent }}</span>
                  </div>
                  <Button v-if="availFilterActive" label="Book" size="small"
                    style="background:#1E2157;border-color:#1E2157"
                    @click.stop="navigateTo(bookUrl(item.id))" />
                </div>
              </div>
            </div>
            <!-- List -->
            <div v-else class="divide-y divide-gray-100">
              <div v-for="item in group.items" :key="item.id"
                class="flex items-center gap-4 px-5 py-2.5 hover:bg-gray-50 group cursor-pointer"
                @click="navigateTo('/bookables/' + item.id)">
                <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <i class="pi pi-box text-amber-600 text-sm" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900">{{ item.name }}</p>
                  <p v-if="item.description" class="text-xs text-gray-400 truncate">{{ item.description }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="item.status === 'ACTIVE'"
                    class="text-xs font-medium px-2 py-0.5 rounded-full border"
                    :class="bookedIds.has(item.id) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'">
                    {{ bookedIds.has(item.id) ? 'Booked' : 'Available' }}
                  </span>
                  <Tag v-else :value="item.status" :severity="statusSeverity(item.status)" />
                  <span v-if="item.max_concurrent > 1" class="text-xs text-gray-400">×{{ item.max_concurrent }}</span>
                </div>
                <div class="flex gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                  <Button v-if="availFilterActive" label="Book" size="small"
                    style="background:#1E2157;border-color:#1E2157"
                    @click="navigateTo(bookUrl(item.id))" />
                  <Button icon="pi pi-pencil" severity="secondary" text rounded size="small"
                    @click="navigateTo('/bookables/' + item.id)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreate" :header="createItemParentId ? 'New Item for Venue' : `New ${activeTab === 'VENUE' ? 'Venue' : activeTab === 'PERSON' ? 'Person' : 'Item'}`" modal style="width: 480px">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Name</label>
            <InputText v-model="form.name" autofocus placeholder="e.g. Main Oval" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Internal Name</label>
            <InputText v-model="form.internal_name" placeholder="Optional" />
          </div>
        </div>
        <div v-if="activeTab === 'ITEM' || createItemParentId" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Category</label>
          <AutoComplete v-model="form.item_category" :suggestions="categorySuggestions"
            @complete="searchCategories" placeholder="e.g. Equipment, Facilities…" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Location / Description</label>
          <InputText v-model="form.location" placeholder="Address or description" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Max Concurrent Bookings</label>
            <InputNumber v-model="form.max_concurrent" :min="1" />
          </div>
          <div class="flex items-end gap-4 pb-1">
            <div class="flex items-center gap-2">
              <Checkbox v-model="form.is_public" :binary="true" />
              <label class="text-sm">Public</label>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Description</label>
          <Textarea v-model="form.description" rows="2" auto-resize />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" :loading="creating" :disabled="!form.name.trim()" @click="handleCreate" style="background:#1E2157; border-color:#1E2157" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const bookables = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const activeTab = ref<'VENUE' | 'PERSON' | 'ITEM'>('VENUE')

// Availability filter
const availDate = ref<Date | null>(new Date())
const availStart = ref('')
const availEnd = ref('')
const bookedIds = ref<Set<string>>(new Set())
const availLoading = ref(false)

const timeSlots = Array.from({ length: 34 }, (_, i) => {
  const totalMins = 6 * 60 + i * 30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  const label = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { label, value }
})

const availFilterActive = computed(() => !!availDate.value)

async function checkAvailability() {
  if (!availDate.value || !orgId.value) { bookedIds.value = new Set(); return }
  availLoading.value = true
  const d = availDate.value
  const [sh, sm] = availStart.value ? availStart.value.split(':').map(Number) : [0, 0]
  const [eh, em] = availEnd.value ? availEnd.value.split(':').map(Number) : [23, 59]
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm).toISOString()
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em).toISOString()
  const { data } = await db.from('bookings')
    .select('bookable_id')
    .lte('start_at', end)
    .gte('end_at', start)
    .neq('status', 'CANCELLED')
  bookedIds.value = new Set((data ?? []).map((b: any) => b.bookable_id))
  availLoading.value = false
}

watch([availDate, availStart, availEnd], checkAvailability)

function clearAvailability() {
  availDate.value = null
  availStart.value = ''
  availEnd.value = ''
  bookedIds.value = new Set()
}

function bookUrl(itemId: string) {
  const params = new URLSearchParams({ bookableId: itemId })
  if (availDate.value) params.set('date', availDate.value.toISOString().slice(0, 10))
  if (availStart.value) params.set('startTime', availStart.value)
  if (availEnd.value) params.set('endTime', availEnd.value)
  return `/bookings/new?${params}`
}
const showCreate = ref(false)
const creating = ref(false)
const createItemParentId = ref<string | null>(null)

// Default: venues → list, persons/items → grid; resets when switching tabs
const viewMode = ref<'list' | 'grid'>('list')
watch(activeTab, (tab) => {
  viewMode.value = tab === 'VENUE' ? 'list' : 'grid'
})

// Accordion state — undefined/true = expanded, false = collapsed; all open by default
const expandedVenues = ref<Record<string, boolean>>({})

function isVenueExpanded(id: string) {
  return expandedVenues.value[id] !== false
}
function toggleVenueExpand(id: string) {
  expandedVenues.value[id] = !isVenueExpanded(id)
}
function childVenues(parentId: string) {
  return bookables.value.filter(b => b.type === 'VENUE' && b.parent_id === parentId)
}
function childItems(venueId: string) {
  return bookables.value.filter(b => b.type === 'ITEM' && b.parent_id === venueId)
}

// Flat recursive list of visible venue rows
const flatVenueList = computed(() => {
  const result: { item: any; depth: number; hasChildren: boolean }[] = []
  const q = search.value.toLowerCase()

  function walk(parentId: string | null, depth: number) {
    const children = bookables.value.filter(b =>
      b.type === 'VENUE' && b.parent_id === parentId &&
      (!statusFilter.value || b.status === statusFilter.value) &&
      (!availFilterActive.value || !bookedIds.value.has(b.id))
    )
    for (const item of children) {
      const subVenues = childVenues(item.id)
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || (item.internal_name ?? '').toLowerCase().includes(q)
      if (matchesSearch || subVenues.length) {
        result.push({ item, depth, hasChildren: subVenues.length > 0 })
        if (isVenueExpanded(item.id)) walk(item.id, depth + 1)
      }
    }
  }
  walk(null, 0)
  return result
})

// Item category accordion
const expandedItemCategories = ref<Record<string, boolean>>({})
function isItemCategoryExpanded(cat: string) {
  return expandedItemCategories.value[cat] !== false
}
function toggleItemCategory(cat: string) {
  expandedItemCategories.value[cat] = !isItemCategoryExpanded(cat)
}

const itemsByCategory = computed(() => {
  const items = filteredItems.value
  const map: Record<string, any[]> = {}
  for (const item of items) {
    const key = item.item_category || ''
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return Object.entries(map)
    .sort(([a], [b]) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b)
    })
    .map(([category, items]) => ({ category, items }))
})

// Autocomplete for existing item categories
const categorySuggestions = ref<string[]>([])
function searchCategories(event: { query: string }) {
  const q = event.query.toLowerCase()
  const existing = [...new Set(bookables.value.filter(b => b.type === 'ITEM' && b.item_category).map(b => b.item_category as string))]
  categorySuggestions.value = existing.filter(c => c.toLowerCase().includes(q))
}

function openCreateItem(venueId: string) {
  form.value = { name: '', internal_name: '', item_category: '', location: '', max_concurrent: 1, is_public: false, description: '' }
  createItemParentId.value = venueId
  activeTab.value = 'ITEM'
  showCreate.value = true
}

const form = ref({ name: '', internal_name: '', item_category: '', location: '', max_concurrent: 1, is_public: false, description: '' })

const tabs = [
  { label: 'Venues', value: 'VENUE', icon: 'pi-building' },
  { label: 'Persons', value: 'PERSON', icon: 'pi-user' },
  { label: 'Items', value: 'ITEM', icon: 'pi-box' },
]

const newLabel = computed(() =>
  activeTab.value === 'VENUE' ? 'New Venue' : activeTab.value === 'PERSON' ? 'New Person' : 'New Item'
)

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Archived', value: 'ARCHIVED' },
]

function statusSeverity(s: string) {
  return { ACTIVE: 'success', DRAFT: 'secondary', ARCHIVED: 'warn', DELETED: 'danger' }[s] ?? 'secondary'
}

const countByType = computed(() => ({
  VENUE: bookables.value.filter(b => b.type === 'VENUE').length,
  PERSON: bookables.value.filter(b => b.type === 'PERSON').length,
  ITEM: bookables.value.filter(b => b.type === 'ITEM').length,
}))

function applyFilters(items: any[]) {
  const q = search.value.toLowerCase()
  return items.filter(b => {
    const matchSearch = !q || b.name.toLowerCase().includes(q) || (b.internal_name ?? '').toLowerCase().includes(q)
    const matchStatus = !statusFilter.value || b.status === statusFilter.value
    const matchAvail = !availFilterActive.value || !bookedIds.value.has(b.id)
    return matchSearch && matchStatus && matchAvail
  })
}

const venuesSorted = computed(() => {
  const raw = bookables.value.filter(b => b.type === 'VENUE')
  const sorted: any[] = []
  function addSorted(parentId: string | null) {
    for (const item of raw.filter(b => b.parent_id === parentId)) {
      sorted.push(item)
      addSorted(item.id)
    }
  }
  addSorted(null)
  for (const item of raw) {
    if (!sorted.find(s => s.id === item.id)) sorted.push(item)
  }
  return sorted
})

const filteredVenues = computed(() => applyFilters(venuesSorted.value))
const filteredPersons = computed(() => applyFilters(bookables.value.filter(b => b.type === 'PERSON')))
const filteredItems = computed(() => applyFilters(bookables.value.filter(b => b.type === 'ITEM')))

function getDepth(item: any, visited = new Set()): number {
  if (!item.parent_id || visited.has(item.id)) return 0
  visited.add(item.id)
  const parent = bookables.value.find(b => b.id === item.parent_id)
  return parent ? 1 + getDepth(parent, visited) : 0
}

function getParentName(item: any): string | null {
  if (!item.parent_id) return null
  return bookables.value.find(b => b.id === item.parent_id)?.name ?? null
}

function isTempClosed(item: any): boolean {
  if (!item.closed_from) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const from = new Date(item.closed_from)
  const until = item.closed_until ? new Date(item.closed_until) : null
  return today >= from && (until === null || today <= until)
}

async function load() {
  loading.value = true
  const { data } = await db.from('bookables').select('*').eq('org_id', orgId.value).neq('status', 'DELETED').order('name')
  bookables.value = data ?? []
  loading.value = false
}

function openCreate() {
  if (activeTab.value === 'VENUE') {
    navigateTo('/bookables/new')
    return
  }
  form.value = { name: '', internal_name: '', item_category: '', location: '', max_concurrent: 1, is_public: false, description: '' }
  createItemParentId.value = null
  showCreate.value = true
}

async function handleCreate() {
  if (!form.value.name.trim()) return
  if (!orgId.value) { toast.add({ severity: 'error', summary: 'Not ready', detail: 'Organisation not loaded yet. Please try again.', life: 4000 }); return }
  creating.value = true
  const { error } = await db.from('bookables').insert({
    org_id: orgId.value,
    name: form.value.name.trim(),
    internal_name: form.value.internal_name || null,
    type: activeTab.value === 'ITEM' || createItemParentId.value ? 'ITEM' : activeTab.value,
    item_category: (activeTab.value === 'ITEM' || createItemParentId.value) ? (form.value.item_category || null) : null,
    location: form.value.location || null,
    max_concurrent: form.value.max_concurrent,
    is_public: form.value.is_public,
    description: form.value.description || null,
    parent_id: createItemParentId.value || null,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Created', life: 3000 })
    showCreate.value = false
    const wasItemForVenue = createItemParentId.value
    createItemParentId.value = null
    if (wasItemForVenue) activeTab.value = 'VENUE'
    load()
  }
  creating.value = false
}

onMounted(load)
</script>
