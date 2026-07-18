// Org-scoped reset — the FK-safe clear the old in-page resetDatabase() did, moved
// behind the seam. Two modes:
//   resetOrgData(orgId) — wipe the org's OPERATIONAL data (events/sessions/bookings/
//     forms/discounts/venues/activities/calendars…) but KEEP persons + member groups.
//   deleteOrgTree(orgId) — delete the org itself and everything under it (its
//     descendant orgs + their data + people + groups + the org rows). For cleaning up
//     demo hierarchies.
// This file talks to Drizzle directly (it lives inside the seam, like a repository)
// and deletes deepest-children-first so no FK is left dangling.
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'

const s = schema

// Delete rows whose `col` is in a fetched id list. No-ops on an empty list so we
// never issue a `WHERE col IN ()` (and never touch another org's rows).
async function delIn(table: any, col: any, ids: string[]): Promise<void> {
  if (!ids.length) return
  await db.delete(table).where(inArray(col, ids))
}
async function delOrg(table: any, orgCol: any, orgId: string): Promise<void> {
  await db.delete(table).where(eq(orgCol, orgId))
}
async function idsOf(table: any, idCol: any, whereCol: any, whereVal: string): Promise<string[]> {
  const rows = await db.select({ id: idCol }).from(table).where(eq(whereCol, whereVal))
  return rows.map((r: any) => r.id)
}
async function idsIn(table: any, idCol: any, col: any, ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const rows = await db.select({ id: idCol }).from(table).where(inArray(col, ids))
  return rows.map((r: any) => r.id)
}

export async function resetOrgData(orgId: string): Promise<void> {
  if (!orgId) return

  // ── 1. Parent id lists (children scope off these) ──────────────
  const eIds = await idsOf(s.events, s.events.id, s.events.orgId, orgId)
  // registrations has no org_id — it's a child of events. Scope its ids by eventId.
  const rIds = await idsIn(s.registrations, s.registrations.id, s.registrations.eventId, eIds)
  const fIds = await idsOf(s.registrationForms, s.registrationForms.id, s.registrationForms.orgId, orgId)
  const cgIds = await idsOf(s.connectionGroups, s.connectionGroups.id, s.connectionGroups.orgId, orgId)
  const calIds = await idsOf(s.calendars, s.calendars.id, s.calendars.orgId, orgId)
  const bIds = await idsOf(s.bookables, s.bookables.id, s.bookables.orgId, orgId)
  const aIds = await idsOf(s.activities, s.activities.id, s.activities.orgId, orgId)
  const bdIds = await idsOf(s.bookingDiscounts, s.bookingDiscounts.id, s.bookingDiscounts.orgId, orgId)

  const sessIds = await idsIn(s.sessions, s.sessions.id, s.sessions.eventId, eIds)
  const bookIds = await idsIn(s.bookings, s.bookings.id, s.bookings.bookableId, bIds)
  const modeIds = await idsIn(s.activityModes, s.activityModes.id, s.activityModes.activityId, aIds)
  const configIds = await idsIn(s.bookableConfigurations, s.bookableConfigurations.id, s.bookableConfigurations.parentBookableId, bIds)
  const windowIds = await idsIn(s.bookingWindows, s.bookingWindows.id, s.bookingWindows.bookableId, bIds)

  // ── 2. Deepest children first ──────────────────────────────────
  // Registration children
  await delIn(s.registrationTicketItems, s.registrationTicketItems.registrationId, rIds)
  await delIn(s.registrationSessions, s.registrationSessions.registrationId, rIds)
  await delIn(s.transactions, s.transactions.registrationId, rIds)
  // Event children
  await delIn(s.attendance, s.attendance.eventId, eIds)
  await delIn(s.accessScans, s.accessScans.eventId, eIds)
  await delIn(s.physicalSchedules, s.physicalSchedules.eventId, eIds)
  await delIn(s.physicalSchedules, s.physicalSchedules.bookingId, bookIds)
  await delIn(s.eventDisciplines, s.eventDisciplines.eventId, eIds)
  await delIn(s.eventNotes, s.eventNotes.eventId, eIds)
  await delIn(s.eventTasks, s.eventTasks.eventId, eIds)
  await delIn(s.ticketTypes, s.ticketTypes.eventId, eIds)
  await delIn(s.invitees, s.invitees.eventId, eIds)
  await delIn(s.addons, s.addons.eventId, eIds)
  await delIn(s.feeComponents, s.feeComponents.eventId, eIds)
  await delIn(s.feeComponents, s.feeComponents.sessionId, sessIds)
  await delIn(s.discounts, s.discounts.eventId, eIds)
  await delIn(s.connectionGroupEvents, s.connectionGroupEvents.eventId, eIds)
  // connection_group_events.group_id IS the connection-group id (there's no separate
  // connectionGroupId column).
  await delIn(s.connectionGroupEvents, s.connectionGroupEvents.groupId, cgIds)
  // Form children
  await delIn(s.formFields, s.formFields.formId, fIds)
  await delIn(s.registrationFormTargets, s.registrationFormTargets.formId, fIds)
  // Calendar children
  await delIn(s.calendarCategories, s.calendarCategories.calendarId, calIds)
  // Bookable children
  await delIn(s.bookingItems, s.bookingItems.bookingId, bookIds)
  await delIn(s.availabilityRules, s.availabilityRules.bookableId, bIds)
  await delIn(s.bookableClosures, s.bookableClosures.bookableId, bIds)
  await delIn(s.bookableModes, s.bookableModes.bookableId, bIds)
  await delIn(s.bookableDoors, s.bookableDoors.bookableId, bIds)
  await delIn(s.bookableLightZones, s.bookableLightZones.bookableId, bIds)
  await delIn(s.bookableConfigurationChildren, s.bookableConfigurationChildren.configurationId, configIds)
  await delIn(s.bookingWindowSlots, s.bookingWindowSlots.windowId, windowIds)
  // Activity children
  await delIn(s.activityBookables, s.activityBookables.activityId, aIds)
  await delIn(s.activityGroups, s.activityGroups.activityId, aIds)
  await delIn(s.activityModeBookables, s.activityModeBookables.modeId, modeIds)
  await delIn(s.activityModeResources, s.activityModeResources.modeId, modeIds)
  await delIn(s.activityModeRequiredItems, s.activityModeRequiredItems.modeId, modeIds)
  // Booking-discount children
  await delIn(s.bookingDiscountActivities, s.bookingDiscountActivities.discountId, bdIds)
  await delIn(s.bookingDiscountActivityModes, s.bookingDiscountActivityModes.discountId, bdIds)

  // ── 3. Mid-level ───────────────────────────────────────────────
  await delIn(s.bookings, s.bookings.bookableId, bIds)
  await delIn(s.bookings, s.bookings.eventId, eIds)
  await delIn(s.activityModes, s.activityModes.activityId, aIds)
  await delIn(s.bookableConfigurations, s.bookableConfigurations.parentBookableId, bIds)
  await delIn(s.bookingWindows, s.bookingWindows.bookableId, bIds)
  await delIn(s.sessions, s.sessions.eventId, eIds)

  // ── 4. Event-scoped tables that have NO org_id (children of events) ──
  await delIn(s.registrations, s.registrations.eventId, eIds)
  await delIn(s.feeRules, s.feeRules.eventId, eIds)
  await delIn(s.feeRules, s.feeRules.sessionId, sessIds)
  await delIn(s.tasks, s.tasks.eventId, eIds)
  await delIn(s.communications, s.communications.eventId, eIds)

  // ── 5. Org-scoped roots ────────────────────────────────────────
  await delOrg(s.registrationForms, s.registrationForms.orgId, orgId)
  await delOrg(s.connectionGroups, s.connectionGroups.orgId, orgId)
  await delOrg(s.events, s.events.orgId, orgId)
  await delOrg(s.activities, s.activities.orgId, orgId)
  await delOrg(s.bookingDiscounts, s.bookingDiscounts.orgId, orgId)
  await delOrg(s.bookables, s.bookables.orgId, orgId)
  await delOrg(s.calendars, s.calendars.orgId, orgId)
  await delOrg(s.categories, s.categories.orgId, orgId)
  await delOrg(s.auditLog, s.auditLog.orgId, orgId)
}

