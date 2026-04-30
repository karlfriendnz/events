export interface Division {
  key: string
  label: string
  description: string
  sections: string[]
}

export interface VenueTemplate {
  key: string
  label: string
  emoji: string
  space_type: string
  divisions: Division[]
}

export interface GeneratedLayout {
  name: string
  sections: string[]
  group?: string
}

export const VENUE_TEMPLATES: VenueTemplate[] = [
  {
    key: 'football',
    label: 'Football Field',
    emoji: '⚽',
    space_type: 'football',
    divisions: [
      { key: 'full',     label: 'Full field',  description: 'One undivided field',   sections: ['Full Field'] },
      { key: 'halves',   label: 'Halves',       description: '2 equal halves',        sections: ['North Half', 'South Half'] },
      { key: 'thirds',   label: 'Thirds',       description: '3 equal thirds',        sections: ['North Third', 'Middle Third', 'South Third'] },
      { key: 'quarters', label: 'Quarters',     description: '4 equal quarters',      sections: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'] },
      { key: 'sixths',   label: 'Sixths',       description: '6 equal sections',      sections: ['Sixth 1', 'Sixth 2', 'Sixth 3', 'Sixth 4', 'Sixth 5', 'Sixth 6'] },
      { key: 'eighths',  label: 'Eighths',      description: '8 equal sections',      sections: ['Eighth 1', 'Eighth 2', 'Eighth 3', 'Eighth 4', 'Eighth 5', 'Eighth 6', 'Eighth 7', 'Eighth 8'] },
    ],
  },
  {
    key: 'basketball',
    label: 'Basketball Court',
    emoji: '🏀',
    space_type: 'basketball',
    divisions: [
      { key: 'full',     label: 'Full court',   description: 'One undivided court',   sections: ['Full Court'] },
      { key: 'halves',   label: 'Halves',       description: '2 equal halves',        sections: ['Half 1', 'Half 2'] },
      { key: 'quarters', label: 'Quarters',     description: '4 equal quarters',      sections: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'] },
    ],
  },
  {
    key: 'netball',
    label: 'Netball Court',
    emoji: '🏐',
    space_type: 'generic',
    divisions: [
      { key: 'full',   label: 'Full court', description: 'One undivided court',       sections: ['Full Court'] },
      { key: 'halves', label: 'Halves',     description: '2 equal halves',            sections: ['Half 1', 'Half 2'] },
      { key: 'thirds', label: 'Thirds',     description: 'Goal / Centre / Goal',      sections: ['Goal Third', 'Centre Third', 'Shooting Third'] },
    ],
  },
  {
    key: 'tennis',
    label: 'Tennis Court',
    emoji: '🎾',
    space_type: 'generic',
    divisions: [
      { key: 'full',   label: 'Full court', description: 'One undivided court',       sections: ['Full Court'] },
      { key: 'halves', label: 'Halves',     description: 'Split across the net',      sections: ['Half 1', 'Half 2'] },
    ],
  },
  {
    key: 'squash',
    label: 'Squash Court',
    emoji: '🟥',
    space_type: 'generic',
    divisions: [
      { key: '1court',  label: '1 Court',   description: 'Single court',              sections: ['Court 1'] },
      { key: '2courts', label: '2 Courts',  description: '2 individual courts',       sections: ['Court 1', 'Court 2'] },
      { key: '3courts', label: '3 Courts',  description: '3 individual courts',       sections: ['Court 1', 'Court 2', 'Court 3'] },
      { key: '4courts', label: '4 Courts',  description: '4 individual courts',       sections: ['Court 1', 'Court 2', 'Court 3', 'Court 4'] },
      { key: '6courts', label: '6 Courts',  description: '6 individual courts',       sections: ['Court 1', 'Court 2', 'Court 3', 'Court 4', 'Court 5', 'Court 6'] },
    ],
  },
  {
    key: 'pool',
    label: 'Swimming Pool',
    emoji: '🏊',
    space_type: 'pool',
    divisions: [
      { key: 'full',    label: 'Full pool',   description: 'All lanes as one booking', sections: ['Full Pool'] },
      { key: '1lane',   label: '1 Lane',      description: '1 individual lane',        sections: ['Lane 1'] },
      { key: '2lanes',  label: '2 Lanes',     description: '2 individual lanes',       sections: ['Lane 1', 'Lane 2'] },
      { key: '3lanes',  label: '3 Lanes',     description: '3 individual lanes',       sections: ['Lane 1', 'Lane 2', 'Lane 3'] },
      { key: '4lanes',  label: '4 Lanes',     description: '4 individual lanes',       sections: ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4'] },
      { key: '5lanes',  label: '5 Lanes',     description: '5 individual lanes',       sections: ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4', 'Lane 5'] },
      { key: '6lanes',  label: '6 Lanes',     description: '6 individual lanes',       sections: ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4', 'Lane 5', 'Lane 6'] },
      { key: '7lanes',  label: '7 Lanes',     description: '7 individual lanes',       sections: ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4', 'Lane 5', 'Lane 6', 'Lane 7'] },
      { key: '8lanes',  label: '8 Lanes',     description: '8 individual lanes',       sections: ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4', 'Lane 5', 'Lane 6', 'Lane 7', 'Lane 8'] },
    ],
  },
  {
    key: 'cricket',
    label: 'Cricket Ground',
    emoji: '🏏',
    space_type: 'generic',
    divisions: [
      { key: 'full',    label: 'Full ground', description: 'One undivided ground',    sections: ['Full Ground'] },
      { key: '2pitch',  label: '2 Pitches',   description: '2 individual pitches',    sections: ['Pitch 1', 'Pitch 2'] },
      { key: '3pitch',  label: '3 Pitches',   description: '3 individual pitches',    sections: ['Pitch 1', 'Pitch 2', 'Pitch 3'] },
      { key: '4pitch',  label: '4 Pitches',   description: '4 individual pitches',    sections: ['Pitch 1', 'Pitch 2', 'Pitch 3', 'Pitch 4'] },
    ],
  },
  {
    key: 'hall',
    label: 'Sports Hall',
    emoji: '🏛️',
    space_type: 'hall',
    divisions: [
      { key: 'full',     label: 'Full hall',  description: 'Entire hall undivided',   sections: ['Full Hall'] },
      { key: 'halves',   label: 'Halves',     description: '2 equal halves',          sections: ['Half 1', 'Half 2'] },
      { key: 'thirds',   label: 'Thirds',     description: '3 equal thirds',          sections: ['Third 1', 'Third 2', 'Third 3'] },
      { key: 'quarters', label: 'Quarters',   description: '4 equal quarters',        sections: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'] },
    ],
  },
  {
    key: 'generic',
    label: 'Generic Space',
    emoji: '⬜',
    space_type: 'generic',
    divisions: [
      { key: 'full',     label: 'Single',     description: 'One undivided space',     sections: ['Full Space'] },
      { key: 'halves',   label: 'Halves',     description: '2 equal halves',          sections: ['Half 1', 'Half 2'] },
      { key: 'thirds',   label: 'Thirds',     description: '3 equal thirds',          sections: ['Third 1', 'Third 2', 'Third 3'] },
      { key: 'quarters', label: 'Quarters',   description: '4 equal quarters',        sections: ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'] },
      { key: 'sixths',   label: 'Sixths',     description: '6 equal sections',        sections: ['Sixth 1', 'Sixth 2', 'Sixth 3', 'Sixth 4', 'Sixth 5', 'Sixth 6'] },
      { key: 'eighths',  label: 'Eighths',    description: '8 equal sections',        sections: ['Eighth 1', 'Eighth 2', 'Eighth 3', 'Eighth 4', 'Eighth 5', 'Eighth 6', 'Eighth 7', 'Eighth 8'] },
    ],
  },
]

/**
 * Auto-generate booking layouts from a section list.
 * Produces Full, Halves, Thirds, Quarters, Sixths, Eighths — based on divisibility.
 * Individual sections are always added if n > 1.
 */
export function generateLayouts(sections: string[]): GeneratedLayout[] {
  const n = sections.length
  if (n === 0) return []

  const result: GeneratedLayout[] = []
  const mk = (name: string, secs: string[], group?: string): GeneratedLayout => ({ name, sections: secs, group })

  if (n === 1) {
    result.push(mk(sections[0], sections))
    return result
  }

  // Full — no group (single option, shown as its own card)
  result.push(mk('Full', [...sections]))

  // Track smallest section-count per derived fraction group (to avoid redundant "Single")
  let smallestFractionSize = n

  // Halves
  if (n % 2 === 0) {
    const half = n / 2
    result.push(mk('Half 1', sections.slice(0, half), 'Half'))
    result.push(mk('Half 2', sections.slice(half), 'Half'))
    if (half < smallestFractionSize) smallestFractionSize = half
  }

  // Thirds
  if (n % 3 === 0) {
    const t = n / 3
    for (let i = 0; i < 3; i++)
      result.push(mk(`Third ${i + 1}`, sections.slice(i * t, i * t + t), 'Third'))
    if (t < smallestFractionSize) smallestFractionSize = t
  }

  // Quarters
  if (n % 4 === 0) {
    const q = n / 4
    for (let i = 0; i < 4; i++)
      result.push(mk(`Quarter ${i + 1}`, sections.slice(i * q, i * q + q), 'Quarter'))
    if (q < smallestFractionSize) smallestFractionSize = q
  }

  // Sixths
  if (n % 6 === 0) {
    const s = n / 6
    for (let i = 0; i < 6; i++)
      result.push(mk(`Sixth ${i + 1}`, sections.slice(i * s, i * s + s), 'Sixth'))
    if (s < smallestFractionSize) smallestFractionSize = s
  }

  // Eighths
  if (n % 8 === 0) {
    const e = n / 8
    for (let i = 0; i < 8; i++)
      result.push(mk(`Eighth ${i + 1}`, sections.slice(i * e, i * e + e), 'Eighth'))
    if (e < smallestFractionSize) smallestFractionSize = e
  }

  // Individual sections — only add when no derived fraction already covers singles (e.g. prime counts).
  // When the smallest fraction size is already 1, the derived groups ARE the individual sections.
  if (n > 1 && smallestFractionSize > 1) {
    for (const sec of sections)
      result.push(mk(sec, [sec]))  // ungrouped — shown as individual cards
  }

  return result
}
