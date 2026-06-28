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
  { to: '/admin/master', label: 'Master', icon: 'pi-database' },
  { to: '/admin/permissions', label: 'Permission Templates', icon: 'pi-lock' },
]

async function logout() {
  await db.auth.signOut()
  navigateTo('/login')
}

// Mobile drawer for the side nav.
const navOpen = ref(false)
watch(() => route.path, () => { navOpen.value = false })
</script>

<template>
  <div class="min-h-screen flex bg-gray-50">
    <!-- Mobile drawer backdrop -->
    <div v-if="navOpen" class="fixed inset-0 bg-black/30 z-40 md:hidden" @click="navOpen = false" />
    <!-- Light-blue left nav (drawer on mobile) -->
    <aside class="w-60 shrink-0 bg-[#DCEBFB] border-r border-[#BBD4F0] flex flex-col fixed inset-y-0 left-0 z-50 transform transition-transform md:static md:z-auto md:translate-x-0"
      :class="navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'">
      <div class="px-5 py-4 flex items-center gap-2 text-primary font-semibold border-b border-white/60">
        <i class="pi pi-sitemap" /> FriendlyManager
        <button class="md:hidden ml-auto text-primary/60 hover:text-primary" @click="navOpen = false"><i class="pi pi-times" /></button>
      </div>
      <p class="px-5 pt-3 pb-1 text-[10px] uppercase tracking-wider text-primary/50">Platform Admin</p>
      <nav class="flex-1 px-2 space-y-0.5">
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="route.path === item.to
            ? 'bg-white shadow-sm font-medium text-primary'
            : 'text-primary/80 hover:bg-white/70'">
          <i :class="['pi', item.icon, 'text-sm']" />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="p-3 border-t border-white/60 text-xs text-primary/80">
        <div class="truncate mb-1 font-medium">{{ email }}</div>
        <button type="button" class="hover:underline" @click="logout">
          <i class="pi pi-sign-out mr-1" />Sign out
        </button>
      </div>
    </aside>

    <div class="flex-1 min-w-0 flex flex-col">
      <!-- Mobile top bar with hamburger -->
      <div class="md:hidden h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
        <button type="button" class="text-gray-600 hover:text-gray-900" @click="navOpen = true"><i class="pi pi-bars text-lg" /></button>
        <span class="font-semibold text-primary">Platform Admin</span>
      </div>
      <main class="flex-1 overflow-y-auto min-w-0">
        <slot />
      </main>
    </div>
  </div>
</template>
