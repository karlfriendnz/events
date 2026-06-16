<template>
  <div class="min-h-screen bg-gray-50">

    <div v-if="loading" class="flex items-center justify-center py-32">
      <i class="pi pi-spin pi-spinner text-3xl text-gray-300" />
    </div>

    <div v-else-if="!queryOrgId" class="flex flex-col items-center justify-center gap-3 px-6 py-32 text-center">
      <i class="pi pi-building text-4xl text-gray-200" />
      <p class="text-lg font-semibold text-gray-500">Booking page not found</p>
      <p class="text-sm text-gray-400">This link may be incorrect or the page is no longer available.</p>
    </div>

    <template v-else>

      <!-- Success screen -->
      <div v-if="submitted" class="flex flex-col items-center justify-center gap-5 px-6 py-16 text-center max-w-md mx-auto">
        <div class="w-16 h-16 rounded-full flex items-center justify-center"
          :class="bookedStatus === 'PENDING' ? 'bg-amber-100' : 'bg-green-100'">
          <i class="pi text-2xl"
            :class="bookedStatus === 'PENDING' ? 'pi-clock text-amber-600' : 'pi-check text-green-600'" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">
            {{ bookedStatus === 'PENDING' ? 'Booking request received' : 'Your booking is confirmed' }}
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            <template v-if="bookedStatus === 'PENDING'">We'll review and confirm your booking shortly.</template>
            <template v-else>The slot is held for you — we'll see you then.</template>
          </p>
        </div>

        <!-- Reference + view-booking link -->
        <div v-if="bookingReference" class="flex flex-col items-center gap-1.5 text-xs">
          <div class="flex items-center gap-2">
            <span class="text-gray-500">Reference</span>
            <span class="font-mono font-semibold text-gray-800 bg-gray-100 rounded px-2 py-1">{{ bookingReference }}</span>
          </div>
          <NuxtLink :to="`/booking/${bookingReference}`" class="text-[#1E2157] underline">
            View this booking later
          </NuxtLink>
        </div>

        <!-- Booking summary -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden text-left w-full">
          <div class="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking summary</p>
            <span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
              :class="bookedStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'">
              {{ bookedStatus === 'PENDING' ? 'Pending' : 'Confirmed' }}
            </span>
          </div>
          <div class="p-4 space-y-3">
            <div v-if="booking.activity">
              <p class="text-xs text-gray-400 mb-1">Activity</p>
              <p class="text-sm font-medium text-gray-900">{{ booking.activity.name }}</p>
            </div>
            <div v-if="booking.modeName">
              <p class="text-xs text-gray-400 mb-1">{{ modeLabel }}</p>
              <p class="text-sm font-medium text-gray-900">{{ booking.modeName }}</p>
            </div>
            <div v-if="booking.bookable">
              <p class="text-xs text-gray-400 mb-1">Resource</p>
              <p class="text-sm font-medium text-gray-900">{{ booking.bookable.name }}</p>
              <p v-if="booking.bookable.location" class="text-xs text-gray-400">{{ booking.bookable.location }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Date & time</p>
              <p class="text-sm font-medium text-gray-900">{{ formatReviewDate }}</p>
            </div>
            <div v-if="booking.selectedAddons.length">
              <p class="text-xs text-gray-400 mb-1">Add-ons</p>
              <p v-for="a in booking.selectedAddons" :key="a.id" class="text-sm font-medium text-gray-900">
                {{ a.name }}<span v-if="a.qty > 1"> × {{ a.qty }}</span>
              </p>
            </div>
            <div v-if="booking.contactName">
              <p class="text-xs text-gray-400 mb-1">Name</p>
              <p class="text-sm font-medium text-gray-900">{{ booking.contactName }}</p>
              <p v-if="booking.contactEmail" class="text-xs text-gray-400">{{ booking.contactEmail }}</p>
            </div>
          </div>
        </div>

        <!-- What happens next -->
        <div class="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-left w-full text-xs text-blue-900 leading-relaxed">
          <p class="font-semibold mb-1">What happens next</p>
          <p v-if="booking.contactEmail">A confirmation has been emailed to <span class="font-semibold">{{ booking.contactEmail }}</span>.</p>
          <p v-if="bookedStatus === 'PENDING'" class="mt-1">We'll send another email once your booking is confirmed (usually within a day).</p>
          <p v-else class="mt-1">Add the date to your calendar so you don't forget.</p>
        </div>

        <!-- Calendar download -->
        <a v-if="icsHref" :href="icsHref" :download="`${bookingReference || 'booking'}.ics`"
          class="text-sm text-[#1E2157] font-medium flex items-center gap-2 hover:underline">
          <i class="pi pi-calendar-plus text-xs" />
          Add to calendar
        </a>

        <button class="text-sm text-gray-400 hover:text-gray-600 underline mt-2" @click="resetFlow">
          Make another booking
        </button>
      </div>

      <!-- Booking flow -->
      <div v-else class="px-4 sm:px-6 py-6 sm:py-8 flex flex-col lg:flex-row gap-6 lg:gap-8"
        :class="props.embedded ? '' : 'max-w-6xl mx-auto'">

        <!-- Main form -->
        <div class="flex-1 min-w-0">

          <!-- Step indicator. Mobile shows a compact "Step X of N — Label"
               line + a thin progress bar; lg+ shows the full chip strip
               with labels and connectors. The Cancel link sits to the
               right of the indicator on both layouts so it's reachable
               at any point in the flow. -->
          <div class="lg:hidden mb-6">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Step {{ currentStepNumber }} of {{ visibleSteps.length }}
              </p>
              <div class="flex items-center gap-3">
                <p class="text-sm font-bold text-[#1E2157] truncate max-w-[140px]">{{ currentStepLabel }}</p>
                <button type="button"
                  class="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                  @click="onCancel">Cancel</button>
              </div>
            </div>
            <div class="h-1 rounded-full bg-gray-100 overflow-hidden">
              <div class="h-full bg-[#1E2157] transition-all duration-300"
                :style="{ width: `${(currentStepNumber / visibleSteps.length) * 100}%` }" />
            </div>
          </div>
          <div class="hidden lg:flex items-center gap-0 mb-8">
            <template v-for="(s, vi) in visibleSteps" :key="s.key">
              <div class="flex items-center gap-2 cursor-pointer"
                @click="step > stepIndex[s.key] ? step = stepIndex[s.key] : null">
                <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors"
                  :class="step === stepIndex[s.key] ? 'bg-[#1E2157] text-white'
                    : step > stepIndex[s.key] ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'">
                  <i v-if="step > stepIndex[s.key]" class="pi pi-check text-xs" />
                  <span v-else>{{ vi + 1 }}</span>
                </div>
                <span class="text-sm font-medium"
                  :class="step === stepIndex[s.key] ? 'text-[#1E2157]'
                    : step > stepIndex[s.key] ? 'text-green-600'
                    : 'text-gray-400'">
                  {{ stepLabel(s.key, s.label) }}
                </span>
              </div>
              <div v-if="vi < visibleSteps.length - 1" class="flex-1 h-px mx-3"
                :class="step > stepIndex[s.key] ? 'bg-green-400' : 'bg-gray-200'" />
            </template>
          </div>

          <!-- ── STEP 0: Activity ── -->
          <div v-if="step === 0" class="space-y-5">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">What would you like to book?</h2>
              <p class="text-sm text-gray-500 mt-1">Choose the type of activity for this booking.</p>
            </div>

            <div v-if="loadingActivities" class="py-12 flex justify-center">
              <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div v-for="act in activities" :key="act.id"
                class="bg-white rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-md"
                :class="booking.activityId === act.id ? 'shadow-sm' : 'border-gray-200 hover:border-gray-300'"
                :style="booking.activityId === act.id ? `border-color: ${act.color || '#1E2157'}` : ''"
                @click="selectActivity(act)">
                <div v-if="act.image_url" class="relative w-full h-28 bg-gray-100 overflow-hidden">
                  <img :src="act.image_url" class="w-full h-full object-cover" />
                  <div v-if="booking.activityId === act.id"
                    class="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow"
                    :style="{ backgroundColor: act.color || '#1E2157' }">
                    <i class="pi pi-check text-white text-xs" />
                  </div>
                </div>
                <div v-else class="h-1.5 w-full" :style="{ backgroundColor: act.color || '#1E2157' }" />
                <div class="p-4 flex flex-col gap-2">
                  <div v-if="!act.image_url" class="flex items-start justify-between">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      :style="{ backgroundColor: (act.color || '#1E2157') + '20' }">
                      <i class="pi pi-tag text-sm" :style="{ color: act.color || '#1E2157' }" />
                    </div>
                    <div v-if="booking.activityId === act.id"
                      class="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      :style="{ backgroundColor: act.color || '#1E2157' }">
                      <i class="pi pi-check text-white text-xs" />
                    </div>
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-gray-900">{{ act.name }}</p>
                    <p v-if="act.description" class="text-xs text-gray-400 mt-0.5 line-clamp-2">{{ act.description }}</p>
                  </div>
                </div>
              </div>

              <div
                class="bg-white rounded-xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-md"
                :class="activityChosen && !booking.activityId ? 'border-gray-400 shadow-sm' : 'border-gray-200 border-dashed hover:border-gray-300'"
                @click="selectActivity(null)">
                <div class="h-1.5 w-full bg-gray-200" />
                <div class="p-4 flex flex-col gap-2">
                  <div class="flex items-start justify-between">
                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <i class="pi pi-minus text-gray-400 text-sm" />
                    </div>
                    <div v-if="activityChosen && !booking.activityId"
                      class="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center shrink-0">
                      <i class="pi pi-check text-white text-xs" />
                    </div>
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-gray-700">No specific activity</p>
                    <p class="text-xs text-gray-400 mt-0.5">Book a resource without an activity type</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <Button label="Next" icon="pi pi-arrow-right" icon-pos="right"
                :disabled="activities.length > 0 && !activityChosen"
                @click="afterActivity"
                style="background:#1E2157; border-color:#1E2157" />
            </div>
          </div>

          <!-- ── STEP 1: Mode ── -->
          <div v-if="step === 1" class="space-y-5">
            <div>
              <h2 class="text-xl font-bold text-gray-900 tracking-tight">Choose a {{ modeLabel.toLowerCase() }}</h2>
              <p class="text-sm text-gray-500 mt-1">
                <template v-if="booking.activity">Pick how you'd like to use <span class="font-medium text-gray-700">{{ booking.activity.name }}</span>.</template>
                <template v-else>Pick an option below to continue.</template>
              </p>
            </div>

            <div v-if="!availableModes.length" class="py-10 text-center">
              <i class="pi pi-sliders-h text-3xl text-gray-300 mb-3 block" />
              <p class="text-sm text-gray-500">No {{ modeLabel.toLowerCase() }}s configured. Proceeding to resource selection.</p>
            </div>

            <!-- GRID layout — image on top, generous padding below. -->
            <div v-else-if="modeDisplay === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button v-for="mode in availableModes" :key="mode.id" type="button"
                class="group relative text-left bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
                :class="booking.activityModeId === mode.id ? 'shadow-md ring-2 ring-offset-2' : 'border-gray-100 hover:border-gray-200'"
                :style="booking.activityModeId === mode.id
                  ? `border-color: ${mode.color || '#1E2157'}; --tw-ring-color: ${mode.color || '#1E2157'}33`
                  : ''"
                @click="selectMode(mode)">
                <div v-if="mode.image_url" class="relative aspect-[4/3] overflow-hidden bg-gray-100">
                  <img :src="mode.image_url" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
                <div v-else class="aspect-[4/3] flex items-center justify-center"
                  :style="{ background: `linear-gradient(135deg, ${(mode.color || '#6366f1')}1A 0%, ${(mode.color || '#6366f1')}33 100%)` }">
                  <i class="pi pi-sliders-h text-3xl" :style="{ color: mode.color || '#6366f1' }" />
                </div>
                <div class="p-4">
                  <div class="flex items-start gap-2">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-gray-900">{{ mode.name }}</p>
                      <p v-if="mode.description" class="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-line">{{ mode.description }}</p>
                    </div>
                    <div v-if="booking.activityModeId === mode.id"
                      class="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      :style="{ backgroundColor: mode.color || '#1E2157' }">
                      <i class="pi pi-check text-white text-[10px]" />
                    </div>
                  </div>
                </div>
              </button>

              <button v-if="!booking.activity?.require_mode" type="button"
                class="text-left bg-white rounded-xl border-2 border-dashed overflow-hidden transition-all hover:shadow-sm hover:-translate-y-0.5"
                :class="modeChosen && !booking.activityModeId ? 'border-gray-500 shadow-sm' : 'border-gray-200 hover:border-gray-300'"
                @click="selectMode(null)">
                <div class="aspect-[4/3] flex items-center justify-center bg-gray-50">
                  <i class="pi pi-minus text-2xl text-gray-300" />
                </div>
                <div class="p-4">
                  <div class="flex items-start gap-2">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-gray-700">No specific {{ modeLabel.toLowerCase() }}</p>
                      <p class="text-xs text-gray-400 mt-1">Show all available resources</p>
                    </div>
                    <div v-if="modeChosen && !booking.activityModeId"
                      class="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center shrink-0">
                      <i class="pi pi-check text-white text-[10px]" />
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <!-- LIST layout — image on the left at sm+ breakpoints; on
                 mobile the card stacks with the image on top and the
                 text below so the image isn't squashed into a thumbnail. -->
            <div v-else class="space-y-2">
              <button v-for="mode in availableModes" :key="mode.id" type="button"
                class="group w-full flex flex-col sm:flex-row sm:items-stretch text-left bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
                :class="booking.activityModeId === mode.id ? 'shadow-md ring-2 ring-offset-1' : 'border-gray-100 hover:border-gray-200'"
                :style="booking.activityModeId === mode.id
                  ? `border-color: ${mode.color || '#1E2157'}; --tw-ring-color: ${mode.color || '#1E2157'}33`
                  : ''"
                @click="selectMode(mode)">
                <div v-if="mode.image_url" class="w-full sm:w-64 h-[200px] shrink-0 relative overflow-hidden bg-gray-100">
                  <img :src="mode.image_url" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div v-else class="w-full sm:w-64 h-[200px] shrink-0 flex items-center justify-center"
                  :style="{ background: `linear-gradient(135deg, ${(mode.color || '#6366f1')}1A 0%, ${(mode.color || '#6366f1')}33 100%)` }">
                  <i class="pi pi-sliders-h text-3xl" :style="{ color: mode.color || '#6366f1' }" />
                </div>
                <div class="flex-1 min-w-0 p-4 sm:p-5 flex items-start gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-base font-bold text-gray-900">{{ mode.name }}</p>
                    <p v-if="mode.description" class="text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-line">{{ mode.description }}</p>
                  </div>
                  <div v-if="booking.activityModeId === mode.id"
                    class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
                    :style="{ backgroundColor: mode.color || '#1E2157' }">
                    <i class="pi pi-check text-white text-[10px]" />
                  </div>
                </div>
              </button>

              <button v-if="!booking.activity?.require_mode" type="button"
                class="w-full flex flex-col sm:flex-row sm:items-stretch text-left bg-white rounded-xl border-2 border-dashed overflow-hidden transition-all hover:shadow-sm"
                :class="modeChosen && !booking.activityModeId ? 'border-gray-500 shadow-sm' : 'border-gray-200 hover:border-gray-300'"
                @click="selectMode(null)">
                <div class="w-full sm:w-64 h-[200px] shrink-0 flex items-center justify-center bg-gray-50">
                  <i class="pi pi-minus text-3xl text-gray-300" />
                </div>
                <div class="flex-1 min-w-0 p-4 sm:p-5 flex items-start gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-base font-bold text-gray-700">No specific {{ modeLabel.toLowerCase() }}</p>
                    <p class="text-sm text-gray-400 mt-1">Show all available resources</p>
                  </div>
                  <div v-if="modeChosen && !booking.activityModeId"
                    class="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center shrink-0 mt-1">
                    <i class="pi pi-check text-white text-[10px]" />
                  </div>
                </div>
              </button>
            </div>

            <div class="flex justify-between pt-2">
              <Button v-if="!props.activityId || props.showBackToPicker"
                label="Back" severity="secondary" outlined icon="pi pi-arrow-left"
                @click="props.activityId ? emit('back') : step = 0" />
              <span v-else />
              <Button label="Next" icon="pi pi-arrow-right" icon-pos="right"
                :disabled="availableModes.length > 0 && (!modeChosen || (booking.activity?.require_mode && !booking.activityModeId))"
                @click="proceedToResource"
                style="background:#1E2157; border-color:#1E2157" />
            </div>
          </div>

          <!-- ── STEP 2: Resource ── -->
          <div v-if="step === 2" class="space-y-5">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">What do you want to book?</h2>
              <p class="text-sm text-gray-500 mt-1">
                <template v-if="booking.activity && booking.modeName">Showing resources for <span class="font-medium text-gray-700">{{ booking.activity.name }}</span> · <span class="font-medium text-gray-700">{{ booking.modeName }}</span>.</template>
                <template v-else-if="booking.activity">Showing resources for <span class="font-medium text-gray-700">{{ booking.activity.name }}</span>.</template>
                <template v-else>Select a venue, item, or person.</template>
              </p>
            </div>

            <div v-if="loadingBookables" class="py-12 flex justify-center">
              <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
            </div>

            <div v-else-if="!filteredBookables.length" class="py-12 text-center text-gray-400">
              <i class="pi pi-building text-3xl mb-3 block" />
              <p class="text-sm">No resources available.</p>
              <p v-if="!staff" class="text-xs mt-2 max-w-sm mx-auto">
                If this activity has venues linked, make sure each one has
                <span class="font-semibold text-gray-500">Public</span> turned on
                in its settings — only public venues show on the public booking page.
              </p>
            </div>

            <!-- Staff: collapsible accordion when items have categories -->
            <div v-else-if="staff && hasCategorizedItems" class="space-y-3">
              <!-- Non-item bookables in flat grid above the accordions -->
              <div v-if="filteredBookables.filter(b => b.type !== 'ITEM').length"
                class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div v-for="item in filteredBookables.filter(b => b.type !== 'ITEM')" :key="item.id"
                  class="bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm"
                  :class="booking.bookableId === item.id ? 'border-[#1E2157] shadow-sm' : 'border-gray-200 hover:border-gray-300'"
                  @click="selectBookable(item)">
                  <div class="flex items-start justify-between mb-3">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                      :class="item.type === 'VENUE' ? 'bg-[#EFF6FF]' : 'bg-green-50'">
                      <i class="pi text-base"
                        :class="item.type === 'VENUE' ? 'pi-building text-[#1E2157]' : 'pi-user text-green-600'" />
                    </div>
                    <div v-if="booking.bookableId === item.id" class="w-5 h-5 rounded-full bg-[#1E2157] flex items-center justify-center">
                      <i class="pi pi-check text-white text-xs" />
                    </div>
                  </div>
                  <p class="text-sm font-semibold text-gray-900">{{ item.name }}</p>
                  <p v-if="item.location" class="text-xs text-gray-400 mt-0.5 truncate">{{ item.location }}</p>
                </div>
              </div>
              <!-- Item categories -->
              <div v-for="group in categorizedItems" :key="group.category ?? '__uncategorized__'"
                class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button class="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  @click="toggleCategory(group.category ?? '__uncategorized__')">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-box text-amber-500 text-sm" />
                    <span class="text-sm font-semibold text-gray-800">{{ group.category ?? 'Other' }}</span>
                    <span class="text-xs text-gray-400 font-normal">({{ group.items.length }})</span>
                  </div>
                  <i class="pi text-gray-400 text-xs"
                    :class="openCategories.has(group.category ?? '__uncategorized__') ? 'pi-chevron-up' : 'pi-chevron-down'" />
                </button>
                <div v-show="openCategories.has(group.category ?? '__uncategorized__')" class="border-t border-gray-100 p-3">
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div v-for="item in group.items" :key="item.id"
                      class="bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm"
                      :class="booking.bookableId === item.id ? 'border-[#1E2157] shadow-sm' : 'border-gray-200 hover:border-gray-300'"
                      @click="selectBookable(item)">
                      <div class="flex items-start justify-between mb-3">
                        <div class="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                          <i class="pi pi-box text-amber-600 text-base" />
                        </div>
                        <div v-if="booking.bookableId === item.id" class="w-5 h-5 rounded-full bg-[#1E2157] flex items-center justify-center">
                          <i class="pi pi-check text-white text-xs" />
                        </div>
                      </div>
                      <p class="text-sm font-semibold text-gray-900">{{ item.name }}</p>
                      <p v-if="item.location" class="text-xs text-gray-400 mt-0.5 truncate">{{ item.location }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Default: flat grid for all bookables -->
            <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div v-for="item in filteredBookables" :key="item.id"
                class="bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm"
                :class="booking.bookableId === item.id ? 'border-[#1E2157] shadow-sm' : 'border-gray-200 hover:border-gray-300'"
                @click="selectBookable(item)">
                <div class="flex items-start justify-between mb-3">
                  <div class="w-10 h-10 rounded-lg flex items-center justify-center"
                    :class="item.type === 'VENUE' ? 'bg-[#EFF6FF]' : item.type === 'ITEM' ? 'bg-amber-50' : 'bg-green-50'">
                    <i class="pi text-base"
                      :class="item.type === 'VENUE' ? 'pi-building text-[#1E2157]' : item.type === 'ITEM' ? 'pi-box text-amber-600' : 'pi-user text-green-600'" />
                  </div>
                  <div v-if="booking.bookableId === item.id" class="w-5 h-5 rounded-full bg-[#1E2157] flex items-center justify-center">
                    <i class="pi pi-check text-white text-xs" />
                  </div>
                </div>
                <p class="text-sm font-semibold text-gray-900">{{ item.name }}</p>
                <p v-if="item.location" class="text-xs text-gray-400 mt-0.5 truncate">{{ item.location }}</p>
              </div>
            </div>

            <div class="flex justify-between pt-2">
              <Button v-if="showResourceBack" label="Back" severity="secondary" outlined icon="pi pi-arrow-left"
                @click="onResourceBack" />
              <span v-else />
              <Button label="Next" icon="pi pi-arrow-right" icon-pos="right"
                :disabled="!booking.bookableId" @click="step = 3"
                style="background:#1E2157; border-color:#1E2157" />
            </div>
          </div>

          <!-- ── STEP 3: Date & time ── -->
          <div v-if="step === 3" class="space-y-5">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">When do you need it?</h2>
              <p class="text-sm text-gray-500 mt-1">Choose a date and time from the calendar below.</p>
            </div>

            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-500">{{ pageCalTitle }}</span>
                <div class="flex items-center gap-0.5">
                  <button type="button"
                    :disabled="pageNavPrevDisabled"
                    class="w-7 h-7 flex items-center justify-center rounded text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    :class="pageNavPrevDisabled ? '' : 'hover:bg-gray-100'"
                    @click="pageNavPrev">
                    <i class="pi pi-chevron-left text-xs" />
                  </button>
                  <button type="button"
                    class="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
                    @click="pageNavNext">
                    <i class="pi pi-chevron-right text-xs" />
                  </button>
                </div>
              </div>
              <div class="rounded-xl overflow-hidden border border-gray-200 bg-white" style="height:480px">
                <BookingsCalendar
                  :bookable-id="booking.bookableId"
                  :cal-date="pageCalDate"
                  :cal-view="pageCalView"
                  :refresh-key="pageCalKey"
                  :mode-id="calendarModeId"
                  :activity-mode-id="booking.activityModeId"
                  :bookable-modes="currentBookableModes"
                  :activity-modes="allActivityModes"
                  :wizard-mode="true"
                  @slot-click="onPageSlotClick"
                />
              </div>
              <div v-if="booking.startAt && booking.endAt"
                class="flex items-center gap-2 text-sm text-[#1E2157] font-medium bg-blue-50 rounded-lg px-4 py-3">
                <i class="pi pi-check-circle" />
                {{ formatReviewDate }}
              </div>
              <p v-else class="text-xs text-gray-400">
                {{ pageCalView === 'list' ? 'Click an availability slot to select it' : 'Click the calendar to set the booking time' }}
              </p>
            </div>

            <div class="flex justify-between pt-2">
              <Button v-if="showDatetimeBack" label="Back" severity="secondary" outlined icon="pi pi-arrow-left"
                @click="onDatetimeBack" />
              <span v-else />
              <Button icon="pi pi-arrow-right" icon-pos="right"
                :label="hasAddons ? 'Next: Add-ons' : 'Next: Details'"
                :disabled="!booking.startAt || !booking.endAt"
                @click="hasAddons ? step = 4 : step = 5"
                style="background:#1E2157; border-color:#1E2157" />
            </div>
          </div>

          <!-- ── STEP 4: Add-ons ── -->
          <div v-if="step === 4" class="space-y-5">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Any add-ons?</h2>
              <p class="text-sm text-gray-500 mt-1">Optional extras you can add to your booking.</p>
            </div>

            <div class="space-y-3">
              <div v-for="addon in selectedModeAddons" :key="addon.id"
                class="bg-white rounded-xl border-2 p-4 cursor-pointer transition-all"
                :class="isAddonSelected(addon.id) ? 'border-[#1E2157] shadow-sm' : 'border-gray-200 hover:border-gray-300'"
                @click="toggleAddon(addon)">
                <div class="flex items-start gap-4">
                  <!-- Checkbox -->
                  <div class="mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                    :class="isAddonSelected(addon.id) ? 'bg-[#1E2157] border-[#1E2157]' : 'border-gray-300'">
                    <i v-if="isAddonSelected(addon.id)" class="pi pi-check text-white text-xs" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p class="text-sm font-semibold text-gray-900">{{ addon.name }}</p>
                      <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        :class="addonTypeStyle(addon.type).class">
                        {{ addonTypeStyle(addon.type).label }}
                      </span>
                    </div>
                    <p v-if="addon.description" class="text-xs text-gray-400 mb-1.5">{{ addon.description }}</p>
                    <p v-if="!addon.tiers?.length" class="text-sm font-semibold text-gray-700">
                      ${{ addonTotal(addon) }}<span v-if="addonTypeSuffix(addon.type)" class="text-xs font-normal text-gray-400"> {{ addonTypeSuffix(addon.type) }}</span>
                    </p>
                    <div v-else class="text-xs text-gray-600 mt-0.5 space-y-0.5">
                      <p v-for="(t, ti) in addon.tiers" :key="ti">
                        <span class="font-medium text-gray-800">{{ tierRangeLabel(addon.tiers, ti) }}</span>
                        <span class="text-gray-400"> · </span>
                        ${{ t.unit_price.toFixed(2) }} {{ addonTypeSuffix(addon.type) }}
                      </p>
                    </div>
                  </div>
                  <!-- Qty input for equipment only; per-person uses attendee count from Details -->
                  <div v-if="isAddonSelected(addon.id) && addon.type === 'item'"
                    class="flex flex-col items-end gap-1 shrink-0" @click.stop>
                    <label class="text-xs text-gray-400">Qty</label>
                    <input type="number" min="1"
                      :value="getAddonQty(addon.id)"
                      class="w-16 h-8 rounded-lg border border-gray-200 px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      @input="setAddonQty(addon.id, parseInt(($event.target as HTMLInputElement).value) || 1)" />
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-between pt-2">
              <Button label="Back" severity="secondary" outlined icon="pi pi-arrow-left" @click="step = 3" />
              <Button label="Next: Details" icon="pi pi-arrow-right" icon-pos="right"
                @click="step = 5" style="background:#1E2157; border-color:#1E2157" />
            </div>
          </div>

          <!-- ── STEP 5: Details ── -->
          <div v-if="step === 5" class="space-y-5">
            <!-- Auth panel: shown until the user picks a path. Same
                 reusable chooser used by ItemBooker / BookingScheduler so
                 every booking flow has one consistent registration entry
                 point (member pick / guest / OTP / password / app). -->
            <div v-if="detailsPanel === 'auth'" class="bg-white rounded-xl border border-gray-200 p-5">
              <BookingAuthChooser ref="authChooserRef"
                :org-id="orgId"
                :staff="staff"
                :can-go-back="true"
                :guest-label="staff ? 'Type member details' : 'Continue as guest'"
                :guest-description="staff ? 'Fill in the member\'s name and email.' : 'Just fill in a quick form.'"
                title="How would you like to book?"
                subtitle="Sign in for faster checkout, or carry on as a guest."
                @back="step = hasAddons ? 4 : 3"
                @select-guest="detailsPanel = 'form'"
                @signed-in="onWizardSignedIn" />
            </div>

            <template v-else>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="text-lg font-semibold text-gray-900">Your details</h2>
                  <p class="text-sm text-gray-500 mt-1">We'll use these to confirm your booking.</p>
                </div>
                <button type="button"
                  class="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                  @click="backToWizardAuth">
                  Change
                </button>
              </div>

              <div v-if="signedInEmail"
                class="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 flex items-center gap-2">
                <i class="pi pi-check-circle text-emerald-600 text-sm" />
                <p class="text-xs text-emerald-700">Signed in as <span class="font-semibold">{{ signedInEmail }}</span></p>
              </div>

              <!-- Staff: link to event -->
              <div v-if="staff" class="bg-white rounded-xl border border-gray-200 p-5">
                <label class="text-sm font-semibold text-gray-700 block mb-1.5">
                  Link to event <span class="text-gray-400 font-normal">(optional)</span>
                </label>
                <Select v-model="booking.eventId" :options="events" option-label="title" option-value="id"
                  placeholder="Select an event…" filter show-clear class="w-full" />
              </div>

              <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <!-- Form rendering is owned by the shared <BookingFormFields>
                   component so wizard / scheduler / item bookings all use
                   the same code path. We mirror its emitted answers into
                   our local formAnswers so the rest of the wizard logic
                   (financial rules, per-person fees, validation) still
                   works against a flat id-keyed map. -->
              <BookingFormFields
                :form-id="effectiveFormId"
                :org-fields-org-id="staffOrgId"
                :prefill="formPrefill"
                :hide-cores="hiddenFormCores"
                @change="onFormFieldsChange" />

              <!-- Visitors: contextual to mode, not part of the form -->
              <div v-if="modeAllowsVisitors" class="flex flex-col gap-1.5 pt-3 border-t border-gray-100">
                <label class="text-sm font-medium text-gray-700">Visitors <span class="text-gray-400 font-normal">(optional)</span></label>
                <input v-model.number="booking.visitorCount" type="number"
                  :min="currentActivityMode?.min_visitors ?? 0"
                  :max="currentActivityMode?.max_visitors ?? undefined"
                  placeholder="e.g. 5"
                  class="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />
                <p v-if="currentActivityMode?.max_visitors" class="text-xs text-gray-400">Up to {{ currentActivityMode.max_visitors }} visitors</p>
              </div>
            </div>

            <!-- Equipment: required items the mode bundles (locked) +
                 optional items the mode lets customers add (editable).
                 Both lists are mode-scoped — the org's whole item
                 catalogue is intentionally NOT exposed here so a
                 customer can't add a Lawn Mower to their birthday. -->
            <div v-if="requiredItemsForCurrentMode.length || optionalItemsForCurrentMode.length"
              class="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div>
                <p class="text-sm font-semibold text-gray-700">Equipment</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  <span v-if="requiredItemsForCurrentMode.length && optionalItemsForCurrentMode.length">Locked rows are bundled with this booking; the rest is optional.</span>
                  <span v-else-if="requiredItemsForCurrentMode.length">Bundled with this booking.</span>
                  <span v-else>Optional extras you can add.</span>
                </p>
              </div>

              <!-- Required (locked) -->
              <div v-if="requiredItemsForCurrentMode.length"
                class="rounded-lg bg-emerald-50/40 border border-emerald-100 px-3 py-2 divide-y divide-emerald-100/50">
                <div v-for="r in requiredItemsForCurrentMode" :key="`req-${r.bookable_id}`"
                  class="flex items-center gap-3 py-2">
                  <i class="pi pi-lock text-emerald-600 text-xs shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ r.item?.name ?? 'Item' }}</p>
                    <p class="text-[11px] text-emerald-700">
                      <span v-if="r.price_override != null">${{ (r.price_override * r.quantity).toFixed(2) }}</span>
                      <span v-else>Included with this booking</span>
                    </p>
                  </div>
                  <span class="text-sm font-semibold text-gray-700 tabular-nums">× {{ r.quantity }}</span>
                </div>
              </div>

              <!-- Optional (mode-scoped, editable) -->
              <div v-if="optionalItemsForCurrentMode.length" class="divide-y divide-gray-100">
                <div v-for="opt in optionalItemsForCurrentMode" :key="`opt-${opt.bookable_id}`"
                  class="flex items-center gap-3 py-2.5">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">{{ opt.item?.name }}</p>
                    <p class="text-[11px] text-gray-400">
                      <span v-if="opt.price_override != null">${{ opt.price_override }} each</span>
                      <span v-else>Free</span>
                      <span v-if="opt.item?.max_concurrent"> · {{ opt.item.max_concurrent }} available</span>
                    </p>
                  </div>
                  <InputNumber :model-value="selectedItems[opt.bookable_id] ?? 0"
                    :min="0"
                    :max="opt.item?.max_concurrent ?? 999"
                    show-buttons button-layout="horizontal"
                    decrement-button-class="!h-8 !w-8" increment-button-class="!h-8 !w-8"
                    input-class="!h-8 !w-12 !text-center !text-sm !font-semibold"
                    @update:model-value="v => selectedItems[opt.bookable_id] = v ?? 0" />
                </div>
              </div>
            </div>

            <!-- Terms & Conditions (from the form builder) -->
            <div v-if="modeFormTerms.length" class="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Terms &amp; Conditions</p>
              <label v-for="(t, i) in modeFormTerms" :key="i"
                class="flex items-start gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors"
                :class="termsAgreed[i] ? 'border-[#1E2157] bg-[#EFF6FF]/40' : 'border-gray-200 hover:bg-gray-50'">
                <input type="checkbox" class="mt-1 w-4 h-4 rounded border-gray-300 accent-[#1E2157]"
                  :checked="!!termsAgreed[i]"
                  @change="termsAgreed[i] = ($event.target as HTMLInputElement).checked" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-800">
                    {{ t.label || 'Terms' }}
                    <span v-if="t.required" class="text-red-400 ml-0.5">*</span>
                  </p>
                  <p v-if="t.agreeText" class="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-line">{{ t.agreeText }}</p>
                </div>
              </label>
            </div>

            <div class="flex justify-between pt-2">
              <Button label="Back" severity="secondary" outlined icon="pi pi-arrow-left"
                @click="hasAddons ? step = 4 : step = 3" />
              <Button label="Review booking" icon="pi pi-arrow-right" icon-pos="right"
                :disabled="!booking.contactName.trim() || !booking.contactEmail.trim() || (hasPerPersonFees && !booking.attendeeCount) || formAnswersIncomplete"
                @click="step = 6" style="background:#1E2157; border-color:#1E2157" />
            </div>
            </template>
          </div>

          <!-- ── STEP 6: Review ── -->
          <div v-if="step === 6" class="space-y-5">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Review your booking</h2>
              <p class="text-sm text-gray-500 mt-1">Check everything looks right before confirming.</p>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div v-if="booking.activity" class="flex items-center gap-4 px-5 py-4">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  :style="{ backgroundColor: (booking.activity.color || '#1E2157') + '20' }">
                  <i class="pi pi-tag text-base" :style="{ color: booking.activity.color || '#1E2157' }" />
                </div>
                <div class="flex-1">
                  <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Activity</p>
                  <p class="text-sm font-semibold text-gray-900">{{ booking.activity.name }}</p>
                </div>
                <button class="text-xs text-[#1E2157] underline" @click="step = 0">Change</button>
              </div>
              <div v-if="booking.modeName" class="flex items-center gap-4 px-5 py-4">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  :style="{ backgroundColor: (booking.modeColor || '#6366f1') + '20' }">
                  <i class="pi pi-sliders-h text-base" :style="{ color: booking.modeColor || '#6366f1' }" />
                </div>
                <div class="flex-1">
                  <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">{{ modeLabel }}</p>
                  <p class="text-sm font-semibold text-gray-900">{{ booking.modeName }}</p>
                </div>
                <button v-if="!skipModeStep" class="text-xs text-[#1E2157] underline" @click="step = 1">Change</button>
              </div>
              <div class="flex items-center gap-4 px-5 py-4">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  :class="booking.bookable?.type === 'VENUE' ? 'bg-[#EFF6FF]' : booking.bookable?.type === 'ITEM' ? 'bg-amber-50' : 'bg-green-50'">
                  <i class="pi text-base"
                    :class="booking.bookable?.type === 'VENUE' ? 'pi-building text-[#1E2157]' : booking.bookable?.type === 'ITEM' ? 'pi-box text-amber-600' : 'pi-user text-green-600'" />
                </div>
                <div class="flex-1">
                  <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Resource</p>
                  <p class="text-sm font-semibold text-gray-900">{{ booking.bookable?.name }}</p>
                  <p v-if="booking.bookable?.location" class="text-xs text-gray-400">{{ booking.bookable.location }}</p>
                </div>
                <button v-if="!skipResourceStep" class="text-xs text-[#1E2157] underline" @click="step = 2">Change</button>
              </div>
              <div class="flex items-center gap-4 px-5 py-4">
                <div class="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                  <i class="pi pi-calendar text-purple-600 text-base" />
                </div>
                <div class="flex-1">
                  <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Date & time</p>
                  <p class="text-sm font-semibold text-gray-900">{{ formatReviewDate }}</p>
                </div>
                <button class="text-xs text-[#1E2157] underline" @click="step = 3">Change</button>
              </div>
              <div v-if="hasAddons" class="flex items-start gap-4 px-5 py-4">
                <div class="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <i class="pi pi-plus-circle text-indigo-500 text-base" />
                </div>
                <div class="flex-1">
                  <p class="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Add-ons</p>
                  <div v-if="booking.selectedAddons.length" class="space-y-0.5">
                    <p v-for="a in booking.selectedAddons" :key="a.id" class="text-sm font-semibold text-gray-900">
                      {{ a.name }}<span v-if="a.qty > 1" class="font-normal text-gray-500"> × {{ a.qty }}</span>
                      <span class="font-normal text-gray-500"> — ${{ (addonTotal(a) * a.qty).toFixed(2) }}</span>
                    </p>
                  </div>
                  <p v-else class="text-sm text-gray-400 italic">None selected</p>
                </div>
                <button class="text-xs text-[#1E2157] underline" @click="step = 4">Change</button>
              </div>
              <div v-if="hasPerPersonFees" class="flex items-center gap-4 px-5 py-4">
                <div class="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
                  <i class="pi pi-users text-pink-500 text-base" />
                </div>
                <div class="flex-1">
                  <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Attendees</p>
                  <p class="text-sm font-semibold text-gray-900">{{ booking.attendeeCount }} people</p>
                </div>
                <button class="text-xs text-[#1E2157] underline" @click="step = 5">Change</button>
              </div>
              <div class="flex items-center gap-4 px-5 py-4">
                <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <i class="pi pi-user text-gray-500 text-base" />
                </div>
                <div class="flex-1">
                  <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Contact</p>
                  <p class="text-sm font-semibold text-gray-900">{{ booking.contactName }}</p>
                  <p class="text-xs text-gray-400">{{ booking.contactEmail }}</p>
                </div>
                <button class="text-xs text-[#1E2157] underline" @click="step = 5">Change</button>
              </div>
            </div>

            <!-- Invoice -->
            <div v-if="invoiceLines.length" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div class="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estimated charges</p>
                <p v-if="bookingDurationHours" class="text-xs text-gray-400">{{ bookingDurationHours % 1 ? bookingDurationHours.toFixed(1) : bookingDurationHours }}h booking</p>
              </div>
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-100 bg-gray-50/50">
                    <th class="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                    <th class="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">Qty</th>
                    <th class="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Unit price</th>
                    <th class="text-right px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr v-for="(line, i) in invoiceLines" :key="i" class="hover:bg-gray-50/50">
                    <td class="px-5 py-3 text-gray-800 whitespace-pre-line">
                      {{ line.label }}
                      <span v-if="line.unit" class="text-xs text-gray-400 ml-1">({{ line.unit }})</span>
                    </td>
                    <td class="px-5 py-3 text-gray-500 text-right tabular-nums">
                      {{ line.qty % 1 ? line.qty.toFixed(1) : line.qty }}
                    </td>
                    <td class="px-5 py-3 text-gray-500 text-right tabular-nums">${{ line.unitPrice.toFixed(2) }}</td>
                    <td class="px-5 py-3 font-semibold text-gray-900 text-right tabular-nums">${{ line.total.toFixed(2) }}</td>
                  </tr>
                  <tr v-if="matchedDiscount" class="bg-green-50">
                    <td class="px-5 py-3 text-green-800 font-medium">
                      <i class="pi pi-tag text-xs mr-1.5" />
                      {{ matchedDiscount.discount.form_text || matchedDiscount.discount.name }}
                    </td>
                    <td colspan="2" class="px-5 py-3 text-green-700 text-right text-xs">
                      {{ matchedDiscount.discount.modifier_type === 'PERCENT' ? `${matchedDiscount.discount.modifier_value}% off` : 'discount' }}
                    </td>
                    <td class="px-5 py-3 font-semibold text-green-800 text-right tabular-nums">−${{ matchedDiscount.amount.toFixed(2) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="border-t-2 border-gray-200 bg-gray-50">
                    <td colspan="3" class="px-5 py-3 font-semibold text-gray-800">Total</td>
                    <td class="px-5 py-3 text-base font-bold text-gray-900 text-right tabular-nums">${{ invoiceTotal.toFixed(2) }}</td>
                  </tr>
                </tfoot>
              </table>
              <p class="px-5 py-2.5 text-xs text-gray-400 border-t border-gray-100">Charges are estimates and subject to confirmation.</p>
            </div>

            <!-- Payment method (from mode.payment_options) -->
            <div v-if="enabledPaymentMethods.length" class="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">How would you like to pay?</p>
              <label v-for="p in enabledPaymentMethods" :key="p.value"
                class="flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors"
                :class="booking.paymentMethod === p.value ? 'border-[#1E2157] bg-[#EFF6FF]/40' : 'border-gray-200 hover:bg-gray-50'">
                <input type="radio" :value="p.value" v-model="booking.paymentMethod"
                  class="w-4 h-4 accent-[#1E2157]" />
                <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <i :class="`pi ${p.icon} text-sm text-gray-600`" />
                </div>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-gray-800">{{ p.label }}</p>
                  <p class="text-xs text-gray-500">{{ p.description }}</p>
                </div>
              </label>
            </div>

            <div class="flex justify-between pt-2">
              <Button label="Back" severity="secondary" outlined icon="pi pi-arrow-left" @click="step = 5" />
              <Button label="Confirm booking" icon="pi pi-check" :loading="submitting"
                :disabled="enabledPaymentMethods.length > 0 && !booking.paymentMethod"
                @click="handleSubmit" style="background:#1E2157; border-color:#1E2157" />
            </div>
          </div>

        </div>

        <!-- Sticky summary sidebar — hidden on mobile (the Review step
             gives the user the same recap, and a 288px column eats the
             whole viewport on a phone). -->
        <div class="hidden lg:block w-72 shrink-0">
          <div class="sticky top-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Booking summary</p>
            </div>
            <div class="p-4 space-y-4">
              <div>
                <p class="text-xs text-gray-400 mb-1">Activity</p>
                <div v-if="booking.activity" class="flex items-center gap-2">
                  <div class="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    :style="{ backgroundColor: (booking.activity.color || '#1E2157') + '20' }">
                    <i class="pi pi-tag text-xs" :style="{ color: booking.activity.color || '#1E2157' }" />
                  </div>
                  <p class="text-sm font-medium text-gray-900">{{ booking.activity.name }}</p>
                </div>
                <p v-else-if="activityChosen" class="text-sm text-gray-500 italic">No specific activity</p>
                <p v-else class="text-sm text-gray-400 italic">Not selected</p>
              </div>
              <div>
                <p class="text-xs text-gray-400 mb-1">Mode</p>
                <div v-if="booking.modeName" class="flex items-center gap-2">
                  <div class="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    :style="{ backgroundColor: (booking.modeColor || '#6366f1') + '20' }">
                    <i class="pi pi-sliders-h text-xs" :style="{ color: booking.modeColor || '#6366f1' }" />
                  </div>
                  <p class="text-sm font-medium text-gray-900">{{ booking.modeName }}</p>
                </div>
                <p v-else class="text-sm text-gray-400 italic">Not selected</p>
              </div>
              <div>
                <p class="text-xs text-gray-400 mb-1">Resource</p>
                <div v-if="booking.bookable" class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    :class="booking.bookable.type === 'VENUE' ? 'bg-[#EFF6FF]' : booking.bookable.type === 'ITEM' ? 'bg-amber-50' : 'bg-green-50'">
                    <i class="pi text-xs"
                      :class="booking.bookable.type === 'VENUE' ? 'pi-building text-[#1E2157]' : booking.bookable.type === 'ITEM' ? 'pi-box text-amber-600' : 'pi-user text-green-600'" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-900">{{ booking.bookable.name }}</p>
                    <p v-if="booking.bookable.location" class="text-xs text-gray-400 truncate">{{ booking.bookable.location }}</p>
                  </div>
                </div>
                <p v-else class="text-sm text-gray-400 italic">Not selected</p>
              </div>
              <div>
                <p class="text-xs text-gray-400 mb-1">Date & time</p>
                <p class="text-sm font-medium text-gray-900" :class="{ 'italic text-gray-400': !formatReviewDate }">
                  {{ formatReviewDate || 'Not set' }}
                </p>
              </div>
              <div v-if="booking.selectedAddons.length">
                <p class="text-xs text-gray-400 mb-1">Add-ons</p>
                <div class="space-y-0.5">
                  <p v-for="a in booking.selectedAddons" :key="a.id" class="text-sm font-medium text-gray-900">
                    {{ a.name }}<span v-if="a.qty > 1" class="text-gray-400"> × {{ a.qty }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

    </template>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { substituteBookingTokens } from '~/composables/useBookingTokens'

const props = defineProps<{
  staff?: boolean
  /** When set, skip the activity-picker step and pre-select this activity. */
  activityId?: string | null
  /** When set together with `activityId`, also skip the mode-picker step
   *  and pre-select this mode. Used by the booker's "By service" picker
   *  so a customer who clicked "Coach Sarah · 30-min lesson" lands on
   *  Resource without re-picking what they already chose. */
  presetModeId?: string | null
  /** Show a back button on the first visible step that emits `back`.
   *  /book sets this true so the user can return to its activity picker.
   *  Direct embeds (deep-linked ?activityId=...) leave it off. */
  showBackToPicker?: boolean
  /** When the page is rendered inside a host iframe (?embed=1) we fill
   *  the available width edge-to-edge. Outside that, the wizard caps
   *  itself at max-w-6xl and centres so a standalone "Open" page
   *  doesn't look stretched on a wide monitor. */
  embedded?: boolean
}>()
const emit = defineEmits<{
  /** Fired when the user hits Back from the first visible step in the
   *  preset-activity mode — lets the parent (e.g. /book) take them back
   *  to its own activity picker rather than re-show the wizard's. */
  (e: 'back'): void
  /** Fired when the user hits the Cancel link in the wizard header.
   *  Parent decides what to do — /book resets to its activity picker,
   *  staff path can navigate back to a list, etc. */
  (e: 'cancel'): void
}>()

const route = useRoute()
const db = useSupabaseClient()
const { orgId: staffOrgId } = useOrg()
const toast = useToast()

// Public path uses ?org=; staff path uses the logged-in user's org.
const queryOrgId = computed(() => props.staff ? staffOrgId.value : (route.query.org as string | undefined))

const loading = ref(true)
const loadingActivities = ref(true)
const loadingBookables = ref(true)
const submitting = ref(false)
const submitted = ref(false)
const bookedStatus = ref<'CONFIRMED' | 'PENDING' | null>(null)
const bookedId = ref<string | null>(null)

// Short uppercase reference code for the customer to quote.
const bookingReference = computed(() =>
  bookedId.value ? bookedId.value.replace(/-/g, '').slice(0, 8).toUpperCase() : null,
)

// Quick-and-dirty .ics so the booker can drop it into their calendar.
const icsHref = computed(() => {
  if (!booking.startAt || !booking.endAt) return null
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const summary = [booking.activity?.name, booking.modeName].filter(Boolean).join(' — ') || 'Booking'
  const location = booking.bookable?.location || booking.bookable?.name || ''
  const description = bookingReference.value ? `Booking reference: ${bookingReference.value}` : ''
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FriendlyManager//Events//EN',
    'BEGIN:VEVENT',
    `UID:${bookedId.value || crypto.randomUUID()}@friendlymanager`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(booking.startAt)}`,
    `DTEND:${fmt(booking.endAt)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)
})

const activities = ref<any[]>([])
const bookables = ref<any[]>([])
const activityModesByActivity = ref<Record<string, any[]>>({})
const activityBookableIds = ref<Record<string, Set<string>>>({})
const bookableModesByBookable = ref<Record<string, any[]>>({})

const step = ref(0)

// Step strip labels. The 'mode' label is overridden at render time with
// the activity's custom mode_label so a Birthdays activity reads
// "Theme" instead of "Mode" in the step strip.
const ALL_STEPS = [
  { key: 'activity', label: 'Booking' },
  { key: 'mode',     label: 'Mode' },
  { key: 'resource', label: 'Resource' },
  { key: 'datetime', label: 'Date & time' },
  { key: 'addons',   label: 'Add-ons' },
  { key: 'details',  label: 'Details' },
  { key: 'review',   label: 'Review' },
]
function stepLabel(key: string, fallback: string): string {
  if (key === 'mode') return modeLabel.value
  return fallback
}

// Cancel — wipes the in-progress booking and emits to the parent so
// /book can re-show its activity picker (or a staff caller can navigate
// elsewhere). Confirms only when the user has actually picked something
// so a no-progress click doesn't trigger a confirm dialog.
function onCancel() {
  const hasProgress = !!(
    booking.activityId || booking.activityModeId || booking.bookableId ||
    booking.startAt || booking.contactName || booking.contactEmail
  )
  if (hasProgress && !confirm('Cancel this booking? Anything you\'ve filled in will be lost.')) return
  resetFlow()
  emit('cancel')
}

// Compact mobile step strip needs the current step's index inside
// `visibleSteps` (1-based) and its display label. The wizard's `step`
// is an index into the full ALL_STEPS list, so we map it back.
const currentVisibleIndex = computed(() => {
  const i = visibleSteps.value.findIndex(s => stepIndex[s.key] === step.value)
  return i < 0 ? 0 : i
})
const currentStepNumber = computed(() => currentVisibleIndex.value + 1)
const currentStepLabel = computed(() => {
  const s = visibleSteps.value[currentVisibleIndex.value]
  return s ? stepLabel(s.key, s.label) : ''
})

const stepIndex: Record<string, number> = {
  activity: 0, mode: 1, resource: 2, datetime: 3, addons: 4, details: 5, review: 6,
}

const activityChosen = ref(false)
const modeChosen = ref(false)

const booking = reactive<any>({
  activityId: null,
  activity: null,
  activityModeId: null,
  modeName: null,
  modeColor: null,
  bookableId: null,
  bookable: null,
  startAt: null as Date | null,
  endAt: null as Date | null,
  selectedAddons: [] as any[],
  attendeeCount: null as number | null,
  visitorCount: null as number | null,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
  eventId: null as string | null,
  paymentMethod: null as string | null,
})

const PAYMENT_METHOD_META: Record<string, { label: string; icon: string; description: string }> = {
  invoice:      { label: 'Invoice',      icon: 'pi-file',        description: 'Receive an invoice to settle later.' },
  credit_card:  { label: 'Credit Card',  icon: 'pi-credit-card', description: 'Pay online at submission.' },
  payment_plan: { label: 'Payment Plan', icon: 'pi-calendar',    description: 'Spread payments over time.' },
  coupon:       { label: 'Coupon',       icon: 'pi-tag',         description: 'Redeem prepaid coupons.' },
}

// Org-level defaults loaded once per session.
const orgDefaultPayments = ref<Record<string, boolean>>({})
const orgDefaultFormId = ref<string | null>(null)
const PAYMENT_METHOD_KEYS = ['invoice', 'credit_card', 'payment_plan', 'coupon']
const enabledPaymentMethods = computed(() => {
  const modeOpts = currentActivityMode.value?.payment_options ?? {}
  const hasModeOpts = PAYMENT_METHOD_KEYS.some(k => modeOpts[k])
  const opts = hasModeOpts ? modeOpts : orgDefaultPayments.value
  return PAYMENT_METHOD_KEYS
    .filter(k => opts[k])
    .map(k => ({ value: k, ...PAYMENT_METHOD_META[k] }))
})

// Reset payment selection if the mode changes; auto-pick when only one option exists.
watch(() => booking.activityModeId, () => {
  const methods = enabledPaymentMethods.value
  if (methods.length === 1) booking.paymentMethod = methods[0].value
  else if (!methods.some(m => m.value === booking.paymentMethod)) booking.paymentMethod = null
})

// ── Add-ons ───────────────────────────────────────────────────

const selectedModeAddons = computed<any[]>(() => {
  if (!booking.activityModeId || !booking.activityId) return []
  const modes = activityModesByActivity.value[booking.activityId] ?? []
  const mode = modes.find((m: any) => m.id === booking.activityModeId)
  return mode?.addons ?? []
})

const hasAddons = computed(() => selectedModeAddons.value.length > 0)

const selectedMode = computed(() => {
  if (!booking.activityModeId || !booking.activityId) return null
  return (activityModesByActivity.value[booking.activityId] ?? [])
    .find((m: any) => m.id === booking.activityModeId) ?? null
})

const currentActivityMode = computed<any | null>(() => {
  if (!booking.activityModeId) return null
  return allActivityModes.value.find((m: any) => m.id === booking.activityModeId) ?? null
})

const modeRequiresPeople = computed(() => {
  const m = currentActivityMode.value
  if (!m) return false
  return (m.min_people ?? 0) > 0 || m.max_people != null
})

const modeAllowsVisitors = computed(() => !!currentActivityMode.value?.allow_visitors)

// Load mode-specific form fields
const modeFormFields = ref<any[]>([])
const modeFormTerms = ref<{ label: string; agreeText: string; required: boolean }[]>([])
const termsAgreed = reactive<Record<number, boolean>>({})
function termsConsentSnapshot() {
  return modeFormTerms.value.map((t, i) => ({ label: t.label, agreed: !!termsAgreed[i], at: termsAgreed[i] ? new Date().toISOString() : null }))
}
const formAnswers = reactive<Record<string, any>>({})
// Prefill values pushed into <BookingFormFields> when the user signs in
// or otherwise has known contact details. Keyed by the same "core" names
// the form fields use (first_name / last_name / email / phone / …).
const formPrefill = ref<Record<string, string | number | null>>({})

// ── Coach venue requirements + bundled equipment ─────────────────────────
// Mode → list of bookable_ids the system tries to reserve alongside the
// primary booking (e.g. coach + lane). First non-overlapping wins.
const modeResourcesByMode = ref<Record<string, string[]>>({})

// Mode → required items (bookable_id + qty + price_override). Auto-
// reserved on every booking; rendered as locked rows in the Equipment
// section. price_override is per-unit, multiplied by qty in the total.
const modeRequiredItemsByMode = ref<Record<string, { bookable_id: string; quantity: number; price_override: number | null }[]>>({})

// Mode → optional items. Customer picks 0..max; the per-unit price
// from price_override (if any) flows into the total based on the
// customer's chosen quantity, not the configured default qty.
const modeOptionalItemsByMode = ref<Record<string, { bookable_id: string; quantity: number; price_override: number | null }[]>>({})

// Required items for the currently picked mode, with the resolved item
// metadata stitched in so the locked rows can render names + caps.
const requiredItemsForCurrentMode = computed(() => {
  const list = modeRequiredItemsByMode.value[booking.activityModeId ?? ''] ?? []
  return list.map(r => ({
    ...r,
    item: availableItems.value.find(i => i.id === r.bookable_id),
  }))
})

// Optional items for the currently picked mode, with item metadata.
const optionalItemsForCurrentMode = computed(() => {
  const list = modeOptionalItemsByMode.value[booking.activityModeId ?? ''] ?? []
  return list
    .map(r => ({ ...r, item: availableItems.value.find(i => i.id === r.bookable_id) }))
    .filter(r => !!r.item)
})

// At submit time, walk the picked mode's resource list and find the first
// venue that has no overlapping booking in [start, end]. Returns the
// chosen id, null if no resources are required, or the magic
// __NONE_AVAILABLE__ when every option is taken.
async function resolveModeVenue(): Promise<string | null | '__NONE_AVAILABLE__'> {
  const modeId = booking.activityModeId
  if (!modeId) return null
  const candidates = modeResourcesByMode.value[modeId] ?? []
  if (!candidates.length) return null
  const startIso = booking.startAt.toISOString()
  const endIso = booking.endAt.toISOString()
  // Pull every overlapping booking on the candidate venues in one query
  // and resolve locally — cheaper than N queries for a small candidate set.
  const { data } = await (db.from as any)('bookings')
    .select('bookable_id')
    .in('bookable_id', candidates)
    .lt('start_at', endIso)
    .gt('end_at', startIso)
    .neq('status', 'CANCELLED')
  const taken = new Set((data ?? []).map((r: any) => r.bookable_id))
  const free = candidates.find(id => !taken.has(id))
  return free ?? '__NONE_AVAILABLE__'
}

// Sum overlapping booking_items.quantity per item bookable for the
// proposed window. If `(existing + requested) > max_concurrent` for any
// item, return a friendly message; otherwise return null.
async function checkItemAvailability(rows: { id: string; qty: number; item: any }[]): Promise<string | null> {
  const ids = rows.map(r => r.id)
  if (!ids.length) return null
  const startIso = booking.startAt.toISOString()
  const endIso = booking.endAt.toISOString()
  // booking_items isn't time-aware on its own — the time window comes
  // from the parent bookings row. Join via an inner select.
  const { data } = await (db.from as any)('booking_items')
    .select('bookable_id, quantity, booking:bookings!inner(start_at, end_at, status)')
    .in('bookable_id', ids)
  const usedByItem: Record<string, number> = {}
  for (const r of (data ?? []) as any[]) {
    const bk = r.booking
    if (!bk || bk.status === 'CANCELLED') continue
    if (new Date(bk.start_at) >= new Date(endIso)) continue
    if (new Date(bk.end_at) <= new Date(startIso)) continue
    usedByItem[r.bookable_id] = (usedByItem[r.bookable_id] ?? 0) + (r.quantity ?? 0)
  }
  for (const r of rows) {
    const cap = r.item?.max_concurrent ?? null
    if (cap == null) continue // unlimited
    const used = usedByItem[r.id] ?? 0
    if (used + r.qty > cap) {
      const free = Math.max(0, cap - used)
      return `${r.item?.name ?? 'Item'}: only ${free} free for that slot (you asked for ${r.qty}).`
    }
  }
  return null
}

// ITEM bookables available to bundle with this booking (footballs, cones,
// nets…). Loaded once in load(); the picker filters from this list.
const availableItems = ref<{ id: string; name: string; max_concurrent: number | null }[]>([])

// User-picked items: { bookable_id → quantity }. Empty = no equipment
// reserved. Driven by the Equipment section in Step 5.
const selectedItems = reactive<Record<string, number>>({})

// Optional items the customer chose (selectedItems map) merged with the
// mode's required items. Required wins on a tie via Map dedup so we
// don't double-book the same bookable.
const selectedItemRows = computed(() => {
  const merged = new Map<string, { id: string; qty: number; item: any }>()
  for (const [id, qty] of Object.entries(selectedItems)) {
    if (qty > 0) merged.set(id, { id, qty, item: availableItems.value.find(i => i.id === id) })
  }
  for (const r of modeRequiredItemsByMode.value[booking.activityModeId ?? ''] ?? []) {
    const existing = merged.get(r.bookable_id)
    const item = availableItems.value.find(i => i.id === r.bookable_id)
    // If the customer also picked the same item optionally, take the
    // larger of the two quantities — required is a floor, not a cap.
    merged.set(r.bookable_id, {
      id: r.bookable_id,
      qty: Math.max(r.quantity, existing?.qty ?? 0),
      item,
    })
  }
  return Array.from(merged.values())
})

// ── Step-5 auth gate ─────────────────────────────────────────────────────
// The Details step opens with the reusable <BookingAuthChooser>. Once the
// user picks "Continue as guest", signs in via OTP/password, or (staff
// only) picks a member, we flip to the form view and prefill known
// contact fields.
const detailsPanel = ref<'auth' | 'form'>('auth')
const signedInEmail = ref<string | null>(null)
const authChooserRef = ref<{ reset: () => void } | null>(null)

function onWizardSignedIn(payload: { email: string; firstName: string; lastName: string; phone: string | null }) {
  signedInEmail.value = payload.email || null
  formPrefill.value = {
    first_name: payload.firstName ?? '',
    last_name:  payload.lastName  ?? '',
    email:      payload.email     ?? '',
    phone:      payload.phone     ?? '',
  }
  // Mirror to the legacy `booking` object the wizard's submit/review code
  // already reads from. Keeps existing logic untouched.
  if (payload.email)     booking.contactEmail = payload.email
  if (payload.firstName || payload.lastName) {
    booking.contactName = [payload.firstName, payload.lastName].filter(Boolean).join(' ').trim()
  }
  if (payload.phone)     booking.contactPhone = payload.phone
  detailsPanel.value = 'form'
}

function backToWizardAuth() {
  signedInEmail.value = null
  formPrefill.value = {}
  authChooserRef.value?.reset()
  detailsPanel.value = 'auth'
}

// Hide the People Attending field unless the mode actually uses head
// count — either it has min/max_people configured, or the user has
// picked a per-person addon. Anything else and the field is noise.
const hiddenFormCores = computed<string[]>(() => {
  const mode = currentActivityMode.value
  const modeNeedsCount = !!(mode?.min_people || mode?.max_people)
  const addonNeedsCount = (booking.selectedAddons ?? []).some((a: any) =>
    a?.type === 'fee_per_person' && (a.qty ?? 1) > 0,
  )
  return (modeNeedsCount || addonNeedsCount) ? [] : ['attendees']
})

// Keep our local `formAnswers` map in sync with the component's emitted
// answers — downstream code (financial rules, per-person fee logic,
// validation, submit payload) still reads this flat id-keyed object.
function onFormFieldsChange(payload: { answers: Record<string, any> }) {
  // Drop keys that no longer exist in the new payload (form swap), then
  // copy the new ones in.
  for (const k of Object.keys(formAnswers)) {
    if (!(k in payload.answers)) delete formAnswers[k]
  }
  for (const [k, v] of Object.entries(payload.answers)) formAnswers[k] = v
}

const CORE_BY_LABEL: Record<string, string> = {
  'First Name': 'first_name', 'Last Name': 'last_name', 'Email Address': 'email',
  'Phone Number': 'phone', 'People Attending': 'attendees', 'Notes': 'notes',
}

// Pick the form: mode's own form first, otherwise the org-wide default form.
const effectiveFormId = computed(() => currentActivityMode.value?.form_id ?? orgDefaultFormId.value ?? null)

watch(effectiveFormId, async (formId) => {
  modeFormFields.value = []
  modeFormTerms.value = []
  for (const k of Object.keys(termsAgreed)) delete termsAgreed[Number(k)]
  if (!formId) return
  const [{ data: ff }, { data: rf }] = await Promise.all([
    (db.from as any)('form_fields').select('*').eq('form_id', formId).order('sort_order'),
    (db.from as any)('registration_forms').select('config').eq('id', formId).single(),
  ])
  const cfg = (rf?.config as any) ?? {}
  const fieldMeta = cfg.fieldMeta ?? {}
  modeFormFields.value = (ff ?? []).map((f: any) => {
    let opts: string[] = []
    try { opts = JSON.parse(f.options || '[]') } catch { opts = [] }
    const meta = fieldMeta[f.label] ?? {}
    const core = meta.core ?? CORE_BY_LABEL[f.label] ?? null
    return {
      ...f,
      _options: opts,
      _core: core,
      _col_span: meta.col_span ?? 2,
      // Advanced rules — runtime visibility + financial logic in this wizard.
      _has_visibility_conditions: !!meta.has_visibility_conditions,
      _visibility_conditions: meta.visibility_conditions ?? [],
      _has_financial_increase: !!meta.has_financial_increase,
      _financial_rules: meta.financial_rules ?? [],
    }
  })
  modeFormTerms.value = (cfg.terms ?? []).filter((t: any) => t?.label || t?.agreeText)
}, { immediate: true })

// ── Conditional field evaluation ────────────────────────────
// Evaluate a single condition: { field: <label>, operator, value }
function evalCondition(cond: any, valuesByLabel: Record<string, any>): boolean {
  const v = valuesByLabel[cond.field]
  const compare = (cond.value ?? '').toString().toLowerCase()
  const cur = (v == null ? '' : String(v)).toLowerCase()
  switch (cond.operator) {
    case 'Equals':       return cur === compare
    case 'Is Not':       return cur !== compare
    case 'Contains':     return cur.includes(compare)
    case 'Is Empty':     return cur === ''
    case 'Is Not Empty': return cur !== ''
    default:             return true
  }
}
function allConditionsPass(conds: any[], valuesByLabel: Record<string, any>): boolean {
  return (conds ?? []).every(c => evalCondition(c, valuesByLabel))
}

const hasPerPersonFees = computed(() => {
  // Per-person pricing on the mode itself
  const pp = selectedMode.value?.pricing?.per_person
  const modePerPerson = pp
    ? Array.isArray(pp)
      ? pp.length > 0
      : (pp.fees?.length > 0) || (pp.groups?.some((g: any) => g.fees?.length > 0))
    : false
  if (modePerPerson) return true
  // Any selected addon priced per person
  for (const a of booking.selectedAddons ?? []) {
    if (a?.type === 'fee_per_person' && (a.qty ?? 1) > 0) return true
  }
  // Any addon AVAILABLE on the mode that's priced per person — flag so the
  // staff know they'll likely need a head count even before the user picks it.
  for (const a of selectedModeAddons.value) {
    if (a?.type === 'fee_per_person') return true
  }
  return false
})

// Default form: used when the mode doesn't have a custom form_id.
const defaultFormFields = computed(() => [
  { id: '__core_first_name', label: 'First Name',       field_type: 'SHORT_TEXT', is_required: true,                   _core: 'first_name', _col_span: 1, placeholder: 'John' },
  { id: '__core_last_name',  label: 'Last Name',        field_type: 'SHORT_TEXT', is_required: true,                   _core: 'last_name',  _col_span: 1, placeholder: 'Smith' },
  { id: '__core_email',      label: 'Email Address',    field_type: 'SHORT_TEXT', is_required: true,                   _core: 'email',      _col_span: 2, placeholder: 'you@example.com' },
  { id: '__core_phone',      label: 'Phone Number',     field_type: 'SHORT_TEXT', is_required: false,                  _core: 'phone',      _col_span: 2, placeholder: '+61 4xx xxx xxx' },
  { id: '__core_attendees',  label: 'People Attending', field_type: 'NUMBER',     is_required: hasPerPersonFees.value, _core: 'attendees',  _col_span: 1, placeholder: 'e.g. 20', help_text: 'How many people are attending?' },
  { id: '__core_notes',      label: 'Notes',            field_type: 'LONG_TEXT',  is_required: false,                  _core: 'notes',      _col_span: 2, placeholder: 'Any special requirements…' },
])

const effectiveFormFields = computed(() => modeFormFields.value.length ? modeFormFields.value : defaultFormFields.value)

// Map the live formAnswers (keyed by field id) → { label: value } so rules
// can reference fields by name.
const formAnswersByLabel = computed(() => {
  const m: Record<string, any> = {}
  for (const f of effectiveFormFields.value) m[f.label] = formAnswers[f.id]
  return m
})

function isFieldVisible(f: any): boolean {
  if (!f._has_visibility_conditions) return true
  return allConditionsPass(f._visibility_conditions ?? [], formAnswersByLabel.value)
}

// Strip answers belonging to fields that are currently hidden so they don't
// leak into the booking's saved custom_fields blob.
function visibleFormAnswers(): Record<string, any> {
  const out: Record<string, any> = {}
  for (const f of effectiveFormFields.value) {
    if (!isFieldVisible(f)) continue
    if (formAnswers[f.id] != null && formAnswers[f.id] !== '') out[f.id] = formAnswers[f.id]
  }
  return out
}

// When a field is hidden mid-flow, scrub its answer so it doesn't leak into
// the submitted custom_fields blob.
watch(formAnswersByLabel, () => {
  for (const f of effectiveFormFields.value) {
    if (!f._has_visibility_conditions) continue
    if (!isFieldVisible(f)) formAnswers[f.id] = ''
  }
}, { deep: true })

// ── Financial rule evaluation ───────────────────────────────
// Walks every form field's financial_rules, returns the line items that
// should be added to the invoice based on current answers.
const financialAdjustments = computed(() => {
  const valuesByLabel = formAnswersByLabel.value
  const out: { label: string; amount: number; type: 'increase' | 'discount' }[] = []
  for (const f of effectiveFormFields.value) {
    if (!f._has_financial_increase) continue
    if (!isFieldVisible(f)) continue
    for (const rule of (f._financial_rules ?? [])) {
      if (!allConditionsPass(rule.conditions ?? [], valuesByLabel)) continue
      const amt = Number(rule.amount) || 0
      if (!amt) continue
      out.push({
        label: rule.fee_name || `${f.label} ${rule.fee_type === 'discount' ? 'discount' : 'fee'}`,
        amount: amt,
        type: rule.fee_type === 'discount' ? 'discount' : 'increase',
      })
    }
  }
  return out
})

// (hasPerPersonFees, defaultFormFields, effectiveFormFields moved earlier
// in setup so the conditional-field/financial-rule computeds + watches that
// reference effectiveFormFields don't hit a temporal dead zone.)

const coreFieldIds = computed(() => {
  const m: Record<string, string> = {}
  for (const f of effectiveFormFields.value) if (f._core) m[f._core] = f.id
  return m
})

// Sync form answers → booking.* core fields. Runs whether the form is the
// default core-fields form or a custom mode form — both go through the same path.
watch([formAnswers, coreFieldIds], () => {
  const ids = coreFieldIds.value
  const fn = (formAnswers[ids.first_name] ?? '').toString().trim()
  const ln = (formAnswers[ids.last_name] ?? '').toString().trim()
  booking.contactName = [fn, ln].filter(Boolean).join(' ')
  booking.contactEmail = (formAnswers[ids.email] ?? '').toString()
  booking.contactPhone = (formAnswers[ids.phone] ?? '').toString()
  const att = formAnswers[ids.attendees]
  booking.attendeeCount = att === '' || att === null || att === undefined ? null : Number(att)
  booking.notes = (formAnswers[ids.notes] ?? '').toString()
}, { deep: true })

const formAnswersIncomplete = computed(() => {
  for (const f of effectiveFormFields.value) {
    if (f.is_required && !formAnswers[f.id]) return true
  }
  if (hasPerPersonFees.value) {
    const v = formAnswers[coreFieldIds.value.attendees]
    if (!v) return true
  }
  for (let i = 0; i < modeFormTerms.value.length; i++) {
    if (modeFormTerms.value[i].required && !termsAgreed[i]) return true
  }
  return false
})

const bookingDurationHours = computed(() => {
  if (!booking.startAt || !booking.endAt) return 0
  return (booking.endAt.getTime() - booking.startAt.getTime()) / 3600000
})

interface InvoiceLine { label: string; qty: number; unit: string; unitPrice: number; total: number }

const invoiceLines = computed<InvoiceLine[]>(() => {
  const lines: InvoiceLine[] = []
  const pricing = selectedMode.value?.pricing
  const hours = bookingDurationHours.value
  const people = booking.attendeeCount || 1
  const tokenCtx = {
    startAt: booking.startAt,
    endAt: booking.endAt,
    date: booking.startAt,
    activityName: booking.activity?.name ?? null,
    modeName: booking.modeName ?? null,
    venueName: booking.bookable?.name ?? null,
    attendeeCount: booking.attendeeCount,
  }
  const render = (name: string, fallback: string) => substituteBookingTokens(name || fallback, tokenCtx)

  if (pricing) {
    for (const f of [...(pricing.base ?? []), ...(pricing.per_booking ?? [])]) {
      if (f.amount) lines.push({ label: render(f.name, 'Booking fee'), qty: 1, unit: 'per booking', unitPrice: f.amount, total: f.amount })
    }
    const ppSection = pricing.per_person
    const ppFees = Array.isArray(ppSection) ? ppSection : (ppSection?.all_equal !== false ? (ppSection?.fees ?? []) : [])
    for (const f of ppFees) {
      if (f.amount) lines.push({ label: render(f.name, 'Per person'), qty: people, unit: 'per person', unitPrice: f.amount, total: f.amount * people })
    }
    const phSection = pricing.per_hour
    const phFees = Array.isArray(phSection) ? phSection : (phSection?.all_equal !== false ? (phSection?.fees ?? []) : [])
    for (const f of phFees) {
      if (f.amount) lines.push({ label: render(f.name, 'Per hour'), qty: hours, unit: 'per hour', unitPrice: f.amount, total: f.amount * hours })
    }
  }

  for (const addon of booking.selectedAddons) {
    const isPerPerson = addon.type === 'fee_per_person'
    const isItem      = addon.type === 'item'
    const isPerHour   = addon.type === 'fee_per_hour'
    const rawQty      = isPerPerson ? (people) : isItem ? (addon.qty || 1) : isPerHour ? hours : 1
    const unit        = ({ fee_per_person: 'per person', fee_per_hour: 'per hour', item: 'per item', fee_per_booking: 'per booking' } as any)[addon.type] ?? ''

    // Tiered pricing only applies to per-person + item add-ons.
    const tiers = (isPerPerson || isItem) ? (addon.tiers as { up_to: number | null; unit_price: number }[] | undefined) : undefined
    if (tiers?.length) {
      let prevUpTo = 0
      for (const tier of tiers) {
        const upTo = tier.up_to == null ? Infinity : tier.up_to
        const tierEnd = Math.min(upTo, rawQty)
        const tierQty = Math.max(0, tierEnd - prevUpTo)
        if (tierQty > 0 && tier.unit_price !== 0) {
          const start = prevUpTo + 1
          const end = upTo === Infinity ? `${start}+` : (start === tierEnd ? `${start}` : `${start}–${tierEnd}`)
          lines.push({
            label: `${addon.name} (${end})`,
            qty: tierQty,
            unit,
            unitPrice: tier.unit_price,
            total: tier.unit_price * tierQty,
          })
        }
        prevUpTo = upTo === Infinity ? rawQty : upTo
        if (rawQty <= prevUpTo) break
      }
    } else {
      // Flat pricing (legacy) — sum of fees as the unit price.
      const unitPrice = addonTotal(addon)
      if (!unitPrice) continue
      lines.push({ label: addon.name, qty: rawQty, unit, unitPrice, total: unitPrice * rawQty })
    }
  }

  // Equipment: required (always) + optional (when picked qty > 0). Each
  // gets its own invoice line so the customer sees the breakdown. The
  // per-unit price comes from activity_mode_required_items.price_override
  // (set on the mode editor); null = free.
  for (const r of selectedItemRows.value) {
    const cfgPrice = priceForItem(r.id, r.qty)
    if (!cfgPrice) continue
    lines.push({
      label: `${r.item?.name ?? 'Item'}${r.qty > 1 ? ` × ${r.qty}` : ''}`,
      qty: r.qty,
      unit: '',
      unitPrice: cfgPrice.unit,
      total: cfgPrice.total,
    })
  }

  // Financial rules from the form's Advanced tab (per-field, condition-driven).
  for (const adj of financialAdjustments.value) {
    const sign = adj.type === 'discount' ? -1 : 1
    lines.push({
      label: adj.label,
      qty: 1,
      unit: '',
      unitPrice: adj.amount * sign,
      total: adj.amount * sign,
    })
  }

  return lines
})

// Look up the configured per-unit price for a given item on the
// currently-picked mode. Returns null when no price was set (free).
function priceForItem(bookableId: string, qty: number): { unit: number; total: number } | null {
  const required = modeRequiredItemsByMode.value[booking.activityModeId ?? ''] ?? []
  const optional = modeOptionalItemsByMode.value[booking.activityModeId ?? ''] ?? []
  const row = required.find(r => r.bookable_id === bookableId)
       ?? optional.find(r => r.bookable_id === bookableId)
  if (!row || row.price_override == null) return null
  return { unit: row.price_override, total: row.price_override * qty }
}

const invoiceSubtotal = computed(() => invoiceLines.value.reduce((s, l) => s + l.total, 0))

const bookingAddonsSplit = computed(() => {
  const addonIds = new Set((booking.selectedAddons ?? []).map((a: any) => a.name))
  let addons = 0
  let core = 0
  for (const l of invoiceLines.value) {
    if (addonIds.has(l.label)) addons += l.total
    else core += l.total
  }
  return { core, addons }
})

const { loadActive: loadActiveDiscounts, bestMatch: bestDiscountMatch } = useBookingDiscounts()
const activeDiscounts = ref<any[]>([])

const matchedDiscount = computed(() => {
  if (!activeDiscounts.value.length || !booking.startAt || !booking.endAt) return null
  const split = bookingAddonsSplit.value
  return bestDiscountMatch(activeDiscounts.value, {
    activityId: booking.activityId,
    activityModeId: booking.activityModeId,
    startAt: booking.startAt,
    endAt: booking.endAt,
    attendeeCount: booking.attendeeCount,
    bookingTotal: split.core,
    addonsTotal: split.addons,
    person: undefined,
  })
})

const invoiceTotal = computed(() => invoiceSubtotal.value - (matchedDiscount.value?.amount ?? 0))

const visibleSteps = computed(() => {
  let steps = hasAddons.value ? ALL_STEPS : ALL_STEPS.filter(s => s.key !== 'addons')
  // When a parent (the /book embed) has already picked an activity, the
  // activity step is meaningless — hide it from the strip.
  if (props.activityId) steps = steps.filter(s => s.key !== 'activity')
  // Same for Mode when there's at most one mode — afterActivity()
  // auto-handles it, so showing a step the user can't interact with
  // would be confusing.
  if (skipModeStep.value) steps = steps.filter(s => s.key !== 'mode')
  // Resource step is auto-skipped by proceedToResource() when there's
  // only one bookable; drop it from the strip too.
  if (skipResourceStep.value) steps = steps.filter(s => s.key !== 'resource')
  return steps
})

function isAddonSelected(id: string) {
  return booking.selectedAddons.some((a: any) => a.id === id)
}

function getAddonQty(id: string) {
  return booking.selectedAddons.find((a: any) => a.id === id)?.qty ?? 1
}

function setAddonQty(id: string, qty: number) {
  booking.selectedAddons = booking.selectedAddons.map((a: any) =>
    a.id === id ? { ...a, qty } : a
  )
}

function toggleAddon(addon: any) {
  if (isAddonSelected(addon.id)) {
    booking.selectedAddons = booking.selectedAddons.filter((a: any) => a.id !== addon.id)
  } else {
    booking.selectedAddons = [...booking.selectedAddons, { ...addon, qty: 1 }]
  }
}

function addonTotal(addon: any): number {
  return (addon.fees ?? []).reduce((s: number, f: any) => s + (f.amount ?? 0), 0)
}

function tierRangeLabel(tiers: { up_to: number | null }[] | undefined, index: number): string {
  if (!tiers) return ''
  const prev = index > 0 ? (tiers[index - 1].up_to ?? 0) : 0
  const start = prev + 1
  const cur = tiers[index].up_to
  if (cur == null) return `${start}+`
  return start === cur ? `${start}` : `${start}–${cur}`
}

const ADDON_TYPE_STYLES: Record<string, { label: string; class: string }> = {
  fee_base:        { label: 'One-off',     class: 'bg-gray-100 text-gray-600' },
  fee_per_booking: { label: 'Per booking', class: 'bg-blue-50 text-blue-600' },
  fee_per_person:  { label: 'Per person',  class: 'bg-purple-50 text-purple-600' },
  fee_per_hour:    { label: 'Per hour',    class: 'bg-amber-50 text-amber-600' },
  item:            { label: 'Equipment',   class: 'bg-emerald-50 text-emerald-600' },
}

function addonTypeStyle(type: string) {
  return ADDON_TYPE_STYLES[type] ?? ADDON_TYPE_STYLES.fee_base
}

function addonTypeSuffix(type: string) {
  return ({ fee_per_person: '/ person', fee_per_hour: '/ hour', item: '/ item' } as any)[type] ?? ''
}

// ── Computed ─────────────────────────────────────────────────

const availableModes = computed(() => {
  if (!booking.activityId) return []
  return activityModesByActivity.value[booking.activityId] ?? []
})

// Per-activity customisation. Each activity decides what to call its
// modes ("Mode" / "Format" / "Theme") and how to lay them out (grid =
// image-on-top tile, list = image-on-left row).
const modeLabel = computed<string>(() => {
  const raw = (booking.activity?.mode_label as string | null | undefined) ?? 'Mode'
  return raw.trim() || 'Mode'
})
const modeDisplay = computed<'grid' | 'list'>(() => {
  return ((booking.activity?.mode_display as string | null | undefined) ?? 'grid') === 'list' ? 'list' : 'grid'
})

const calendarModeId = computed<string | null>(() => {
  if (!booking.bookableId || !booking.modeName) return null
  const modes = bookableModesByBookable.value[booking.bookableId] ?? []
  return modes.find((m: any) => m.name === booking.modeName)?.id ?? null
})

const currentBookableModes = computed(() =>
  bookableModesByBookable.value[booking.bookableId] ?? []
)

const allActivityModes = computed(() =>
  Object.values(activityModesByActivity.value).flat() as any[]
)

const filteredBookables = computed(() => {
  let list = bookables.value
  if (booking.activityId) {
    const ids = activityBookableIds.value[booking.activityId]
    if (ids?.size > 0) list = list.filter(b => ids.has(b.id))
  }
  return list
})

// ── Staff-only: categorized items picker ─────────────────────
const openCategories = ref<Set<string>>(new Set())
function toggleCategory(key: string) {
  const next = new Set(openCategories.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openCategories.value = next
}
const categorizedItems = computed(() => {
  if (!props.staff) return []
  const items = filteredBookables.value.filter(b => b.type === 'ITEM')
  const map = new Map<string, any[]>()
  for (const item of items) {
    const cat = item.item_category ?? ''
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  const named = [...map.entries()].filter(([k]) => k !== '').sort((a, b) => a[0].localeCompare(b[0]))
  const uncategorized = map.get('') ?? []
  return [
    ...named.map(([cat, items]) => ({ category: cat, items })),
    ...(uncategorized.length ? [{ category: null as string | null, items: uncategorized }] : []),
  ]
})
const hasCategorizedItems = computed(() =>
  categorizedItems.value.some(g => g.category !== null),
)
watch(categorizedItems, (groups) => {
  const next = new Set(openCategories.value)
  for (const g of groups) next.add(g.category ?? '__uncategorized__')
  openCategories.value = next
}, { immediate: true })

// ── Staff-only: events to link a booking to ──────────────────
const events = ref<any[]>([])

// ── Calendar ─────────────────────────────────────────────────

const PAGE_VIEW_MAP: Record<string, 'day' | 'week' | 'month' | 'list'> = {
  dayGridMonth: 'month', timeGridWeek: 'week', timeGridDay: 'day', listWeek: 'list',
  month: 'month', week: 'week', day: 'day', list: 'list',
}
const pageCalDate = ref(new Date())
const pageCalKey = ref(0)
const pageCalView = computed((): 'day' | 'week' | 'month' | 'list' => {
  // Mode's setting takes precedence; falls back to the venue's, then 'list'.
  const raw = currentActivityMode.value?.default_booking_view
    ?? booking.bookable?.default_booking_view
    ?? 'list'
  return PAGE_VIEW_MAP[raw] ?? 'list'
})
const pageCalTitle = computed(() => {
  const v = pageCalView.value
  if (v === 'month' || v === 'list')
    return pageCalDate.value.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  if (v === 'week') {
    const dow = (pageCalDate.value.getDay() + 6) % 7
    const mon = new Date(pageCalDate.value); mon.setDate(pageCalDate.value.getDate() - dow)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return `${mon.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return pageCalDate.value.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

// True when the current calendar window is already at (or before) the
// current month/week/day — the booker can't pick anything before today,
// so the back button is disabled when this is true.
const pageNavPrevDisabled = computed(() => {
  const d = pageCalDate.value
  const now = new Date()
  const v = pageCalView.value
  if (v === 'month' || v === 'list') {
    return d.getFullYear() < now.getFullYear() ||
      (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth())
  }
  if (v === 'week') {
    const dow = (d.getDay() + 6) % 7
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return monday.getTime() <= today.getTime()
  }
  return d.getFullYear() < now.getFullYear() ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth()) ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() <= now.getDate())
})

function pageNavPrev() {
  if (pageNavPrevDisabled.value) return
  const d = new Date(pageCalDate.value)
  const v = pageCalView.value
  if (v === 'month' || v === 'list') d.setMonth(d.getMonth() - 1)
  else if (v === 'week') d.setDate(d.getDate() - 7)
  else d.setDate(d.getDate() - 1)
  pageCalDate.value = d
}

function pageNavNext() {
  const d = new Date(pageCalDate.value)
  const v = pageCalView.value
  if (v === 'month' || v === 'list') d.setMonth(d.getMonth() + 1)
  else if (v === 'week') d.setDate(d.getDate() + 7)
  else d.setDate(d.getDate() + 1)
  pageCalDate.value = d
}

function onPageSlotClick(date: Date, endDate?: Date) {
  booking.startAt = date
  booking.endAt = endDate ?? new Date(date.getTime() + 3600000)
  step.value = hasAddons.value ? 4 : 5
}

watch(() => step.value, (s) => {
  if (s === 3) { pageCalDate.value = new Date(); pageCalKey.value++ }
})

// ── Date formatting ──────────────────────────────────────────

function fmtTime(d: Date): string {
  const h = d.getHours(), m = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`
}

const formatReviewDate = computed(() => {
  if (!booking.startAt || !booking.endAt) return ''
  const dateStr = booking.startAt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' })
  return `${dateStr}, ${fmtTime(booking.startAt)} – ${fmtTime(booking.endAt)}`
})

// ── Step logic ───────────────────────────────────────────────

function selectActivity(act: any) {
  booking.activityId = act?.id ?? null
  booking.activity = act ?? null
  activityChosen.value = true
  booking.activityModeId = null
  booking.modeName = null
  booking.modeColor = null
  modeChosen.value = false
  booking.bookableId = null
  booking.bookable = null
  booking.selectedAddons = []
}

// True when there's nothing meaningful for the user to choose at the
// Mode step — either zero modes (skip entirely) or exactly one mode
// (auto-select it). Both cases bypass step 1 in afterActivity().
const skipModeStep = computed(() => availableModes.value.length <= 1)

// Same idea for Resource — proceedToResource() already auto-selects and
// jumps when there's only one bookable. This lets the step strip drop
// the column and lets the Back button chain skip past it.
const skipResourceStep = computed(() => filteredBookables.value.length <= 1)

function afterActivity() {
  if (skipModeStep.value) {
    if (availableModes.value.length === 1) selectMode(availableModes.value[0])
    proceedToResource()
  } else {
    step.value = 1
  }
}

// Back from the Resource step. Normally returns to the Mode step (1).
// When the Mode step was skipped (zero or one mode) going back there
// would dead-end on an empty / pointless page — bubble back to the
// parent when there's a picker, otherwise stay put.
function onResourceBack() {
  if (props.activityId && skipModeStep.value) {
    if (props.showBackToPicker) emit('back')
    return
  }
  step.value = 1
}
// Hide the Resource step's Back button when there's nowhere useful to
// go: deep-linked embed + Mode skipped.
const showResourceBack = computed(() => {
  if (!props.activityId) return true
  if (!skipModeStep.value) return true
  return !!props.showBackToPicker
})

// Back from the Date & time step. Walks back through skipped Resource
// and Mode steps; emits to the parent if everything earlier is also
// skipped and the embed is picker-driven.
function onDatetimeBack() {
  if (!skipResourceStep.value) { step.value = 2; return }
  if (!skipModeStep.value) { step.value = 1; return }
  if (props.activityId) {
    if (props.showBackToPicker) emit('back')
    return
  }
  step.value = 0
}
const showDatetimeBack = computed(() => {
  if (!skipResourceStep.value || !skipModeStep.value) return true
  if (!props.activityId) return true
  return !!props.showBackToPicker
})

function selectMode(mode: any) {
  booking.activityModeId = mode?.id ?? null
  booking.modeName = mode?.name ?? null
  booking.modeColor = mode?.color ?? null
  modeChosen.value = true
  booking.selectedAddons = []
}

function proceedToResource() {
  const list = filteredBookables.value
  if (list.length === 1) {
    selectBookable(list[0])
    step.value = 3
  } else {
    step.value = 2
  }
}

async function selectBookable(item: any) {
  booking.bookableId = item.id
  booking.bookable = item
  if (!bookableModesByBookable.value[item.id]) {
    const { data } = await (db.from as any)('bookable_modes').select('id, name, color').eq('bookable_id', item.id).order('name')
    bookableModesByBookable.value = { ...bookableModesByBookable.value, [item.id]: data ?? [] }
  }
}

// ── Data loading ─────────────────────────────────────────────

async function load() {
  if (!queryOrgId.value) { loading.value = false; return }

  loadingActivities.value = true
  loadingBookables.value = true

  // Org-level defaults (used as the fallback for modes that haven't set their own).
  const { data: orgData } = await (db.from as any)('organisations')
    .select('default_payment_options, default_form_id')
    .eq('id', queryOrgId.value)
    .single()
  orgDefaultPayments.value = (orgData?.default_payment_options as Record<string, boolean>) ?? {}
  orgDefaultFormId.value = orgData?.default_form_id ?? null

  let bookablesQ = (db.from as any)('bookables')
    .select('id, name, type, location, default_booking_view, item_category')
    .eq('org_id', queryOrgId.value)
    .eq('status', 'ACTIVE')
  // Public sees only is_public=true. Staff sees everything in their org.
  if (!props.staff) bookablesQ = bookablesQ.eq('is_public', true)
  bookablesQ = bookablesQ.order('type').order('name')

  const [{ data: aData }, { data: bData }] = await Promise.all([
    (db.from as any)('activities')
      .select('id, name, description, color, image_url, require_mode, mode_label, mode_display')
      .eq('org_id', queryOrgId.value)
      .eq('status', 'ACTIVE')
      .order('name'),
    bookablesQ,
  ])

  activities.value = aData ?? []

  // Staff: load org events for the link-to-event selector.
  if (props.staff) {
    const { data: eData } = await (db.from as any)('events')
      .select('id, title')
      .eq('org_id', queryOrgId.value)
      .order('start_at', { ascending: false })
    events.value = eData ?? []
  }
  loadingActivities.value = false

  if (activities.value.length > 0) {
    const actIds = activities.value.map((a: any) => a.id)
    const [{ data: amData }, { data: abData }] = await Promise.all([
      (db.from as any)('activity_modes')
        .select('id, activity_id, name, description, color, image_url, sort_order, addons, pricing, min_people, max_people, allow_visitors, min_visitors, max_visitors, form_id, default_booking_view, payment_options, approval_mode')
        .in('activity_id', actIds)
        .order('sort_order').order('name'),
      (db.from as any)('activity_bookables')
        .select('activity_id, bookable_id')
        .in('activity_id', actIds),
    ])

    const modesByAct: Record<string, any[]> = {}
    for (const m of amData ?? []) {
      if (!modesByAct[m.activity_id]) modesByAct[m.activity_id] = []
      modesByAct[m.activity_id].push(m)
    }
    activityModesByActivity.value = modesByAct

    const actMap: Record<string, Set<string>> = {}
    for (const row of abData ?? []) {
      if (!actMap[row.activity_id]) actMap[row.activity_id] = new Set()
      actMap[row.activity_id].add(row.bookable_id)
    }
    activityBookableIds.value = actMap

    // Coach-mode venue requirements: when set, the system reserves one
    // venue from this list alongside the coach at submit time.
    const modeIds = (amData ?? []).map((m: any) => m.id)
    if (modeIds.length) {
      const [{ data: rData }, { data: reqItemData }] = await Promise.all([
        (db.from as any)('activity_mode_resources')
          .select('mode_id, bookable_id, sort_order')
          .in('mode_id', modeIds)
          .order('sort_order'),
        (db.from as any)('activity_mode_required_items')
          .select('mode_id, bookable_id, quantity, sort_order, is_optional, price_override')
          .in('mode_id', modeIds)
          .order('sort_order'),
      ])
      const resByMode: Record<string, string[]> = {}
      for (const r of rData ?? []) {
        if (!resByMode[r.mode_id]) resByMode[r.mode_id] = []
        resByMode[r.mode_id].push(r.bookable_id)
      }
      modeResourcesByMode.value = resByMode

      // Split into required (auto-included) and optional (customer-pickable).
      const reqByMode: Record<string, { bookable_id: string; quantity: number; price_override: number | null }[]> = {}
      const optByMode: Record<string, { bookable_id: string; quantity: number; price_override: number | null }[]> = {}
      for (const r of reqItemData ?? []) {
        const target = r.is_optional ? optByMode : reqByMode
        if (!target[r.mode_id]) target[r.mode_id] = []
        target[r.mode_id].push({
          bookable_id: r.bookable_id,
          quantity: r.quantity,
          price_override: r.price_override != null ? Number(r.price_override) : null,
        })
      }
      modeRequiredItemsByMode.value = reqByMode
      modeOptionalItemsByMode.value = optByMode
    }

    // ITEM bookables (footballs, cones, …) for the Equipment picker.
    // Pull every active item in the org — small fixed inventory.
    const { data: itemData } = await (db.from as any)('bookables')
      .select('id, name, max_concurrent')
      .eq('org_id', queryOrgId.value)
      .eq('type', 'ITEM')
      .eq('status', 'ACTIVE')
      .order('name')
    availableItems.value = itemData ?? []
  }

  bookables.value = bData ?? []
  loadingBookables.value = false
  loading.value = false
}

// ── Submit ───────────────────────────────────────────────────

// Staff: pre-check whether the chosen slot violates a max_concurrent rule on the bookable.
async function checkCapacityViolation(): Promise<string | null> {
  if (!booking.bookableId || !booking.startAt || !booking.endAt) return null
  const startIso = booking.startAt.toISOString()
  const endIso = booking.endAt.toISOString()
  const { data: rules } = await (db.from as any)('availability_rules')
    .select('max_concurrent, name')
    .eq('bookable_id', booking.bookableId)
    .not('max_concurrent', 'is', null)
    .gt('max_concurrent', 0)
  if (!rules?.length) return null
  const { data: overlaps } = await (db.from as any)('bookings')
    .select('id')
    .eq('bookable_id', booking.bookableId)
    .neq('status', 'CANCELLED')
    .lt('start_at', endIso)
    .gt('end_at', startIso)
  const count = overlaps?.length ?? 0
  for (const rule of rules) {
    if (count >= rule.max_concurrent) {
      return `This slot is at capacity (${count}/${rule.max_concurrent} bookings). Choose a different time.`
    }
  }
  return null
}

async function handleSubmit() {
  if (!booking.bookableId || !booking.startAt || !booking.endAt) return
  submitting.value = true
  try {
    if (props.staff) {
      const violation = await checkCapacityViolation()
      if (violation) {
        toast.add({ severity: 'warn', summary: 'Slot at capacity', detail: violation, life: 5000 })
        submitting.value = false
        return
      }
    }
    let claimedDiscountId: string | null = null
    let claimedDiscountAmount: number | null = null
    const match = matchedDiscount.value
    if (match) {
      try {
        await $fetch('/api/booking-discount-claim', {
          method: 'POST',
          body: { discountId: match.discount.id },
        })
        claimedDiscountId = match.discount.id
        claimedDiscountAmount = match.amount
      } catch (e: any) {
        toast.add({ severity: 'warn', summary: 'Discount no longer available', detail: e?.data?.message ?? e?.message, life: 4000 })
      }
    }

    if (props.staff) {
      // Pre-flight: resolve a venue if the picked mode requires one
      // (coach modes), and verify item inventory.
      const resolvedVenueId = await resolveModeVenue()
      if (resolvedVenueId === '__NONE_AVAILABLE__') {
        toast.add({ severity: 'error', summary: 'No venue available', detail: 'Every venue this mode needs is already booked for that time.', life: 4000 })
        submitting.value = false
        return
      }
      const itemRowsToInsert = selectedItemRows.value
      if (itemRowsToInsert.length) {
        const itemIssue = await checkItemAvailability(itemRowsToInsert)
        if (itemIssue) {
          toast.add({ severity: 'error', summary: 'Not enough equipment', detail: itemIssue, life: 4000 })
          submitting.value = false
          return
        }
      }

      // Staff: direct DB insert (auth enforced server-side via RLS), supports event_id.
      // bookings has no org_id — it's derived through bookable_id.
      const { data: bookingRow, error } = await (db.from as any)('bookings').insert({
        bookable_id: booking.bookableId,
        activity_id: booking.activityId || null,
        activity_mode_id: booking.activityModeId || null,
        event_id: booking.eventId || null,
        type: 'ONE_OFF',
        status: currentActivityMode.value?.approval_mode === 'REQUIRES_APPROVAL' ? 'PENDING' : 'CONFIRMED',
        start_at: booking.startAt.toISOString(),
        end_at: booking.endAt.toISOString(),
        notes: booking.notes || null,
        selected_addons: booking.selectedAddons ?? [],
        attendee_count: booking.attendeeCount || null,
        contact_name: booking.contactName,
        contact_email: booking.contactEmail,
        contact_phone: booking.contactPhone || null,
        is_all_day: false,
        booking_discount_id: claimedDiscountId,
        discount_amount: claimedDiscountAmount,
        custom_fields: {
          ...visibleFormAnswers(),
          ...(booking.visitorCount != null ? { visitors: booking.visitorCount } : {}),
          ...(modeFormTerms.value.length ? { _terms_agreed: termsConsentSnapshot() } : {}),
          ...(booking.paymentMethod ? { _payment_method: booking.paymentMethod } : {}),
        },
      }).select('id').single()
      if (error) throw error

      // Child booking on the venue resolved above (e.g. coach + lane).
      // parent_booking_id ties them together; both calendars block.
      if (resolvedVenueId && bookingRow?.id) {
        await (db.from as any)('bookings').insert({
          bookable_id: resolvedVenueId,
          activity_id: booking.activityId || null,
          activity_mode_id: booking.activityModeId || null,
          parent_booking_id: bookingRow.id,
          type: 'ONE_OFF',
          status: currentActivityMode.value?.approval_mode === 'REQUIRES_APPROVAL' ? 'PENDING' : 'CONFIRMED',
          start_at: booking.startAt.toISOString(),
          end_at: booking.endAt.toISOString(),
          contact_name: booking.contactName,
          contact_email: booking.contactEmail,
          notes: `via ${currentActivityMode.value?.name ?? 'mode'}`,
          is_all_day: false,
        })
      }

      // Equipment rows. Fungible — one row per item type with a quantity.
      if (itemRowsToInsert.length && bookingRow?.id) {
        await (db.from as any)('booking_items').insert(
          itemRowsToInsert.map((r, i) => ({
            booking_id: bookingRow.id,
            bookable_id: r.id,
            quantity: r.qty,
            sort_order: i,
          })),
        )
      }
      // Mirror the public-booking notification path.
      const isPending = currentActivityMode.value?.approval_mode === 'REQUIRES_APPROVAL'
      const { data: notif } = await (db.from as any)('notifications').insert({
        org_id: queryOrgId.value,
        type: isPending ? 'booking.pending' : 'booking.created',
        title: isPending ? 'Booking awaiting approval' : 'Booking created',
        body: `${booking.contactName} — ${booking.startAt.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`,
        link: `/bookables/${booking.bookableId}?tab=bookings`,
        payload: {
          contact_name: booking.contactName,
          start_at: booking.startAt.toISOString(),
          bookable_id: booking.bookableId,
          activity_mode_id: booking.activityModeId,
        },
      }).select('id').single()
      if (notif?.id) {
        $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId: notif.id } }).catch(() => {})
      }
      if (bookingRow?.id) {
        $fetch('/api/send-customer-booking-email', { method: 'POST', body: { bookingId: bookingRow.id, event: 'created' } }).catch(() => {})
        if (!isPending) {
          $fetch('/api/finalize-access', { method: 'POST', body: { bookingId: bookingRow.id } }).catch(() => {})
        }
      }
      bookedStatus.value = currentActivityMode.value?.approval_mode === 'REQUIRES_APPROVAL' ? 'PENDING' : 'CONFIRMED'
      bookedId.value = bookingRow?.id ?? null
    } else {
      const res = await $fetch<{ success: boolean; bookingId: string | null; status: 'CONFIRMED' | 'PENDING' }>('/api/public-booking', {
        method: 'POST',
        body: {
          bookableId: booking.bookableId,
          activityId: booking.activityId || null,
          activityModeId: booking.activityModeId || null,
          startAt: booking.startAt.toISOString(),
          endAt: booking.endAt.toISOString(),
          contactName: booking.contactName,
          contactEmail: booking.contactEmail,
          contactPhone: booking.contactPhone || null,
          notes: booking.notes || null,
          selectedAddons: booking.selectedAddons,
          attendeeCount: booking.attendeeCount || null,
          bookingDiscountId: claimedDiscountId,
          discountAmount: claimedDiscountAmount,
          customFields: {
            ...visibleFormAnswers(),
            ...(booking.visitorCount != null ? { visitors: booking.visitorCount } : {}),
            ...(modeFormTerms.value.length ? { _terms_agreed: termsConsentSnapshot() } : {}),
            ...(booking.paymentMethod ? { _payment_method: booking.paymentMethod } : {}),
          },
        },
      })
      bookedStatus.value = res.status
      bookedId.value = res.bookingId
    }
    submitted.value = true
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not submit booking', detail: e?.message, life: 5000 })
  }
  submitting.value = false
}

// ── Reset ────────────────────────────────────────────────────

function resetFlow() {
  submitted.value = false
  step.value = 0
  activityChosen.value = false
  modeChosen.value = false
  Object.assign(booking, {
    activityId: null, activity: null,
    activityModeId: null, modeName: null, modeColor: null,
    bookableId: null, bookable: null,
    startAt: null, endAt: null,
    selectedAddons: [],
    attendeeCount: null,
    contactName: '', contactEmail: '', contactPhone: '', notes: '',
    eventId: null,
    paymentMethod: null,
  })
  bookedStatus.value = null
  bookedId.value = null
}

onMounted(async () => {
  await load()
  // Caller pre-selected an activity (e.g. /bookings/new fork) — skip the
  // activity picker but still hit the proper branching: Mode if the activity
  // has any modes, otherwise straight to the Resource picker (with auto-skip
  // when there's exactly one linked venue).
  if (props.activityId) {
    const act = activities.value.find(a => a.id === props.activityId)
    if (act) {
      selectActivity(act)
      // Caller pre-selected a mode too (booker's "By service" picker)
      // — apply it, then walk straight to the Resource step.
      if (props.presetModeId) {
        const mode = availableModes.value.find(m => m.id === props.presetModeId)
        if (mode) {
          selectMode(mode)
          proceedToResource()
        } else {
          afterActivity()
        }
      } else {
        afterActivity()
      }
    }
  }
  try { activeDiscounts.value = await loadActiveDiscounts() } catch { activeDiscounts.value = [] }
})
</script>
