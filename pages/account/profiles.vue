<template>
  <div class="p-3 sm:p-6 max-w-3xl mx-auto">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-surface-900">My contacts &amp; circles</h1>
      <p class="text-sm text-surface-500 mt-0.5">The people linked to you — family you manage, and circles you're part of.</p>
    </div>

    <div v-if="loading" class="py-16 text-center text-gray-400"><i class="pi pi-spin pi-spinner text-xl" /></div>

    <div v-else-if="!myPersonId" class="card p-8 text-center text-surface-500">
      <i class="pi pi-user text-3xl mb-3 block text-surface-300" />
      <p>We couldn't match your login to a member record yet.</p>
      <p class="text-sm text-surface-400 mt-1">Ask your club admin to add your email to your profile.</p>
    </div>

    <template v-else>
      <!-- Profiles I manage (quick access) -->
      <AppCard v-if="managed.length" title="Profiles I manage" description="Family members whose profile you can edit." class="mb-4">
        <div class="divide-y divide-gray-100">
          <NuxtLink v-for="p in managed" :key="p.id" :to="`/people/${p.id}`"
            class="flex items-center gap-3 px-2 py-2.5 hover:bg-gray-50 rounded transition-colors">
            <span class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
              <img v-if="p.photo_url" :src="p.photo_url" class="w-full h-full object-cover" /><span v-else>{{ initials(p) }}</span>
            </span>
            <span class="flex-1 text-sm font-medium text-gray-800">{{ name(p) }}</span>
            <i class="pi pi-pencil text-xs text-gray-300" />
          </NuxtLink>
        </div>
      </AppCard>

      <!-- Manage my own families & circles -->
      <PersonCirclesEditor :person-id="myPersonId" />
    </template>
  </div>
</template>

<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const user = useSupabaseUser()
const { circlesForPerson, peopleIManage } = usePeopleLinks()

const loading = ref(true)
const myPersonId = ref<string | null>(null)
const managed = ref<any[]>([])

function name(p: any) { return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—' }
function initials(p: any) { return `${(p.first_name || '').charAt(0)}${(p.last_name || '').charAt(0)}`.toUpperCase() || '?' }

async function load() {
  loading.value = true
  const email = user.value?.email
  if (email && orgId.value) {
    const { data: me } = await (db.from as any)('persons').select('id').eq('org_id', orgId.value).ilike('email', email).maybeSingle()
    myPersonId.value = me?.id ?? null
  }
  if (myPersonId.value) {
    const circles = await circlesForPerson(myPersonId.value)
    const ids = peopleIManage(circles, myPersonId.value)
    if (ids.length) {
      const { data } = await (db.from as any)('persons').select('id, first_name, last_name, photo_url').in('id', ids)
      managed.value = data ?? []
    } else managed.value = []
  }
  loading.value = false
}

watch([orgId, user], load, { immediate: true })
</script>
