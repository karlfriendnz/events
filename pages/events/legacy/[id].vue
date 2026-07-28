<script setup lang="ts">
/**
 * An event that still lives in the OLD FriendlyManager platform, shown inside
 * the new events module.
 *
 * Clicking one on the calendar used to be a dead end. This gives it a real
 * view — when it runs, where, who is on the roll, what they were charged —
 * without pretending the module owns it.
 *
 * EDITABLE, but only the fields the old platform actually has a home for. The
 * save is a PARTIAL update — untouched fields (awards, programme links, terms
 * text, the roll) are never sent, so editing from here cannot quietly drop what
 * this module has no screen for. Venues come from the old platform too, since
 * that module has not moved across.
 */
const route = useRoute()
const legacyId = computed(() => String(route.params.id))

const { data, pending, error } = await useAsyncData(
  () => `legacy-event-${legacyId.value}`,
  () => $fetch<any>('/api/v1/legacy/event', { query: { id: legacyId.value } }),
)

const ev = computed(() => data.value?.event ?? null)
const roll = computed(() => data.value?.attendance ?? [])
const fees = computed(() => data.value?.fees ?? [])

// ── editing ───────────────────────────────────────────────────────────────
const toast = useToast()
const editing = ref(false)
const saving = ref(false)
const form = reactive<Record<string, any>>({})

/** Venues + categories come from the old platform (its modules still own them). */
const { data: options } = await useAsyncData('legacy-event-options', () =>
  $fetch<any>('/api/v1/legacy/options').catch(() => ({ venues: [], categories: [] })))

const venueOptions = computed(() => (options.value?.venues ?? []).map((v: any) => ({
  label: v.location ? `${v.name} — ${v.location}` : v.name, value: v.id,
})))
const categoryOptions = computed(() => (options.value?.categories ?? []).map((c: any) => ({
  label: c.name, value: c.id,
})))

function startEdit() {
  const e = ev.value
  Object.assign(form, {
    name: e.name,
    date: e.date,
    startTime: (e.startTime || '').slice(0, 5),
    endDate: e.endDate || e.date,
    endTime: (e.endTime || '').slice(0, 5),
    venueID: e.venueID ?? null,
    maxAttendees: e.maxAttendees ?? null,
    fee: e.fee ?? 0,
    notes: e.notes || '',
    isPublic: !!e.isPublic,
    categoryIDs: [...(e.categoryIDs || [])],
  })
  editing.value = true
}

