# Generates the per-page breakdown (HTML + MD) for the FM rebuild report.
# Row = (feature, status, done[], todo[])   status: built|exceeds|partial|missing|new
DATA = [
("Dashboard", [
 ("Members breakdown widget", "exceeds",
  ["/dashboard stat tiles + custom chart widgets (any field, pie/bar)", "Configurable per-user grid + per-role default templates"], []),
 ("Finance / outstanding widget", "missing", [],
  ["Outstanding-fees total + weekly trend widget", "Requires the billing ledger first"]),
 ("Upcoming events widget", "built", ["/dashboard upcoming events card"], []),
 ("Term-transfer banner", "exceeds",
  ["Rollover nudge banner — lineage-aware, per-sequence, terminology-driven", "3-day snooze; links into the term wizard"], []),
 ("Email-error banner", "missing", [], ["Bounce tracking on the send pipeline (arrives with Mailer)"]),
]),
("People", [
 ("Directory", "built",
  ["/people with person-type tabs + per-tab column sets (incl. custom fields)", "Search, bulk set-type/delete, CSV-friendly columns"], []),
 ("New person", "built", ["Add-person dialog on /people and inside groups (incl. inline new-person)"], []),
 ("Person profile", "exceeds",
  ["Live-form profile with designed per-type layouts (WYSIWYG builder)", "Club-configurable profile dashboard w/ notes + activity", "Multi-role people; photo avatar"], []),
 ("Contacts / guardians", "exceeds",
  ["Contacts & Circles: families incl. split families", "Act-on-behalf booking/registration", "Per-relationship comms categories; primary/emergency types"], []),
 ("Entity records (Team/Business/School/Family)", "new",
  ["/organisations directory + entity records with people rosters", "Entity types with their own fields + member slots"], []),
 ("Person notes with channels", "new",
  ["Notes on any person, scoped to context (group/waitlist/term)", "Interaction channel (in person/phone/email/SMS), hover preview"], []),
 ("Profile: Fees tab (ledger)", "missing", [],
  ["Per-person ledger: invoices, payments, credits, refunds", "Blocked on the billing engine"]),
 ("Profile: Awards / Resources / Uniforms tabs", "missing", [], ["Build those modules, then surface their profile tabs"]),
 ("Profile: Membership history", "partial",
  ["Membership tab: current groups + per-group role editing"],
  ["Full class x term history view (data already on memberships via term_id)"]),
 ("People reports", "missing", [], ["Membership-length report", "Duplicate-name detection"]),
 ("Logins / archive / restrict", "missing", [], ["Login-invitation queue (Email New Logins)", "Archive + restrict-registrations states"]),
]),
("Squads / Classes", [
 ("Groups landing", "exceeds",
  ["Classes board: programme tabs, term filter, live columns (fill, fees, signup)", "Saved views + views manager; week-view links per programme"], []),
 ("Week View timetable", "new",
  ["Time x weekday grid of every class, density-adaptive summaries, day view", "Colour-coded by programme, capacity chips, click-through modals"], []),
 ("Class Finder", "new",
  ["Find-a-class drawer from any screen: age/day/time/programme/space matching", "Ranked results with add-person deep links"], []),
 ("New squad", "built",
  ["New group dialog + full group editor (age, gender restriction, capacity, image w/ crop)"],
  ["Enforce members-per-coach ratio (legacy playersPerStaff)"]),
 ("Terms admin", "exceeds",
  ["/settings/memberships: terms w/ sign-up open/close windows", "Term sets (independent sequences) connected to sports"],
  ["Date-overlap check within a set (legacy's one hard rule)", "Member-guarded delete + fee/membership cascade, enforced server-side"]),
 ("Codes", "exceeds",
  ["Drag hierarchy manager + per-code settings", "Member types, staff roles w/ lineage, role/position minimums, code-level staff"], []),
 ("Waitlist", "exceeds",
  ["Shared queues across equivalent classes", "Ordering modes (custom/FIFO/priority), enrol-from-waitlist, term rollover, CSV"], []),
 ("Squad Allocation", "built", ["Drag allocation board w/ capacity colouring, duplicates highlight, mobile fallback"], []),
 ("Term Transfer", "exceeds",
  ["Batch rollover screen + 7-step Term set-up wizard", "Programme management review w/ vacancy search; per-person staff carry", "Per-programme fee confirmation w/ change tracking + reset; training-event generation; discontinued classes"], []),
 ("Squad detail", "exceeds",
  ["Group page: hero, session times, fees, sub-group boards, positions, attendance matrix", "Public registration page + QR; waitlist-aware add-person"], []),
 ("Squad Announcement", "missing", [], ["Message-a-class email (needs Mailer; wizard already stubs it)"]),
 ("Members / Squads reports", "partial",
  ["Classes board columns + saved views + people-tab exports"],
  ["Dedicated members/squads report views"]),
 ("Retention Report", "built", ["/groups/retention: A-to-B term comparison, segments, CSV, copy-emails"], []),
]),
("Events", [
 ("Calendar + categories", "built", ["/events list + calendar toggle, search, filters"], []),
 ("New event", "exceeds", ["Basic wizard w/ public form toggle, advanced wizard, bulk multi-create"], []),
 ("Event detail", "exceeds",
  ["Sessions, multi-subject forms, tickets, discounts, automation, reporting, attendance check-in", "Staff register-on-behalf + public links"], []),
 ("Multi-subject / entity registration", "new",
  ["Forms register people AND entities (Team/Company/School) with per-subject fields, counts, presets", "Step-wizard form style; per-subject session choice"], []),
 ("Training <-> class times", "built", ["One-click training-event series from weekly schedules, rosters pre-invited"], []),
]),
("Venues & Bookings", [
 ("Venues + lanes", "exceeds",
  ["Bookables tree w/ configurations (halves/quarters), modes, items, images"], []),
 ("Access control", "new",
  ["Doors, light zones, access codes, unlock windows, per-booking schedules"], []),
 ("Staff (private lessons)", "exceeds", ["Coach bookables w/ what-I-offer editor + coach wizard"], []),
 ("Book flow", "exceeds",
  ["3 flows: wizard, single-screen scheduler, item rental", "Public /book w/ auth chooser (guest/OTP/password/app) + act-on-behalf"], []),
 ("Guided setup wizards", "new",
  ["Sport, coach, item, and whole-club setup wizards seeding venues/activities/modes end-to-end"], []),
]),
("Registration (public)", [
 ("Register wizard", "partial",
  ["Public /r pages for events, classes, programme-connected forms", "Multi-subject forms, fee-option choice, live class spaces", "Waitlist-aware submission; answers materialise onto profiles"],
  ["Payment processing at submit", "Customer confirmation email", "Re-register / EOI flows", "Hold-space pending memberships"]),
 ("Merchandise (shop form)", "missing", [], ["Shop form type — needs Uniforms/merch + billing"]),
]),
("Class fees & Xero", [
 ("Term Fees", "exceeds",
  ["Group fee options w/ line items + Xero codes, 5 fee types, due date + deposit", "Bulk add-to-many-classes; free classes fully supported"], []),
 ("Xero", "partial",
  ["OAuth connect w/ tenant safety, bank/tax/account mapping, tracking categories", "Platform-wide account picker (XeroAccountInput)"],
  ["Invoice/payment two-way sync once the ledger exists (plumbing ready)"]),
]),
("Payments & invoicing", [
 ("Invoices / Add Fee / Add Credit", "missing", [],
  ["The billing engine: invoice + credit-note model", "Payments w/ methods; credit auto-allocation", "Pro-rata, prompt discounts, recurring, direct debit (Ezidebit), Stripe/Windcave"]),
 ("Transactions", "partial", ["/finances reporting view"], ["Real transaction ledger once the engine lands"]),
 ("Money reports", "missing", [], ["Outstanding / Overdue / Missing / Recurring reports off the ledger"]),
 ("Email Statements", "missing", [], ["Statement generation + send (needs ledger + Mailer)"]),
]),
("Attendance", [
 ("Landing + take attendance", "built", ["/attendance 15-day view + per-event attendance tab"], []),
 ("Generate from class-times", "built", ["Training-event generation from group page + term wizard (idempotent)"], []),
 ("Attendance reports", "partial",
  ["Per-group people x session matrix w/ filter + CSV export"],
  ["Club-wide attendance + non-attendance reports"]),
 ("Coach Hours", "missing", [], ["Staff hours from sessions (payroll export)"]),
 ("Visitors", "missing", [], ["Visitor / drop-in logging"]),
]),
("Mailer", [
 ("Bulk composer", "missing", [], ["3-step composer: recipients by class/custom/subscribers", "Attachments, reply-to, CC myself"]),
 ("History", "missing", [], ["Send history + delivery status"]),
 ("Templates", "missing", [], ["Club email templates in Settings"]),
]),
("Awards", [
 ("Awards module", "missing", [], ["Badge definitions + groups, sequential progression, assign, report, profile tab"]),
]),
("Resources", [
 ("Resources module", "missing", [], ["Categorised document library w/ member visibility"]),
]),
("Uniforms & Merchandise", [
 ("Uniforms / merchandise module", "missing", [], ["Inventory + variants + stock", "Merch sales via shop form; issue/return per term"]),
]),
("Holiday Programmes", [
 ("Programmes module", "missing", [], ["Date-ranged bookable programmes w/ own windows + discounts"]),
]),
("Vouchers & Sponsors", [
 ("Vouchers", "partial", ["Booking discount rules engine; event discount codes"], ["Club-wide voucher codes redeemable at registration"]),
 ("Sponsors", "partial", ["Sponsor strip in the form designer"], ["Club-level sponsor catalogue in Settings"]),
]),
("Competitions", [
 ("Full competitions engine", "missing", [],
  ["Divisions, pools, rounds, games, officials", "Per-sport scoring + individual sessions/judging", "Public score entry — largest net-new build (~30 legacy tables)"]),
]),
("Settings & platform", [
 ("Club info / branding", "built", ["Name, logo, icon, brand colours w/ preview, dashboard banner, currency/locale, season"], []),
 ("Module toggles", "built", ["/settings/modules per-club switches w/ live nav filtering"], []),
 ("Terminology", "exceeds",
  ["Club renaming w/ NSO inheritance + sport-scoped vocabularies (per-sport sets)", "Wired app-wide (~250 strings: groups, people, events, dashboard, settings)"],
  ["Nav labels (layout file)", "Hardcoded Classes-breadcrumb decision"]),
 ("Custom fields", "exceeds", ["Types & fields engine: multi-target defs, person/entity types, NSO locks, designed layouts, core-fields policy"], []),
 ("Registration forms & embeds", "partial",
  ["Forms library + designer + connections to programmes; public form pages"],
  ["Public site embeds: calendar, register, book widgets"]),
 ("Financial settings", "partial", ["Payment options editor (methods + defaults)"], ["Stripe / Ezidebit / Windcave provider config once billing lands"]),
 ("Email templates", "missing", [], ["Template editor (with Mailer)"]),
 ("Integrations", "partial", ["Xero foundation"], ["Stripe, Ezidebit, SparkPost, HubSpot, Kamar, NSO provider syncs"]),
 ("Permission enforcement", "partial",
  ["Permission grid + core templates + scoped per-resource roles", "Route read-gates middleware + Can component"],
  ["Per-button Can sweep across pages", "Nav hiding by permission", "Switch Role"]),
 ("Tenant security (RLS)", "partial", ["org_id scoping app-wide; org_members has RLS"], ["RLS policies across ~87 tables before production"]),
 ("FM super-admin", "built", ["/admin console, master catalogues (brands/club types/sports), core permission templates"], []),
 ("Audit log", "missing", [], ["Surface change history (legacy audit-logged every write)"]),
 ("Help", "exceeds",
  ["Structured articles (explanation + step tutorials) w/ terminology tokens", "Module + permission-gated visibility; /admin/help authoring; chatbot-ready"],
  ["Nav entry for /help (layout owned elsewhere)", "Author remaining articles"]),
 ("Review & sign-off system", "new",
  ["In-app page review: pinned comments, reviewer sign-offs, cross-page report matrix"], []),
]),
]

