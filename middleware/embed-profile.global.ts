/**
 * THE RULE: while embedded in the old platform, a person's profile is THEIR page.
 *
 * Inside the frame, /people/:id is the wrong destination — the person's real profile
 * lives on the host platform, and opening ours renders the module inside the module.
 * Components that show a name should use <PersonNameLink>, which builds the right
 * href up front (so middle-click and copy-link are right too).
 *
 * This is the net under that: ~40 person links across the app pre-date the rule and
 * any new one could forget it, so rather than depending on every author remembering,
 * the navigation itself is caught here. One place, applies everywhere, including
 * routes written later.
 *
 * Deliberately does nothing when:
 *   - not embedded (the module standing alone owns its own profile page),
 *   - the person has no counterpart over there (nothing to link to — an unbridged
 *     person exists only in this module),
 *   - the lookup fails (a navigation must not depend on the old platform being up).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Client only: this navigates the TOP window, which has no meaning during SSR.
  if (import.meta.server) return

  const embedded = useState<boolean>('fmEmbedSession', () => false)
  const platformUrl = useState<string>('fmEmbedPlatformUrl', () => '')
  if (!embedded.value || !platformUrl.value) return

  const match = /^\/people\/([^/]+)\/?$/.exec(to.path)
  if (!match) return
  const routeId = decodeURIComponent(match[1])
  // /people/new is the create screen, not somebody's id.
  if (!routeId || routeId === 'new') return

  const { resolveProfileUrl } = usePersonProfileLink()
  const url = await resolveProfileUrl(routeId)
  if (!url) return

  // _top, not this frame: the host page is what has to move. Only reachable from a
  // click, so the user activation top-navigation needs is present.
  window.open(url, '_top')
  return abortNavigation()
})
