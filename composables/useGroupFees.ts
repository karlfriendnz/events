// Group fees — the multiple ways a member can pay to join a group.
//
// A group offers several FEE OPTIONS (Full upfront / Monthly / Concession …);
// the member chooses one. Each option is made of one or more LINE ITEMS
// (Coaching, Registration, Uniform levy…) each with its own amount + GL code.
// Migration 204. Supersedes member_group_terms.fee + the membership enrol picker.

export type FeeType = 'upfront' | 'recurring' | 'instalment' | 'concession' | 'per_session'

export interface FeeLineItem {
  id: string
  option_id?: string
  name: string | null
  amount: number
  account: string | null
  sort_order: number
}

export interface GroupFeeOption {
  id: string
  org_id?: string
  group_id?: string
  name: string
  fee_type: FeeType
  period_unit: 'week' | 'month' | 'year' | null
  period_count: number
  auto_renew: boolean
  instalment_count: number | null
  session_count: number | null
  prorata: boolean
  description: string | null
  sort_order: number
  status: string
  items: FeeLineItem[]
}

// Metadata for each charging model — drives the editor + which fields apply.
export const FEE_TYPES: { value: FeeType; label: string; hint: string }[] = [
  { value: 'upfront',     label: 'Full upfront',   hint: 'One payment for the whole term' },
  { value: 'recurring',   label: 'Recurring',      hint: 'Charged every week / month / year' },
  { value: 'instalment',  label: 'Instalments',    hint: 'The total split into a set number of payments' },
  { value: 'concession',  label: 'Concession card', hint: 'Prepay a set number of sessions' },
  { value: 'per_session', label: 'Per session',    hint: 'Charged for each session' },
]

