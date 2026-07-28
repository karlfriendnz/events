/**
 * Client for the OLD FriendlyManager platform's API.
 *
 * The old platform is the source of truth for club data (people, classes,
 * terms, venues, categories) and the destination for the things a club already
 * runs its business on (its calendar, attendance, fees). This module owns the
 * event model; everything else is read through, never copied.
 *
 * Endpoints live in the old platform at classes/Api/fmevents.php and are
 * reached at {base}/api/v1/fmevents/{method}.
 *
 * ALWAYS server-side. The API key is per club and must never reach a browser,
 * which is also why CORS is irrelevant to this integration.
 */

export interface LegacyClub {
  /** Hostname label the old platform derives CLUB_NAME from, e.g. "demo". */
  slug: string
  baseUrl: string
  apiKey: string
  /**
   * The fm-events organisation this legacy club maps to. The events UI is built
   * around an organisation (useOrg().orgId), so the embedded module needs one
   * to render as.
   */
  orgId: string | null
}

/**
 * Legacy club → fm-events organisation.
 *
 * A stopgap while one club is wired up by hand. When clubs are provisioned
 * properly this becomes a column on `organisations` (legacy slug + API key),
 * which is also what makes the API key per-club rather than per-deployment.
 */
const ORG_BY_SLUG: Record<string, string> = {
  demo: '009b7f5e-6dde-4b26-8910-2c22e2f1443d',
}

export interface LegacyPerson {
  id: number
  firstName: string
  lastName: string
  email: string | null
  role: number
  roleName?: string | null
}

/**
 * Resolve a club's legacy connection.
 *
 * Single-club for now, from env. When several clubs run against this, it
 * becomes a lookup (organisations row or a config table) — the shape of the
 * return value is what the rest of the code depends on, so that swap is local.
 */
export function legacyClub(slug?: string): LegacyClub | null {
  const baseUrl = process.env.LEGACY_API_URL
  const apiKey = process.env.LEGACY_API_KEY
  if (!baseUrl || !apiKey) return null
  const configured = process.env.LEGACY_CLUB_SLUG || 'demo'
  // A mismatched slug means the iframe is pointing at a club we hold no key
  // for — refuse rather than silently serving another club's data.
  if (slug && slug !== configured) return null

  let url = baseUrl.replace(/\/$/, '')
  // A local DDEV old-platform serves both http and https, but its https uses a
  // self-signed certificate Node will not trust. Server-to-server on localhost,
  // so plain http costs nothing here — and this never applies to a real host.
  if (url.includes('.ddev.site')) url = url.replace(/^https:/, 'http:')

  const orgId = process.env.LEGACY_ORG_ID || ORG_BY_SLUG[configured] || null

  return { slug: configured, baseUrl: url, apiKey, orgId }
}

async function call<T>(
  club: LegacyClub,
  method: string,
  opts: { query?: Record<string, any>; body?: any } = {},
): Promise<T> {
  const url = `${club.baseUrl}/api/v1/fmevents/${method}`
  try {
    return await $fetch<T>(url, {
      method: opts.body ? 'POST' : 'GET',
      query: opts.query,
      body: opts.body,
      headers: { Authorization: `token ${club.apiKey}` },
    })
  } catch (e: any) {
    const message = e?.data?.error?.message || e?.message || 'Legacy API request failed'
    throw createError({ statusCode: e?.statusCode || 502, statusMessage: `Legacy API: ${message}` })
  }
}

/** Prefix marking an id as belonging to the OLD platform, not this module. */
export const LEGACY_ID_PREFIX = 'legacy-'

/**
 * The club's timezone, cached for the process.
 *
 * The old platform stores dates and times as WALL CLOCK with no zone, so any
 * comparison against an absolute timestamp has to be done in the club's own
 * zone. Reading it from the server's zone works only on a machine set to the
 * club's — which is true on a developer's laptop and false on Vercel, where
 * everything runs UTC. That is exactly the kind of bug that shows up as "the
 * booked venue says it's free".
 */
let cachedTz: string | null = null

export async function clubTimezone(club: LegacyClub): Promise<string> {
  if (cachedTz) return cachedTz
  try {
    const info = await legacy.club(club)
    cachedTz = info?.timezone || 'UTC'
  } catch {
    cachedTz = 'UTC'
  }
  return cachedTz!
}

