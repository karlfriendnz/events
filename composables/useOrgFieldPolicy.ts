// Field engine — resolves an org's effective field definitions: its own plus
// those inherited from its governing bodies (ancestors). Field definitions are
// first-class (field_definitions table), created separately from any form.

export interface FieldDef {
  id: string
  org_id: string
  label: string
  field_type: string
  is_required: boolean
  options: string[]
  help_text: string | null
  key: string | null
  meta: Record<string, any>
  sort_order: number
  target: string
  targets?: string[]
  rules: any[]
  inherited: boolean
  ownerName: string
  ownerLevel: string
}

/** A type → the type it answers to, one hop up (migration 272). May be a club's
 *  link to a body's published type, OR a body's own link to the body above it —
 *  the chain is walked transitively, so both live in one set. */
export interface PersonTypeLink {
  id: string
  type_id: string
  source_type_id: string
  /** The source's key — what its fields actually target. */
  source_key: string
  source_label: string
  /** The org that owns source_type_id. */
  source_org_id: string
  source_org_name: string
}

/**
 * Expand a club's person-type keys to every key their fields could be targeted by:
 * the club's own keys PLUS the keys of the types they're linked to, FOLLOWED
 * THROUGH.
 *
 * PURE, and the whole point of migration 272. Every consumer already maps over a
 * LIST of person-type keys (fieldAppliesTo, requirementApplies, the profile's
 * customFields filter), so widening the list is all that's needed — the club can
 * call them "Footballer" and still receive fields targeting Football's 'player'.
 *
 * TRANSITIVE, because the hierarchy is: a Regional body has its own people, AND
 * publishes standards to its clubs, AND is itself under a National. So the real
 * shape is three deep —
 *
 *     club "Member" → Auckland's "Player" → Football NZ's "Player"
 *
 * — and stopping at one hop meant Football NZ's fields reached the club only by
 * COINCIDENCE, if both bodies happened to spell the key the same. Auckland saying
 * "Player" while Football NZ says "Athlete" and the fields vanish silently: the
 * exact bug 272 exists to kill, one level up. Cycle-safe (nothing in the schema
 * stops A→B→A).
 *
 * `links` may be the whole world — the walk starts from `startTypeIds` and only
 * follows links out of types it has reached, so a body's fields can never leak
 * onto a type that never answered to it.
 */
export function expandTypeKeys(
  ownKeys: string[],
  links: PersonTypeLink[],
  startTypeIds: string[] = [],
): string[] {
  const out = new Map<string, string>()   // lowercased → first-seen original casing
  const add = (k: string) => { const lc = (k || '').toLowerCase(); if (lc && !out.has(lc)) out.set(lc, k) }
  for (const k of ownKeys ?? []) add(k)

  // Index links by the type they hang off, so the walk is O(links) not O(n²).
  const byType = new Map<string, PersonTypeLink[]>()
  for (const l of links ?? []) {
    if (!byType.has(l.type_id)) byType.set(l.type_id, [])
    byType.get(l.type_id)!.push(l)
  }
  const seen = new Set<string>(startTypeIds ?? [])
  const queue = [...(startTypeIds ?? [])]
  let guard = 0
  while (queue.length && guard++ < 200) {
    const id = queue.shift()!
    for (const l of byType.get(id) ?? []) {
      add(l.source_key)
      if (!seen.has(l.source_type_id)) { seen.add(l.source_type_id); queue.push(l.source_type_id) }
    }
  }
  return [...out.values()]
}

/**
 * The CLUB's types that answer to a governing body's cast (migs 272 + 276).
 *
 * The body names its own keys ("Juniors involves player, coach"); the club calls
 * them whatever it likes. This crosses the gap: a club type is in the cast if its
 * chain intersects it. Reuses expandTypeKeys, so it's TRANSITIVE for free — a club
 * Member linked to Auckland's Player, whose Player links to Football NZ's, still
 * answers a cast written by Football NZ.
 *
 * Empty cast → empty result, NOT "everything". The caller falls back to its own
 * behaviour; a discipline that says nothing must not silently redefine the club's
 * add-person flow.
 */
