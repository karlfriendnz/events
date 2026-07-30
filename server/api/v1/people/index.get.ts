// GET /api/v1/people — the public face of the seam for people. The client only ever
// talks to routes like this, never to the database. Scoped to one org (required),
// with optional paging + a name/email search. Output is validated against the
// shared contract before it leaves, so the client's types are guaranteed.
import { listPeople } from '../../../db/repositories/people'
import { personListSchema } from '../../../../shared/contracts/person'
import { legacyPeople } from '../../../utils/legacyBridge'
import { legacyClub } from '../../../utils/legacy'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const orgId = query.orgId ? String(query.orgId) : ''
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const limit = query.limit != null ? Number(query.limit) : undefined
  const offset = query.offset != null ? Number(query.offset) : undefined
  const q = query.q ? String(query.q) : undefined

  const people = await listPeople(orgId, { limit, offset, q })

  // THE CLUB'S OWN PEOPLE, from the system that owns them.
  //
  // While the module runs against a club on the old platform, that platform is the
  // source of truth for members — it holds the real roster, the contacts, the
  // custom fields. None of it reached here, so every people picker in the module
  // offered our own rows and none of the club's actual members.
  //
  // Appended (not replacing), prefixed `legacy-`, exactly as venues and categories
  // resolve at this boundary. Best-effort: if that platform can't be reached the
  // module keeps working on its own people rather than failing the whole list.
  const club = legacyClub()
  if (club?.orgId === orgId) {
    const theirs = await legacyPeople(orgId, { q, limit, offset }).catch(() => [])
    // Ours first: a person we hold is one this module created and is responsible for.
    const seen = new Set(people.map((p: any) => `${p.firstName}|${p.lastName}|${p.email ?? ''}`.toLowerCase()))
    for (const p of theirs) {
      if (seen.has(`${p.firstName}|${p.lastName}|${p.email ?? ''}`.toLowerCase())) continue
      people.push(p as any)
    }
  }
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return personListSchema.parse(people)
})
