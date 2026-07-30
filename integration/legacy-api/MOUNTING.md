# Mounting the module — the six edits, one at a time

`mounting-changes.patch` applies all of this in one go. If you'd rather see
exactly what lands where, this is the same thing written out by hand.

**Every edit is additive**, sits at the top of the file, and is wrapped in
`if ($CLUB_DB->setting('fmevents-url'))`. No existing line is modified or
removed except one `include` in edit 4, which becomes an if/else around the same
include. With the setting unset, all four files behave exactly as they do today
— that is also the rollback.

You can apply these one at a time and deploy between each; they don't depend on
each other.

---

## Edit 1 — `application/pages/events/switch.php`

Mounts `/events`.

**Where:** immediately after the opening `<?php`, before the existing
`if ($components[1] == 'new') {`.

**Before**
```php
<?php
if ($components[1] == 'new') {
    if ($USER['role'] < Person::ROLE_MANAGER) return 403;
    $PAGE->title = "New Event";
```

**After**
```php
<?php
// Events have moved to the FM Events module. Clearing the `fmevents-url`
// setting puts every legacy events page back exactly as it was.
if ($CLUB_DB->setting('fmevents-url')) {
    $PAGE->title = 'Events';
    $GLOBALS['FMEVENTS'] = [
        'view'  => $components[1] === 'new' ? 'new' : 'calendar',
        'event' => ($components[1] && !in_array($components[1], ['new', 'list', 'report'], true)) ? $components[1] : null,
    ];
    $PAGE->contentFile = 'fmevents/embed.php';
    return 1;
}

if ($components[1] == 'new') {
    if ($USER['role'] < Person::ROLE_MANAGER) return 403;
    $PAGE->title = "New Event";
```

**Why `$GLOBALS`:** a `switch.php` is `include`d from inside
`FMPage::__construct()`, so anything set as a plain variable is function-scoped
and never reaches the content file. `$GLOBALS` is the only way to hand it
context. `embed.php` reads `$GLOBALS['FMEVENTS']` and nothing else.

**What `event` does:** passes the id through so `/events/123` opens that event in
the module rather than landing on the calendar. `new`, `list` and `report` are
excluded because they're page names, not ids.

**Affects:** `/events`, `/events/new`, `/events/{id}`, `/events/list`,
`/events/report`.

---

## Edit 2 — `application/pages/attendance/switch.php`

Mounts `/attendance`, **except the five legacy reports**.

**Where:** after the existing role check on line 2, before
`if ($components[1] == 'new') {`.

**Before**
```php
<?php
if ($USER['role'] < Person::ROLE_BASIC) return 403;

if ($components[1] == 'new') {
```

**After**
```php
<?php
if ($USER['role'] < Person::ROLE_BASIC) return 403;

// Attendance has moved to the FM Events module.
// NB the legacy reports under /attendance (awards, hours, non-attendance,
// trialist, visitors) are NOT part of the module yet, so they are deliberately
// left on the old pages until they are rebuilt.
if ($CLUB_DB->setting('fmevents-url')
    && !in_array($components[1], ['awards', 'hours', 'nonattendance', 'trialist', 'visitors', 'report'], true)) {
    $PAGE->title = 'Attendance';
    $GLOBALS['FMEVENTS'] = [
        'view'  => 'attendance',
        'event' => ($components[1] && $components[1] !== 'new') ? $components[1] : null,
    ];
    $PAGE->contentFile = 'fmevents/embed.php';
    return 1;
}

if ($components[1] == 'new') {
```

**Note the role check stays first**, so `ROLE_BASIC` is still enforced before
anything is mounted.

**Deliberately still on the old pages:** `/attendance/awards`,
`/attendance/hours`, `/attendance/nonattendance`, `/attendance/trialist`,
`/attendance/visitors`, `/attendance/report`. The module has no equivalent for
those six yet, and breaking a working report to show a blank one would be worse
than leaving it.

**Affects:** `/attendance`, `/attendance/new`, `/attendance/recurring`,
`/attendance/generate`, `/attendance/{id}`.

---

## Edit 3 — `application/pages/programs/switch.php`

Mounts `/programs`, **except the member booking journey**.

**Where:** after the existing module check on line 2, before
`if ($components[1] == 'book') {`.

**Before**
```php
<?php
if (!$CLUB_DB->setting('module-program')) return 404;

if ($components[1] == 'book') {
```

**After**
```php
<?php
if (!$CLUB_DB->setting('module-program')) return 404;

// Holiday programmes have moved to the FM Events module.
// The member-facing booking journey (/programs/book/...) is left on the old
// pages on purpose: it is a payment flow mid-transaction, and the module has
// its own public registration to replace it with rather than half-swap it.
if ($CLUB_DB->setting('fmevents-url') && $components[1] !== 'book') {
    $PAGE->title = $CLUB_DB->text('program');
    $GLOBALS['FMEVENTS'] = [
        'view'    => 'programmes',
        'program' => $components[1] ?: null,
    ];
    $PAGE->contentFile = 'fmevents/embed.php';
    return 1;
}

if ($components[1] == 'book') {
```

