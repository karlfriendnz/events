<!--
  Clubs — a governing body's register of who is affiliated to it, and the approval
  queue for who wants to be.

  This screen is the counterparty that never existed. Until migration 273 a club
  affiliated to a body by picking it from a dropdown: the body was never asked,
  never told, and had no list of its own clubs, while the claim alone gave its
  fields authority over that club's members' data.

  Approving does two things: it switches the LIVE link on (org_sport_ancestors
  only counts approved rows, so fields/disciplines/terminology start applying via
  the joins that already existed), and it seeds the club's person types pre-linked
  so the club can rename them to whatever it calls people. Nothing else is copied.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const { orgId } = useOrg()
const toast = useToast()
const orgsApi = useOrganisationsApi()
const { loadForBody, decide, approveAndSeed } = useAffiliations()

const rows = ref<AffiliationRow[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)
const org = ref<{ name: string; org_level: string } | null>(null)
const isGoverning = computed(() => !!org.value && isGoverningBody(org.value.org_level))

useBreadcrumbs([{ label: 'Settings', to: '/settings' }, { label: 'Clubs' }] as any)

const pending = computed(() => rows.value.filter(r => r.affiliation_status === 'pending'))
const approved = computed(() => rows.value.filter(r => r.affiliation_status === 'approved'))
const ended = computed(() => rows.value.filter(r => r.affiliation_status === 'revoked'))

async function load() {
  if (!orgId.value) return
  loading.value = true
  const o = await orgsApi.get(orgId.value)
  org.value = o ? { name: o.name, org_level: o.orgLevel } : null
  rows.value = isGoverningBody(o?.orgLevel) ? await loadForBody(orgId.value) : []
  loading.value = false
}

async function approve(r: AffiliationRow) {
  busy.value = r.id
  const { error, seeded, linked } = await approveAndSeed(r)
  busy.value = null
  if (error) { toast.add({ severity: 'error', summary: 'Could not approve', detail: error.message, life: 4000 }); return }
  toast.add({
    severity: 'success', summary: `${r.clubName} affiliated`,
    detail: seeded || linked ? `Sent them ${seeded} type${seeded === 1 ? '' : 's'} and ${linked} connection${linked === 1 ? '' : 's'}.` : 'Your fields now apply to their members.',
    life: 3500,
  })
  await load()
}

async function set(r: AffiliationRow, status: AffiliationStatus) {
  busy.value = r.id
  const { error } = await decide(r.id, status)
  busy.value = null
  if (error) { toast.add({ severity: 'error', summary: 'Failed', detail: error.message, life: 4000 }); return }
  await load()
}

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 flex gap-6">
    <SettingsNav />
    <div class="flex-1 min-w-0 space-y-4">
      <div v-if="loading" class="card p-5 text-sm text-gray-400">Loading…</div>

      <div v-else-if="!isGoverning" class="card p-5">
        <p class="text-sm text-gray-500">Only a governing body has affiliated clubs. This organisation is a club — its own affiliations live on <NuxtLink to="/settings/locations" class="text-primary hover:underline">Sports &amp; locations</NuxtLink>.</p>
      </div>

      <template v-else>
        <!-- Requests: the decision this body never got to make -->
        <div class="card p-0 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-gray-800">Requests</h2>
              <p class="field-help">Clubs asking to affiliate. Nothing of yours applies to their members until you approve.</p>
            </div>
            <span v-if="pending.length" class="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{{ pending.length }}</span>
          </div>
          <div v-if="!pending.length" class="px-4 py-6 text-sm text-gray-400">No requests waiting.</div>
          <div v-for="r in pending" :key="r.id" class="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 truncate">{{ r.clubName }}</div>
              <div class="field-help">
                wants to affiliate for <span class="font-medium text-gray-600">{{ r.sport }}</span>
                <span v-if="r.bodyName && r.bodyName !== org?.name"> · to {{ r.bodyName }}</span>
                · asked {{ fmt(r.requested_at) }}
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button class="text-xs text-gray-500 hover:text-rose-600 px-2 py-1" :disabled="busy === r.id" @click="set(r, 'revoked')">Decline</button>
              <button class="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                style="background:var(--brand-primary)" :disabled="busy === r.id" @click="approve(r)">
                {{ busy === r.id ? 'Approving…' : 'Approve' }}
              </button>
            </div>
          </div>
        </div>

        <!-- The register -->
        <div class="card p-0 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-100">
            <h2 class="text-sm font-semibold text-gray-800">Affiliated clubs</h2>
            <p class="field-help">Your fields, disciplines and requirements apply to these clubs' members — live, as you change them.</p>
          </div>
          <div v-if="!approved.length" class="px-4 py-6 text-sm text-gray-400">No affiliated clubs yet.</div>
          <div v-for="r in approved" :key="r.id" class="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 truncate">{{ r.clubName }}</div>
              <div class="field-help">{{ r.sport }}<span v-if="r.bodyName && r.bodyName !== org?.name"> · via {{ r.bodyName }}</span> · since {{ fmt(r.decided_at) }}</div>
            </div>
            <button class="text-xs text-gray-400 hover:text-rose-600 shrink-0 px-2 py-1" :disabled="busy === r.id"
              v-tooltip.top="'End the affiliation — your fields stop applying. Data they already recorded is theirs and stays.'"
              @click="set(r, 'revoked')">End</button>
          </div>
        </div>

        <div v-if="ended.length" class="card p-0 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-100">
            <h2 class="text-sm font-semibold text-gray-800">Ended &amp; declined</h2>
          </div>
          <div v-for="r in ended" :key="r.id" class="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm text-gray-500 truncate">{{ r.clubName }}</div>
              <div class="field-help">{{ r.sport }} · {{ fmt(r.decided_at) }}</div>
            </div>
            <button class="text-xs text-primary hover:underline shrink-0" :disabled="busy === r.id" @click="approve(r)">Re-approve</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
