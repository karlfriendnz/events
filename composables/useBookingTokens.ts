export interface BookingTokenContext {
  date?: Date | null
  startAt?: Date | null
  endAt?: Date | null
  activityName?: string | null
  modeName?: string | null
  venueName?: string | null
  attendeeCount?: number | null
}

export const BOOKING_TOKENS = [
  { label: 'Date',        value: '{date}' },
  { label: 'Start time',  value: '{start_time}' },
  { label: 'End time',    value: '{end_time}' },
  { label: 'Duration',    value: '{duration}' },
  { label: 'Activity',    value: '{activity}' },
  { label: 'Mode',        value: '{mode}' },
  { label: 'Venue',       value: '{venue}' },
  { label: 'Attendees',   value: '{attendees}' },
]

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/^0/, '').toLowerCase()
}

function fmtDuration(start: Date, end: Date): string {
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60), m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export function substituteBookingTokens(template: string, ctx: BookingTokenContext): string {
  if (!template) return template
  const start = ctx.startAt ?? null
  const end = ctx.endAt ?? null
  const date = ctx.date ?? start
  const map: Record<string, string> = {
    '{date}':       date ? fmtDate(date) : '',
    '{start_time}': start ? fmtTime(start) : '',
    '{end_time}':   end ? fmtTime(end) : '',
    '{duration}':   start && end ? fmtDuration(start, end) : '',
    '{activity}':   ctx.activityName ?? '',
    '{mode}':       ctx.modeName ?? '',
    '{venue}':      ctx.venueName ?? '',
    '{attendees}':  ctx.attendeeCount != null ? String(ctx.attendeeCount) : '',
  }
  return template.replace(/\{(date|start_time|end_time|duration|activity|mode|venue|attendees)\}/g, m => map[m] ?? m)
}

export function useBookingTokens() {
  return { BOOKING_TOKENS, substituteBookingTokens }
}
