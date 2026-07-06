<!--
  Settings → Xero. Connect the club's own Xero organisation, then a stepped
  "Finish your Xero setup" flow (design ported from PupManager's
  xero-mapping-panel): numbered steps with PROGRESSIVE REVEAL — each step stays
  hidden until the previous one is done, so the admin only ever sees the next
  thing to do. Steps: 1 bank account → 2 tax rate → 3 "Accounts you use"
  (named income-account shortlist; the one marked Default IS the fallback
  income account → sales_account_code). Save appears only when complete.

  Server side: /api/xero/connect|callback|disconnect|accounts (server/utils/xero.ts).
  Row: xero_connections (migration 228). Tokens never rendered client-side —
  this page selects only status/mapping columns.
-->
<script setup lang="ts">
const db = useDb()
const route = useRoute()
const { orgId } = useOrg()
const user = useSupabaseUser()
const toast = useToast()
const { can, unrestricted } = useCan()
const isAdmin = computed(() => ((user.value as any)?.app_metadata?.role === 'super_admin') || unrestricted.value || can('settings', 'update'))

// Deep links into the club's own Xero org (Xero routes to their tenant).
const XERO_BANK_ACCOUNTS = 'https://go.xero.com/app/manage-bank-accounts'
const XERO_CHART_OF_ACCOUNTS = 'https://go.xero.com/app/chart-of-accounts'

interface FeeAccount { label: string; code: string; default?: boolean; tracking?: Record<string, string> | null }
const loading = ref(true)
const conn = ref<any>(null)          // status/mapping columns only (never tokens)

// Setup-flow state
const bankAccount = ref<string | null>(null)
const taxType = ref<string | null>(null)
const feeAccounts = ref<FeeAccount[]>([])
const addCode = ref<string | null>(null)
const saving = ref(false)
const justSaved = ref(false)

// Live Xero pick-lists
const optionsLoading = ref(false)
const optionsError = ref('')
const revenueAccounts = ref<{ code: string; name: string }[]>([])
const bankAccounts = ref<{ code: string; name: string }[]>([])
const taxRates = ref<{ taxType: string; name: string }[]>([])
// Xero tracking categories (e.g. "Location" → HBC/Albany). When the org has
// them, each "Accounts you use" entry can attach one option per category —
// legacy FM concept: the tracking rides on the fee's account value.
const trackingCats = ref<{ name: string; options: string[] }[]>([])

const revenueOptions = computed(() => revenueAccounts.value.map(a => ({ label: `${a.code} · ${a.name}`, value: a.code })))
const bankOptions = computed(() => bankAccounts.value.map(a => ({ label: `${a.code} · ${a.name}`, value: a.code })))
const taxOptions = computed(() => taxRates.value.map(t => ({ label: t.name, value: t.taxType })))

// ── Validation (mirrors PupManager) ──
// Shortlist labels must be non-empty and unique — they're what people pick from
// on fee forms, so a duplicate is ambiguous. One entry must be the Default
// (it becomes the fallback income account).
const dupeLabels = computed(() => {
  const norm = feeAccounts.value.map(a => a.label.trim().toLowerCase())
  return new Set(norm.filter((n, i) => n && norm.indexOf(n) !== i))
})
function isDupe(label: string) { return dupeLabels.value.has(label.trim().toLowerCase()) }
const shortlistValid = computed(() =>
  feeAccounts.value.every(a => a.label.trim().length > 0) && dupeLabels.value.size === 0)
const hasDefault = computed(() => feeAccounts.value.some(a => a.default))
const setupComplete = computed(() => !!bankAccount.value && !!taxType.value && hasDefault.value)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const { data } = await (db.from as any)('xero_connections')
    .select('id, tenant_name, status, connected_at, sales_account_code, bank_account_code, bank_account_name, tax_type, fee_accounts')
    .eq('org_id', orgId.value).maybeSingle()
  conn.value = data ?? null
  if (data) {
    bankAccount.value = data.bank_account_code
    taxType.value = data.tax_type
    const list: FeeAccount[] = Array.isArray(data.fee_accounts) ? data.fee_accounts : []
    // Older rows may lack the default flag — infer it from the saved sales account.
    const flagged = list.some(a => a.default)
    feeAccounts.value = flagged ? list : list.map(a => ({ ...a, default: a.code === data.sales_account_code }))
    loadOptions()
  }
  loading.value = false
}

