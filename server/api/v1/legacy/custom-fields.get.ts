import { legacyClub, legacy } from '~~/server/utils/legacy'

/**
 * The club's OWN custom person fields.
 *
 * The attendance roll offers custom fields as columns, and for a club running on
 * the old platform those are ITS fields — "GNZ ID", whatever it has invented —
 * not the ones defined in this module. Reading ours put a column chooser in front
 * of a club listing fields none of its members have a value for.
 *
 * Returned in the shape the roll's column list already speaks (`key` + `label`),
 * where `key` is the platform's `CustomField.field` — the same key the values on
 * each roll row are stored under, so a column and its value line up.
 */
export default defineEventHandler(async () => {
  const club = legacyClub()
  if (!club) return []
  const rows: any[] = await legacy.customFields(club).catch(() => [])
  return (rows ?? [])
    .filter((f: any) => f?.field)
    .map((f: any) => ({ key: String(f.field), label: String(f.name || f.field) }))
})