export function useGroupFees() {
  const db = useDb()
  const { orgId } = useOrg()

  function fmtMoney(v: number, currency = 'NZD'): string {
    try { return new Intl.NumberFormat('en-NZ', { style: 'currency', currency }).format(Number(v || 0)) }
    catch { return `$${Number(v || 0).toFixed(2)}` }
  }

  const feeTypeLabel = (t: FeeType) => FEE_TYPES.find(f => f.value === t)?.label ?? t

  // Sum of an option's line items (the base amount before periods/sessions).
  function optionTotal(o: GroupFeeOption): number {
    return (o.items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0)
  }

  // A human price label per charging model, e.g. "$40 / month", "$180 · 10 sessions".
  function priceLabel(o: GroupFeeOption, currency = 'NZD'): string {
    const total = optionTotal(o)
    const money = fmtMoney(total, currency)
    if (o.fee_type === 'recurring') {
      const unit = o.period_unit || 'month'
      const n = o.period_count || 1
      return n === 1 ? `${money} / ${unit}` : `${money} / ${n} ${unit}s`
    }
    if (o.fee_type === 'instalment') {
      const n = o.instalment_count || 1
      const each = n ? total / n : total
      return `${money} · ${n}× ${fmtMoney(each, currency)}`
    }
    if (o.fee_type === 'concession') {
      const n = o.session_count || 0
      return `${money} · ${n} session${n === 1 ? '' : 's'}`
    }
    if (o.fee_type === 'per_session') return `${money} / session`
    return o.prorata ? `${money} · pro-rata` : money
  }

  async function loadFeeOptions(groupId: string): Promise<GroupFeeOption[]> {
    const { data: opts } = await (db.from as any)('group_fee_options')
      .select('*')
      .eq('group_id', groupId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at')
    const list = (opts || []) as GroupFeeOption[]
    if (!list.length) return []
    const { data: items } = await (db.from as any)('group_fee_option_items')
      .select('*')
      .in('option_id', list.map(o => o.id))
      .order('sort_order', { ascending: true, nullsFirst: false })
    const byOpt: Record<string, FeeLineItem[]> = {}
    for (const it of (items || []) as FeeLineItem[]) (byOpt[it.option_id!] ||= []).push(it)
    return list.map(o => ({ ...o, items: byOpt[o.id] || [] }))
  }

  // Save the whole set for a group (delete-then-insert, mirrors the other editors).
  async function saveFeeOptions(groupId: string, options: GroupFeeOption[]): Promise<void> {
    // wipe existing (cascades items) then reinsert
    await (db.from as any)('group_fee_options').delete().eq('group_id', groupId)
    let sort = 0
    for (const o of options) {
      const { data: created } = await (db.from as any)('group_fee_options').insert({
        org_id: orgId.value,
        group_id: groupId,
        name: o.name?.trim() || feeTypeLabel(o.fee_type),
        fee_type: o.fee_type,
        period_unit: o.fee_type === 'recurring' ? (o.period_unit || 'month') : null,
        period_count: o.fee_type === 'recurring' ? (o.period_count || 1) : 1,
        auto_renew: o.fee_type === 'recurring' ? !!o.auto_renew : false,
        instalment_count: o.fee_type === 'instalment' ? (o.instalment_count || 1) : null,
        session_count: (o.fee_type === 'concession' || o.fee_type === 'per_session') ? (o.session_count ?? null) : null,
        prorata: o.fee_type === 'upfront' ? !!o.prorata : false,
        description: o.description || null,
        sort_order: sort++,
        status: o.status || 'active',
      }).select('id').single()
      const newId = created.id
      const items = (o.items || []).filter(i => (i.name && i.name.trim()) || Number(i.amount))
      if (items.length) {
        await (db.from as any)('group_fee_option_items').insert(items.map((i, idx) => ({
          option_id: newId,
          name: i.name?.trim() || null,
          amount: Number(i.amount) || 0,
          account: i.account || null,
          sort_order: idx,
        })))
      }
    }
  }

  // Normalise the type-specific columns for one option (shared by save paths).
  function optionCols(o: GroupFeeOption, groupId: string, sortOrder: number) {
    return {
      org_id: orgId.value,
      group_id: groupId,
      name: o.name?.trim() || feeTypeLabel(o.fee_type),
      fee_type: o.fee_type,
      period_unit: o.fee_type === 'recurring' ? (o.period_unit || 'month') : null,
      period_count: o.fee_type === 'recurring' ? (o.period_count || 1) : 1,
      auto_renew: o.fee_type === 'recurring' ? !!o.auto_renew : false,
      instalment_count: o.fee_type === 'instalment' ? (o.instalment_count || 1) : null,
      session_count: (o.fee_type === 'concession' || o.fee_type === 'per_session') ? (o.session_count ?? null) : null,
      prorata: o.fee_type === 'upfront' ? !!o.prorata : false,
      description: o.description || null,
      sort_order: sortOrder,
      status: o.status || 'active',
    }
  }

  function optionItemRows(o: GroupFeeOption, optionId: string) {
    return (o.items || [])
      .filter(i => (i.name && i.name.trim()) || Number(i.amount))
      .map((i, idx) => ({ option_id: optionId, name: i.name?.trim() || null, amount: Number(i.amount) || 0, account: i.account || null, sort_order: idx }))
  }

  // APPEND one fee option to several groups at once (bulk add — doesn't touch
  // a group's existing options). Returns how many groups it was added to.
  async function addFeeOptionToGroups(groupIds: string[], option: GroupFeeOption): Promise<number> {
    if (!groupIds.length) return 0
    // next sort_order per group = current count, so the option appends
    const { data: existing } = await (db.from as any)('group_fee_options')
      .select('group_id').in('group_id', groupIds)
    const countBy: Record<string, number> = {}
    for (const r of (existing || [])) countBy[r.group_id] = (countBy[r.group_id] || 0) + 1
    let added = 0
    for (const gid of groupIds) {
      const { data: created } = await (db.from as any)('group_fee_options')
        .insert(optionCols(option, gid, countBy[gid] || 0)).select('id').single()
      const items = optionItemRows(option, created.id)
      if (items.length) await (db.from as any)('group_fee_option_items').insert(items)
      added++
    }
    return added
  }

  return { FEE_TYPES, fmtMoney, feeTypeLabel, optionTotal, priceLabel, loadFeeOptions, saveFeeOptions, addFeeOptionToGroups }
}
