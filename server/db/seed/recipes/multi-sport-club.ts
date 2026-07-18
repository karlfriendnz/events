// Recipe: a single CLUB running several sports — one org_sports row per sport
// (the first marked primary), a member group per sport, and some people. Creates a
// new org and seeds into it.
import type { SeedRecipe } from '../types'

const D = '[Demo] '
const FIRST = ['Alex', 'Sam', 'Jamie', 'Pat', 'Casey', 'Jordan', 'Riley', 'Morgan']
const LAST = ['Rivera', 'Okoro', 'Chen', 'Patel', 'Nguyen', 'Smith', 'Brown', 'Lee']

export const multiSportClubRecipe: SeedRecipe = {
  key: 'multi-sport-club',
  label: 'Multi-sport club',
  description: 'Create a club with three affiliated sports, a group per sport and some people.',
  scope: 'new-org',
  options: [
    { key: 'name', label: 'Club name', type: 'text', default: 'Harbourside Racquets' },
  ],

  async run(ctx, opts) {
    const { organisations, affiliations, groups, people } = ctx.repos
    const name = String(opts?.name ?? 'Harbourside Racquets').trim() || 'Harbourside Racquets'
    const sports = ['Tennis', 'Badminton', 'Squash']

    const club = await organisations.createOrganisation({
      name: D + name, orgLevel: 'CLUB',
    } as any)
    ctx.count('organisations')

    for (let i = 0; i < sports.length; i++) {
      await affiliations.createOrgSport({
        orgId: club.id, sport: sports[i], isPrimary: i === 0, sortOrder: i,
      } as any)
      ctx.count('orgSports')

      const group = await groups.createGroup({
        orgId: club.id, name: `${sports[i]} Members`, color: ctx.pick(['#3B82F6', '#F59E0B', '#10B981']),
        kind: 'class',
      } as any)
      ctx.count('groups')

      const memberCount = ctx.randInt(5, 9)
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

    ctx.log(`Created multi-sport club ${club.id} with ${sports.length} sports`)
    return { created: ctx.snapshotCounts(), orgIds: [club.id] }
  },
}
