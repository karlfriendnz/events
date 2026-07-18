<!--
  Communication topics ("subjects" people subscribe to during registration). Core
  topics (is_core) are inherited from the platform and read-only; the club adds its
  own. Each topic delivers over the chosen channels (email / app). The registration
  "Communication preferences" field pulls this list (core + own).
-->
<script setup lang="ts">
import { EVENT_TOKENS, DEFAULT_INVITATION } from '~/composables/useEventTokens'

// Reads/writes email_templates (migration 259: get subject/body + upsert by
// org+key) and communication_topics (core+org merged read + create/update/delete)
// through the communications seam — no direct DB access.
const api = useCommunicationsApi()
const { orgId } = useOrg()
const toast = useToast()

// ── The club's default event invitation (email_templates, migration 259) ──
// One row per org, keyed 'event_invitation'. Every event seeds its wording from
// this; reminders/confirmations will be further keys in the same table.
const invite = reactive({ ...DEFAULT_INVITATION })
const inviteBodyEl = ref<any>(null)
const savingInvite = ref(false)

async function loadInvite() {
  const data = await api.getEmailTemplate(orgId.value, 'event_invitation')
  if (data) { invite.subject = data.subject; invite.body = data.body }
}

function insertInviteToken(token: string) {
  const el = inviteBodyEl.value?.$el ?? inviteBodyEl.value
  const start = el?.selectionStart ?? invite.body.length
  const end = el?.selectionEnd ?? invite.body.length
  invite.body = invite.body.slice(0, start) + token + invite.body.slice(end)
  nextTick(() => {
    el?.focus?.()
    el?.setSelectionRange?.(start + token.length, start + token.length)
  })
}

function resetInvite() {
  invite.subject = DEFAULT_INVITATION.subject
  invite.body = DEFAULT_INVITATION.body
}

async function saveInvite() {
  savingInvite.value = true
  try {
    await api.upsertEmailTemplate({
      orgId: orgId.value, key: 'event_invitation', subject: invite.subject, body: invite.body,
    })
    toast.add({ severity: 'success', summary: 'Default invitation saved', life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 4000 })
  } finally {
    savingInvite.value = false
  }
}

watch(orgId, v => { if (v) loadInvite() }, { immediate: true })

interface Topic {
  key: string
  kind: 'core' | 'local'
  id?: string
  name: string
  description: string | null
  channels: string[]
  is_active: boolean
  _new?: boolean
}

const items = ref<Topic[]>([])
const selectedKey = ref<string | null>(null)
const selected = computed(() => items.value.find(i => i.key === selectedKey.value) || null)
const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  const topics = await api.listTopics(orgId.value)
  const list: Topic[] = topics.map(t => ({
    key: (t.isCore ? 'core:' : 'local:') + t.id,
    kind: t.isCore ? 'core' : 'local',
    id: t.id,
    name: t.name,
    description: t.description,
    channels: t.channels ?? [],
    is_active: t.isActive,
  }))
  items.value = list
  if (!selected.value && list.length) selectedKey.value = list[0].key
  loading.value = false
}

function newTopic() {
  const it: Topic = { key: 'new:' + Math.random().toString(36).slice(2), kind: 'local', name: 'New topic', description: '', channels: ['email', 'app'], is_active: true, _new: true }
  items.value.push(it); selectedKey.value = it.key
}

function toggleChannel(it: Topic, ch: string) {
  it.channels = it.channels.includes(ch) ? it.channels.filter(c => c !== ch) : [...it.channels, ch]
}

