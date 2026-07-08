<!--
  Self-service PORTAL layout — for "people" (members who manage only themselves
  and their connections). Minimal chrome: club logo + their name + sign out. No
  management nav rail. Used by /me and the member /account pages.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const logoUrl = ref<string | null>(null)
const orgName = ref('')
const brandColor = ref<string>('#1E2157')
async function load() {
  if (!orgId.value) return
  const { data } = await (db.from as any)('organisations').select('name, logo_url, brand_color').eq('id', orgId.value).maybeSingle()
  orgName.value = data?.name ?? ''
  logoUrl.value = data?.logo_url ?? null
  brandColor.value = data?.brand_color || '#1E2157'
}
onMounted(load)
watch(orgId, load)

const menuOpen = ref(false)
async function signOut() { await supabase.auth.signOut(); navigateTo('/login') }
</script>

<template>
  <div class="min-h-screen bg-[#F5F8FA]">
    <header class="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <NuxtLink to="/me" class="flex items-center gap-2.5 min-w-0">
          <img v-if="logoUrl" :src="logoUrl" class="h-8 max-w-[140px] object-contain" />
          <span v-else class="font-semibold text-gray-900 truncate">{{ orgName }}</span>
        </NuxtLink>
        <div class="relative">
          <button class="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" @click="menuOpen = !menuOpen">
            <span class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" :style="{ background: brandColor }">
              {{ (user?.email ?? '?')[0]?.toUpperCase() }}
            </span>
            <i class="pi pi-angle-down text-xs" />
          </button>
          <template v-if="menuOpen">
            <div class="fixed inset-0 z-40" @click="menuOpen = false" />
            <div class="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              <NuxtLink to="/me" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="menuOpen = false"><i class="pi pi-home text-gray-400 text-xs" />My home</NuxtLink>
              <NuxtLink to="/account/profiles" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="menuOpen = false"><i class="pi pi-users text-gray-400 text-xs" />My people</NuxtLink>
              <div class="border-t border-gray-100 my-1" />
              <button type="button" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="signOut"><i class="pi pi-sign-out text-gray-400 text-xs" />Sign out</button>
            </div>
          </template>
        </div>
      </div>
    </header>
    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-5">
      <slot />
    </main>
  </div>
</template>
