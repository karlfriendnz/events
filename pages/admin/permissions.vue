<!--
  Core permission templates (super-admin). These is_core=true / org_id=null groups
  are inherited by every club; clubs can override and reset them (see
  /settings/permissions).
-->
<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const db = useDb()
const user = useSupabaseUser()
const toast = useToast()
const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')

interface Core { id: string; name: string; description: string | null; permissions: PermissionMap; sort_order: number; _new?: boolean }
const groups = ref<Core[]>([])
const selectedId = ref<string | null>(null)
const selected = computed(() => groups.value.find(g => g.id === selectedId.value) || null)
const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  const { data } = await (db.from as any)('permission_groups').select('*').eq('is_core', true).order('sort_order').order('name')
  groups.value = (data ?? []).map((g: any) => ({ ...g, permissions: g.permissions ?? {} }))
  if (!selectedId.value && groups.value.length) selectedId.value = groups.value[0].id
  loading.value = false
}
function newGroup() {
  const g: Core = { id: 'tmp-' + Math.random().toString(36).slice(2), name: 'New template', description: '', permissions: {}, sort_order: groups.value.length, _new: true }
  groups.value.push(g); selectedId.value = g.id
}
async function save() {
  const g = selected.value; if (!g || !g.name.trim()) return
  saving.value = true
  if (g._new) {
    const { data, error } = await (db.from as any)('permission_groups').insert({
      org_id: null, is_core: true, name: g.name, description: g.description, permissions: g.permissions, sort_order: g.sort_order,
    }).select('id').single()
    if (error) { toast.add({ severity: 'error', summary: 'Save failed', detail: error.message, life: 4000 }); saving.value = false; return }
    g.id = data.id; g._new = false; selectedId.value = data.id
  } else {
    await (db.from as any)('permission_groups').update({ name: g.name, description: g.description, permissions: g.permissions, updated_at: new Date().toISOString() }).eq('id', g.id)
  }
  toast.add({ severity: 'success', summary: 'Template saved', life: 2000 }); saving.value = false
}
async function removeGroup() {
  const g = selected.value; if (!g) return
  if (!g._new) await (db.from as any)('permission_groups').delete().eq('id', g.id)
  groups.value = groups.value.filter(x => x.id !== g.id); selectedId.value = groups.value[0]?.id ?? null
}
onMounted(() => { if (!isSuper.value) { navigateTo('/'); return } load() })
</script>

<template>
  <div v-if="isSuper" class="p-6 md:p-8 max-w-6xl mx-auto">
    <div class="mb-4">
      <h1 class="text-xl font-semibold text-gray-900">Permission Templates</h1>
      <p class="text-sm text-gray-500">Core permission groups inherited by every club. Clubs can override or reset them.</p>
    </div>
    <div class="grid grid-cols-[220px_1fr] gap-5">
      <div class="card p-0 overflow-hidden h-fit">
        <div class="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Templates</span>
          <button class="text-xs text-[#1E2157] hover:underline" @click="newGroup">+ New</button>
        </div>
        <div v-if="loading" class="p-4 text-sm text-gray-400">Loading…</div>
        <div v-else-if="!groups.length" class="p-4 text-sm text-gray-400">No templates yet.</div>
        <button v-for="g in groups" :key="g.id" type="button"
          class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors"
          :class="g.id === selectedId ? 'bg-gray-50 font-medium text-[#1E2157]' : 'text-gray-700'"
          @click="selectedId = g.id">{{ g.name }}<span v-if="g._new" class="text-[10px] text-amber-500"> ·new</span></button>
      </div>
      <div v-if="selected" class="space-y-4">
        <div class="card p-5 grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Template name</label><InputText v-model="selected.name" /></div>
          <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Description</label><InputText v-model="selected.description" placeholder="What this role can do" /></div>
        </div>
        <PermissionGrid v-model="selected.permissions" />
        <div class="flex items-center justify-between">
          <button class="text-sm text-red-600 hover:underline" @click="removeGroup">Delete template</button>
          <Button label="Save" :loading="saving" style="background:#1E2157;border-color:#1E2157" @click="save" />
        </div>
      </div>
      <div v-else class="card p-8 text-center text-gray-400 text-sm">Select a template, or create one.</div>
    </div>
  </div>
</template>
