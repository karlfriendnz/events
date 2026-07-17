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
  return {
    discounts,
    createDiscount,
    updateDiscount,
    removeDiscount,
    bookingDiscounts,
    xeroConnection,
  }
}
