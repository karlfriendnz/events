export type RepeatOption = { label: string; value: string }

export function buildRepeatOptions(date: Date | null): RepeatOption[] {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const DAY_ABBR = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth']

  if (!date) return [
    { label: 'Does not repeat', value: 'NONE' },
    { label: 'Daily', value: 'FREQ=DAILY' },
    { label: 'Weekly', value: 'FREQ=WEEKLY' },
    { label: 'Monthly', value: 'FREQ=MONTHLY' },
    { label: 'Annually', value: 'FREQ=YEARLY' },
    { label: 'Every weekday (Monday to Friday)', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
    { label: 'Custom…', value: 'CUSTOM' },
  ]

  const d = new Date(date)
  const dow = d.getDay()
  const dayName = DAYS[dow]
  const dayAbbr = DAY_ABBR[dow]
  const dayNum = d.getDate()
  const monthName = MONTHS[d.getMonth()]
  const nth = Math.ceil(dayNum / 7)
  const nthLabel = ORDINALS[nth - 1]

  return [
    { label: 'Does not repeat', value: 'NONE' },
    { label: 'Daily', value: 'FREQ=DAILY' },
    { label: `Weekly on ${dayName}`, value: `FREQ=WEEKLY;BYDAY=${dayAbbr}` },
    { label: `Monthly on day ${dayNum}`, value: `FREQ=MONTHLY;BYMONTHDAY=${dayNum}` },
    { label: `Monthly on the ${nthLabel} ${dayName}`, value: `FREQ=MONTHLY;BYDAY=${nth}${dayAbbr}` },
    { label: `Annually on ${monthName} ${dayNum}`, value: 'FREQ=YEARLY' },
    { label: 'Every weekday (Monday to Friday)', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
    { label: 'Custom...', value: 'CUSTOM' },
  ]
}

/** How many occurrences the rule is limited to, or null for "no limit". */
export function rruleCount(rrule: string): number | null {
  const m = /(?:^|;)COUNT=(\d+)/.exec(rrule || '')
  const n = m ? parseInt(m[1], 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Set (or clear) the occurrence limit on an rrule.
 *
 * COUNT and UNTIL are mutually exclusive in RFC 5545 — a rule carrying both is
 * malformed and different parsers disagree about which wins — so setting a count
 * drops any UNTIL rather than quietly producing a rule that means two things.
 */
export function rruleWithCount(rrule: string, count: number | null): string {
  if (!rrule || rrule === 'NONE') return rrule
  const parts = rrule.split(';').filter(p => p && !/^COUNT=/.test(p) && (count == null || !/^UNTIL=/.test(p)))
  if (count != null && count > 0) parts.push(`COUNT=${count}`)
  return parts.join(';')
}

/** The date the rule stops on (UNTIL), or null when it runs on unbounded. */
export function rruleUntil(rrule: string): Date | null {
  const m = /(?:^|;)UNTIL=(\d{4})(\d{2})(\d{2})/.exec(rrule || '')
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * Set (or clear) the END DATE of an rrule.
 *
 * The mirror of rruleWithCount, and mutually exclusive with it for the same
 * RFC 5545 reason: a rule carrying both a COUNT and an UNTIL means two different
 * things depending on who parses it, so setting one drops the other.
 *
 * UNTIL is stamped at 23:59:59 so the last day is INCLUDED — an event repeating
 * "until 30 June" that stops on the 29th is a bug the user can't see the cause of.
 */
export function rruleWithUntil(rrule: string, until: Date | null): string {
  if (!rrule || rrule === 'NONE') return rrule
  const parts = rrule.split(';').filter(p => p && !/^UNTIL=/.test(p) && (until == null || !/^COUNT=/.test(p)))
  if (until) {
    const p2 = (n: number) => String(n).padStart(2, '0')
    parts.push(`UNTIL=${until.getFullYear()}${p2(until.getMonth() + 1)}${p2(until.getDate())}T235959Z`)
  }
  return parts.join(';')
}

/**
 * Is this rule one of the ready-made presets (as opposed to something built in
 * the Custom dialog)? Compared ignoring both endings, since the ending is exactly
 * what the caller is about to add.
 */
export function isPresetRrule(rrule: string, date: Date | null): boolean {
  const bare = rruleWithUntil(rruleWithCount(rrule, null), null)
  return buildRepeatOptions(date).some(o => o.value !== 'CUSTOM' && o.value === bare)
}

export function rruleToSummary(rrule: string, fmtDate?: (d: Date) => string): string {
  if (!rrule || rrule === 'NONE' || rrule === '') return 'Does not repeat'
  const parts: Record<string, string> = {}
  rrule.split(';').forEach(p => { const [k, v] = p.split('='); parts[k] = v })

  const freqWord: Record<string, string> = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }
  const dayNames: Record<string, string> = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' }

  const interval = parseInt(parts['INTERVAL'] ?? '1')
  const freq = parts['FREQ']
  const freqLabel = freqWord[freq] ?? freq?.toLowerCase() ?? 'week'

  let s = interval === 1 ? `Repeats every ${freqLabel}` : `Repeats every ${interval} ${freqLabel}s`

  if (parts['BYDAY']) {
    const days = parts['BYDAY'].split(',').map(d => dayNames[d.replace(/^-?\d+/, '')] ?? d)
    if (days.length === 1) s += ` on ${days[0]}`
    else s += ` on ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`
  }
  if (parts['BYMONTHDAY']) s += ` on day ${parts['BYMONTHDAY']}`

  if (parts['COUNT']) {
    const n = parseInt(parts['COUNT'])
    s += ` for ${n} occurrence${n === 1 ? '' : 's'}`
  } else if (parts['UNTIL'] && fmtDate) {
    const u = parts['UNTIL']
    const date = new Date(`${u.slice(0,4)}-${u.slice(4,6)}-${u.slice(6,8)}`)
    s += ` until ${fmtDate(date)}`
  }
  return s
}
