// Terminology engine (ported from the legacy Settings → Terminology). A club can
// rename canonical terms (Member, Contact, Term, Group, Coach, Division, …) with
// its own singular/plural, falling back to the defaults — and overrides flow down
// from the NSO the same way the field engine inherits fields.

export type TermDef = { key: string; singular: string; plural: string; notes: string; group: string }

// Canonical terms + their defaults. `group` lets the editor section them.
export const TERM_DEFS: TermDef[] = [
  { key: 'member',   singular: 'Member',   plural: 'Members',   notes: 'E.g. Member, Player, Swimmer',  group: 'People' },
  { key: 'contact',  singular: 'Contact',  plural: 'Contacts',  notes: 'E.g. Contact, Parent/Guardian', group: 'People' },
  { key: 'coach',    singular: 'Coach',    plural: 'Coaches',   notes: 'E.g. Coach, Manager, Instructor', group: 'People' },
  { key: 'volunteer',singular: 'Volunteer',plural: 'Volunteers',notes: 'E.g. Volunteer, Helper',        group: 'People' },
  { key: 'group',    singular: 'Group',    plural: 'Groups',    notes: 'E.g. Group, Team, Squad',       group: 'Organising' },
  { key: 'group-head',singular: 'Group Head', plural: 'Group Heads', notes: 'E.g. Group Leader, Head Coach', group: 'Organising' },
  { key: 'term',     singular: 'Term',     plural: 'Terms',     notes: 'E.g. Term, Season',             group: 'Organising' },
  { key: 'division', singular: 'Division', plural: 'Divisions', notes: 'E.g. Division, Grade, Code',     group: 'Organising' },
  { key: 'event',    singular: 'Event',    plural: 'Events',    notes: 'E.g. Event, Fixture, Session',  group: 'Activities' },
  { key: 'booking',  singular: 'Booking',  plural: 'Bookings',  notes: 'E.g. Booking, Reservation',     group: 'Activities' },
  { key: 'venue',    singular: 'Venue',    plural: 'Venues',    notes: 'E.g. Venue, Facility, Court',    group: 'Activities' },
  { key: 'invoice',  singular: 'Invoice',  plural: 'Invoices',  notes: 'E.g. Invoice, Notice',          group: 'Finance' },
]

const DEFAULT_BY_KEY: Record<string, TermDef> = Object.fromEntries(TERM_DEFS.map(t => [t.key, t]))

export function useTerminology() {
  const db = useDb()
  const { ancestors } = useOrgHierarchy()

  /** Own + inherited terminology overrides for an org → { key: { singular, plural } }. */
  async function resolveTerminology(orgId: string): Promise<Record<string, { singular?: string; plural?: string }>> {
    const anc = await ancestors(orgId)
    // Furthest ancestor first so nearer orgs (and finally the club) override.
    const ids = [...anc.map(a => a.id).reverse(), orgId]
    const { data } = await (db.from as any)('organisations')
      .select('id, terminology')
      .in('id', ids)
    const byId: Record<string, any> = Object.fromEntries((data ?? []).map((r: any) => [r.id, r.terminology || {}]))
    const merged: Record<string, { singular?: string; plural?: string }> = {}
    for (const id of ids) {
      const t = byId[id] || {}
      for (const [k, v] of Object.entries(t as Record<string, any>)) {
        if (!v) continue
        merged[k] = { ...(merged[k] || {}), ...(v.singular ? { singular: v.singular } : {}), ...(v.plural ? { plural: v.plural } : {}) }
      }
    }
    return merged
  }

  /** Resolve a single term to a label given a resolved overrides map. */
  function term(overrides: Record<string, { singular?: string; plural?: string }>, key: string, plural = false): string {
    const def = DEFAULT_BY_KEY[key]
    const ov = overrides?.[key] || {}
    if (plural) return ov.plural || def?.plural || (def?.singular ? def.singular + 's' : key)
    return ov.singular || def?.singular || key
  }

  /** Save an org's terminology overrides (only non-default values are stored). */
  async function saveTerminology(orgId: string, overrides: Record<string, { singular?: string; plural?: string }>) {
    const clean: Record<string, { singular?: string; plural?: string }> = {}
    for (const def of TERM_DEFS) {
      const ov = overrides[def.key] || {}
      const out: any = {}
      if (ov.singular && ov.singular.trim() && ov.singular.trim() !== def.singular) out.singular = ov.singular.trim()
      if (ov.plural && ov.plural.trim() && ov.plural.trim() !== def.plural) out.plural = ov.plural.trim()
      if (Object.keys(out).length) clean[def.key] = out
    }
    await (db.from as any)('organisations').update({ terminology: clean }).eq('id', orgId)
    return clean
  }

  return { TERM_DEFS, resolveTerminology, term, saveTerminology }
}
