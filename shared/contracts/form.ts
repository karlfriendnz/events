// The CONTRACT for the forms & registration domain: Zod schemas + the domain types
// inferred from them, shared by the client (typed composable) and the server (Nitro
// route output validation). DB-neutral by design — a form's `config` and a
// submission's `answers` are `json` in MySQL today, were jsonb before, and could be
// anything behind a future API; the UI only ever sees a plain object, and only the
// repository mapper knows the storage.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A registration form — the reusable form definition a club designs once and
// connects to many contexts (events, groups, competitions, enquiries). `config` is
// the whole designed shape (subjects, fields, payment, terms) as an opaque object at
// the boundary.
export const registrationFormSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  // json object → plain object at the boundary; passthrough (its inner shape is the
  // designer's concern, not the seam's).
  config: z.record(z.string(), z.any()),
})
export type RegistrationForm = z.infer<typeof registrationFormSchema>

export const registrationFormListSchema = z.array(registrationFormSchema)

// WRITE contracts. Create omits the server-owned id; name + orgId are required, and
// config defaults to an empty object in the repo. Patch is a partial — rename the
// form and/or overwrite its designed config.
export const registrationFormCreateSchema = registrationFormSchema
  .omit({ id: true })
  .partial({ config: true })
  .extend({ name: z.string().min(1) })
export type RegistrationFormCreate = z.infer<typeof registrationFormCreateSchema>

export const registrationFormPatchSchema = registrationFormCreateSchema.partial()
export type RegistrationFormPatch = z.infer<typeof registrationFormPatchSchema>

// A connection between a form and something it registers into — a code (whole
// programme) or a group (one class); `targetType` is open text (events etc. later),
// validated as a string at the boundary, not a DB CHECK.
export const registrationFormTargetSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  formId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  sortOrder: z.number().int(),
})
export type RegistrationFormTarget = z.infer<typeof registrationFormTargetSchema>

export const registrationFormTargetListSchema = z.array(registrationFormTargetSchema)

// A single submission of a registration form, in ANY context (event/group/…). The
// uniform record every submission writes, whatever else it materialises. `answers`
// is the full normalised payload; the decimals are money.
export const formSubmissionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  formId: z.string().nullable(),
  contextType: z.string(),
  contextId: z.string().nullable(),
  status: z.string(),
  submitterName: z.string().nullable(),
  submitterEmail: z.string().nullable(),
  submitterPhone: z.string().nullable(),
  // json object → plain object at the boundary; passthrough.
  answers: z.record(z.string(), z.any()),
  // decimal columns arrive as string (mysql2) or number; either is accepted, the
  // caller formats. Not nullable — the DB defaults them to 0.
  totalAmount: z.union([z.string(), z.number()]),
  discountTotal: z.union([z.string(), z.number()]),
  registrationId: z.string().nullable(),
  // ISO 8601 — the transport form. The DB stores a timestamp; the repo serialises.
  createdAt: z.string(),
})
export type FormSubmission = z.infer<typeof formSubmissionSchema>

export const formSubmissionListSchema = z.array(formSubmissionSchema)
