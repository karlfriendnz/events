<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
      <button type="button"
        class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        @click="$emit('back')">
        <i class="pi pi-chevron-left text-sm" />
      </button>
      <div class="flex-1">
        <p class="text-sm font-bold text-gray-900">Settings</p>
        <p class="text-xs text-gray-400">Audience, design &amp; appearance</p>
      </div>
      <button type="button"
        class="px-3 py-1.5 bg-[#1ab4e8] hover:bg-[#16a0d0] text-white text-xs font-semibold rounded-lg transition-colors"
        @click="$emit('save')">Save</button>
    </div>

    <!-- Body -->
    <div class="px-4 py-4 space-y-5 overflow-y-auto flex-1">
      <!-- Audience -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Who is this form for?</p>
        <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
          <button v-for="opt in audienceOptions" :key="opt.value" type="button"
            class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="(audience ?? 'all') === opt.value
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-500 hover:text-gray-700'"
            @click="$emit('update:audience', opt.value)">
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Form Style -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Form Style</p>
        <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
          <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="design.style === 'single' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="design.style = 'single'">Single Page</button>
          <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="design.style === 'tabs' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="design.style = 'tabs'">Tabs</button>
        </div>
      </div>

      <!-- Header Image -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Header Image</p>
        <div class="flex p-1 bg-gray-100 rounded-xl gap-1 mb-2">
          <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="design.header === 'event' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="design.header = 'event'">Use Event Image</button>
          <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="design.header === 'custom' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="design.header = 'custom'">Custom Upload</button>
        </div>
        <div v-if="design.header === 'custom'">
          <label class="flex items-center gap-3 border border-dashed border-gray-200 rounded-xl p-3 cursor-pointer hover:border-[#0e43a3] hover:bg-blue-50/30 transition-colors">
            <div class="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <i class="pi pi-upload text-gray-400 text-sm" />
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-700">Upload header image</p>
              <p class="text-[11px] text-gray-400">PNG, JPG up to 5MB</p>
            </div>
            <input type="file" accept="image/*" class="hidden"
              @change="$emit('image-upload', 'headerImage', $event)" />
          </label>
          <img v-if="design.headerImage" :src="design.headerImage" class="w-full h-20 object-cover rounded-xl mt-2" />
        </div>
      </div>

      <!-- Top Icons -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Event Info Icons</p>
        <div class="grid grid-cols-2 gap-y-1 gap-x-2">
          <label v-for="icon in iconKeys" :key="icon"
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
            <Checkbox v-model="design.icons[icon]" binary />
            <span class="text-sm text-gray-700 capitalize">{{ icon }}</span>
          </label>
        </div>
      </div>

      <!-- Description -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Description</p>
        <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
          <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="design.description === 'event' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="design.description = 'event'">From Event</button>
          <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="design.description === 'custom' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="design.description = 'custom'">Custom</button>
        </div>
        <p v-if="design.description === 'custom'" class="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
          <i class="pi pi-arrow-right text-[10px]" />Edit the text directly in the preview →
        </p>
      </div>

      <!-- Form Heading -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Form Heading</p>
        <input v-model="design.formHeading" type="text" placeholder="Fill in the form to register"
          class="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#0e43a3] transition-colors" />
      </div>

      <!-- Add Person Button -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Add Person Button</p>
        <div class="flex items-center gap-2 p-2 border border-gray-200 rounded-xl">
          <input type="color" v-model="design.addPersonColor" class="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
          <span class="text-xs text-gray-500 font-mono flex-1">{{ design.addPersonColor }}</span>
          <button type="button" class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            @click="design.addPersonColor = '#0e43a3'">Reset</button>
        </div>
      </div>

      <!-- Background -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Page Background</p>
        <FormsSegmentedControl v-model="design.background"
          :options="backgroundOptions" class="mb-2" />

        <div v-if="design.background === 'colour'" class="flex items-center gap-2 p-2 border border-gray-200 rounded-xl">
          <input type="color" v-model="design.backgroundColor" class="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
          <span class="text-xs text-gray-500 font-mono flex-1">{{ design.backgroundColor }}</span>
          <button type="button" class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            @click="design.backgroundColor = '#f0f2f5'">Reset</button>
        </div>

        <template v-if="design.background === 'custom'">
          <FormsImageUploadField v-model="design.backgroundImage" placeholder="Upload background image" class="mb-3" />
          <div v-if="design.backgroundImage" class="space-y-3">
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <p class="text-xs font-semibold text-gray-600">Fade Overlay</p>
                <span class="text-xs text-gray-400 font-mono">{{ Math.round(design.backgroundOverlay * 100) }}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05"
                v-model.number="design.backgroundOverlay"
                class="w-full accent-[#1E2157]" />
            </div>
          </div>
        </template>
      </div>

      <!-- Sponsors -->
      <div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sponsors</p>
        <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
          <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="design.sponsors === 'show' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="design.sponsors = 'show'">Show</button>
          <button type="button" class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            :class="design.sponsors === 'hide' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="design.sponsors = 'hide'">Hide</button>
        </div>
      </div>

      <button type="button"
        class="w-full py-2.5 rounded-xl bg-[#1ab4e8] hover:bg-[#16a0d0] text-white font-semibold text-sm transition-colors"
        @click="$emit('save')">Save Settings</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /**
   * The currentEvtFormDesign object — bound by reference, so direct mutations
   * (e.g. `design.style = 'tabs'`) propagate back to the parent's reactive
   * state, matching how the inline block worked.
   */
  design: any
  /** The form group's audience ('all' | 'members' | 'public'). */
  audience: 'all' | 'members' | 'public'
}>()
defineEmits<{
  (e: 'back'): void
  (e: 'save'): void
  (e: 'update:audience', value: 'all' | 'members' | 'public'): void
  (e: 'image-upload', key: 'headerImage', event: Event): void
}>()

const audienceOptions = [
  { value: 'all',     label: 'Everyone' },
  { value: 'members', label: 'Members' },
  { value: 'public',  label: 'Public' },
] as const
const backgroundOptions = [
  { label: 'Default', value: 'default' },
  { label: 'Colour',  value: 'colour' },
  { label: 'Image',   value: 'custom' },
]
const iconKeys = ['date', 'time', 'cost', 'location', 'criteria'] as const
</script>
