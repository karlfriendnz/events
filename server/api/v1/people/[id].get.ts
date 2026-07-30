// GET /api/v1/people/:id — one person. 404 when it doesn't exist. Output validated
// against the shared contract before it leaves.
//
// Answers for BOTH id shapes. A `legacy-<n>` arrives from anywhere the old platform
// identified the person — their profile over there, an invitation accepted from it —
// and this route used to 404 it, which surfaced as a registration form that silently
// refused to prefill.
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { getPerson } from '../../../db/repositories/people'
import { legacyPerson, isLegacyPersonId } from '../../../utils/legacyBridge'
import { legacyClub } from '../../../utils/legacy'
import { personSchema } from '../../../../shared/contracts/person'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  let person: any = await getPerson(id)

  if (!person && isLegacyPersonId(id)) {
    const legacyId = Number(id.replace(/^legacy-/i, ''))
    // OUR record first when the person is bridged: it holds what this module knows —
    // dob, gender, custom field answers — which is the whole point of prefilling.
    // The old platform's copy is the fallback, not the preference.
    const [bridged] = await db.select({ id: schema.persons.id })
      .from(schema.persons).where(eq(schema.persons.legacyPersonId, legacyId)).limit(1)
    if (bridged) person = await getPerson(bridged.id)
    if (!person) {
      const club = legacyClub()
      if (club?.orgId) person = await legacyPerson(id, club.orgId)
    }
  }

  if (!person) {
    throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  }
  return personSchema.parse(person)
})
