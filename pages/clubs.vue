<!--
  "Choose your club" — shown after login when the person's email is registered
  at more than one club (cross-club identity). Picking a club sets it active and
  drops them into the right experience for their type there. A single-club person
  is auto-landed and never sees this page (login routing skips it).
-->
<script setup lang="ts">
definePageMeta({ layout: false })
const { clubs, loadMyClubs } = useMyClubs()
const user = useSupabaseUser()
const supabase = useSupabaseClient()

const loading = ref(true)
onMounted(async () => { await loadMyClubs(true); loading.value = false })

function typeLabel(t: string | null) { return t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Member' }
function initials(name: string) { return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function pick(c: any) {
  persistActiveOrg(c.orgId)
  window.location.href = '/'  // login-landing logic routes to the right experience
}
async function signOut() { await supabase.auth.signOut(); navigateTo('/login') }
</script>

<template>
  <div class="min-h-screen bg-[#F5F8FA] flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-6">
        <h1 class="text-xl font-semibold text-gray-900">Choose your club</h1>
        <p class="text-sm text-gray-500 mt-1">You're a member of a few — pick one to continue.</p>
      </div>

      <div v-if="loading" class="card p-10 text-center text-gray-400"><i class="pi pi-spin pi-spinner text-2xl" /></div>

      <div v-else-if="!clubs.length" class="card p-8 text-center">
        <p class="text-sm text-gray-600">Your login isn't linked to any club yet.</p>
        <p class="text-xs text-gray-400 mt-1">Ask your club to send you an invite.</p>
        <button class="mt-4 text-sm text-primary hover:underline" @click="signOut">Sign out</button>
      </div>

      <div v-else class="space-y-2.5">
        <button v-for="c in clubs" :key="c.orgId" type="button"
          class="w-full card p-4 flex items-center gap-3 text-left hover:shadow-md hover:border-primary transition-all"
          @click="pick(c)">
          <span class="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center font-semibold shrink-0">{{ initials(c.orgName) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-gray-900 truncate">{{ c.orgName }}</span>
            <span class="block text-xs text-gray-500">{{ typeLabel(c.primaryType) }}</span>
          </span>
          <i class="pi pi-angle-right text-gray-300" />
        </button>
        <button class="w-full text-center text-xs text-gray-400 hover:text-gray-700 pt-2" @click="signOut">Sign out</button>
      </div>
    </div>
  </div>
</template>
