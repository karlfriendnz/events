// The SeedContext handed to every recipe. It bundles the repositories (the ONLY
// DB-aware layer — recipes go through these, never Drizzle directly), a running
// count accumulator, a log(), and a grab-bag of seed-only helpers. Math.random is
// fine here: this is offline seed code, not an app workflow.
import { randomUUID } from 'node:crypto'

import * as organisations from '../repositories/organisations'
import * as events from '../repositories/events'
import * as bookings from '../repositories/bookings'
import * as groups from '../repositories/groups'
import * as people from '../repositories/people'
import * as forms from '../repositories/forms'
import * as finances from '../repositories/finances'
import * as affiliations from '../repositories/affiliations'
import * as admin from '../repositories/admin'
import * as disciplines from '../repositories/disciplines'
import * as personTypes from '../repositories/personTypes'
import * as memberships from '../repositories/memberships'
import * as circles from '../repositories/circles'
import { resolveFlavour, type FlavourData } from './flavours'

export interface SeedRepos {
  organisations: typeof organisations
  events: typeof events
  bookings: typeof bookings
  groups: typeof groups
  people: typeof people
  forms: typeof forms
  finances: typeof finances
  affiliations: typeof affiliations
  admin: typeof admin
  disciplines: typeof disciplines
  personTypes: typeof personTypes
  memberships: typeof memberships
  circles: typeof circles
}

export class SeedContext {
  // The org a scope:'org' recipe targets. null for new-org / hierarchy recipes
  // until they create one (they don't rely on this).
  orgId: string
  readonly repos: SeedRepos
  // The resolved "club style" that themes block names (programmes/venues/events/sport).
  readonly flavour: FlavourData
  private readonly counts: Record<string, number> = {}
  private readonly logs: string[] = []

  constructor(orgId: string | null, flavourKey?: string | null) {
    this.orgId = orgId ?? ''
    this.flavour = resolveFlavour(flavourKey)
    this.repos = {
      organisations, events, bookings, groups, people, forms,
      finances, affiliations, admin, disciplines, personTypes, memberships, circles,
    }
  }

  // ── recording ──────────────────────────────────────────────────
  /** Tally `n` (default 1) of an entity kind for the run summary. */
  count(kind: string, n = 1): void {
    this.counts[kind] = (this.counts[kind] ?? 0) + n
  }
  snapshotCounts(): Record<string, number> {
    return { ...this.counts }
  }
  log(msg: string): void {
    this.logs.push(msg)
  }
  snapshotLog(): string[] {
    return [...this.logs]
  }

  // ── ids ────────────────────────────────────────────────────────
  id(): string {
    return randomUUID()
  }

  // ── random helpers (seed-only; Math.random is allowed here) ─────
  randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  chance(p: number): boolean {
    return Math.random() < p
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
  }
  pickN<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)))
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  // ── dates ──────────────────────────────────────────────────────
  /** ISO for `offsetDays` from today at the given local time. */
  dayIso(offsetDays: number, hour = 9, minute = 0): string {
    const dt = new Date()
    dt.setDate(dt.getDate() + offsetDays)
    dt.setHours(hour, minute, 0, 0)
    return dt.toISOString()
  }
  /** ISO date-only (YYYY-MM-DD) for `offsetDays` from today. */
  dayDate(offsetDays: number): string {
    const dt = new Date()
    dt.setDate(dt.getDate() + offsetDays)
    return dt.toISOString().slice(0, 10)
  }
}
