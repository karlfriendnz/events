export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()

  // On hard refresh, useSupabaseUser() is null until Supabase fires INITIAL_SESSION
  // (async). Call getSession() directly so we can check the stored session before
  // deciding to redirect — avoids the logout-on-refresh race condition.
  if (!user.value) {
    const db = useSupabaseClient()
    const { data: { session } } = await db.auth.getSession()
    if (session?.user) {
      user.value = session.user as any
    }
  }

  // Public, guest-accessible routes: the booker (/book), the public registration
  // form (/r/:context/:id), the event RSVP link (/rsvp/:event/:person — it arrives
  // by email, so a member with no login must still be able to reply) and the
  // website calendar embed (/embed/*, which a club iframes into its own site).
  // Everything else requires a login.
  const isPublic = to.path.startsWith('/book') || to.path.startsWith('/r/') || to.path.startsWith('/rsvp')
    || to.path.startsWith('/embed')
    || to.path === '/set-password' || to.path === '/clubs'
  if (!user.value && to.path !== '/login' && !isPublic) {
    return navigateTo('/login')
  }
  if (user.value && to.path === '/login') {
    return navigateTo('/events')
  }
})
