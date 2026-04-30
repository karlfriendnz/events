// Lightweight RRULE expander supporting the patterns this app generates:
// FREQ, INTERVAL, BYDAY, BYMONTHDAY, COUNT, UNTIL.

const DAY_TO_NUM: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

export function parseRrule(rrule: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!rrule || rrule === 'NONE') return out
  for (const part of rrule.split(';')) {
    const [k, v] = part.split('=')
    if (k && v != null) out[k] = v
  }
  return out
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseUntil(s: string): Date | null {
  // RFC: 20250131T235959Z or 20250131
  if (!s) return null
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59)
}

/**
 * Expand a recurrence rule given a base date, returning the occurrence dates
 * (date-only, time stripped). Caps at `windowEnd` or maxCount whichever first.
 */
export function expandRrule(
  rrule: string,
  baseDate: Date,
  windowEnd: Date,
  maxCount = 365,
): Date[] {
  const r = parseRrule(rrule)
  if (!r['FREQ']) return [stripTime(baseDate)]

  const freq = r['FREQ']
  const interval = parseInt(r['INTERVAL'] ?? '1') || 1
  const count = r['COUNT'] ? parseInt(r['COUNT']) : null
  const until = r['UNTIL'] ? parseUntil(r['UNTIL']) : null
  const byDay = r['BYDAY']
    ? r['BYDAY'].split(',').map(d => DAY_TO_NUM[d.replace(/^-?\d+/, '')]).filter(n => n != null)
    : null
  const byMonthDay = r['BYMONTHDAY'] ? parseInt(r['BYMONTHDAY']) : null

  const stop = (d: Date) => (until && d > until) || (windowEnd && d > windowEnd)
  const out: Date[] = []
  const start = stripTime(baseDate)

  if (freq === 'DAILY') {
    const cur = new Date(start)
    while (!stop(cur) && out.length < maxCount && (count == null || out.length < count)) {
      out.push(new Date(cur))
      cur.setDate(cur.getDate() + interval)
    }
  } else if (freq === 'WEEKLY') {
    if (byDay && byDay.length) {
      // Walk forward week-by-week, emitting each chosen weekday in the week
      const weekStart = new Date(start)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday-anchored week
      const cur = new Date(weekStart)
      let weekIdx = 0
      while (!stop(cur) && out.length < maxCount) {
        for (const dow of byDay.sort((a, b) => a - b)) {
          const d = new Date(cur)
          d.setDate(cur.getDate() + dow)
          if (d < start) continue
          if (stop(d)) break
          if (count != null && out.length >= count) break
          out.push(new Date(d))
        }
        weekIdx++
        cur.setDate(cur.getDate() + 7 * interval)
      }
    } else {
      const cur = new Date(start)
      while (!stop(cur) && out.length < maxCount && (count == null || out.length < count)) {
        out.push(new Date(cur))
        cur.setDate(cur.getDate() + 7 * interval)
      }
    }
  } else if (freq === 'MONTHLY') {
    const cur = new Date(start)
    while (!stop(cur) && out.length < maxCount && (count == null || out.length < count)) {
      const d = new Date(cur)
      if (byMonthDay) d.setDate(byMonthDay)
      if (!stop(d) && d >= start) out.push(new Date(d))
      cur.setMonth(cur.getMonth() + interval)
    }
  } else if (freq === 'YEARLY') {
    const cur = new Date(start)
    while (!stop(cur) && out.length < maxCount && (count == null || out.length < count)) {
      out.push(new Date(cur))
      cur.setFullYear(cur.getFullYear() + interval)
    }
  }

  return out
}

export function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
