// THE age helper. Before this there were five divergent copies (useTeamAllocator,
// useCustomReports, pages/people/[id], pages/dashboard, FormRenderer) — two with
// no sanity clamp, one taking a Date instead of a string, and only one able to age
// someone at a date other than today.
//
// Named export, so Nuxt auto-imports it — callers need no import statement.

/**
 * Whole years from a date of birth, at a reference date.
 *
 * Returns null when the dob is unknown, unparseable, or nonsensical (negative, or
 * 130+) — a typo'd date reports nothing rather than a confident 126.
 *
 * `asOf` exists because ages are not always taken today: <FormRenderer> ages a
 * registrant at the event's start date, not at submit time.
 */
export function ageFromDob(dob: string | Date | null | undefined, asOf: Date = new Date()): number | null {
  if (!dob) return null
  const d = dob instanceof Date ? dob : new Date(dob)
  if (isNaN(d.getTime())) return null
  const ref = asOf instanceof Date && !isNaN(asOf.getTime()) ? asOf : new Date()
  let age = ref.getFullYear() - d.getFullYear()
  const m = ref.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}