export function clubTypesForCast<T extends { id: string; key: string }>(
  cast: string[],
  clubTypes: T[],
  links: PersonTypeLink[],
): T[] {
  if (!cast?.length) return []
  const want = new Set(cast.map(k => (k || '').toLowerCase()))
  return (clubTypes ?? []).filter(t => {
    const chain = expandTypeKeys([t.key], links ?? [], [t.id])
    return chain.some(k => want.has((k || '').toLowerCase()))
  })
}

/** The links belonging to a set of types (one hop). */
export function linksForTypes(links: PersonTypeLink[], typeIds: string[]): PersonTypeLink[] {
  const ids = new Set(typeIds ?? [])
  return (links ?? []).filter(l => ids.has(l.type_id))
}

/**
 * A person's own type keys → the full chain, given the club's types + links.
 * `links` should be everything loadTypeLinks returned (club's + the bodies' own),
 * so the walk can follow Auckland's Player up to Football NZ's.
 */
export function chainForPersonTypes(
  personTypeKeys: string[],
  clubTypes: { id: string; key: string }[],
  links: PersonTypeLink[],
): string[] {
  const lc = (s: string) => (s || '').toLowerCase()
  const held = new Set((personTypeKeys ?? []).map(lc))
  const ids = (clubTypes ?? []).filter(t => held.has(lc(t.key))).map(t => t.id)
  return expandTypeKeys(personTypeKeys ?? [], links ?? [], ids)
}

