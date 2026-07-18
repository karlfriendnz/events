// The client side of the seam for people. Components call this — never useDb(),
// never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came
// from MySQL today or the backend team's API tomorrow.
import type { Person, PersonCreate, PersonPatch, PersonWithOrg } from '../shared/contracts/person'
import type { PersonNote } from '../shared/contracts/circle'
import type { PersonNoteCreate, PersonNoteUpdate } from '../shared/contracts/personNote'

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
  /** Resolve a person by email within an org (case-insensitive), or null when no
   *  match — the dashboard maps the signed-in user's email to their person row. */
  async function findByEmail(orgId: string, email: string): Promise<Person | null> {
    try {
      return await $fetch<Person>('/api/v1/people/by-email', { query: { orgId, email } })
    } catch (e: any) {
      // ofetch surfaces the HTTP status on either .statusCode or .status — a 404
      // here means "no such person", the old maybeSingle()'s graceful null.
      if (e?.statusCode === 404 || e?.status === 404 || e?.response?.status === 404) return null
      throw e
    }
  }
  /** A bulk person fetch by id set — attendance visitor names, dashboard lookups. */
  async function byIds(ids: string[]): Promise<Person[]> {
    if (!ids.length) return []
    return await $fetch<Person[]>('/api/v1/people/by-ids', { query: { ids: ids.join(',') } })
  }
  /** Every persons row across every org matching a login's email (one per club) + the
   *  org name/level — the cross-club identity read (useMyClubs). */
  async function findAllByEmail(email: string): Promise<PersonWithOrg[]> {
    if (!email) return []
    return await $fetch<PersonWithOrg[]>('/api/v1/people/by-email-all', { query: { email } })
  }
  /** Create a person; returns the created domain object. */
  async function create(input: PersonCreate): Promise<Person> {
    return await $fetch<Person>('/api/v1/people', { method: 'POST', body: input })
  }
  /** Partially update a person; returns the updated domain object. */
  async function update(id: string, patch: PersonPatch): Promise<Person> {
    return await $fetch<Person>(`/api/v1/people/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a person. */
  async function remove(id: string): Promise<void> {
    await $fetch(`/api/v1/people/${id}`, { method: 'DELETE' })
  }
  /** Bulk-set (or clear, with typeKey=null) the type on N selected people, in one
   *  scoped statement. */
  async function setTypeForMany(orgId: string, ids: string[], typeKey: string | null): Promise<void> {
    await $fetch('/api/v1/people/set-type', { method: 'POST', body: { orgId, ids, typeKey } })
  }
  /** Bulk-delete N selected people in one scoped statement. */
  async function removeMany(orgId: string, ids: string[]): Promise<void> {
    await $fetch('/api/v1/people/delete-many', { method: 'POST', body: { orgId, ids } })
  }
  /** Add a note to a person (note READS live in useCirclesApi().notes). */
  async function addNote(input: PersonNoteCreate): Promise<PersonNote> {
    return await $fetch<PersonNote>('/api/v1/person-notes', { method: 'POST', body: input })
  }
  /** Edit a note by id (body + audience/importance/due). */
  async function updateNote(id: string, patch: PersonNoteUpdate): Promise<PersonNote> {
    return await $fetch<PersonNote>(`/api/v1/person-notes/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a note by id. */
  async function removeNote(id: string): Promise<void> {
    await $fetch(`/api/v1/person-notes/${id}`, { method: 'DELETE' })
  }
  return { list, get, findByEmail, byIds, findAllByEmail, create, update, remove, setTypeForMany, removeMany, addNote, updateNote, removeNote }
}
