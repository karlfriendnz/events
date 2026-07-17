// The repository: the ONLY code that knows how registration forms, their targets and
// their submissions are stored. It turns DB rows into domain objects (the contract
// shape) and back. Nitro routes call these functions; they never touch Drizzle or the
// DB directly. When the backend team's MySQL API replaces this, only this file
// changes — routes, composables and UI are untouched.
//
// json handling: a form's `config` and a submission's `answers` are `json` columns.
// mysql2 usually hands them back already parsed, but a driver/config can return the
// raw string — `asObj` normalises either into a plain object (and never throws), so
// the domain always sees a real JS object.
import { and, asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  FormSubmission,
  RegistrationForm,
  RegistrationFormTarget,
} from '../../../shared/contracts/form'

// Coerce a json column into a plain object: already an object → use it; a string →
// parse; anything else / a parse failure → {}.
function asObj(v: unknown): Record<string, any> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

// A timestamp column arrives as a Date (mysql2) or a string; normalise to ISO 8601,
// the transport form the contract promises.
function toIso(v: unknown): string {
  const d = v instanceof Date ? v : new Date(v as any)
  return d.toISOString()
}

function toForm(r: typeof schema.registrationForms.$inferSelect): RegistrationForm {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    config: asObj(r.config),
  }
}

function toTarget(r: typeof schema.registrationFormTargets.$inferSelect): RegistrationFormTarget {
  return {
    id: r.id,
    orgId: r.orgId,
    formId: r.formId,
    targetType: r.targetType,
    targetId: r.targetId,
    sortOrder: r.sortOrder,
  }
}

function toSubmission(r: typeof schema.formSubmissions.$inferSelect): FormSubmission {
  return {
    id: r.id,
    orgId: r.orgId,
    formId: r.formId ?? null,
    contextType: r.contextType,
    contextId: r.contextId ?? null,
    status: r.status,
    submitterName: r.submitterName ?? null,
    submitterEmail: r.submitterEmail ?? null,
    submitterPhone: r.submitterPhone ?? null,
    answers: asObj(r.answers),
    // decimals: mysql2 returns a string, pass it through unchanged (the contract
    // accepts string|number so no precision is lost to a float).
    totalAmount: r.totalAmount,
    discountTotal: r.discountTotal,
    registrationId: r.registrationId ?? null,
    createdAt: toIso(r.createdAt),
  }
}

/** Every registration form an org has, newest first. */
export async function listForms(orgId: string): Promise<RegistrationForm[]> {
  const rows = await db
    .select()
    .from(schema.registrationForms)
    .where(eq(schema.registrationForms.orgId, orgId))
    .orderBy(desc(schema.registrationForms.createdAt))
  return rows.map(toForm)
}

/** One registration form by id, or null when it doesn't exist. */
export async function getForm(id: string): Promise<RegistrationForm | null> {
  const [r] = await db
    .select()
    .from(schema.registrationForms)
    .where(eq(schema.registrationForms.id, id))
    .limit(1)
  return r ? toForm(r) : null
}

/** The connections of one form (codes / groups it registers into), in author order. */
export async function listTargets(formId: string): Promise<RegistrationFormTarget[]> {
  const rows = await db
    .select()
    .from(schema.registrationFormTargets)
    .where(eq(schema.registrationFormTargets.formId, formId))
    .orderBy(asc(schema.registrationFormTargets.sortOrder))
  return rows.map(toTarget)
}

/**
 * Submissions for an org, newest first. Optionally narrowed to one form and/or
 * paged with limit/offset (both applied only when given).
 */
export async function listSubmissions(
  orgId: string,
  opts: { limit?: number; offset?: number; formId?: string } = {},
): Promise<FormSubmission[]> {
  const where = opts.formId
    ? and(eq(schema.formSubmissions.orgId, orgId), eq(schema.formSubmissions.formId, opts.formId))
    : eq(schema.formSubmissions.orgId, orgId)

  let q = db
    .select()
    .from(schema.formSubmissions)
    .where(where)
    .orderBy(desc(schema.formSubmissions.createdAt))
    .$dynamic()

  if (opts.limit !== undefined) q = q.limit(opts.limit)
  if (opts.offset !== undefined) q = q.offset(opts.offset)

  const rows = await q
  return rows.map(toSubmission)
}
