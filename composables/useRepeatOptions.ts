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
    { label: 'Custom...', value: 'CUSTOM' },
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
