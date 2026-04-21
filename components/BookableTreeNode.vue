<template>
  <div>
    <div
      class="flex items-center gap-1 px-3 py-2 cursor-pointer group transition-colors"
      :class="selectedId === node.id
        ? 'bg-[#1E2157]/8 text-[#1E2157]'
        : 'hover:bg-gray-50 text-gray-700'"
      :style="{ paddingLeft: `${12 + depth * 16}px` }"
      @click="$emit('select', node)">

      <!-- Expand toggle -->
      <button v-if="node.children?.length"
        class="w-5 h-5 flex items-center justify-center shrink-0 rounded hover:bg-gray-200 transition-colors"
        :class="selectedId === node.id ? 'text-[#1E2157]' : 'text-gray-400'"
        @click.stop="expanded = !expanded">
        <i :class="`pi text-[10px] ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'}`" />
      </button>
      <div v-else class="w-5 shrink-0" />

      <!-- Name -->
      <span class="flex-1 text-sm truncate" :class="depth === 0 ? 'font-medium' : ''">
        {{ node.name || 'Untitled' }}
      </span>

      <!-- Status dot -->
      <span v-if="node.status && node.status !== 'ACTIVE'"
        class="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
        :class="node.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-400' : 'bg-yellow-100 text-yellow-600'">
        {{ node.status === 'ARCHIVED' ? 'Archived' : 'Draft' }}
      </span>

      <!-- Add child button -->
      <button
        class="w-5 h-5 flex items-center justify-center shrink-0 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200"
        :class="selectedId === node.id ? 'text-[#1E2157]' : 'text-gray-400'"
        v-tooltip.right="'Add sub-venue'"
        @click.stop="$emit('add-child', node.id)">
        <i class="pi pi-plus text-[10px]" />
      </button>
    </div>

    <!-- Children -->
    <template v-if="expanded && node.children?.length">
      <BookableTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selectedId="selectedId"
        :depth="depth + 1"
        @select="$emit('select', $event)"
        @add-child="$emit('add-child', $event)" />
    </template>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  node: any
  selectedId?: string | null
  depth?: number
}>(), {
  depth: 0,
})

defineEmits<{
  select: [node: any]
  'add-child': [parentId: string]
}>()

const expanded = ref(true)
</script>
