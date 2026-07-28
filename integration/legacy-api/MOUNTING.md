# Mounting the module — the four edits, one at a time

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

## After all four

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
| `pages/events/switch.php` | 12 | 0 |
| `pages/attendance/switch.php` | 15 | 0 |
| `pages/programs/switch.php` | 14 | 0 |
| `pages/people/tabs/tab-content.php` | 10 | 1 (an `include` wrapped in if/else) |

Two new files, four guarded blocks, one `include` wrapped. Nothing removed.
