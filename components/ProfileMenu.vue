<!--
  Person-facing profile menu in the icon rail (bottom avatar). Shows the signed-in
  person, their active club + account credit, a switcher across every club they
  belong to (org_members), and profile/account actions. Switching a club persists
  the choice (persistActiveOrg) — honoured by middleware/org.global.ts +
  plugins/auth.client.ts on reload. Super-admins switch orgs via <OrgSwitcher> in
  the top bar, so here they just see their active org.
-->
<script setup lang="ts">
const db = useDb()
const supa = useSupabaseClient()
const user = useSupabaseUser()
const { orgId } = useOrg()

const open = ref(false)
const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')

const displayName = computed(() => {
  const m: any = (user.value as any)?.user_metadata || {}
  return m.full_name || m.name || user.value?.email?.split('@')[0] || 'Account'
})
const initials = computed(() => {
  const parts = displayName.value.trim().split(/\s+/)
  const i = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
  return i || (user.value?.email?.[0]?.toUpperCase() ?? '?')
})

interface Membership { org_id: string; name: string; logo_url: string | null }
const memberships = ref<Membership[]>([])
const activeClub = computed(() => memberships.value.find(m => m.org_id === orgId.value) || null)
const myPersonId = ref<string | null>(null)

async function loadMemberships() {
  if (!user.value?.id) { memberships.value = []; return }
  if (isSuper.value) {
    if (orgId.value) {
      const { data } = await (db.from as any)('organisations').select('id, name, logo_url').eq('id', orgId.value).maybeSingle()
      memberships.value = data ? [{ org_id: data.id, name: data.name, logo_url: data.logo_url }] : []
    } else memberships.value = []
  } else {
    const { data } = await (db.from as any)('org_members')
      .select('org_id, organisations(id, name, logo_url)').eq('user_id', user.value.id)
    memberships.value = (data ?? [])
      .map((r: any) => ({ org_id: r.org_id, name: r.organisations?.name ?? '—', logo_url: r.organisations?.logo_url ?? null }))
      .sort((a: Membership, b: Membership) => a.name.localeCompare(b.name))
  }
  // Resolve this user's person record in the active org for the "My profile" link.
  const email = user.value?.email
  myPersonId.value = null
  if (email && orgId.value) {
    const { data: p } = await (db.from as any)('persons')
      .select('id').eq('org_id', orgId.value).ilike('email', email).limit(1).maybeSingle()
    myPersonId.value = p?.id ?? null
  }
}

function switchOrg(id: string) {
  open.value = false
  if (!id || id === orgId.value) return
  persistActiveOrg(id)
  window.location.href = '/events' // reload into the new org scope from a safe landing
}

async function signOut() {
  await supa.auth.signOut()
  navigateTo('/login')
}

watch([user, orgId], loadMemberships, { immediate: true })
</script>

<template>
  <div class="relative mt-2" @mouseenter="open = true" @mouseleave="open = false">
    <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors" :title="displayName">
      <span class="text-white text-xs font-semibold">{{ initials }}</span>
    </div>

    <div v-show="open" class="absolute left-full bottom-0 z-[70]" style="padding-left:10px">
      <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="width:250px">
        <!-- Identity header -->
        <div class="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
          <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold shrink-0">{{ initials }}</div>
          <div class="min-w-0">
            <p class="font-semibold text-gray-900 text-sm truncate">{{ displayName }}</p>
            <p class="text-xs text-gray-400 truncate">{{ activeClub?.name || user?.email }}</p>
            <p class="text-xs text-emerald-600 font-medium">$0.00 account credit</p>
          </div>
        </div>

        <!-- Club switcher -->
        <div v-if="memberships.length" class="py-1 border-b border-gray-100 max-h-56 overflow-auto">
          <p class="px-4 pt-1.5 pb-1 text-[10px] uppercase tracking-wide text-gray-400">Your clubs</p>
          <button v-for="m in memberships" :key="m.org_id" type="button"
            class="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-gray-50 text-left"
            :class="m.org_id === orgId ? 'bg-gray-50' : ''"
            @click="switchOrg(m.org_id)">
            <span class="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-semibold overflow-hidden shrink-0">
              <img v-if="m.logo_url" :src="m.logo_url" class="w-full h-full object-cover" />
              <template v-else>{{ m.name.slice(0, 2).toUpperCase() }}</template>
            </span>
            <span class="flex-1 min-w-0 truncate text-gray-800">{{ m.name }}</span>
            <i v-if="m.org_id === orgId" class="pi pi-check text-primary text-xs shrink-0" />
          </button>
        </div>

        <!-- Actions -->
        <div class="py-1">
          <NuxtLink to="/account/profiles" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="open = false"><i class="pi pi-users text-gray-400 text-xs" />Manage profiles</NuxtLink>
          <NuxtLink :to="myPersonId ? `/people/${myPersonId}` : '/account'" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="open = false"><i class="pi pi-user text-gray-400 text-xs" />My profile</NuxtLink>
          <NuxtLink to="/account" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="open = false"><i class="pi pi-credit-card text-gray-400 text-xs" />Account</NuxtLink>
          <button type="button" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left" @click="signOut"><i class="pi pi-sign-out text-xs" />Sign out</button>
        </div>
      </div>
    </div>
  </div>
</template>
