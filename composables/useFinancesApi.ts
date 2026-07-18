// The client side of the seam for finances (discounts + Xero). Components call this —
// never useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the data
// came from MySQL today or the backend team's API tomorrow.
import type {
  Discount,
  DiscountCreate,
  DiscountPatch,
  BookingDiscount,
  XeroConnection,
  FeeComponent,
  Addon,
  AddonCreate,
  ReportingBundle,
  AttendanceSession,
} from '../shared/contracts/finance'

export function useFinancesApi() {
  /** Every event discount for an org. */
  async function discounts(orgId: string): Promise<Discount[]> {
    return await $fetch<Discount[]>('/api/v1/discounts', { query: { orgId } })
  }
  async function createDiscount(input: DiscountCreate): Promise<Discount> {
    return await $fetch<Discount>('/api/v1/discounts', { method: 'POST', body: input })
  }
  async function updateDiscount(id: string, patch: DiscountPatch): Promise<Discount> {
    return await $fetch<Discount>(`/api/v1/discounts/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeDiscount(id: string): Promise<void> {
    await $fetch(`/api/v1/discounts/${id}`, { method: 'DELETE' })
  }
  /** Every booking (resource) discount for an org. */
  async function bookingDiscounts(orgId: string): Promise<BookingDiscount[]> {
    return await $fetch<BookingDiscount[]>('/api/v1/booking-discounts', { query: { orgId } })
  }
  /** An org's Xero connection — null when Xero isn't connected. */
  async function xeroConnection(orgId: string): Promise<XeroConnection | null> {
    return await $fetch<XeroConnection | null>('/api/v1/xero-connection', { query: { orgId } })
  }
  /** Every fee component for an org (read-only on the finances screen). */
  async function feeComponents(orgId: string): Promise<FeeComponent[]> {
    return await $fetch<FeeComponent[]>('/api/v1/finances/fee-components', { query: { orgId } })
  }
  /** Every add-on for an org. */
  async function addons(orgId: string): Promise<Addon[]> {
    return await $fetch<Addon[]>('/api/v1/finances/addons', { query: { orgId } })
  }
  async function createAddon(input: AddonCreate): Promise<Addon> {
    return await $fetch<Addon>('/api/v1/finances/addons', { method: 'POST', body: input })
  }
  async function removeAddon(id: string): Promise<void> {
    await $fetch(`/api/v1/finances/addons/${id}`, { method: 'DELETE' })
  }
  /** The org's ISO currency code (defaults NZD) — for money formatting. */
  async function orgCurrency(orgId: string): Promise<string> {
    const res = await $fetch<{ currency: string }>('/api/v1/finances/org-currency', { query: { orgId } })
    return res.currency
  }
  /** The /reporting dashboard rollup (events + category + invitee statuses). */
  async function reportingBundle(orgId: string): Promise<ReportingBundle> {
    return await $fetch<ReportingBundle>('/api/v1/finances/reporting', { query: { orgId } })
  }
  /** Group-linked training event occurrences in a date window [from, to). */
  async function attendanceSessions(orgId: string, from: string, to: string): Promise<AttendanceSession[]> {
    return await $fetch<AttendanceSession[]>('/api/v1/finances/attendance-sessions', {
      query: { orgId, from, to },
    })
  }
  return {
    discounts,
    createDiscount,
    updateDiscount,
    removeDiscount,
    bookingDiscounts,
    xeroConnection,
    feeComponents,
    addons,
    createAddon,
    removeAddon,
    orgCurrency,
    reportingBundle,
    attendanceSessions,
  }
}
