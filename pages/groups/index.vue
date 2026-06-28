<template>
  <div class="p-3 sm:p-6">
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Groups</h1>
        <p class="text-sm text-surface-500 mt-0.5">Member groups and audiences — up to {{ MAX_DEPTH }} levels deep.</p>
      </div>
      <Button label="New group" icon="pi pi-plus" size="small"
        style="background:#1E2157;border-color:#1E2157" @click="openCreate(null)" />
    </div>

    <!-- Location tabs (NHG venues) -->
    <div class="mb-4 border-b border-gray-200">
      <div class="flex gap-1 overflow-x-auto overflow-y-hidden no-scrollbar -mb-px">
        <button v-for="loc in LOCATIONS" :key="loc" type="button"
          class="px-3 sm:px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
          :class="activeLocation === loc
            ? 'border-primary text-primary'
            : 'border-transparent text-gray-500 hover:text-gray-700'"
          @click="activeLocation = loc">
          {{ loc }}
        </button>
      </div>
    </div>

    <AppCard title="Member Groups">
      <div v-if="loading" class="py-8 text-center text-sm text-surface-400">Loading…</div>
      <div v-else-if="!flatTree.length" class="py-8 text-center text-sm text-surface-400">
        No groups yet. <button class="text-primary hover:underline" @click="openCreate(null)">Create your first group →</button>
      </div>
      <ul v-else class="divide-y divide-gray-100">
        <li v-for="node in flatTree" :key="node.id">
          <div class="flex items-center gap-2 px-2 py-2.5 hover:bg-gray-50 transition-colors rounded"
            :style="{ paddingLeft: `${0.5 + (node.depth - 1) * 1.5}rem` }">
            <!-- expand toggle -->
            <button type="button" class="w-4 h-4 flex items-center justify-center shrink-0"
              @click="node.hasChildren && toggle(node.id)">
              <i v-if="node.hasChildren"
                :class="`pi text-[10px] text-gray-400 ${isExpanded(node.id) ? 'pi-chevron-down' : 'pi-chevron-right'}`" />
            </button>
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: node.color || '#94a3b8' }" />
            <NuxtLink :to="`/groups/${node.id}`" class="flex-1 text-sm font-semibold text-gray-800 truncate hover:text-primary">
              {{ node.name }}
            </NuxtLink>
            <span class="text-xs text-gray-400 tabular-nums">{{ node.member_count }}</span>
            <!-- add sub-group -->
            <button v-if="node.depth < MAX_DEPTH" type="button"
              class="text-gray-300 hover:text-primary transition-colors"
              :title="`Add a sub-group under ${node.name}`" @click="openCreate(node)">
              <i class="pi pi-plus text-xs" />
            </button>
            <span v-else class="w-4 shrink-0" />
            <NuxtLink :to="`/groups/${node.id}`" class="text-gray-300 hover:text-gray-500">
              <i class="pi pi-chevron-right text-[10px]" />
            </NuxtLink>
          </div>
        </li>
      </ul>
    </AppCard>

    <!-- New group dialog -->
    <Dialog v-model:visible="createOpen" modal :style="{ width: '95vw', maxWidth: '420px' }"
      :header="createParent ? `New sub-group under ${createParent.name}` : 'New group'">
      <div class="flex flex-col gap-4">
        <p v-if="createParent" class="text-xs text-gray-500">
          This will be level {{ (createParent.depth ?? 1) + 1 }} of {{ MAX_DEPTH }}.
        </p>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="newGroup.name" autofocus placeholder="e.g. Under 16s" @keyup.enter="handleCreate" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Colour</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="c in PALETTE" :key="c" type="button"
              class="w-7 h-7 rounded-full border-2 transition-transform"
              :class="newGroup.color === c ? 'border-gray-800 scale-110' : 'border-transparent'"
              :style="{ background: c }" @click="newGroup.color = c" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="createOpen = false" />
        <Button label="Create" :loading="creating" :disabled="!newGroup.name.trim()"
          style="background:#1E2157;border-color:#1E2157" @click="handleCreate" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

