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
  due_date: string | null       // when the fee is due (ISO date)
  deposit_percent: number | null // upfront deposit required, % of the option total
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
  const { orgId } = useOrg()
  const api = useGroupsApi()

  // ── seam mappers (camelCase contract ↔ this composable's snake_case shape) ──
  function toSnake(o: any): GroupFeeOption {
    return {
      id: o.id,
      org_id: o.orgId,
      group_id: o.groupId,
      name: o.name,
      fee_type: o.feeType,
      period_unit: o.periodUnit ?? null,
      period_count: o.periodCount ?? 1,
      auto_renew: !!o.autoRenew,
      instalment_count: o.instalmentCount ?? null,
      session_count: o.sessionCount ?? null,
      prorata: !!o.prorata,
      due_date: o.dueDate ?? null,
      deposit_percent: o.depositPercent != null ? Number(o.depositPercent) : null,
      description: o.description ?? null,
      sort_order: o.sortOrder ?? 0,
      status: o.status ?? 'active',
      items: (o.items || []).map((it: any) => ({
        id: it.id,
        option_id: it.optionId,
        name: it.name,
        amount: Number(it.amount) || 0,
        account: it.account ?? null,
        sort_order: it.sortOrder ?? 0,
      })),
    }
  }

  // Normalise the type-specific columns for one option (which cols apply per fee_type)
  // + shape it for the seam (camelCase). Mirrors the legacy optionCols/optionItemRows.
  function toSeamOption(o: GroupFeeOption) {
    const recurring = o.fee_type === 'recurring'
    return {
      name: o.name?.trim() || feeTypeLabel(o.fee_type),
      feeType: o.fee_type,
      periodUnit: recurring ? (o.period_unit || 'month') : null,
      periodCount: recurring ? (o.period_count || 1) : 1,
      autoRenew: recurring ? !!o.auto_renew : false,
      instalmentCount: o.fee_type === 'instalment' ? (o.instalment_count || 1) : null,
      sessionCount: (o.fee_type === 'concession' || o.fee_type === 'per_session') ? (o.session_count ?? null) : null,
      prorata: o.fee_type === 'upfront' ? !!o.prorata : false,
      dueDate: o.due_date || null,
      depositPercent: (o.deposit_percent === 0 || o.deposit_percent) ? o.deposit_percent : null,
      description: o.description || null,
      status: o.status || 'active',
      items: (o.items || [])
        .filter((i) => (i.name && i.name.trim()) || Number(i.amount))
        .map((i, idx) => ({
          name: i.name?.trim() || null,
          amount: Number(i.amount) || 0,
          account: i.account || null,
          sortOrder: idx,
        })),
    }
  }

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
    const opts = await api.feeOptions(groupId)
    return opts.map(toSnake)
  }

  // Save the whole set for a group (delete-then-insert, in the seam).
  async function saveFeeOptions(groupId: string, options: GroupFeeOption[]): Promise<void> {
    await api.saveFeeOptions(groupId, orgId.value, options.map(toSeamOption))
  }

  // APPEND one fee option to several groups at once (bulk add — doesn't touch
  // a group's existing options). Returns how many groups it was added to.
  async function addFeeOptionToGroups(groupIds: string[], option: GroupFeeOption): Promise<number> {
    if (!groupIds.length) return 0
    await api.addFeeOptionToGroups(orgId.value, groupIds, toSeamOption(option))
    return groupIds.length
  }

  return { FEE_TYPES, fmtMoney, feeTypeLabel, optionTotal, priceLabel, loadFeeOptions, saveFeeOptions, addFeeOptionToGroups }
}
