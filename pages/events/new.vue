<template>
  <div class="flex items-center justify-center h-full">
    <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
const db = useDb()
const route = useRoute()

const { data } = await db.from('events').insert({
  org_id: orgId.value,
  title: (route.query.name as string) ?? '',
  style: 'ADVANCED',
  status: 'DRAFT',
}).select('id').single()

if (data?.id) {
  const params = new URLSearchParams()
  if (route.query.date) params.set('date', route.query.date as string)
  if (route.query.endDate) params.set('endDate', route.query.endDate as string)
  if (route.query.prefill) params.set('prefill', '1')
  const q = params.size ? `?${params}` : ''
  await navigateTo(`/events/${data.id}${q}`, { replace: true })
}
</script>