async function loadOptions() {
  optionsLoading.value = true
  optionsError.value = ''
  try {
    const res: any = await $fetch('/api/xero/accounts', { query: { org: orgId.value } })
    revenueAccounts.value = res.revenueAccounts ?? []
    bankAccounts.value = res.bankAccounts ?? []
    taxRates.value = res.taxRates ?? []
    trackingCats.value = res.tracking ?? []
  } catch (e: any) {
    optionsError.value = e?.data?.message || e?.message || 'Could not load your accounts from Xero'
  } finally {
    optionsLoading.value = false
  }
}

function connect() {
  window.location.href = `/api/xero/connect?org=${orgId.value}`
}

const disconnecting = ref(false)
async function disconnect() {
  if (!confirm('Disconnect from Xero? Your account mapping will be removed. You can reconnect to the same Xero organisation at any time.')) return
  disconnecting.value = true
  try {
    await $fetch('/api/xero/disconnect', { method: 'POST', body: { orgId: orgId.value } })
    conn.value = null
    toast.add({ severity: 'success', summary: 'Disconnected from Xero', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Disconnect failed', detail: e?.data?.message, life: 4000 })
  } finally {
    disconnecting.value = false
  }
}

async function saveSetup() {
  saving.value = true
  justSaved.value = false
  const bank = bankAccounts.value.find(b => b.code === bankAccount.value)
  const { error } = await (db.from as any)('xero_connections').update({
    bank_account_code: bankAccount.value,
    bank_account_name: bank?.name ?? null,
    tax_type: taxType.value,
    sales_account_code: feeAccounts.value.find(a => a.default)?.code ?? null,
    fee_accounts: feeAccounts.value,
    updated_at: new Date().toISOString(),
  }).eq('org_id', orgId.value)
  saving.value = false
  if (error) { toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 4000 }); return }
  justSaved.value = true
  setTimeout(() => { justSaved.value = false }, 2500)
}

function addFeeAccount() {
  const acc = revenueAccounts.value.find(a => a.code === addCode.value)
  if (!acc) return
  feeAccounts.value.push({ label: acc.name, code: acc.code, default: feeAccounts.value.length === 0, tracking: null })
  addCode.value = null
}
function setTracking(fa: FeeAccount, cat: string, option: string) {
  const t: Record<string, string> = { ...(fa.tracking ?? {}) }
  if (option) t[cat] = option; else delete t[cat]
  fa.tracking = Object.keys(t).length ? t : null
}
function removeFeeAccount(i: number) {
  const wasDefault = feeAccounts.value[i]?.default
  feeAccounts.value.splice(i, 1)
  if (wasDefault && feeAccounts.value.length) feeAccounts.value[0].default = true
}
function setDefault(i: number) {
  feeAccounts.value = feeAccounts.value.map((a, j) => ({ ...a, default: j === i }))
}

const ERROR_MESSAGES: Record<string, string> = {
  'tenant-mismatch': 'That login is for a different Xero organisation than the one previously connected. Disconnect fully first if you want to switch organisations.',
  'bad-state': 'The connection attempt expired or was tampered with. Please try again.',
  'no-code': 'Xero did not return an authorisation code. Please try again.',
  'no-tenant': 'No Xero organisation was authorised. Please try again and select an organisation.',
  'exchange-failed': 'Connecting to Xero failed. Please try again.',
  'access_denied': 'Access was declined in Xero.',
}

useBreadcrumbs([{ label: 'Settings', to: '/settings' }, { label: 'Xero' }])

