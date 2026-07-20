<!--
  Bottom-right stack of "shared with your club" cards (event invites for now). Each
  card: a header strip in the club's brand colour, an optional event banner, the
  message, and Decline / Accept actions that respond to the underlying invite. Accepting
  connects everything by default (the club can fine-tune in the dashboard inbox). Mounted
  once in layouts/default.vue.
-->
<script setup lang="ts">
const { queue, dismiss } = useShareNotifications()
const eventsApi = useEventsApi()
const toast = useToast()

const busy = ref<string | null>(null)

async function accept(n: any) {
  busy.value = n.id
  try {
    await eventsApi.respondOrgInvite(n.inviteId, { status: 'ACCEPTED', connections: { event_details: true, fees: true, communication: true } })
    dismiss(n.id)
    toast.add({ severity: 'success', summary: 'Accepted', detail: `${n.headline} is now connected to your club.`, life: 4000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not accept', detail: e?.data?.message ?? e?.message, life: 4000 })
  } finally { busy.value = null }
}
async function decline(n: any) {
  busy.value = n.id
  try {
    await eventsApi.respondOrgInvite(n.inviteId, { status: 'DECLINED' })
    dismiss(n.id)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message ?? e?.message, life: 4000 })
  } finally { busy.value = null }
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[1200] flex flex-col gap-3 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-none">
    <TransitionGroup name="share-pop">
      <div v-for="n in queue" :key="n.id"
        class="pointer-events-auto bg-white rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/5">
        <!-- Brand header strip -->
        <div class="flex items-center gap-2 px-4 py-2.5 text-white" style="background:var(--brand-primary)">
          <i class="pi pi-share-alt text-sm" />
          <span class="text-sm font-semibold flex-1">{{ n.title }}</span>
          <button class="text-white/70 hover:text-white" @click="dismiss(n.id)"><i class="pi pi-times text-xs" /></button>
        </div>

        <!-- Optional event banner -->
        <div v-if="n.bannerUrl" class="h-24 bg-gray-100 bg-cover bg-center" :style="{ backgroundImage: `url(${n.bannerUrl})` }" />

        <div class="p-4">
          <p class="text-sm font-semibold text-gray-900">{{ n.headline }}</p>
          <p class="text-xs text-gray-500 mt-0.5">{{ n.message }}</p>
          <p v-if="n.disciplineName" class="inline-flex items-center gap-1 text-xs text-primary font-medium mt-1.5">
            <i class="pi pi-tag text-[10px]" /> For the {{ n.disciplineName }} discipline
          </p>

          <div class="flex items-center gap-2 mt-3">
            <Button label="Decline" severity="secondary" outlined size="small" class="flex-1"
              :disabled="busy === n.id" @click="decline(n)" />
            <Button label="Accept" icon="pi pi-check" size="small" class="flex-1" :loading="busy === n.id"
              style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="accept(n)" />
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.share-pop-enter-active, .share-pop-leave-active { transition: all .28s cubic-bezier(.22,.61,.36,1); }
.share-pop-enter-from { opacity: 0; transform: translateX(24px) scale(.96); }
.share-pop-leave-to { opacity: 0; transform: translateX(24px) scale(.96); }
.share-pop-leave-active { position: absolute; width: 100%; }
</style>
