// The repository: the ONLY code that knows how disciplines are stored. It turns DB
// rows into domain objects (the contract shape) and back. Nitro routes call these
// functions; they never touch Drizzle or the DB directly. When the backend team's
// MySQL API replaces this, only this file changes — routes, composables and UI are
// untouched.
//
// json handling: applies_to / person_type_keys / a requirement's value are `json`
// columns. mysql2 usually hands them back already parsed, but a driver/config can
// return the raw string — `asArray` normalises either into a string[] (and never
// throws), so the domain always sees a real JS array.
import { randomUUID } from 'node:crypto'
import { asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Discipline,
  DisciplineRequirement,
  DisciplineCreate,
  DisciplinePatch,
  DisciplineRequirementCreate,
} from '../../../shared/contracts/discipline'

// Coerce a json column into string[]: already an array → use it; a string → parse;
// anything else / a parse failure → [].
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return []
}

// Coerce a json column into its parsed value, leaving non-string payloads as-is.
function asJson(v: unknown): any {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  return v ?? null
}

function toDiscipline(r: typeof schema.disciplines.$inferSelect): Discipline {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    sport: r.sport ?? null,
    code: r.code ?? null,
    parentId: r.parentId ?? null,
    sortOrder: r.sortOrder,
    appliesTo: asArray(r.appliesTo),
    personTypeKeys: asArray(r.personTypeKeys),
  }
}

function toRequirement(r: typeof schema.disciplineRequirements.$inferSelect): DisciplineRequirement {
  return {
    id: r.id,
    disciplineId: r.disciplineId,
    fieldColumn: r.fieldColumn ?? null,
    fieldDefinitionId: r.fieldDefinitionId ?? null,
    fieldKey: r.fieldKey ?? null,
    purpose: r.purpose,
    operator: r.operator,
    value: asJson(r.value),
    exempt: r.exempt,
    appliesTo: asArray(r.appliesTo),
    message: r.message ?? null,
    sortOrder: r.sortOrder,
  }
}

/** Every discipline an org has defined, in author order. */
export async function listDisciplines(orgId: string): Promise<Discipline[]> {
  const rows = await db
    .select()
    .from(schema.disciplines)
    .where(eq(schema.disciplines.orgId, orgId))
    .orderBy(asc(schema.disciplines.sortOrder))
  return rows.map(toDiscipline)
}

/**
 * Every discipline owned by a SET of orgs — the requirement engine needs a
 * discipline's whole ancestor chain, and those ancestors may be owned by different
 * governing bodies. UNFILTERED by anything but org (the chain walk is pure, on the
 * client). Empty in → empty out.
 */
export async function listDisciplinesForOrgs(orgIds: string[]): Promise<Discipline[]> {
  if (!orgIds.length) return []
  const rows = await db
    .select()
    .from(schema.disciplines)
    .where(inArray(schema.disciplines.orgId, orgIds))
    .orderBy(asc(schema.disciplines.sortOrder), asc(schema.disciplines.name))
  return rows.map(toDiscipline)
}

/** The requirements for a set of disciplines, in author order. Empty in → empty out. */
export async function listRequirements(disciplineIds: string[]): Promise<DisciplineRequirement[]> {
  if (disciplineIds.length === 0) return []
  const rows = await db
    .select()
    .from(schema.disciplineRequirements)
    .where(inArray(schema.disciplineRequirements.disciplineId, disciplineIds))
    .orderBy(asc(schema.disciplineRequirements.sortOrder))
  return rows.map(toRequirement)
}

/** The disciplines linked to one member group (join `member_group_disciplines`). */
export async function listGroupDisciplines(groupId: string): Promise<Discipline[]> {
  const rows = await db
    .select({ d: schema.disciplines })
    .from(schema.memberGroupDisciplines)
    .innerJoin(
      schema.disciplines,
      eq(schema.memberGroupDisciplines.disciplineId, schema.disciplines.id),
    )
    .where(eq(schema.memberGroupDisciplines.groupId, groupId))
    .orderBy(asc(schema.disciplines.sortOrder))
  return rows.map((r) => toDiscipline(r.d))
}

