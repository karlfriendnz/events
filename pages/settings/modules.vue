<!--
  Settings → Club setup. Configure the club how you want — turn the different
  parts (modules) of the system on or off. Hidden modules disappear from the
  nav (icon rail, mobile tab bar + More sheet). Core modules (Dashboard,
  People) are always on. Persists to organisations.enabled_modules (migration
  226) via useOrgModules(); autosaves on every toggle.
-->
<script setup lang="ts">
const { orgId } = useOrg()
const user = useSupabaseUser()
const toast = useToast()
const { can, unrestricted } = useCan()
const isAdmin = computed(() => ((user.value as any)?.app_metadata?.role === 'super_admin') || unrestricted.value || can('settings', 'update'))

const mods = useOrgModules()
const loading = ref(true)

const toggleable = mods.MODULE_DEFS.filter(d => !d.core)
const coreMods = mods.MODULE_DEFS.filter(d => d.core)

const enabledCount = computed(() => toggleable.filter(d => mods.isEnabled(d.key)).length)

async function onToggle(key: string, on: boolean) {
  // Materialise the current effective set, then apply the change.
  const current = new Set(toggleable.filter(d => mods.isEnabled(d.key)).map(d => d.key))
  if (on) current.add(key); else current.delete(key)
  await mods.saveModules([...current])
  const def = toggleable.find(d => d.key === key)
  toast.add({ severity: 'success', summary: on ? `${def?.label} turned on` : `${def?.label} turned off`, life: 1800 })
}

async function resetAll() {
  await mods.saveModules(null)
  toast.add({ severity: 'success', summary: 'All modules turned on', life: 1800 })
}

useBreadcrumbs([{ label: 'Settings', to: '/settings' }, { label: 'Club setup' }])

watch(orgId, async () => {
  if (!orgId.value) return
  loading.value = true
  await mods.loadModules(true)
  loading.value = false
}, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6">
      <SettingsNav />
      <div class="flex-1 min-w-0">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">Club setup</h1>
            <p class="text-sm text-gray-500">Configure your club how you want — turn on the parts of the system you use. Anything turned off is hidden from the menu for everyone.</p>
          </div>
          <button v-if="isAdmin && enabledCount < toggleable.length" type="button"
            class="shrink-0 text-xs text-gray-400 hover:text-gray-700 whitespace-nowrap mt-1" @click="resetAll">Turn everything on</button>
        </div>

        <div v-if="!isAdmin" class="card p-8 text-center text-gray-400 text-sm">You don't have permission to configure the club's modules.</div>

        <template v-else>
          <div v-if="loading" class="card p-5 text-sm text-gray-400 max-w-2xl">Loading…</div>

          <template v-else>
            <!-- Toggleable modules -->
            <div class="card p-0 overflow-hidden max-w-2xl">
              <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-800">Modules</span>
                <span class="text-xs text-gray-400">{{ enabledCount }} of {{ toggleable.length }} on</span>
              </div>
              <div v-for="d in toggleable" :key="d.key"
                class="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0"
                :class="mods.isEnabled(d.key) ? '' : 'opacity-60'">
                <span class="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
                  :class="mods.isEnabled(d.key) ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'">
                  <i :class="['pi', d.icon, 'text-sm']" />
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800">{{ d.label }}</div>
                  <div class="text-xs text-gray-500">{{ d.description }}</div>
                </div>
                <ToggleSwitch :modelValue="mods.isEnabled(d.key)" @update:modelValue="v => onToggle(d.key, v)" />
              </div>
            </div>

            <!-- Always-on core -->
            <div class="card p-0 overflow-hidden max-w-2xl mt-4">
              <div class="px-5 py-3 border-b border-gray-100">
                <span class="text-sm font-semibold text-gray-800">Always on</span>
                <span class="text-xs text-gray-400 ml-2">Every club has these.</span>
              </div>
              <div v-for="d in coreMods" :key="d.key" class="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0">
                <span class="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                  <i :class="['pi', d.icon, 'text-sm']" />
                </span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800">{{ d.label }}</div>
                  <div class="text-xs text-gray-500">{{ d.description }}</div>
                </div>
                <i class="pi pi-lock text-gray-300 text-sm" v-tooltip.left="'Always on'" />
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
