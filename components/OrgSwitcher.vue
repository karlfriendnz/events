<!--
  Super-admin organisation switcher. Only renders for users whose Supabase
  app_metadata.role === 'super_admin'. Lists every organisation and lets the
  super-admin switch the active org; the choice is persisted to localStorage
  ('fm_active_org') and honoured by plugins/auth.client.ts + middleware/org.global.ts
  on the next load, so all org-scoped queries re-scope to the chosen org.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const user = useSupabaseUser()

const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')
const orgs = ref<{ id: string; name: string; org_level: string }[]>([])

onMounted(async () => {
  if (!isSuper.value) return
  const { data } = await (db.from as any)('organisations')
    .select('id, name, org_level')
    .order('name')
  orgs.value = data ?? []
})

function switchOrg(id: string) {
  if (!id || id === orgId.value) return
  persistActiveOrg(id) // per-tab (sessionStorage) + last-used (localStorage)
  // Full reload so every page re-fetches under the new org scope.
  window.location.reload()
}
</script>

<template>
  <div v-if="isSuper && orgs.length" class="flex items-center gap-2"
    title="Super-admin — viewing as organisation">
    <NuxtLink to="/admin"
      class="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-medium text-[#1E2157] hover:bg-gray-100 transition-colors"
      title="All organisations (super-admin overview)">
      <i class="pi pi-sitemap text-sm" />
      All orgs
    </NuxtLink>
    <span class="text-gray-200">|</span>
    <i class="pi pi-building text-gray-400 text-sm" />
    <Select :modelValue="orgId" :options="orgs" option-label="name" option-value="id"
      filter class="w-56" @update:modelValue="switchOrg">
      <template #option="{ option }">
        <div class="flex items-center justify-between gap-2 w-full">
          <span class="truncate">{{ option.name }}</span>
          <span class="text-[10px] text-gray-400 shrink-0">{{ orgLevelLabel(option.org_level) }}</span>
        </div>
      </template>
    </Select>
  </div>
</template>
