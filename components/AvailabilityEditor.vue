<template>
  <div class="p-6 space-y-6">

    <div v-if="loading" class="flex justify-center py-16">
      <i class="pi pi-spin pi-spinner text-2xl text-gray-300" />
    </div>

    <template v-else>

      <!-- ── Inline edit panel ──────────────────────────────────────── -->
      <div v-if="panelOpen" class="bg-white rounded-xl border border-gray-200 overflow-hidden">

        <!-- Panel header -->
        <div class="border-b border-gray-100 bg-gray-50">
          <div class="px-6 py-4 flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-gray-800">{{ editing ? 'Edit rule' : 'Add rule' }}</h3>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ editing ? `Editing "${editing.name}"` : 'Define a new availability rule for this venue.' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Panel body -->
        <div>

          <!-- Name — full width -->
          <div class="px-8 pt-7 pb-0">
            <label class="text-sm font-medium text-gray-700">Name <span class="text-gray-400 font-normal">(optional)</span></label>
            <InputText v-model="form.name" placeholder="e.g. Junior peak hours" autofocus class="w-full mt-2" />
          </div>

          <!-- Two-column grid -->
          <div class="grid grid-cols-2 gap-0 divide-x divide-gray-100 mt-6">

            <!-- Left column: Type · Days · Recurrence -->
            <div class="px-8 pb-8 space-y-7">

              <div>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Rule type</p>
                <div class="grid grid-cols-2 gap-2">
                  <button v-for="t in RULE_TYPES" :key="t.value"
                    class="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium transition-colors"
                    :class="form.rule_type === t.value ? 'text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                    :style="form.rule_type === t.value ? { background: t.color, borderColor: t.color } : {}"
                    @click="form.rule_type = t.value">
                    <i :class="`pi ${t.icon} text-sm`" />
                    {{ t.label }}
                  </button>
                </div>
              </div>

              <div>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Days of week</p>
                <div class="flex gap-1.5">
                  <button v-for="(day, di) in DAYS" :key="day"
                    class="flex-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors"
                    :class="form.days_of_week.includes(di) ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
                    @click="toggleDay(di)">
                    {{ day }}
                  </button>
                </div>
              </div>

              <div>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recurrence</p>
                <RepeatField v-model="form.rrule" v-model:exdates="form.exdates"
                  :base-date="recurrenceRefDate" :range-end="form.valid_until"
                  :show-custom="false" class="w-full" />
                <div v-if="rruleHasInterval" class="flex items-center gap-2 mt-3">
                  <span class="text-xs text-gray-500 shrink-0">Starting from</span>
                  <DatePicker v-model="form.week_anchor" date-format="d M yy" placeholder="Pick a date…" class="flex-1" />
                </div>
              </div>

              <!-- Block-specific -->
              <template v-if="form.rule_type === 'BLOCK'">
                <div>
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Block settings</p>
                  <div class="space-y-4">
                    <div>
                      <label class="text-sm font-medium text-gray-700 block mb-1.5">Capacity used</label>
                      <div class="flex items-center gap-2">
                        <InputNumber v-model="form.capacity_used" :min="1" :max="99" class="w-28" />
                        <span class="text-sm text-gray-400">slots</span>
                      </div>
                      <p class="text-xs text-gray-400 mt-1">How many concurrent slots this consumes.</p>
                    </div>
                    <div>
                      <label class="text-sm font-medium text-gray-700 block mb-2">Colour</label>
                      <div class="flex gap-2 flex-wrap">
                        <button v-for="c in BLOCK_COLORS" :key="c"
                          class="w-8 h-8 rounded-full border-2 transition-all"
                          :class="form.color === c ? 'border-gray-700 scale-110' : 'border-transparent hover:border-gray-300'"
                          :style="{ background: c }"
                          @click="form.color = c" />
                      </div>
                    </div>
                  </div>
                </div>
              </template>

            </div>

            <!-- Right column: Date range · Time slots · Modes · Limit -->
            <div class="px-8 pb-8 space-y-7">

              <div>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Date range <span class="text-gray-300 font-normal normal-case tracking-normal">(leave empty to always apply)</span></p>
                <div class="flex items-center gap-2">
                  <DatePicker v-model="form.valid_from" date-format="d M yy" placeholder="Start date"
                    :max-date="form.valid_until ?? undefined" class="flex-1" show-button-bar />
                  <span class="text-gray-400 text-sm shrink-0">→</span>
                  <DatePicker v-model="form.valid_until" date-format="d M yy" placeholder="End date"
                    :min-date="form.valid_from ?? undefined" class="flex-1" show-button-bar />
                </div>
              </div>

              <div>
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Time slots <span class="text-gray-300 font-normal normal-case tracking-normal">(leave empty for all day)</span></p>
                <div class="space-y-2">
                  <div v-for="(slot, i) in form.time_slots" :key="i" class="flex items-center gap-2">
                    <input v-model="slot.from" type="time"
                      class="flex-1 h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]"
                      @change="onSlotFromChange(slot)" />
                    <span class="text-gray-400 text-sm shrink-0">→</span>
                    <input v-model="slot.to" type="time" :min="slot.from || undefined"
                      class="flex-1 h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]"
                      @change="onSlotToChange(slot)" />
                    <button type="button" class="text-gray-300 hover:text-red-400 transition-colors shrink-0" @click="removeSlot(i)">
                      <i class="pi pi-times text-xs" />
                    </button>
                  </div>
                </div>
                <div class="flex items-center gap-3 mt-2">
                  <button type="button"
                    class="flex items-center gap-1.5 text-xs text-[#1E2157] hover:underline w-fit"
                    @click="addSlot">
                    <i class="pi pi-plus text-xs" /> Add slot
                  </button>
                  <button type="button"
                    class="flex items-center gap-1.5 text-xs hover:underline w-fit"
                    :class="showGenerator ? 'text-gray-500' : 'text-[#1E2157]'"
                    @click="showGenerator = !showGenerator">
                    <i class="pi pi-sliders-h text-xs" /> Generate slots
                  </button>
                </div>

                <!-- Slot generator -->
                <div v-if="showGenerator" class="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                  <p class="text-xs font-semibold text-indigo-700">Slot generator</p>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="text-[11px] text-gray-500 mb-1 block">Start</label>
                      <input v-model="gen.from" type="time"
                        class="w-full h-9 rounded-lg border border-gray-300 px-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />
                    </div>
                    <div>
                      <label class="text-[11px] text-gray-500 mb-1 block">End</label>
                      <input v-model="gen.to" type="time"
                        class="w-full h-9 rounded-lg border border-gray-300 px-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />
                    </div>
                    <div>
                      <label class="text-[11px] text-gray-500 mb-1 block">Slot duration (min)</label>
                      <input v-model.number="gen.duration" type="number" min="5" max="720" step="5"
                        class="w-full h-9 rounded-lg border border-gray-300 px-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />
                    </div>
                    <div>
                      <label class="text-[11px] text-gray-500 mb-1 block">Gap between slots (min)</label>
                      <input v-model.number="gen.gap" type="number" min="0" max="240" step="5"
                        class="w-full h-9 rounded-lg border border-gray-300 px-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />
                    </div>
                  </div>
                  <div v-if="generatedSlotPreview.length" class="flex flex-wrap gap-1">
                    <span v-for="(s, i) in generatedSlotPreview" :key="i"
                      class="text-[11px] bg-white border border-indigo-200 text-indigo-700 rounded px-1.5 py-0.5">
                      {{ formatTime(s.from) }}–{{ formatTime(s.to) }}
                    </span>
                  </div>
                  <p v-else-if="gen.from && gen.to && gen.duration > 0" class="text-[11px] text-gray-400 italic">No slots fit in that range.</p>
                  <div class="flex items-center gap-2">
                    <button type="button"
                      class="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors disabled:opacity-40"
                      style="background:#1E2157"
                      :disabled="!generatedSlotPreview.length"
                      @click="applyGenerated">
                      Apply {{ generatedSlotPreview.length ? `(${generatedSlotPreview.length} slots)` : '' }}
                    </button>
                    <button type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="showGenerator = false">Cancel</button>
                  </div>
                </div>
              </div>

              <!-- Activity modes (OPEN / RESTRICTED only) -->
              <div v-if="activityModeTreeNodes.length && ['OPEN', 'RESTRICTED'].includes(form.rule_type)">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Allowed modes <span class="text-gray-300 font-normal normal-case tracking-normal">(leave empty for all)</span></p>
                <TreeSelect
                  v-model="treeSelection"
                  :options="activityModeTreeNodes"
                  selection-mode="checkbox"
                  placeholder="All modes (no restriction)"
                  class="w-full"
                />
              </div>

              <!-- Concurrent booking limit (OPEN / RESTRICTED only) -->
              <div v-if="['OPEN', 'RESTRICTED'].includes(form.rule_type)">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Concurrent booking limit</p>
                <div class="flex items-center gap-3">
                  <ToggleSwitch :modelValue="form.max_concurrent !== null" @update:modelValue="v => form.max_concurrent = v ? 1 : null" />
                  <span class="text-sm text-gray-500">{{ form.max_concurrent === null ? 'Unlimited' : 'Limited to' }}</span>
                  <InputNumber v-if="form.max_concurrent !== null" v-model="form.max_concurrent" :min="1" :max="99" class="w-24" />
                  <span v-if="form.max_concurrent !== null" class="text-sm text-gray-500">at a time</span>
                </div>
                <p class="text-xs text-gray-400 mt-1.5">Limit how many bookings can overlap within this slot.</p>
              </div>

              <!-- Eligibility criteria (RESTRICTED only) — same shape as sessions -->
              <template v-if="form.rule_type === 'RESTRICTED'">
                <div class="border-t border-gray-100 pt-5">
                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Eligibility</p>
                      <p class="text-xs text-gray-500 mt-0.5">Only people who meet <strong>all</strong> conditions can book this slot.</p>
                    </div>
                    <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                      <button type="button"
                        class="px-3 py-1.5 transition-colors"
                        :class="!form.eligibility.restricted ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50 bg-white'"
                        @click="form.eligibility = { restricted: false, conditions: [] }">
                        Open to all
                      </button>
                      <button type="button"
                        class="px-3 py-1.5 transition-colors border-l border-gray-200"
                        :class="form.eligibility.restricted ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50 bg-white'"
                        @click="form.eligibility.restricted = true">
                        Restricted
                      </button>
                    </div>
                  </div>
                  <ConditionEditor v-if="form.eligibility.restricted"
                    :model-value="form.eligibility.conditions"
                    @update:model-value="v => form.eligibility.conditions = v" />
                  <div v-else class="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                    <i class="pi pi-check-circle text-green-400" />
                    Anyone with access (per the invitee list below) can book this slot.
                  </div>
                </div>

                <!-- Invitee scope (RESTRICTED only) -->
                <div class="border-t border-gray-100 pt-5">
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Who can see this slot</p>
                  <p class="text-xs text-gray-500 mb-3">Pick one or more audiences. Defaults to all members.</p>
                  <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    <button v-for="opt in INVITEE_MODES" :key="opt.value" type="button"
                      class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      @click="toggleAvailabilityInviteeMode(opt.value)">
                      <i :class="[`pi ${opt.icon}`, 'text-sm w-4 shrink-0',
                        form.invitee_modes.includes(opt.value) ? 'text-[#1E2157]' : 'text-gray-400']" />
                      <div class="flex-1">
                        <p class="text-sm font-medium" :class="form.invitee_modes.includes(opt.value) ? 'text-[#1E2157]' : 'text-gray-700'">{{ opt.label }}</p>
                        <p class="text-xs text-gray-400">{{ opt.sub }}</p>
                      </div>
                      <div class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                        :class="form.invitee_modes.includes(opt.value) ? 'bg-[#1E2157] border-[#1E2157]' : 'border-gray-300'">
                        <i v-if="form.invitee_modes.includes(opt.value)" class="pi pi-check text-white text-[10px]" />
                      </div>
                    </button>
                  </div>
                  <div v-if="form.invitee_modes.includes('groups')" class="mt-2">
                    <p class="text-xs text-gray-500 mb-1.5">Select which member groups can see and book this slot</p>
                    <MultiSelect
                      v-model="form.invitee_groups"
                      :options="memberGroups"
                      option-label="name"
                      option-value="id"
                      placeholder="Select groups…"
                      display="chip"
                      :max-selected-labels="4"
                      class="w-full" />
                  </div>
                </div>
              </template>

            </div>
          </div>

          <!-- Right: access & pricing (hidden) -->
          <div v-if="false" class="col-span-8 p-6 flex flex-col">

            <template v-if="form.rule_type === 'CLOSED'">
              <div class="flex flex-col items-center justify-center flex-1 text-center">
                <i class="pi pi-times-circle text-3xl text-red-200 mb-3" />
                <p class="text-sm text-gray-400">Closed rules block all bookings.</p>
                <p class="text-xs text-gray-300 mt-1">No pricing or access controls apply.</p>
              </div>
            </template>

            <template v-else-if="form.rule_type === 'BLOCK'">
              <div class="flex flex-col items-center justify-center flex-1 text-center">
                <i class="pi pi-lock text-3xl text-gray-200 mb-3" />
                <p class="text-sm text-gray-400">Block rules reserve capacity slots.</p>
                <p class="text-xs text-gray-300 mt-1">Configure details on the left.</p>
              </div>
            </template>

            <template v-else>
              <!-- Tier cards with line items -->
              <div v-if="form.price_tiers.length" class="space-y-3 mb-4">
                <div v-for="(tier, ti) in form.price_tiers" :key="ti"
                  class="border border-gray-200 rounded-xl overflow-hidden">
                  <!-- Tier header -->
                  <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <!-- Group pills + add -->
                    <div class="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                      <span v-for="(target, tIdx) in (tier.targets ?? [])" :key="tIdx"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                        :style="{ borderColor: singleTargetDotColor(target) + '80', background: singleTargetDotColor(target) + '20', color: singleTargetDotColor(target) }">
                        {{ singleTargetLabel(target) }}
                        <button type="button" class="hover:opacity-60 transition-opacity leading-none ml-0.5" @click="removeTarget(ti, tIdx)">
                          <i class="pi pi-times text-[8px]" />
                        </button>
                      </span>
                      <Select v-if="availableTierOptions.length"
                        :model-value="null"
                        :options="availableTierOptions"
                        option-label="label" option-value="value"
                        option-group-label="label" option-group-children="items"
                        size="small" placeholder="+ Add group"
                        @change="(e: any) => addTarget(ti, e.value)" />
                    </div>
                    <!-- Controls -->
                    <div class="flex items-center gap-1 shrink-0">
                      <Select v-model="tier.price_type" :options="PRICE_TYPES" option-label="label" option-value="value"
                        size="small" style="min-width:120px" />
                      <button type="button" title="Clone pricing tier"
                        class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-[#1E2157] hover:bg-gray-100 transition-colors"
                        @click="cloneTier(ti)">
                        <i class="pi pi-copy text-xs" />
                      </button>
                      <button type="button"
                        class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        @click="removeTier(ti)">
                        <i class="pi pi-times text-xs" />
                      </button>
                    </div>
                  </div>
                  <!-- Free -->
                  <div v-if="tier.price_type === 'free'" class="px-4 py-3 text-xs text-green-600 font-medium">
                    Free — no charge
                  </div>
                  <!-- Two fee sections -->
                  <template v-else>
                    <!-- Per-time fees -->
                    <div class="px-3 pt-3 pb-2">
                      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {{ tier.price_type === 'per_hour' ? 'Per hour' : 'Per session' }} fees
                      </p>
                      <FeeLineItemsTable
                        :model-value="tier.time_fees ?? []"
                        :tokens="bookingTokens"
                        @update:model-value="v => { tier.time_fees = v }" />
                    </div>
                    <!-- Flat / one-off fees -->
                    <div class="px-3 pt-1 pb-3 border-t border-gray-100">
                      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-2">
                        One-off fees
                      </p>
                      <FeeLineItemsTable
                        :model-value="tier.flat_fees ?? []"
                        @update:model-value="v => { tier.flat_fees = v }" />
                    </div>
                  </template>
                </div>
              </div>

              <!-- Add row dropdown -->
              <Select v-model="addTierSelection" :options="availableTierOptions"
                option-label="label" option-value="value"
                option-group-label="label" option-group-children="items"
                placeholder="+ Add a group or membership type…" size="small" class="w-full"
                :disabled="!availableTierOptions.length"
                @change="onAddTierSelect" />
              <p v-if="!availableTierOptions.length" class="text-xs text-gray-400 mt-1.5">All available groups have been added.</p>
            </template>

          </div>
        </div>

        <!-- Panel footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
          <Button label="Cancel" severity="secondary" text @click="closePanel" />
          <Button :label="editing ? 'Save changes' : 'Add rule'" :loading="saving"
            :disabled="!form.days_of_week.length"
            style="background:#1E2157;border-color:#1E2157" @click="save" />
        </div>
      </div>

      <!-- ── Rules list ─────────────────────────────────────────────── -->
      <div v-if="!panelOpen" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-gray-700">Availability rules</h3>
            <p class="text-xs text-gray-400 mt-0.5">Define when the venue is open, restricted, blocked, or closed.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- Search slide-out -->
            <div v-if="rules.length" class="relative flex items-center">
              <transition name="slide-search">
                <IconField v-if="searchOpen" class="mr-1.5">
                  <InputIcon class="pi pi-search" />
                  <InputText ref="searchInput" v-model="filterText" placeholder="Search rules…"
                    size="small" class="w-56" @blur="onSearchBlur" />
                </IconField>
              </transition>
              <Button :icon="searchOpen && filterText ? 'pi pi-times' : 'pi pi-search'"
                severity="secondary" outlined size="small"
                v-tooltip.bottom="'Search rules'"
                @click="onSearchToggle" />
            </div>
            <!-- Type filter dropdown -->
            <Select v-if="rules.length"
              v-model="filterType"
              :options="filterTypeOptions"
              option-label="label" option-value="value"
              size="small" class="w-32" />
            <Button v-if="!props.readonly" icon="pi pi-ban" size="small" severity="secondary"
              v-tooltip.bottom="'Temporarily closed'"
              :outlined="!isTempClosed"
              :class="isTempClosed ? 'bg-amber-50 border-amber-400 text-amber-700 hover:bg-amber-100' : ''"
              @click="showTempClosedDialog = true" />
            <Button v-if="!props.readonly" label="Add rule" icon="pi pi-plus" size="small"
              style="background:#1E2157;border-color:#1E2157" @click="openPanel()" />
          </div>
        </div>

        <div v-if="!rules.length" class="text-center py-12 text-gray-400">
          <i class="pi pi-calendar-times text-2xl block mb-2 text-gray-300" />
          <p class="text-sm">No rules yet. Without rules, the venue is open to anyone at all times.</p>
        </div>

        <div v-else-if="!filteredRules.length" class="text-center py-10 text-gray-400">
          <i class="pi pi-filter text-2xl block mb-2 text-gray-300" />
          <p class="text-sm">No rules match your filter.</p>
        </div>

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th v-if="!props.readonly" class="px-2 py-2.5 w-8" />
              <th class="px-5 py-2.5 text-left">Type</th>
              <th class="px-5 py-2.5 text-left">Name</th>
              <th class="px-5 py-2.5 text-left">Days</th>
              <th class="px-5 py-2.5 text-left">Time</th>
              <th v-if="activityModeTreeNodes.length" class="px-5 py-2.5 text-left">Modes</th>
              <th class="px-5 py-2.5 text-left">Date range</th>
              <th class="px-5 py-2.5 text-left">Detail</th>
              <th class="px-5 py-2.5 text-center">Active</th>
              <th v-if="!props.readonly" class="px-5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody ref="rulesTbody" class="divide-y divide-gray-100">
            <tr v-for="(rule, idx) in filteredRules" :key="rule.id"
              :data-rule-id="rule.id"
              class="hover:bg-gray-50 transition-colors">
              <td v-if="!props.readonly" class="px-2 py-3 text-center cursor-grab active:cursor-grabbing rule-drag-handle">
                <i class="pi pi-bars text-gray-300 text-xs" />
              </td>
              <td class="px-5 py-3">
                <span class="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" :class="ruleTypeBadge(rule.rule_type)">
                  <span class="w-1.5 h-1.5 rounded-full" :style="{ background: ruleColor(rule) }" />
                  {{ ruleTypeLabel(rule.rule_type) }}
                </span>
              </td>
              <td class="px-5 py-3">
                <span class="font-medium text-gray-800">{{ rule.name }}</span>
                <span v-if="props.readonly" class="ml-2 text-xs text-violet-500 italic">inherited</span>
                <i v-if="ruleIssue(rule)"
                  v-tooltip.top="{ value: ruleIssue(rule), escape: false }"
                  class="pi pi-exclamation-triangle text-amber-500 text-xs ml-2 cursor-help" />
              </td>
              <td class="px-5 py-3 text-gray-600">
                <div>{{ formatDays(rule.days_of_week) }}</div>
                <div v-if="rule.week_interval > 1 || rule.month_week || (rule.rrule && rule.rrule !== 'NONE')" class="text-xs text-indigo-500 mt-0.5">{{ formatRecurrence(rule) }}</div>
              </td>
              <td class="px-5 py-3 text-gray-600 whitespace-nowrap">{{ formatSlots(rule) }}</td>
              <td v-if="activityModeTreeNodes.length" class="px-5 py-3">
                <template v-if="rule.activity_mode_ids?.length">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="mId in rule.activity_mode_ids" :key="mId"
                      class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      :style="{ backgroundColor: (activityModes.find(m => m.id === mId)?.color ?? '#6366f1') + '20', color: activityModes.find(m => m.id === mId)?.color ?? '#6366f1' }">
                      {{ activityModes.find(m => m.id === mId)?.name ?? '?' }}
                    </span>
                  </div>
                </template>
                <span v-else class="text-xs text-gray-300">All modes</span>
              </td>
              <td class="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                <span v-if="rule.valid_from || rule.valid_until">
                  {{ rule.valid_from ? formatDate(rule.valid_from) : '…' }}
                  –
                  {{ rule.valid_until ? formatDate(rule.valid_until) : '…' }}
                </span>
                <span v-else class="text-gray-300">Always</span>
              </td>
              <td class="px-5 py-3 text-gray-500 text-xs">
                <template v-if="rule.rule_type === 'BLOCK' && rule.capacity_used > 1">Uses {{ rule.capacity_used }} slots</template>
                <template v-else-if="rule.max_concurrent">Max {{ rule.max_concurrent }} concurrent</template>
                <span v-else class="text-gray-300">—</span>
              </td>
              <!-- Pricing column hidden -->
              <td class="px-5 py-3 text-center">
                <ToggleSwitch v-if="!props.readonly" :modelValue="rule.is_active" @update:modelValue="toggleRule(rule)" />
                <span v-else class="text-xs" :class="rule.is_active ? 'text-green-500' : 'text-gray-400'">{{ rule.is_active ? 'Yes' : 'No' }}</span>
              </td>
              <td v-if="!props.readonly" class="px-5 py-3 text-right whitespace-nowrap">
                <Button icon="pi pi-copy" severity="secondary" text rounded size="small" title="Clone rule" @click="cloneRule(rule)" />
                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openPanel(rule)" />
                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteRule(rule)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── Calendar view ──────────────────────────────────────────── -->
      <div v-if="!panelOpen" class="bg-white rounded-xl border border-gray-200 overflow-hidden">

        <!-- Header: navigation + view switcher -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Button icon="pi pi-chevron-left" severity="secondary" text size="small" @click="navPrev" />
          <span class="text-sm font-semibold text-gray-800 min-w-[160px] text-center">{{ calTitle }}</span>
          <Button icon="pi pi-chevron-right" severity="secondary" text size="small" @click="navNext" />
          <Button label="Today" severity="secondary" outlined size="small" @click="calDate = new Date()" />
          <div class="flex-1" />
          <div v-if="calView === 'week' || calView === 'day'" class="flex items-center gap-3 text-xs text-gray-400 mr-3">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-green-400 inline-block" /> Open</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-blue-400 inline-block" /> Restricted</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-red-400 inline-block" /> Closed</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-gray-400 inline-block" /> Block</span>
          </div>
          <Select v-model="calView" :options="CAL_VIEWS"
            option-label="label" option-value="value" size="small" class="w-32" />
        </div>

        <!-- ── Month view ── -->
        <div v-if="calView === 'month'" class="p-3">
          <div class="grid grid-cols-7 mb-1">
            <div v-for="d in DAYS" :key="d" class="text-center text-[11px] font-semibold text-gray-400 py-1">{{ d }}</div>
          </div>
          <div class="space-y-1">
            <div v-for="(week, wi) in monthDays" :key="wi" class="grid grid-cols-7 gap-1">
              <div v-for="day in week" :key="day.toISOString()"
                class="min-h-[68px] rounded-lg p-1.5 cursor-pointer transition-colors border"
                :class="[
                  day.getMonth() !== calDate.getMonth() ? 'border-transparent bg-gray-50/50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50',
                  isToday(day) ? '!bg-blue-50 !border-blue-200' : '',
                ]"
                @click="selectDay(day)">
                <span class="text-xs font-medium block mb-1.5"
                  :class="day.getMonth() !== calDate.getMonth() ? 'text-gray-300' : isToday(day) ? 'text-blue-600 font-bold' : 'text-gray-700'">
                  {{ day.getDate() }}
                </span>
                <div class="flex flex-wrap gap-0.5">
                  <span v-for="(rule, ri) in rulesForDate(day).slice(0, 5)" :key="ri"
                    class="w-2 h-2 rounded-full shrink-0"
                    :style="{ backgroundColor: ruleColor(rule) }"
                    :title="rule.name" />
                  <span v-if="rulesForDate(day).length > 5" class="text-[9px] text-gray-400 leading-tight">+{{ rulesForDate(day).length - 5 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── List view ── -->
        <div v-else-if="calView === 'list'" class="overflow-y-auto" style="max-height:600px">
          <template v-for="(mth, mi) in listMonths" :key="mi">
            <div class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-5 py-2">
              <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">{{ mth.label }}</span>
            </div>
            <div v-if="!mth.days.length" class="px-5 py-4 text-sm text-gray-400 italic">No scheduled availability this month.</div>
            <div v-for="day in mth.days" :key="day.date.toISOString()"
              class="flex items-start gap-4 px-5 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <div class="w-16 shrink-0 text-right">
                <div class="text-[10px] font-semibold text-gray-400 uppercase">
                  {{ day.date.toLocaleDateString('en-AU', { weekday: 'short' }) }}
                </div>
                <div class="text-lg font-bold leading-none mt-0.5"
                  :class="isToday(day.date) ? 'text-blue-600' : 'text-gray-700'">
                  {{ day.date.getDate() }}
                </div>
              </div>
              <div class="flex-1 space-y-1.5 pt-0.5">
                <div v-for="rule in day.rules" :key="rule.id" class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: ruleColor(rule) }" />
                  <span class="text-sm font-medium text-gray-700">{{ rule.name }}</span>
                  <span class="text-xs text-gray-400">{{ formatSlots(rule) }}</span>
                </div>
                <div v-for="booking in day.bookings" :key="booking.id" class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-[#1E2157] shrink-0" />
                  <span class="text-sm font-medium text-[#1E2157]">Booked</span>
                  <span class="text-xs text-gray-400">{{ formatTime(bookingStartTime(booking)) }} – {{ formatTime(bookingEndTime(booking)) }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- ── Week view ── -->
        <template v-else-if="calView === 'week'">
          <div class="flex border-b border-gray-100 bg-gray-50">
            <div class="shrink-0 border-r border-gray-100" style="width:52px" />
            <div v-for="(day, di) in weekDays" :key="di"
              class="flex-1 text-center py-2 border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-gray-100 transition-colors"
              :class="isToday(day) ? 'bg-blue-50' : ''"
              @click="selectDay(day)">
              <div class="text-[10px] font-semibold text-gray-400 uppercase">{{ DAYS[di] }}</div>
              <div class="text-sm font-bold mt-0.5" :class="isToday(day) ? 'text-blue-600' : 'text-gray-700'">{{ day.getDate() }}</div>
            </div>
          </div>
          <div ref="weekGridRef" class="flex overflow-y-auto" style="height:420px">
            <div class="shrink-0 flex flex-col border-r border-gray-100" style="width:52px">
              <div v-for="label in HOUR_LABELS" :key="label"
                class="text-[10px] text-gray-300 text-right pr-2 shrink-0 leading-none"
                :style="{ height: `${HOUR_PX}px`, paddingTop: '3px' }">{{ label }}</div>
            </div>
            <div class="flex flex-1">
              <div v-for="(day, di) in weekDays" :key="di"
                class="flex-1 relative border-r border-gray-100 last:border-r-0"
                :style="{ height: `${HOUR_LABELS.length * HOUR_PX}px` }">
                <div v-for="(_, hi) in HOUR_LABELS" :key="hi"
                  class="absolute left-0 right-0 border-t border-gray-100"
                  :style="{ top: `${hi * HOUR_PX}px` }" />
                <template v-for="rule in rulesForDate(day)" :key="rule.id">
                  <div v-for="(slot, si) in ruleSlots(rule)" :key="si"
                    v-tooltip.top="{ value: ruleSlotTooltip(rule, slot, day), escape: false }"
                    class="absolute left-0.5 right-0.5 rounded-sm px-1 overflow-hidden cursor-pointer"
                    :style="{ border: `1px solid ${ruleColor(rule)}`, backgroundColor: ruleColor(rule) + '20', top: slotTop(slot.from), height: slotHeight(slot.from, slot.to) }">
                    <span class="text-[10px] font-medium truncate block leading-tight pt-0.5" :style="{ color: ruleColor(rule) }">{{ rule.name }}</span>
                  </div>
                </template>
                <template v-for="booking in bookingsForDate(day)" :key="booking.id">
                  <div class="absolute left-0.5 right-0.5 rounded-sm px-1 overflow-hidden pointer-events-none"
                    :style="{ backgroundColor: '#1E2157CC', top: slotTop(bookingStartTime(booking)), height: slotHeight(bookingStartTime(booking), bookingEndTime(booking)) }">
                    <span class="text-[10px] text-white font-medium truncate block leading-tight pt-0.5">Booked</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- ── Day view ── -->
        <template v-else>
          <div class="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <span class="text-sm font-semibold" :class="isToday(calDate) ? 'text-blue-600' : 'text-gray-800'">
              {{ calDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}
            </span>
            <span v-if="isToday(calDate)" class="text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-medium">Today</span>
          </div>
          <div v-if="!rulesForDate(calDate).length" class="py-12 text-center">
            <i class="pi pi-calendar text-2xl text-gray-200 block mb-2" />
            <p class="text-sm text-gray-400">No availability rules apply on this day.</p>
          </div>
          <div v-else ref="dayGridRef" class="flex overflow-y-auto" style="height:420px">
            <div class="shrink-0 flex flex-col border-r border-gray-100" style="width:52px">
              <div v-for="label in HOUR_LABELS" :key="label"
                class="text-[10px] text-gray-300 text-right pr-2 shrink-0 leading-none"
                :style="{ height: `${HOUR_PX}px`, paddingTop: '3px' }">{{ label }}</div>
            </div>
            <div class="flex-1 relative" :style="{ height: `${HOUR_LABELS.length * HOUR_PX}px` }">
              <div v-for="(_, hi) in HOUR_LABELS" :key="hi"
                class="absolute left-0 right-0 border-t border-gray-100"
                :style="{ top: `${hi * HOUR_PX}px` }" />
              <template v-for="rule in rulesForDate(calDate)" :key="rule.id">
                <div v-for="(slot, si) in ruleSlots(rule)" :key="si"
                  v-tooltip.top="{ value: ruleSlotTooltip(rule, slot, calDate), escape: false }"
                  class="absolute rounded-lg overflow-hidden cursor-pointer"
                  style="left: 8px; right: 8px"
                  :style="{ borderLeft: `4px solid ${ruleColor(rule)}`, border: `1px solid ${ruleColor(rule)}40`, backgroundColor: ruleColor(rule) + '18', top: slotTop(slot.from), height: slotHeight(slot.from, slot.to) }">
                  <div class="px-3 py-2">
                    <p class="text-xs font-semibold" :style="{ color: ruleColor(rule) }">{{ rule.name }}</p>
                    <p class="text-[10px] text-gray-500 mt-0.5">{{ formatTime(slot.from) }} – {{ formatTime(slot.to) }}</p>
                  </div>
                </div>
              </template>
              <template v-for="booking in bookingsForDate(calDate)" :key="booking.id">
                <div class="absolute rounded-lg overflow-hidden pointer-events-none"
                  style="left: 8px; right: 8px"
                  :style="{ borderLeft: '4px solid #1E2157', backgroundColor: '#1E2157CC', top: slotTop(bookingStartTime(booking)), height: slotHeight(bookingStartTime(booking), bookingEndTime(booking)) }">
                  <div class="px-3 py-2">
                    <p class="text-xs font-semibold text-white">Booked</p>
                    <p class="text-[10px] text-white/70 mt-0.5">{{ formatTime(bookingStartTime(booking)) }} – {{ formatTime(bookingEndTime(booking)) }}</p>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>

      </div>

    </template>
  </div>

  <!-- Temporarily closed dialog -->
  <Dialog v-model:visible="showTempClosedDialog" modal header="Temporarily closed" style="width: 420px" :draggable="false">
    <div class="space-y-4 py-2">
      <p class="text-sm text-gray-500">Block all bookings during a specific period. Leave dates empty to close indefinitely.</p>
      <div class="flex items-center gap-4">
        <span class="text-sm font-semibold text-gray-700 w-16 shrink-0">From</span>
        <DatePicker v-model="tempClosedFrom" date-format="d M yy" placeholder="Start date" class="flex-1" />
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm font-semibold text-gray-700 w-16 shrink-0">Until</span>
        <DatePicker v-model="tempClosedUntil" date-format="d M yy" placeholder="End date" :min-date="tempClosedFrom ?? undefined" class="flex-1" />
      </div>
      <div class="flex items-start gap-4">
        <span class="text-sm font-semibold text-gray-700 w-16 shrink-0 pt-1">Reason</span>
        <Textarea v-model="tempClosedReason" placeholder="e.g. Maintenance, renovation…" auto-resize rows="2" class="flex-1 text-sm" />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-between w-full">
        <Button v-if="isTempClosed" label="Remove closure" severity="danger" text size="small" @click="clearTempClosed" />
        <div class="flex gap-2 ml-auto">
          <Button label="Cancel" severity="secondary" text size="small" @click="showTempClosedDialog = false" />
          <Button label="Save" size="small" :loading="savingTempClosed" style="background:#1E2157;border-color:#1E2157" @click="saveTempClosed" />
        </div>
      </div>
    </template>
  </Dialog>

  <!-- Conflict resolution dialog -->
  <Dialog v-model:visible="conflictDialog.open" modal header="Overlapping availability rule"
    :style="{ width: '520px' }">
    <div class="flex flex-col gap-3 py-2">
      <p class="text-sm text-gray-700">
        This rule overlaps with
        <strong>{{ conflictDialog.conflicts.length }}</strong>
        existing rule{{ conflictDialog.conflicts.length === 1 ? '' : 's' }} on the same days/times:
      </p>
      <ul class="bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 space-y-1">
        <li v-for="c in conflictDialog.conflicts" :key="c.id" class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full" :style="{ background: ruleColor(c) }" />
          <span class="font-medium">{{ c.name }}</span>
          <span class="text-gray-400">— {{ formatSlots(c) }} on {{ formatDays(c.days_of_week) }}</span>
        </li>
      </ul>

      <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors mt-2"
        :class="conflictChoice === 'higher' ? 'border-[#1E2157] bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
        <RadioButton v-model="conflictChoice" value="higher" />
        <div>
          <p class="text-sm font-medium text-gray-800">Keep both — this one as higher priority</p>
          <p class="text-xs text-gray-500">
            Both rules stay active. The new rule wins display in the overlap window.
          </p>
        </div>
      </label>
      <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
        :class="conflictChoice === 'lower' ? 'border-[#1E2157] bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
        <RadioButton v-model="conflictChoice" value="lower" />
        <div>
          <p class="text-sm font-medium text-gray-800">Keep both — this one as lower priority</p>
          <p class="text-xs text-gray-500">
            Both rules stay active. The existing one wins display in the overlap window.
          </p>
        </div>
      </label>
      <label class="flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors"
        :class="conflictChoice === 'cancel' ? 'border-[#1E2157] bg-[#EFF6FF]' : 'border-gray-200 hover:bg-gray-50'">
        <RadioButton v-model="conflictChoice" value="cancel" />
        <div>
          <p class="text-sm font-medium text-gray-800">Don't create</p>
          <p class="text-xs text-gray-500">Cancel and go back to editing.</p>
        </div>
      </label>
    </div>
    <template #footer>
      <Button label="Back" severity="secondary" text size="small" @click="conflictDialog.open = false" />
      <Button label="Apply" size="small" style="background:#1E2157;border-color:#1E2157"
        @click="resolveConflict(conflictChoice)" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'
import Sortable from 'sortablejs'
import { rruleToSummary } from '~/composables/useRepeatOptions'

const props = defineProps<{ bookableId: string; readonly?: boolean }>()
const emit = defineEmits<{ saved: [] }>()

const db = useDb()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)

// Temporarily closed
const showTempClosedDialog = ref(false)
const savingTempClosed = ref(false)
const isTempClosed = ref(false)
const tempClosedFrom = ref<Date | null>(null)
const tempClosedUntil = ref<Date | null>(null)
const tempClosedReason = ref('')

async function loadTempClosed() {
  const { data } = await (db.from as any)('bookables').select('closed_from, closed_until, closure_reason').eq('id', props.bookableId).maybeSingle()
  isTempClosed.value = !!(data?.closed_from || data?.closed_until)
  tempClosedFrom.value = data?.closed_from ? new Date(data.closed_from) : null
  tempClosedUntil.value = data?.closed_until ? new Date(data.closed_until) : null
  tempClosedReason.value = data?.closure_reason ?? ''
}

async function saveTempClosed() {
  savingTempClosed.value = true
  const updates = {
    closed_from: tempClosedFrom.value ? tempClosedFrom.value.toISOString().slice(0, 10) : null,
    closed_until: tempClosedUntil.value ? tempClosedUntil.value.toISOString().slice(0, 10) : null,
    closure_reason: tempClosedReason.value || null,
  }
  await (db.from as any)('bookables').update(updates).eq('id', props.bookableId)
  isTempClosed.value = !!(updates.closed_from || updates.closed_until)
  savingTempClosed.value = false
  showTempClosedDialog.value = false
}

async function clearTempClosed() {
  savingTempClosed.value = true
  await (db.from as any)('bookables').update({ closed_from: null, closed_until: null, closure_reason: null }).eq('id', props.bookableId)
  isTempClosed.value = false
  tempClosedFrom.value = null
  tempClosedUntil.value = null
  tempClosedReason.value = ''
  savingTempClosed.value = false
  showTempClosedDialog.value = false
}
const rules = ref<any[]>([])
const rulesTbody = ref<HTMLElement | null>(null)
let sortableInstance: any = null

async function persistRuleOrder(orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    const ruleId = orderedIds[i]
    const local = rules.value.find(r => r.id === ruleId)
    if (local) local.sort_order = i
    await (db.from as any)('availability_rules').update({ sort_order: i }).eq('id', ruleId)
  }
}

watch(rulesTbody, (el) => {
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null }
  if (!el || props.readonly) return
  sortableInstance = Sortable.create(el, {
    handle: '.rule-drag-handle',
    animation: 150,
    ghostClass: 'opacity-30',
    onEnd: async () => {
      const orderedIds = Array.from(el.querySelectorAll<HTMLTableRowElement>('tr[data-rule-id]'))
        .map(r => r.dataset.ruleId!)
        .filter(Boolean)
      await persistRuleOrder(orderedIds)
    },
  })
})

onUnmounted(() => {
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null }
})
const bookings = ref<any[]>([])
const memberGroups = ref<any[]>([])
const bookableModes = ref<any[]>([])
const activityModes = ref<any[]>([])
const linkedActivities = ref<any[]>([])

