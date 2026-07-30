# fmevents API reference

All 24 endpoints. Every example below is a real request and a real response,
captured from a running install — not illustrative.

```
Base      {club-url}/api/v1/fmevents/{method}
Auth      Authorization: token <key>          (fm_system.ApiKey, per club)
Reads     GET, query params
Writes    POST, JSON body
Errors    {"error":{"message":"…"}} with an HTTP status
```

Server-to-server only. The key never goes near a browser, so CORS doesn't apply.

**Ids are the platform's own** (`Event.id`, `Person.id`, `Venue.id` …), so
anything here can be joined straight back to the database.

---

## Identity

### `GET /whoami?logintoken=`

Exchanges a single-use login token for the person behind it. The token is minted
by `embed.php` with `$person->generateAuthToken('app', time() + 300)` — the same
mechanism `ClubDB::main()` already honours for `?logintoken=`. Consumed on use;
a second call returns 401.

```json
{
  "person": { "id": 1, "firstName": "Ella", "lastName": "Williams",
              "email": "admin@demo.local", "role": 9, "roleName": "System" },
  "club":   { "id": "3", "name": "Demo Club", "timezone": "Pacific/Auckland",
              "settings": { "module-program": "1" } }
}
```

---

## Club reference

### `GET /club`

```json
{ "id": "3", "name": "Demo Club (seeded)", "timezone": "Pacific/Auckland",
  "settings": { "classtimes": null, "fees-combine": null, "module-assets": "1",
                "module-merchandise": "1", "module-program": "1",
                "module-resources": "1", "module-venues": "1" } }
```

`settings` is a whitelist — never the whole table, which holds secrets.
`timezone` matters: stored times are wall clock with no zone.

### The other direction — `GET <fmevents-url>/api/v1/legacy/menu?club=<slug>`

The only call that goes the OTHER way: the platform asking the module what it
should put in the menu. Everything else on this page is the module reading the
platform.

```json
{ "calendars": [ { "id": "8f0c…", "name": "Holiday Programme",
                   "icon": "calendar", "colour": "#1E2157" } ] }
```

The calendars a club pinned in the module, in its own order. Each becomes a
sub-item under Events pointing at `/events/calendar/<id>` (MOUNTING.md edit 6).

**Cache it into the `fmevents-calendars` setting; do not call it while rendering
a menu.** `inc/menu.php` runs on every page load, and nothing the module does
should be able to slow the platform down.

### `GET /categories`

The club's own event categories. Rows with an `eventType` are the platform's
SYSTEM categories (one per event type, supplying its default colour) and are
excluded — they aren't things a club picks from.

```json
[ { "id": 2, "name": "Competition", "colour": "#E4572E",
    "eventType": null, "selected": false } ]
```

### `GET /venues`

Flat, with `parentID` so the tree can be rebuilt.

```json
[ { "id": 6, "name": "Kates venue", "location": "", "description": "",
    "parentID": null, "order": 0 } ]
```

### `GET /terms`

```json
[ { "id": 1, "name": "Term 1 2025", "start": "2025-12-27", "end": "2026-03-14",
    "signupOpenDate": "2025-11-29", "signupCloseDate": "2026-01-10",
    "termset": 0 } ]
```

### `GET /codes`

```json
[ { "id": 1, "name": "Recreational", "parentID": null, "termset": 0,
    "publish": true, "order": 1 } ]
```

### `GET /groups`

```json
[ { "id": 1, "name": "Group 1", "codeID": 10, "headID": 41, "limit": 8,
    "startAge": 6, "endAge": 8, "gender": 0, "public": true,
    "shortCode": "G001", "description": "" } ]
```

### `GET /roster?groupID=&termID=`

Who is in a class. `PersonGroup` is keyed (person, group, term, staff), so the
roster is per-term and separates staff from members. Omit `termID` for all terms.

```json
[ { "id": 593, "firstName": "Ari", "lastName": "Anderson",
    "email": "ari.anderson593@demo.demo", "phone": "0226 696 4154",
    "dateOfBirth": "2010-07-17", "gender": "Male",
    "staff": false, "positions": [] } ]
```

### `GET /customFields?assocType=Person`

The club's own custom fields with their dropdown options — so a registration
form offers the club's real fields rather than inventing parallel ones.

