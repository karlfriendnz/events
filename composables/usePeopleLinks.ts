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
  const { orgId } = useOrg()
  const api = useCirclesApi()

  // The seam returns camelCase; this composable's public surface (and the pages that
  // read it) is snake_case, so we map at the boundary. One place, so the resolvers +
  // UI below never change.
  function toMember(m: any): CircleMember {
    return {
      id: m.id,
      circle_id: m.circleId,
      person_id: m.personId,
      role: m.role,
      can_book_for: m.canBookFor,
      can_view: m.canView,
      can_register: m.canRegister,
      is_lead: m.isLead,
      relationship: m.relationship ?? null,
      is_primary: m.isPrimary,
      contact_type: m.contactType ?? null,
      receives_comms: m.receivesComms,
      sort_order: m.sortOrder,
      person: m.person
        ? {
            id: m.person.id,
            first_name: m.person.firstName,
            last_name: m.person.lastName,
            email: m.person.email,
            phone: m.person.phone,
            photo_url: m.person.photoUrl,
            person_type: m.person.personType,
          }
        : null,
    }
  }
  function toCircle(c: any): Circle {
    return {
      id: c.id,
      org_id: c.orgId,
      name: c.name,
      kind: c.kind,
      color: c.color ?? null,
      image_url: c.imageUrl ?? null,
      members: (c.members ?? []).map(toMember),
    }
  }

  /** All circles in the org (with members + the member's person), for resolution + admin UI. */
  async function loadCircles(): Promise<Circle[]> {
    if (!orgId.value) return []
    const rows = await api.circlesForOrg(orgId.value)
    return rows.map(toCircle)
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
  // The seam takes camelCase; callers pass snake_case (extras/patch). Map at the edge.
  async function createCircle(name: string, kind: 'family' | 'circle') {
    if (!orgId.value) return null
    const c = await api.createCircle({ orgId: orgId.value, name, kind })
    // Callers read `.id` (and treat the result as a circle) — hand back the snake shape.
    return toCircle({ ...c, members: [] })
  }
  async function renameCircle(id: string, name: string) {
    await api.updateCircle(id, { name })
  }
  async function updateCircle(id: string, patch: { name?: string; color?: string | null; image_url?: string | null }) {
    await api.updateCircle(id, { name: patch.name, color: patch.color, imageUrl: patch.image_url })
  }
  async function deleteCircle(id: string) {
    await api.removeCircle(id)
  }
  async function addMember(circleId: string, personId: string, role: string, extras: Record<string, any> = {}) {
    try {
      await api.addMember(circleId, {
        personId,
        role,
        canBookFor: extras.can_book_for,
        canView: extras.can_view,
        canRegister: extras.can_register,
        isLead: extras.is_lead,
        relationship: extras.relationship,
        isPrimary: extras.is_primary,
        contactType: extras.contact_type,
        receivesComms: extras.receives_comms,
        sortOrder: extras.sort_order,
      })
      return true
    } catch {
      return false
    }
  }
  async function updateMember(id: string, patch: Partial<CircleMember>) {
    // Only forward the keys present — snake → camel.
    const p: Record<string, any> = {}
    if (patch.role !== undefined) p.role = patch.role
    if (patch.can_book_for !== undefined) p.canBookFor = patch.can_book_for
    if (patch.can_view !== undefined) p.canView = patch.can_view
    if (patch.can_register !== undefined) p.canRegister = patch.can_register
    if (patch.is_lead !== undefined) p.isLead = patch.is_lead
    if (patch.relationship !== undefined) p.relationship = patch.relationship
    if (patch.is_primary !== undefined) p.isPrimary = patch.is_primary
    if (patch.contact_type !== undefined) p.contactType = patch.contact_type
    if (patch.receives_comms !== undefined) p.receivesComms = patch.receives_comms
    if (patch.sort_order !== undefined) p.sortOrder = patch.sort_order
    await api.updateMember(id, p)
  }
  async function removeMember(id: string) {
    await api.removeMember(id)
  }

  // ── Comms preferences (which categories a recipient gets per subject) ──
  /** Map subject_person_id → categories[] for everything `personId` receives.
   *  A subject with no row defaults to ALL categories (full inheritance). */
  async function loadCommsPrefs(personId: string): Promise<Record<string, string[]>> {
    const rows = await api.commsPreferences(personId)
    const out: Record<string, string[]> = {}
    for (const r of rows) out[r.subjectPersonId] = r.categories ?? []
    return out
  }
  /** Inverse view: for everyone who receives `subjectId`'s comms, their chosen
   *  categories. Map recipient_person_id → categories[]. Used on the subject's
   *  own profile to show "who gets what on my behalf". */
  async function loadCommsPrefsForSubject(subjectId: string): Promise<Record<string, string[]>> {
    const rows = await api.commsPreferencesForSubject(subjectId)
    const out: Record<string, string[]> = {}
    for (const r of rows) out[r.personId] = r.categories ?? []
    return out
  }
  async function setCommsPref(personId: string, subjectPersonId: string, categories: string[]) {
    if (!orgId.value) return
    await api.setCommsPreference({ orgId: orgId.value, personId, subjectPersonId, categories })
  }

  return {
    loadCircles, circlesForPerson,
    peopleIManage, peopleICanBookFor, peopleICanView, peopleICanRegister, commsRecipientsFor,
    subjectOptionsFor, loadCommsPrefs, loadCommsPrefsForSubject, setCommsPref,
    createCircle, renameCircle, updateCircle, deleteCircle, addMember, updateMember, removeMember,
  }
}
