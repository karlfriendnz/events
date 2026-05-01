<template>
  <div class="h-full flex flex-col bg-white">

    <!-- Month view -->
    <div v-if="calView === 'month'" class="p-3 flex-1 flex flex-col overflow-hidden">
      <div class="grid grid-cols-7 mb-1 shrink-0">
        <div v-for="d in DAYS" :key="d" class="text-center text-[11px] font-semibold text-gray-400 py-1">{{ d }}</div>
      </div>
      <div class="flex-1 flex flex-col gap-1">
        <div v-for="(week, wi) in monthDays" :key="wi" class="flex-1 relative">
          <!-- Day cells -->
          <div class="absolute inset-0 grid grid-cols-7 gap-1">
            <div v-for="day in week" :key="day.toISOString()"
              class="rounded-lg p-1.5 transition-colors border cursor-pointer overflow-hidden"
              :class="[
                day.getMonth() !== calDate.getMonth() ? 'border-transparent bg-gray-50/50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50',
                isToday(day) ? '!bg-blue-50 !border-blue-200' : '',
                monthDropTarget && monthDropTarget.getTime() === stripTimeMs(day) ? '!bg-green-50 !border-green-300' : '',
              ]"
              @click="(!wizardMode || rulesForDate(day).length) && $emit('slot-click', day)"
              @dragover.prevent="monthDropTarget = stripDate(day)"
              @dragleave="onMonthDragLeave(day)"
              @drop.prevent="onMonthDrop(day)">
              <span class="text-xs font-medium block"
                :class="day.getMonth() !== calDate.getMonth() ? 'text-gray-300' : isToday(day) ? 'text-blue-600 font-bold' : 'text-gray-700'">
                {{ day.getDate() }}
              </span>
              <div v-if="rulesForDate(day).length" class="flex gap-0.5 mt-0.5">
                <span v-for="(rule, ri) in rulesForDate(day).slice(0, 3)" :key="ri"
                  class="w-1.5 h-1.5 rounded-full border shrink-0"
                  :style="{ borderColor: ruleColor(rule), backgroundColor: ruleColor(rule) + '30' }" />
              </div>
            </div>
          </div>
          <!-- Spanning event bars -->
          <div class="absolute left-0 right-0 bottom-0 pointer-events-none px-1.5" style="top:28px">
            <div v-for="bar in weekBars[wi]" :key="`${wi}-${bar.id}-${bar.lane}`"
              class="absolute h-[18px] rounded-md text-[10px] font-medium text-white truncate px-1.5 leading-[18px] cursor-grab active:cursor-grabbing hover:opacity-90"
              :class="{ 'opacity-40': monthDragBar?.id === bar.id }"
              :style="{
                left: `calc(${(bar.startCol/7)*100}% + 2px)`,
                width: `calc(${((bar.endCol - bar.startCol + 1)/7)*100}% - 4px)`,
                top: `${bar.lane * 21}px`,
                backgroundColor: bar.color,
                borderTopLeftRadius: bar.isStart ? '6px' : '0',
                borderBottomLeftRadius: bar.isStart ? '6px' : '0',
                borderTopRightRadius: bar.isEnd ? '6px' : '0',
                borderBottomRightRadius: bar.isEnd ? '6px' : '0',
                pointerEvents: monthDragBar ? 'none' : 'auto',
              }"
              :title="bar.title"
              draggable="true"
              @dragstart="onMonthDragStart(bar, $event)"
              @dragend="onMonthDragEnd"
              @mouseenter="$emit('booking-hover', bar.booking, $event)"
              @mouseleave="$emit('booking-leave')"
              @click.stop="$emit('booking-click', bar.booking)">
              <span v-if="bar.isStart && !bar.allDay" class="opacity-80 mr-1">{{ bar.timeLabel }}</span>{{ bar.title }}
            </div>
            <div v-for="extra in weekBarsOverflow[wi]" :key="`overflow-${wi}-${extra.col}`"
              class="absolute text-[9px] text-gray-500 px-1"
              :style="{ left: `calc(${(extra.col/7)*100}%)`, width: `calc(${(1/7)*100}%)`, top: `${MAX_LANES * 21}px` }">
              +{{ extra.count }} more
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List view -->
    <div v-else-if="calView === 'list'" class="flex-1 overflow-y-auto flex flex-col">
      <!-- Column headers -->
      <div class="sticky top-0 z-20 bg-white border-b border-gray-200 grid text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-5 border-l-4 border-l-transparent"
        :style="{ gridTemplateColumns: wizardMode ? '72px 1fr 130px 110px' : '72px 1fr 130px 1fr 96px' }">
        <div class="py-2.5">Date</div>
        <div class="py-2.5">Slot</div>
        <div class="py-2.5">Time</div>
        <div class="py-2.5" :class="wizardMode ? 'text-right' : ''">{{ wizardMode ? 'Availability' : 'Booking' }}</div>
        <div v-if="!wizardMode" class="py-2.5 text-right">Status</div>
      </div>

      <template v-for="(mth, mi) in listMonths" :key="mi">
        <!-- Month header -->
        <div class="sticky top-[37px] z-10 bg-gray-50 border-b border-gray-200 px-5 py-1.5">
          <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{{ mth.label }}</span>
        </div>

        <div v-if="!mth.days.length || (wizardMode && mth.days.every(d => !d.rules.length))"
          class="px-5 py-4 text-sm text-gray-400 italic">
          {{ wizardMode ? 'No availability this month.' : 'No bookings this month.' }}
        </div>

        <template v-for="day in mth.days" :key="day.date.toISOString()">
          <template v-if="!wizardMode || day.rules.length">
            <template v-for="(rule, ruleIdx) in day.rules" :key="rule.id">
              <div v-for="(slot, slotIdx) in ruleSlots(rule)" :key="slotIdx"
                class="grid items-center border-b border-gray-100 border-l-4 px-5 transition-colors"
                :style="{
                  gridTemplateColumns: wizardMode ? '72px 1fr 130px 110px' : '72px 1fr 130px 1fr 96px',
                  borderLeftColor: slotRemainingCapacity(rule, slot, day.date) === 0
                    ? '#D1D5DB'
                    : slotOverlappingBookings(slot, day.date).length && !wizardMode
                      ? bookingHeaderColor(slotOverlappingBookings(slot, day.date)[0])
                      : '#4ade80'
                }"
                :class="slotRemainingCapacity(rule, slot, day.date) === 0
                  ? 'cursor-not-allowed bg-gray-50'
                  : slotOverlappingBookings(slot, day.date).length && !wizardMode
                    ? 'cursor-pointer hover:bg-blue-50/40'
                    : 'cursor-pointer hover:bg-green-50/60'"
                @click="slotRemainingCapacity(rule, slot, day.date) !== 0 && onListSlotClick(day.date, slot, rule)">

                <!-- Date (only on first row per day) -->
                <div class="py-3 shrink-0">
                  <template v-if="ruleIdx === 0 && slotIdx === 0">
                    <div class="text-[10px] font-semibold uppercase"
                      :class="isToday(day.date) ? 'text-blue-500' : 'text-gray-400'">
                      {{ day.date.toLocaleDateString('en-AU', { weekday: 'short' }) }}
                    </div>
                    <div class="text-xl font-bold leading-none mt-0.5"
                      :class="isToday(day.date) ? 'text-blue-600' : 'text-gray-700'">
                      {{ day.date.getDate() }}
                    </div>
                  </template>
                </div>

                <!-- Slot name -->
                <div class="py-3 flex items-center gap-2 min-w-0">
                  <span class="w-2 h-2 rounded-full shrink-0"
                    :style="{ backgroundColor: slotOverlappingBookings(slot, day.date).length && !wizardMode ? bookingHeaderColor(slotOverlappingBookings(slot, day.date)[0]) : ruleColor(rule) }" />
                  <span class="text-sm text-gray-700 truncate">{{ rule.name }}</span>
                </div>

                <!-- Time -->
                <div class="py-3 text-sm text-gray-500 tabular-nums">
                  {{ formatTime(slot.from) }} – {{ formatTime(slot.to) }}
                </div>

                <!-- Booking column (admin) / Availability column (wizard) -->
                <div class="py-3 min-w-0" :class="wizardMode ? 'flex justify-end' : ''">
                  <template v-if="!wizardMode && slotOverlappingBookings(slot, day.date).length">
                    <div v-for="booking in slotOverlappingBookings(slot, day.date)" :key="booking.id"
                      class="flex items-center gap-1.5 min-w-0"
                      @click.stop="$emit('booking-click', booking)">
                      <i v-if="booking.status === 'PENDING'"
                        class="pi pi-clock text-amber-500 text-xs shrink-0 booking-pending-icon"
                        v-tooltip.top="'Awaiting approval'" />
                      <p class="text-sm font-medium text-gray-800 truncate">{{ bookingTitle(booking) }}</p>
                      <template v-if="booking.activity_mode">
                        <span class="text-gray-300 text-xs shrink-0">·</span>
                        <span class="text-xs font-medium shrink-0" :style="{ color: booking.activity_mode.color || '#6366f1' }">{{ booking.activity_mode.name }}</span>
                      </template>
                      <template v-if="booking.contact_name">
                        <span class="text-gray-300 text-xs shrink-0">·</span>
                        <span class="text-xs text-gray-400 truncate">{{ booking.contact_name }}</span>
                      </template>
                    </div>
                  </template>
                  <template v-else-if="wizardMode">
                    <span v-if="slotRemainingCapacity(rule, slot, day.date) === 0"
                      class="text-xs font-semibold text-gray-400">Full</span>
                    <span v-else class="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600">
                      <span class="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      Available
                    </span>
                  </template>
                </div>

                <!-- Status (admin only) -->
                <div v-if="!wizardMode" class="py-3 flex justify-end">
                  <template v-if="slotOverlappingBookings(slot, day.date).length">
                    <span v-for="booking in slotOverlappingBookings(slot, day.date)" :key="booking.id"
                      class="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold" :class="bookingStatusClass(booking.status)">
                      <i v-if="booking.status === 'PENDING'" class="pi pi-clock text-[9px] booking-pending-icon" />
                      {{ booking.status }}
                    </span>
                  </template>
                  <span v-else-if="slotRemainingCapacity(rule, slot, day.date) === 0"
                    class="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-500">Full</span>
                </div>
              </div>
            </template>
          </template>
        </template>
      </template>
    </div>

    <!-- Week view -->
    <template v-else-if="calView === 'week'">
      <div class="flex border-b border-gray-100 bg-gray-50 shrink-0">
        <div class="shrink-0 border-r border-gray-100" style="width:52px" />
        <div v-for="(day, di) in weekDays" :key="di"
          class="flex-1 text-center py-2 border-r border-gray-100 last:border-r-0"
          :class="isToday(day) ? 'bg-blue-50' : ''">
          <div class="text-[10px] font-semibold text-gray-400 uppercase">{{ DAYS[di] }}</div>
          <div class="text-sm font-bold mt-0.5" :class="isToday(day) ? 'text-blue-600' : 'text-gray-700'">{{ day.getDate() }}</div>
        </div>
      </div>
      <div ref="weekGridRef" class="flex flex-1 overflow-y-auto min-h-0">
        <div class="shrink-0 flex flex-col border-r border-gray-100" style="width:52px">
          <div v-for="label in HOUR_LABELS" :key="label"
            class="text-[10px] text-gray-300 text-right pr-2 shrink-0 leading-none"
            :style="{ height: `${HOUR_PX}px`, paddingTop: '3px' }">{{ label }}</div>
        </div>
        <div class="flex flex-1">
          <div v-for="(day, di) in weekDays" :key="di"
            class="flex-1 relative border-r border-gray-100 last:border-r-0 cursor-pointer"
            :style="{ height: `${HOUR_LABELS.length * HOUR_PX}px` }"
            @click="onGridClick(day, $event)"
            @dragover.prevent="onGridDragOver(day, $event)"
            @drop="onGridDrop(day, $event)">
            <div v-for="(_, hi) in HOUR_LABELS" :key="hi"
              class="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
              :style="{ top: `${hi * HOUR_PX}px` }" />
            <!-- Drop preview ghost -->
            <div v-if="dropPreview.visible && dropPreview.day && isSameDay(dropPreview.day, day)"
              class="absolute left-0.5 right-0.5 rounded pointer-events-none z-30 transition-none"
              :class="dropPreview.valid ? 'bg-green-100 border-2 border-green-400' : 'bg-red-100 border-2 border-red-400'"
              :style="{ top: `${Math.max(dropPreview.startMins - GRID_START_MINS, 0) / 60 * HOUR_PX}px`, height: `${dropPreview.durationMins / 60 * HOUR_PX}px` }" />
            <template v-for="rule in rulesForDate(day)" :key="rule.id">
              <div v-for="(slot, si) in ruleSlots(rule)" :key="si"
                class="absolute left-0.5 right-0.5 rounded-sm px-1 overflow-hidden z-10 group"
                :class="slotRemainingCapacity(rule, slot, day) === 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'"
                :style="{ border: `1px solid ${ruleColor(rule)}`, backgroundColor: ruleColor(rule) + '20', top: slotTop(slot.from), height: slotHeight(slot.from, slot.to) }"
                @click.stop="slotRemainingCapacity(rule, slot, day) !== 0 && emitSlotClick(day, slot, rule)">
                <span class="text-[10px] font-medium truncate block leading-tight pt-0.5"
                  :style="{ color: ruleColor(rule) }">{{ rule.name }}</span>
                <div v-if="wizardMode && slotRemainingCapacity(rule, slot, day) === 0"
                  class="px-1">
                  <p class="text-[9px] font-semibold text-gray-500">Fully booked</p>
                </div>
                <div v-else-if="modesForRule(rule).length"
                  class="hidden group-hover:block absolute left-0 top-full mt-0.5 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs whitespace-nowrap pointer-events-none"
                  style="min-width: 110px">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Modes</p>
                  <div class="space-y-1">
                    <div v-for="m in modesForRule(rule)" :key="m.id" class="flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: m.color || '#6366f1' }" />
                      <span class="text-gray-700">{{ m.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-if="!wizardMode" v-for="booking in bookingsForDate(day)" :key="booking.id">
              <div class="absolute left-0.5 right-0.5 rounded-sm px-1 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
                :class="[
                  { 'opacity-30': draggingBooking?.id === booking.id },
                  booking.status === 'PENDING' ? 'booking-pending ring-1 ring-amber-300/70' : '',
                ]"
                :style="{ backgroundColor: bookingColor(booking), top: slotTop(bookingStartTime(booking)), height: slotHeight(bookingStartTime(booking), bookingEndTime(booking)), zIndex: 20 }"
                draggable="true"
                @dragstart="onBookingDragStart(booking, $event)"
                @dragend="onDragEnd"
                @mouseenter="$emit('booking-hover', booking, $event)"
                @mouseleave="$emit('booking-leave')"
                @click.stop="$emit('booking-click', booking)">
                <span class="text-[10px] font-medium truncate block leading-tight pt-0.5 text-white flex items-center gap-1">
                  <i v-if="booking.status === 'PENDING'" class="pi pi-clock text-[8px] shrink-0 booking-pending-icon" />
                  {{ bookingTitle(booking) }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>
      <!-- Legend -->
      <div class="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400 shrink-0 bg-gray-50/50">
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm border border-green-400 bg-green-400/20 inline-block" /> Open</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm border border-blue-400 bg-blue-400/20 inline-block" /> Restricted</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#1E2157] inline-block" /> Confirmed</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Pending</span>
      </div>
    </template>

    <!-- Day view -->
    <template v-else>
      <div class="px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center gap-2">
        <span class="text-sm font-semibold" :class="isToday(calDate) ? 'text-blue-600' : 'text-gray-800'">
          {{ calDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}
        </span>
        <span v-if="isToday(calDate)" class="text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-medium">Today</span>
      </div>
      <div ref="dayGridRef" class="flex flex-1 overflow-y-auto min-h-0">
        <div class="shrink-0 flex flex-col border-r border-gray-100" style="width:52px">
          <div v-for="label in HOUR_LABELS" :key="label"
            class="text-[10px] text-gray-300 text-right pr-2 shrink-0 leading-none"
            :style="{ height: `${HOUR_PX}px`, paddingTop: '3px' }">{{ label }}</div>
        </div>
        <div class="flex-1 relative cursor-pointer"
          :style="{ height: `${HOUR_LABELS.length * HOUR_PX}px` }"
          @click="onGridClick(calDate, $event)"
          @dragover.prevent="onGridDragOver(calDate, $event)"
          @drop="onGridDrop(calDate, $event)">
          <div v-for="(_, hi) in HOUR_LABELS" :key="hi"
            class="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
            :style="{ top: `${hi * HOUR_PX}px` }" />
          <!-- Drop preview ghost -->
          <div v-if="dropPreview.visible && dropPreview.day && isSameDay(dropPreview.day, calDate)"
            class="absolute rounded-xl pointer-events-none z-30"
            style="left: 8px; right: 8px"
            :class="dropPreview.valid ? 'bg-green-100 border-2 border-green-400' : 'bg-red-100 border-2 border-red-400'"
            :style="{ top: `${Math.max(dropPreview.startMins - GRID_START_MINS, 0) / 60 * HOUR_PX}px`, height: `${dropPreview.durationMins / 60 * HOUR_PX}px` }" />
          <template v-for="rule in rulesForDate(calDate)" :key="rule.id">
            <div v-for="(slot, si) in ruleSlots(rule)" :key="si"
              class="absolute rounded-lg z-10 group overflow-hidden transition-shadow"
              style="left: 8px; right: 8px"
              :class="[
                slotRemainingCapacity(rule, slot, calDate) === 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                isSlotSelected(calDate, slot) ? 'ring-2 ring-[#1E2157]/40 ring-offset-1 shadow-md' : '',
              ]"
              :style="isSlotSelected(calDate, slot)
                ? { borderLeft: `4px solid #1E2157`, border: `2px solid #1E2157`, backgroundColor: '#1E2157', top: slotTop(slot.from), height: slotHeight(slot.from, slot.to) }
                : { borderLeft: `4px solid ${ruleColor(rule)}`, border: `1px solid ${ruleColor(rule)}40`, backgroundColor: ruleColor(rule) + '18', top: slotTop(slot.from), height: slotHeight(slot.from, slot.to) }"
              @click.stop="slotRemainingCapacity(rule, slot, calDate) !== 0 && emitSlotClick(calDate, slot, rule)">
              <div class="px-3 py-2">
                <p class="text-xs font-semibold flex items-center gap-1.5"
                  :style="isSlotSelected(calDate, slot) ? { color: '#fff' } : { color: ruleColor(rule) }">
                  <i v-if="isSlotSelected(calDate, slot)" class="pi pi-check text-[10px]" />
                  <span>{{ rule.name }}</span>
                </p>
                <p class="text-[10px] mt-0.5" :class="isSlotSelected(calDate, slot) ? 'text-white/80' : 'text-gray-500'">{{ formatTime(slot.from) }} – {{ formatTime(slot.to) }}</p>
              </div>
              <div v-if="wizardMode && slotRemainingCapacity(rule, slot, calDate) === 0"
                class="px-3 py-2">
                <p class="text-xs font-semibold text-gray-500">Fully booked</p>
              </div>
              <div v-else-if="modesForRule(rule).length"
                class="hidden group-hover:block absolute left-4 top-full mt-0.5 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs whitespace-nowrap pointer-events-none"
                style="min-width: 120px">
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Modes</p>
                <div class="space-y-1">
                  <div v-for="m in modesForRule(rule)" :key="m.id" class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: m.color || '#6366f1' }" />
                    <span class="text-gray-700">{{ m.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-if="!wizardMode" v-for="booking in bookingsForDate(calDate)" :key="booking.id">
            <div class="absolute rounded-lg overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none"
              style="left: 8px; right: 8px"
              :class="[
                { 'opacity-30': draggingBooking?.id === booking.id },
                booking.status === 'PENDING' ? 'booking-pending ring-2 ring-amber-300/80' : '',
              ]"
              :style="{ backgroundColor: bookingColor(booking), top: slotTop(bookingStartTime(booking)), height: slotHeight(bookingStartTime(booking), bookingEndTime(booking)), zIndex: 20 }"
              draggable="true"
              @dragstart="onBookingDragStart(booking, $event)"
              @dragend="onDragEnd"
              @mouseenter="$emit('booking-hover', booking, $event)"
              @mouseleave="$emit('booking-leave')"
              @click.stop="$emit('booking-click', booking)">
              <div class="px-3 py-2">
                <p class="text-xs font-semibold text-white flex items-center gap-1.5">
                  <span v-if="booking.status === 'PENDING'"
                    class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide bg-white/20 rounded-full px-1.5 py-0.5 booking-pending-icon">
                    <i class="pi pi-clock text-[8px]" /> Pending
                  </span>
                  <span class="truncate">{{ bookingTitle(booking) }}</span>
                </p>
                <p class="text-[10px] mt-0.5" style="color: rgba(255,255,255,0.85)">{{ formatTime(bookingStartTime(booking)) }} – {{ formatTime(bookingEndTime(booking)) }}</p>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400 shrink-0 bg-gray-50/50">
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm border border-green-400 bg-green-400/20 inline-block" /> Open</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm border border-blue-400 bg-blue-400/20 inline-block" /> Restricted</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-[#1E2157] inline-block" /> Confirmed</span>
        <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Pending</span>
      </div>
    </template>

  </div>

</template>

<script setup lang="ts">
const { orgId } = useOrg()
const db = useDb()

const props = defineProps<{
  bookableId?: string
  calDate: Date
  calView: 'day' | 'week' | 'month' | 'list'
  refreshKey?: number
  modeId?: string | null
  // When set, only show rules whose activity_mode_ids include this id
  // (or rules with no activity_mode_ids restriction).
  activityModeId?: string | null
  // Used by the scheduler flow: the user hasn't picked a mode yet, but the
  // calendar must still show rules scoped to *any* of this activity's modes.
  // When non-empty, a scoped rule is visible if its activity_mode_ids overlap
  // with this list.
  activityModeIds?: string[]
  // Set of `${bookableId}|${startISO}|${endISO}` keys for slots the parent
  // (BookingScheduler) has marked as selected. Drives the visual highlight.
  selectedSlotKeys?: Set<string>
  bookableModes?: { id: string; name: string; color: string | null }[]
  activityModes?: { id: string; name: string; color: string | null }[]
  wizardMode?: boolean
  // Generic items mode — when provided, the calendar renders these instead of
  // loading bookings for a bookable. Used by /events to render event rows.
  customEvents?: any[]
}>()

const emit = defineEmits<{
  'booking-click': [booking: any]
  'slot-click': [date: Date, endDate?: Date, rule?: any]
  'booking-drop': [booking: any, newStart: Date, newEnd: Date]
  'booking-hover': [booking: any, event: MouseEvent]
  'booking-leave': []
}>()

const HOUR_PX = 56
const GRID_START_MINS = 6 * 60
const HOUR_LABELS = ['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const weekGridRef = ref<HTMLElement | null>(null)
const dayGridRef = ref<HTMLElement | null>(null)
const loadedBookings = ref<any[]>([])
const bookings = computed<any[]>(() => props.customEvents ?? loadedBookings.value)
const rules = ref<any[]>([])

const draggingBooking = ref<any>(null)
const dragOffsetMins = ref(0)
const dropPreview = reactive({ visible: false, day: null as Date | null, startMins: 0, durationMins: 0, valid: false })

// Month-view drag state
const monthDragBar = ref<any>(null)
const monthDropTarget = ref<Date | null>(null)

function stripDate(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function stripTimeMs(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }

function onMonthDragStart(bar: any, e: DragEvent) {
  monthDragBar.value = bar
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Set drag data so Firefox/Chrome consistently fire drag events.
    try { e.dataTransfer.setData('text/plain', String(bar.id)) } catch {}
  }
  // Force-disable pointer-events on bars synchronously so drops fall through to day cells.
  // Vue's reactive style update may not commit before the next dragover.
  ;(e.currentTarget as HTMLElement)?.parentElement?.querySelectorAll<HTMLElement>('[draggable="true"]')
    .forEach(el => { el.style.pointerEvents = 'none' })
}

function onMonthDragEnd() {
  monthDragBar.value = null
  monthDropTarget.value = null
}

function onMonthDragLeave(day: Date) {
  if (monthDropTarget.value && monthDropTarget.value.getTime() === stripTimeMs(day)) {
    monthDropTarget.value = null
  }
}

function onMonthDrop(day: Date) {
  if (!monthDragBar.value) return
  const b = monthDragBar.value.booking
  monthDragBar.value = null
  monthDropTarget.value = null

  const oldStart = new Date(b.start_at)
  const oldEnd = b.end_at ? new Date(b.end_at) : oldStart
  const target = stripDate(day)
  const startKey = stripTimeMs(oldStart)
  if (target.getTime() === startKey) return // dropped on same day, no-op

  const dayDelta = (target.getTime() - startKey) / 86_400_000
  const newStart = new Date(oldStart); newStart.setDate(newStart.getDate() + dayDelta)
  const newEnd = new Date(oldEnd); newEnd.setDate(newEnd.getDate() + dayDelta)

  emit('booking-drop', b, newStart, newEnd)
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function ruleHasCapacity(rule: any, proposedStart: Date, proposedEnd: Date, excludeBookingId?: string): boolean {
  if (rule.max_concurrent == null) return true
  const count = bookings.value.filter(b => {
    if (b.id === excludeBookingId) return false
    if (b.status === 'CANCELLED') return false
    return new Date(b.start_at) < proposedEnd && new Date(b.end_at) > proposedStart
  }).length
  return count < rule.max_concurrent
}

function slotOverlappingBookings(slot: { from: string; to: string }, day: Date): any[] {
  const slotStart = new Date(day); const [fh, fm] = slot.from.split(':').map(Number); slotStart.setHours(fh, fm, 0, 0)
  const slotEnd = new Date(day); const [th, tm] = slot.to.split(':').map(Number); slotEnd.setHours(th, tm, 0, 0)
  return bookings.value.filter(b => b.status !== 'CANCELLED' && new Date(b.start_at) < slotEnd && new Date(b.end_at) > slotStart)
}

function slotRemainingCapacity(rule: any, slot: { from: string; to: string }, day: Date): number | null {
  if (rule.max_concurrent == null) return null // unlimited
  const count = slotOverlappingBookings(slot, day).length
  return Math.max(0, rule.max_concurrent - count)
}

function onBookingDragStart(booking: any, event: DragEvent) {
  draggingBooking.value = booking
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  dragOffsetMins.value = Math.round(((event.clientY - rect.top) / HOUR_PX * 60) / 15) * 15
  event.dataTransfer!.effectAllowed = 'move'
}

function onGridDragOver(day: Date, event: DragEvent) {
  if (!draggingBooking.value) return
  event.preventDefault()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const cursorMins = GRID_START_MINS + ((event.clientY - rect.top) / HOUR_PX * 60)
  const dur = bookingDurationMins(draggingBooking.value)
  // Proposed start based on where in the booking the user grabbed
  const proposed = Math.round((cursorMins - dragOffsetMins.value) / 15) * 15

  // Events mode (no availability rules) — accept any drop, snap to 15min grid.
  if (props.customEvents !== undefined) {
    dropPreview.visible = true
    dropPreview.day = day
    dropPreview.durationMins = dur
    dropPreview.startMins = Math.max(GRID_START_MINS, Math.min(proposed, GRID_START_MINS + (HOUR_LABELS.length * 60) - dur))
    dropPreview.valid = true
    event.dataTransfer!.dropEffect = 'move'
    return
  }

  // Find nearest valid slot and snap the booking into it
  let bestStartMins = -1
  let bestDist = Infinity
  for (const rule of rulesForDate(day)) {
    for (const slot of ruleSlots(rule)) {
      const slotStart = timeToMins(slot.from)
      const slotEnd = timeToMins(slot.to)
      if (slotEnd - slotStart < dur) continue
      // Clamp proposed start so booking fits entirely within this slot
      const clamped = Math.min(Math.max(proposed, slotStart), slotEnd - dur)
      // Check capacity at this position
      const snapStart = new Date(day)
      snapStart.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0)
      const snapEnd = new Date(day)
      snapEnd.setHours(Math.floor((clamped + dur) / 60), (clamped + dur) % 60, 0, 0)
      if (!ruleHasCapacity(rule, snapStart, snapEnd, draggingBooking.value?.id)) continue
      const dist = Math.abs(proposed - clamped)
      if (dist < bestDist) {
        bestDist = dist
        bestStartMins = clamped
      }
    }
  }

  dropPreview.visible = true
  dropPreview.day = day
  dropPreview.durationMins = dur
  if (bestStartMins >= 0) {
    dropPreview.startMins = bestStartMins
    dropPreview.valid = true
    event.dataTransfer!.dropEffect = 'move'
  } else {
    dropPreview.startMins = proposed
    dropPreview.valid = false
    event.dataTransfer!.dropEffect = 'none'
  }
}

async function onGridDrop(day: Date, event: DragEvent) {
  event.preventDefault()
  const booking = draggingBooking.value
  if (!booking || !dropPreview.valid) { draggingBooking.value = null; dropPreview.visible = false; return }
  const startMins = dropPreview.startMins
  const endMins = startMins + bookingDurationMins(booking)
  const newStart = new Date(day)
  newStart.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0)
  const newEnd = new Date(day)
  newEnd.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0)

  // Events mode — delegate to parent instead of updating bookings table.
  if (props.customEvents !== undefined) {
    emit('booking-drop', booking, newStart, newEnd)
    draggingBooking.value = null
    dropPreview.visible = false
    return
  }

  await db.from('bookings').update({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() }).eq('id', booking.id)
  draggingBooking.value = null
  dropPreview.visible = false
  await loadBookings()
}

function onDragEnd() {
  draggingBooking.value = null
  dropPreview.visible = false
}


const weekDays = computed(() => {
  const dow = (props.calDate.getDay() + 6) % 7
  const monday = new Date(props.calDate)
  monday.setDate(props.calDate.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
})

const MAX_LANES = 3

const weekLayout = computed(() => {
  const bars: any[][] = []
  const overflows: { col: number; count: number }[][] = []
  const weeks = monthDays.value
  for (const week of weeks) {
    const weekStart = new Date(week[0]); weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(week[6]); weekEnd.setHours(23, 59, 59, 999)
    const wsTime = weekStart.getTime()
    const weTime = weekEnd.getTime()

    const overlapping = bookings.value.filter((b: any) => {
      const bs = b.start_at ? new Date(b.start_at).getTime() : null
      if (bs == null) return false
      const be = b.end_at ? new Date(b.end_at).getTime() : bs
      return bs <= weTime && be >= wsTime
    }).sort((a: any, b: any) => {
      const aStart = new Date(a.start_at).getTime()
      const bStart = new Date(b.start_at).getTime()
      if (aStart !== bStart) return aStart - bStart
      const aEnd = new Date(a.end_at || a.start_at).getTime()
      const bEnd = new Date(b.end_at || b.start_at).getTime()
      return bEnd - aEnd
    })

    const laneEnds: number[] = []
    const weekBarsList: any[] = []
    const overflowByCol: Record<number, number> = {}
    for (const b of overlapping) {
      const bs = new Date(b.start_at).getTime()
      const be = b.end_at ? new Date(b.end_at).getTime() : bs
      const startCol = Math.max(0, Math.floor((bs - wsTime) / 86_400_000))
      const endCol = Math.min(6, Math.floor((be - wsTime) / 86_400_000))
      if (startCol > 6 || endCol < 0) continue

      let lane = 0
      while (lane < laneEnds.length && laneEnds[lane] >= startCol) lane++
      if (lane >= MAX_LANES) {
        for (let c = startCol; c <= endCol; c++) overflowByCol[c] = (overflowByCol[c] ?? 0) + 1
        continue
      }
      if (lane >= laneEnds.length) laneEnds.push(endCol)
      else laneEnds[lane] = endCol

      weekBarsList.push({
        id: b.id,
        booking: b,
        startCol, endCol, lane,
        isStart: bs >= wsTime,
        isEnd: be <= weTime + 86_400_000,
        color: bookingColor(b),
        title: bookingTitle(b),
        timeLabel: formatTime(bookingStartTime(b)),
        allDay: !!b.is_all_day,
      })
    }
    bars.push(weekBarsList)
    overflows.push(Object.entries(overflowByCol).map(([col, count]) => ({ col: Number(col), count })))
  }
  return { bars, overflows }
})

const weekBars = computed(() => weekLayout.value.bars)
const weekBarsOverflow = computed(() => weekLayout.value.overflows)

const monthDays = computed(() => {
  const year = props.calDate.getFullYear()
  const month = props.calDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - startDow)
  const weeks: Date[][] = []
  const cur = new Date(start)
  while (cur <= lastDay || weeks.length < 4) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    weeks.push(week)
    if (cur > lastDay && weeks.length >= 4) break
  }
  return weeks
})

const listMonths = computed(() => {
  const year = props.calDate.getFullYear(), month = props.calDate.getMonth()
  return Array.from({ length: 3 }, (_, mi) => {
    const cur = new Date(year, month + mi, 1)
    const label = cur.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    const daysInMonth = new Date(year, month + mi + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (__, d) => {
      const date = new Date(year, month + mi, d + 1)
      const dayRules = rulesForDate(date)
      const dayBookings = bookingsForDate(date)
      return (dayRules.length || dayBookings.length) ? { date, rules: dayRules, bookings: dayBookings } : null
    }).filter(Boolean) as { date: Date; rules: any[]; bookings: any[] }[]
    return { label, days }
  })
})

function isToday(date: Date): boolean {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function slotTop(timeStr: string): string {
  return `${Math.max(timeToMins(timeStr) - GRID_START_MINS, 0) / 60 * HOUR_PX}px`
}

function slotHeight(from: string, to: string): string {
  return `${Math.max(timeToMins(to) - timeToMins(from), 5) / 60 * HOUR_PX}px`
}

function formatTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m ? `${hour}:${String(m).padStart(2, '0')}${ampm}` : `${hour}${ampm}`
}

function parseRruleRecurrence(rrule: string): { interval: number; monthWeek: number | null } {
  if (!rrule || rrule === 'NONE') return { interval: 1, monthWeek: null }
  const parts: Record<string, string> = {}
  rrule.split(';').forEach(p => { const [k, v] = p.split('='); if (k && v !== undefined) parts[k] = v })
  const interval = parseInt(parts['INTERVAL'] ?? '1')
  if (parts['FREQ'] === 'MONTHLY' && parts['BYDAY']) {
    const m = parts['BYDAY'].match(/^(-?\d+)/)
    return { interval: 1, monthWeek: m ? parseInt(m[1]) : null }
  }
  return { interval, monthWeek: null }
}

function parseLocalDate(s: string): Date {
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return new Date(s)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function ruleAppliesOnDate(rule: any, date: Date): boolean {
  if (!rule.is_active) return false
  if (rule.valid_from) {
    const from = parseLocalDate(rule.valid_from); from.setHours(0, 0, 0, 0)
    if (date < from) return false
  }
  if (rule.valid_until) {
    const until = parseLocalDate(rule.valid_until); until.setHours(23, 59, 59, 999)
    if (date > until) return false
  }
  const dow = (date.getDay() + 6) % 7
  if (!rule.days_of_week?.includes(dow)) return false
  const { interval: weekInterval, monthWeek } = (rule.rrule && rule.rrule !== 'NONE')
    ? parseRruleRecurrence(rule.rrule)
    : { interval: rule.week_interval ?? 1, monthWeek: rule.month_week ?? null }
  if (monthWeek != null) {
    const year = date.getFullYear(), month = date.getMonth()
    if (monthWeek === -1) {
      const last = new Date(year, month + 1, 0)
      while ((last.getDay() + 6) % 7 !== dow) last.setDate(last.getDate() - 1)
      return last.getDate() === date.getDate()
    }
    let count = 0
    for (let d = 1; d <= 31; d++) {
      const dd = new Date(year, month, d)
      if (dd.getMonth() !== month) break
      if ((dd.getDay() + 6) % 7 === dow) {
        count++
        if (count === monthWeek) return dd.getDate() === date.getDate()
      }
    }
    return false
  }
  if (weekInterval > 1 && rule.week_anchor) {
    const anchor = new Date(rule.week_anchor)
    const anchorDow = (anchor.getDay() + 6) % 7
    const anchorMonday = new Date(anchor)
    anchorMonday.setDate(anchor.getDate() - anchorDow)
    const dateMonday = new Date(date)
    dateMonday.setDate(date.getDate() - dow)
    const diffWeeks = Math.round((dateMonday.getTime() - anchorMonday.getTime()) / (7 * 86400000))
    return diffWeeks >= 0 && diffWeeks % weekInterval === 0
  }
  return true
}

function subtractInterval(base: { from: number; to: number }, sub: { from: number; to: number }): { from: number; to: number }[] {
  if (sub.to <= base.from || sub.from >= base.to) return [base]
  if (sub.from <= base.from && sub.to >= base.to) return []
  if (sub.from <= base.from && sub.to < base.to) return [{ from: sub.to, to: base.to }]
  if (sub.from > base.from && sub.to >= base.to) return [{ from: base.from, to: sub.from }]
  return [{ from: base.from, to: sub.from }, { from: sub.to, to: base.to }]
}

function subtractAllIntervals(base: { from: number; to: number }, subs: { from: number; to: number }[]): { from: number; to: number }[] {
  let pieces = [base]
  for (const sub of subs) {
    const next: { from: number; to: number }[] = []
    for (const p of pieces) next.push(...subtractInterval(p, sub))
    pieces = next
    if (!pieces.length) break
  }
  return pieces
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function rulesForDate(date: Date): any[] {
  // Higher-priority rules carve out their windows from lower-priority ones.
  // Event-driven bookings remove ENTIRE rule slots they overlap (slot-level
  // all-or-nothing) since each slot represents an atomic booking unit.
  const applicable = rules.value.filter(r => {
    if (!ruleAppliesOnDate(r, date)) return false
    if (props.modeId && r.bookable_mode_id && r.bookable_mode_id !== props.modeId) return false
    // Activity-mode scope:
    //  • Rule with empty activity_mode_ids → general venue hours, applies to every activity.
    //  • Rule with explicit activity_mode_ids → only applies when the booker has picked
    //    one of those modes. Hidden in the wizard otherwise.
    if (r.activity_mode_ids?.length) {
      // Scheduler-flow path: caller passed every mode id for the activity
      // (mode is picked AFTER the user chooses a slot). Show the rule when
      // any of those modes overlap with the rule's scope.
      if ((props.activityModeIds?.length ?? 0) > 0) {
        if (!r.activity_mode_ids.some((id: string) => props.activityModeIds!.includes(id))) return false
      } else if (!props.activityModeId) {
        return !props.wizardMode // admin views still see scoped rules
      } else if (!r.activity_mode_ids.includes(props.activityModeId)) {
        return false
      }
    }
    return true
  })
  const sorted = [...applicable].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  // Pre-compute booking intervals on this date — confirmed bookings of any
  // type (event-driven or standalone) consume the slot and remove it from the
  // visible availability.
  const bookingIntervals: { from: number; to: number }[] = []
  for (const b of bookings.value) {
    if (!b.start_at || !b.end_at) continue
    if (b.status === 'CANCELLED') continue
    const bs = new Date(b.start_at), be = new Date(b.end_at)
    if (bs.getFullYear() !== date.getFullYear() || bs.getMonth() !== date.getMonth() || bs.getDate() !== date.getDate()) continue
    bookingIntervals.push({
      from: bs.getHours() * 60 + bs.getMinutes(),
      to: be.getHours() * 60 + be.getMinutes(),
    })
  }

  function slotOverlapsBooking(slot: { from: number; to: number }): boolean {
    for (const ev of bookingIntervals) {
      if (ev.from < slot.to && ev.to > slot.from) return true
    }
    return false
  }

  const result: any[] = []
  for (const candidate of sorted) {
    const cSlots = ruleSlots(candidate).map(s => ({ from: timeToMins(s.from), to: timeToMins(s.to) }))
    // Step 1 — drop any whole slot that overlaps a confirmed booking
    const slotsAfterEvents = cSlots.filter(s => !slotOverlapsBooking(s))
    if (!slotsAfterEvents.length) continue

    // Step 2 — apply higher-priority rule subtraction (still interval-based to support partial overlap between rules)
    const higherIntervals: { from: number; to: number }[] = []
    for (const higher of result) {
      for (const s of (higher.time_slots ?? []) as { from: string; to: string }[]) {
        higherIntervals.push({ from: timeToMins(s.from), to: timeToMins(s.to) })
      }
    }
    const survivingMins: { from: number; to: number }[] = []
    for (const cs of slotsAfterEvents) survivingMins.push(...subtractAllIntervals(cs, higherIntervals))
    if (!survivingMins.length) continue
    const surviving = survivingMins.map(p => ({ from: minsToTime(p.from), to: minsToTime(p.to) }))
    result.push({ ...candidate, time_slots: surviving })
  }
  return result
}

function ruleColor(rule: any): string {
  if (rule.rule_type === 'CLOSED') return '#EF4444'
  if (rule.rule_type === 'RESTRICTED') return '#3B82F6'
  if (rule.rule_type === 'BLOCK') return rule.color ?? '#6B7280'
  return '#22C55E'
}

function ruleSlots(rule: any): { from: string; to: string }[] {
  const slots = rule.time_slots?.length
    ? rule.time_slots.filter((s: any) => s.from && s.to)
    : rule.time_from ? [{ from: rule.time_from.slice(0, 5), to: rule.time_to?.slice(0, 5) ?? '23:00' }] : []
  return slots.length ? slots : [{ from: '06:00', to: '23:00' }]
}

function formatSlots(rule: any): string {
  const slots = rule.time_slots?.length
    ? rule.time_slots
    : rule.time_from ? [{ from: rule.time_from, to: rule.time_to }] : []
  if (!slots.length) return 'All day'
  return slots.map((s: any) => `${formatTime(s.from)} – ${formatTime(s.to)}`).join(', ')
}

function bookingStartTime(b: any): string {
  const d = new Date(b.start_at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function bookingEndTime(b: any): string {
  const d = new Date(b.end_at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function bookingsForDate(date: Date): any[] {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime()
  const dayEnd = dayStart + 86_400_000 - 1
  return bookings.value.filter(b => {
    const bs = b.start_at ? new Date(b.start_at).getTime() : null
    const be = b.end_at ? new Date(b.end_at).getTime() : bs
    if (bs == null) return false
    return bs <= dayEnd && (be ?? bs) >= dayStart
  })
}

function bookingColor(b: any): string {
  if (b.color) return b.color
  if (b.status === 'PENDING') return '#F59E0B'
  if (b.status === 'CANCELLED') return '#9CA3AF'
  return '#1E2157'
}

function bookingStatusClass(status: string): string {
  if (status === 'CONFIRMED') return 'bg-green-50 text-green-700'
  if (status === 'PENDING') return 'bg-amber-50 text-amber-700'
  return 'bg-gray-100 text-gray-500'
}

function bookingTitle(b: any): string {
  return b.event?.title || b.notes || 'Booking'
}

function bookingHeaderColor(b: any): string {
  if (b.color) return b.color
  if (b.status === 'CONFIRMED') return '#22C55E'
  if (b.status === 'PENDING') return '#F59E0B'
  return '#9CA3AF'
}

function bookingAccentColor(b: any): string {
  return b.activity_mode?.color || bookingColor(b)
}

function bookingDurationMins(b: any): number {
  return timeToMins(bookingEndTime(b)) - timeToMins(bookingStartTime(b))
}

function onGridClick(day: Date, event: MouseEvent) {
  if ((event.target as HTMLElement).closest('[data-booking]')) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const y = event.clientY - rect.top
  const mins = GRID_START_MINS + (y / HOUR_PX) * 60
  const hours = Math.min(Math.floor(mins / 60), 22)
  const rawMins = Math.round((mins % 60) / 15) * 15
  const date = new Date(day)
  date.setHours(hours, rawMins >= 60 ? 59 : rawMins, 0, 0)
  const clickedMins = hours * 60 + (rawMins >= 60 ? 59 : rawMins)
  let endDate: Date | undefined
  let startDate: Date | undefined
  for (const rule of rulesForDate(day)) {
    for (const slot of ruleSlots(rule)) {
      if (clickedMins >= timeToMins(slot.from) && clickedMins < timeToMins(slot.to)) {
        startDate = new Date(day)
        const [fh, fm] = slot.from.split(':').map(Number)
        startDate.setHours(fh, fm, 0, 0)
        endDate = new Date(day)
        const [th, tm] = slot.to.split(':').map(Number)
        endDate.setHours(th, tm, 0, 0)
        break
      }
    }
    if (endDate) break
  }
  // Wizard mode: ignore clicks outside availability slots so users can't book
  // unavailable times. Snap to the slot's actual start when one is found.
  if (props.wizardMode) {
    if (!endDate || !startDate) return
    emit('slot-click', startDate, endDate)
    return
  }
  emit('slot-click', date, endDate)
}

function onListSlotClick(date: Date, slot: { from: string; to: string }, rule?: any) {
  emitSlotClick(date, slot, rule)
}

function emitSlotClick(day: Date, slot: { from: string; to: string }, rule?: any) {
  const start = new Date(day)
  const [fh, fm] = slot.from.split(':').map(Number)
  start.setHours(fh, fm, 0, 0)
  const end = new Date(day)
  const [th, tm] = slot.to.split(':').map(Number)
  end.setHours(th, tm, 0, 0)
  emit('slot-click', start, end, rule)
}

// True when the parent has registered this exact (date, slot) tuple as
// selected. Used by the scheduler's right-side panel flow.
function isSlotSelected(day: Date, slot: { from: string; to: string }): boolean {
  if (!props.selectedSlotKeys?.size || !props.bookableId) return false
  const start = new Date(day)
  const [fh, fm] = slot.from.split(':').map(Number)
  start.setHours(fh, fm, 0, 0)
  const end = new Date(day)
  const [th, tm] = slot.to.split(':').map(Number)
  end.setHours(th, tm, 0, 0)
  return props.selectedSlotKeys.has(`${props.bookableId}|${start.toISOString()}|${end.toISOString()}`)
}

function modesForRule(rule: any): { id: string; name: string; color: string | null }[] {
  // Prefer activity_mode_ids on the rule (most specific)
  if (rule.activity_mode_ids?.length && props.activityModes?.length) {
    return props.activityModes.filter(m => rule.activity_mode_ids.includes(m.id))
  }
  // Fall back to bookable_mode_id
  const bkModes = props.bookableModes ?? []
  if (!bkModes.length) return []
  if (!rule.bookable_mode_id) return bkModes
  return bkModes.filter(m => m.id === rule.bookable_mode_id)
}

function scrollTo8am() {
  const el = weekGridRef.value ?? dayGridRef.value
  if (el) el.scrollTop = 2 * HOUR_PX
}

async function loadBookings() {
  // In generic-events mode, items come via the customEvents prop — no fetch.
  if (props.customEvents !== undefined) return
  if (!props.bookableId) { loadedBookings.value = []; return }
  let start: Date, end: Date
  if (props.calView === 'day') {
    start = new Date(props.calDate); start.setHours(0, 0, 0, 0)
    end = new Date(props.calDate); end.setHours(23, 59, 59, 999)
  } else if (props.calView === 'week') {
    const days = weekDays.value
    start = new Date(days[0]); start.setHours(0, 0, 0, 0)
    end = new Date(days[6]); end.setHours(23, 59, 59, 999)
  } else if (props.calView === 'list') {
    const year = props.calDate.getFullYear(), month = props.calDate.getMonth()
    start = new Date(year, month, 1, 0, 0, 0, 0)
    end = new Date(year, month + 3, 0, 23, 59, 59, 999)
  } else {
    const year = props.calDate.getFullYear(), month = props.calDate.getMonth()
    start = new Date(year, month, 1, 0, 0, 0, 0)
    end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  }
  // Parent-children mutual exclusion: bookings on this bookable's ancestors
  // (e.g. the parent venue) or descendants (e.g. its sub-courts) consume the
  // slot too, so include them in the query.
  const treeIds = await resolveBookableTree(props.bookableId)
  const { data } = await (db.from as any)('bookings')
    .select('id, type, start_at, end_at, status, notes, contact_name, contact_email, contact_phone, attendee_count, custom_fields, activity_id, activity_mode_id, bookable_id, event:events(id, title), activity_mode:activity_modes(id, name, color)')
    .in('bookable_id', treeIds)
    .neq('status', 'CANCELLED')
    .gte('start_at', start.toISOString())
    .lte('start_at', end.toISOString())
    .order('start_at')
  loadedBookings.value = data ?? []
}

// Build the set of bookable ids whose bookings should block this bookable's
// slots: itself + every ancestor (walking parent_id) + every descendant
// (walking children). Cached per-bookable-id while the prop is stable.
const treeCache = new Map<string, string[]>()
async function resolveBookableTree(rootId: string): Promise<string[]> {
  const cached = treeCache.get(rootId)
  if (cached) return cached
  const set = new Set<string>([rootId])
  // Ancestors
  let cursor: string | null = rootId
  while (cursor) {
    const { data } = await (db.from as any)('bookables').select('parent_id').eq('id', cursor).maybeSingle()
    const next = data?.parent_id as string | null | undefined
    if (!next || set.has(next)) break
    set.add(next)
    cursor = next
  }
  // Descendants — BFS to handle deeper trees.
  const queue: string[] = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    const { data } = await (db.from as any)('bookables').select('id').eq('parent_id', id)
    for (const row of (data ?? []) as { id: string }[]) {
      if (!set.has(row.id)) { set.add(row.id); queue.push(row.id) }
    }
  }
  const ids = [...set]
  treeCache.set(rootId, ids)
  return ids
}

async function loadRules() {
  if (!props.bookableId) { rules.value = []; return }
  // Linked children (master_id set) inherit rules from their master — same
  // model as pages/bookables/[id].vue's propagation. Resolve which bookable
  // owns the rules first, then fetch from there.
  const { data: bk } = await (db.from as any)('bookables')
    .select('id, master_id')
    .eq('id', props.bookableId)
    .maybeSingle()
  const ruleOwner = bk?.master_id ?? props.bookableId
  const { data } = await (db.from as any)('availability_rules')
    .select('*')
    .eq('bookable_id', ruleOwner)
    .eq('is_active', true)
    .order('sort_order')
  rules.value = data ?? []
}

watch([() => props.calDate, () => props.calView], async () => {
  await loadBookings()
  nextTick(() => scrollTo8am())
}, { immediate: true })

watch(() => props.refreshKey, () => loadBookings())

watch(() => props.bookableId, async () => {
  await Promise.all([loadRules(), loadBookings()])
  nextTick(() => scrollTo8am())
}, { immediate: true })
</script>

<style scoped>
/* Pending bookings get a diagonal-stripe overlay + a slow pulse so they
   visually pop against confirmed bookings. */
.booking-pending {
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0,
    transparent 6px,
    rgba(255, 255, 255, 0.22) 6px,
    rgba(255, 255, 255, 0.22) 12px
  );
}
.booking-pending-icon {
  animation: pending-pulse 2s ease-in-out infinite;
}
@keyframes pending-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
</style>
