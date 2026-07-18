// The repository: the ONLY code that knows how person types & fields are stored.
// It turns DB rows into domain objects (the contract shape) and back. Nitro routes
// call these functions; they never touch Drizzle or the DB directly. When the
// backend team's MySQL API replaces this, only this file changes — routes,
// composables and UI are untouched.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  PersonType,
  PersonTypeCreate,
  PersonTypePatch,
  FieldDefinition,
  FieldDefinitionCreate,
  FieldDefinitionPatch,
  PersonTypeLink,
  ResolvedField,
  ResolvedPersonType,
  OrgTypeFull,
  LinkableType,
  HydratedTypeLink,
  TypeByKey,
  ProfileForm,
  CoreFieldsConfig,
  TerminologyMap,
} from '../../../shared/contracts/personType'

// json columns come back parsed (object/array) from mysql2 in most cases, but can
// arrive as a JSON string. Normalise both robustly — never throw on bad json.
function asArray(v: any): any[] {
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

function asObj(v: any): Record<string, any> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v
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

function typeToDomain(r: typeof schema.personTargetTypes.$inferSelect): PersonType {
  return {
    id: r.id,
    orgId: r.orgId ?? null,
    key: r.key,
    label: r.label,
    kind: r.kind,
    isAccess: !!r.isAccess,
    isPublished: !!r.isPublished,
    permissions: asObj(r.permissions),
    memberSlots: asArray(r.memberSlots),
    sortOrder: r.sortOrder,
  }
}

function fieldToDomain(r: typeof schema.fieldDefinitions.$inferSelect): FieldDefinition {
  // options is nullable in storage — keep null distinct from an empty list.
  const options = r.options == null ? null : asArray(r.options)
  return {
    id: r.id,
    orgId: r.orgId,
    label: r.label,
    key: r.key ?? null,
    fieldType: r.fieldType,
    options,
    isRequired: !!r.isRequired,
    helpText: r.helpText ?? null,
    target: r.target,
    targets: asArray(r.targets).map((t) => String(t)),
    meta: asObj(r.meta),
    rules: asArray(r.rules),
    sortOrder: r.sortOrder,
  }
}

function linkToDomain(r: typeof schema.personTypeLinks.$inferSelect): PersonTypeLink {
  return {
    id: r.id,
    orgId: r.orgId,
    typeId: r.typeId,
    sourceTypeId: r.sourceTypeId,
  }
}

export async function listPersonTypes(orgId: string): Promise<PersonType[]> {
  const rows = await db
    .select()
    .from(schema.personTargetTypes)
    .where(eq(schema.personTargetTypes.orgId, orgId))
    .orderBy(asc(schema.personTargetTypes.sortOrder))
  return rows.map(typeToDomain)
}

export async function listFieldDefinitions(orgId: string): Promise<FieldDefinition[]> {
  const rows = await db
    .select()
    .from(schema.fieldDefinitions)
    .where(eq(schema.fieldDefinitions.orgId, orgId))
    .orderBy(asc(schema.fieldDefinitions.sortOrder))
  return rows.map(fieldToDomain)
}

export async function listPersonTypeLinks(orgId: string): Promise<PersonTypeLink[]> {
  const rows = await db
    .select()
    .from(schema.personTypeLinks)
    .where(eq(schema.personTypeLinks.orgId, orgId))
  return rows.map(linkToDomain)
}

// ── Person-type writes ──
// The repo owns the id. json columns (permissions, memberSlots) are JSON.stringify'd
// on the way IN, mirroring asObj/asArray on the way OUT. `as any`: the schema
// over-requires notNull columns without defaults AND the json columns take a
// stringified value here — matches the app's (db.from as any) idiom.
export async function getPersonType(id: string): Promise<PersonType | null> {
  const [r] = await db
    .select()
    .from(schema.personTargetTypes)
    .where(eq(schema.personTargetTypes.id, id))
    .limit(1)
  return r ? typeToDomain(r) : null
}

export async function createPersonType(input: PersonTypeCreate): Promise<PersonType> {
  const id = randomUUID()
  await db.insert(schema.personTargetTypes).values({
    id,
    orgId: input.orgId ?? null,
    key: input.key,
    label: input.label,
    kind: input.kind ?? 'person',
    isAccess: input.isAccess ?? false,
    isPublished: input.isPublished ?? false,
    permissions: input.permissions ?? {},
    memberSlots: input.memberSlots ?? [],
    sortOrder: input.sortOrder ?? 0,
    // notNull columns absent from the contract — supplied with sensible defaults.
    minCount: 0,
    isGlobal: false,
  } as any)
  return (await getPersonType(id))!
}

export async function updatePersonType(id: string, patch: PersonTypePatch): Promise<PersonType | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.key !== undefined) set.key = patch.key
  if (patch.label !== undefined) set.label = patch.label
  if (patch.kind !== undefined) set.kind = patch.kind
  if (patch.isAccess !== undefined) set.isAccess = patch.isAccess
  if (patch.isPublished !== undefined) set.isPublished = patch.isPublished
  if (patch.permissions !== undefined) set.permissions = patch.permissions
  if (patch.memberSlots !== undefined) set.memberSlots = patch.memberSlots
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length)
    await db.update(schema.personTargetTypes).set(set).where(eq(schema.personTargetTypes.id, id))
  return getPersonType(id)
}