/**
 * An absolute instant, expressed as the club's wall clock and parsed the same
 * naive way the legacy strings are — so both sides of an overlap test are
 * comparable no matter what zone the server runs in.
 */
export function wallClockMs(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  // "24" is how some locales render midnight; Date would roll it to the next day.
  const hour = get('hour') === '24' ? '00' : get('hour')
  return new Date(
    `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`,
  ).getTime()
}

export const isLegacyId = (id: string) => id.startsWith(LEGACY_ID_PREFIX)
export const legacyIdOf = (id: string) => Number(id.slice(LEGACY_ID_PREFIX.length))

/**
 * Map an event from the old platform into the shape this module's calendar
 * speaks, so the club sees ONE calendar rather than "the new events" and "the
 * old events" side by side.
 *
 * Carried through as READ-ONLY (sharedFromOrgName set, which the board already
 * renders with an icon and refuses to open in the editor). The old platform
 * remains the owner: it holds fields this module has no column for, and the
 * venues module has not moved across, so a round-trip edit could quietly drop
 * what it does not understand.
 *
 * Everything the schema requires is filled — nulls and falses for anything the
 * flat legacy row simply does not have.
 */
export function legacyEventToFm(e: any, orgId: string, sharedFrom: string) {
  const at = (date?: string | null, time?: string | null) => {
    if (!date || date.startsWith('0000')) return null
    return `${date}T${time && time !== '00:00:00' ? time : '00:00:00'}`
  }

  return {
    id: `${LEGACY_ID_PREFIX}${e.id}`,
    orgId,
    title: e.name || 'Untitled',
    description: e.notes || null,
    style: 'BASIC',
    status: 'PUBLISHED',
    startAt: at(e.date, e.startTime),
    endAt: at(e.endDate || e.date, e.endTime),
    isPublic: !!e.isPublic,
    // Legacy type 6 is TYPE_PROGRAM — a holiday-programme day.
    isProgramme: e.type === 6,
    formId: null,
    memberGroupId: null,
    categoryId: null,
    categoryIds: null,
    bannerUrl: null,
    bannerPosition: null,
    // The old platform resolves the venue name into `location` for us, which is
    // what the club needs to see while the venues module stays over there.
    locationType: 'ADDRESS',
    bookableId: null,
    address: e.location || null,
    meetingLink: null,
    locations: null,
    ageMin: null,
    ageMax: null,
    genderRestriction: null,
    visibility: e.isPublic ? 'public' : 'internal',
    visibilityTypeKeys: null,
    visibilityPersonIds: null,
    visibilityGroupIds: null,
    recurrenceRule: null,
    recurrenceParentId: null,
    createdVia: 'legacy',
    exdates: [],
    isAllDay: !!e.allDay,
    secondaryCategoryId: null,
    capacityMin: null,
    capacityMax: e.maxAttendees ?? null,
    showAttendeeList: false,
    showAttendeeCount: false,
    allowInterest: false,
    allowGuests: false,
    maxGuestsPerInvitee: null,
    holdSpotEnabled: false,
    holdSpotAgeMax: null,
    phasedRegistration: false,
    memberWindowDays: 0,
    publicOpensAt: null,
    masterEventId: null,
    isFeatured: false,
    publicUrlSlug: null,
    tcContent: null,
    hasWaitlist: false,
    hasTickets: false,
    regOpenAt: null,
    regCloseAt: e.closeDate && !String(e.closeDate).startsWith('0000') ? `${e.closeDate}T00:00:00` : null,
    publishAt: null,
    notes: null,
    hideBanner: false,
    xeroCodesLocked: false,
    memberGroupScheduleId: null,
    attachments: null,
    subGroups: null,
    sharingConfig: null,
    automation: null,
    invitationEmail: null,
    sharedFromOrgName: sharedFrom,
    disciplineName: null,
  }
}

