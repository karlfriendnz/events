// People links — Families & Circles (migration 170).
//   circles(kind 'family'|'circle') + circle_members(role, can_book_for, can_view).
// Capability rules (single source of truth):
//   • Family `guardian` → manages + books-for + views the family's `dependent` members.
//   • Family `dependent` / Circle `member` → can book-for / view co-members (per flags),
//     but NEVER manage another person's profile (managing is family-guardian-only).

export interface CircleMember {
  id: string
  circle_id: string
  person_id: string
  role: string
  can_book_for: boolean
  can_view: boolean
  can_register: boolean
  is_lead: boolean
  relationship?: string | null
  is_primary?: boolean
  contact_type?: string | null
  receives_comms?: boolean
  sort_order: number
  person?: any
}
export interface Circle {
  id: string
  org_id: string
  name: string
  kind: 'family' | 'circle'
  color?: string | null
  image_url?: string | null
  members: CircleMember[]
}

/** A subject the current user may act for — themself or a linked person. */
export interface SubjectOption {
  id: string
  name: string
  kind: 'self' | 'dependent' | 'circle'
}

// Categories a recipient can opt into for someone they receive comms on behalf of.
// Static for now (no comms-type engine yet) — kept here so UI + future send paths share one list.
export const COMMS_CATEGORIES = [
  { key: 'events', label: 'Events & sessions' },
  { key: 'payments', label: 'Payments & invoices' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'results', label: 'Results & awards' },
  { key: 'general', label: 'General announcements' },
]
export const COMMS_CATEGORY_KEYS = COMMS_CATEGORIES.map(c => c.key)

