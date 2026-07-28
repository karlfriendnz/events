# Events module inside the old platform — what exists, and what's left

**Status: working end-to-end on a developer machine, against a generated demo
club. Not production-ready — see Blockers.**

The new events module runs inside the old FriendlyManager platform in an iframe.
The old platform keeps owning club data (people, classes, terms, venues,
categories) and the things the club runs its business on (its calendar,
attendance, fees). The new module owns the event model it adds — sessions,
registration forms, tickets, discounts.

Everything below has been exercised against a seeded club of 1,000 people, 127
events, 100 classes and 6 venues.

---

## 1. What Andrew has to add to the old platform

This is the whole footprint. **Two new files, four small edits**, all behind a
setting that is empty by default — with it unset, every legacy page behaves
exactly as it does today, which is also the rollback.

### New files

| File | Lines | What it is |
|---|---|---|
| `application/classes/Api/fmevents.php` | ~800 | The API. One endpoint class in the platform's existing framework. |
| `application/pages/fmevents/embed.php` | ~90 | Renders the module in an iframe and mints its login token. |

### Edited files — ~10 lines each, at the top, all guarded

| File | Change |
|---|---|
| `pages/events/switch.php` | If `fmevents-url` is set, render the module instead. |
| `pages/attendance/switch.php` | Same. The legacy reports (`awards`, `hours`, `nonattendance`, `trialist`, `visitors`) are deliberately excluded and stay on the old pages. |
| `pages/programs/switch.php` | Same. `/programs/book/...` (the member payment journey) is deliberately excluded. |
| `pages/people/tabs/tab-content.php` | The profile's Events tab renders the module scoped to that person. |

### Data, per club

```sql
-- 1. an API key for the club
INSERT INTO fm_system.ApiKey (club_id, `key`, status) VALUES (<club>, '<32-char key>', 1);

-- 2. point the club at the module (empty = old pages, i.e. the rollback)
REPLACE INTO Settings (`key`, `value`) VALUES ('fmevents-url', 'https://<module-host>');
```

### Three things worth knowing before review

1. **`Api::route()` resolves the URL segment with `method_exists()`, which
   ignores visibility** — so every *private* helper on an endpoint class is
   reachable as an endpoint. Ours are named to avoid collisions
   (`requirePerson`, not `person`). Worth fixing centrally.
2. **`api/v1.php` loses the message on non-`ApiException` errors** — it calls
   `$api->fail($e)` but echoes `$api->response`, which was never assigned, so a
   SQL error returns `[]` with a 500. Every real failure hit during this build
   was invisible until reading `/var/log/fm/api.log`.
3. **Class autoloading is case-sensitive on Linux** (`classes/{Class}.php`).
   `Api\Competitions` works today only because macOS is case-insensitive. Ours
   is all-lowercase (`fmevents`) deliberately.

---

## 2. The API — 24 endpoints

`/api/v1/fmevents/{method}`, `Authorization: token <key>`. Reads take query
params, writes take a JSON body. Server-to-server only, so the key never reaches
a browser and CORS does not apply.

**Identity** — `whoami`

**Club reference** — `club`, `categories`, `venues`, `terms`, `codes`, `groups`,
`roster`, `customFields`, `programs`

**People** — `people` (search, paginated), `person`, `personByEmail`,
`postPerson`

**Events** — `events` (range), `event`, `personEvents`, `postEvent`,
`postEventDelete`, `postProgram`

**Attendance** — `attendance`, `postAttendance`

**Money** — `fees`, `postFee`

### Conventions that matter

- **Writes are partial.** Only keys present in the body are written, and
  categories/classes are left alone unless explicitly supplied. This is what
  makes editing a legacy event from the new UI safe — awards, programme links,
  terms text and the roll survive untouched. Verified.
- **Fees follow the platform's own convention.** A charge is
  `Fee(personID, assocType:'Event', assocID:eventID)`, which is exactly how
  `EventPerson::fee()` looks it up. A **programme** day charges against the
  PROGRAMME (`assocType:'Program'`), so a family is billed once for the week —
  getting that wrong would both hide the charge and defeat the duplicate guard.
- **Charging is idempotent.** A second charge for the same person+event returns
  the existing fee rather than billing twice. Verified.
- **NOT NULL columns are filled explicitly.** `Event`, `Person` and
  `EventPerson` have 14, 17 and 6 NOT NULL columns with no defaults. The
  platform's own model methods omit some, which is fine on a server running
  MySQL non-strict (as production does) and fails under `STRICT_TRANS_TABLES`.
  Ours works either way.
- **Times are wall clock with no zone.** `getClub` now reports the club's
  timezone so callers can convert correctly. Anything comparing a legacy time
  to an absolute timestamp MUST convert via the club's zone, never the
  server's — on a UTC host, the naive reading silently finds no clashes.

---

## 3. What runs on our side

| File | Purpose |
|---|---|
| `server/utils/legacy.ts` | The client, plus the legacy→module mappers |
| `server/api/v1/legacy/session.get.ts` | Exchanges the single-use login token |
| `server/api/v1/legacy/events.get.ts` | The club's existing events |
| `server/api/v1/legacy/event.get.ts` | One event + roll + charges |
| `server/api/v1/legacy/event.patch.ts` | Edit an event back into the old platform |
| `server/api/v1/legacy/options.get.ts` | Venue + category pick-lists |
| `pages/embed/index.vue` | The page the iframe loads |
| `pages/events/legacy/[id].vue` | A legacy event, viewable and editable |

Plus three existing endpoints extended, so no calendar or picker code changed:

- `events/shared.get.ts` — legacy events ride the feed the board already merges
- `bookables/index.get.ts` — legacy venues appear in every venue picker
- `bookings/for-bookables.get.ts` — legacy events count as venue occupancy

