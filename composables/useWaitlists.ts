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
  person?: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; dob?: string | null }
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
  // Converted to the /api/v1 seam (server/db/repositories/groups.ts + waitlists.ts).
  // No useDb: every call is a typed $fetch to a route. The seam returns camelCase; we
  // map back to the snake_case shapes the waitlists page reads so the UI is unchanged.
  const { orgId } = useOrg()

  const toWaitlist = (w: any): Waitlist => ({
    id: w.id, org_id: w.orgId, name: w.name,
    order_mode: w.orderMode, term_id: w.termId ?? null, lineage_id: w.lineageId ?? null,
  })

  async function loadWaitlists(): Promise<Waitlist[]> {
    if (!orgId.value) return []
    const rows = await $fetch<any[]>('/api/v1/waitlists', { query: { orgId: orgId.value } })
    return (rows ?? []).map(toWaitlist)
  }

  async function createWaitlist(name: string, termId?: string | null): Promise<Waitlist | null> {
    try {
      const w = await $fetch<any>('/api/v1/waitlists', {
        method: 'POST', body: { orgId: orgId.value, name: name.trim(), termId: termId ?? null },
      })
      return w ? toWaitlist(w) : null
    } catch {
      return null
    }
  }
  async function updateWaitlist(id: string, patch: Partial<Pick<Waitlist, 'name' | 'notes' | 'order_mode' | 'term_id'>>): Promise<void> {
    const body: Record<string, any> = {}
    if (patch.name !== undefined) body.name = patch.name
    if (patch.order_mode !== undefined) body.orderMode = patch.order_mode
    if (patch.term_id !== undefined) body.termId = patch.term_id
    await $fetch(`/api/v1/waitlists/${id}`, { method: 'PATCH', body })
  }
  async function deleteWaitlist(id: string): Promise<void> {
    // Entries cascade; groups' waitlist_id nulls out (FK on delete set null).
    await $fetch(`/api/v1/waitlists/${id}`, { method: 'DELETE' })
  }

  // Which groups are connected to each waitlist (member_groups.waitlist_id).
  async function loadGroupLinks(): Promise<Record<string, { id: string; name: string; color: string | null }[]>> {
    if (!orgId.value) return {}
    const rows = await $fetch<any[]>('/api/v1/waitlists/group-links', { query: { orgId: orgId.value } })
    const out: Record<string, { id: string; name: string; color: string | null }[]> = {}
    for (const g of rows ?? []) (out[g.waitlistId] ??= []).push({ id: g.id, name: g.name, color: g.color })
    return out
  }
  // Set the groups connected to a waitlist (adds/removes to match the given set).
  async function setGroupsForWaitlist(waitlistId: string, groupIds: string[]): Promise<void> {
    await $fetch('/api/v1/waitlists/set-groups', { method: 'POST', body: { waitlistId, groupIds } })
  }
  async function connectGroup(groupId: string, waitlistId: string | null): Promise<void> {
    await $fetch('/api/v1/waitlists/connect-group', { method: 'POST', body: { groupId, waitlistId } })
  }

  // Entries on a waitlist (with person), in queue order.
  async function loadEntries(waitlistId: string): Promise<WaitlistEntry[]> {
    const rows = await $fetch<any[]>(`/api/v1/waitlists/${waitlistId}/entries`)
    return (rows ?? []).map((r): WaitlistEntry => ({
      id: r.id, waitlist_id: r.waitlistId, person_id: r.personId, status: r.status,
      notes: r.notes ?? null, sort_order: r.sortOrder, priority: r.priority, created_at: r.createdAt ?? undefined,
      person: r.person
        ? { id: r.person.id, first_name: r.person.firstName, last_name: r.person.lastName, email: r.person.email, phone: r.person.phone, dob: r.person.dob }
        : undefined,
    }))
  }
  async function entryCounts(): Promise<Record<string, number>> {
    if (!orgId.value) return {}
    return await $fetch<Record<string, number>>('/api/v1/waitlists/entry-counts', { query: { orgId: orgId.value } })
  }
  async function addEntry(waitlistId: string, personId: string, sortOrder = 0, notes?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await $fetch('/api/v1/waitlists/add-entry', {
        method: 'POST', body: { orgId: orgId.value, waitlistId, personId, sortOrder, notes: notes || null },
      })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.data?.statusMessage || e?.message }
    }
  }
  async function updateEntry(id: string, patch: Partial<Pick<WaitlistEntry, 'status' | 'notes' | 'sort_order' | 'priority'>>): Promise<void> {
    const body: Record<string, any> = {}
    if (patch.status !== undefined) body.status = patch.status
    if (patch.notes !== undefined) body.notes = patch.notes
    if (patch.sort_order !== undefined) body.sortOrder = patch.sort_order
    if (patch.priority !== undefined) body.priority = patch.priority
    await $fetch('/api/v1/waitlists/update-entry', { method: 'POST', body: { id, patch: body } })
  }
  async function removeEntry(id: string): Promise<void> {
    await $fetch('/api/v1/waitlists/remove-entry', { method: 'POST', body: { id } })
  }
  // How many groups each of these people is currently a member of.
  async function enrolledCounts(personIds: string[]): Promise<Record<string, number>> {
    if (!personIds.length) return {}
    return await $fetch<Record<string, number>>('/api/v1/waitlists/enrolled-counts', { query: { personIds: personIds.join(',') } })
  }
  // Enrol a waitlisted person INTO a group (get them off the waitlist): insert the
  // membership (skip-if-exists) then delete the waitlist entry.
  async function enrolFromWaitlist(entryId: string, groupId: string, personId: string, positions: string[] = []): Promise<{ ok: boolean; error?: string }> {
    try {
      await $fetch('/api/v1/waitlists/enrol', { method: 'POST', body: { entryId, groupId, personId, positions } })
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.data?.statusMessage || e?.message }
    }
  }
  // Persist a re-ordered list (sort_order = index).
  async function reorderEntries(ids: string[]): Promise<void> {
    await $fetch('/api/v1/waitlists/reorder-entries', { method: 'POST', body: { ids } })
  }

  return {
    WAITLIST_STATUSES, WAITLIST_ORDER_MODES, WAITLIST_PRIORITIES, orderEntries,
    loadWaitlists, createWaitlist, updateWaitlist, deleteWaitlist,
    loadGroupLinks, setGroupsForWaitlist, connectGroup,
    loadEntries, entryCounts, addEntry, updateEntry, removeEntry, reorderEntries,
    enrolledCounts, enrolFromWaitlist,
  }
}
