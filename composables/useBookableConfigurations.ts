/**
 * Bookable configuration helper. A configuration is a named group of
 * slots over a parent venue's sub-venues — booking a slot reserves every
 * member sub-venue atomically.
 *
 * Used by:
 * - components/SetupWizard.vue        (initial sport setup)
 * - pages/bookables/[id].vue          (manual create + edit dialog,
 *                                      template apply, sibling sync)
 */

export interface ConfigSlot {
  /** Display name for the slot (e.g. "Half A"). */
  name: string
  /** Sub-venue ids that get booked atomically when this slot is reserved. */
  childIds: string[]
}

export function useBookableConfigurations() {
  const api = useBookingsApi()

  /**
   * Idempotent save. Re-applying the same `key` for the same parent
   * replaces the membership wholesale (not a merge). Each slot is fanned
   * out into N rows in `bookable_configuration_children` sharing
   * `slot_index` + `slot_name`, so a multi-member slot like "Half A =
   * {Q1, Q2}" persists correctly.
   *
   * Empty slots are filtered out — saving with no member ids on any
   * slot is a no-op (the configuration row is left untouched). The
   * slot-aware save now lives in the bookings repo behind the seam.
   */
  async function saveConfiguration(
    parentBookableId: string,
    key: string,
    name: string,
    slots: ConfigSlot[],
  ): Promise<string | null> {
    return await api.saveConfiguration(parentBookableId, key, name, slots)
  }

  /**
   * Backward-compat helper for callers that still pass a flat array of
   * child ids — each child becomes a single-member slot named after the
   * child (looked up via the supplied resolver), or "Slot N" as a
   * fallback. Used by the old applyVenueTemplate path which only ever
   * builds one division at a time.
   */
  async function saveConfigurationFromChildIds(
    parentBookableId: string,
    key: string,
    name: string,
    childIds: string[],
    resolveName: (childId: string) => string | null = () => null,
  ): Promise<string | null> {
    const slots = childIds.map((cid, i) => ({
      name: resolveName(cid) ?? `Slot ${i + 1}`,
      childIds: [cid],
    }))
    return saveConfiguration(parentBookableId, key, name, slots)
  }

  return { saveConfiguration, saveConfigurationFromChildIds }
}