export async function deletePersonType(id: string): Promise<void> {
  await db.delete(schema.personTargetTypes).where(eq(schema.personTargetTypes.id, id))
}

// ── Field-definition writes ──
// Same shape: repo owns the id; options (nullable) + targets are JSON.stringify'd,
// and the notNull json columns absent from the contract (rules, meta) default empty.
export async function getFieldDefinition(id: string): Promise<FieldDefinition | null> {
  const [r] = await db
    .select()
    .from(schema.fieldDefinitions)
    .where(eq(schema.fieldDefinitions.id, id))
    .limit(1)
  return r ? fieldToDomain(r) : null
}

export async function createFieldDefinition(input: FieldDefinitionCreate): Promise<FieldDefinition> {
  const id = randomUUID()
  const targets = input.targets ?? []
  await db.insert(schema.fieldDefinitions).values({
    id,
    orgId: input.orgId,
    label: input.label,
    key: input.key ?? null,
    fieldType: input.fieldType,
    // options is nullable — keep null distinct from an empty list.
    options: input.options == null ? null : input.options,
    isRequired: input.isRequired ?? false,
    helpText: input.helpText ?? null,
    target: input.target ?? targets[0] ?? '',
    targets: targets,
    // json columns take RAW JS values (drizzle serialises); notNull, default empty.
    meta: input.meta ?? {},
    rules: input.rules ?? [],
    sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await getFieldDefinition(id))!
}

export async function updateFieldDefinition(id: string, patch: FieldDefinitionPatch): Promise<FieldDefinition | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.label !== undefined) set.label = patch.label
  if (patch.key !== undefined) set.key = patch.key
  if (patch.fieldType !== undefined) set.fieldType = patch.fieldType
  if (patch.options !== undefined) set.options = patch.options == null ? null : patch.options
  if (patch.isRequired !== undefined) set.isRequired = patch.isRequired
  if (patch.helpText !== undefined) set.helpText = patch.helpText
  if (patch.target !== undefined) set.target = patch.target
  if (patch.targets !== undefined) set.targets = patch.targets
  if (patch.meta !== undefined) set.meta = patch.meta
  if (patch.rules !== undefined) set.rules = patch.rules
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length)
    await db.update(schema.fieldDefinitions).set(set).where(eq(schema.fieldDefinitions.id, id))
  return getFieldDefinition(id)
}

export async function deleteFieldDefinition(id: string): Promise<void> {
  await db.delete(schema.fieldDefinitions).where(eq(schema.fieldDefinitions.id, id))
}

// ── Resolved views (own + inherited) ──────────────────────────────────────────
// The field ENGINE. The caller resolves WHICH orgs an org inherits from (its own
// id + its governing chain — the org-hierarchy layer owns that walk, multi-sport
// and all) and passes the id list in; this reads their fields and tags each with
// where it came from. `focusOrgId` is the org doing the looking — anything not its
// own is `inherited`. Empty list → empty out.
export async function resolveFieldsForOrgs(orgIds: string[], focusOrgId: string): Promise<ResolvedField[]> {
  if (!orgIds.length) return []
  const rows = await db
    .select({ f: schema.fieldDefinitions, orgName: schema.organisations.name, orgLevel: schema.organisations.orgLevel })
    .from(schema.fieldDefinitions)
    .leftJoin(schema.organisations, eq(schema.fieldDefinitions.orgId, schema.organisations.id))
    .where(inArray(schema.fieldDefinitions.orgId, orgIds))
    .orderBy(asc(schema.fieldDefinitions.sortOrder))
  return rows.map((r) => ({
    ...fieldToDomain(r.f),
    inherited: r.f.orgId !== focusOrgId,
    ownerName: r.orgName ?? '',
    ownerLevel: r.orgLevel ?? '',
  }))
}