CHIP = {"built": ("BUILT", "built"), "exceeds": ("★ EXCEEDS", "star"), "partial": ("PARTIAL", "partial"), "missing": ("NOT STARTED", "missing"), "new": ("NEW", "newchip")}
SIGNERS = ['Karl', 'Kate', 'Rodd', 'FM', 'HC']

# Nothing reaches 100% until ALL FIVE parties have signed off. A finished build
# is worth 90%; each sign-off releases 2% of the final 10%.
def row_score(row):
    status = row[1]
    signed = row[4] if len(row) > 4 else []
    base = {"built": 0.9, "exceeds": 0.9, "new": 0.9, "partial": 0.5, "missing": 0.0}[status]
    if status in ("built", "exceeds", "new"):
        return base + 0.02 * len([x for x in signed if x in SIGNERS])
    return base

def ul(items, empty):
    if not items: return f'<span style="color:var(--faint)">{empty}</span>'
    return '<ul class="cell">' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'

def generate():
    SIGNOFFS = SIGNERS
    so_cols = ''.join('<col class="c-sign">' for _ in SIGNOFFS)
    so_ths = ''.join(f'<th class="sign">{n}</th>' for n in SIGNOFFS)
    so_tds = ''.join('<td class="sign">&#9744;</td>' for _ in SIGNOFFS)
    COLGROUP = '<table class="aligned">\n      <colgroup><col class="c-legacy"><col class="c-status"><col class="c-half"><col class="c-half">' + so_cols + '</colgroup>'
    html = ['  <h2 id="per-page">Per-page / per-function breakdown</h2>\n  <p class="sub">Every legacy page and function — plus the net-new features (<span class="chip newchip">NEW</span>) legacy never had. What the new build has done, and what still needs doing. <b>Nothing reaches 100% until Karl, Kate, Rodd, FM and HC have all signed it off</b> — a finished build shows 90%; each sign-off releases the last 2%.</p>']
    md = ["## Per-page / per-function breakdown (7 Jul 2026)\n"]
    todos_by_module = []
    for module, rows in DATA:
        # NEW rows don't dilute the legacy-parity percentage; they're bonuses.
        parity_rows = [r for r in rows if r[1] != 'new']
        pct = round(100 * sum(row_score(r) for r in parity_rows) / len(parity_rows)) if parity_rows else 90
        html.append(f'''  <details class="card acc" style="margin-bottom:10px">
    <summary>
      <span class="acc-chev">&#9656;</span>
      <h3 style="margin:0">{module}</h3>
      <div style="display:flex;align-items:center;gap:10px;flex:1;max-width:280px;margin-left:auto"><div class="bar" style="flex:1"><span style="width:{pct}%"></span></div><span class="num" style="color:var(--muted);font-weight:600">{pct}%</span></div>
    </summary>
    <div class="scroll acc-body">
    {COLGROUP}
      <tr><th>Feature</th><th>Status</th><th>What&rsquo;s been done</th><th>What needs to be done</th>''' + so_ths + '''</tr>''')
        md.append(f"### {module} — {pct}%\n\n| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |\n|---|---|---|---|---|---|---|---|---|")
        mod_todos = []
        for row in rows:
            feature, status, done, todo = row[0], row[1], row[2], row[3]
            signed = row[4] if len(row) > 4 else []
            label, cls = CHIP[status]
            cells = ''.join(('<td class="sign signed">&#9745;</td>' if n in signed else '<td class="sign">&#9744;</td>') for n in SIGNERS)
            mdcells = ' | '.join(('☑' if n in signed else '☐') for n in SIGNERS)
            html.append(f'      <tr><td class="item">{feature}</td><td><span class="chip {cls}">{label}</span></td><td class="note">{ul(done, "&mdash;")}</td><td class="note todo">{ul(todo, "Nothing &mdash; done")}</td>' + cells + '</tr>')
            md.append(f"| {feature} | {label} | {'; '.join(done) if done else '—'} | {'; '.join(todo) if todo else '—'} | {mdcells} |")
            if todo: mod_todos.append((feature, todo))
        html.append('    </table>\n    </div>\n  </details>')
        md.append("")
        if mod_todos: todos_by_module.append((module, mod_todos))

    html.append('  <h2>Still to do — the full list</h2>\n  <p class="sub">Every open item from the tables above, in one place.</p>\n  <div class="newgrid">')
    md.append("## Still to do — the full list\n")
    for module, items in todos_by_module:
        html.append(f'    <div class="card">\n      <h3>{module}</h3>\n      <ul>')
        md.append(f"**{module}**")
        for feature, todos in items:
            for t in todos:
                html.append(f'        <li><b>{feature}</b> — {t}</li>')
                md.append(f"- **{feature}** — {t}")
        html.append('      </ul>\n    </div>')
        md.append("")
    html.append('  </div>')
    return "\n".join(html), "\n".join(md)

