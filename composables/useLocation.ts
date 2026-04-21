export interface LocationEntry {
  type: 'ADDRESS' | 'ONLINE' | 'BOOKABLE'
  venue_name: string
  address: string
  meeting_link: string
  bookable_ids: string[]
  bookable_layouts?: Record<string, string> // bookable_id → selected layout name
}

export function locationSummary(locs: LocationEntry[]): string {
  if (!locs || !locs.length) return 'No location'
  return locs.map(loc => {
    if (loc.type === 'ADDRESS') {
      return [loc.venue_name, loc.address].filter(Boolean).join(', ') || 'No location'
    }
    if (loc.type === 'ONLINE') return loc.meeting_link || 'Online'
    if (loc.type === 'BOOKABLE') return 'Venue'
    return 'No location'
  }).join(' · ')
}
