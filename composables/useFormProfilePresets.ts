// Shared "who is registering" presets + resolver. Used by <FormProfilesEditor>
// and the events forms tab so every form surface offers the same quick-start
// registration shapes and resolves them against the org's subject types.

export type PresetRole = { match: string[]; label: string; min: number; max: number | null; synthKey?: string; kind?: string; selects?: boolean }
export type FormProfile = { key: string; label: string; min: number; max: number | null; kind?: string; selectsOptions?: boolean }
export type SubjectType = { key: string; label: string; kind?: string; min_count?: number; max_count?: number | null }

export const PROFILE_PRESETS: { id: string; label: string; icon: string; description: string; roles: PresetRole[] }[] = [
  { id: 'individual', label: 'Individual', icon: 'pi-user', description: 'One person signing up on their own, plus an emergency contact.', roles: [
    { match: ['member', 'player'], label: 'Individual', min: 1, max: 1, selects: true },
    { match: ['contact', 'emergency'], label: 'Emergency Contact', min: 1, max: 2, synthKey: 'contact' },
  ] },
  { id: 'couple', label: 'Couple', icon: 'pi-users', description: 'Two people registering together on one form.', roles: [
    { match: ['member', 'player'], label: 'Member', min: 2, max: 2, selects: true },
    { match: ['contact', 'emergency'], label: 'Emergency Contact', min: 1, max: 2, synthKey: 'contact' },
  ] },
  // Children AND guardians are unlimited (max: null): a parent signing up two or three
  // kids, or two guardians on one form, is the normal case — capping it at one each
  // forced them through the form again.
  { id: 'parent_child', label: 'Parent / child', icon: 'pi-users', description: 'A parent or guardian registering their children.', roles: [
    { match: ['member', 'player', 'child'], label: 'Child', min: 1, max: null, selects: true },
    { match: ['guardian', 'parent'], label: 'Parent / Guardian', min: 1, max: null },
    { match: ['contact', 'emergency'], label: 'Emergency Contact', min: 1, max: 2, synthKey: 'contact' },
  ] },
  { id: 'family', label: 'Family', icon: 'pi-home', description: '1–2 guardians registering up to 4 children at once.', roles: [
    { match: ['guardian', 'parent'], label: 'Parent / Guardian', min: 1, max: 2 },
    { match: ['member', 'player', 'child'], label: 'Child', min: 1, max: 4, selects: true },
    { match: ['contact', 'emergency'], label: 'Emergency Contact', min: 1, max: 2, synthKey: 'contact' },
  ] },
  { id: 'team', label: 'Team', icon: 'pi-flag', description: 'A whole team — players, coaches, managers and a physio.', roles: [
    { match: ['team'], label: 'Team', min: 1, max: 1, synthKey: 'team', kind: 'entity', selects: true },
    { match: ['member', 'player'], label: 'Player', min: 12, max: null },
    { match: ['coach'], label: 'Coach', min: 2, max: null },
    { match: ['manager'], label: 'Team Manager', min: 2, max: null },
    { match: ['medical', 'physio'], label: 'Physio', min: 1, max: 1 },
    { match: ['contact', 'emergency'], label: 'Emergency Contact', min: 1, max: null, synthKey: 'contact' },
  ] },
  { id: 'company', label: 'Company', icon: 'pi-building', description: 'A company or business registering multiple attendees.', roles: [
    { match: ['company', 'business', 'organisation', 'organization'], label: 'Company', min: 1, max: 1, synthKey: 'company', kind: 'entity', selects: true },
    { match: ['member', 'player', 'attendee'], label: 'Attendee', min: 1, max: null },
  ] },
  { id: 'school', label: 'School', icon: 'pi-graduation-cap', description: 'A school registering students with a supervising teacher.', roles: [
    { match: ['school'], label: 'School', min: 1, max: 1, synthKey: 'school', kind: 'entity', selects: true },
    { match: ['member', 'player', 'student'], label: 'Student', min: 1, max: null },
    { match: ['manager', 'teacher', 'coach'], label: 'Supervising Teacher', min: 1, max: null },
  ] },
]

/**
 * Find the best subject type for a role's keywords, in priority order:
 *   1. exact key match (keyword order = preference)
 *   2. exact label match
 *   3. for entity/fallbackable roles (those with a synthKey) stop here so they
 *      resolve to their synthetic entity rather than loosely matching a person
 *      type (e.g. "team" must NOT grab "Team Manager")
 *   4. substring match, again honouring keyword priority order
 */
function matchType(types: SubjectType[], role: PresetRole): SubjectType | null {
  const kws = role.match.map(m => m.toLowerCase())
  for (const m of kws) { const h = types.find(t => t.key.toLowerCase() === m); if (h) return h }
  for (const m of kws) { const h = types.find(t => t.label.toLowerCase() === m); if (h) return h }
  if (role.synthKey) return null
  for (const m of kws) { const h = types.find(t => `${t.key} ${t.label}`.toLowerCase().includes(m)); if (h) return h }
  return null
}

/**
 * Resolve a preset's roles against the org's available subject types into a
 * profiles array. `opts.memberTerm` = what this club CALLS a Member (the
 * canonical 'member' term from useTerminology — Gymnast, Swimmer, Player…):
 * member/player roles match a type by that word, and the literal "Member"
 * label is rendered as it.
 */
export function resolvePreset(types: SubjectType[], preset: { roles: PresetRole[] }, opts?: { memberTerm?: string }): FormProfile[] {
  const out: FormProfile[] = []
  const memberTerm = opts?.memberTerm?.trim()
  for (const role of preset.roles) {
    const memberish = role.match.some(m => m === 'member' || m === 'player')
    const label = memberish && memberTerm && role.label === 'Member' ? memberTerm : role.label
    let hit = matchType(types, role)
    // Terminology-aware fallback: a member-ish role matches the type named by
    // the club's member term ("Gymnast"/"Swimmer") before anything else.
    if (!hit && memberish && memberTerm) {
      const mt = memberTerm.toLowerCase()
      hit = types.find(t => t.key.toLowerCase() === mt || t.label.toLowerCase() === mt)
        ?? types.find(t => `${t.key} ${t.label}`.toLowerCase().includes(mt))
        ?? null
    }
    let p: FormProfile | null = null
    // A role that declares a kind (entity roles) keeps it even if it matched a
    // subject type stored as person/null.
    if (hit) p = { key: hit.key, label: label || hit.label, min: role.min, max: role.max, kind: role.kind ?? hit.kind }
    else if (role.synthKey) p = { key: role.synthKey, label, min: role.min, max: role.max, kind: role.kind || 'person' }
    else {
      // Never drop a role silently. The primary participant role (member/player
      // keywords) falls back to the org's FIRST person-kind type — a gymnastics
      // club's "Individual" or "Child" IS a Gymnast. Anything else synthesizes
      // its own subject key from the label so the form still captures it.
      const firstPerson = memberish ? types.find(t => (t.kind ?? 'person') === 'person') : null
      p = firstPerson
        ? { key: firstPerson.key, label: label || firstPerson.label, min: role.min, max: role.max, kind: role.kind ?? firstPerson.kind }
        : { key: (label || 'person').toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, min: role.min, max: role.max, kind: role.kind || 'person' }
    }
    if (!p) continue
    if (role.selects) p.selectsOptions = true
    // If two roles resolve to the same subject key, merge rather than drop the
    // second — so a later role's `selects` (chooser) flag isn't lost.
    const existing = out.find(x => x.key === p!.key)
    if (existing) { if (p.selectsOptions) existing.selectsOptions = true; continue }
    out.push(p)
  }
  return out
}