AREA_SIGNOFFS = {}   # module name -> list of SIGNERS who signed the whole area

def area_card():
    rows = []
    for module, mrows in DATA:
        parity = [r for r in mrows if r[1] != 'new']
        pct = round(100 * sum(row_score(r) for r in parity) / len(parity)) if parity else 90
        rows.append((module, pct))
    rows.sort(key=lambda r: -r[1])
    out = ['  <div class="card areas">']
    heads = ''.join(f'<span class="so-h" title="{n}">{n}</span>' for n in SIGNERS)
    out.append(f'    <div class="area area-h"><div class="name"></div><div></div><div></div><div class="so-cluster">{heads}</div></div>')
    for name, pct in rows:
        cls = 'b100' if pct >= 85 else 'b70' if pct >= 50 else 'b40' if pct >= 25 else 'b10'
        signed = AREA_SIGNOFFS.get(name, [])
        boxes = ''.join((f'<span class="so signed" title="{n} signed off">&#9745;</span>' if n in signed else f'<span class="so" title="{n} sign-off">&#9744;</span>') for n in SIGNERS)
        out.append(f'    <div class="area"><div class="name">{name}</div><div class="bar {cls}"><span style="width:{pct}%"></span></div><div class="pct num">{pct}%</div><div class="so-cluster">{boxes}</div></div>')
    out.append('  </div>')
    return "\n".join(out)