const groupedActivityModes = computed(() =>
  linkedActivities.value
    .map(act => ({
      label: act.name,
      activityId: act.id,
      items: activityModes.value.filter(m => m.activity_id === act.id),
    }))
    .filter(g => g.items.length)
)

const activityModeTreeNodes = computed(() =>
  linkedActivities.value
    .map(act => ({
      key: `act-${act.id}`,
      label: act.name,
      children: activityModes.value
        .filter(m => m.activity_id === act.id)
        .map(m => ({ key: m.id, label: m.name, data: m })),
    }))
    .filter(n => n.children.length)
)

const treeSelection = computed({
  get: () => {
    const sel: Record<string, any> = {}
    for (const mId of form.value.activity_mode_ids) {
      sel[mId] = { checked: true }
    }
    // Mark parent as partialChecked / checked based on children
    for (const node of activityModeTreeNodes.value) {
      const childCount = node.children.length
      const checkedCount = node.children.filter(c => sel[c.key]?.checked).length
      if (checkedCount === childCount && childCount > 0) {
        sel[node.key] = { checked: true, partialChecked: false }
      } else if (checkedCount > 0) {
        sel[node.key] = { checked: false, partialChecked: true }
      }
    }
    return sel
  },
  set: (val: Record<string, any>) => {
    form.value.activity_mode_ids = Object.entries(val)
      .filter(([k, v]) => !k.startsWith('act-') && v.checked)
      .map(([k]) => k)
  },
})

