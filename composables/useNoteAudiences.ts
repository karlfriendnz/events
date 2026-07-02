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

export type NoteParent = { id: string; name: string }

export function useNoteAudiences() {
  const db = useDb()

  // The subject's parents/contacts — the guardian members of their family circles.
  async function loadParents(personId: string): Promise<NoteParent[]> {
    const { data: mine } = await (db.from as any)('circle_members')
      .select('circle_id, circle:circles!inner(kind)').eq('person_id', personId)
    const famIds = (mine ?? []).filter((r: any) => r.circle?.kind === 'family').map((r: any) => r.circle_id)
    if (!famIds.length) return []
    const { data: mem } = await (db.from as any)('circle_members')
      .select('person_id, role, person:persons(id, first_name, last_name)')
      .in('circle_id', famIds).neq('person_id', personId)
    const seen = new Set<string>()
    return (mem ?? [])
      .filter((m: any) => (m.role || '').toLowerCase().includes('guardian') && m.person && !seen.has(m.person.id) && seen.add(m.person.id))
      .map((m: any) => ({ id: m.person.id, name: `${m.person.first_name ?? ''} ${m.person.last_name ?? ''}`.trim() || 'Parent' }))
  }

  // MultiSelect options = the base audiences + each parent by name (person:<id>).
  function audienceOptions(parents: NoteParent[]) {
    return [...NOTE_AUDIENCE_BASE, ...parents.map(p => ({ label: p.name, value: `person:${p.id}` }))]
  }

  function audienceLabel(tok: string, parents: NoteParent[]) {
    if (tok.startsWith('person:')) return parents.find(p => `person:${p.id}` === tok)?.name || 'Parent'
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

  return { NOTE_AUDIENCE_BASE, loadParents, audienceOptions, audienceLabel, buildVisibleTo, visibleToLabels }
}