if __name__ == '__main__':
    html, md = generate()
    p = '/Users/karl/fm-events/public/rebuild-report.html'
    s = open(p).read()
    if '.chip.newchip' not in s:
        s = s.replace('  .chip.star { background: var(--accent-soft); color: var(--accent); }',
                      '  .chip.star { background: var(--accent-soft); color: var(--accent); }\n  .chip.newchip { background: var(--accent); color: #fff; }')
        s = s.replace(':root[data-theme="dark"] .chip.newchip', ':root[data-theme="dark"] .chip.newchip')  # token-based already
    # Remove the status legend strip (per Karl)
    lstart = s.find('    <div class="legend">')
    if lstart != -1:
        lend = s.index('</div>', lstart) + len('</div>')
        s = s[:lstart].rstrip() + '\n' + s[lend:].lstrip('\n')
    if '.so-cluster' not in s:
        s = s.replace('  @media (max-width: 560px) { .area { grid-template-columns: 1fr 60px; } .area .bar { grid-column: 1 / -1; } }',
'  .area { grid-template-columns: 240px 1fr 52px 190px; }\n  .area.area-h { padding: 2px 0 6px; border-bottom: 1px solid var(--line); }\n  .so-cluster { display: grid; grid-template-columns: repeat(5, 1fr); justify-items: center; align-items: center; }\n  .so-h { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--faint); }\n  .so { font-size: 16px; color: var(--faint); }\n  .so.signed { color: var(--built); }\n  @media (max-width: 640px) { .area { grid-template-columns: 1fr 60px; } .area .bar, .area .so-cluster { grid-column: 1 / -1; justify-items: start; gap: 10px; display: flex; } }')
    if '.acc summary' not in s:
        s = s.replace('  .scroll { overflow-x: auto; }',
'''  .scroll { overflow-x: auto; }
  details.acc { padding: 0; }
  .acc summary { display: flex; align-items: center; gap: 12px; padding: 16px 22px; cursor: pointer; list-style: none; user-select: none; }
  .acc summary::-webkit-details-marker { display: none; }
  .acc summary:hover { background: var(--accent-soft); border-radius: 10px; }
  .acc[open] summary:hover { border-radius: 10px 10px 0 0; }
  .acc-chev { color: var(--faint); font-size: 13px; transition: transform 0.15s; }
  .acc[open] .acc-chev { transform: rotate(90deg); }
  .acc-body { padding: 0 22px 18px; border-top: 1px solid var(--line); padding-top: 12px; }''')
    if 'col.c-sign' not in s:
        s = s.replace('  table.aligned col.c-half { width: 31%; }',
'''  table.aligned col.c-half { width: 25%; }
  table.aligned col.c-sign { width: 58px; }
  th.sign { text-align: center; padding: 8px 4px; }
  td.sign { text-align: center; font-size: 17px; color: var(--faint); }
  td.sign.signed { color: var(--built); }''')
    astart = s.index('  <h2>Progress by area</h2>')
    astart = s.index('  <div class="card areas">', astart)
    aend = s.index('</div>\n\n', astart)
    # find the areas card end: it closes with "  </div>" right before the next h2
    nexth2 = s.index('<h2', astart)
    # safer: cut from astart to the line before the next section h2
    aend = s.rindex('</div>', astart, s.index('<h2 id="per-page">', astart))
    s = s[:astart] + area_card() + s[aend + len('</div>'):]
    # Drop the standalone "Everything the new build adds" section (folded into
    # the tables as NEW rows) — idempotent.
    if '<h2>Everything the new build adds that legacy never had</h2>' in s:
        estart = s.index('  <h2>Everything the new build adds that legacy never had</h2>')
        eend = s.index('  <h2>Biggest remaining gaps, ranked</h2>')
        s = s[:estart] + s[eend:]
    # Hero line: count of NEW features (regenerated each run via marker id)
    new_count = sum(1 for _, rows in DATA for r in rows if r[1] == 'new')
    hero_line = f'<p class="sub" id="new-count" style="margin-top:6px">Includes <b>{new_count} features</b> the legacy platform never had — marked <span class="chip newchip">NEW</span> in the tables below.</p>'
    import re as _re
    if 'id="new-count"' in s:
        s = _re.sub(r'<p class="sub" id="new-count".*?</p>', hero_line, s, flags=_re.S)
    else:
        s = s.replace('<div class="bar"><span style="width:56%"></span></div>',
                      '<div class="bar"><span style="width:56%"></span></div>\n    ' + hero_line)
    start = s.index('  <h2 id="per-page">')
    end = s.index('  <h2>Biggest remaining gaps, ranked</h2>')
    s = s[:start] + html + "\n\n" + s[end:]
    open(p, 'w').write(s)
    mp = '/Users/karl/fm-events/PLATFORM_AUDIT.md'
    m = open(mp).read()
    mstart = m.index('\n## Per-page / per-function breakdown (7 Jul 2026)')
    m = m[:mstart] + "\n" + md + "\n"
    open(mp, 'w').write(m)
    print('regenerated with NEW rows')
