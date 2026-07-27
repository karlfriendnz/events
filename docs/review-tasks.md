# Review tasks — 7 open across 1 page

Generated 2026-07-27T01:42:32.880Z from the in-app review widget.

The app is running at **http://localhost:3005** — that's where the PATCHes below go. Don't
assume a port: this line is written by the server that served the brief.

**How to work this list** — triage first, then one at a time.

**Step 1 — triage before writing any code.** Read every item and tell Karl,
in one short list, which you understand and which you do not. He would much
rather answer three questions up front than review three wrong changes. Do
not start until he has replied.

**Step 2 — then work them ONE AT A TIME**, in the order Karl agrees. After
each item, mark it and move to the next. Do NOT batch a dozen changes and
report at the end: the whole point of marking each one is that Karl checks it
while you build the next.

Marking an item done — note this does NOT resolve it. A robot icon appears
against the comment in the panel and Karl signs it off himself:

```
PATCH http://localhost:3005/api/v1/reviews/comments/<id>
{ "claudeStatus": "done", "claudeNote": "what changed, one line" }
```

Anything you cannot place or understand — ASK, do not guess. A change to the
wrong element is worse than an unactioned note, and this puts the question on
the comment itself where Karl will see it:

```
PATCH http://localhost:3005/api/v1/reviews/comments/<id>
{ "claudeStatus": "needs_info", "claudeNote": "the question, one line" }
```

---

## `/events/view/:id()` — 7 open

### 1. On creation of an event, please add the logged in user as the coordinator, but turn off all notifications

- **id**: `76d5291f-da7e-44e7-8c48-aec3c19358a2`
- **where**: page-level note (not pinned to an element)
- **by**: Karl · 2h ago
- **reply** (Claude): Which ways of making an event should add you as coordinator — quick events only, or all four ways? And should it happen the moment the draft starts, or only once the event is published?
- **reply** (Karl): I think for quick events for now - we will look at the other ones later

### 2. Send invite functioiality

- **id**: `a50b4dc0-de09-49c8-94e7-40e8e5900ed8`
- **where**: EventsKates quick event K › Attendance › button "Communication"
- **file**: `pages/events/view/[id].vue`
- **components**: [id] › RouteProvider › RouterView › NuxtPage › default › AsyncComponentWrapper
- **selector**: `main > div > div > button.-mb-px`
- **by**: Karl · 2h ago

### 3. Add a column here called Sign In time and sign out time - print only

- **id**: `0f689bf9-7789-4eca-98a4-8f99224b32d9`
- **where**: dialog "Print preview" › Status › p "Columns"
- **file**: `components/EventAttendance.vue`
- **components**: BaseTransition › Portal › Dialog › EventAttendance › [id] › RouteProvider
- **selector**: `div > div > div.shrink-0 > p.font-semibold`
- **by**: Karl · 2h ago

### 4. Sort table Alpha by first name by default

- **id**: `74d90fe9-f18c-4d29-9bd4-e23e0a50be9d`
- **where**: dialog "Print preview" › Kates quick event › th "Member"
- **file**: `components/EventAttendance.vue`
- **components**: BaseTransition › Portal › Dialog › EventAttendance › [id] › RouteProvider
- **selector**: `table > thead > tr.uppercase > th`
- **by**: Karl · 2h ago

### 5. Ability to sort coloumns before printing

- **id**: `1e50fb8e-3a71-4c30-8a15-8fa1d6e67458`
- **where**: dialog "Print preview" › Kates quick event › th "Member"
- **file**: `components/EventAttendance.vue`
- **components**: BaseTransition › Portal › Dialog › EventAttendance › [id] › RouteProvider
- **selector**: `table > thead > tr.uppercase > th`
- **by**: Karl · 2h ago

### 6. Split name to first name and last name to have different coloumns

- **id**: `8b5cc82c-07e1-482a-bcc4-dd4ed0e3087d`
- **where**: dialog "Print preview" › div
- **file**: `components/EventAttendance.vue`
- **components**: BaseTransition › Portal › Dialog › EventAttendance › [id] › RouteProvider
- **selector**: `div > div > div > div.shrink-0`
- **already actioned**: The printed roll now has separate First name and Last name columns instead of one name column. — awaiting sign-off, skip unless reopening
- **by**: Karl · 2h ago

### 7. If the event is a quick event, please hide the sign out column and change the word sign in to attended.

- **id**: `88252067-e4b7-4369-bba2-d39ef1a746af`
- **where**: EventsKates quick event K › th "Sign In"
- **file**: `components/EventAttendance.vue`
- **components**: EventAttendance › [id] › RouteProvider › RouterView › NuxtPage › default
- **selector**: `table > thead.sticky > tr > th.font-semibold`
- **already actioned**: Quick events now show a single Attended column — Sign Out is hidden, along with its bulk button. — awaiting sign-off, skip unless reopening
- **by**: Karl · 2h ago
