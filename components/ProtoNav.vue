<!--
  Prototype left menu (/proto/*). Demonstrates the "two screens, one engine" model
  with per-type VIEWS in the nav:
    • Set up      → People types / Teams & organisations (the config screens)
    • People      → one view per PERSON type  (→ /proto/people?type=KEY)
    • Organisations → one view per ENTITY type (→ /proto/organisations?type=KEY)
  Rendered inside each proto page (like SettingsNav), not the global rail.
-->
<script setup lang="ts">
const route = useRoute()
const { orgId } = useOrg()
const { loadOrgTypes } = useOrgFieldPolicy()

const personTypes = ref<any[]>([])
const entityTypes = ref<any[]>([])

async function load() {
  if (!orgId.value) return
  const types = await loadOrgTypes(orgId.value)
  personTypes.value = types.filter((t: any) => (t.kind ?? 'person') === 'person')
  entityTypes.value = types.filter((t: any) => t.kind === 'entity')
}
watch(orgId, load, { immediate: true })

function isActive(path: string, type?: string) {
  if (route.path !== path) return false
  if (type === undefined) return !route.query.type
  return route.query.type === type
}
</script>

<template>
  <nav class="md:w-52 md:shrink-0 space-y-4">
    <!-- Set up -->
    <div>
      <p class="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Set up</p>
      <NuxtLink to="/proto/core-fields"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="route.path === '/proto/core-fields' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'">
        <i class="pi pi-globe text-xs w-4 text-center" />Personal &amp; communication
      </NuxtLink>
      <NuxtLink to="/proto/people-types"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="route.path === '/proto/people-types' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'">
        <i class="pi pi-id-card text-xs w-4 text-center" />People types
      </NuxtLink>
      <NuxtLink to="/proto/entity-types"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="route.path === '/proto/entity-types' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'">
        <i class="pi pi-sitemap text-xs w-4 text-center" />Teams &amp; organisations
      </NuxtLink>
    </div>

    <!-- People views -->
    <div>
      <p class="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">People</p>
      <NuxtLink to="/proto/people"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
        :class="isActive('/proto/people') ? 'bg-gray-100 font-semibold text-primary' : 'text-gray-600 hover:bg-gray-100'">
        <i class="pi pi-users text-[11px] w-4 text-center text-gray-400" />All people
      </NuxtLink>
      <NuxtLink v-for="t in personTypes" :key="t.key" :to="{ path: '/proto/people', query: { type: t.key } }"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
        :class="isActive('/proto/people', t.key) ? 'bg-gray-100 font-semibold text-primary' : 'text-gray-500 hover:bg-gray-100'">
        <span class="w-4 text-center text-gray-300">•</span>{{ t.label }}
      </NuxtLink>
    </div>

    <!-- Organisation views -->
    <div>
      <p class="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Organisations</p>
      <NuxtLink to="/proto/organisations"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
        :class="isActive('/proto/organisations') ? 'bg-gray-100 font-semibold text-primary' : 'text-gray-600 hover:bg-gray-100'">
        <i class="pi pi-building text-[11px] w-4 text-center text-gray-400" />All organisations
      </NuxtLink>
      <NuxtLink v-for="t in entityTypes" :key="t.key" :to="{ path: '/proto/organisations', query: { type: t.key } }"
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
        :class="isActive('/proto/organisations', t.key) ? 'bg-gray-100 font-semibold text-primary' : 'text-gray-500 hover:bg-gray-100'">
        <span class="w-4 text-center text-gray-300">•</span>{{ t.label }}
      </NuxtLink>
      <p v-if="!entityTypes.length" class="px-3 py-1 text-[11px] text-gray-400 italic">No entity types yet — add one in Teams &amp; organisations.</p>
    </div>
  </nav>
</template>