const bookingTokens = [
  { label: 'Date', value: '{date}' },
  { label: 'Start time', value: '{start_time}' },
  { label: 'End time', value: '{end_time}' },
  { label: 'Duration', value: '{duration}' },
]
const filterText = ref('')
const filterType = ref('')
const searchOpen = ref(false)
const searchInput = ref<any>(null)

const filterTypeOptions = computed(() => [
  { label: 'All types', value: '' },
  ...RULE_TYPES.map(t => ({ label: t.label, value: t.value })),
])

function onSearchBlur() {
  if (!filterText.value) searchOpen.value = false
}

async function onSearchToggle() {
  if (searchOpen.value && filterText.value) {
    filterText.value = ''
    return
  }
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    await nextTick()
    searchInput.value?.$el?.focus?.()
    if (searchInput.value?.$el?.nodeName !== 'INPUT') searchInput.value?.$el?.querySelector('input')?.focus()
  }
}

const filteredRules = computed(() => {
  let result = rules.value
  if (filterType.value) result = result.filter(r => r.rule_type === filterType.value)
  if (filterText.value.trim()) {
    const q = filterText.value.toLowerCase()
    result = result.filter(r =>
      r.name.toLowerCase().includes(q) ||
      formatDays(r.days_of_week).toLowerCase().includes(q)
    )
  }
  return result
})

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIME_LABELS = ['6am', '9am', '12pm', '3pm', '6pm', '9pm', '11pm']
const DAY_START_MINS = 6 * 60
const DAY_END_MINS = 23 * 60
const TOTAL_MINS = DAY_END_MINS - DAY_START_MINS