async function save() {
  if (!String(form.name || '').trim()) {
    toast.add({ severity: 'warn', summary: 'The event needs a name', life: 3000 })
    return
  }
  saving.value = true
  try {
    // Times go back in the old platform's HH:MM:SS form.
    const t = (v: string) => (v ? `${v}:00`.slice(0, 8) : '00:00:00')
    await $fetch('/api/v1/legacy/event', {
      method: 'PATCH',
      body: {
        id: legacyId.value,
        name: form.name.trim(),
        date: form.date,
        startTime: t(form.startTime),
        endDate: form.endDate || form.date,
        endTime: t(form.endTime),
        venueID: form.venueID ?? null,
        maxAttendees: Number(form.maxAttendees) || 0,
        fee: Number(form.fee) || 0,
        notes: form.notes,
        isPublic: form.isPublic,
        categoryIDs: form.categoryIDs,
      },
    })
    await refreshNuxtData(`legacy-event-${legacyId.value}`)
    // No success toast: the form closing on the updated event is the feedback,
    // and naming where it saved just draws attention to the seam. Failures DO
    // still toast — a silent failure would look identical to a save.
    editing.value = false
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: "Couldn't save",
      detail: e?.statusMessage || e?.data?.statusMessage || 'The change was not stored.',
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

/** EventPerson statuses, straight from the old platform's own constants. */
const STATUS: Record<number, { label: string; class: string }> = {
  [-1]: { label: 'Declined', class: 'bg-red-50 text-red-700' },
  0: { label: 'Invited', class: 'bg-gray-100 text-gray-600' },
  1: { label: 'Attended', class: 'bg-emerald-50 text-emerald-700' },
  2: { label: 'Invited', class: 'bg-gray-100 text-gray-600' },
  3: { label: 'Included', class: 'bg-blue-50 text-blue-700' },
  4: { label: 'Confirmed', class: 'bg-blue-50 text-blue-700' },
}

function when(e: any) {
  if (!e?.date) return 'No date'
  const d = new Date(`${e.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  if (e.allDay) return `${d} · All day`
  const t = (v?: string) => (v || '').slice(0, 5)
  return `${d} · ${t(e.startTime)}–${t(e.endTime)}`
}

const attended = computed(() => roll.value.filter((r: any) => Number(r.status) === 1).length)
const money = (n: number) => `$${Number(n || 0).toFixed(2)}`
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto">
    <div v-if="pending" class="text-sm text-gray-500">Loading…</div>

    <div v-else-if="error || !ev" class="card p-4 border-l-4 border-l-red-500">
      <div class="text-sm font-semibold text-gray-800">Couldn't open this event</div>
      <p class="text-xs text-gray-500 mt-1">
        It lives in the club's existing system, and that couldn't be reached.
      </p>
    </div>

    <template v-else>
      <!-- ── Edit ─────────────────────────────────────────────────────── -->
      <div v-if="editing" class="card p-4 sm:p-5 mb-4">
        <h2 class="text-sm font-semibold text-gray-800 mb-4">Edit event</h2>

        <div class="space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
            <label class="field-label w-full sm:w-28">Name</label>
            <InputText v-model="form.name" class="flex-1" placeholder="Event name" />
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
            <label class="field-label w-full sm:w-28">Starts</label>
            <div class="flex-1 flex gap-2">
              <input v-model="form.date" type="date" class="p-inputtext flex-1" />
              <input v-model="form.startTime" type="time" class="p-inputtext w-32" />
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
            <label class="field-label w-full sm:w-28">Ends</label>
            <div class="flex-1 flex gap-2">
              <input v-model="form.endDate" type="date" class="p-inputtext flex-1" />
              <input v-model="form.endTime" type="time" class="p-inputtext w-32" />
            </div>
          </div>

          <!-- The club's real venues, from the system that still owns them. -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
            <label class="field-label w-full sm:w-28">Venue</label>
            <Select v-model="form.venueID" :options="venueOptions" option-label="label"
              option-value="value" placeholder="No venue" show-clear class="flex-1" />
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
            <label class="field-label w-full sm:w-28">Category</label>
            <ChipMultiSelect v-model="form.categoryIDs" :options="categoryOptions"
              option-label="label" option-value="value" placeholder="No category" class="flex-1" />
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
            <label class="field-label w-full sm:w-28">Places</label>
            <InputNumber v-model="form.maxAttendees" class="w-32" :use-grouping="false" placeholder="0" />
            <label class="field-label sm:ml-4">Fee</label>
            <InputNumber v-model="form.fee" mode="currency" currency="NZD" locale="en-NZ" class="w-36" />
          </div>

          <div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-6">
            <label class="field-label w-full sm:w-28 sm:pt-2">Notes</label>
            <Textarea v-model="form.notes" rows="3" class="flex-1" placeholder="Notes about this event" />
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
            <label class="field-label w-full sm:w-28">Public</label>
            <ToggleSwitch v-model="form.isPublic" />
            <span class="field-help">May be seen on your website</span>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <Button label="Cancel" text size="small" :disabled="saving" @click="editing = false" />
          <Button label="Save" size="small" :loading="saving"
            style="background:var(--brand-primary); border-color:var(--brand-primary)" @click="save" />
        </div>
      </div>

      <div v-else class="card p-4 sm:p-5 mb-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-lg sm:text-2xl font-semibold text-gray-800">{{ ev.name }}</h1>
            <p class="text-sm text-gray-500 mt-1">{{ when(ev) }}</p>
          </div>
          <Button label="Edit" icon="pi pi-pencil" size="small" outlined class="shrink-0" @click="startEdit" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-4">
          <div v-if="ev.location" class="flex items-center gap-2 text-sm">
            <i class="pi pi-map-marker text-gray-400 text-xs" />
            <span class="text-gray-700">{{ ev.location }}</span>
          </div>
          <div v-if="ev.categories?.length" class="flex items-center gap-2 text-sm">
            <i class="pi pi-tag text-gray-400 text-xs" />
            <span class="text-gray-700">{{ ev.categories.map((c: any) => c.name).join(', ') }}</span>
          </div>
          <div v-if="ev.maxAttendees" class="flex items-center gap-2 text-sm">
            <i class="pi pi-users text-gray-400 text-xs" />
            <span class="text-gray-700">{{ roll.length }} of {{ ev.maxAttendees }} places</span>
          </div>
          <div v-if="ev.fee" class="flex items-center gap-2 text-sm">
            <i class="pi pi-wallet text-gray-400 text-xs" />
            <span class="text-gray-700">{{ money(ev.fee) }}</span>
          </div>
        </div>

        <p v-if="ev.notes" class="text-sm text-gray-600 mt-4 whitespace-pre-line">{{ ev.notes }}</p>
      </div>

      <!-- The roll -->
      <div class="card overflow-hidden mb-4">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-800">Who's on it</h2>
          <span class="text-xs text-gray-500">{{ attended }} of {{ roll.length }} attended</span>
        </div>
        <div v-if="!roll.length" class="px-4 py-6 text-center text-sm text-gray-500">
          Nobody has been added to this event.
        </div>
        <div v-else class="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          <div v-for="(r, i) in roll" :key="i" class="px-4 py-2.5 flex items-center gap-3">
            <span class="text-sm text-gray-800 flex-1 min-w-0 truncate">
              {{ r.name || `Person ${r.personID}` }}
            </span>
            <span v-if="r.signedInTime" class="text-xs text-gray-400">
              in {{ String(r.signedInTime).slice(11, 16) }}
            </span>
            <span class="text-[11px] px-2 py-0.5 rounded-full shrink-0"
              :class="(STATUS[Number(r.status)] || STATUS[0]).class">
              {{ (STATUS[Number(r.status)] || STATUS[0]).label }}
            </span>
          </div>
        </div>
      </div>

      <!-- Charges, so the money is visible next to the event that caused it -->
      <div v-if="fees.length" class="card overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-800">Charges</h2>
        </div>
        <div class="divide-y divide-gray-100">
          <div v-for="f in fees" :key="f.feeID" class="px-4 py-2.5 flex items-center gap-3 text-sm">
            <span class="flex-1 min-w-0 truncate text-gray-700">{{ f.name }}</span>
            <span class="text-gray-500 text-xs">{{ money(f.paid) }} of {{ money(f.amount) }} paid</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
