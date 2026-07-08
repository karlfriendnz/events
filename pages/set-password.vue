<!--
  Set-password landing for a login invite / password reset. The Supabase client
  picks up the recovery/invite session from the URL hash, then the person chooses
  a password. On success they're signed in and sent home (the login-landing logic
  routes them to the right club/experience).
-->
<script setup lang="ts">
definePageMeta({ layout: false })
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)
const ready = ref(false)

onMounted(async () => {
  // Give the Supabase client a moment to consume the token from the URL hash.
  await new Promise(r => setTimeout(r, 400))
  const { data } = await supabase.auth.getSession()
  ready.value = !!data.session || !!user.value
  if (!ready.value) error.value = 'This link has expired or is invalid. Ask your club to send a new invite.'
})

async function submit() {
  error.value = ''
  if (password.value.length < 8) { error.value = 'Use at least 8 characters.'; return }
  if (password.value !== confirm.value) { error.value = 'Passwords don\'t match.'; return }
  loading.value = true
  const { error: e } = await supabase.auth.updateUser({ password: password.value })
  loading.value = false
  if (e) { error.value = e.message; return }
  done.value = true
  setTimeout(() => navigateTo('/'), 1200)
}
</script>

<template>
  <div class="min-h-screen bg-[#F5F8FA] flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <h1 class="text-lg font-semibold text-gray-900">Set your password</h1>
      <p class="text-sm text-gray-500 mt-1">Choose a password to finish setting up your login.</p>

      <div v-if="done" class="mt-6 text-center">
        <i class="pi pi-check-circle text-3xl text-emerald-500" />
        <p class="text-sm text-gray-700 mt-2">All set — signing you in…</p>
      </div>

      <template v-else>
        <div v-if="error" class="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ error }}</div>

        <form v-if="ready" class="mt-5 space-y-3" @submit.prevent="submit">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700">New password</label>
            <Password v-model="password" :feedback="false" toggleMask inputClass="w-full" class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700">Confirm password</label>
            <Password v-model="confirm" :feedback="false" toggleMask inputClass="w-full" class="w-full" @keyup.enter="submit" />
          </div>
          <Button label="Set password & sign in" :loading="loading" class="w-full justify-center" style="background:#1E2157;border-color:#1E2157" @click="submit" />
        </form>

        <NuxtLink v-if="!ready && error" to="/login" class="mt-4 inline-block text-sm text-primary hover:underline">Back to sign in</NuxtLink>
      </template>
    </div>
  </div>
</template>
