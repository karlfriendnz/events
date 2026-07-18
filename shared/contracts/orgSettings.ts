// A small, focused contract for the handful of organisation SETTINGS the People
// directory reads/writes — deliberately NOT part of the base Organisation contract
// (that stays the identity/tree shape). Keeping these here avoids widening the base
// contract with screen-specific columns, and keeps tokens/secrets out entirely.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

export const orgSettingsSchema = z.object({
  // The org's level in the hierarchy (CLUB, REGIONAL, NATIONAL…). Drives whether the
  // People page shows the "own vs club members" governing-org tabs.
  orgLevel: z.string(),
  // How a club member is stored when pulled into a governing org's group.
  memberPullMode: z.string().nullable(),
  // Per-type-tab visible-column selection, keyed by tab key → column keys.
  // (Zod v4: z.record needs an explicit key schema.) null = never configured.
  peopleColumns: z.record(z.string(), z.array(z.string())).nullable(),
})
export type OrgSettings = z.infer<typeof orgSettingsSchema>

// The write contract for the People-columns patch — the only settings the page saves.
export const peopleColumnsPatchSchema = z.object({
  peopleColumns: z.record(z.string(), z.array(z.string())).nullable(),
})
export type PeopleColumnsPatch = z.infer<typeof peopleColumnsPatchSchema>
