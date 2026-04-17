export interface FeeLineItem {
  id: string
  name: string
  xero_code: string
  amount: number | null
}

export interface FeeGroup {
  id: string
  name: string
  fees: FeeLineItem[]
}

export interface RegistrationTypeFees {
  id: string
  label: string
  is_charged: boolean
  has_base_fee: boolean
  base_fees: FeeLineItem[]
  all_charged_equally: boolean
  groups: FeeGroup[]
  _locked?: boolean
}

export function defaultRegistrationTypes(): RegistrationTypeFees[] {
  return [
    { id: 'member', label: 'Member Fees', is_charged: false, has_base_fee: false, base_fees: [], all_charged_equally: true, groups: [] },
    { id: 'guest', label: 'Guest Fees', is_charged: false, has_base_fee: false, base_fees: [], all_charged_equally: true, groups: [] },
    { id: 'public', label: 'Public Registration Fees', is_charged: false, has_base_fee: false, base_fees: [], all_charged_equally: true, groups: [] },
  ]
}

export function feeTotal(fees: FeeLineItem[]): string {
  return (fees ?? []).reduce((s, f) => s + (f.amount ?? 0), 0).toFixed(2)
}