```json
[ { "field": "tshirt", "name": "T-shirt size", "type": "select",
    "values": "XS,S,M,L,XL,XXL",
    "options": [ { "id": 1, "value": "XS", "parentID": null } ],
    "codeID": null, "description": "", "access": 1 } ]
```

### `GET /programs`

Holiday programmes. A programme is a `Program` row plus one `Event` per day
carrying `programID`.

```json
[ { "id": 1, "name": "Holiday Programme 1", "open": "2025-07-01",
    "close": "2025-07-14", "cost": 40, "dayCost": 15, "feeDue": "2025-07-20",
    "startAge": 6, "endAge": 14, "account": null } ]
```

---

## People

### `GET /people?q=&limit=&offset=`

Matches name, email or phone. Paginated — some clubs have five figures of
members. `limit` is capped at 200.

```json
{ "total": 804, "limit": 2, "offset": 0,
  "people": [ { "id": 390, "firstName": "Amelia", "lastName": "Adams",
                "email": "amelia.adams390@demo.demo", "phone": "0228 355 4817",
                "dateOfBirth": "2016-03-05", "gender": "Female" } ] }
```

### `GET /personByEmail?email=`

Returns **every** match, deliberately — families share addresses and duplicates
exist. Merging a registration onto the wrong member is worse than asking.

### `GET /person?personID=`

The summary fields plus address, `role`, `primaryContact` and
`customFields` (keyed by `CustomField.field`).

### `POST /person`

Create or update. With a `personID` it updates; **without one it always
creates** — it will not silently merge onto an email match. Call
`/personByEmail` first and decide. New people get `role: 0` (no login) unless
told otherwise.

```json
{ "firstName": "Testy", "lastName": "Registrant",
  "email": "testy@example.com", "phone": "0211234567",
  "dateOfBirth": "2014-05-02", "gender": "Female",
  "customFields": { "tshirt": "M", "allergies": "none" } }
```
```json
{ "personID": 1006, "created": true }
```

---

## Events

### `GET /events?start=YYYY-MM-DD&end=YYYY-MM-DD`

Every non-deleted event in the range.

### `GET /event?eventID=`

```json
{ "id": 17, "name": "Match 17", "type": 0, "status": 1, "isPublic": false,
  "date": "2026-06-29", "startTime": "16:00:00",
  "endDate": "2026-06-29", "endTime": "18:00:00", "allDay": false,
  "colour": "#1E90FF", "venueID": 5, "location": "Outdoor Courts",
  "notes": "", "fee": 5, "feeDue": "2026-06-29", "account": null,
  "maxAttendees": 50, "closeDate": "2026-06-26",
  "categoryIDs": [1], "categories": [ { "id": 1, "name": "Training" } ],
  "groupIDs": [71], "attending": 12 }
```

### `GET /personEvents?personID=&start=&end=`

What one person is attached to — each event plus their attendance and whether
they were charged. Backs the profile's Events tab.

### `POST /event`

Create, or update by passing `eventID`.

```json
{ "name": "Winter Camp", "date": "2026-08-15",
  "startTime": "09:00:00", "endTime": "15:00:00",
  "venueID": 1, "maxAttendees": 30, "fee": 45,
  "isPublic": true, "categoryIDs": [1], "groupIDs": [1, 2] }
```
```json
{ "eventID": 125, "created": true, "…": "the full event, as GET /event" }
```

**Updates are partial.** Only supplied keys are written. `categoryIDs` and
`groupIDs` are replaced when present and **left alone when omitted** — so a
rename can't silently unlink an event's classes. Visibility is likewise only
recomputed if `isPublic`/`allMembers` is sent.

Accepted: `name, type, date, startTime, endDate, endTime, venueID, location,
notes, fee, feeDue, account, maxAttendees, closeDate, terms, personID,
programID, awardID, categoryIDs, groupIDs, isPublic, allMembers`.

`status` is a **bitmask**, not an enum — `1 DEFAULT | 2 GLOBAL | 4 PUBLIC`, so a
public event is `5`. `type` is `0 default · 1 attendance · 2 booking · 4 game ·
5 online · 6 programme`.

### `POST /emailInvites`

```json
{ "eventID": 125, "all": false }  →  { "sent": 12 }
```

