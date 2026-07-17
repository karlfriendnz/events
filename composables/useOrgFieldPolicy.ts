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
  const db = useDb()
  const { ancestors, governingOrgs } = useOrgHierarchy()

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
    const reachable = new Set([orgId, ...gov.map(g => g.id)])
    const { data } = await (db.from as any)('person_type_links')
      .select('id, org_id, type_id, source_type_id, source:person_target_types!person_type_links_source_type_id_fkey(key, label, org_id, organisations(name))')
      .in('org_id', [...reachable])
    return (data ?? [])
      .filter((l: any) => l.source?.org_id && reachable.has(l.source.org_id))
      .map((l: any) => ({
        id: l.id,
        type_id: l.type_id,
        source_type_id: l.source_type_id,
        source_key: l.source?.key ?? '',
        source_label: l.source?.label ?? '',
        source_org_id: l.source?.org_id ?? '',
        source_org_name: l.source?.organisations?.name ?? '',
      }))
      .filter((l: PersonTypeLink) => l.source_key)
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
    const { data } = await (db.from as any)('person_target_types')
      .select('id, org_id, key, label, kind, organisations(name)')
      .in('org_id', gov.map(g => g.id))
      .eq('is_published', true)
      .order('sort_order')
    return (data ?? []).map((t: any) => ({
      ...t, kind: t.kind ?? 'person', ownerName: t.organisations?.name ?? '',
    }))
  }

  async function linkType(orgId: string, typeId: string, sourceTypeId: string) {
    // Idempotent: unique(type_id, source_type_id) makes a repeat link a no-op,
    // which is what keeps the connect-a-sport reconciliation safe to re-run.
    return await (db.from as any)('person_type_links')
      .upsert({ org_id: orgId, type_id: typeId, source_type_id: sourceTypeId }, { onConflict: 'type_id,source_type_id' })
  }

  async function unlinkType(linkId: string) {
    return await (db.from as any)('person_type_links').delete().eq('id', linkId)
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
    const { data } = await (db.from as any)('field_definitions')
      .select('id, org_id, label, field_type, is_required, options, help_text, key, meta, sort_order, target, targets, rules, organisations(name, org_level)')
      .in('org_id', ids)
      .order('sort_order')
    const parseArr = (v: any) => {
      if (Array.isArray(v)) return v
      if (!v) return []
      try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
    }
    return (data ?? []).map((f: any) => ({
      ...f,
      options: parseArr(f.options),
      rules: parseArr(f.rules),
      meta: f.meta && typeof f.meta === 'object' ? f.meta : {},
      inherited: f.org_id !== orgId,
      ownerName: f.organisations?.name ?? '',
      ownerLevel: f.organisations?.org_level ?? '',
    }))
  }

  /** Own + inherited person types (Member / Guardian / Coach / …) with min/max. */
  async function resolvePersonTypes(orgId: string) {
    const anc = await ancestors(orgId)
    const ids = [orgId, ...anc.map(a => a.id)]
    const { data } = await (db.from as any)('person_target_types')
      .select('id, org_id, key, label, kind, min_count, max_count, sort_order, is_access, organisations(name)')
      .in('org_id', ids)
      .order('sort_order')
    return (data ?? []).map((t: any) => ({
      ...t,
      kind: t.kind ?? 'person',
      is_access: !!t.is_access,
      inherited: t.org_id !== orgId,
      ownerName: t.organisations?.name ?? '',
    }))
  }

  /** A club's OWN person/entity types only (no inheritance) — the single source
   *  the /proto/* prototype uses, so there's no duplicate/two-concept confusion. */
  async function loadOrgTypes(orgId: string) {
    const { data } = await (db.from as any)('person_target_types')
      .select('id, org_id, key, label, kind, is_access, is_published, permissions, member_slots, sort_order, landing_path, profile_dashboard, menu_items')
      .eq('org_id', orgId).order('sort_order')
    return (data ?? []).map((t: any) => ({
      ...t, kind: t.kind ?? 'person', is_access: !!t.is_access, is_published: !!t.is_published, inherited: false, ownerName: '',
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
