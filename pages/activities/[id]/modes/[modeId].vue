<template>
  <div class="flex flex-col h-[calc(100vh-3.5rem-4rem)] md:h-[calc(100vh-3.5rem)]">

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      <i class="pi pi-spin pi-spinner text-xl" />
    </div>

    <template v-else>

      <!-- Hero header -->
      <div class="bg-white border-b border-gray-200 shrink-0">
        <div class="max-w-[1140px] mx-auto px-3 sm:px-6 py-4 flex items-start gap-4">
          <NuxtLink :to="backHref"
            class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors shrink-0 mt-1">
            <i class="pi pi-arrow-left text-xs" />
            Back
          </NuxtLink>

          <!-- Colour swatch / image -->
          <div class="shrink-0">
            <div v-if="form.image_url" class="w-12 h-12 rounded-xl overflow-hidden border border-gray-200">
              <img :src="form.image_url" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-12 h-12 rounded-xl flex items-center justify-center"
              :style="{ background: (form.color || '#1E2157') + '20' }">
              <i class="pi pi-sliders-h text-base" :style="{ color: form.color || '#1E2157' }" />
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <p v-if="activityName" class="text-xs text-gray-400 mb-0.5">{{ activityName }}</p>
            <h1 class="text-lg font-bold text-gray-900 truncate">
              {{ isNew ? 'New mode' : (form.name || 'Untitled mode') }}
            </h1>
            <!-- Status chips -->
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                :class="form.approval_mode === 'INSTANT' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'">
                <i class="pi text-[8px]" :class="form.approval_mode === 'INSTANT' ? 'pi-bolt' : 'pi-clock'" />
                {{ form.approval_mode === 'INSTANT' ? 'Auto-confirm' : 'Approval needed' }}
              </span>
              <span v-if="form.min_people || form.max_people"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                <i class="pi pi-users text-[8px]" />
                {{ form.min_people && form.max_people ? `${form.min_people}–${form.max_people}`
                   : form.min_people ? `${form.min_people}+`
                   : `Up to ${form.max_people}` }}
              </span>
              <span v-if="form.allow_visitors"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                <i class="pi pi-user-plus text-[8px]" />
                Visitors
              </span>
              <span v-if="form.form_id"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                <i class="pi pi-list text-[8px]" />
                {{ selectedFormFieldCount ? `${selectedFormFieldCount} question${selectedFormFieldCount === 1 ? '' : 's'}` : 'Custom form' }}
              </span>
              <span v-if="form.form_id && selectedFormRuleCount > 0"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700"
                v-tooltip.bottom="'Visibility or financial rules configured on this form'">
                <i class="pi pi-bolt text-[8px]" />
                {{ selectedFormRuleCount }} rule{{ selectedFormRuleCount === 1 ? '' : 's' }}
              </span>
              <span v-if="(form.addons ?? []).length"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
                <i class="pi pi-plus-circle text-[8px]" />
                {{ form.addons.length }} add-on{{ form.addons.length === 1 ? '' : 's' }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button v-if="!isNew" type="button"
              class="text-sm text-red-400 hover:text-red-600 transition-colors px-2"
              @click="deleteMode">Delete</button>
            <Button :label="isNew ? 'Create mode' : 'Save changes'"
              icon="pi pi-check"
              :disabled="!form.name.trim()" :loading="saving"
              @click="save" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </div>
        </div>
      </div>

      <!-- Tabbed body -->
      <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
        <div class="max-w-[1140px] mx-auto px-3 sm:px-6 pt-2 pb-10">
          <Tabs value="details">
            <TabList>
              <Tab value="details"><i class="pi pi-pencil text-xs mr-2" />Details</Tab>
              <Tab value="pricing"><i class="pi pi-dollar text-xs mr-2" />Pricing</Tab>
              <Tab value="bookings"><i class="pi pi-calendar text-xs mr-2" />Bookings</Tab>
            </TabList>
            <TabPanels>

              <!-- ── DETAILS ──
                   One unified card, three sections (Identity → Capacity →
                   What's bundled) separated by hairline dividers. Tiny
                   uppercase section labels do the navigation work in
                   place of full headings, keeping the surface dense but
                   readable. The Advanced disclosure sits below the card
                   as a discrete affordance for the rare narrowing case. -->
              <TabPanel value="details" class="space-y-4">
                <AppCard>
                  <!-- Identity ─────────────────────────────────────── -->
                  <section>
                    <header class="px-5 pt-4 pb-2 flex items-baseline justify-between">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">Identity</p>
                      <p v-if="form.category" class="text-[11px] text-gray-400 truncate ml-3">{{ form.category }}</p>
                    </header>
                    <div class="px-5 pb-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-6 gap-y-4 items-start">
                      <div class="space-y-3">
                        <div>
                          <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Name <span class="text-red-400">*</span></label>
                          <InputText v-model="form.name" placeholder="e.g. Boys Birthday" class="w-full" />
                        </div>
                        <div>
                          <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Description <span class="text-gray-300 font-normal">— optional</span></label>
                          <InputText v-model="form.description" placeholder="Short description shown to bookers" class="w-full" />
                        </div>
                        <div>
                          <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Service category <span class="text-gray-300 font-normal">— optional</span></label>
                          <AutoComplete v-model="form.category" :suggestions="categorySuggestions"
                            placeholder="e.g. Tennis, Swimming, Pilates"
                            @complete="searchCategories"
                            class="w-full" />
                          <p class="text-[11px] text-gray-400 mt-1">Drives the booker's "By service" cards.</p>
                        </div>
                        <div>
                          <label class="text-xs font-semibold text-gray-600 mb-2 block">Colour</label>
                          <div class="flex gap-2 flex-wrap">
                            <button v-for="c in COLORS" :key="c" type="button"
                              class="w-7 h-7 rounded-full ring-offset-2 transition-all"
                              :style="{ background: c }"
                              :class="form.color === c ? 'ring-2 ring-gray-700' : 'hover:ring-2 hover:ring-gray-300'"
                              @click="form.color = c" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Image</label>
                        <label class="cursor-pointer block">
                          <div v-if="form.image_url" class="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                            <img :src="form.image_url" class="w-full h-full object-cover" />
                            <button type="button"
                              class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              @click.prevent="form.image_url = ''">
                              <i class="pi pi-times text-white" />
                            </button>
                          </div>
                          <div v-else class="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-0.5 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                            <i v-if="!uploadingImage" class="pi pi-image text-gray-400 text-base" />
                            <i v-else class="pi pi-spin pi-spinner text-gray-400" />
                            <span v-if="!uploadingImage" class="text-[10px] text-gray-400">Upload</span>
                          </div>
                          <input type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
                        </label>
                      </div>
                    </div>
                  </section>

                  <!-- Capacity ─────────────────────────────────────── -->
                  <section class="border-t border-gray-100">
                    <header class="px-5 pt-4 pb-1">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">Capacity</p>
                    </header>
                    <div class="divide-y divide-gray-100">
                      <SettingsRow label="Min people">
                        <ToggleSwitch :modelValue="form.min_people !== null"
                          @update:modelValue="v => form.min_people = v ? 1 : null" />
                        <InputNumber v-if="form.min_people !== null" v-model="form.min_people" :min="1" :max="9999" class="w-24" />
                        <span v-else class="text-sm text-gray-400">No minimum</span>
                      </SettingsRow>
                      <SettingsRow label="Max people">
                        <ToggleSwitch :modelValue="form.max_people !== null"
                          @update:modelValue="v => form.max_people = v ? 10 : null" />
                        <InputNumber v-if="form.max_people !== null" v-model="form.max_people" :min="1" :max="9999" class="w-24" />
                        <span v-else class="text-sm text-gray-400">No maximum</span>
                      </SettingsRow>
                      <SettingsRow label="Allow visitors">
                        <ToggleSwitch v-model="form.allow_visitors"
                          @update:modelValue="v => { form.min_visitors = v ? form.min_visitors : null; form.max_visitors = v ? form.max_visitors : null }" />
                        <span v-if="!form.allow_visitors" class="text-sm text-gray-400">Visitors not permitted</span>
                      </SettingsRow>
                      <template v-if="form.allow_visitors">
                        <SettingsRow label="Min visitors" class="bg-gray-50/60 pl-4">
                          <ToggleSwitch :modelValue="form.min_visitors !== null"
                            @update:modelValue="v => form.min_visitors = v ? 1 : null" />
                          <InputNumber v-if="form.min_visitors !== null" v-model="form.min_visitors" :min="1" :max="9999" class="w-24" />
                          <span v-else class="text-sm text-gray-400">No minimum</span>
                        </SettingsRow>
                        <SettingsRow label="Max visitors" class="bg-gray-50/60 pl-4">
                          <ToggleSwitch :modelValue="form.max_visitors !== null"
                            @update:modelValue="v => form.max_visitors = v ? 10 : null" />
                          <InputNumber v-if="form.max_visitors !== null" v-model="form.max_visitors" :min="1" :max="9999" class="w-24" />
                          <span v-else class="text-sm text-gray-400">No maximum</span>
                        </SettingsRow>
                      </template>
                    </div>
                  </section>

                  <!-- Bundled ──────────────────────────────────────── -->
                  <section class="border-t border-gray-100">
                    <header class="px-5 pt-4 pb-2 flex items-baseline justify-between">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">What's bundled</p>
                      <p class="text-[11px] text-gray-400">Locked in with every booking</p>
                    </header>

                    <!-- Venue (unified) -->
                    <div class="px-5 py-3 border-b border-gray-100">
                      <div class="flex items-baseline justify-between mb-1.5">
                        <p class="text-xs font-semibold text-gray-700">Venue</p>
                        <p v-if="venueHint" class="text-[11px] text-gray-400">{{ venueHint }}</p>
                      </div>
                      <MultiSelect v-model="venueIds"
                        :options="venueOptions"
                        option-label="name" option-value="id"
                        :placeholder="isStaffOwned ? 'No venue required' : 'Any bookable on this activity'"
                        class="w-full"
                        :show-toggle-all="false" filter>
                        <template #option="{ option }">
                          <div class="flex items-center gap-2">
                            <i class="pi text-xs"
                              :class="option.parent_id ? 'pi-sitemap text-emerald-600' : 'pi-building text-primary'" />
                            <span class="text-sm">{{ option.name }}</span>
                          </div>
                        </template>
                      </MultiSelect>
                    </div>

                    <!-- Equipment -->
                    <div class="px-5 py-3">
                      <div class="flex items-baseline justify-between mb-1.5">
                        <p class="text-xs font-semibold text-gray-700">Equipment</p>
                        <p class="text-[11px] text-gray-400">Required = auto-reserved · Optional = customer picks</p>
                      </div>
                      <div v-if="!form.equipment_items.length" class="text-[11px] text-gray-400 py-1.5">None.</div>
                      <div class="space-y-1.5">
                        <div v-for="(r, i) in form.equipment_items" :key="`eq-${i}`"
                          class="flex flex-wrap items-center gap-2">
                          <Select v-model="r.bookable_id" :options="orgItemOptions"
                            option-label="name" option-value="id"
                            placeholder="Pick an item" class="flex-1" filter />
                          <InputNumber v-model="r.quantity" :min="1" :max="999"
                            show-buttons button-layout="horizontal"
                            decrement-button-class="!h-8 !w-8" increment-button-class="!h-8 !w-8"
                            input-class="!h-8 !w-12 !text-center !text-sm !font-semibold" />
                          <!-- Per-unit price for this item on this mode -->
                          <div class="flex items-center gap-1 shrink-0"
                            v-tooltip.top="'Per-unit price for this item — leave blank for free'">
                            <span class="text-xs text-gray-400">$</span>
                            <InputNumber :model-value="r.price_override"
                              :min="0" :max-fraction-digits="2"
                              placeholder="Free"
                              input-class="!h-8 !w-16 !text-right !text-sm"
                              @update:model-value="v => r.price_override = (v == null || v === '' as any) ? null : Number(v)" />
                          </div>
                          <div class="flex items-center bg-gray-100 rounded-md p-0.5 shrink-0">
                            <button type="button"
                              class="px-2.5 h-7 rounded text-[11px] font-semibold transition-colors"
                              :class="!r.is_optional ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                              @click="r.is_optional = false">Required</button>
                            <button type="button"
                              class="px-2.5 h-7 rounded text-[11px] font-semibold transition-colors"
                              :class="r.is_optional ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                              @click="r.is_optional = true">Optional</button>
                          </div>
                          <button type="button"
                            class="w-8 h-8 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"
                            @click="removeEquipmentItem(i)" aria-label="Remove">
                            <i class="pi pi-times text-xs" />
                          </button>
                        </div>
                      </div>
                      <button type="button"
                        class="mt-2 text-xs font-semibold text-primary hover:text-[#2a2f6e] transition-colors flex items-center gap-1 disabled:text-gray-300"
                        :disabled="!orgItemOptions.length"
                        @click="addEquipmentItem">
                        <i class="pi pi-plus text-[10px]" />
                        Add item
                      </button>
                      <p v-if="!orgItemOptions.length" class="text-[11px] text-amber-600 mt-2">
                        No ITEM bookables yet — create some in <NuxtLink to="/bookables?tab=items" class="underline font-semibold">Items</NuxtLink> first.
                      </p>
                    </div>
                  </section>
                </AppCard>

                <!-- Required configuration — only surfaces when the
                     activity's linked bookables actually have layouts
                     (Halves / Quarters / etc.) defined. Almost no mode
                     needs it, so it stays out of the way until then. -->
                <div v-if="!isStaffOwned && availableConfigurations.length" class="px-1">
                  <button type="button"
                    class="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1.5 py-1"
                    @click="showAdvanced = !showAdvanced">
                    <i :class="`pi pi-chevron-${showAdvanced ? 'down' : 'right'} text-[10px]`" />
                    Required configuration
                  </button>
                  <div v-if="showAdvanced" class="mt-2">
                    <AppCard>
                      <div class="px-5 py-4">
                        <p class="text-[11px] text-gray-400 mb-2">Pick a layout (Half-court, Quarter, …) when this mode needs a sub-venue rather than the whole space.</p>
                        <Select v-model="form.configuration_key"
                          :options="[{ key: null, name: 'No configuration — book the whole bookable' }, ...availableConfigurations]"
                          option-label="name" option-value="key"
                          placeholder="No configuration"
                          class="w-full" show-clear />
                      </div>
                    </AppCard>
                  </div>
                </div>
              </TabPanel>

              <!-- ── PRICING ──
                   Single card, three sections: Rates → Add-ons → Payment.
                   The heavy lifting is in the embedded editors; this
                   wrapper just frames them with consistent dividers + tiny
                   uppercase section labels. -->
              <TabPanel value="pricing" class="space-y-4">
                <AppCard>
                  <section>
                    <header class="px-5 pt-4 pb-2 flex items-baseline justify-between">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">Rates</p>
                      <p class="text-[11px] text-gray-400">Default + per-tier overrides</p>
                    </header>
                    <div class="px-5 pb-5">
                      <ModePricingTiersEditor
                        v-model="form.pricing"
                        :addons="form.addons"
                        :groups="allGroups" />
                    </div>
                  </section>

                  <section class="border-t border-gray-100">
                    <header class="px-5 pt-4 pb-2 flex items-baseline justify-between">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">Add-ons</p>
                      <p class="text-[11px] text-gray-400">Flat or tiered extras</p>
                    </header>
                    <div class="px-5 pb-5">
                      <ModeAddonsEditor v-model="form.addons" />
                    </div>
                  </section>

                  <section class="border-t border-gray-100">
                    <header class="px-5 pt-4 pb-2 flex items-baseline justify-between">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">Payment</p>
                      <p class="text-[11px] text-gray-400">
                        <template v-if="!hasOwnPaymentOptions">
                          Inheriting site defaults
                          <NuxtLink to="/settings" class="text-primary underline ml-1">Edit</NuxtLink>
                        </template>
                        <template v-else>
                          Mode-specific
                          <button type="button" class="text-primary underline ml-1" @click="resetToOrgDefaults">Reset</button>
                        </template>
                      </p>
                    </header>
                    <div class="px-5 pb-5">
                      <PaymentOptionsEditor
                        :modelValue="effectivePayment"
                        @update:modelValue="onPaymentOptionsUpdate" />
                    </div>
                  </section>
                </AppCard>
              </TabPanel>

              <!-- ── BOOKINGS ──
                   Single card holding the booking-flow rules: approval,
                   form, and calendar default. Same pattern as Pricing /
                   Details. -->
              <TabPanel value="bookings" class="space-y-4">
                <AppCard>
                  <section>
                    <header class="px-5 pt-4 pb-2">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">Approval</p>
                    </header>
                    <div class="px-5 pb-5 space-y-2">
                      <label class="flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors"
                        :class="form.approval_mode === 'INSTANT' ? 'border-primary bg-[#EFF6FF]/40' : 'border-gray-200 hover:bg-gray-50'">
                        <input type="radio" value="INSTANT" v-model="form.approval_mode" class="mt-1 w-4 h-4 accent-primary" />
                        <div class="flex-1">
                          <p class="text-sm font-semibold text-gray-800">Instantly confirmed</p>
                          <p class="text-[11px] text-gray-500 mt-0.5">Bookings go live immediately and the slot is reserved.</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors"
                        :class="form.approval_mode === 'REQUIRES_APPROVAL' ? 'border-primary bg-[#EFF6FF]/40' : 'border-gray-200 hover:bg-gray-50'">
                        <input type="radio" value="REQUIRES_APPROVAL" v-model="form.approval_mode" class="mt-1 w-4 h-4 accent-primary" />
                        <div class="flex-1">
                          <p class="text-sm font-semibold text-gray-800">Requires approval</p>
                          <p class="text-[11px] text-gray-500 mt-0.5">Bookings arrive as Pending — staff confirm or decline before the slot is held.</p>
                        </div>
                      </label>
                    </div>
                  </section>

                  <section class="border-t border-gray-100">
                    <header class="px-5 pt-4 pb-2 flex items-baseline justify-between">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">Booking form</p>
                      <p v-if="form.form_id && selectedFormFieldCount" class="text-[11px] text-gray-400">
                        {{ selectedFormFieldCount }} {{ selectedFormFieldCount === 1 ? 'question' : 'questions' }}
                      </p>
                    </header>
                    <div class="px-5 pb-5">
                      <div class="flex items-center gap-2">
                        <Select v-model="form.form_id" :options="formOptions" option-label="label" option-value="value"
                          placeholder="Use built-in core fields" filter show-clear class="flex-1" />
                        <Button v-if="form.form_id" label="Edit" icon="pi pi-pencil" size="small" severity="secondary" outlined
                          @click="navigateTo(`/forms/${form.form_id}?return=${encodeURIComponent($route.fullPath)}`)" />
                        <Button label="New form" icon="pi pi-plus" size="small"
                          style="background:var(--brand-primary);border-color:var(--brand-primary)"
                          @click="navigateTo(`/forms/new?return=${encodeURIComponent($route.fullPath)}`)" />
                      </div>
                    </div>
                  </section>

                  <section class="border-t border-gray-100">
                    <header class="px-5 pt-4 pb-1">
                      <p class="text-[10px] font-bold text-gray-400 uppercase tracking-[0.16em]">Wizard calendar</p>
                    </header>
                    <SettingsRow label="Default view" description="Falls back to the venue's default if not set.">
                      <Select v-model="form.default_booking_view" :options="bookingViewOptions"
                        option-label="label" option-value="value" placeholder="Use venue default" show-clear class="w-44" />
                    </SettingsRow>
                  </section>
                </AppCard>
              </TabPanel>

            </TabPanels>
          </Tabs>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const db = useDb()
const { orgId } = useOrg()

const COLORS = ['#6366F1','#EF4444','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#F97316','#14B8A6','#84CC16']

const isNew = computed(() => route.params.modeId === 'new')

const loading = ref(true)
const saving = ref(false)
const uploadingImage = ref(false)
const activityName = ref('')
// True when the parent activity is owned by a single staff member —
// drives "coach mode" UI rules (hide the bookable-scope card etc.).
const isStaffOwned = ref(false)
// Advanced disclosure on the Details tab — bookable scope + required
// configuration are narrowing controls only the rare multi-bookable
// venue activity needs. Default closed so the common case is clean.
const showAdvanced = ref(false)
// When the parent activity is staff-owned we route Back / Save / Delete
// to the staff's "What I offer" tab instead of the activity page —
// keeps the editing flow self-contained on the coach.
const ownerStaffBookableId = ref<string | null>(null)
const backHref = computed(() => ownerStaffBookableId.value
  ? `/bookables/${ownerStaffBookableId.value}?tab=offerings`
  : `/activities/${route.params.id}`)
const allGroups = ref<any[]>([])

function emptyPricing() {
  return { base: [], per_person: [], per_hour: [], tiers: [] }
}

function normalizePricing(p: any) {
  if (!p) return emptyPricing()
  const extractFees = (val: any) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    return val.fees ?? []
  }
  return {
    base: extractFees(p.base),
    per_person: extractFees(p.per_person),
    per_hour: extractFees(p.per_hour),
    tiers: p.tiers ?? [],
  }
}

function cleanFees(fees: any[]) {
  return (fees ?? []).filter((f: any) => f.name?.trim() || f.amount != null)
}

function cleanPricing(p: any) {
  const cleanOrNull = (fees: any) => fees === null ? null : cleanFees(fees)
  return {
    base: cleanFees(p?.base),
    per_person: cleanFees(p?.per_person),
    per_hour: cleanFees(p?.per_hour),
    tiers: (p?.tiers ?? []).map((tier: any) => ({
      ...tier,
      base: cleanOrNull(tier.base),
      per_person: cleanOrNull(tier.per_person),
      per_hour: cleanOrNull(tier.per_hour),
      addon_overrides: (tier.addon_overrides ?? []).map((o: any) => ({ ...o, fees: cleanFees(o.fees) })),
    })),
  }
}

function cleanAddons(addons: any[]) {
  return (addons ?? [])
    .filter((a: any) => a.name?.trim())
    .map((a: any) => ({ ...a, fees: cleanFees(a.fees) }))
}

interface ActivityBookable { id: string; name: string; parent_id: string | null; type: string }
interface ConfigurationOption { key: string; name: string }
const activityBookables = ref<ActivityBookable[]>([])
const activityBookableChildren = ref<ActivityBookable[]>([])
// Configurations available across the activity's linked bookables — surfaced
// in the mode editor so the user can require e.g. "Halves" without naming
// individual sub-venues. Populated from bookable_configurations rows.
const availableConfigurations = ref<ConfigurationOption[]>([])

// Combined set: every bookable linked to the activity + their children. The
// mode editor's bookable picker draws from this list so you can scope to a
// court (linked to the activity) OR one of its quarters (a child of a linked
// bookable, even if the quarter itself isn't on the activity link list).
const modeBookableOptions = computed<ActivityBookable[]>(() => {
  const seen = new Map<string, ActivityBookable>()
  for (const b of activityBookables.value) seen.set(b.id, b)
  for (const c of activityBookableChildren.value) if (!seen.has(c.id)) seen.set(c.id, c)
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const form = reactive({
  name: '',
  description: '',
  color: COLORS[0],
  image_url: '',
  pricing: emptyPricing() as any,
  addons: [] as any[],
  min_people:     null as number | null,
  max_people:     null as number | null,
  allow_visitors: false,
  min_visitors:   null as number | null,
  max_visitors:   null as number | null,
  form_id:        null as string | null,
  default_booking_view: null as string | null,
  payment_options: { invoice: false, credit_card: false, payment_plan: false, coupon: false } as Record<string, boolean>,
  approval_mode: 'INSTANT' as 'INSTANT' | 'REQUIRES_APPROVAL',
  // Bookable scope. Empty = applies to every bookable the activity is linked to.
  bookable_ids: [] as string[],
  // Required configuration. When set (e.g. 'halves'), the booking flow
  // resolves scoped bookables → their children under that config and treats
  // them as one interchangeable pool ("any half").
  configuration_key: null as string | null,
  // Coach modes: venues this mode also reserves alongside the coach.
  // Multiple = pool — system picks first available at submit time.
  resource_bookable_ids: [] as string[],
  // Mode-level equipment. One unified list of items with a per-row
  // is_optional flag so the editor reads as a single equipment list
  // (item + qty + required/optional toggle). `price_override` is the
  // per-unit price for this mode (null = free). All three persist to
  // activity_mode_required_items together.
  equipment_items: [] as { id?: string; bookable_id: string; quantity: number; is_optional: boolean; price_override: number | null }[],
  // Service category (free text + autocomplete from org's existing
  // values). Drives the booker's "By service" picker — clicking
  // "Tennis" surfaces every mode tagged Tennis across all coaches +
  // venues.
  category: '' as string,
})

// Autocomplete from distinct categories already in use across this
// org's modes — keeps spelling consistent without forcing a managed
// list.
const categorySuggestions = ref<string[]>([])
async function searchCategories(event: { query: string }) {
  if (!orgId.value) return
  const q = (event?.query ?? '').trim().toLowerCase()
  // Pull every category in use for the org's activities, distinct.
  // Cheap query — list of one-word strings — fine to refetch per
  // keystroke (delay handled by AutoComplete's own debounce).
  const { data: actIds } = await (db.from as any)('activities')
    .select('id').eq('org_id', orgId.value)
  const ids = (actIds ?? []).map((a: any) => a.id)
  if (!ids.length) { categorySuggestions.value = []; return }
  const { data } = await (db.from as any)('activity_modes')
    .select('category')
    .in('activity_id', ids)
    .not('category', 'is', null)
  const all = Array.from(new Set((data ?? []).map((r: any) => r.category as string).filter(Boolean)))
  categorySuggestions.value = q ? all.filter(c => c.toLowerCase().includes(q)) : all
}

// Org-wide venue bookables for the "Required venue" picker on coach
// modes. A swimming coach's mode might use a lane that isn't directly
// linked to its parent activity, so we pull the whole org list.
const orgVenueOptions = ref<{ id: string; name: string; parent_id: string | null }[]>([])

// Unified "Venue" picker that hides the bookable_scope vs
// required_venue distinction from the user. The picker source AND the
// bound field both swap based on whether the parent activity is
// staff-owned: coach modes write to activity_mode_resources (org-wide
// venue pool, additional reservation); venue-activity modes write to
// activity_mode_bookables (narrowing among the activity's linked
// bookables). Same UI control, semantics chosen by the activity type.
const venueOptions = computed(() => isStaffOwned.value ? orgVenueOptions.value : modeBookableOptions.value)
const venueIds = computed({
  get: () => isStaffOwned.value ? form.resource_bookable_ids : form.bookable_ids,
  set: (v: string[]) => {
    if (isStaffOwned.value) form.resource_bookable_ids = v
    else form.bookable_ids = v
  },
})
const venueHint = computed(() => {
  if (!venueIds.value.length) return ''
  if (isStaffOwned.value) return `First-available of ${venueIds.value.length} reserved`
  return `Restricted to ${venueIds.value.length} bookable${venueIds.value.length === 1 ? '' : 's'}`
})

// Org ITEM bookables for the "Required equipment" picker. Same
// rationale — equipment lives org-wide, not scoped to one activity.
const orgItemOptions = ref<{ id: string; name: string; max_concurrent: number | null }[]>([])

function addEquipmentItem() {
  form.equipment_items.push({ bookable_id: '', quantity: 1, is_optional: false, price_override: null })
}
function removeEquipmentItem(i: number) {
  form.equipment_items.splice(i, 1)
}

const bookingViewOptions = [
  { label: 'Month',     value: 'dayGridMonth' },
  { label: 'Week',      value: 'timeGridWeek' },
  { label: 'Day',       value: 'timeGridDay' },
  { label: 'List',      value: 'listWeek' },
  { label: 'Scheduler', value: 'scheduler' },
]

const paymentMethodOptions = [
  { value: 'card',    label: 'Credit / Debit Card', icon: 'pi-credit-card', description: 'Pay online at submission.' },
  { value: 'bank',    label: 'Bank Transfer',        icon: 'pi-building',    description: 'Receive bank details to pay later.' },
  { value: 'cash',    label: 'Cash on the Day',      icon: 'pi-dollar',      description: 'Hand over cash on arrival.' },
  { value: 'invoice', label: 'Invoice',              icon: 'pi-file',        description: 'Send an invoice to settle later.' },
]

const orgDefaultPaymentOptions = ref<Record<string, boolean>>({})
const hasOwnPaymentOptions = computed(() =>
  Object.values(form.payment_options).some(v => v),
)
const effectivePayment = computed(() =>
  hasOwnPaymentOptions.value ? form.payment_options : orgDefaultPaymentOptions.value,
)
function onPaymentOptionsUpdate(next: Record<string, boolean>) {
  // First time the user toggles anything on, copy the org defaults across so
  // the mode keeps everything currently inherited.
  const turningOn = Object.entries(next).some(([k, v]) => v && !form.payment_options[k])
  if (!hasOwnPaymentOptions.value && turningOn) {
    Object.assign(form.payment_options, orgDefaultPaymentOptions.value)
  }
  for (const k of Object.keys(form.payment_options)) form.payment_options[k] = !!next[k]
}
function resetToOrgDefaults() {
  for (const k of Object.keys(form.payment_options)) form.payment_options[k] = false
}

// Forms picker
const allForms = ref<any[]>([])
const formFieldCounts = ref<Record<string, number>>({})
const formRuleCounts  = ref<Record<string, number>>({})

const formOptions = computed(() =>
  allForms.value.map(f => ({
    value: f.id,
    label: formFieldCounts.value[f.id]
      ? `${f.name} (${formFieldCounts.value[f.id]} ${formFieldCounts.value[f.id] === 1 ? 'question' : 'questions'})`
      : f.name,
  })),
)

const selectedFormFieldCount = computed(() => form.form_id ? (formFieldCounts.value[form.form_id] ?? 0) : 0)
const selectedFormRuleCount  = computed(() => form.form_id ? (formRuleCounts.value[form.form_id] ?? 0) : 0)

async function loadForms() {
  if (!orgId.value) return
  // Pull `config` so we can count visibility/financial rules per form via fieldMeta.
  const { data: forms } = await (db.from as any)('registration_forms').select('id, name, config').eq('org_id', orgId.value).order('name')
  allForms.value = forms ?? []
  // Field counts (form_fields rows).
  if (forms?.length) {
    const { data: fields } = await (db.from as any)('form_fields').select('form_id').in('form_id', forms.map((f: any) => f.id))
    const counts: Record<string, number> = {}
    for (const f of fields ?? []) counts[f.form_id] = (counts[f.form_id] ?? 0) + 1
    formFieldCounts.value = counts
  }
  // Rule counts (sum of has_visibility + has_financial flags across the form's fieldMeta).
  const ruleCounts: Record<string, number> = {}
  for (const f of forms ?? []) {
    const meta = (f.config as any)?.fieldMeta ?? {}
    let n = 0
    for (const fm of Object.values(meta) as any[]) {
      if (fm?.has_visibility_conditions && (fm.visibility_conditions ?? []).length) n += 1
      if (fm?.has_financial_increase) n += (fm.financial_rules ?? []).length || 1
    }
    ruleCounts[f.id] = n
  }
  formRuleCounts.value = ruleCounts
}

useBreadcrumbs([
  { label: 'Activities', to: '/activities' },
])

async function load() {
  loading.value = true
  try {
    const [{ data: act }, { data: groups }, { data: orgRow }, { data: actBookables }] = await Promise.all([
      (db.from as any)('activities').select('name, staff_bookable_id').eq('id', route.params.id).single(),
      (db.from as any)('member_groups').select('id, name, color').eq('org_id', orgId.value).order('name'),
      (db.from as any)('organisations').select('default_payment_options').eq('id', orgId.value).single(),
      // Bookables linked to the parent activity — the candidate set for
      // mode-level scoping (any descendant of these is also fair game).
      (db.from as any)('activity_bookables')
        .select('bookable:bookables(id, name, parent_id, type)')
        .eq('activity_id', route.params.id),
    ])
    activityName.value = act?.name ?? ''
    isStaffOwned.value = !!act?.staff_bookable_id
    ownerStaffBookableId.value = act?.staff_bookable_id ?? null
    allGroups.value = groups ?? []
    orgDefaultPaymentOptions.value = (orgRow?.default_payment_options as Record<string, boolean>) ?? {}
    activityBookables.value = (actBookables ?? [])
      .map((r: any) => r.bookable)
      .filter(Boolean) as ActivityBookable[]
    // Pull the children of every linked bookable so the user can scope to a
    // specific quarter/court/etc. without having to link it to the activity.
    const linkedIds = activityBookables.value.map(b => b.id)
    if (linkedIds.length) {
      const [{ data: kids }, { data: configs }] = await Promise.all([
        (db.from as any)('bookables')
          .select('id, name, parent_id, type')
          .in('parent_id', linkedIds)
          .neq('status', 'DELETED'),
        (db.from as any)('bookable_configurations')
          .select('key, name')
          .in('parent_bookable_id', linkedIds),
      ])
      activityBookableChildren.value = (kids ?? []) as ActivityBookable[]
      // De-dup by key — the same config (e.g. 'halves') typically exists on
      // every linked court, but we surface it once.
      const seen = new Map<string, ConfigurationOption>()
      for (const c of (configs ?? []) as ConfigurationOption[]) {
        if (!seen.has(c.key)) seen.set(c.key, c)
      }
      availableConfigurations.value = [...seen.values()]
    } else {
      activityBookableChildren.value = []
      availableConfigurations.value = []
    }

    // Org-wide venues for the Required-venue picker. Pull every active
    // venue plus its parent_id so the option labels can hint at hierarchy.
    const { data: venuesData } = await (db.from as any)('bookables')
      .select('id, name, parent_id')
      .eq('org_id', orgId.value)
      .eq('type', 'VENUE')
      .eq('status', 'ACTIVE')
      .order('name')
    orgVenueOptions.value = venuesData ?? []

    // Org-wide ITEM bookables for the Required-equipment picker.
    const { data: itemData } = await (db.from as any)('bookables')
      .select('id, name, max_concurrent')
      .eq('org_id', orgId.value)
      .eq('type', 'ITEM')
      .eq('status', 'ACTIVE')
      .order('name')
    orgItemOptions.value = itemData ?? []

    if (!isNew.value) {
      const [{ data: mode }, { data: modeBookables }, { data: modeResources }, { data: modeReqItems }] = await Promise.all([
        (db.from as any)('activity_modes').select('*').eq('id', route.params.modeId).single(),
        (db.from as any)('activity_mode_bookables').select('bookable_id').eq('mode_id', route.params.modeId),
        (db.from as any)('activity_mode_resources').select('bookable_id').eq('mode_id', route.params.modeId),
        (db.from as any)('activity_mode_required_items').select('id, bookable_id, quantity, is_optional, price_override').eq('mode_id', route.params.modeId).order('sort_order'),
      ])
      if (mode) {
        form.name = mode.name
        form.description = mode.description ?? ''
        form.color = mode.color ?? COLORS[0]
        form.image_url = mode.image_url ?? ''
        form.pricing = normalizePricing(mode.pricing)
        form.addons = mode.addons ?? []
        form.min_people     = mode.min_people     ?? null
        form.max_people     = mode.max_people     ?? null
        form.allow_visitors = mode.allow_visitors ?? false
        form.min_visitors   = mode.min_visitors   ?? null
        form.max_visitors   = mode.max_visitors   ?? null
        form.form_id        = mode.form_id        ?? null
        form.default_booking_view = mode.default_booking_view ?? null
        Object.assign(form.payment_options, mode.payment_options ?? {})
        form.approval_mode = mode.approval_mode ?? 'INSTANT'
        form.configuration_key = mode.configuration_key ?? null
        form.category = mode.category ?? ''
      }
      form.bookable_ids = (modeBookables ?? []).map((r: any) => r.bookable_id)
      form.resource_bookable_ids = (modeResources ?? []).map((r: any) => r.bookable_id)
      form.equipment_items = (modeReqItems ?? []).map((r: any) => ({
        id: r.id,
        bookable_id: r.bookable_id,
        quantity: r.quantity,
        is_optional: !!r.is_optional,
        price_override: r.price_override != null ? Number(r.price_override) : null,
      }))
    }
    await loadForms()

    // Apply ?form_id from a return-trip from /forms/new or /forms/:id
    const fromQuery = route.query.form_id as string | undefined
    if (fromQuery) form.form_id = fromQuery
  } finally {
    loading.value = false
  }
}

async function handleImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingImage.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await $fetch<{ url: string }>('/api/upload', { method: 'POST', body: fd })
    form.image_url = res.url
  } finally {
    uploadingImage.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function save() {
  if (!form.name.trim()) return
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      image_url: form.image_url || null,
      pricing: cleanPricing(form.pricing),
      addons: cleanAddons(form.addons),
      min_people:     form.min_people,
      max_people:     form.max_people,
      allow_visitors: form.allow_visitors,
      min_visitors:   form.allow_visitors ? form.min_visitors : null,
      max_visitors:   form.allow_visitors ? form.max_visitors : null,
      form_id:        form.form_id,
      default_booking_view: form.default_booking_view || null,
      payment_options: { ...form.payment_options },
      approval_mode: form.approval_mode,
      configuration_key: form.configuration_key,
      category: form.category?.trim() || null,
    }

    let modeId = route.params.modeId as string
    if (isNew.value) {
      const { data } = await (db.from as any)('activity_modes').insert({
        ...payload,
        activity_id: route.params.id,
        sort_order: 0,
      }).select().single()
      if (data) modeId = data.id
    } else {
      await (db.from as any)('activity_modes').update(payload).eq('id', route.params.modeId)
    }

    // Unified Venue picker: one underlying control, semantics chosen by
    // the activity type. Coach activities write to
    // activity_mode_resources (additional reservation pool); other
    // activities write to activity_mode_bookables (narrowing scope).
    // Wipe BOTH tables on every save so a row that's switched type
    // doesn't leave orphans behind.
    await (db.from as any)('activity_mode_bookables').delete().eq('mode_id', modeId)
    await (db.from as any)('activity_mode_resources').delete().eq('mode_id', modeId)
    if (isStaffOwned.value && form.resource_bookable_ids.length) {
      await (db.from as any)('activity_mode_resources').insert(
        form.resource_bookable_ids.map((bid, i) => ({ mode_id: modeId, bookable_id: bid, sort_order: i })),
      )
    }
    if (!isStaffOwned.value && form.bookable_ids.length) {
      await (db.from as any)('activity_mode_bookables').insert(
        form.bookable_ids.map(bid => ({ mode_id: modeId, bookable_id: bid })),
      )
    }

    // Replace mode-level equipment rows. Single list driven by the
    // editor; each row's is_optional drives where it surfaces in the
    // booker (locked vs editable).
    await (db.from as any)('activity_mode_required_items').delete().eq('mode_id', modeId)
    const equipmentRows = form.equipment_items
      .filter(r => r.bookable_id && r.quantity > 0)
      .map((r, i) => ({
        mode_id: modeId,
        bookable_id: r.bookable_id,
        quantity: r.quantity,
        is_optional: !!r.is_optional,
        price_override: r.price_override,
        sort_order: i,
      }))
    if (equipmentRows.length) {
      await (db.from as any)('activity_mode_required_items').insert(equipmentRows)
    }

    navigateTo(backHref.value)
  } finally {
    saving.value = false
  }
}

async function deleteMode() {
  if (!confirm('Delete this mode? This cannot be undone.')) return
  await (db.from as any)('activity_modes').delete().eq('id', route.params.modeId)
  navigateTo(`/activities/${route.params.id}`)
}

onMounted(load)
</script>