// Own + inherited person types, tagged with provenance. Same contract as
// resolveFieldsForOrgs — the caller passes org + ANCESTOR ids (person types inherit
// down the parent chain, not the multi-sport governing set).
export async function resolvePersonTypesForOrgs(orgIds: string[], focusOrgId: string): Promise<ResolvedPersonType[]> {
  if (!orgIds.length) return []
  const rows = await db
    .select({ t: schema.personTargetTypes, orgName: schema.organisations.name })
    .from(schema.personTargetTypes)
    .leftJoin(schema.organisations, eq(schema.personTargetTypes.orgId, schema.organisations.id))
    .where(inArray(schema.personTargetTypes.orgId, orgIds))
    .orderBy(asc(schema.personTargetTypes.sortOrder))
  return rows.map((r) => ({
    id: r.t.id,
    orgId: r.t.orgId ?? null,
    key: r.t.key,
    label: r.t.label,
    kind: r.t.kind ?? 'person',
    minCount: r.t.minCount ?? null,
    maxCount: r.t.maxCount ?? null,
    sortOrder: r.t.sortOrder,
    isAccess: !!r.t.isAccess,
    inherited: r.t.orgId !== focusOrgId,
    ownerName: r.orgName ?? '',
  }))
}

// A club's OWN person/entity types with the FULL setup config (no inheritance) —
// the single source the setup screens use.
export async function listOrgTypesFull(orgId: string): Promise<OrgTypeFull[]> {
  const rows = await db
    .select()
    .from(schema.personTargetTypes)
    .where(eq(schema.personTargetTypes.orgId, orgId))
    .orderBy(asc(schema.personTargetTypes.sortOrder))
  return rows.map((r) => ({
    id: r.id,
    orgId: r.orgId ?? null,
    key: r.key,
    label: r.label,
    kind: r.kind ?? 'person',
    isAccess: !!r.isAccess,
    isPublished: !!r.isPublished,
    permissions: asObj(r.permissions),
    memberSlots: asArray(r.memberSlots),
    sortOrder: r.sortOrder,
    landingPath: r.landingPath ?? null,
    profileDashboard: r.profileDashboard ?? null,
    menuItems: r.menuItems ?? null,
  }))
}

// The label + member-slot roster def of the type matching a key across [org +
// ancestors], preferring the org's OWN row over an inherited one. Used by an entity
// record to source its roster role options.
export async function resolveTypeByKey(orgIds: string[], key: string): Promise<TypeByKey> {
  if (!orgIds.length) return null
  const rows = await db
    .select({ label: schema.personTargetTypes.label, memberSlots: schema.personTargetTypes.memberSlots, orgId: schema.personTargetTypes.orgId })
    .from(schema.personTargetTypes)
    .where(and(inArray(schema.personTargetTypes.orgId, orgIds), eq(schema.personTargetTypes.key, key)))
  if (!rows.length) return null
  // Prefer the org's own row (orgIds[0] is the focus org by contract).
  const own = rows.find((r) => r.orgId === orgIds[0]) ?? rows[0]
  return { label: own.label, memberSlots: asArray(own.memberSlots), orgId: own.orgId ?? null }
}

// ── Person-type links (inheritance edges, hydrated) ───────────────────────────
// Every link whose owner AND source both sit in the reachable set, hydrated with
// the source type's key/label/org — the payload resolution needs (a field targets a
// KEY). The caller passes the reachable orgs (org + its governing chain); a link
// whose source is outside that set is dropped, so a disconnected sport's fields stop
// flowing.
export async function listTypeLinksHydrated(reachableOrgIds: string[]): Promise<HydratedTypeLink[]> {
  if (!reachableOrgIds.length) return []
  const src = schema.personTargetTypes
  const rows = await db
    .select({
      id: schema.personTypeLinks.id,
      typeId: schema.personTypeLinks.typeId,
      sourceTypeId: schema.personTypeLinks.sourceTypeId,
      sourceKey: src.key,
      sourceLabel: src.label,
      sourceOrgId: src.orgId,
      sourceOrgName: schema.organisations.name,
    })
    .from(schema.personTypeLinks)
    .leftJoin(src, eq(schema.personTypeLinks.sourceTypeId, src.id))
    .leftJoin(schema.organisations, eq(src.orgId, schema.organisations.id))
    .where(inArray(schema.personTypeLinks.orgId, reachableOrgIds))
  const reach = new Set(reachableOrgIds)
  return rows
    .filter((r) => r.sourceOrgId && reach.has(r.sourceOrgId) && r.sourceKey)
    .map((r) => ({
      id: r.id,
      typeId: r.typeId,
      sourceTypeId: r.sourceTypeId,
      sourceKey: r.sourceKey ?? '',
      sourceLabel: r.sourceLabel ?? '',
      sourceOrgId: r.sourceOrgId ?? '',
      sourceOrgName: r.sourceOrgName ?? '',
    }))
}

