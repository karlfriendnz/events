/**
 * Shared order-summary session collapsing — one implementation for the form
 * builder preview (<FormDesigner>) AND the live public form (<FormRenderer>), so
 * the two always read the same. Pure (no Vue/DB): the host passes the sessions and
 * closures for "is this selected" + "what does it cost".
 *
 * For the date-table (programme) layout it collapses a fully-selected DAY into one
 * "Full day · date" line and a fully-selected WEEK into one "Whole week · range"
 * line; otherwise it lists one line per selected session.
 */
export interface OrderLine { label: string; amount: number }

function isoWeekOf(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
const fmtDay = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtTime = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })

export function collapseSessionRows(opts: {
  sessions: any[]
  isSelected: (s: any) => boolean
  feeOf: (s: any) => number
  dateTable: boolean
}): OrderLine[] {
  const { sessions, isSelected, feeOf, dateTable } = opts
  const label = (s: any) => {
    const title = s.title || 'Session'
    if (!s.start_at) return title
    const d = new Date(s.start_at)
    return `${title} · ${fmtDay(d)} ${fmtTime(d)}`
  }
  if (!dateTable) return sessions.filter(isSelected).map(s => ({ label: label(s), amount: feeOf(s) }))

  const dated = sessions.filter(s => s.start_at)
  const undated = sessions.filter(s => !s.start_at)
  const days = new Map<string, { date: Date; all: any[]; sel: any[] }>()
  for (const s of dated) {
    const dk = new Date(s.start_at).toDateString()
    if (!days.has(dk)) days.set(dk, { date: new Date(s.start_at), all: [], sel: [] })
    const g = days.get(dk)!; g.all.push(s); if (isSelected(s)) g.sel.push(s)
  }
  const dayFull = (g: any) => g.all.length > 0 && g.sel.length === g.all.length
  const dayTotal = (g: any) => g.all.reduce((sum: number, s: any) => sum + feeOf(s), 0)
  const weeks = new Map<number, string[]>()
  for (const [dk, g] of days) {
    const wk = isoWeekOf(g.date)
    if (!weeks.has(wk)) weeks.set(wk, [])
    weeks.get(wk)!.push(dk)
  }
  const weekKeys = [...weeks.keys()].sort((a, b) =>
    Math.min(...weeks.get(a)!.map(dk => days.get(dk)!.date.getTime())) -
    Math.min(...weeks.get(b)!.map(dk => days.get(dk)!.date.getTime())))
  const rows: OrderLine[] = []
  for (const wk of weekKeys) {
    const dks = weeks.get(wk)!.sort((a, b) => days.get(a)!.date.getTime() - days.get(b)!.date.getTime())
    if (dks.every(dk => dayFull(days.get(dk)!))) {
      const total = dks.reduce((sum, dk) => sum + dayTotal(days.get(dk)!), 0)
      rows.push({ label: `Whole week · ${fmtDay(days.get(dks[0])!.date)} – ${fmtDay(days.get(dks[dks.length - 1])!.date)}`, amount: total })
      continue
    }
    for (const dk of dks) {
      const g = days.get(dk)!
      if (!g.sel.length) continue
      if (dayFull(g)) rows.push({ label: `Full day · ${fmtDay(g.date)}`, amount: dayTotal(g) })
      else for (const s of g.sel) rows.push({ label: label(s), amount: feeOf(s) })
    }
  }
  for (const s of undated) if (isSelected(s)) rows.push({ label: label(s), amount: feeOf(s) })
  return rows
}