onMounted(() => {
  if (route.query.connected) toast.add({ severity: 'success', summary: 'Connected to Xero', life: 3000 })
  const err = route.query.error as string | undefined
  if (err) toast.add({ severity: 'error', summary: 'Xero connection failed', detail: ERROR_MESSAGES[err] ?? err, life: 6000 })
  if (route.query.connected || route.query.error) navigateTo({ path: '/settings/xero' }, { replace: true })
})

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6">
      <SettingsNav />
      <div class="flex-1 min-w-0">
        <div class="mb-4">
          <h1 class="text-xl font-semibold text-gray-900">Xero</h1>
          <p class="text-sm text-gray-500">Sync invoices, payments and members straight into your club's own Xero organisation.</p>
        </div>

        <div v-if="!isAdmin" class="card p-8 text-center text-gray-400 text-sm">You don't have permission to manage the Xero connection.</div>
        <div v-else-if="loading" class="card p-5 text-sm text-gray-400 max-w-2xl">Loading…</div>

        <div v-else class="card p-5 max-w-2xl">
          <!-- ── Connection header ── -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-gray-900">Xero accounting</h2>
              <p class="text-xs text-gray-500 mt-0.5">Connect the Xero organisation that holds this club's accounts.</p>
            </div>
            <span class="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold" style="background:#13B5EA">X</span>
          </div>

          <!-- Not connected → the one thing to do -->
          <div v-if="!conn" class="mt-4">
            <Button label="Connect to Xero" icon="pi pi-external-link"
              style="background:#13B5EA;border-color:#13B5EA" @click="connect" />
            <p class="text-xs text-gray-400 mt-2">You'll be sent to Xero to sign in and approve access. The connection can be removed at any time.</p>
          </div>

          <!-- Connected chip + disconnect -->
          <div v-else class="mt-3 flex flex-wrap items-center gap-2.5">
            <span v-if="conn.status === 'online'" class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <i class="pi pi-check text-[10px]" /> Connected · {{ conn.tenant_name }}
            </span>
            <span v-else class="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
              <i class="pi pi-exclamation-triangle text-[10px]" /> Connection lost
            </span>
            <Button v-if="conn.status !== 'online'" label="Reconnect" size="small"
              style="background:#13B5EA;border-color:#13B5EA" @click="connect" />
            <button type="button" class="text-xs font-medium text-gray-400 hover:text-gray-700 hover:underline underline-offset-2"
              :disabled="disconnecting" @click="disconnect">{{ disconnecting ? 'Disconnecting…' : 'Disconnect' }}</button>
          </div>

          <!-- ── Finish your Xero setup — numbered steps, progressive reveal ── -->
          <div v-if="conn" class="mt-5 border-t border-gray-100 pt-5">
            <p class="text-sm font-semibold text-gray-800">Finish your Xero setup</p>
            <p class="text-xs text-gray-500 mt-0.5">A few one-time choices so your invoices and payments post to the right places.</p>

            <div v-if="optionsLoading" class="mt-4 flex items-center gap-2 text-sm text-gray-400">
              <i class="pi pi-spin pi-spinner" /> Loading your Xero accounts…
            </div>
            <div v-else-if="optionsError" class="mt-4 text-sm text-red-500">{{ optionsError }}</div>

            <div v-else class="mt-5 space-y-6">
              <!-- Step 1 · bank account -->
              <div class="flex gap-3">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">1</div>
                <div class="min-w-0 flex-1 space-y-2 pt-0.5">
                  <p class="text-sm font-semibold text-gray-800">Where member payments land <span class="text-rose-500">*</span></p>
                  <div v-if="!bankAccounts.length" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    You don't have a bank account in Xero yet. Add one in Xero, then reload this page.
                  </div>
                  <Select v-else v-model="bankAccount" :options="bankOptions" optionLabel="label" optionValue="value"
                    placeholder="Select a bank account…" class="w-full sm:max-w-md" />
                  <div>
                    <a :href="XERO_BANK_ACCOUNTS" target="_blank" rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-medium hover:underline" style="color:#13B5EA">
                      Add or manage bank accounts in Xero <i class="pi pi-external-link text-[10px]" />
                    </a>
                  </div>
                </div>
              </div>

              <!-- Step 2 · tax rate (revealed once bank picked) -->
              <div v-if="bankAccount" class="flex gap-3">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">2</div>
                <div class="min-w-0 flex-1 space-y-2 pt-0.5">
                  <p class="text-sm font-semibold text-gray-800">Your default tax rate <span class="text-rose-500">*</span></p>
                  <Select v-model="taxType" :options="taxOptions" optionLabel="label" optionValue="value"
                    placeholder="Select a tax rate…" class="w-full sm:max-w-md" />
                </div>
              </div>

              <!-- Step 3 · accounts you use (revealed once bank + tax picked) -->
              <div v-if="bankAccount && taxType" class="flex gap-3">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">3</div>
                <div class="min-w-0 flex-1 space-y-2 pt-0.5">
                  <p class="text-sm font-semibold text-gray-800">Accounts you use</p>
                  <p class="text-xs text-gray-400">Add the income accounts your fees post to and name each one however makes sense to your club. Mark one as the default — it's the fallback for anything without its own account.<template v-if="trackingCats.length"> Your Xero tracking categories show under each account — attach an option and every fee using that account is tracked with it.</template></p>

                  <div v-if="feeAccounts.length" class="flex flex-col gap-1.5">
                    <div v-for="(fa, i) in feeAccounts" :key="i"
                      class="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 space-y-1.5">
                      <div class="flex items-center gap-2">
                        <input v-model="fa.label" placeholder="Name this account"
                          class="min-w-0 flex-1 rounded-md border bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1"
                          :class="fa.label.trim() === '' || isDupe(fa.label)
                            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-400'
                            : 'border-gray-200 focus:border-primary focus:ring-primary'" />
                        <button type="button" title="Use this as the default (fallback) income account"
                          class="inline-flex items-center shrink-0 rounded-full px-2.5 h-6 text-[11px] font-semibold leading-none transition-colors"
                          :class="fa.default ? 'text-white' : 'text-gray-400'"
                          :style="fa.default ? 'background:#13B5EA' : ''" @click="setDefault(i)">
                          {{ fa.default ? 'Default' : 'Set default' }}
                        </button>
                        <span class="shrink-0 text-xs text-gray-400 font-mono" title="Xero account code">{{ fa.code }}</span>
                        <button type="button" class="shrink-0 text-xs font-medium text-gray-400 hover:text-rose-500" @click="removeFeeAccount(i)">Remove</button>
                      </div>
                      <!-- Tracking categories (only when the org has them in Xero) — one option per category, riding on this account entry -->
                      <div v-if="trackingCats.length" class="flex flex-wrap items-center gap-1.5 pl-0.5">
                        <i class="pi pi-tag text-[10px] text-gray-300" title="Xero tracking" />
                        <select v-for="cat in trackingCats" :key="cat.name"
                          :value="fa.tracking?.[cat.name] ?? ''"
                          class="h-6 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-600"
                          style="-webkit-appearance:auto;appearance:auto"
                          :title="`Tracking: ${cat.name}`"
                          @change="setTracking(fa, cat.name, ($event.target as HTMLSelectElement).value)">
                          <option value="">{{ cat.name }}: —</option>
                          <option v-for="opt in cat.options" :key="opt" :value="opt">{{ cat.name }}: {{ opt }}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <p v-if="!shortlistValid && feeAccounts.length" class="text-xs text-rose-500">Give every account a name, and make each name different from the others.</p>
                  <p v-else-if="feeAccounts.length && !hasDefault" class="text-xs text-amber-600">Mark one account as the default.</p>

                  <div class="flex items-center gap-2">
                    <Select v-model="addCode" :options="revenueOptions" optionLabel="label" optionValue="value"
                      placeholder="Add an account…" filter class="min-w-0 flex-1" />
                    <Button label="Add" size="small" severity="secondary" outlined :disabled="!addCode" @click="addFeeAccount" />
                  </div>
                  <div>
                    <a :href="XERO_CHART_OF_ACCOUNTS" target="_blank" rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-xs font-medium hover:underline" style="color:#13B5EA">
                      Manage your chart of accounts in Xero <i class="pi pi-external-link text-[10px]" />
                    </a>
                  </div>
                </div>
              </div>

              <!-- Save — appears only when the setup is complete -->
              <div v-if="setupComplete" class="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
                <Button label="Save setup" :loading="saving" :disabled="!shortlistValid"
                  style="background:#13B5EA;border-color:#13B5EA" @click="saveSetup" />
                <span v-if="justSaved" class="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                  <i class="pi pi-check" /> Saved
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- What happens next -->
        <div v-if="conn && !loading && isAdmin" class="card p-5 max-w-2xl mt-4 bg-gray-50/60">
          <div class="text-sm font-semibold text-gray-800 mb-1">What syncs</div>
          <p class="text-xs text-gray-500">Syncing of members (contacts), invoices and payments is coming next — this setup establishes the connection and account mapping it will use. Fee line items can already carry their own account code.</p>
        </div>
      </div>
    </div>
  </div>
</template>
