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

  if (!user.value && to.path !== '/login') {
    return navigateTo('/login')
  }
  if (user.value && to.path === '/login') {
    return navigateTo('/events')
  }
})
