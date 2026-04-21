<template>
  <div class="min-h-screen flex items-center justify-center" style="background: linear-gradient(135deg, #1E2157 0%, #21278E 100%)">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
      <!-- Logo -->
      <div class="flex items-center justify-center mb-6">
        <div class="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center">
          <i class="pi pi-calendar text-white text-xl" />
        </div>
      </div>
      <h1 class="text-xl font-semibold text-gray-900 text-center mb-1">FriendlyManager</h1>
      <p class="text-sm text-gray-500 text-center mb-6">{{ mode === 'login' ? 'Sign in to your account' : 'Create your account' }}</p>

      <!-- Mode toggle -->
      <div class="flex rounded-lg bg-gray-100 p-1 mb-6">
        <button
          type="button"
          class="flex-1 text-sm font-medium py-1.5 rounded-md transition-all"
          :class="mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          @click="switchMode('login')"
        >Sign in</button>
        <button
          type="button"
          class="flex-1 text-sm font-medium py-1.5 rounded-md transition-all"
          :class="mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
          @click="switchMode('register')"
        >Register</button>
      </div>

      <!-- Sign in form -->
      <form v-if="mode === 'login'" @submit.prevent="handleLogin" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Email</label>
          <InputText v-model="email" type="email" placeholder="you@example.com" :disabled="loading" class="w-full" autocomplete="email" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Password</label>
          <Password v-model="password" placeholder="••••••••" :feedback="false" toggle-mask :disabled="loading" input-class="w-full" class="w-full" autocomplete="current-password" />
        </div>
        <Message v-if="error" severity="error" :closable="false" class="mt-1">{{ error }}</Message>
        <Button type="submit" label="Sign in" :loading="loading" class="w-full mt-1" />
      </form>

      <!-- Register form -->
      <form v-else @submit.prevent="handleRegister" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Full name</label>
          <InputText v-model="name" placeholder="Jane Smith" :disabled="loading" class="w-full" autocomplete="name" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Email</label>
          <InputText v-model="email" type="email" placeholder="you@example.com" :disabled="loading" class="w-full" autocomplete="email" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Password</label>
          <Password v-model="password" placeholder="Min. 6 characters" toggle-mask :disabled="loading" input-class="w-full" class="w-full" autocomplete="new-password" />
        </div>
        <Message v-if="error" severity="error" :closable="false" class="mt-1">{{ error }}</Message>
        <Message v-if="success" severity="success" :closable="false" class="mt-1">{{ success }}</Message>
        <Button type="submit" label="Create account" :loading="loading" class="w-full mt-1" />
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const db = useSupabaseClient()
const mode = ref<'login' | 'register'>('login')
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

function switchMode(m: 'login' | 'register') {
  mode.value = m
  error.value = ''
  success.value = ''
}

const { orgId, orgReady } = useOrg()

async function prefetchOrg(userId: string) {
  const { data } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
  orgId.value = data?.org_id ?? null
  orgReady.value = true
}

async function handleLogin() {
  error.value = ''
  if (!email.value || !password.value) { error.value = 'Please enter your email and password.'; return }
  loading.value = true
  const { data, error: authError } = await db.auth.signInWithPassword({ email: email.value, password: password.value })
  if (authError) { error.value = authError.message; loading.value = false; return }
  if (data.user?.id) await prefetchOrg(data.user.id)
  await navigateTo('/events')
}

async function handleRegister() {
  error.value = ''
  success.value = ''
  if (!name.value || !email.value || !password.value) { error.value = 'Please fill in all fields.'; return }
  if (password.value.length < 6) { error.value = 'Password must be at least 6 characters.'; return }
  loading.value = true
  const { data, error: authError } = await db.auth.signUp({
    email: email.value,
    password: password.value,
    options: { data: { full_name: name.value } },
  })
  loading.value = false
  if (authError) {
    error.value = authError.message
  } else if (data.user?.id) {
    await prefetchOrg(data.user.id)
    await navigateTo('/events')
  } else {
    success.value = 'Account created! Check your email to confirm your address.'
  }
}
</script>
