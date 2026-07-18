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
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  FormField,
  FormFieldInput,
  FormSubmission,
  FormUsageMap,
  RegistrationForm,
  RegistrationFormTarget,
  RegistrationFormCreate,
  RegistrationFormPatch,
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

// Coerce a json column into a plain array: already an array → use it; a string →
// parse (tolerating the legacy double-encoded value migrated from Supabase); anything
// else / a parse failure → []. Never throws.
function asArray(v: unknown): any[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
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

function toField(r: typeof schema.formFields.$inferSelect): FormField {
  // options / conditions are json columns; tolerate a raw array, a legacy encoded
  // string, or null. A field with no options stays null (a select with none → []).
  return {
    id: r.id,
    formId: r.formId,
    fieldType: r.fieldType,
    label: r.label,
    placeholder: r.placeholder ?? null,
    helpText: r.helpText ?? null,
    isRequired: !!r.isRequired,
    isEventOnly: !!r.isEventOnly,
    options: r.options == null ? null : asArray(r.options).map((x) => String(x)),
    conditions: r.conditions == null ? null : asArray(r.conditions),
    pageNumber: r.pageNumber,
    sortOrder: r.sortOrder,
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

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). `config` is passed as a PLAIN
// JS object — drizzle's json() serialises it; DON'T JSON.stringify first or it
// stores a double-encoded string. `as any` mirrors the app's insert idiom (the
// first-pass schema over-requires notNull columns the DB defaults, e.g. is_template).
export async function createForm(input: RegistrationFormCreate): Promise<RegistrationForm> {
  const id = randomUUID()
  await db.insert(schema.registrationForms).values({
    id,
    orgId: input.orgId,
    name: input.name,
    isTemplate: false,
    config: input.config ?? {},
  } as any)
  return (await getForm(id))!
}

export async function updateForm(id: string, patch: RegistrationFormPatch): Promise<RegistrationForm | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.config !== undefined) set.config = patch.config
  if (Object.keys(set).length) await db.update(schema.registrationForms).set(set).where(eq(schema.registrationForms.id, id))
  return getForm(id)
}

export async function deleteForm(id: string): Promise<void> {
  await db.delete(schema.registrationForms).where(eq(schema.registrationForms.id, id))
}

// ── Form fields (legacy <FormBuilder> shape) ──
/** The ordered fields of one form (sort_order asc). Empty for designer-shaped forms. */
export async function listFields(formId: string): Promise<FormField[]> {
  const rows = await db
    .select()
    .from(schema.formFields)
    .where(eq(schema.formFields.formId, formId))
    .orderBy(asc(schema.formFields.sortOrder))
  return rows.map(toField)
}

/**
 * Replace the whole field set of a form (delete-then-insert), the same idempotent
 * shape the UI used against Supabase. Options/conditions are PLAIN arrays — drizzle's
 * json() serialises them; don't JSON.stringify first or they double-encode.
 */
export async function saveFields(formId: string, fields: FormFieldInput[]): Promise<void> {
  await db.delete(schema.formFields).where(eq(schema.formFields.formId, formId))
  if (!fields.length) return
  const rows = fields.map((f, idx) => ({
    id: randomUUID(),
    formId,
    fieldType: f.fieldType,
    label: f.label,
    placeholder: f.placeholder ?? null,
    helpText: f.helpText ?? null,
    isRequired: !!f.isRequired,
    isEventOnly: !!f.isEventOnly,
    options: f.options ?? null,
    conditions: f.conditions ?? null,
    pageNumber: f.pageNumber ?? 1,
    sortOrder: f.sortOrder ?? idx,
  }))
  await db.insert(schema.formFields).values(rows as any)
}

// ── Form connections (registration_form_targets) ──
/**
 * Replace the whole connection set of a form (delete-then-insert). Every row is
 * org-stamped. `orgId` is required — a target is a (form, org, type, id) tuple.
 */
export async function saveTargets(
  formId: string,
  orgId: string,
  targets: { targetType: string; targetId: string; sortOrder: number }[],
): Promise<void> {
  await db.delete(schema.registrationFormTargets).where(eq(schema.registrationFormTargets.formId, formId))
  if (!targets.length) return
  const rows = targets.map((t) => ({
    id: randomUUID(),
    orgId,
    formId,
    targetType: t.targetType,
    targetId: t.targetId,
    sortOrder: t.sortOrder,
  }))
  await db.insert(schema.registrationFormTargets).values(rows as any)
}

// ── Usage tallies for the Forms list ──
/**
 * Per-form counts for an org's forms: form_fields (fieldCount), events + booking
 * modes + classes linking to it (usageCount), and registration_form_targets
 * (targetCount). One aggregation over the tables that reference a form by id, scoped
 * to THIS org's form ids so nothing cross-tenant is ever counted.
 */
export async function usageCounts(orgId: string): Promise<FormUsageMap> {
  const formRows = await db
    .select({ id: schema.registrationForms.id })
    .from(schema.registrationForms)
    .where(eq(schema.registrationForms.orgId, orgId))
  const ids = formRows.map((f) => f.id)
  const out: FormUsageMap = {}
  for (const id of ids) out[id] = { fieldCount: 0, usageCount: 0, targetCount: 0 }
  if (!ids.length) return out

  const [fields, modes, events, groups, targets] = await Promise.all([
    db.select({ formId: schema.formFields.formId }).from(schema.formFields).where(inArray(schema.formFields.formId, ids)),
    db.select({ formId: schema.activityModes.formId }).from(schema.activityModes).where(inArray(schema.activityModes.formId, ids)),
    db.select({ formId: schema.events.formId }).from(schema.events).where(inArray(schema.events.formId, ids)),
    db.select({ formId: schema.memberGroups.formId }).from(schema.memberGroups).where(inArray(schema.memberGroups.formId, ids)),
    db.select({ formId: schema.registrationFormTargets.formId }).from(schema.registrationFormTargets).where(inArray(schema.registrationFormTargets.formId, ids)),
  ])
  for (const r of fields) if (r.formId && out[r.formId]) out[r.formId].fieldCount++
  for (const r of [...modes, ...events, ...groups]) if (r.formId && out[r.formId]) out[r.formId].usageCount++
  for (const r of targets) if (r.formId && out[r.formId]) out[r.formId].targetCount++
  return out
}

/**
 * Delete a form and detach everything pointing at it: null the form_id on the
 * events / booking modes / classes that use it (their public pages fall back to "no
 * form set up"), remove its fields + connections, then the form itself. Org-scoped
 * on the final delete so a form can never be removed cross-tenant. Bulk-by-form_id
 * updates that per-id composables can't express, which is why the cascade lives in
 * the forms repo rather than the owning domains.
 */
export async function deleteFormAndDetach(id: string, orgId: string): Promise<void> {
  await Promise.all([
    db.update(schema.events).set({ formId: null } as any).where(eq(schema.events.formId, id)),
    db.update(schema.activityModes).set({ formId: null } as any).where(eq(schema.activityModes.formId, id)),
    db.update(schema.memberGroups).set({ formId: null } as any).where(eq(schema.memberGroups.formId, id)),
    db.delete(schema.formFields).where(eq(schema.formFields.formId, id)),
    db.delete(schema.registrationFormTargets).where(eq(schema.registrationFormTargets.formId, id)),
  ])
  await db.delete(schema.registrationForms).where(and(eq(schema.registrationForms.id, id), eq(schema.registrationForms.orgId, orgId)))
}
