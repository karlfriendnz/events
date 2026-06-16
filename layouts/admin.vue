<!--
  Full-screen super-admin platform console with a light-blue left navigation.
  Distinct from the club app (no club chrome). Used by /admin/* pages via
  definePageMeta({ layout: 'admin' }).
-->
<script setup lang="ts">
const user = useSupabaseUser()
const db = useSupabaseClient()
const route = useRoute()
const email = computed(() => user.value?.email ?? '')

const navItems = [
  { to: '/admin', label: 'Organisations', icon: 'pi-building' },
  { to: '/admin/disciplines', label: 'Disciplines', icon: 'pi-tags' },
]

async function logout() {
  await db.auth.signOut()
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex bg-gray-50">
    <!-- Light-blue left nav -->
    <aside class="w-60 shrink-0 bg-[#DCEBFB] border-r border-[#BBD4F0] flex flex-col">
      <div class="px-5 py-4 flex items-center gap-2 text-[#1E2157] font-semibold border-b border-white/60">
        <i class="pi pi-sitemap" /> FriendlyManager
      </div>
      <p class="px-5 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[#1E2157]/50">Platform Admin</p>
      <nav class="flex-1 px-2 space-y-0.5">
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="route.path === item.to
            ? 'bg-white shadow-sm font-medium text-[#1E2157]'
            : 'text-[#1E2157]/80 hover:bg-white/70'">
          <i :class="['pi', item.icon, 'text-sm']" />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="p-3 border-t border-white/60 text-xs text-[#1E2157]/80">
        <div class="truncate mb-1 font-medium">{{ email }}</div>
        <button type="button" class="hover:underline" @click="logout">
          <i class="pi pi-sign-out mr-1" />Sign out
        </button>
      </div>
    </aside>

    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>
