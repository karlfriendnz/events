<!--
  Guided setup CHECKLIST (migration 247). Each step teaches a concept and links
  to the REAL page where you add/update it — you use the actual tools, and the
  step ticks itself off (detected from real data) the moment you've done it.
  Comes back here anytime via the dashboard nudge. Core steps (club + season)
  gate app entry; the rest are optional.
-->
<script setup lang="ts">
const { orgId } = useOrg()
const ob = useOnboarding()
const { ensureTerms, t } = useTerms()
void ensureTerms()
useBreadcrumbs([{ label: 'Set up your club' }])

const loading = ref(true)
const done = ref<Record<string, boolean>>({})
const state = ref(ob.resolve(null))
const steps = ob.ONBOARDING_STEPS

async function refresh() {
  if (!orgId.value) return
  const [d, s] = await Promise.all([ob.detect(), ob.loadState()])
  done.value = d
  state.value = s
  loading.value = false
}
onMounted(refresh)
watch(orgId, refresh)
// Re-check whenever the tab regains focus (they went off to a real page + came back)
onMounted(() => { if (import.meta.client) window.addEventListener('focus', refresh) })
onBeforeUnmount(() => { if (import.meta.client) window.removeEventListener('focus', refresh) })

const doneCount = computed(() => ob.doneCount(done.value))
const total = steps.length
const pct = computed(() => Math.round((doneCount.value / total) * 100))
const coreDone = computed(() => ob.coreDone(done.value))
const allDone = computed(() => ob.allDone(done.value))
// the next thing to do (first incomplete step)
const nextStep = computed(() => steps.find(s => !done.value[s.key]) ?? null)

async function finish() {
  await ob.saveState({ ...state.value, completed_at: new Date().toISOString(), dismissed: true })
  navigateTo('/dashboard')
}
</script>

<template>
  <div class="p-3 sm:p-6 max-w-3xl mx-auto space-y-5">
    <div v-if="loading" class="card p-16 text-center text-gray-400"><i class="pi pi-spin pi-spinner text-2xl" /></div>

    <template v-else>
      <!-- Header + progress -->
      <div class="card p-5 sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Set up your club</h1>
            <p class="text-sm text-gray-500 mt-1">Work through these — each one opens the real page so you learn where things live. Steps tick off automatically as you go.</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-2xl font-bold text-gray-900 leading-none">{{ pct }}%</p>
            <p class="text-xs text-gray-400">{{ doneCount }} of {{ total }}</p>
          </div>
        </div>
        <div class="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div class="h-full rounded-full transition-all" :style="{ width: pct + '%', background: allDone ? '#10B981' : '#3B82F6' }" />
        </div>
        <div v-if="nextStep" class="mt-3 flex items-center gap-2 text-sm">
          <span class="text-gray-400">Next:</span>
          <NuxtLink :to="nextStep.to" class="font-medium text-primary hover:underline">{{ nextStep.label }} →</NuxtLink>
        </div>
      </div>

      <!-- Checklist -->
      <div class="space-y-3">
        <div v-for="s in steps" :key="s.key"
          class="card p-4 sm:p-5 flex items-start gap-4"
          :class="done[s.key] ? 'opacity-75' : ''">
          <!-- tick / icon -->
          <span class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white"
            :style="{ background: done[s.key] ? '#10B981' : s.color }">
            <i :class="['pi', done[s.key] ? 'pi-check' : s.icon, 'text-base']" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-semibold" :class="done[s.key] ? 'text-gray-400 line-through' : 'text-gray-900'">{{ s.label }}</h3>
              <span v-if="s.core" class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Required</span>
              <span v-if="done[s.key]" class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Done</span>
            </div>
            <p class="text-xs text-gray-500 mt-1 leading-snug">{{ s.blurb }}</p>
          </div>
          <NuxtLink :to="s.to"
            class="shrink-0 self-center text-sm font-medium px-3 py-1.5 rounded-lg whitespace-nowrap"
            :class="done[s.key] ? 'text-gray-500 hover:bg-gray-100' : 'text-white'"
            :style="done[s.key] ? {} : { background: s.color }">
            {{ done[s.key] ? 'Review' : s.cta }} →
          </NuxtLink>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3">
        <button type="button" class="text-sm text-gray-400 hover:text-primary" @click="refresh"><i class="pi pi-refresh text-xs mr-1" />Check progress</button>
        <Button :label="allDone ? 'All done — go to dashboard' : 'Finish for now'"
          :disabled="!coreDone" :severity="allDone ? undefined : 'secondary'"
          :style="allDone ? 'background:#10B981;border-color:#10B981' : ''"
          @click="finish" />
      </div>
      <p v-if="!coreDone" class="text-xs text-amber-600 text-right -mt-3">Name your club and add a season first — the rest can wait.</p>
    </template>
  </div>
</template>