/** The disciplines linked to one event (join `event_disciplines`). */
export async function listEventDisciplines(eventId: string): Promise<Discipline[]> {
  const rows = await db
    .select({ d: schema.disciplines })
    .from(schema.eventDisciplines)
    .innerJoin(schema.disciplines, eq(schema.eventDisciplines.disciplineId, schema.disciplines.id))
    .where(eq(schema.eventDisciplines.eventId, eventId))
    .orderBy(asc(schema.disciplines.sortOrder))
  return rows.map((r) => toDiscipline(r.d))
}

/** One discipline by id, or null. */
export async function getDiscipline(id: string): Promise<Discipline | null> {
  const [r] = await db.select().from(schema.disciplines).where(eq(schema.disciplines.id, id)).limit(1)
  return r ? toDiscipline(r) : null
}

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). The json array columns
// (applies_to / person_type_keys) are passed as PLAIN JS ARRAYS — drizzle's json()
// serialises them to a real JSON array; DON'T JSON.stringify first or it stores a
// double-encoded string. `as any` mirrors the app's insert idiom (the first-pass
// schema over-requires notNull columns the DB defaults).
export async function createDiscipline(input: DisciplineCreate): Promise<Discipline> {
  const id = randomUUID()
  await db.insert(schema.disciplines).values({
    id,
    orgId: input.orgId,
    name: input.name,
    sport: input.sport ?? null,
    code: input.code ?? null,
    parentId: input.parentId ?? null,
    sortOrder: input.sortOrder ?? 0,
    appliesTo: input.appliesTo ?? [],
    personTypeKeys: input.personTypeKeys ?? [],
  } as any)
  return (await getDiscipline(id))!
}

export async function updateDiscipline(id: string, patch: DisciplinePatch): Promise<Discipline | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.sport !== undefined) set.sport = patch.sport
  if (patch.code !== undefined) set.code = patch.code
  if (patch.parentId !== undefined) set.parentId = patch.parentId
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.appliesTo !== undefined) set.appliesTo = patch.appliesTo
  if (patch.personTypeKeys !== undefined) set.personTypeKeys = patch.personTypeKeys
  if (Object.keys(set).length) await db.update(schema.disciplines).set(set).where(eq(schema.disciplines.id, id))
  return getDiscipline(id)
}

export async function deleteDiscipline(id: string): Promise<void> {
  await db.delete(schema.disciplines).where(eq(schema.disciplines.id, id))
}

/**
 * Replace the whole requirement set for one discipline — delete-then-insert,
 * mirroring the app's `saveRequirements` pattern. json columns (value / applies_to)
 * are passed as plain JS values; drizzle serialises them.
 */
export async function saveRequirements(
  disciplineId: string,
  rows: DisciplineRequirementCreate[],
): Promise<DisciplineRequirement[]> {
  await db.delete(schema.disciplineRequirements).where(eq(schema.disciplineRequirements.disciplineId, disciplineId))
  if (rows.length) {
    await db.insert(schema.disciplineRequirements).values(
      rows.map((r, i) => ({
        id: randomUUID(),
        disciplineId,
        fieldColumn: r.fieldColumn ?? null,
        fieldDefinitionId: r.fieldDefinitionId ?? null,
        fieldKey: r.fieldKey ?? null,
        purpose: r.purpose,
        operator: r.operator,
        value: r.value ?? null,
        exempt: r.exempt ?? false,
        appliesTo: r.appliesTo ?? [],
        message: r.message ?? null,
        sortOrder: r.sortOrder ?? i,
      })) as any,
    )
  }
  return listRequirements([disciplineId])
}

/** Delete a single requirement row by id. */
export async function deleteRequirement(id: string): Promise<void> {
  await db.delete(schema.disciplineRequirements).where(eq(schema.disciplineRequirements.id, id))
}
