<!--
  Checkbox tree of the org's full class hierarchy — codes nest, classes are
  leaves. Ticking is independent (no up/down propagation): a CODE tick means
  "the whole programme, dynamically" (classes added later are included), a
  class tick means just that class. Selection keys are `code:{id}` / `group:{id}`.

  v-model:selectionKeys, self-loads codes + groups for the active org.
  Used by <FormConnectionsDialog> and the /forms/new wizard.
-->
<script setup lang="ts">
const props = defineProps<{ selectionKeys: Record<string, { checked?: boolean }> }>()
const emit = defineEmits<{ (e: 'update:selectionKeys', v: Record<string, { checked?: boolean }>): void }>()

const db = useDb()
const { orgId } = useOrg()
const gc = useGroupCodes()

const tree = ref<any[]>([])

onMounted(load)
watch(orgId, load)
async function load() {
  if (!orgId.value) return
  const [codes, { data: allGroups }] = await Promise.all([
    gc.loadCodes(),
    (db.from as any)('member_groups').select('id, name, code_id').eq('org_id', orgId.value).order('name'),
  ])
  const groupsByCode: Record<string, any[]> = {}
  for (const g of (allGroups ?? [])) (groupsByCode[g.code_id ?? '__none'] ??= []).push(g)
  const codesByParent: Record<string, any[]> = {}
  const sorted = [...(codes ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  for (const c of sorted) {
    const parentKey = (c.parent_id && sorted.some((x: any) => x.id === c.parent_id)) ? c.parent_id : '__root'
    ;(codesByParent[parentKey] ??= []).push(c)
  }
  const groupNode = (g: any) => ({ key: `group:${g.id}`, label: g.name, icon: 'pi pi-users', leaf: true })
  const codeNode = (c: any): any => ({
    key: `code:${c.id}`, label: c.name, icon: 'pi pi-folder',
    children: [
      ...(codesByParent[c.id] ?? []).map(codeNode),
      ...(groupsByCode[c.id] ?? []).map(groupNode),
    ],
  })
  const t: any[] = (codesByParent['__root'] ?? []).map(codeNode)
  if (groupsByCode['__none']?.length) {
    t.push({ key: '__ungrouped', label: 'Ungrouped', icon: 'pi pi-folder-open', selectable: false, children: groupsByCode['__none'].map(groupNode) })
  }
  tree.value = t
}
</script>

<template>
  <div class="border border-gray-200 rounded-lg max-h-80 overflow-y-auto bg-white">
    <Tree :value="tree" :selectionKeys="selectionKeys" selectionMode="checkbox"
      :propagateSelectionDown="false" :propagateSelectionUp="false"
      class="!p-1 !border-0 text-sm"
      @update:selectionKeys="v => emit('update:selectionKeys', v)" />
  </div>
</template>