**`$components[1] !== 'book'` is the important part.** `/programs/book/...` is a
member mid-payment — dates, terms, summary, finish. Half-swapping a payment flow
is the one thing worth being conservative about, so it stays entirely on the old
pages.

**The `module-program` check stays first**, so a club without the module still
gets its 404.

**Affects:** `/programs`, `/programs/{id}`. **Not** `/programs/book/*`.

---

## Edit 4 — `application/pages/people/tabs/tab-content.php`

The profile's Events tab. **This is the only edit that touches an existing
line** — one `include` becomes an if/else around that same include.

**Where:** the `$tabs['events']` block, around line 34.

**Before**
```php
    if ($tabs['events']) {
        ?>
        <div class="tab-pane" id="events">
            <?php include 'pages/events/calendar.php' ?>
        </div>
        <?php
    }
```

**After**
```php
    if ($tabs['events']) {
        ?>
        <div class="tab-pane" id="events">
            <?php
            // This tab is the club calendar scoped to one person, so when the
            // FM Events module is on it shows the module's calendar filtered to
            // them instead of the legacy FullCalendar widget.
            if ($CLUB_DB->setting('fmevents-url')) {
                $GLOBALS['FMEVENTS'] = ['view'=>'calendar', 'person'=>$person->id];
                include 'pages/fmevents/embed.php';
            } else {
                include 'pages/events/calendar.php';
            }
            ?>
        </div>
        <?php
    }
```

**Why this file and not a route:** the profile's Events tab isn't a page of its
own — it `include`s `pages/events/calendar.php`, the same FullCalendar widget
`/events` used. So the tab had to be switched where it's rendered.

**`$person` is already in scope here** (`pages/people/init.php` sets it), which
is what scopes the module's calendar to that member.

**Left alone on purpose:** `pages/events/calendar.php` itself is unchanged, so
the other three places that include it — `pages/venues/venue.php`,
`pages/venues/book-times.php` and `embed/calendar.php` — keep the legacy widget.
Replacing the file itself would have silently changed the venue pages and the
public website embed too.

---

## Edit 5 — `application/pages/settings/tabs.php`

The module's **event settings** as a tab on the club's own Settings page.

Categories, registration forms and event payment options are configured in the
module, and today that means leaving Settings to find them. This puts them where
a club already goes to configure everything else — the same treatment the
profile's Events tab gets in edit 4.

**Where:** two additions to the existing `$tabs` array, before the `?>` on
line 38.

**Before**
```php
if ($USER['role'] == Person::ROLE_EXPERIMENTAL) {
    $tabs += [
        'fields' => 'Custom Fields',
    ];
}
```

**After**
```php
if ($USER['role'] == Person::ROLE_EXPERIMENTAL) {
    $tabs += [
        'fields' => 'Custom Fields',
    ];
}
// Event settings live in the FM Events module. Unset the `fmevents-url`
// setting and the tab disappears — Settings is exactly as it is today.
if ($CLUB_DB->setting('fmevents-url')) {
    $tabs += [
        'fmevents' => 'Events',
    ];
}
```

**Plus one new file** — `application/pages/settings/fmevents.php`. The tab loop
does `include "$id.php"`, so the tab's key is its filename:

```php
<?php
// The module's own event settings (categories, registration forms, payment
// options), rendered inside the club's Settings page.
$GLOBALS['FMEVENTS'] = ['view' => 'settings-events'];
include 'pages/fmevents/embed.php';
```

**Why `$GLOBALS` again:** same reason as edit 1 — `embed.php` reads
`$GLOBALS['FMEVENTS']` and nothing else. The module maps `view=settings-events`
to its Settings → Events panel.

**Height is already handled:** `embed.php` ships
`.tab-pane .fmevents-embed iframe { height: 70vh; min-height: 420px; }`, so a
tabbed embed sizes itself without further CSS.

**Access:** `settings/switch.php` already gates the whole page on
`ROLE_ADMIN`, so no extra check is needed here.

**Affects:** `/settings` — one new tab. No existing tab changes.

---

## Edit 6 — `application/inc/menu.php`

**Pinned calendars as menu items.**

A club pins a calendar ("Holiday Programme", "Committee") to its menu in the
module. Inside the platform that does nothing, because the module's own left
rail is hidden — this shell supplies the navigation — so the one route to a
pinned calendar doesn't exist. These become sub-items under the existing Events
entry.

**Where:** inside the existing `$menu['events']` block, around line 150.

