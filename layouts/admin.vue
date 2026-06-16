<!--
  Full-screen super-admin platform console. Distinct chrome from the club app
  (no club sidebar) so the cross-org "All Organisations" area feels like a
  separate platform. Used by /admin/* pages via definePageMeta({ layout: 'admin' }).
-->
<script setup lang="ts">
const user = useSupabaseUser()
const db = useSupabaseClient()
const email = computed(() => user.value?.email ?? '')

async function logout() {
  await db.auth.signOut()
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <header class="h-14 shrink-0 bg-[#1E2157] text-white flex items-center px-6 gap-5 z-10">
      <div class="flex items-center gap-2 font-semibold whitespace-nowrap">
        <i class="pi pi-sitemap" />
        FriendlyManager
        <span class="opacity-60 font-normal hidden sm:inline">· Platform Admin</span>
      </div>
      <nav class="flex items-center gap-1 text-sm">
        <NuxtLink to="/admin"
          class="px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors"
          active-class="bg-white/15">Organisations</NuxtLink>
        <!-- Extend: Plans · Platform Users · Billing · Audit … -->
      </nav>
      <div class="flex-1" />
      <span class="text-xs opacity-80 hidden md:inline">{{ email }}</span>
      <button type="button"
        class="text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
        @click="logout">
        <i class="pi pi-sign-out mr-1" />Sign out
      </button>
    </header>

    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>