---

## 4. Proven

| | Evidence |
|---|---|
| SSO handoff | Token minted by the old platform, exchanged once, 401 on reuse |
| Old events on the new calendar | 127 events, with venues |
| Click through to one | Details, roll (12 of 14 attended), charges |
| Edit back to the old platform | Name/date/venue/fee saved; category, class links and 12-person roll intact |
| Venues | 6 real venues in the pickers |
| Availability | Booked slot clashes, free slot doesn't, partial overlap clashes |
| Attendance write-back | Batch write, per-entry errors surfaced |
| Money write-back | Fee created; second attempt refused |
| Rollback | Setting cleared → old pages return; restored → module returns |

---

## 5. Blockers before production

**Must fix — safety**

1. **The `/api/v1` routes do not authenticate.** They take an org id and answer.
   Club people, events and finances are reachable by anyone who knows one. The
   embed's session flag is browser state and can be set by hand. Needs a real
   signed, HttpOnly session cookie set by the token exchange, and route-level
   checks.

   **This reaches into the OLD platform, not just ours.**
   `server/api/v1/legacy/event.patch.ts` takes an event id and field changes,
   resolves the club from server config, and writes to the legacy platform
   **using the server-held API key** — with no auth check. Verified: an
   unauthenticated `PATCH` returns `400 "A legacy event id is required"`, not
   `401`, so it executes and reaches validation. With a real id it edits the
   club's live event. The per-club key exists to keep that credential off the
   client; a route that uses it without authenticating the caller gives away the
   capability anyway. So the exposure is not only "club data is readable" — it is
   **an unauthenticated request can modify a club's live records in the platform
   that runs their business.** The `/api/v1/legacy/*` routes need this first.

**Must fix — it cannot serve a second club**

2. **Per-club config is hardcoded.** `ORG_BY_SLUG` in `server/utils/legacy.ts`
   plus one `LEGACY_API_URL`/`LEGACY_API_KEY`. Wants to be columns on
   `organisations` (legacy host + key), so each club carries its own.

**Must fix — the loop is one-way**

3. **Events created in the new module are not written back.** They are invisible
   to the old platform's calendar, member timelines and reports. `postEvent`
   exists and is tested (it creates when no `eventID` is sent — that is how the
   verified test event was made); `legacy.saveEvent()` exists. Nothing calls it
   on create, so this is one route plus a hook, not a feature to build.

   **The same one-way gap breaks registration, which is the bigger half.**
   `server/api/public-form-submit.post.ts` — the route that creates the person
   and the charge — still calls **Supabase directly**, while an embedded club
   exists only in the MySQL seam. Supabase has never heard of it (a direct call
   returns `406`), so **registration and the charge fail for an embedded club**
   while working normally for a native org. The legacy side of this is built and
   proven: a $45 registration charge appeared on the member's Fees tab as
   invoice `FM-4008`. Only the module-side route points at the wrong database.

   Same class, also reachable from the embed and also still on Supabase:
   `public-rsvp.post.ts` (RSVP replies), `invite-person.post.ts`,
   `send-notification-email.post.ts` (staff never told about a registration),
   `components/DisciplineLinker.vue` (mounted in **both** event wizards —
   degrades to "no disciplines") and `components/BookingAuthChooser.vue` (on the
   registration path via `<FormRenderer>`). Nine `.vue` files still call
   `useDb()`; those two are the events-critical ones.

   The asymmetry is what makes these hard to debug: the code is fine, for
   everyone except an embedded club.

**Untested in ways that will bite**

4. **Only ever run against generated data.** Three bugs were found in the
   generator itself during this build (venues modelled as people, event
   categories inverted, a retired event type), so its shape does not fully
   match reality. A real club database is the only way to know.
5. **Safari will likely break it.** 59 unguarded `localStorage`/`sessionStorage`
   calls; Safari blocks third-party iframe storage and *reading* it throws.
   Chromium only so far.
6. **Timezone.** The availability path now converts via the club's timezone;
   every other legacy date/time read has the same hazard and has not been
   audited. Production runs UTC and developer machines do not, so local testing
   hides this. `TZ=UTC npm run dev` surfaces it.

**Rough, user-visible**

7. Legacy events are labelled "Shared by Friendly Manager" with a share icon —
   they are the club's own events, not shared from elsewhere.
8. No attendance-taking on a legacy event, which for a training day is the job.
   `postAttendance` is built and tested; the UI is not.
9. The single-use token needed patching twice in one day (in-SPA back, then
   browser back/forward cache). Tab restore and two-tabs-open will likely
   surface more. A real session cookie retires this whole class.

---

## 6. Open decisions

1. **Are legacy events editable in the new module?** They are today, limited to
   fields the legacy row can hold. The alternative is read-only until migration.
2. **Should the host page dim/blur when a modal opens?** Currently the module
   blurs inside the frame, so the effect stops at the frame edge. The module
   could tell the old platform to blur its whole page instead.
3. **What happens to the legacy attendance reports** (awards, hours,
   non-attendance, trialist, visitors)? Six reports the module has no equivalent
   for; currently left on the old pages.
4. **Which venue does a NEW event store?** The old platform's venue id (a real
   link, needs a field) or the name as an address (simple, no link back).

---

## 7. Local setup, for whoever picks this up

The old platform runs at `http://demo.ddev.site` (`ddev start` from
`/Users/karl/old fm`), club `demo` → DB `fm_demo`, seeded from
`scripts/legacy-seed/out/demo.sql`. The module runs at `localhost:3005`.
`.env` carries `LEGACY_API_URL`, `LEGACY_API_KEY`, `LEGACY_CLUB_SLUG`.

Switch the integration on and off with the `fmevents-url` setting shown above.
