<!--
  Super-admin organisation switcher. Only renders for users whose Supabase
  app_metadata.role === 'super_admin'. Lists every organisation and lets the
  super-admin switch the active org; the choice is persisted to localStorage
  ('fm_active_org') and honoured by plugins/auth.client.ts + middleware/org.global.ts
  on the next load, so all org-scoped queries re-scope to the chosen org.

  Rendered inside the profile/avatar dropdown (a "Switch club" section) rather
  than as a standalone header control.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const user = useSupabaseUser()

const emit = defineEmits<{ (e: 'switched'): void }>()

const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')
const orgs = ref<{ id: string; name: string; org_level: string }[]>([])
const q = ref('')
const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return orgs.value
  return orgs.value.filter(o => (o.name || '').toLowerCase().includes(term))
})

onMounted(async () => {
  if (!isSuper.value) return
  const { data } = await (db.from as any)('organisations')
    .select('id, name, org_level')
    .order('name')
  orgs.value = data ?? []
})

function switchOrg(id: string) {
  if (!id || id === orgId.value) { emit('switched'); return }
  persistActiveOrg(id) // per-tab (sessionStorage) + last-used (localStorage)
  // Full reload so every page re-fetches under the new org scope.
  window.location.reload()
}
</script>

<template>
  <div v-if="isSuper && orgs.length" class="border-b border-gray-100 py-1.5">
    <div class="px-4 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Switch club</div>
    <div class="px-2">
      <input v-model="q" type="text" placeholder="Search clubs…"
        class="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-md mb-1 outline-none focus:border-gray-400" />
      <div class="max-h-52 overflow-y-auto">
        <button v-for="o in filtered" :key="o.id" type="button"
          class="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors"
          :class="o.id === orgId ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700 hover:bg-gray-50'"
          @click="switchOrg(o.id)">
          <span class="flex items-center gap-2 min-w-0">
            <i class="pi pi-check text-[10px] shrink-0" :class="o.id === orgId ? '' : 'invisible'" />
            <span class="truncate">{{ o.name }}</span>
          </span>
          <span class="text-[10px] text-gray-400 shrink-0">{{ orgLevelLabel(o.org_level) }}</span>
        </button>
        <p v-if="!filtered.length" class="text-xs text-gray-400 px-2 py-2">No clubs match.</p>
      </div>
    </div>
  </div>
</template>