// The PUBLISHED types of a set of governing orgs — the only types a club may link
// to. The caller passes the governing org ids.
export async function listPublishedTypesForOrgs(orgIds: string[]): Promise<LinkableType[]> {
  if (!orgIds.length) return []
  const rows = await db
    .select({ t: schema.personTargetTypes, orgName: schema.organisations.name })
    .from(schema.personTargetTypes)
    .leftJoin(schema.organisations, eq(schema.personTargetTypes.orgId, schema.organisations.id))
    .where(and(inArray(schema.personTargetTypes.orgId, orgIds), eq(schema.personTargetTypes.isPublished, true)))
    .orderBy(asc(schema.personTargetTypes.sortOrder))
  return rows.map((r) => ({
    id: r.t.id,
    orgId: r.t.orgId ?? null,
    key: r.t.key,
    label: r.t.label,
    kind: r.t.kind ?? 'person',
    ownerName: r.orgName ?? '',
  }))
}

// Idempotent link (unique(type_id, source_type_id) makes a repeat a no-op — safe to
// re-run during connect-a-sport reconciliation).
export async function linkPersonType(orgId: string, typeId: string, sourceTypeId: string): Promise<void> {
  const [existing] = await db
    .select({ id: schema.personTypeLinks.id })
    .from(schema.personTypeLinks)
    .where(and(eq(schema.personTypeLinks.typeId, typeId), eq(schema.personTypeLinks.sourceTypeId, sourceTypeId)))
    .limit(1)
  if (existing) return
  await db.insert(schema.personTypeLinks).values({ id: randomUUID(), orgId, typeId, sourceTypeId } as any)
}

export async function unlinkPersonType(linkId: string): Promise<void> {
  await db.delete(schema.personTypeLinks).where(eq(schema.personTypeLinks.id, linkId))
}

// ── Profile form layout ───────────────────────────────────────────────────────
export async function getProfileForm(orgId: string, typeKey: string): Promise<ProfileForm> {
  const [r] = await db
    .select()
    .from(schema.profileForms)
    .where(and(eq(schema.profileForms.orgId, orgId), eq(schema.profileForms.typeKey, typeKey)))
    .limit(1)
  return r ? { orgId: r.orgId, typeKey: r.typeKey, config: asObj(r.config) } : null
}

// Upsert on the (org_id, type_key) primary key. json config takes a RAW JS value.
export async function saveProfileForm(orgId: string, typeKey: string, config: Record<string, any>): Promise<void> {
  await db
    .insert(schema.profileForms)
    .values({ orgId, typeKey, config, updatedAt: new Date() } as any)
    .onDuplicateKeyUpdate({ set: { config, updatedAt: new Date() } as any })
}

// ── Org-level field settings (columns on organisations / org_sports) ──────────
export async function getCoreFields(orgId: string): Promise<CoreFieldsConfig> {
  const [r] = await db
    .select({ coreFields: schema.organisations.coreFields })
    .from(schema.organisations)
    .where(eq(schema.organisations.id, orgId))
    .limit(1)
  const c = asObj(r?.coreFields)
  return { required: asObj(c.required), enabled: asObj(c.enabled) }
}

export async function setCoreFields(orgId: string, cfg: CoreFieldsConfig): Promise<void> {
  await db.update(schema.organisations).set({ coreFields: cfg } as any).where(eq(schema.organisations.id, orgId))
}

// Terminology overrides for a set of orgs (caller passes org + ancestors). Rows
// come back in whatever order; the composable applies them furthest-first.
export async function getTerminologyForOrgs(orgIds: string[]): Promise<{ orgId: string; terminology: TerminologyMap }[]> {
  if (!orgIds.length) return []
  const rows = await db
    .select({ id: schema.organisations.id, terminology: schema.organisations.terminology })
    .from(schema.organisations)
    .where(inArray(schema.organisations.id, orgIds))
  return rows.map((r) => ({ orgId: r.id, terminology: asObj(r.terminology) as TerminologyMap }))
}

// A sport's terminology overrides — an explicit sport by id, or (sportId omitted)
// the org's PRIMARY sport. null when there's no such sport row / no overrides.
export async function getSportTerminology(orgId: string, sportId?: string | null): Promise<TerminologyMap | null> {
  const [r] = sportId
    ? await db.select({ t: schema.orgSports.terminology }).from(schema.orgSports).where(eq(schema.orgSports.id, sportId)).limit(1)
    : await db
        .select({ t: schema.orgSports.terminology })
        .from(schema.orgSports)
        .where(and(eq(schema.orgSports.orgId, orgId), eq(schema.orgSports.isPrimary, true)))
        .limit(1)
  return r?.t ? (asObj(r.t) as TerminologyMap) : null
}

export async function saveOrgTerminology(orgId: string, clean: TerminologyMap): Promise<void> {
  await db.update(schema.organisations).set({ terminology: clean } as any).where(eq(schema.organisations.id, orgId))
}

export async function saveSportTerminology(sportId: string, clean: TerminologyMap): Promise<void> {
  await db.update(schema.orgSports).set({ terminology: clean } as any).where(eq(schema.orgSports.id, sportId))
}