/**
 * Map a venue from the old platform into the shape this module's venue pickers
 * speak.
 *
 * The venues module has NOT moved across, so these are the club's only real
 * venues — without this, every venue picker in the new module is empty and
 * staff have to retype an address that already exists next door.
 *
 * Marked closed-for-booking (`status: 'INACTIVE'`, no concurrency) because this
 * module cannot take a booking against a venue the old platform owns; they are
 * here to be NAMED on an event, not reserved.
 */
export function legacyVenueToBookable(v: any, orgId: string) {
  return {
    id: `${LEGACY_ID_PREFIX}${v.id}`,
    orgId,
    name: v.name,
    internalName: null,
    type: 'VENUE',
    status: 'ACTIVE',
    parentId: v.parentID ? `${LEGACY_ID_PREFIX}${v.parentID}` : null,
    masterId: null,
    isMaster: false,
    isSlaveAutoAssign: false,
    isPublic: true,
    isNetwork: false,
    maxConcurrent: 0,
    location: v.location || null,
    showLocation: true,
    description: v.description || null,
    features: [],
    rules: null,
    images: [],
    categories: [],
    sports: [],
    customFields: {},
    sortOrder: Number(v.order) || 0,
    itemCategory: null,
    defaultBookingView: null,
    closedFrom: null,
    closedUntil: null,
    closureReason: null,
    customizedSections: [],
    mainImage: null,
    sponsorImage: null,
    showInMenu: false,
    sections: [],
    spaceType: null,
    bookingLimitType: 'NONE',
    bookingLimitCount: null,
    disallowConcurrent: false,
    disallowConsecutive: false,
    allowModesWithOthers: true,
    allowSubVenues: true,
    autoResolveChildren: false,
    accessEnabled: false,
    accessCodeDelivery: 'none',
    accessCodeLength: 0,
    accessUnlockBeforeMins: 0,
    accessUnlockAfterMins: 0,
    lightingRampUpMins: 0,
    lightingRampDownMins: 0,
    lightingLevelPercent: 0,
  }
}

export const legacy = {
  /**
   * Exchange the single-use login token the old platform put in the iframe URL
   * for the person behind it. The token is consumed by this call.
   */
  whoami: (club: LegacyClub, logintoken: string) =>
    call<{ person: LegacyPerson; club: { id: string; name: string; settings: Record<string, any> } }>(
      club, 'whoami', { query: { logintoken } },
    ),

  club: (club: LegacyClub) => call<any>(club, 'club'),
  categories: (club: LegacyClub) => call<any[]>(club, 'categories'),
  venues: (club: LegacyClub) => call<any[]>(club, 'venues'),
  terms: (club: LegacyClub) => call<any[]>(club, 'terms'),
  codes: (club: LegacyClub) => call<any[]>(club, 'codes'),
  groups: (club: LegacyClub) => call<any[]>(club, 'groups'),
  roster: (club: LegacyClub, groupID: number, termID?: number) =>
    call<any[]>(club, 'roster', { query: { groupID, ...(termID ? { termID } : {}) } }),
  customFields: (club: LegacyClub) => call<any[]>(club, 'customFields'),

  events: (club: LegacyClub, start: string, end: string) =>
    call<any[]>(club, 'events', { query: { start, end } }),
  event: (club: LegacyClub, eventID: number) =>
    call<any>(club, 'event', { query: { eventID } }),
  fees: (club: LegacyClub, eventID: number) =>
    call<any[]>(club, 'fees', { query: { eventID } }),
  personEvents: (club: LegacyClub, personID: number) =>
    call<any[]>(club, 'personEvents', { query: { personID } }),
  programs: (club: LegacyClub) => call<any[]>(club, 'programs'),
  attendance: (club: LegacyClub, eventID: number) =>
    call<any[]>(club, 'attendance', { query: { eventID } }),

  saveEvent: (club: LegacyClub, body: Record<string, any>) =>
    call<{ eventID: number; created: boolean }>(club, 'event', { body }),
  deleteEvent: (club: LegacyClub, eventID: number) =>
    call<any>(club, 'eventDelete', { body: { eventID } }),
  saveAttendance: (club: LegacyClub, eventID: number, entries: any[]) =>
    call<any>(club, 'attendance', { body: { eventID, entries } }),
  charge: (club: LegacyClub, body: Record<string, any>) =>
    call<any>(club, 'fee', { body }),
}
