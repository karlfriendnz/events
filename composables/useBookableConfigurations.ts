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
  const db = useDb()

  /**
   * Idempotent save. Re-applying the same `key` for the same parent
   * replaces the membership wholesale (not a merge). Each slot is fanned
   * out into N rows in `bookable_configuration_children` sharing
   * `slot_index` + `slot_name`, so a multi-member slot like "Half A =
   * {Q1, Q2}" persists correctly.
   *
   * Empty slots are filtered out — saving with no member ids on any
   * slot is a no-op (the configuration row is left untouched).
   */
  async function saveConfiguration(
    parentBookableId: string,
    key: string,
    name: string,
    slots: ConfigSlot[],
  ): Promise<string | null> {
    const cleanSlots = slots.filter(s => s.childIds.length > 0)
    if (!cleanSlots.length) return null

    const { data: existing } = await (db.from as any)('bookable_configurations')
      .select('id').eq('parent_bookable_id', parentBookableId).eq('key', key).maybeSingle()
    let configId = existing?.id as string | undefined
    if (configId) {
      await (db.from as any)('bookable_configurations').update({ name }).eq('id', configId)
      await (db.from as any)('bookable_configuration_children').delete().eq('configuration_id', configId)
    } else {
      const { data: created } = await (db.from as any)('bookable_configurations')
        .insert({ parent_bookable_id: parentBookableId, key, name, sort_order: 0 })
        .select('id').single()
      configId = created?.id
    }
    if (!configId) return null

    const rows: any[] = []
    let sortOrder = 0
    for (let si = 0; si < cleanSlots.length; si++) {
      for (const bid of cleanSlots[si].childIds) {
        rows.push({
          configuration_id: configId,
          bookable_id: bid,
          sort_order: sortOrder++,
          slot_index: si,
          slot_name: cleanSlots[si].name,
        })
      }
    }
    if (rows.length) {
      await (db.from as any)('bookable_configuration_children').insert(rows)
    }
    return configId
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
