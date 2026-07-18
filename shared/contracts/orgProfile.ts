// A focused contract for the Settings → General tab's view of an organisation —
// identity, branding, season, contact details, and the club-level payment/booker
// defaults. Deliberately its OWN slice (not the base Organisation contract, not the
// People-directory getOrgSettings, not the dashboard getOrgDashboardMeta): each
// screen reads the handful of columns it needs, so no shared contract gets widened
// with screen-specific columns.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'
import { orgLevelSchema } from './organisation'

// Loose json shapes — the page owns their internal structure; the seam just carries
// them through. (Payment option maps are keyed by method → enabled; booker theme is
// a {canvas, primary, on_primary} object; club_type_ids is a string array.)
const jsonRecord = z.record(z.string(), z.any()).nullable()

export const orgProfileSchema = z.object({
  name: z.string(),
  currency: z.string(),
  locale: z.string(),
  // date columns — transported as 'YYYY-MM-DD' strings (or null); the page maps to Date.
  seasonStart: z.string().nullable(),
  seasonEnd: z.string().nullable(),
  parentId: z.string().nullable(),
  orgLevel: orgLevelSchema,
  defaultSportName: z.string().nullable(),
  clubTypeIds: z.array(z.string()),
  logoUrl: z.string().nullable(),
  iconUrl: z.string().nullable(),
  brandColor: z.string().nullable(),
  brandTextColor: z.string().nullable(),
  defaultFormId: z.string().nullable(),
  defaultPaymentMethod: z.string().nullable(),
  defaultBankAccountId: z.string().nullable(),
  eventsDefaultPaymentMethod: z.string().nullable(),
  eventsDefaultBankAccountId: z.string().nullable(),
  shortName: z.string().nullable(),
  address: z.string().nullable(),
  country: z.string().nullable(),
  timezone: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  defaultPaymentOptions: jsonRecord,
  eventsDefaultPaymentOptions: jsonRecord,
  bookerTheme: jsonRecord,
})
export type OrgProfile = z.infer<typeof orgProfileSchema>

// WRITE contract — any subset of the writable fields. `parentId` is intentionally
// NOT writable here: re-parenting an org is a privileged, tenant-crossing act
// (security audit CRIT-3) that must be its own permission-checked endpoint, so it's
// omitted from the general patch exactly like organisationPatchSchema does.
export const orgProfilePatchSchema = orgProfileSchema.omit({ parentId: true }).partial()
export type OrgProfilePatch = z.infer<typeof orgProfilePatchSchema>