// The whole subtree rooted at `orgId` — descendants deepest-first, then the org
// itself. For each org: clear its operational data (resetOrgData), then its people +
// member-group data, then the organisations row. Additive-safe: only touches tables
// we can org-scope.
export async function deleteOrgTree(orgId: string): Promise<void> {
  if (!orgId) return

  // Gather the org + every descendant via the parentId chain (breadth-first).
  const all: string[] = [orgId]
  let frontier: string[] = [orgId]
  while (frontier.length) {
    const kids = await db.select({ id: s.organisations.id })
      .from(s.organisations).where(inArray(s.organisations.parentId, frontier))
    const next = kids.map((k: any) => k.id).filter((id: string) => !all.includes(id))
    all.push(...next)
    frontier = next
  }

  // Deepest first so a parent org is removed after its children.
  for (const oid of all.reverse()) {
    await resetOrgData(oid)

    // Member-group data (memberships have no org_id — scope by the org's group ids).
    const groupIds = await idsOf(s.memberGroups, s.memberGroups.id, s.memberGroups.orgId, oid)
    await delIn(s.memberGroupMemberships, s.memberGroupMemberships.groupId, groupIds)
    await delOrg(s.memberGroupSchedules, s.memberGroupSchedules.orgId, oid)
    await delOrg(s.memberGroups, s.memberGroups.orgId, oid)
    await delOrg(s.groupCodes, s.groupCodes.orgId, oid)

    // People + type/sport config, then the org row.
    await delOrg(s.orgSports, s.orgSports.orgId, oid)
    await delOrg(s.personTargetTypes, s.personTargetTypes.orgId, oid)
    await delOrg(s.persons, s.persons.orgId, oid)
    await db.delete(s.organisations).where(eq(s.organisations.id, oid))
  }
}
