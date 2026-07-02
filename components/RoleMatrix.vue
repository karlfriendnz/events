<!--
  RoleMatrix — a roles × capabilities editor grid. Each row = a role (editable
  name + a checkbox per capability + delete); a trailing "Add role" button.
  Presentational: the parent owns the roles array and applies the emitted changes.
-->
<script setup lang="ts">
import type { CodeCapability, CodeRoleDef } from '~/composables/useCodeRoles'

defineProps<{
  roles: CodeRoleDef[]
  caps: CodeCapability[]
  empty?: string
  runs?: (r: CodeRoleDef) => boolean
}>()
const emit = defineEmits<{
  (e: 'add'): void
  (e: 'remove', i: number): void
  (e: 'toggle', role: CodeRoleDef, capKey: string, value: boolean): void
}>()
</script>

<template>
  <div>
    <div v-if="!roles.length" class="text-sm text-gray-400 mb-3">{{ empty || 'No roles yet.' }}</div>
    <div v-else class="overflow-x-auto -mx-1">
      <table class="w-full text-sm border-separate border-spacing-0 min-w-[36rem]">
        <thead>
          <tr class="text-left text-xs font-semibold text-gray-600">
            <th class="py-2 pr-3 sticky left-0 bg-white z-10 w-44">Role</th>
            <th v-for="c in caps" :key="c.key" class="py-2 px-2 text-center align-bottom">
              <span v-tooltip.top="c.description">{{ c.label }}</span>
            </th>
            <th class="py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in roles" :key="i" class="border-t border-gray-100">
            <td class="py-1.5 pr-3 sticky left-0 bg-white z-10 border-t border-gray-100">
              <div class="flex items-center gap-1.5">
                <InputText v-model="r.label" placeholder="Role name" class="w-36" />
                <span v-if="runs && runs(r)" class="text-[9px] font-bold uppercase tracking-wide text-emerald-600" title="Can manage">manages</span>
              </div>
            </td>
            <td v-for="c in caps" :key="c.key" class="py-1.5 px-2 text-center border-t border-gray-100">
              <Checkbox :modelValue="r.capabilities.includes(c.key)" binary
                @update:modelValue="v => emit('toggle', r, c.key, !!v)" />
            </td>
            <td class="py-1.5 text-right border-t border-gray-100">
              <button type="button" class="text-gray-300 hover:text-red-500" title="Remove role" @click="emit('remove', i)">
                <i class="pi pi-times-circle text-base" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="mt-3 text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1" @click="emit('add')">
      <i class="pi pi-plus text-[10px]" /> Add role
    </button>
  </div>
</template>
