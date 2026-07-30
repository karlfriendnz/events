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

/** Host platform origin, read by usePersonProfileLink() to link names back to it. */
const platformUrl = useState<string>('fmEmbedPlatformUrl', () => '')

const loading = ref(true)
const error = ref<string | null>(null)
const session = ref<any>(null)

/**
 * Go wherever this frame was asked to go.
 *
 * The old platform tells us which of its pages we replaced, so /attendance and
 * /programs land on the matching screen rather than dumping everyone on the
 * calendar. The navigation happens INSIDE the iframe, so the user never leaves
 * the old platform's shell.
 *
 * Its own function because it has to run on BOTH paths through onMounted — a
 * fresh token exchange and an already-authenticated frame. It only lived on the
 * first, so the second silently ignored `view` and showed the calendar.
 */
async function routeToRequestedView() {
  // A link to one event (the old platform's /events/:id) opens that event, not
  // the calendar. Two id shapes arrive here: this module's uuids, and the old
  // platform's own numeric ids — which open the legacy event view.
  const eventId = String(route.query.event || '')
  if (/^[0-9a-f-]{36}$/i.test(eventId)) return await navigateTo(`/events/${eventId}`)
  const legacyMatch = /^(?:legacy-)?(\d+)$/i.exec(eventId)
  if (legacyMatch) {
    // THEIR id is not proof it is THEIR event. Anything created here is mirrored onto
    // the club's calendar, and that calendar links to its own copy — so this arrives
    // carrying a legacy id for an event we own. Routing straight to the legacy view
    // showed the owner a read-only stranger's version of their own event: no
    // Communication or Notes tabs, an empty roll (read from their side), and a delete
    // that silently did nothing. Ask who owns it first; only genuinely-theirs events
    // get the legacy view.
    const ours = await $fetch<{ id: string | null }>('/api/v1/events/by-legacy-id', {
      query: { legacyId: legacyMatch[1] },
    }).catch(() => ({ id: null }))
    if (ours?.id) return await navigateTo(`/events/${ours.id}`)
    return await navigateTo(`/events/view/legacy-${legacyMatch[1]}`)
  }

  const view = String(route.query.view || 'calendar')

  // The module's event settings, as a tab on the old platform's own Settings
  // page — so a club configures categories, forms and payment options where it
  // already goes to configure everything else.
  if (view === 'settings-events') return await navigateTo('/settings?tab=events')

  // ONE named calendar, from a menu item in the old platform's shell. Our left
  // rail is hidden while embedded (that shell supplies the navigation), so a
  // pinned calendar has no item over here to be reached by — the host menu
  // links straight to it instead.
  const calendarId = String(route.query.calendar || '')
  if (calendarId) return await navigateTo(`/events?calendar=${encodeURIComponent(calendarId)}`)

  // ONE MEMBER'S events — the old platform's profile Events tab mounts us with the
  // member's id. This was documented in the header above and read by nothing, so
  // that tab fell through to the whole club calendar: it looked like the feature
  // working while showing every member the same thing.
  const personId = String(route.query.person || '')
  if (personId) {
    const scoped = /^\d+$/.test(personId) ? `legacy-${personId}` : personId
    // The member's own EVENTS LIST, not a filtered calendar — this is the profile's
    // Events tab, and what it's for is "what is this person on, and did they turn
    // up". `/account/events` renders the same <EventsProfileView> the module's own
    // profile tab does, so both surfaces are one component.
    return await navigateTo(`/account/events?person=${encodeURIComponent(scoped)}`)
  }

  const target = view === 'attendance' ? '/attendance'
    : view === 'programmes' ? '/programme'
    : null
  if (target) return await navigateTo(target)
}

onMounted(async () => {
  try {
    // Already signed in this browsing session — most likely the user pressed
    // BACK onto this page, or a SECOND frame on the same platform page (the
    // Settings tab's, say) is booting after the first. The login token is
    // single-use, so re-exchanging it would 401 and throw them out of a working
    // session. Skip the exchange — but still honour what this frame was asked
    // to show. Returning here outright is what made the Settings tab render the
    // calendar: the request said `view=settings-events` and nothing ever read it.
    if (embedSession.value && orgId.value) {
      loading.value = false
      return await routeToRequestedView()
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
    // Where the host platform lives, for links that must go BACK to it — a person's
    // profile is its page while we are embedded. Shared state so any component can
    // read it without threading it down; empty everywhere else, which is what makes
    // usePersonProfileLink() fall back to our own profile route.
    platformUrl.value = session.value.club.baseUrl || ''
    // Same test as the CSS class below: this hides our left rail and the calendar
    // picker that replaces it, which is right INSIDE the platform's frame and wrong
    // anywhere else. Opening /embed directly to check something should look like
    // the module, not like a chromeless panel with no way out.
    embedSession.value = import.meta.client ? window.parent !== window : true

    // BEFORE routing, not after. Everything below this point used to sit after
    // routeToRequestedView(), which NAVIGATES — unmounting this page, so the lines
    // never ran for any view with an early return. That is why the embed-only
    // styling worked on the calendar and nowhere else.
    //
    // (The `fm-embedded` class itself now lives in plugins/embed-height.client.ts,
    // which runs on every page and simply tests whether it is framed — so nothing
    // has to remember to set it, and it can't be lost to a navigation again.)
    if (import.meta.client) {
      // Keeps the club selected if anything later re-reads it from storage.
      try { sessionStorage.setItem('fm_active_org', orgId.value!) } catch { /* non-fatal */ }
    }

    await routeToRequestedView()
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
