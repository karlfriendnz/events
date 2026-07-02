// Waitlists (migration 221). A waitlist is a shared queue of people waiting for a
// spot. One waitlist connects to MANY groups (member_groups.waitlist_id) — so
// "Tuesday 4pm" + "Thursday 4pm" (same class, different days) share one queue.
//
// Entry status: 'waiting' | 'contacted' | 'placed' | 'declined'.

export type WaitlistOrderMode = 'custom' | 'fifo' | 'priority'
export interface Waitlist {
  id: string
  org_id?: string
  name: string
  notes?: string | null
  order_mode?: WaitlistOrderMode
  term_id?: string | null
  lineage_id?: string | null
  created_at?: string
}
export interface WaitlistEntry {
  id: string
  org_id?: string
  waitlist_id: string
  person_id: string
  status: string
  notes?: string | null
  sort_order: number
  priority: number
  created_at?: string
  person?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null }
}

export const WAITLIST_ORDER_MODES = [
  { value: 'custom', label: 'Custom order' },
  { value: 'fifo', label: 'First in, first served' },
  { value: 'priority', label: 'Priority' },
]
export const WAITLIST_PRIORITIES = [
  { value: 3, label: 'High' },
  { value: 2, label: 'Normal' },
  { value: 1, label: 'Low' },
]
// Order a list of entries by the waitlist's mode.
export function orderEntries(entries: WaitlistEntry[], mode: WaitlistOrderMode | undefined): WaitlistEntry[] {
  const list = [...entries]
  const byTime = (a: WaitlistEntry, b: WaitlistEntry) => (a.created_at ?? '').localeCompare(b.created_at ?? '')
  if (mode === 'fifo') return list.sort(byTime)
  if (mode === 'priority') return list.sort((a, b) => (b.priority ?? 2) - (a.priority ?? 2) || byTime(a, b))
  return list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || byTime(a, b))
}

export const WAITLIST_STATUSES = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'placed', label: 'Placed' },
  { value: 'declined', label: 'Declined' },
]

export function useWaitlists() {
  const db = useDb()
  const { orgId } = useOrg()

  async function loadWaitlists(): Promise<Waitlist[]> {
    if (!orgId.value) return []
    const { data } = await (db.from as any)('waitlists')
      .select('id, org_id, name, notes, order_mode, term_id, lineage_id, created_at').eq('org_id', orgId.value).order('name')
    return data ?? []
  }

  async function createWaitlist(name: string, termId?: string | null): Promise<Waitlist | null> {
    const { data, error } = await (db.from as any)('waitlists')
      .insert({ org_id: orgId.value, name: name.trim(), term_id: termId ?? null }).select('*').single()
    return error ? null : data
  }
  async function updateWaitlist(id: string, patch: Partial<Pick<Waitlist, 'name' | 'notes' | 'order_mode' | 'term_id'>>): Promise<void> {
    await (db.from as any)('waitlists').update(patch).eq('id', id)
  }
  async function deleteWaitlist(id: string): Promise<void> {
    // Entries cascade; groups' waitlist_id nulls out (FK on delete set null).
    await (db.from as any)('waitlists').delete().eq('id', id)
  }

  // Which groups are connected to each waitlist (member_groups.waitlist_id).
  async function loadGroupLinks(): Promise<Record<string, { id: string; name: string; color: string | null }[]>> {
    if (!orgId.value) return {}
    const { data } = await (db.from as any)('member_groups')
      .select('id, name, color, waitlist_id').eq('org_id', orgId.value).not('waitlist_id', 'is', null)
    const out: Record<string, { id: string; name: string; color: string | null }[]> = {}
    for (const g of data ?? []) (out[g.waitlist_id] ??= []).push({ id: g.id, name: g.name, color: g.color })
    return out
  }
  // Set the groups connected to a waitlist (adds/removes to match the given set).
  async function setGroupsForWaitlist(waitlistId: string, groupIds: string[]): Promise<void> {
    // Connect the chosen groups...
    if (groupIds.length) {
      await (db.from as any)('member_groups').update({ waitlist_id: waitlistId }).in('id', groupIds)
    }
    // ...and disconnect any group currently on this waitlist that's no longer chosen.
    const { data: current } = await (db.from as any)('member_groups')
      .select('id').eq('waitlist_id', waitlistId)
    const drop = (current ?? []).map((g: any) => g.id).filter((id: string) => !groupIds.includes(id))
    if (drop.length) await (db.from as any)('member_groups').update({ waitlist_id: null }).in('id', drop)
  }
  async function connectGroup(groupId: string, waitlistId: string | null): Promise<void> {
    await (db.from as any)('member_groups').update({ waitlist_id: waitlistId }).eq('id', groupId)
  }

  // Entries on a waitlist (with person), in queue order.
  async function loadEntries(waitlistId: string): Promise<WaitlistEntry[]> {
    const { data } = await (db.from as any)('waitlist_entries')
      .select('id, waitlist_id, person_id, status, notes, sort_order, priority, created_at')
      .eq('waitlist_id', waitlistId).order('sort_order').order('created_at')
    const rows: WaitlistEntry[] = data ?? []
    const ids = rows.map(r => r.person_id)
    if (ids.length) {
      const { data: people } = await (db.from as any)('persons')
        .select('id, first_name, last_name, email, phone').in('id', ids)
      const byId: Record<string, any> = {}
      for (const p of people ?? []) byId[p.id] = p
      for (const r of rows) r.person = byId[r.person_id]
    }
    return rows
  }
  async function entryCounts(): Promise<Record<string, number>> {
    if (!orgId.value) return {}
    const { data } = await (db.from as any)('waitlist_entries')
      .select('waitlist_id, status').eq('org_id', orgId.value)
    const out: Record<string, number> = {}
    for (const e of data ?? []) if (e.status === 'waiting' || e.status === 'contacted') out[e.waitlist_id] = (out[e.waitlist_id] ?? 0) + 1
    return out
  }
  async function addEntry(waitlistId: string, personId: string, sortOrder = 0, notes?: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await (db.from as any)('waitlist_entries')
      .insert({ org_id: orgId.value, waitlist_id: waitlistId, person_id: personId, sort_order: sortOrder, notes: notes || null })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }
  async function updateEntry(id: string, patch: Partial<Pick<WaitlistEntry, 'status' | 'notes' | 'sort_order' | 'priority'>>): Promise<void> {
    await (db.from as any)('waitlist_entries').update(patch).eq('id', id)
  }
  async function removeEntry(id: string): Promise<void> {
    await (db.from as any)('waitlist_entries').delete().eq('id', id)
  }
  // Persist a re-ordered list (sort_order = index).
  async function reorderEntries(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id, i) => (db.from as any)('waitlist_entries').update({ sort_order: i }).eq('id', id)))
  }

  return {
    WAITLIST_STATUSES, WAITLIST_ORDER_MODES, WAITLIST_PRIORITIES, orderEntries,
    loadWaitlists, createWaitlist, updateWaitlist, deleteWaitlist,
    loadGroupLinks, setGroupsForWaitlist, connectGroup,
    loadEntries, entryCounts, addEntry, updateEntry, removeEntry, reorderEntries,
  }
}