**The platform's own Send button, over the API** — the same flow as
`post/manager/event.php?action=email`, not a generic mailer. It uses the event's
own email content and banner, sends from the event's owner, routes through
`commContacts()` so a child's invitation reaches their parents, gives each
invitee their own reply token, honours the trial cap and `maxRecipients()`, and
records an `Email` row with `STATUS_SENT_EVENT` so the send lands in the club's
history.

`all` false (default) emails only people never emailed; true re-sends to everyone
still pending. Invitees move to `STATUS_INVITED` only if the send succeeded.

This is what lets the module stop sending its own email: one flow, one history,
one set of rules about who actually receives a member's mail.

### `POST /fee`

```json
{ "eventID": 125, "personID": 390, "amount": 35, "account": "200" }
```
```json
{ "feeID": 8821, "created": true, "amount": 35,
  "credited": 1, "emailed": true, "xeroSent": true }
```

Charges one person for one event, and **completes the charge** the way
`action=applyfee` does: applies any credit they hold, emails the invoice, and
sends it (with the credit allocations) to Xero. Each step is reported so a caller
can tell a finished invoice from one a human needs to re-send. Pass
`email: false` / `xero: false` to suppress either.

`amount` defaults to the event's own `fee`; `account` to its own account. Refuses
to charge the same person twice for the same event, so a retried registration is
safe. **A programme day charges the PROGRAMME, not the day** — that is how
`EventPerson::fee()` looks it up, and what bills a family once for the week.

### `POST /eventDelete`

`{ "eventID": 128 }` → soft-delete (`status = 0`), the platform's own convention.

### `POST /program`

Create or update a `Program` (pass `programID` to update). Programme days are
then normal events with `type: 6` and `programID` set.

---

## Attendance

### `GET /attendance?eventID=`

```json
[ { "personID": 335, "name": "Anahera Wilson", "status": 1, "type": 1,
    "signedInTime": "2025-06-01 16:00:00", "signedOutTime": null,
    "note": "", "hours": 0 } ]
```

`status`: `-1 declined · 0/2 invited · 1 attended · 3 included · 4 confirmed`.
`type`: `0 default · 1 staff · 2 trial · 3 guest`.

### `POST /attendance`

Batch, and reports per entry — a partial failure has to be visible rather than
silently losing one person's attendance.

```json
{ "eventID": 125, "entries": [
    { "personID": 40,  "status": 1, "signedInTime": "2026-08-15 09:05:00" },
    { "personID": 390, "status": 4 } ] }
```
```json
{ "eventID": 125, "results": [
    { "personID": 40, "ok": true },
    { "personID": 999999, "ok": false, "error": "Person 999999 not found" } ] }
```

---

## Money

### `GET /fees?eventID=&personID=`

What has been charged against an event, and paid.

```json
[ { "feeID": 4008, "personID": 40, "name": "Winter Camp", "amount": 45,
    "date": "2026-07-29", "dueDate": "2026-08-15",
    "account": null, "paid": 0 } ]
```

### `POST /fee`

```json
{ "eventID": 125, "personID": 40, "amount": 45 }
```
```json
{ "feeID": 4008, "created": true, "amount": 45 }
```

Omit `amount` to use the event's own fee. Creates the `EventPerson` row if the
person isn't on the event yet.

**Refuses to double-charge.** A second call for the same person+event returns
the existing fee:

```json
{ "feeID": 4008, "created": false, "reason": "already charged" }
```

**A programme day charges the PROGRAMME**, not the day —
`assocType: 'Program', assocID: programID` — so a family is billed once for the
week rather than once per morning. That is also how `EventPerson::fee()` looks
it up, so getting it wrong would hide the charge from the platform *and* defeat
the duplicate guard above.

---

## Errors

```json
{ "error": { "message": "Person 999999 not found" } }
```

| Status | Means |
|---|---|
| 401 | Missing/invalid API key, or a spent login token |
| 403 | Key required and none supplied |
| 404 | No such endpoint or method |
| 422 | Missing or invalid parameter |
| 500 | Something else — **check `/var/log/fm/api.log`**, the body will be a bare `[]` |

That last row is a quirk of the existing framework, not this endpoint: for
anything that isn't an `ApiException`, `api/v1.php` echoes an unassigned
property, so the message never reaches the response. The log has it.
