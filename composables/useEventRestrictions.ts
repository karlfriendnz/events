/**
 * Who can attend an event — the shared gender-restriction vocabulary used by the
 * event create wizards + the advanced editor (age lives on `events.age_min/max`).
 * Values mirror `persons.gender` (MALE | FEMALE | NON_BINARY); null = open to all.
 * Same shape as the group version in pages/groups/[id]/index.vue.
 */
export const GENDER_RESTRICTION_OPTIONS = [
  { label: 'Open to all', value: null },
  { label: 'Male only', value: 'MALE' },
  { label: 'Female only', value: 'FEMALE' },
  { label: 'Non-binary only', value: 'NON_BINARY' },
]

export const genderRestrictionLabel = (v: string | null | undefined) =>
  v ? (GENDER_RESTRICTION_OPTIONS.find(o => o.value === v)?.label ?? v) : ''

/**
 * "Ages 6–10" / "Ages 6+" / "Up to age 10" / '' — the ONE age phrasing. Every
 * surface that prints an age limit (event overview, form header, public page)
 * goes through this, so they can't drift into three different sentences.
 */
export const ageRangeLabel = (min?: number | null, max?: number | null) => {
  if (min != null && max != null) return `Ages ${min}–${max}`
  if (min != null) return `Ages ${min}+`
  if (max != null) return `Up to age ${max}`
  return ''
}

/**
 * The whole restriction as one line: "Ages 6–10 · Female only". '' = open to all.
 * This is the string shown as "Invitee Restrictions" on the form header and on
 * the event's own Overview row.
 */
export const restrictionSummary = (
  min?: number | null, max?: number | null, gender?: string | null,
) => [ageRangeLabel(min, max), genderRestrictionLabel(gender)].filter(Boolean).join(' · ')

/**
 * The form field label each restriction is checked against at registration
 * (`<FormRenderer>` reads answers BY LABEL). A restriction whose field isn't on
 * the form can't be enforced — the builder warns, using exactly these labels.
 */
export const RESTRICTION_FIELD_LABELS = { age: 'Date of Birth', gender: 'Gender' } as const

/**
 * Does a registration-form config collect a field with this label anywhere?
 *
 * A deep scan, because a designer config nests its fields per group/subject while a
 * legacy builder config is a flat list — both have to answer the same question. The
 * match is EXACT (case/space-insensitive) on purpose: it's the same lookup
 * `<FormRenderer>` does at submit time, so a looser match here would report a rule as
 * enforceable when the live form can't find the answer.
 */
export const configCollects = (config: any, label: string): boolean => {
  const want = label.trim().toLowerCase()
  const scan = (v: any): boolean => {
    if (Array.isArray(v)) return v.some(scan)
    if (v && typeof v === 'object') {
      if (typeof v.label === 'string' && v.label.trim().toLowerCase() === want) return true
      return Object.values(v).some(scan)
    }
    return false
  }
  return scan(config)
}