export function useOrgFieldPolicy() {
  // Data access goes through the seam (usePersonTypesApi); this composable only maps
  // the seam's camelCase contract back to the snake_case shapes the pages read, and
  // stitches in the org-hierarchy walk.
  const api = usePersonTypesApi()
  // Ancestors come from the seam (orgs.ancestors, MySQL-backed). governingOrgs (parent
  // chain ∪ every connected sport's chain) has no seam function yet — CROSS-DOMAIN
  // GAP — so it's still resolved by useOrgHierarchy (RPC) until the org/affiliations
  // domain exposes a governingOrgs seam. No useDb lives in this file.
  const { ancestors } = useOrganisationsApi()
  const { governingOrgs } = useOrgHierarchy()

  // Seam ResolvedField → the snake_case FieldDef shape the pages/components consume.
  function toFieldDef(r: any): FieldDef {
    return {
      id: r.id,
      org_id: r.orgId,
      label: r.label,
      field_type: r.fieldType,
      is_required: !!r.isRequired,
      options: Array.isArray(r.options) ? r.options : [],
      help_text: r.helpText ?? null,
      key: r.key ?? null,
      meta: r.meta && typeof r.meta === 'object' ? r.meta : {},
      sort_order: r.sortOrder,
      target: r.target,
      targets: Array.isArray(r.targets) ? r.targets : [],
      rules: Array.isArray(r.rules) ? r.rules : [],
      inherited: !!r.inherited,
      ownerName: r.ownerName ?? '',
      ownerLevel: r.ownerLevel ?? '',
    }
  }

  /**
   * Every person-type link in this org's world: its OWN links, PLUS the links its
   * governing bodies made upward. Hydrated with the source's key/label/org.
   *
   * The bodies' links are what make resolution transitive. A Regional publishes
   * "Player" to its clubs AND links that Player up to the National's — so
   * `club Member → Auckland Player → Football NZ Player` only resolves if
   * Auckland's own link is in the set. Loading just `.eq('org_id', orgId)` stops
   * at one hop and the National's fields reach the club by coincidence of
   * spelling or not at all.
   *
   * `source_key` is the payload that matters — a field targets a KEY string, so
   * that's what resolution needs. Links whose source org is outside this org's
   * governing chain are DROPPED: disconnecting a sport (or having an affiliation
   * revoked) must stop its fields, and a stale link would otherwise keep a body's
   * fields flowing forever.
   */
  async function loadTypeLinks(orgId: string): Promise<PersonTypeLink[]> {
    const gov = await governingOrgs(orgId)
    const reachable = [orgId, ...gov.map(g => g.id)]
    const rows = await api.typeLinksHydrated(reachable)
    return rows.map(l => ({
      id: l.id,
      type_id: l.typeId,
      source_type_id: l.sourceTypeId,
      source_key: l.sourceKey,
      source_label: l.sourceLabel,
      source_org_id: l.sourceOrgId,
      source_org_name: l.sourceOrgName,
    }))
  }

  /**
   * The person types an org may link to: the types its governing bodies have
   * PUBLISHED (mig 275). Only published ones — a body's own Admin/Club-manager
   * types are its internal staff, and offering a club "link your Member to
   * Football's Admin" is nonsense. This is the ONLY list the linker should offer:
   * a link to an unreachable body is ignored at resolution, so offering one would
   * be a lie.
   */
  async function loadLinkableTypes(orgId: string) {
    const gov = await governingOrgs(orgId)
    if (!gov.length) return []
    const rows = await api.linkableTypes(gov.map(g => g.id))
    return rows.map(t => ({
      id: t.id, org_id: t.orgId, key: t.key, label: t.label, kind: t.kind ?? 'person', ownerName: t.ownerName ?? '',
    }))
  }

  async function linkType(orgId: string, typeId: string, sourceTypeId: string) {
    // Idempotent server-side (unique(type_id, source_type_id)) — safe to re-run
    // during connect-a-sport reconciliation.
    return await api.linkType(orgId, typeId, sourceTypeId)
  }

  async function unlinkType(linkId: string) {
    return await api.unlinkType(linkId)
  }

  /**
   * Own + inherited field definitions for an org.
   *
   * Inherits from EVERY governing body — the parent_id chain and each connected
   * sport's chain. A club affiliated to four bodies (tennis/badminton/squash/
   * pickleball) has only one parent_id, so walking parents alone would surface
   * the primary sport's fields and silently hide the other three.
   */
  async function resolveFields(orgId: string): Promise<FieldDef[]> {
    const gov = await governingOrgs(orgId)
    const ids = [orgId, ...gov.map(a => a.id)]
    const rows = await api.resolveFields(ids, orgId)
    return rows.map(toFieldDef)
  }

  /** Own + inherited person types (Member / Guardian / Coach / …) with min/max. */
  async function resolvePersonTypes(orgId: string) {
    const anc = await ancestors(orgId)
    const ids = [orgId, ...anc.map(a => a.id)]
    const rows = await api.resolvePersonTypes(ids, orgId)
    return rows.map(t => ({
      id: t.id, org_id: t.orgId, key: t.key, label: t.label, kind: t.kind ?? 'person',
      min_count: t.minCount, max_count: t.maxCount, sort_order: t.sortOrder,
      is_access: !!t.isAccess, inherited: !!t.inherited, ownerName: t.ownerName ?? '',
    }))
  }

  /** A club's OWN person/entity types only (no inheritance) — the single source
   *  the /proto/* prototype uses, so there's no duplicate/two-concept confusion. */
  async function loadOrgTypes(orgId: string) {
    const rows = await api.listOrgTypes(orgId)
    return rows.map(t => ({
      id: t.id, org_id: t.orgId, key: t.key, label: t.label, kind: t.kind ?? 'person',
      is_access: !!t.isAccess, is_published: !!t.isPublished, permissions: t.permissions ?? {},
      member_slots: t.memberSlots ?? [], sort_order: t.sortOrder, landing_path: t.landingPath,
      profile_dashboard: t.profileDashboard, menu_items: t.menuItems, inherited: false, ownerName: '',
    }))
  }

  /** Does a field definition apply to the given person-type key?
   *  Uses targets[] (multi-type); falls back to the legacy single `target`. */
  function fieldAppliesTo(f: any, key: string): boolean {
    const lc = (s: string) => (s || '').toLowerCase()
    const list = (Array.isArray(f.targets) && f.targets.length ? f.targets : [f.target || 'member']).map(lc)
    return list.includes(lc(key))
  }

  return {
    resolveFields, resolvePersonTypes, loadOrgTypes, fieldAppliesTo,
    loadTypeLinks, loadLinkableTypes, linkType, unlinkType,
  }
}
