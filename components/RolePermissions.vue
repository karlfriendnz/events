<!--
  RolePermissions — the reusable master-detail role editor (matching
  /settings/roles): a grouped left list + a right "This role can… / Allowed"
  capability matrix. Editable roles can be renamed / toggled / deleted; read-only
  roles (inherited, defaults) show the same matrix disabled + an optional note.

  Props:
    groups  [{ key, label, addable?, note? }]  — sections in the left list
    roles   [{ _uid, groupKey, label, capabilities[], editable, id? }]
    caps    [{ key, label, description }]
  Emits: add(groupKey), remove(role). Editable roles are mutated in place
  (label / capabilities), so the parent owns them by reference.
-->
<script setup lang="ts">
interface Group { key: string; label: string; addable?: boolean; note?: string }
interface RoleItem { _uid: number; groupKey: string; label: string; capabilities: string[]; editable?: boolean; id?: string }
interface Cap { key: string; label: string; description?: string }

const props = defineProps<{ groups: Group[]; roles: RoleItem[]; caps: Cap[] }>()
const emit = defineEmits<{ (e: 'add', groupKey: string): void; (e: 'remove', role: RoleItem): void }>()

const selectedUid = ref<number | null>(null)
const selected = computed(() => props.roles.find(r => r._uid === selectedUid.value) || null)
const selectedGroup = computed(() => selected.value ? props.groups.find(g => g.key === selected.value!.groupKey) : null)
const rolesIn = (key: string) => props.roles.filter(r => r.groupKey === key)
const manages = (r: RoleItem) => r.capabilities.includes('add_people') || r.capabilities.includes('create_groups')
function toggleCap(r: RoleItem, cap: string) {
  if (!r.editable) return
  const i = r.capabilities.indexOf(cap)
  if (i === -1) r.capabilities.push(cap); else r.capabilities.splice(i, 1)
}
// Keep a valid selection.
watch(() => props.roles.map(r => r._uid).join(','), () => {
  if (!props.roles.some(r => r._uid === selectedUid.value)) selectedUid.value = props.roles[0]?._uid ?? null
}, { immediate: true })
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
    <!-- list -->
    <div class="card p-0 overflow-hidden h-fit">
      <template v-for="g in groups" :key="g.key">
        <div class="px-4 py-2.5 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">{{ g.label }}</span>
          <button v-if="g.addable" class="text-xs text-primary hover:underline" @click="emit('add', g.key)">+ Add</button>
        </div>
        <button v-for="it in rolesIn(g.key)" :key="it._uid" type="button"
          class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
          :class="it._uid === selectedUid ? 'bg-gray-50 font-medium text-primary' : 'text-gray-700'"
          @click="selectedUid = it._uid">
          <span class="truncate">{{ it.label || 'Untitled' }}</span>
          <span v-if="manages(it)" class="text-[9px] uppercase tracking-wide shrink-0 text-amber-500">manages</span>
        </button>
        <div v-if="!rolesIn(g.key).length" class="px-4 py-2.5 text-xs text-gray-400 border-b border-gray-50">None</div>
      </template>
    </div>

    <!-- editor -->
    <div v-if="selected" class="space-y-4">
      <div v-if="selectedGroup?.note" class="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm text-blue-800 flex items-center gap-1.5">
        <i class="pi pi-lock text-xs" />{{ selectedGroup.note }}
      </div>

      <div class="card p-5">
        <div class="flex flex-col gap-1.5 sm:max-w-sm">
          <label class="text-sm font-medium">Role name</label>
          <InputText v-model="selected.label" :disabled="!selected.editable" placeholder="e.g. Manager" />
        </div>
      </div>

      <div class="card p-0 overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
              <th class="text-left px-4 py-2 font-medium">This role can…</th>
              <th class="px-3 py-2 font-medium text-center w-24">Allowed</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in caps" :key="c.key" class="border-b border-gray-50 hover:bg-gray-50/60">
              <td class="px-4 py-2.5 align-top">
                <button class="block text-left font-medium" :class="selected.editable ? 'text-gray-800 hover:text-primary' : 'text-gray-500 cursor-default'"
                  @click="toggleCap(selected, c.key)">{{ c.label }}</button>
                <p v-if="c.description" class="mt-0.5 text-[11px] leading-snug text-gray-400 max-w-[46ch]">{{ c.description }}</p>
              </td>
              <td class="px-3 py-2.5 text-center align-top">
                <input type="checkbox" class="w-4 h-4 accent-primary" :class="selected.editable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'"
                  :checked="selected.capabilities.includes(c.key)" :disabled="!selected.editable" @change="toggleCap(selected, c.key)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selected.editable" class="flex">
        <button class="text-sm text-red-600 hover:underline" @click="emit('remove', selected)">Delete role</button>
      </div>
    </div>
    <div v-else class="card p-8 text-center text-gray-400 text-sm">Select a role.</div>
  </div>
</template>
