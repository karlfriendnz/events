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

export interface PersonTypeFeeGroup {
  id: string
  person_type: string
  fees: FeeLineItem[]
}

export interface SessionFeesConfig {
  is_charged: boolean
  all_charged_equally: boolean
  base_fees: FeeLineItem[]
  groups: PersonTypeFeeGroup[]
}

export const PERSON_TYPES = [
  { value: 'member', label: 'Member' },
  { value: 'guest', label: 'Guest' },
  { value: 'public', label: 'Public' },
]

export function defaultFeesConfig(): SessionFeesConfig {
  return {
    is_charged: false,
    all_charged_equally: true,
    base_fees: [],
    groups: [],
  }
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

export function getSessionFee(config: SessionFeesConfig | undefined, personType: string): number | null {
  if (!config?.is_charged) return 0
  if (config.all_charged_equally) {
    return (config.base_fees ?? []).reduce((s, f) => s + (f.amount ?? 0), 0)
  }
  const group = (config.groups ?? []).find(g => g.person_type === personType)
  if (!group) return null
  return (group.fees ?? []).reduce((s, f) => s + (f.amount ?? 0), 0)
}