// ── Calendar view ────────────────────────────────────────────────────────────
const HOUR_PX = 56
const GRID_START_MINS = 6 * 60
const HOUR_LABELS = ['6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm']
const CAL_VIEWS: { label: string; value: 'day' | 'week' | 'month' | 'list' }[] = [
  { label: 'Day',   value: 'day' },
  { label: 'Week',  value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'List',  value: 'list' },
]
const calView = ref<'day' | 'week' | 'month' | 'list'>('week')
const weekGridRef = ref<HTMLElement | null>(null)
const dayGridRef = ref<HTMLElement | null>(null)
const calDate = ref(new Date())

const calTitle = computed(() => {
  if (calView.value === 'month') return calDate.value.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  if (calView.value === 'week') {
    const days = weekDays.value
    const start = days[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    const end = days[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${start} – ${end}`
  }
  return calDate.value.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

const weekDays = computed(() => {
  const dow = (calDate.value.getDay() + 6) % 7
  const monday = new Date(calDate.value)
  monday.setDate(calDate.value.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
})

const monthDays = computed(() => {
  const year = calDate.value.getFullYear()
  const month = calDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - startDow)
  const weeks: Date[][] = []
  const cur = new Date(start)
  while (cur <= lastDay || weeks.length < 4) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
    if (cur > lastDay && weeks.length >= 4) break
  }
  return weeks
})

const listMonths = computed(() => {
  const year = calDate.value.getFullYear(), month = calDate.value.getMonth()
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

function scrollGridTo8am() {
  const target = (weekGridRef.value ?? dayGridRef.value) as HTMLElement | null
  if (target) target.scrollTop = 2 * HOUR_PX  // 8am = 2 hours from 6am start
}

function navPrev() {
  const d = new Date(calDate.value)
  if (calView.value === 'month') d.setMonth(d.getMonth() - 1)
  else if (calView.value === 'week') d.setDate(d.getDate() - 7)
  else d.setDate(d.getDate() - 1)
  calDate.value = d
}

function navNext() {
  const d = new Date(calDate.value)
  if (calView.value === 'month') d.setMonth(d.getMonth() + 1)
  else if (calView.value === 'week') d.setDate(d.getDate() + 7)
  else d.setDate(d.getDate() + 1)
  calDate.value = d
}

function selectDay(day: Date) {
  calDate.value = new Date(day)
  calView.value = 'day'
}

function isToday(date: Date): boolean {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
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
  // 'YYYY-MM-DD' (stored format) — parse as local midnight, not UTC.
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return new Date(s)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function formatLocalDate(d: Date): string {
  // Serialize a Date to 'YYYY-MM-DD' using its LOCAL components, so a date
  // picked in NZT doesn't shift backward through toISOString().
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

// Subtract a single higher-priority interval from a lower-priority interval, returning the remaining pieces.
function subtractInterval(base: { from: number; to: number }, sub: { from: number; to: number }): { from: number; to: number }[] {
  if (sub.to <= base.from || sub.from >= base.to) return [base]               // no overlap
  if (sub.from <= base.from && sub.to >= base.to) return []                    // fully covered
  if (sub.from <= base.from && sub.to < base.to) return [{ from: sub.to, to: base.to }] // trim left
  if (sub.from > base.from && sub.to >= base.to) return [{ from: base.from, to: sub.from }] // trim right
  return [{ from: base.from, to: sub.from }, { from: sub.to, to: base.to }]    // split
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

function rulesForDate(date: Date): any[] {
  // Higher-priority rules carve out their windows from lower-priority ones.
  const applicable = rules.value.filter(r => ruleAppliesOnDate(r, date))
  const sorted = [...applicable].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const result: any[] = []
  for (const candidate of sorted) {
    const cSlots = ruleSlots(candidate).map(s => ({ from: timeToMins(s.from), to: timeToMins(s.to) }))
    // Collect all higher-priority slot intervals already accepted into result.
    const higherIntervals: { from: number; to: number }[] = []
    for (const higher of result) {
      for (const s of (higher.time_slots ?? []) as { from: string; to: string }[]) {
        higherIntervals.push({ from: timeToMins(s.from), to: timeToMins(s.to) })
      }
    }
    const survivingMins: { from: number; to: number }[] = []
    for (const cs of cSlots) {
      survivingMins.push(...subtractAllIntervals(cs, higherIntervals))
    }
    if (!survivingMins.length) continue
    const surviving = survivingMins.map(p => ({ from: minsToTime(p.from), to: minsToTime(p.to) }))
    result.push({ ...candidate, time_slots: surviving })
  }
  return result
}

function ruleSlots(rule: any): { from: string; to: string }[] {
  const slots: { from: string; to: string }[] = rule.time_slots?.length
    ? rule.time_slots.filter((s: any) => s.from && s.to)
    : rule.time_from ? [{ from: rule.time_from.slice(0, 5), to: rule.time_to?.slice(0, 5) ?? '23:00' }] : []
  return slots.length ? slots : [{ from: '06:00', to: '23:00' }]
}

function slotTop(timeStr: string): string {
  const mins = timeToMins(timeStr)
  return `${Math.max(mins - GRID_START_MINS, 0) / 60 * HOUR_PX}px`
}

function slotHeight(from: string, to: string): string {
  const h = Math.max(timeToMins(to) - timeToMins(from), 5) / 60 * HOUR_PX
  return `${h}px`
}

const RULE_TYPES = [
  { value: 'OPEN',       label: 'Open',       icon: 'pi-check-circle', color: '#22C55E' },
  { value: 'RESTRICTED', label: 'Restricted',  icon: 'pi-users',        color: '#3B82F6' },
  { value: 'CLOSED',     label: 'Closed',      icon: 'pi-times-circle', color: '#EF4444' },
  { value: 'BLOCK',      label: 'Block',       icon: 'pi-lock',         color: '#6B7280' },
]

// Mirrors the session-level invitee model so admins see the same options.
const INVITEE_MODES = [
  { value: 'all_members', label: 'All members',     sub: 'Anyone in your member list',                icon: 'pi-users' },
  { value: 'public',      label: 'Public',          sub: 'Visible on the public booking page',        icon: 'pi-globe' },
  { value: 'groups',      label: 'Specific groups', sub: 'Choose which member groups can book',       icon: 'pi-filter' },
]
function toggleAvailabilityInviteeMode(value: string) {
  const arr = form.value.invitee_modes
  const idx = arr.indexOf(value)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(value)
  if (!arr.length) arr.push('all_members')
}

const MEMBERSHIP_TYPES = [
  { label: 'Junior',         value: 'junior',         color: '#8B5CF6' },
  { label: 'Senior',         value: 'senior',         color: '#3B82F6' },
  { label: 'Social',         value: 'social',         color: '#10B981' },
  { label: 'Coaching staff', value: 'coaching_staff', color: '#F59E0B' },
  { label: 'Committee',      value: 'committee',      color: '#EC4899' },
]

const BLOCK_COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#10B981', '#1E2157']

const PRICE_TYPES = [
  { label: 'Free',        value: 'free' },
  { label: 'Per hour',    value: 'per_hour' },
  { label: 'Per session', value: 'per_session' },
]

// ── Load ────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  const [{ data: r }, { data: g }, { data: m }, { data: ab }] = await Promise.all([
    (db.from as any)('availability_rules').select('*').eq('bookable_id', props.bookableId).order('sort_order').order('created_at'),
    db.from('member_groups').select('id, name, color, parent_id').eq('org_id', orgId.value).order('sort_order').order('name'),
    (db.from as any)('bookable_modes').select('id, name, color').eq('bookable_id', props.bookableId).order('name'),
    (db.from as any)('activity_bookables').select('activity_id').eq('bookable_id', props.bookableId),
  ])
  rules.value = r ?? []
  memberGroups.value = g ?? []
  bookableModes.value = m ?? []
  const activityIds = (ab ?? []).map((row: any) => row.activity_id)
  if (activityIds.length) {
    const [{ data: acts }, { data: am }] = await Promise.all([
      (db.from as any)('activities').select('id, name').in('id', activityIds).order('name'),
      (db.from as any)('activity_modes').select('id, name, color, activity_id').in('activity_id', activityIds).order('name'),
    ])
    linkedActivities.value = acts ?? []
    activityModes.value = am ?? []
  } else {
    linkedActivities.value = []
    activityModes.value = []
  }
  loading.value = false
  loadTempClosed()
  loadBookingsForView()
  nextTick(() => scrollGridTo8am())
}

watch(() => props.bookableId, load, { immediate: true })

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function ruleTop(timeFrom: string | null): string {
  if (!timeFrom) return '0'
  return `${(Math.max(timeToMins(timeFrom) - DAY_START_MINS, 0) / TOTAL_MINS) * 100}`
}

function ruleHeight(timeFrom: string | null, timeTo: string | null): string {
  if (!timeFrom || !timeTo) return '100%'
  const from = Math.max(timeToMins(timeFrom) - DAY_START_MINS, 0)
  const to = Math.min(timeToMins(timeTo) - DAY_START_MINS, TOTAL_MINS)
  return `${Math.max((to - from) / TOTAL_MINS * 100, 2)}%`
}

function ruleColor(rule: any): string {
  if (rule.rule_type === 'CLOSED') return '#EF4444'
  if (rule.rule_type === 'RESTRICTED') return '#3B82F6'
  if (rule.rule_type === 'BLOCK') return rule.color ?? '#6B7280'
  return '#22C55E'
}

function ruleTypeBadge(type: string): string {
  if (type === 'CLOSED') return 'bg-red-50 text-red-600'
  if (type === 'RESTRICTED') return 'bg-blue-50 text-blue-600'
  if (type === 'BLOCK') return 'bg-gray-100 text-gray-600'
  return 'bg-green-50 text-green-600'
}

function ruleTypeLabel(type: string): string {
  return RULE_TYPES.find(t => t.value === type)?.label ?? type
}

function rulesForDay(dayIndex: number): any[] {
  return rules.value.filter(r => r.is_active && r.days_of_week.includes(dayIndex))
}

function formatDays(days: number[]): string {
  if (!days?.length) return '—'
  if (days.length === 7) return 'Every day'
  const sorted = [...days].sort()
  const parts: string[] = []
  let start = sorted[0], prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] !== prev + 1) {
      parts.push(prev - start >= 2 ? `${DAYS[start]}–${DAYS[prev]}` : sorted.slice(sorted.indexOf(start), sorted.indexOf(prev) + 1).map(d => DAYS[d]).join(', '))
      start = sorted[i]; prev = sorted[i]
    } else { prev = sorted[i] }
  }
  return parts.join(', ')
}

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(t: string | null): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m ? `${hour}:${String(m).padStart(2, '0')}${ampm}` : `${hour}${ampm}`
}

// ── Tier display helpers ──────────────────────────────────────────────────────

function singleTargetLabel(target: any): string {
  if (target.eligibility === 'anyone') return 'Anyone'
  if (target.eligibility === 'members_only') return 'Members only'
  if (target.eligibility === 'membership_type') {
    return MEMBERSHIP_TYPES.find(m => m.value === target.membership_type)?.label ?? target.membership_type ?? '?'
  }
  if (target.eligibility === 'group') {
    return memberGroups.value.find(g => g.id === target.group_id)?.name ?? 'Group'
  }
  return '?'
}

function singleTargetDotColor(target: any): string {
  if (target.eligibility === 'group') return memberGroups.value.find(g => g.id === target.group_id)?.color ?? '#94a3b8'
  if (target.eligibility === 'membership_type') return MEMBERSHIP_TYPES.find(m => m.value === target.membership_type)?.color ?? '#94a3b8'
  if (target.eligibility === 'members_only') return '#3B82F6'
  return '#94a3b8'
}

function tierWhoLabel(tier: any): string {
  if (tier.targets?.length) return tier.targets.map((t: any) => singleTargetLabel(t)).join(', ')
  return singleTargetLabel(tier)
}

function tierDotColor(tier: any): string {
  if (tier.targets?.length) return singleTargetDotColor(tier.targets[0])
  return singleTargetDotColor(tier)
}

function tierTimeTotal(tier: any): number {
  const items: any[] = tier.time_fees ?? (tier.line_items ?? [])
  return items.reduce((s, li) => s + (li.amount ?? 0), 0)
}

function tierFlatTotal(tier: any): number {
  return (tier.flat_fees ?? []).reduce((s: number, li: any) => s + (li.amount ?? 0), 0)
}

// ── Panel ────────────────────────────────────────────────────────────────────

const panelOpen = ref(false)
const editing = ref<any>(null)
const addTierSelection = ref<string | null>(null)

const form = ref({
  name: '',
  rule_type: 'OPEN' as string,
  days_of_week: [] as number[],
  time_slots: [{ from: '', to: '' }] as { from: string; to: string }[],
  rrule: '',
  exdates: [] as string[],
  week_interval: 1,
  week_anchor: null as Date | null,
  month_week: null as number | null,
  capacity_used: 1,
  color: '#6B7280',
  price_tiers: [] as any[],
  bookable_mode_id: null as string | null,
  activity_mode_ids: [] as string[],
  max_concurrent: null as number | null,
  valid_from: null as Date | null,
  valid_until: null as Date | null,
  // RESTRICTED-only: criteria conditions + invitee group scoping (mirrors sessions).
  invitee_modes: ['all_members'] as string[],
  invitee_groups: [] as string[],
  eligibility: { restricted: false, conditions: [] } as { restricted: boolean; conditions: any[] },
})

function migrateLineItems(tier: any): any {
  let result = { ...tier }
  // Migrate time_fees/flat_fees
  if (!result.time_fees || !result.flat_fees) {
    const oldItems: any[] = result.line_items ?? []
    const timeFees = oldItems.length
      ? oldItems
      : (result.price != null && result.price_type !== 'free')
        ? [{ id: crypto.randomUUID(), name: '', xero_code: '', amount: result.price }]
        : []
    result = { ...result, time_fees: timeFees, flat_fees: result.flat_fees ?? [] }
  }
  // Migrate single eligibility field to targets array
  if (!result.targets) {
    const target: any = { eligibility: result.eligibility ?? 'anyone' }
    if (result.group_id) target.group_id = result.group_id
    if (result.membership_type) target.membership_type = result.membership_type
    result = { ...result, targets: [target] }
  }
  return result
}

function expandLegacyTiers(tiers: any[]): any[] {
  const expanded: any[] = []
  for (const tier of tiers) {
    if (tier.eligibility === 'groups' && Array.isArray(tier.group_ids)) {
      // Old multi-group tier → one tier with multiple targets
      expanded.push(migrateLineItems({
        ...tier,
        targets: tier.group_ids.map((gid: string) => ({ eligibility: 'group', group_id: gid })),
      }))
    } else if (tier.eligibility === 'membership_types' && Array.isArray(tier.membership_types)) {
      expanded.push(migrateLineItems({
        ...tier,
        targets: tier.membership_types.map((mt: string) => ({ eligibility: 'membership_type', membership_type: mt })),
      }))
    } else {
      expanded.push(migrateLineItems({ ...tier }))
    }
  }
  return expanded
}

function slotsFromRule(rule: any): { from: string; to: string }[] {
  if (rule.time_slots?.length) return rule.time_slots.map((s: any) => ({ from: s.from ?? '', to: s.to ?? '' }))
  if (rule.time_from) return [{ from: rule.time_from.slice(0, 5), to: rule.time_to?.slice(0, 5) ?? '' }]
  return [{ from: '', to: '' }]
}

function openPanel(rule?: any) {
  editing.value = rule ?? null
  form.value = rule ? {
    name: rule.name,
    rule_type: rule.rule_type,
    days_of_week: [...rule.days_of_week],
    time_slots: slotsFromRule(rule),
    rrule: rule.rrule ?? '',
    week_interval: rule.week_interval ?? 1,
    week_anchor: rule.week_anchor ? new Date(rule.week_anchor) : null,
    month_week: rule.month_week ?? null,
    capacity_used: rule.capacity_used ?? 1,
    color: rule.color ?? '#6B7280',
    price_tiers: expandLegacyTiers(rule.price_tiers ?? []),
    bookable_mode_id: rule.bookable_mode_id ?? null,
    activity_mode_ids: rule.activity_mode_ids ?? [],
    max_concurrent: rule.max_concurrent ?? null,
    valid_from: rule.valid_from ? new Date(rule.valid_from) : null,
    valid_until: rule.valid_until ? new Date(rule.valid_until) : null,
    invitee_modes: rule.invitee_modes ?? ['all_members'],
    invitee_groups: rule.invitee_groups ?? [],
    eligibility: rule.eligibility?.restricted
      ? { restricted: true, conditions: rule.eligibility.conditions ?? [] }
      : { restricted: false, conditions: [] },
  } : {
    name: '', rule_type: 'OPEN', days_of_week: [],
    time_slots: [{ from: '', to: '' }],
    rrule: '',
    week_interval: 1, week_anchor: null, month_week: null,
    capacity_used: 1, color: '#6B7280', price_tiers: [],
    bookable_mode_id: null,
    activity_mode_ids: [],
    max_concurrent: null,
    valid_from: null,
    valid_until: null,
    invitee_modes: ['all_members'],
    invitee_groups: [],
    eligibility: { restricted: false, conditions: [] },
  }
  addTierSelection.value = null
  showGenerator.value = false
  panelOpen.value = true
}

function closePanel() {
  panelOpen.value = false
  editing.value = null
}

// ── Add-tier dropdown ─────────────────────────────────────────────────────────

function targetOptionKey(target: any): string {
  if (target.eligibility === 'group') return `g:${target.group_id}`
  if (target.eligibility === 'membership_type') return `mt:${target.membership_type}`
  return target.eligibility
}

function targetFromKey(val: string): any {
  if (val === 'anyone') return { eligibility: 'anyone' }
  if (val === 'members_only') return { eligibility: 'members_only' }
  if (val.startsWith('mt:')) return { eligibility: 'membership_type', membership_type: val.slice(3) }
  if (val.startsWith('g:')) return { eligibility: 'group', group_id: val.slice(2) }
  return null
}

const allUsedTargetKeys = computed(() => {
  const keys = new Set<string>()
  for (const tier of form.value.price_tiers) {
    for (const t of tier.targets ?? []) {
      keys.add(targetOptionKey(t))
    }
  }
  return keys
})

const availableTierOptions = computed(() => {
  const used = allUsedTargetKeys.value
  const groups: { label: string; items: { label: string; value: string }[] }[] = []

  // General
  const general: { label: string; value: string }[] = []
  if (!used.has('anyone')) general.push({ label: 'Anyone', value: 'anyone' })
  if (!used.has('members_only')) general.push({ label: 'Members only', value: 'members_only' })
  if (general.length) groups.push({ label: 'General', items: general })

  // Membership types
  const mtItems = MEMBERSHIP_TYPES.filter(mt => !used.has(`mt:${mt.value}`))
    .map(mt => ({ label: mt.label, value: `mt:${mt.value}` }))
  if (mtItems.length) groups.push({ label: 'Membership Types', items: mtItems })

  // Member groups — top-level parents become section headers; children nest underneath
  const topLevel = memberGroups.value.filter(g => !g.parent_id && !used.has(`g:${g.id}`))
  const childrenOf = (id: string) => memberGroups.value.filter(g => g.parent_id === id && !used.has(`g:${g.id}`))

  for (const parent of topLevel) {
    const children = childrenOf(parent.id)
    const items: { label: string; value: string }[] = [
      { label: parent.name, value: `g:${parent.id}` },
      ...children.map(c => ({ label: `  ${c.name}`, value: `g:${c.id}` })),
    ]
    groups.push({ label: parent.name, items })
  }

  // Orphaned children whose parent is already used — show in a fallback group
  const orphans = memberGroups.value.filter(g => g.parent_id && !used.has(`g:${g.id}`) && used.has(`g:${g.parent_id}`))
  if (orphans.length) groups.push({ label: 'Sub-groups', items: orphans.map(g => ({ label: g.name, value: `g:${g.id}` })) })

  return groups
})

function onAddTierSelect() {
  const val = addTierSelection.value
  if (!val) return
  const target = targetFromKey(val)
  if (target) {
    form.value.price_tiers.push({ price_type: 'per_hour', price: null, time_fees: [], flat_fees: [], targets: [target] })
  }
  nextTick(() => { addTierSelection.value = null })
}

function addTarget(ti: number, val: string) {
  const target = targetFromKey(val)
  if (target) form.value.price_tiers[ti].targets = [...(form.value.price_tiers[ti].targets ?? []), target]
}

function removeTarget(ti: number, tIdx: number) {
  const targets = [...(form.value.price_tiers[ti].targets ?? [])]
  targets.splice(tIdx, 1)
  form.value.price_tiers[ti].targets = targets
}

function removeTier(i: number) {
  form.value.price_tiers.splice(i, 1)
}

function cloneTier(i: number) {
  const src = form.value.price_tiers[i]
  const clone = JSON.parse(JSON.stringify(src))
  clone.time_fees = (clone.time_fees ?? []).map((li: any) => ({ ...li, id: crypto.randomUUID() }))
  clone.flat_fees = (clone.flat_fees ?? []).map((li: any) => ({ ...li, id: crypto.randomUUID() }))
  form.value.price_tiers.splice(i + 1, 0, clone)
}

// ── Save / delete ─────────────────────────────────────────────────────────────

// ── Conflict detection + dialog ──────────────────────────
const conflictDialog = reactive({
  open: false,
  conflicts: [] as any[],
  pendingPayload: null as any,
})
const conflictChoice = ref<'higher' | 'lower' | 'cancel'>('higher')

function ruleSlotTooltip(rule: any, slot: { from: string; to: string }, date: Date): string {
  const lines: string[] = []
  lines.push(`<strong>${rule.name}</strong>`)
  lines.push(`${ruleTypeLabel(rule.rule_type)} · ${formatTime(slot.from)} – ${formatTime(slot.to)}`)
  const rank = (rules.value.findIndex(r => r.id === rule.id)) + 1
  if (rank > 0) lines.push(`Priority #${rank}`)
  // Mention any rules being shadowed in this slot
  const slotStart = timeToMins(slot.from), slotEnd = timeToMins(slot.to)
  const shadowed = rules.value.filter(r =>
    r.is_active && r.id !== rule.id && (r.sort_order ?? 0) > (rule.sort_order ?? 0) &&
    ruleAppliesOnDate(r, date) &&
    (r.time_slots ?? []).some((s: any) => {
      if (!s?.from || !s?.to) return false
      return timeToMins(s.from) < slotEnd && timeToMins(s.to) > slotStart
    })
  )
  if (shadowed.length) {
    lines.push(`<span style="opacity:0.7">Hides: ${shadowed.map((r: any) => r.name).join(', ')}</span>`)
  }
  return lines.join('<br>')
}

function ruleIssue(rule: any): string {
  const messages: string[] = []
  if (!rule.is_active) {
    if (rule.replaced_by_rule_id) {
      const replacer = rules.value.find(r => r.id === rule.replaced_by_rule_id)
      messages.push(`Hidden — replaced by <strong>${replacer?.name ?? 'another rule'}</strong>. Will restore automatically when that rule is deleted.`)
    } else {
      messages.push('Currently inactive — bookings can\'t be made against this rule.')
    }
  }
  // Detect time-slot validity (from must be < to)
  const invalidSlots = (rule.time_slots ?? []).filter((s: any) => s?.from && s?.to && timeToMins(s.from) >= timeToMins(s.to))
  if (invalidSlots.length) {
    messages.push(`${invalidSlots.length} time slot${invalidSlots.length === 1 ? ' has' : 's have'} an end time before the start.`)
  }
  // Detect date range / day-of-week mismatch
  if (rule.is_active && (rule.valid_from || rule.valid_until) && rule.days_of_week?.length) {
    const start = rule.valid_from ? parseLocalDate(rule.valid_from) : new Date(2020, 0, 1)
    const end = rule.valid_until ? parseLocalDate(rule.valid_until) : new Date(2099, 11, 31)
    let hasMatch = false
    const cur = new Date(start)
    while (cur <= end && !hasMatch) {
      const dow = (cur.getDay() + 6) % 7
      if (rule.days_of_week.includes(dow)) hasMatch = true
      cur.setDate(cur.getDate() + 1)
      if (cur.getTime() - start.getTime() > 86_400_000 * 14) break // safety cap (a fortnight covers all weekdays)
    }
    if (!hasMatch) {
      const dayNames = rule.days_of_week.map((d: number) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join('/')
      messages.push(`The date range doesn't include any ${dayNames}, so this rule never applies. Either widen the date range or change the day(s).`)
    }
  }
  // Detect overlap with higher-priority active rules
  if (rule.is_active) {
    const overlaps = rules.value.filter(r =>
      r.is_active && r.id !== rule.id && (r.sort_order ?? 0) < (rule.sort_order ?? 0) && rulesOverlap(rule, r),
    )
    if (overlaps.length) {
      const names = overlaps.map(r => `<strong>${r.name}</strong>`).join(', ')
      messages.push(`Shadowed in overlap window by higher-priority ${overlaps.length === 1 ? 'rule' : 'rules'}: ${names}.`)
    }
  }
  return messages.join('<br><br>')
}

function rulesOverlap(a: any, b: any): boolean {
  // Same days?
  const dayOverlap = (a.days_of_week ?? []).some((d: number) => (b.days_of_week ?? []).includes(d))
  if (!dayOverlap) return false
  // Time slots intersect?
  const aSlots = (a.time_slots ?? []).filter((s: any) => s?.from && s?.to)
  const bSlots = (b.time_slots ?? []).filter((s: any) => s?.from && s?.to)
  if (!aSlots.length || !bSlots.length) return false
  for (const sa of aSlots) {
    const aStart = timeToMins(sa.from), aEnd = timeToMins(sa.to)
    for (const sb of bSlots) {
      const bStart = timeToMins(sb.from), bEnd = timeToMins(sb.to)
      if (aStart < bEnd && bStart < aEnd) return true
    }
  }
  return false
}

function findConflictingRules(payload: any, ignoreId: string | null) {
  return rules.value.filter(r => r.is_active && r.id !== ignoreId && rulesOverlap(payload, r))
}

async function save() {
  saving.value = true
  const isBlock = form.value.rule_type === 'BLOCK'
  const validSlots = form.value.time_slots.filter(s => s.from && s.to)
  const rrule = form.value.rrule && form.value.rrule !== 'NONE' ? form.value.rrule : null
  const { interval: derivedInterval, monthWeek: derivedMonthWeek } = rrule
    ? parseRruleRecurrence(rrule)
    : { interval: form.value.week_interval ?? 1, monthWeek: form.value.month_week ?? null }
  const payload: any = {
    bookable_id: props.bookableId,
    name: form.value.name,
    rule_type: form.value.rule_type,
    days_of_week: form.value.days_of_week,
    time_from: validSlots[0]?.from || null,
    time_to: validSlots[0]?.to || null,
    time_slots: validSlots,
    rrule,
    week_interval: derivedMonthWeek ? 1 : derivedInterval,
    week_anchor: !derivedMonthWeek && derivedInterval > 1 && form.value.week_anchor
      ? formatLocalDate(form.value.week_anchor) : null,
    month_week: derivedMonthWeek ?? null,
    eligibility: 'anyone',
    membership_types: [],
    group_ids: [],
    capacity_used: isBlock ? form.value.capacity_used : 1,
    color: isBlock ? form.value.color : '#6B7280',
    price_tiers: isBlock ? [] : form.value.price_tiers.map(t => ({
      ...t,
      price: t.price_type === 'free' ? null : (t.time_fees ?? []).reduce((s: number, li: any) => s + (li.amount ?? 0), 0),
    })),
    sort_order: editing.value?.sort_order ?? rules.value.length,
    bookable_mode_id: form.value.bookable_mode_id ?? null,
    activity_mode_ids: ['OPEN', 'RESTRICTED'].includes(form.value.rule_type) ? form.value.activity_mode_ids : [],
    max_concurrent: ['OPEN', 'RESTRICTED'].includes(form.value.rule_type) ? (form.value.max_concurrent ?? null) : null,
    valid_from: form.value.valid_from ? formatLocalDate(form.value.valid_from) : null,
    valid_until: form.value.valid_until ? formatLocalDate(form.value.valid_until) : null,
    // RESTRICTED-only — invitee scope + eligibility criteria.
    invitee_modes: form.value.rule_type === 'RESTRICTED' ? form.value.invitee_modes : ['all_members'],
    invitee_groups: form.value.rule_type === 'RESTRICTED' && form.value.invitee_modes.includes('groups') ? form.value.invitee_groups : [],
    eligibility: form.value.rule_type === 'RESTRICTED' && form.value.eligibility.restricted
      ? { restricted: true, conditions: form.value.eligibility.conditions }
      : {},
  }

  const conflicts = findConflictingRules(payload, editing.value?.id ?? null)
  if (conflicts.length) {
    conflictDialog.conflicts = conflicts
    conflictDialog.pendingPayload = payload
    conflictDialog.open = true
    saving.value = false
    return
  }

  await persistRule(payload)
}

async function persistRule(payload: any, opts: { replacedRuleIds?: string[] } = {}) {
  if (editing.value) {
    await (db.from as any)('availability_rules').update(payload).eq('id', editing.value.id)
    if (opts.replacedRuleIds?.length) {
      await (db.from as any)('availability_rules')
        .update({ is_active: false, replaced_by_rule_id: editing.value.id })
        .in('id', opts.replacedRuleIds)
    }
  } else {
    const { data } = await (db.from as any)('availability_rules')
      .insert({ ...payload, is_active: true })
      .select('id').single()
    if (opts.replacedRuleIds?.length && data?.id) {
      await (db.from as any)('availability_rules')
        .update({ is_active: false, replaced_by_rule_id: data.id })
        .in('id', opts.replacedRuleIds)
    }
  }
  await load()
  closePanel()
  saving.value = false
  emit('saved')
}

async function resolveConflict(action: 'replace' | 'higher' | 'lower' | 'cancel') {
  const payload = conflictDialog.pendingPayload
  const conflicts = conflictDialog.conflicts
  conflictDialog.open = false
  if (action === 'cancel' || !payload) {
    conflictDialog.pendingPayload = null
    conflictDialog.conflicts = []
    return
  }
  saving.value = true
  if (action === 'replace') {
    await persistRule(payload, { replacedRuleIds: conflicts.map((c: any) => c.id) })
  } else if (action === 'lower') {
    // Place new rule below the lowest-priority conflict.
    const maxConflictOrder = Math.max(...conflicts.map((c: any) => c.sort_order ?? 0))
    payload.sort_order = maxConflictOrder + 1
    await persistRule(payload)
  } else if (action === 'higher') {
    // Place new rule above the highest-priority conflict, bumping it (and anything below) down by 1.
    const minConflictOrder = Math.min(...conflicts.map((c: any) => c.sort_order ?? 0))
    const toBump = rules.value.filter((r: any) => (r.sort_order ?? 0) >= minConflictOrder)
    for (const r of toBump) {
      const newOrder = (r.sort_order ?? 0) + 1
      r.sort_order = newOrder
      await (db.from as any)('availability_rules').update({ sort_order: newOrder }).eq('id', r.id)
    }
    payload.sort_order = minConflictOrder
    await persistRule(payload)
  }
  conflictDialog.pendingPayload = null
  conflictDialog.conflicts = []
}

async function toggleRule(rule: any) {
  await (db.from as any)('availability_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
  rule.is_active = !rule.is_active
}

async function deleteRule(rule: any) {
  if (!confirm(`Delete "${rule.name}"?`)) return
  // Find any rules this one had replaced (auto-restore them)
  const { data: replaced } = await (db.from as any)('availability_rules')
    .select('id, name')
    .eq('replaced_by_rule_id', rule.id)
  await (db.from as any)('availability_rules').delete().eq('id', rule.id)
  if (replaced?.length) {
    await (db.from as any)('availability_rules')
      .update({ is_active: true, replaced_by_rule_id: null })
      .in('id', replaced.map((r: any) => r.id))
    toast.add({ severity: 'info', summary: 'Restored hidden rule(s)',
      detail: `${replaced.map((r: any) => `"${r.name}"`).join(', ')} reactivated.`, life: 4000 })
  }
  await load()
  emit('saved')
}

async function cloneRule(rule: any) {
  const { id: _, created_at: __, updated_at: ___, ...rest } = rule
  const { data } = await (db.from as any)('availability_rules').insert({
    ...rest,
    name: `${rule.name} (copy)`,
    sort_order: rules.value.length,
    is_active: true,
  }).select().single()
  await load()
  if (data) openPanel(data)
}

function toggleDay(day: number) {
  const idx = form.value.days_of_week.indexOf(day)
  if (idx >= 0) form.value.days_of_week.splice(idx, 1)
  else form.value.days_of_week.push(day)
}

function addSlot() {
  form.value.time_slots.push({ from: '', to: '' })
}

function removeSlot(i: number) {
  if (form.value.time_slots.length > 1) form.value.time_slots.splice(i, 1)
  else form.value.time_slots[0] = { from: '', to: '' }
}

function onSlotFromChange(slot: { from: string; to: string }) {
  if (slot.to && slot.from && slot.to <= slot.from) slot.to = ''
}

function onSlotToChange(slot: { from: string; to: string }) {
  if (slot.to && slot.from && slot.to <= slot.from) slot.to = ''
}

// ── Slot generator ───────────────────────────────────────────────────────────

const showGenerator = ref(false)
const gen = reactive({ from: '09:00', to: '17:00', duration: 60, gap: 0 })

const generatedSlotPreview = computed(() => {
  if (!gen.from || !gen.to || gen.duration < 5) return []
  const start = timeToMins(gen.from)
  const end = timeToMins(gen.to)
  const step = gen.duration + (gen.gap ?? 0)
  const slots: { from: string; to: string }[] = []
  for (let cur = start; cur + gen.duration <= end; cur += step) {
    slots.push({ from: minsToTime(cur), to: minsToTime(cur + gen.duration) })
  }
  return slots
})

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function applyGenerated() {
  if (!generatedSlotPreview.value.length) return
  form.value.time_slots = generatedSlotPreview.value.map(s => ({ ...s }))
  showGenerator.value = false
}

const recurrenceRefDate = computed<Date | null>(() => {
  if (!form.value.days_of_week.length) return null
  const first = [...form.value.days_of_week].sort()[0]
  const jsDow = (first + 1) % 7
  const d = new Date()
  const diff = (jsDow - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
})

const rruleHasInterval = computed(() => {
  const r = form.value.rrule
  if (!r || r === 'NONE') return false
  const parts: Record<string, string> = {}
  r.split(';').forEach(p => { const [k, v] = p.split('='); if (k) parts[k] = v })
  return parseInt(parts['INTERVAL'] ?? '1') > 1 && parts['FREQ'] !== 'MONTHLY'
})

function formatRecurrence(rule: any): string {
  if (rule.rrule && rule.rrule !== 'NONE') return rruleToSummary(rule.rrule)
  const MONTH_WEEK_LABELS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', '-1': 'Last' }
  if (rule.month_week) {
    const wLabel = MONTH_WEEK_LABELS[rule.month_week] ?? `${rule.month_week}th`
    const dayNames = (rule.days_of_week ?? []).map((d: number) => DAYS[d]).join(', ')
    return `${wLabel} ${dayNames} of month`
  }
  if (rule.week_interval > 1) return `Every ${rule.week_interval} weeks`
  return ''
}

// ── Bookings overlay ──────────────────────────────────────────────────────────

function bookingStartTime(b: any): string {
  const d = new Date(b.start_at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function bookingEndTime(b: any): string {
  const d = new Date(b.end_at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function bookingsForDate(date: Date): any[] {
  return bookings.value.filter(b => {
    const bd = new Date(b.start_at)
    return bd.getFullYear() === date.getFullYear() && bd.getMonth() === date.getMonth() && bd.getDate() === date.getDate()
  })
}

async function loadBookingsForView() {
  let start: Date, end: Date
  if (calView.value === 'day') {
    start = new Date(calDate.value); start.setHours(0, 0, 0, 0)
    end = new Date(calDate.value); end.setHours(23, 59, 59, 999)
  } else if (calView.value === 'week') {
    const days = weekDays.value
    start = new Date(days[0]); start.setHours(0, 0, 0, 0)
    end = new Date(days[6]); end.setHours(23, 59, 59, 999)
  } else if (calView.value === 'list') {
    const year = calDate.value.getFullYear(), month = calDate.value.getMonth()
    start = new Date(year, month, 1, 0, 0, 0, 0)
    end = new Date(year, month + 3, 0, 23, 59, 59, 999)
  } else {
    const year = calDate.value.getFullYear(), month = calDate.value.getMonth()
    start = new Date(year, month, 1, 0, 0, 0, 0)
    end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  }
  const { data } = await (db.from as any)('bookings')
    .select('id, start_at, end_at, status')
    .eq('bookable_id', props.bookableId)
    .neq('status', 'CANCELLED')
    .gte('start_at', start.toISOString())
    .lte('start_at', end.toISOString())
  bookings.value = data ?? []
}

watch([calDate, calView], () => {
  loadBookingsForView()
  nextTick(() => scrollGridTo8am())
})

function formatSlots(rule: any): string {
  const raw: { from: string; to: string }[] = rule.time_slots?.length
    ? rule.time_slots
    : rule.time_from ? [{ from: rule.time_from, to: rule.time_to }] : []
  if (!raw.length) return 'All day'
  if (raw.length === 1) return `${formatTime(raw[0].from)} – ${formatTime(raw[0].to)}`

  // Sort by start time
  const slots = [...raw].sort((a, b) => timeToMins(a.from) - timeToMins(b.from))
  const durations = slots.map(s => timeToMins(s.to) - timeToMins(s.from))
  const allSameDuration = durations.every(d => d === durations[0])

  // Detect contiguous back-to-back slots of equal duration → compact "9am – 5pm (8 × 1hr)"
  if (allSameDuration) {
    let contiguous = true
    for (let i = 1; i < slots.length; i++) {
      if (timeToMins(slots[i].from) !== timeToMins(slots[i - 1].to)) { contiguous = false; break }
    }
    if (contiguous) {
      const dur = durations[0]
      const durLabel = dur % 60 === 0 ? `${dur / 60}hr` : `${dur}min`
      return `${formatTime(slots[0].from)} – ${formatTime(slots[slots.length - 1].to)} (${slots.length} × ${durLabel})`
    }
  }

  // Otherwise, comma-list — but cap at 3 with "+N more" if there are many
  if (slots.length > 3) {
    const head = slots.slice(0, 3).map(s => `${formatTime(s.from)} – ${formatTime(s.to)}`).join(', ')
    return `${head}, +${slots.length - 3} more`
  }
  return slots.map(s => `${formatTime(s.from)} – ${formatTime(s.to)}`).join(', ')
}
</script>

<style scoped>
.slide-search-enter-active,
.slide-search-leave-active {
  transition: max-width 0.2s ease, opacity 0.15s ease, margin-right 0.2s ease;
  overflow: hidden;
  max-width: 280px;
}
.slide-search-enter-from,
.slide-search-leave-to {
  max-width: 0;
  opacity: 0;
  margin-right: 0 !important;
}
</style>
