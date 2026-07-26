/**
 * THE person-gender vocabulary — one place, used everywhere a gender is picked or shown.
 *
 * The DB stores gender in caps (`persons.gender` = MALE | FEMALE | NON_BINARY |
 * UNSPECIFIED) because it's a code, not a word. Nothing user-facing may print the raw
 * code: `genderLabel()` turns it into the human label ("Non-binary", not NON_BINARY).
 *
 * Named `PERSON_GENDERS` rather than GENDER_OPTIONS because `useClassFinder` already
 * auto-imports a GENDER_OPTIONS (its filter list, which carries an "Any" entry) — two
 * auto-imported exports sharing one name is a silent last-wins collision.
 */
export type GenderOption = { label: string; value: string }

export const PERSON_GENDERS: GenderOption[] = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Non-binary', value: 'NON_BINARY' },
  { label: 'Unspecified', value: 'UNSPECIFIED' },
]

/** Human label for a stored gender code. Unknown/blank → '' (callers supply their own dash). */
export const genderLabel = (v: string | null | undefined): string => {
  if (!v) return ''
  const hit = PERSON_GENDERS.find(g => g.value === String(v).toUpperCase())
  if (hit) return hit.label
  // Unknown code (legacy free text): sentence-case it rather than shout it.
  const s = String(v).replace(/_/g, '-')
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
