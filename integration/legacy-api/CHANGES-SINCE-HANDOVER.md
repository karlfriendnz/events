# What changed since the first handover

Everything here is **additive** and still behind `fmevents-url`. `fmevents.php` and
`embed.php` are drop-in replacements for the copies you already have — nothing to
merge by hand. Two files are new, and there are two more mounting edits.

If you only apply part of this, apply it in the order below: each item works on
its own, and later ones don't depend on earlier ones.

---

## 1. `fmevents.php` — one new endpoint, three richer payloads

### New: `POST /emailInvites` — send an event's invitations

```json
{ "eventID": 125, "all": false }   →   { "sent": 12 }
```

Wraps the flow that already sits behind the event page's **Send** button
(`post/manager/event.php`, `action=email`), so the module sends invitations the
way the platform already does rather than growing a second mailer:

- the event's own email content and banner
- from the event's owner
- `commContacts()`, so a child's invitation reaches their parents
- a per-person token, so each reply is recorded against the right invitee
- the trial cap and `maxRecipients()`
- an `Email` row with `STATUS_SENT_EVENT`, so the send is in the club's history

`all` false emails only people never emailed; true re-sends to everyone still
pending. Invitees move to `STATUS_INVITED` only if the send succeeded.

**This is the one we most want.** Until it exists the module sends its own email,
which works but is a second place email comes from and the club can't see those
sends in its own history.

### `eventData()` gains `gameLink`

```php
'gameLink' => $this->gameLink($event),   // "/competitions/draws/division/3#round_5"
```

Null for anything that isn't `TYPE_GAME`, and for a game whose `CompGame` row is
missing or unviewable — one bad fixture must not take down the calendar feed.

A fixture isn't an event page, it's a line of a draw. The platform's own calendar
has always sent a click on a game to its division's draw anchored at the round
(`CompGame::eventInfo`), so with this the module sends it to the same place
instead of opening an event view of a fixture.

### `postFee()` now finishes the charge — please read this one

It created the `Fee` row and stopped. That is **one of the four things** the
platform does when a member is charged (`post/manager/event.php`,
`action=applyfee`):

```php
$fee = $ep->event()->applyFee($ep);
$credits = $fee->autoCredit();      // credit the member already holds
$fee->email();                      // email them the invoice
$xero->sendInvoices([$fee]);        // and send it to Xero
$xero->autoTransactions($credits);
```

So an invoice raised through the endpoint skipped the member's credit, was never
emailed, and never reached Xero — silently. A club would have found it in its
books weeks later, or not at all.

It now does all four, each step guarded on its own (an invoice that exists and
wasn't emailed can be re-sent; an exception that loses the invoice can't be
undone), and **reports what actually happened** rather than assuming:

```json
{ "feeID": 8821, "created": true, "amount": 35,
  "credited": 1, "emailed": true, "xeroSent": true }
```

`email` and `xero` can each be passed `false` to suppress that step.

**We are not calling this yet.** The module puts the event's price on the mirrored
`Event` (`fee` / `account`), and the club raises the money with its own button —
which already did all four things correctly. This endpoint only matters if we
later invoice from our side, and it needed fixing before anyone relied on it.

### `getAttendance()` returns the person, not just their name

Each roll row now carries `personSummary()` (first/last name, email, phone,
`dateOfBirth`, `gender`) plus `customFields`.

The module's attendance roll shows age, gender, contact details and the club's own
custom fields as columns. Sent **with** the roll rather than fetched per person —
a roll of 200 would otherwise be 200 more requests.

`customFieldValues()` is extracted so `getPerson` and the roll share one query
(hand-listing the fields in both drifted immediately: `dob` vs `dateOfBirth`, and
every roll came back with an empty date of birth).

---

## 2. `embed.php` — frame sizing, and one new parameter

- **`calendar`** joins `view` / `person` / `event` in the iframe URL, so a menu
  item can open one of the club's pinned calendars (see mounting edit 6).
- **The frame is now MEASURED, not guessed.** It used to be a fixed
  `calc(100vh - n)`, which overflowed the page — so the page scrolled *and* the
  module scrolled inside it. It now fits to the space actually left below its own
  top edge, and **subtracts anything pinned over the bottom of the window**: the
  trial banner (`#fm_signUpBottom`) was covering the module's Save buttons.
- The `fmevents:height` listener is gone. It grew the frame to its content height,
  which is the other half of the two-scrollbar problem — and the module never sent
  that message anyway.

---

## 3. Two new mounting edits (`MOUNTING.md` 5 and 6)

**Edit 5 — Settings gets an Events tab.** Six lines in `pages/settings/tabs.php`
plus one new 4-line file `pages/settings/fmevents.php`, so event categories, forms
and payment options are configured where a club already configures everything
else. No existing tab changes.

**Edit 6 — pinned calendars in the menu.** Eight lines in `inc/menu.php`, reading
a cached `fmevents-calendars` setting. **Never call the module while rendering a
menu** — that file runs on every page load, and nothing we do should be able to
slow the platform down. The module serves the list at
`GET <fmevents-url>/api/v1/legacy/menu?club=<slug>`; cache it into the setting on
a cron, or paste it in by hand (it changes about as often as a menu label).

Edit 6 also extends edit 1's block by two lines so `/events/calendar/<id>` passes
the id through as `calendar` rather than mistaking it for an event id.

---

## Still open — the one thing we can't do from here

The module can now read the club's people, and register its own events and
invitees on the club's calendar. What it cannot do is **create a person**: it uses
`POST /person`, which exists, but nothing decides whether a registration from the
public should merge onto an existing member or make a new one. That is a policy
question for the platform, not a missing endpoint.

Rollback is unchanged: clear `fmevents-url` and every page takes its existing path.
