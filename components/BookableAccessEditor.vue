<template>
  <div class="p-3 sm:p-6 max-w-[1140px] mx-auto space-y-5">

    <!-- Master toggle -->
    <div class="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4">
      <div class="flex-1">
        <p class="text-sm font-semibold text-gray-800">Access controlled venue</p>
        <p class="text-xs text-gray-500 mt-0.5">
          When on, bookings on this venue automatically generate an access code and a
          door / lighting unlock window. Codes are sent to the booker on confirmation.
        </p>
      </div>
      <ToggleSwitch v-model="form.access_enabled" @update:modelValue="autosave" />
    </div>

    <div v-if="form.access_enabled" class="space-y-5">

      <!-- Connected doors -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-gray-800">Connected doors</p>
            <p class="text-xs text-gray-500 mt-0.5">Picked doors unlock for the booking window.</p>
          </div>
          <NuxtLink to="/bookables?tab=access" class="text-xs text-primary hover:underline">Manage doors</NuxtLink>
        </div>
        <div class="px-5 py-4">
          <div v-if="!doors.length" class="text-sm text-gray-400 italic">
            No doors yet. <NuxtLink to="/bookables?tab=access" class="text-primary hover:underline not-italic">Add one</NuxtLink> first.
          </div>
          <MultiSelect v-else
            v-model="connectedDoorIds"
            :options="doors"
            option-label="name" option-value="id"
            placeholder="Pick doors"
            display="chip" filter
            class="w-full"
            @update:modelValue="saveDoorLinks" />
        </div>
      </div>

      <!-- Connected light zones -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-gray-800">Connected lights</p>
            <p class="text-xs text-gray-500 mt-0.5">Light zones come on for the booking window.</p>
          </div>
          <NuxtLink to="/bookables?tab=access" class="text-xs text-primary hover:underline">Manage lights</NuxtLink>
        </div>
        <div class="px-5 py-4">
          <div v-if="!zones.length" class="text-sm text-gray-400 italic">
            No light zones yet. <NuxtLink to="/bookables?tab=access" class="text-primary hover:underline not-italic">Add one</NuxtLink> first.
          </div>
          <MultiSelect v-else
            v-model="connectedZoneIds"
            :options="zones"
            option-label="name" option-value="id"
            placeholder="Pick light zones"
            display="chip" filter
            class="w-full"
            @update:modelValue="saveZoneLinks" />
        </div>
      </div>

      <!-- Access code delivery -->
      <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div class="px-5 py-4">
          <p class="text-sm font-semibold text-gray-800">Access code</p>
          <p class="text-xs text-gray-500 mt-0.5">A unique code is generated for every confirmed booking.</p>
        </div>
        <SettingsRow label="Code length" description="Number of digits in the generated code">
          <div class="flex items-center gap-2">
            <InputNumber v-model="form.access_code_length" :min="4" :max="12" class="w-20"
              @blur="autosave" />
            <span class="text-xs text-gray-400">digits</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Send to booker via" description="Where the code is delivered after confirmation">
          <Select v-model="form.access_code_delivery"
            :options="deliveryOptions" option-label="label" option-value="value"
            class="w-48"
            @update:modelValue="autosave" />
        </SettingsRow>
      </div>

      <!-- Unlock timing -->
      <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div class="px-5 py-4">
          <p class="text-sm font-semibold text-gray-800">Unlock window</p>
          <p class="text-xs text-gray-500 mt-0.5">How early before and after the booking the door stays unlocked.</p>
        </div>
        <SettingsRow label="Unlock before start" description="Lets the booker arrive early">
          <div class="flex items-center gap-2">
            <InputNumber v-model="form.access_unlock_before_mins" :min="0" :max="120" class="w-20"
              @blur="autosave" />
            <span class="text-xs text-gray-400">mins</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Stay unlocked after end" description="Grace period for clearing out">
          <div class="flex items-center gap-2">
            <InputNumber v-model="form.access_unlock_after_mins" :min="0" :max="120" class="w-20"
              @blur="autosave" />
            <span class="text-xs text-gray-400">mins</span>
          </div>
        </SettingsRow>
      </div>

      <!-- Lighting -->
      <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div class="px-5 py-4">
          <p class="text-sm font-semibold text-gray-800">Lighting schedule</p>
          <p class="text-xs text-gray-500 mt-0.5">Used by every connected light zone unless that zone has its own override.</p>
        </div>
        <SettingsRow label="Ramp up before start" description="Bring lights on N minutes early">
          <div class="flex items-center gap-2">
            <InputNumber v-model="form.lighting_ramp_up_mins" :min="0" :max="60" class="w-20"
              @blur="autosave" />
            <span class="text-xs text-gray-400">mins</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Ramp down after end" description="Keep lights on N minutes after">
          <div class="flex items-center gap-2">
            <InputNumber v-model="form.lighting_ramp_down_mins" :min="0" :max="60" class="w-20"
              @blur="autosave" />
            <span class="text-xs text-gray-400">mins</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Default level" description="Brightness percentage while in use">
          <div class="flex items-center gap-2">
            <InputNumber v-model="form.lighting_level_percent" :min="0" :max="100" class="w-20"
              @blur="autosave" />
            <span class="text-xs text-gray-400">%</span>
          </div>
        </SettingsRow>
      </div>

      <p v-if="lastSavedAt" class="text-xs text-gray-400 text-right">
        Saved {{ lastSavedAt }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ bookableId: string }>()

