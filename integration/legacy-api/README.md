# fmevents API — install

Everything in this folder goes into the FriendlyManager platform. It adds an API
the new events module talks to, and a page that renders that module in an
iframe. **Nothing existing changes behaviour** unless a club has the
`fmevents-url` setting — with it unset, every page behaves exactly as it does
today.

Should take about ten minutes, and step 4 tells you whether it worked.

---

## 1. Add two files

```
fmevents.php   →   application/classes/Api/fmevents.php
embed.php      →   application/pages/fmevents/embed.php     (new folder)
```

`fmevents.php` is a normal endpoint class in the existing `Api` framework — same
shape as `classes/Api/competitions.php`. It is not wired to anything until a
club has a key.

## 2. Apply the mounting changes

`mounting-changes.patch` — four files, about ten lines each, all at the top and
all wrapped in `if ($CLUB_DB->setting('fmevents-url'))`:

```
pages/events/switch.php
pages/attendance/switch.php
pages/programs/switch.php
pages/people/tabs/tab-content.php
```

Either apply them in one go:

```sh
git apply mounting-changes.patch
```

**or work through [`MOUNTING.md`](MOUNTING.md)**, which writes out each edit by
hand — before/after, why it sits where it does, and what each one affects. The
four are independent, so they can be applied and deployed one at a time.

**The patch is against `master` at `2083ed155` ("Remove incorrect execute
permission from recur").** If your branch has moved on, `git apply` may reject —
try `git apply -3` to merge, or apply the four changes by hand. Each is a single
guarded block at the top of the file, so it is quick either way, and
`git apply --check mounting-changes.patch` tells you before you commit to it.

Deliberately left alone: the legacy attendance reports (`awards`, `hours`,
`nonattendance`, `trialist`, `visitors`) and the member booking journey
(`/programs/book/...`). Those keep working as they do now.

## 3. Give a club a key

```sql
INSERT INTO fm_system.ApiKey (club_id, `key`, status)
VALUES (<club_id>, '<32 random hex chars>', 1);
```

Nothing else needs doing yet — the key alone enables the API. The club still
sees its normal pages.

## 4. Check it worked

```sh
./verify.sh https://theclub.friendlymanager.com <the-key>
```

Read-only — it only GETs, so it is safe against a live club. Expect:

```
AUTH
  ✓ no key                             refuses an unauthenticated call
CLUB REFERENCE
  ✓ club                               Demo Club · Pacific/Auckland
  ✓ categories                         3 categories
  ...
All 17 checks passed.
```

Add `--writes` to also create and immediately delete a test event, if you want
to prove the write path. Only do that somewhere you don't mind that happening.

## 5. Switch a club over (not yet — see below)

```sql
REPLACE INTO Settings (`key`, `value`)
VALUES ('fmevents-url', 'https://<events-module-host>');
```

`/events`, `/attendance`, `/programs` and the profile's Events tab now render
the new module. **To roll back, delete that row** — no deploy, no code change,
takes effect on the next page load.

> ### ⚠ Do not do this for a real club yet
>
> Steps 1–4 are safe and reviewable — they are additive, dormant, and change no
> existing behaviour. **Step 5 is different, and the blocker is on our side, not
> yours.**
>
> **The events module's own API does not authenticate.** Its `/api/v1/*` routes
> answer any caller who supplies an organisation id, and one of them —
> `/api/v1/legacy/event.patch` — takes an event id and writes back into *this*
> platform **using the club's API key held on our server**. An unauthenticated
> request to it returns `400 "a legacy event id is required"`, not `401`, so it
> executes. With a real id it edits the club's live event.
>
> The per-club key in step 3 is doing its job — it keeps the credential off the
> browser. The gap is that our server will use that credential for anyone who
> asks. So switching a club over today would put its calendar and roll behind an
> open door, however well `verify.sh` reads.
>
> We are fixing this (a real signed session from the token exchange, plus
> route-level checks). **Please hold step 5 until we confirm it's done.** Steps
> 1–4 need not wait — nothing is exposed until a club has `fmevents-url` set.

---

## Notes for review

Three things found while building this. None are caused by the new code, but
they shaped it and are worth knowing:

1. **`Api::route()` uses `method_exists()`, which ignores visibility.** Every
   *private* helper on an endpoint class is therefore reachable as a URL. Ours
   are named so they can't collide with a real endpoint (`requirePerson`, not
   `person`) — but the router is the better place to fix it.

2. **`api/v1.php` swallows the message on non-`ApiException` errors.** It calls
   `$api->fail($e)` and then echoes `$api->response`, which is never assigned —
   so a SQL error returns a bare `[]` with a 500. Every genuine failure during
   this build was invisible until we read `/var/log/fm/api.log`.

3. **Class autoloading is case-sensitive on Linux** (`classes/{Class}.php`).
   `Api\Competitions` in `competitions.php` resolves today only because macOS is
   case-insensitive. Ours is all-lowercase deliberately.

### Where it writes

The API only writes through the platform's own conventions:

- **Fees** — `Fee(personID, assocType:'Event', assocID:eventID)`, exactly as
  `EventPerson::fee()` looks them up. A programme day charges the PROGRAMME
  (`assocType:'Program'`) so a family is billed once for the week. Charging the
  same person twice for the same event is refused.
- **Attendance** — `EventPerson`, using the platform's own status constants.
- **Events** — `Event` + `EventCategoryLink` + `EventGroup`. Updates are
  PARTIAL: only supplied fields are written, and categories/classes are left
  alone unless explicitly sent, so awards, programme links, terms text and the
  roll survive an edit made from the new UI.

`Event`, `Person` and `EventPerson` have 14, 17 and 6 NOT NULL columns with no
defaults. The platform's model helpers omit some of them, which is fine on a
server running MySQL non-strict but fails under `STRICT_TRANS_TABLES`. This code
fills them explicitly so it works either way.

### Times

The platform stores dates and times as wall clock with no timezone, so `getClub`
reports the club's timezone and callers convert with it. Anything comparing a
stored time to an absolute timestamp must do the same — read in the server's
zone instead and a UTC host silently finds no clashes at all.