**Before**
```php
if ($USER['role'] >= Person::ROLE_COORD || ($USER['role'] >= Person::ROLE_MANAGER && $USER['staff'])) {
    $menu['events'] = ['Events', 'calendar'];
    if ($USER['role'] >= Person::ROLE_COORD && $CLUB_DB->setting('module-venues')) {
        $menu['events'][2]['venues'] = ['Venues & Bookings', 'building'];
    }
}
```

**After**
```php
if ($USER['role'] >= Person::ROLE_COORD || ($USER['role'] >= Person::ROLE_MANAGER && $USER['staff'])) {
    $menu['events'] = ['Events', 'calendar'];
    // Calendars the club pinned in the FM Events module. Read from a cached
    // setting, never from an HTTP call — this file runs on every page load, and
    // an unreachable module must not be able to slow the platform down. An
    // empty or missing setting simply adds nothing.
    if ($CLUB_DB->setting('fmevents-url')) {
        foreach (json_decode($CLUB_DB->setting('fmevents-calendars') ?: '[]', true) ?: [] as $cal) {
            if (empty($cal['id']) || empty($cal['name'])) continue;
            $menu['events'][2]['events/calendar/'.$cal['id']] = [$cal['name'], $cal['icon'] ?: 'calendar'];
        }
    }
    if ($USER['role'] >= Person::ROLE_COORD && $CLUB_DB->setting('module-venues')) {
        $menu['events'][2]['venues'] = ['Venues & Bookings', 'building'];
    }
}
```

**Plus the route.** `events/calendar/<id>` has to reach the module, so edit 1's
block gains one line — `$components[1] === 'calendar'` passes the id through as
`calendar` rather than treating it as an event id:

```php
if ($CLUB_DB->setting('fmevents-url')) {
    $PAGE->title = 'Events';
    $isCalendar = ($components[1] ?? null) === 'calendar';
    $GLOBALS['FMEVENTS'] = [
        'view'     => $components[1] === 'new' ? 'new' : 'calendar',
        'calendar' => $isCalendar ? ($components[2] ?? null) : null,
        'event'    => (!$isCalendar && $components[1] && !in_array($components[1], ['new', 'list', 'report'], true)) ? $components[1] : null,
    ];
    $PAGE->contentFile = 'fmevents/embed.php';
    return 1;
}
```

`embed.php` passes `calendar` through in its query string exactly as it does
`event` and `person`; the module opens `/events?calendar=<id>`.

### Filling `fmevents-calendars`

The module serves the list at:

```
GET <fmevents-url>/api/v1/legacy/menu?club=<slug>
Authorization: token <LEGACY_API_KEY>

{ "calendars": [ { "id": "…", "name": "Holiday Programme",
                   "icon": "calendar", "colour": "#1E2157" } ] }
```

Only pinned calendars, in the club's own order. **Cache it into the setting** —
a nightly cron, or whatever the platform already uses for this kind of thing:

```php
$json = json_encode(fetch("<fmevents-url>/api/v1/legacy/menu?club=".CLUB_NAME));
$CLUB_DB->setting('fmevents-calendars', $json);
```

Stale by up to a cron interval, which is the right trade: a menu built from a
live call would put the module on the critical path of every page in the
platform. If you'd rather not run a cron at all, the setting can be pasted in by
hand — it changes about as often as a club renames a menu item.

**Rollback:** clear `fmevents-calendars` (the sub-items vanish) or
`fmevents-url` (everything reverts, as always).

---

## After all six

Nothing has changed for anyone. Confirm that first if you like:

```sql
SELECT `key`, `value` FROM Settings WHERE `key` = 'fmevents-url';   -- expect empty
```

With no row, all four guards are false and every page takes its existing path.
Then when you're ready:

```sql
REPLACE INTO Settings (`key`, `value`)
VALUES ('fmevents-url', 'https://<events-module-host>');
```

and to roll back:

```sql
DELETE FROM Settings WHERE `key` = 'fmevents-url';
```

Takes effect on the next page load. No deploy, and it's per club.

---

## Summary

| File | Lines added | Existing lines changed |
|---|---|---|
| `pages/events/switch.php` | 12 | 0 (+2 in edit 6, same block) |
| `pages/attendance/switch.php` | 15 | 0 |
| `pages/programs/switch.php` | 14 | 0 |
| `pages/people/tabs/tab-content.php` | 10 | 1 (an `include` wrapped in if/else) |
| `pages/settings/tabs.php` | 6 | 0 |
| `inc/menu.php` | 8 | 0 |

Three new files (`fmevents/embed.php`, `Api/fmevents.php`,
`settings/fmevents.php`), six guarded blocks, one `include` wrapped. Nothing
removed.

Edits 1–4 stand alone. **Edit 6 needs edit 1** (it extends that same block) and
the `fmevents-calendars` setting; edit 5 needs its new file. Everything stays
behind `fmevents-url`, so clearing that one setting is still the whole rollback.
