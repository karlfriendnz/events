<!--
  Settings → Integrations. The hub for third-party connections. Each card links
  to that integration's own settings page (Xero has its full flow at
  /settings/xero). Future connections (Zoho, calendar syncs, comms providers)
  slot in as more cards — status is read live where the connection exists.
-->
<script setup lang="ts">
const { orgId } = useOrg()
const { xeroConnection } = useFinancesApi()

const loading = ref(true)
const xeroStatus = ref<'connected' | 'offline' | null>(null)
const xeroTenant = ref<string | null>(null)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const data = await xeroConnection(orgId.value)
  if (data) { xeroStatus.value = data.status === 'offline' ? 'offline' : 'connected'; xeroTenant.value = data.tenantName ?? null }
  else { xeroStatus.value = null; xeroTenant.value = null }
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })

// Each integration is a card. `status` computed inline where we track it.
const integrations = computed(() => [
  {
    key: 'xero',
    name: 'Xero',
    desc: 'Sync fees, invoices and payments to your Xero accounting organisation.',
    color: '#13B5EA',
    icon: 'pi-calculator',
    to: '/settings/xero',
    status: xeroStatus.value,
    statusText: xeroStatus.value === 'connected' ? (xeroTenant.value ? `Connected · ${xeroTenant.value}` : 'Connected')
      : xeroStatus.value === 'offline' ? 'Connection lost — reconnect' : 'Not connected',
    cta: xeroStatus.value ? 'Manage →' : 'Connect →',
  },
  {
    key: 'zoho_desk',
    name: 'Zoho Desk',
    desc: 'Raise and track support tickets from members without leaving the platform.',
    color: '#E42527',
    icon: 'pi-ticket',
    to: null,
    status: 'soon' as const,
    statusText: 'Coming soon',
    cta: null,
  },
  {
    key: 'zoho_crm',
    name: 'Zoho CRM',
    desc: 'Push contacts and membership activity into your Zoho CRM pipelines.',
    color: '#F0483E',
    icon: 'pi-users',
    to: null,
    status: 'soon' as const,
    statusText: 'Coming soon',
    cta: null,
  },
])
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <SettingsNav />
      <div class="flex-1 min-w-0 space-y-5">
        <div>
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Integrations</h1>
          <p class="text-sm text-gray-500">Connect your club to the tools you already use.</p>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl">
          <NuxtLink v-for="i in integrations" :key="i.key" :to="i.to || '#'"
            class="card p-5 flex flex-col gap-3"
            :class="i.to ? 'hover:shadow-md transition-shadow' : 'opacity-90 pointer-events-none'">
            <div class="flex items-start gap-3">
              <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" :style="{ background: i.color }">
                <i :class="['pi', i.icon, 'text-lg']" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-gray-900">{{ i.name }}</h3>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    :class="i.status === 'connected' ? 'bg-emerald-50 text-emerald-700'
                      : i.status === 'offline' ? 'bg-amber-50 text-amber-700'
                      : i.status === 'soon' ? 'bg-gray-100 text-gray-500'
                      : 'bg-gray-100 text-gray-500'">
                    {{ i.status === 'connected' ? 'Connected' : i.status === 'offline' ? 'Reconnect' : i.status === 'soon' ? 'Soon' : 'Off' }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1 leading-snug">{{ i.desc }}</p>
              </div>
            </div>
            <div class="mt-auto flex items-center justify-between">
              <span class="text-xs text-gray-400">{{ i.statusText }}</span>
              <span v-if="i.cta" class="text-sm font-medium text-primary">{{ i.cta }}</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
