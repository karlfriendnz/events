<script setup lang="ts">
/**
 * The page the OLD platform loads in its iframe.
 *
 * The old platform's /events, /attendance, /programs and the profile's Events
 * tab all render this, passing:
 *   ?club=demo&logintoken=<single-use>&view=calendar|attendance|programmes&person=40
 *
 * We swap the token for a session server-side (the club's API key stays on the
 * server), put the app into that club's organisation context, then mount the
 * REAL events board — the same <EventsBoard> /events uses, not a stand-in.
 *
 * The token is single-use, so refreshing this page cannot re-exchange it; the
 * old platform mints a new one each time it renders the frame.
 */
definePageMeta({ layout: 'embed' })

const route = useRoute()
const { orgId, orgReady } = useOrg()

/**
 * Marks this browsing session as "already authenticated by the old platform".
 * Set only after the token exchange succeeds, and read by auth.global.ts so
 * navigating out of /embed (New Event, opening an event) is not bounced to the
 * login screen.
 */
const embedSession = useState<boolean>('fmEmbedSession', () => false)

const loading = ref(true)
const error = ref<string | null>(null)
const session = ref<any>(null)

onMounted(async () => {
  try {
    // Already signed in this browsing session — most likely the user pressed
    // BACK onto this page. The login token is single-use, so re-exchanging it
    // would 401 and throw them out of a working session. Just render.
    if (embedSession.value && orgId.value) {
      loading.value = false
      return
    }

    session.value = await $fetch('/api/v1/legacy/session', {
      query: { club: route.query.club, logintoken: route.query.logintoken },
    })

    if (!session.value?.club?.orgId) {
      throw new Error('This club is not linked to an organisation in the events module yet.')
    }

    // Put the app into the club's context. useOrg() is shared state, so every
    // component below reads the right club from here on — the same thing the
    // normal app does after login.
    orgId.value = session.value.club.orgId
    orgReady.value = true
    embedSession.value = true

    // The old platform tells us which of its pages we replaced, so /attendance
    // and /programs land on the matching screen rather than dumping everyone on
    // the calendar. The navigation happens INSIDE the iframe, so the user never
    // leaves the old platform's shell.
    // A link to one event (the old platform's /events/:id) opens that event,
    // not the calendar. Two id shapes arrive here: this module's uuids, and the
    // old platform's own numeric ids — which open the legacy event view.
    const eventId = String(route.query.event || '')
    if (/^[0-9a-f-]{36}$/i.test(eventId)) return await navigateTo(`/events/${eventId}`)
    if (/^legacy-\d+$/i.test(eventId)) {
      return await navigateTo(`/events/legacy/${eventId.replace(/^legacy-/i, '')}`)
    }
    if (/^\d+$/.test(eventId)) return await navigateTo(`/events/legacy/${eventId}`)

    const view = String(route.query.view || 'calendar')
    const target = view === 'attendance' ? '/attendance'
      : view === 'programmes' ? '/programme'
      : null
    if (target) return await navigateTo(target)

    // Keeps the club selected if anything later re-reads it from storage.
    if (import.meta.client) {
      try { sessionStorage.setItem('fm_active_org', orgId.value!) } catch { /* non-fatal */ }
      // Drives the embed-only CSS in main.css (page-as-modal fills the frame
      // instead of floating on a scrim that stops at the iframe's edge). Set on
      // <html> so it survives navigating out of this page into the module.
      document.documentElement.classList.add('fm-embedded')
    }
  } catch (e: any) {
    error.value = e?.statusMessage || e?.data?.statusMessage || e?.message || 'Could not connect to the club'

    // A spent token means the host page was restored from cache with the one it
    // already used. Ask it to re-issue rather than leaving the user staring at
    // an error they can do nothing about; the host only honours this once.
    const spent = /login token/i.test(String(error.value))
    if (spent && import.meta.client && window.parent !== window) {
      window.parent.postMessage({ type: 'fmevents:reauth' }, '*')
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="embed-root">
    <div v-if="loading" class="p-6 text-sm text-gray-500">Loading…</div>

    <div v-else-if="error" class="p-6">
      <div class="card p-4 border-l-4 border-l-red-500 max-w-xl">
        <div class="text-sm font-semibold text-gray-800">Couldn't open the events module</div>
        <p class="text-xs text-gray-500 mt-1">{{ error }}</p>
        <p class="text-xs text-gray-400 mt-2">
          A login link works only once — reopening this page from the old system issues a new one.
        </p>
      </div>
    </div>

    <!-- The real board, exactly as /events renders it. -->
    <EventsBoard v-else-if="orgReady" />
  </div>
</template>

<style scoped>
/* The old platform gives us the full frame, so the board owns the viewport and
   scrolls internally rather than the iframe scrolling.
   NB height, not min-height: the month grid divides its parent's height between
   the weeks, so an unbounded parent collapses every week to a sliver — the same
   trap /embed/calendar hit. */
.embed-root { height: 100vh; background: #F5F8FA; }
</style>