const { orgId } = useOrg()
const api = useBookingsApi()

const doors = ref<any[]>([])
const zones = ref<any[]>([])
const connectedDoorIds = ref<string[]>([])
const connectedZoneIds = ref<string[]>([])
const lastSavedAt = ref<string | null>(null)

const form = reactive({
  access_enabled: false,
  access_code_delivery: 'email' as 'none' | 'email' | 'sms' | 'both',
  access_code_length: 6,
  access_unlock_before_mins: 5,
  access_unlock_after_mins: 5,
  lighting_ramp_up_mins: 0,
  lighting_ramp_down_mins: 0,
  lighting_level_percent: 100,
})

const deliveryOptions = [
  { label: 'Don\'t send', value: 'none' },
  { label: 'Email',       value: 'email' },
  { label: 'SMS',         value: 'sms' },
  { label: 'Email + SMS', value: 'both' },
]

async function loadAll() {
  if (!orgId.value || !props.bookableId) return
  const [bookable, dRows, zRows, bdIds, blIds] = await Promise.all([
    api.bookable(props.bookableId),
    api.doors(orgId.value),
    api.lightZones(orgId.value),
    api.bookableDoors(props.bookableId),
    api.bookableLightZones(props.bookableId),
  ])
  if (bookable) {
    Object.assign(form, {
      access_enabled: bookable.accessEnabled ?? false,
      access_code_delivery: bookable.accessCodeDelivery ?? 'email',
      access_code_length: bookable.accessCodeLength ?? 6,
      access_unlock_before_mins: bookable.accessUnlockBeforeMins ?? 5,
      access_unlock_after_mins: bookable.accessUnlockAfterMins ?? 5,
      lighting_ramp_up_mins: bookable.lightingRampUpMins ?? 0,
      lighting_ramp_down_mins: bookable.lightingRampDownMins ?? 0,
      lighting_level_percent: bookable.lightingLevelPercent ?? 100,
    })
  }
  // Seam has no is_active filter — keep only active doors/zones (template reads id/name, camel = same).
  doors.value = (dRows ?? []).filter((d: any) => d.isActive)
  zones.value = (zRows ?? []).filter((z: any) => z.isActive)
  connectedDoorIds.value = bdIds ?? []
  connectedZoneIds.value = blIds ?? []
}

let saveTimer: any = null
function autosave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => doSave(), 250)
}

async function doSave() {
  if (!props.bookableId) return
  const payload = {
    accessEnabled: form.access_enabled,
    accessCodeDelivery: form.access_code_delivery,
    accessCodeLength: form.access_code_length ?? 6,
    accessUnlockBeforeMins: form.access_unlock_before_mins ?? 5,
    accessUnlockAfterMins: form.access_unlock_after_mins ?? 5,
    lightingRampUpMins: form.lighting_ramp_up_mins ?? 0,
    lightingRampDownMins: form.lighting_ramp_down_mins ?? 0,
    lightingLevelPercent: form.lighting_level_percent ?? 100,
  }
  try {
    await api.updateBookable(props.bookableId, payload)
    lastSavedAt.value = new Date().toLocaleTimeString()
  } catch { /* keep prior saved-at */ }
}

async function saveDoorLinks() {
  if (!props.bookableId) return
  await api.setBookableDoors(props.bookableId, connectedDoorIds.value)
  lastSavedAt.value = new Date().toLocaleTimeString()
}

async function saveZoneLinks() {
  if (!props.bookableId) return
  await api.setBookableLightZones(props.bookableId, connectedZoneIds.value)
  lastSavedAt.value = new Date().toLocaleTimeString()
}

watch(() => [props.bookableId, orgId.value], loadAll, { immediate: true })
</script>
