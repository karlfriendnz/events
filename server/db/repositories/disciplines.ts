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
import { asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type { Discipline, DisciplineRequirement } from '../../../shared/contracts/discipline'

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
