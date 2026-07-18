// Recipe: create a CLUB and apply a club type's setup template (modules / person
// types / terminology / starting dashboards) exactly the way /admin does on new-club
// creation — reusing the server-side applyClubTypeDefaults so there's ONE source of
// truth for what a club type seeds. Falls back to a plain club when no club types
// exist (or none is chosen).
import { defaultDashboardFor } from '../../../../composables/usePermissions'
import type { SeedContext } from '../context'
import type { SeedRecipe, SeedOption } from '../types'

const D = '[Demo] '

export const clubByTypeRecipe: SeedRecipe = {
  key: 'club-by-type',
  label: 'Club from a club type',
  description: 'Create a club and seed it from a club type\'s defaults (modules, person types, terminology, dashboards). Falls back to a plain club if no club types exist.',
  scope: 'new-org',
  options: [
    { key: 'name', label: 'Club name', type: 'text', default: 'New Club' },
    // Populated dynamically from the club_types catalogue by the recipes endpoint.
    { key: 'clubTypeId', label: 'Club type', type: 'select', default: '', choices: [] },
  ],

  // The endpoint fills the clubTypeId choices from the live catalogue, so the option
  // list is resolved rather than static.
  async resolveOptions(ctx: SeedContext): Promise<SeedOption[]> {
    const types = await ctx.repos.admin.listClubTypes()
    const choices = types.map((t) => ({ value: t.id, label: t.name }))
    return [
      { key: 'name', label: 'Club name', type: 'text', default: 'New Club' },
      { key: 'clubTypeId', label: 'Club type', type: 'select', default: choices[0]?.value ?? '', choices },
    ]
  },

  async run(ctx, opts) {
    const { organisations, admin } = ctx.repos
    const name = String(opts?.name ?? 'New Club').trim() || 'New Club'
    let clubTypeId = String(opts?.clubTypeId ?? '').trim()

    // No explicit choice → use the overall-default club type if one exists.
    if (!clubTypeId) {
      const types = await admin.listClubTypes()
      clubTypeId = types[0]?.id ?? ''
    }

    const club = await organisations.createOrganisation({
      name: D + name, orgLevel: 'CLUB',
    } as any)
    ctx.count('organisations')

    if (clubTypeId) {
      // Persist the club's type(s) then seed from their defaults — the exact /admin
      // new-club path. applyClubTypeDefaults also folds in the overall default.
      await admin.setOrgClubTypes(club.id, [clubTypeId])
      await admin.applyClubTypeDefaults(club.id, [clubTypeId], defaultDashboardFor)
      ctx.count('clubTypeApplied')
      ctx.log(`Applied club type ${clubTypeId} to ${club.id}`)
    } else {
      ctx.log(`No club types exist — created plain club ${club.id}`)
    }

    return {
      created: ctx.snapshotCounts(),
      orgIds: [club.id],
      note: clubTypeId ? undefined : 'No club types configured — created a plain club.',
    }
  },
}
