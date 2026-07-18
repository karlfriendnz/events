// Shared "who can see this note" logic for every note surface (the <PersonNotes>
// drawer + the profile dashboard Notes widget). Notes store their audiences in
// `person_notes.visible_to` (migration 211) as tokens:
//   { type:'staff'|'admin'|'member'|'parents'|'circle' } | { type:'person', id, label }.

export const NOTE_AUDIENCE_BASE = [
  { label: 'Staff', value: 'staff' },
  { label: 'Admins only', value: 'admin' },
  { label: 'Member', value: 'member' },
  { label: 'All parents', value: 'parents' },
  { label: 'Circle', value: 'circle' },
]

export type NoteParent = { id: string; name: string; role?: string | null }

// A parent's display label = name + their relationship/role when known.
export const parentLabel = (p: NoteParent) => p.role ? `${p.name} · ${p.role}` : p.name

export function useNoteAudiences() {
  const { orgId } = useOrg()
  const { circlesForOrg } = useCirclesApi()

  // The subject's parents/contacts — the guardian members of their family circles,
  // carrying each one's relationship/role (Mum / Dad / Guardian…). Reads the org's
  // hydrated circles through the seam and filters to the families this person is in.
  async function loadParents(personId: string): Promise<NoteParent[]> {
    if (!orgId.value) return []
    const all = await circlesForOrg(orgId.value)
    const fams = all.filter((c) => c.kind === 'family' && c.members.some((m) => m.personId === personId))
    const seen = new Set<string>()
    const out: NoteParent[] = []
    for (const c of fams) {
      for (const m of c.members) {
        if (m.personId === personId) continue
        if (!(m.role || '').toLowerCase().includes('guardian')) continue
        if (!m.person || seen.has(m.person.id)) continue
        seen.add(m.person.id)
        out.push({
          id: m.person.id,
          name: `${m.person.firstName ?? ''} ${m.person.lastName ?? ''}`.trim() || 'Parent',
          role: m.relationship || 'Guardian',
        })
      }
    }
    return out
  }

  // Grouped MultiSelect options: the base audiences, then a "Parents" group
  // (only when the subject has parents) so specific parents sit under a divider.
  function audienceOptions(parents: NoteParent[]) {
    const groups: { label: string; items: { label: string; value: string }[] }[] = [
      { label: 'Audiences', items: [...NOTE_AUDIENCE_BASE] },
    ]
    if (parents.length) groups.push({ label: 'Parents', items: parents.map(p => ({ label: parentLabel(p), value: `person:${p.id}` })) })
    return groups
  }

  function audienceLabel(tok: string, parents: NoteParent[]) {
    if (tok.startsWith('person:')) {
      const p = parents.find(x => `person:${x.id}` === tok)
      return p ? parentLabel(p) : 'Parent'
    }
    return NOTE_AUDIENCE_BASE.find(o => o.value === tok)?.label ?? tok
  }

  // Selected tokens → the stored visible_to shape.
  function buildVisibleTo(tokens: string[], parents: NoteParent[]): any[] {
    return tokens.map(tok => tok.startsWith('person:')
      ? { type: 'person', id: tok.slice(7), label: audienceLabel(tok, parents) }
      : { type: tok })
  }

  // A stored note's audiences → display labels (legacy single `visibility` fallback).
  function visibleToLabels(visibleTo: any, legacyVisibility?: string): string[] {
    const list = Array.isArray(visibleTo) ? visibleTo : []
    if (list.length) return list.map((a: any) => a.type === 'person' ? (a.label || 'Parent') : (NOTE_AUDIENCE_BASE.find(o => o.value === a.type)?.label ?? a.type))
    return legacyVisibility && legacyVisibility !== 'staff' ? [legacyVisibility] : []
  }

  // Due-date helpers (shared so every note surface formats/stores dates the same).
  function toISODate(d: Date | null | undefined): string | null {
    if (!d) return null
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  function dueLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00')
    return 'Due ' + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function isOverdue(iso: string): boolean {
    return !!iso && iso < new Date().toISOString().slice(0, 10)
  }

  return { NOTE_AUDIENCE_BASE, loadParents, audienceOptions, audienceLabel, buildVisibleTo, visibleToLabels, toISODate, dueLabel, isOverdue }
}
