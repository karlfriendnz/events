// The client side of the PUBLIC (anonymous, read-only) seam. Public pages — the embed
// calendar, the /book menu, the /r registration page — call this instead of useDb().
// Everything it returns is a public-safe contract shape; the component never knows (or
// needs to know) that the data came from MySQL today or the backend team's API tomorrow.
//
// All reads hit /api/v1/public/** — the one prefix the backend team's future auth
// middleware allow-lists as anonymous, while everything else stays gated.
import type {
  PublicOrg,
  PublicEvent,
  PublicEventDetail,
  PublicGroup,
  PublicForm,
  PublicBooker,
} from '../shared/contracts/public'

export function usePublicApi() {
  /** One org's public presentation (name + branding + booker theme). */
  async function org(orgId: string): Promise<PublicOrg> {
    return await $fetch<PublicOrg>('/api/v1/public/org', { query: { org: orgId } })
  }
  /** PUBLISHED + public + dated events for the embed calendar, optionally narrowed by
   *  venue / category / type (CSV, applied server-side). */
  async function events(
    orgId: string,
    opts: { venues?: string[]; categories?: string[]; types?: string[] } = {},
  ): Promise<PublicEvent[]> {
    const query: Record<string, string> = { org: orgId }
    if (opts.venues?.length) query.venues = opts.venues.join(',')
    if (opts.categories?.length) query.categories = opts.categories.join(',')
    if (opts.types?.length) query.types = opts.types.join(',')
    return await $fetch<PublicEvent[]>('/api/v1/public/events', { query })
  }
  /** One event + its registration detail (sessions / fee lines / discounts / form config).
   *  Returns null when the event isn't available (not found or closed). */
  async function event(id: string): Promise<PublicEventDetail | null> {
    try {
      return await $fetch<PublicEventDetail>(`/api/v1/public/event/${id}`)
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.status === 404 || e?.response?.status === 404) return null
      throw e
    }
  }
  /** One class + its registration detail (fee options / full-status / siblings).
   *  Returns null when the class doesn't exist. */
  async function group(id: string): Promise<PublicGroup | null> {
    try {
      return await $fetch<PublicGroup>(`/api/v1/public/group/${id}`)
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.status === 404 || e?.response?.status === 404) return null
      throw e
    }
  }
  /** One form's config + its connected classes (spaces + fee options). Returns null
   *  when the form doesn't exist. */
  async function form(id: string): Promise<PublicForm | null> {
    try {
      return await $fetch<PublicForm>(`/api/v1/public/form/${id}`)
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.status === 404 || e?.response?.status === 404) return null
      throw e
    }
  }
  /** The public booker menu (activities + modes + bookables + availability). */
  async function booker(orgId: string): Promise<PublicBooker> {
    return await $fetch<PublicBooker>('/api/v1/public/booker', { query: { org: orgId } })
  }
  return { org, events, event, group, form, booker }
}
