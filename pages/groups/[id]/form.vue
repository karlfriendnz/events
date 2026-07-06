<!--
  Group registration-form designer — the SAME rich per-subject designer the
  events forms tab uses (<FormDesigner>), pointed at a member_group instead of
  an event. The designer lazily creates the registration_forms row and links
  member_groups.form_id the first time anything persists, so "design a form"
  and "create a form" are one flow (type chooser → Basic / presets / scratch).

  The public page is /r/group/:id (the group's shareable signup link).
-->
<script setup lang="ts">
const route = useRoute()
const db = useDb()
const { orgId } = useOrg()

const id = route.params.id as string
const group = ref<any>(null)

useBreadcrumbs([
  { label: 'Classes', to: '/groups' },
  { label: () => group.value?.name || 'Class', to: `/groups/${id}` },
  { label: 'Registration form' },
] as any)

onMounted(async () => {
  const { data } = await (db.from as any)('member_groups').select('id, name').eq('id', id).maybeSingle()
  group.value = data ?? null
})
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-3.5rem-4rem)] md:h-[calc(100vh-3.5rem)]">
    <div class="flex items-center justify-between gap-3 px-3 sm:px-6 pt-3 shrink-0">
      <NuxtLink :to="`/groups/${id}`" class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1.5">
        <i class="pi pi-arrow-left text-xs" /> Back to {{ group?.name || 'class' }}
      </NuxtLink>
      <a :href="`/r/group/${id}`" target="_blank"
        class="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1.5">
        Open public page <i class="pi pi-external-link text-[10px]" />
      </a>
    </div>
    <FormDesigner :event-id="null" :group-id="id" :org-id="orgId" class="flex flex-col flex-1 min-h-0" />
  </div>
</template>