export function usePeopleLinks() {
  const db = useDb()
  const { orgId } = useOrg()

  /** All circles in the org (with members + the member's person), for resolution + admin UI. */
  async function loadCircles(): Promise<Circle[]> {
    const { data } = await (db.from as any)('circles')
      .select('id, org_id, name, kind, color, image_url, circle_members(id, circle_id, person_id, role, can_book_for, can_view, can_register, is_lead, relationship, is_primary, contact_type, receives_comms, sort_order, person:persons(id, first_name, last_name, email, phone, photo_url, person_type))')
      .eq('org_id', orgId.value)
      .order('name')
    return (data ?? []).map((c: any) => ({ ...c, members: (c.circle_members ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order) }))
  }

  /** Circles a given person belongs to. */
  async function circlesForPerson(personId: string): Promise<Circle[]> {
    const all = await loadCircles()
    return all.filter(c => c.members.some(m => m.person_id === personId))
  }

  // ── Capability resolvers (pass the current user's person id) ──
  function membershipOf(circle: Circle, personId: string) {
    return circle.members.find(m => m.person_id === personId)
  }
  /** Dependents in family circles where I'm a guardian — the ONLY profile-manage source. */
  function peopleIManage(circles: Circle[], meId: string): string[] {
    const out = new Set<string>()
    for (const c of circles) {
      if (c.kind !== 'family') continue
      const me = membershipOf(c, meId)
      if (me?.role !== 'guardian') continue
      for (const m of c.members) if (m.role === 'dependent' && m.person_id !== meId) out.add(m.person_id)
    }
    return [...out]
  }
  /** Managed dependents + co-members of circles where I can book — for act-on-behalf pickers. */
  function peopleICanBookFor(circles: Circle[], meId: string): string[] {
    const out = new Set<string>(peopleIManage(circles, meId))
    for (const c of circles) {
      const me = membershipOf(c, meId)
      if (!me?.can_book_for) continue
      for (const m of c.members) if (m.person_id !== meId) out.add(m.person_id)
    }
    return [...out]
  }
  function peopleICanView(circles: Circle[], meId: string): string[] {
    const out = new Set<string>(peopleICanBookFor(circles, meId))
    for (const c of circles) {
      const me = membershipOf(c, meId)
      if (!me?.can_view) continue
      for (const m of c.members) if (m.person_id !== meId) out.add(m.person_id)
    }
    return [...out]
  }
  /** Managed dependents + co-members of circles where I can register others. */
  function peopleICanRegister(circles: Circle[], meId: string): string[] {
    const out = new Set<string>(peopleIManage(circles, meId))
    for (const c of circles) {
      const me = membershipOf(c, meId)
      if (!me?.can_register) continue
      for (const m of c.members) if (m.person_id !== meId) out.add(m.person_id)
    }
    return [...out]
  }
  /** Subject picker options for act-on-behalf: self + everyone I can act for.
   *  `mode` chooses the capability gate ('book' → can_book_for, 'register' → can_register). */
  function subjectOptionsFor(circles: Circle[], meId: string, meName: string, mode: 'book' | 'register' = 'book'): SubjectOption[] {
    const managed = new Set(peopleIManage(circles, meId))
    const ids = mode === 'register' ? peopleICanRegister(circles, meId) : peopleICanBookFor(circles, meId)
    // Resolve a display name for each id from any circle membership that carries the person.
    const nameOf = (pid: string) => {
      for (const c of circles) {
        const m = c.members.find(x => x.person_id === pid)
        if (m?.person) return `${m.person.first_name ?? ''} ${m.person.last_name ?? ''}`.trim() || 'Member'
      }
      return 'Member'
    }
    const opts: SubjectOption[] = [{ id: meId, name: meName || 'Myself', kind: 'self' }]
    for (const pid of ids) {
      if (pid === meId) continue
      opts.push({ id: pid, name: nameOf(pid), kind: managed.has(pid) ? 'dependent' : 'circle' })
    }
    return opts
  }
  /** Contacts who should receive a person's comms (those with receives_comms on
   *  in one of the person's family/contacts circles). */
  function commsRecipientsFor(circles: Circle[], personId: string): string[] {
    const out = new Set<string>()
    for (const c of circles) {
      if (c.kind !== 'family') continue
      if (!c.members.some(m => m.person_id === personId)) continue
      for (const m of c.members) if (m.person_id !== personId && m.receives_comms) out.add(m.person_id)
    }
    return [...out]
  }

  // ── Mutations ──
  async function createCircle(name: string, kind: 'family' | 'circle') {
    const { data } = await (db.from as any)('circles')
      .insert({ org_id: orgId.value, name, kind }).select('*').single()
    return data
  }
  async function renameCircle(id: string, name: string) {
    await (db.from as any)('circles').update({ name }).eq('id', id)
  }
  async function updateCircle(id: string, patch: { name?: string; color?: string | null; image_url?: string | null }) {
    await (db.from as any)('circles').update(patch).eq('id', id)
  }
  async function deleteCircle(id: string) {
    await (db.from as any)('circles').delete().eq('id', id)
  }
  async function addMember(circleId: string, personId: string, role: string, extras: Record<string, any> = {}) {
    const { error } = await (db.from as any)('circle_members')
      .insert({ circle_id: circleId, person_id: personId, role, ...extras })
    return !error
  }
  async function updateMember(id: string, patch: Partial<CircleMember>) {
    await (db.from as any)('circle_members').update(patch).eq('id', id)
  }
  async function removeMember(id: string) {
    await (db.from as any)('circle_members').delete().eq('id', id)
  }

  // ── Comms preferences (which categories a recipient gets per subject) ──
  /** Map subject_person_id → categories[] for everything `personId` receives.
   *  A subject with no row defaults to ALL categories (full inheritance). */
  async function loadCommsPrefs(personId: string): Promise<Record<string, string[]>> {
    const { data } = await (db.from as any)('comms_preferences')
      .select('subject_person_id, categories').eq('person_id', personId)
    const out: Record<string, string[]> = {}
    for (const r of (data ?? [])) out[r.subject_person_id] = r.categories ?? []
    return out
  }
  /** Inverse view: for everyone who receives `subjectId`'s comms, their chosen
   *  categories. Map recipient_person_id → categories[]. Used on the subject's
   *  own profile to show "who gets what on my behalf". */
  async function loadCommsPrefsForSubject(subjectId: string): Promise<Record<string, string[]>> {
    const { data } = await (db.from as any)('comms_preferences')
      .select('person_id, categories').eq('subject_person_id', subjectId)
    const out: Record<string, string[]> = {}
    for (const r of (data ?? [])) out[r.person_id] = r.categories ?? []
    return out
  }
  async function setCommsPref(personId: string, subjectPersonId: string, categories: string[]) {
    await (db.from as any)('comms_preferences')
      .upsert({ org_id: orgId.value, person_id: personId, subject_person_id: subjectPersonId, categories },
        { onConflict: 'person_id,subject_person_id' })
  }

  return {
    loadCircles, circlesForPerson,
    peopleIManage, peopleICanBookFor, peopleICanView, peopleICanRegister, commsRecipientsFor,
    subjectOptionsFor, loadCommsPrefs, loadCommsPrefsForSubject, setCommsPref,
    createCircle, renameCircle, updateCircle, deleteCircle, addMember, updateMember, removeMember,
  }
}