const MAX_DEPTH = 5
const LOCATIONS = ['All locations', 'HBC', 'Albany', 'Eventfinda Stadium']
const activeLocation = ref('All locations')
const PALETTE = ['#1E2157', '#2563EB', '#0f766e', '#059669', '#9333ea', '#EC4899', '#c2410c', '#be123c', '#8B5CF6', '#64748b']

interface Group {
  id: string
  name: string
  color: string | null
  parent_id: string | null
  sort_order: number | null
  member_count: number
}

const groups = ref<Group[]>([])
const loading = ref(true)
const expanded = reactive<Record<string, boolean>>({})

const createOpen = ref(false)
const creating = ref(false)
const createParent = ref<any>(null)
const newGroup = reactive({ name: '', color: PALETTE[0] })

function isExpanded(id: string) { return expanded[id] !== false }
function toggle(id: string) { expanded[id] = !(expanded[id] !== false) }

// children keyed by parent id ('__root' for top level), in sort order
const childrenByParent = computed(() => {
  const map: Record<string, Group[]> = {}
  const sorted = [...groups.value].sort((a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  for (const g of sorted) {
    const k = g.parent_id ?? '__root'
    ;(map[k] ??= []).push(g)
  }
  return map
})

// flattened, depth-aware list respecting collapse state
const flatTree = computed(() => {
  const out: (Group & { depth: number; hasChildren: boolean })[] = []
  const byParent = childrenByParent.value
  const walk = (parentId: string | null, depth: number) => {
    const kids = byParent[parentId ?? '__root'] ?? []
    for (const g of kids) {
      const hasChildren = (byParent[g.id]?.length ?? 0) > 0
      out.push({ ...g, depth, hasChildren })
      if (hasChildren && isExpanded(g.id)) walk(g.id, depth + 1)
    }
  }
  walk(null, 1)
  return out
})

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [{ data: rows }, { data: memberships }] = await Promise.all([
    (db.from as any)('member_groups')
      .select('id, name, color, parent_id, sort_order')
      .eq('org_id', orgId.value)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name'),
    (db.from as any)('member_group_memberships').select('group_id'),
  ])
  const counts: Record<string, number> = {}
  for (const m of memberships ?? []) counts[m.group_id] = (counts[m.group_id] ?? 0) + 1
  groups.value = (rows ?? []).map((g: any) => ({ ...g, member_count: counts[g.id] ?? 0 }))
  loading.value = false
}

function openCreate(parent: any | null) {
  createParent.value = parent
  newGroup.name = ''
  newGroup.color = PALETTE[0]
  createOpen.value = true
}

async function handleCreate() {
  if (!newGroup.name.trim()) return
  const parentId = createParent.value?.id ?? null
  const parentDepth = createParent.value?.depth ?? 0
  if (parentDepth >= MAX_DEPTH) {
    toast.add({ severity: 'warn', summary: `Groups can only go ${MAX_DEPTH} levels deep`, life: 3000 })
    return
  }
  creating.value = true
  const siblings = childrenByParent.value[parentId ?? '__root'] ?? []
  const nextOrder = siblings.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0) + 1
  const { error } = await (db.from as any)('member_groups').insert({
    org_id: orgId.value,
    name: newGroup.name.trim(),
    color: newGroup.color,
    parent_id: parentId,
    sort_order: nextOrder,
  })
  if (!error) {
    if (parentId) expanded[parentId] = true // reveal the new child
    toast.add({ severity: 'success', summary: 'Group created', life: 2500 })
    createOpen.value = false
    await load()
  } else {
    toast.add({ severity: 'error', summary: 'Could not create group', detail: error.message, life: 4000 })
  }
  creating.value = false
}

watch(orgId, load, { immediate: true })
</script>
