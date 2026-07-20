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