async function save() {
  const t = selected.value; if (!t || t.kind === 'core' || !t.name.trim()) return
  saving.value = true
  try {
    if (t._new || !t.id) {
      await api.createTopic({ orgId: orgId.value, name: t.name.trim(), description: t.description, channels: t.channels, isActive: t.is_active })
    } else {
      await api.updateTopic(t.id, { orgId: orgId.value, name: t.name.trim(), description: t.description, channels: t.channels, isActive: t.is_active })
    }
    toast.add({ severity: 'success', summary: 'Saved', life: 2000 }); await load()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: e?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

async function removeTopic(it: Topic) {
  if (it.id) await api.removeTopic(it.id, orgId.value)
  items.value = items.value.filter(x => x.key !== it.key); selectedKey.value = items.value[0]?.key ?? null
}

const CHANNELS = [{ key: 'email', label: 'Email', icon: 'pi-envelope' }, { key: 'app', label: 'App notification', icon: 'pi-mobile' }]

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 max-w-6xl mx-auto">
    <div class="mb-4">
      <h1 class="text-xl font-semibold text-gray-900">Communications</h1>
      <p class="text-sm text-gray-500">Topics members can subscribe to during registration. Core topics are inherited; add your own. Each delivers over the chosen channels.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
      <!-- list -->
      <div class="card p-0 overflow-hidden h-fit">
        <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Topics</span>
          <button class="text-xs text-primary hover:underline" @click="newTopic">+ New</button>
        </div>
        <div v-if="loading" class="p-4 text-sm text-gray-400">Loading…</div>
        <button v-for="it in items" :key="it.key" type="button"
          class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
          :class="it.key === selectedKey ? 'bg-gray-50 font-medium text-primary' : 'text-gray-700'"
          @click="selectedKey = it.key">
          <span class="truncate flex items-center gap-2"><span v-if="!it.is_active" class="w-1.5 h-1.5 rounded-full bg-gray-300" />{{ it.name }}</span>
          <span class="text-[9px] uppercase tracking-wide shrink-0" :class="it.kind === 'core' ? 'text-gray-400' : 'text-emerald-500'">{{ it.kind === 'core' ? 'inherited' : 'own' }}</span>
        </button>
        <p v-if="!loading && !items.length" class="p-4 text-xs text-gray-400">No topics yet — add one.</p>
      </div>

      <!-- editor -->
      <div v-if="selected" class="space-y-4">
        <div v-if="selected.kind === 'core'" class="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm text-blue-800 flex items-center gap-2">
          <i class="pi pi-lock" />Inherited from the platform — read-only.
        </div>

        <div class="card p-5 space-y-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Topic name</label>
            <InputText v-model="selected.name" :disabled="selected.kind === 'core'" placeholder="e.g. Team updates" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Description</label>
            <InputText v-model="selected.description" :disabled="selected.kind === 'core'" placeholder="What this topic covers" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Delivered by</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="ch in CHANNELS" :key="ch.key" type="button" :disabled="selected.kind === 'core'"
                class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors disabled:opacity-60 disabled:cursor-default"
                :class="selected.channels.includes(ch.key) ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
                @click="toggleChannel(selected, ch.key)">
                <i :class="['pi', ch.icon, 'text-xs']" />{{ ch.label }}
              </button>
            </div>
          </div>
          <label class="flex items-center justify-between gap-3">
            <span class="text-sm font-medium">Active</span>
            <ToggleSwitch v-model="selected.is_active" :disabled="selected.kind === 'core'" />
          </label>
        </div>

        <div v-if="selected.kind !== 'core'" class="flex items-center justify-between">
          <button class="text-sm text-red-600 hover:underline" @click="removeTopic(selected)">Delete topic</button>
          <Button label="Save" :loading="saving" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
        </div>
      </div>
      <div v-else class="card p-8 text-center text-gray-400 text-sm">Select a topic, or create one.</div>
    </div>

    <!-- ── The club's default invitation ──
         Written once here; every event starts from it and can tweak its own
         wording before sending. Deliberately basic (subject + message + merge
         fields) — the club's real mailer is the FriendlyManager one, and this is
         the starting point, not a replacement for it. -->
    <div class="card p-5 mt-5">
      <div class="mb-3">
        <h2 class="text-sm font-semibold text-gray-800">Default event invitation</h2>
        <p class="text-xs text-gray-500 mt-0.5">
          The wording every event's invitation email starts from. Each event can change its own before sending.
          Your logo and colours are added automatically.
        </p>
      </div>

      <div class="space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
          <label class="text-sm text-gray-500 w-full sm:w-28 shrink-0">Subject</label>
          <InputText v-model="invite.subject" class="w-full" />
        </div>
        <div class="flex flex-col sm:flex-row gap-1 sm:gap-6">
          <label class="text-sm text-gray-500 w-full sm:w-28 shrink-0 sm:pt-2">Message</label>
          <div class="flex-1 min-w-0">
            <Textarea ref="inviteBodyEl" v-model="invite.body" rows="6" class="w-full" />
            <div class="flex flex-wrap items-center gap-1.5 mt-2">
              <span class="text-xs text-gray-400 mr-1">Add:</span>
              <button v-for="tk in EVENT_TOKENS" :key="tk.value" type="button" v-tooltip.top="tk.hint"
                class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                @click="insertInviteToken(tk.value)">
                {{ tk.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between mt-4">
        <button class="text-xs text-gray-500 hover:text-primary hover:underline" @click="resetInvite">
          Reset to the standard wording
        </button>
        <Button label="Save default" :loading="savingInvite"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveInvite" />
      </div>
    </div>
  </div>
</template>
