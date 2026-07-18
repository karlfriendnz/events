// Recipe: a whole governing-body tree — one NATIONAL org over N REGIONAL children
// over M CLUB grandchildren, each club seeded with a handful of people + one group.
// Returns every org id it created so the caller can navigate/clean them up.
import type { SeedRecipe } from '../types'

const D = '[Demo] '

const FIRST = ['Alex', 'Sam', 'Jamie', 'Pat', 'Casey', 'Jordan', 'Riley', 'Morgan', 'Taylor', 'Quinn']
const LAST = ['Rivera', 'Okoro', 'Chen', 'Patel', 'Nguyen', 'Smith', 'Brown', 'Wilson', 'Lee', 'Kaur']

export const nsoHierarchyRecipe: SeedRecipe = {
  key: 'nso-hierarchy',
  label: 'Governing-body hierarchy',
  description: 'Create a National org with regional children and club grandchildren, each club seeded with a few people and a group.',
  scope: 'hierarchy',
  options: [
    { key: 'regions', label: 'Regions', type: 'number', default: 2 },
    { key: 'clubsPerRegion', label: 'Clubs per region', type: 'number', default: 3 },
    { key: 'sport', label: 'Sport name', type: 'text', default: 'Football' },
  ],

  async run(ctx, opts) {
    const { organisations, people, groups } = ctx.repos
    const regions = Math.max(1, Math.min(6, Number(opts?.regions ?? 2)))
    const clubsPer = Math.max(1, Math.min(8, Number(opts?.clubsPerRegion ?? 3)))
    const sport = String(opts?.sport ?? 'Football').trim() || 'Football'

    const orgIds: string[] = []

    // National
    const national = await organisations.createOrganisation({
      name: `${D}${sport} National`, orgLevel: 'NATIONAL',
    } as any)
    orgIds.push(national.id)
    ctx.count('organisations')

    for (let r = 1; r <= regions; r++) {
      const region = await organisations.createOrganisation({
        name: `${D}${sport} Region ${r}`, orgLevel: 'REGIONAL', parentId: national.id,
      } as any)
      orgIds.push(region.id)
      ctx.count('organisations')

      for (let c = 1; c <= clubsPer; c++) {
        const club = await organisations.createOrganisation({
          name: `${D}${sport} Club R${r}-${c}`, orgLevel: 'CLUB', parentId: region.id,
        } as any)
        orgIds.push(club.id)
        ctx.count('organisations')

        // A group + a few members per club.
        const group = await groups.createGroup({
          orgId: club.id, name: 'Seniors', color: '#3B82F6', kind: 'class',
        } as any)
        ctx.count('groups')

        const memberCount = ctx.randInt(4, 8)
        for (let m = 0; m < memberCount; m++) {
          const first = ctx.pick(FIRST)
          const last = ctx.pick(LAST)
          const person = await people.createPerson({
            orgId: club.id, firstName: first, lastName: last,
            email: `${first}.${last}.${ctx.randInt(1000, 9999)}@demo.local`.toLowerCase(),
          } as any)
          ctx.count('people')
          await groups.upsertMembership({ groupId: group.id, personId: person.id } as any)
          ctx.count('memberships')
        }
      }
    }

    ctx.log(`Created ${orgIds.length} orgs (1 national, ${regions} regional, ${regions * clubsPer} clubs)`)
    return { created: ctx.snapshotCounts(), orgIds }
  },
}
