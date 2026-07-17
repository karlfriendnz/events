// The client side of the seam for people. Components call this — never useDb(),
// never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came
// from MySQL today or the backend team's API tomorrow.
import type { Person } from '../shared/contracts/person'

export function usePeopleApi() {
  /** Everyone in an org, with optional paging + a name/email search. */
  async function list(
    orgId: string,
    opts: { limit?: number; offset?: number; q?: string } = {},
  ): Promise<Person[]> {
    const params = new URLSearchParams({ orgId })
    if (opts.limit != null) params.set('limit', String(opts.limit))
    if (opts.offset != null) params.set('offset', String(opts.offset))
    if (opts.q) params.set('q', opts.q)
    return await $fetch<Person[]>(`/api/v1/people?${params.toString()}`)
  }
  /** One person by id. */
  async function get(id: string): Promise<Person> {
    return await $fetch<Person>(`/api/v1/people/${id}`)
  }
  return { list, get }
}
