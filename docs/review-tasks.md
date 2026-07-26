# Review tasks — 1 open across 1 page

Generated 2026-07-24T04:23:09.151Z from the in-app review widget.

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
PATCH /api/v1/reviews/comments/<id>
{ "claudeStatus": "done", "claudeNote": "what changed, one line" }
```

Anything you cannot place or understand — ASK, do not guess. A change to the
wrong element is worse than an unactioned note, and this puts the question on
the comment itself where Karl will see it:

```
PATCH /api/v1/reviews/comments/<id>
{ "claudeStatus": "needs_info", "claudeNote": "the question, one line" }
```

---

## `/bookables/new` — 1 open

### 1. Make this a wizard like the other event wizards

- **id**: `42d50c34-15d1-4006-8ce4-340adf1fd863`
- **where**: Bookables K › div
- **file**: `pages/bookables/new.vue`
- **components**: new › RouteProvider › RouterView › NuxtPage › default › AsyncComponentWrapper
- **selector**: `div.transition-[margin] > main > div > div`
- **by**: Karl · 2h ago
- **reply** (Claude): This page already has steps (Details, Activities, Availability, Review). The difference from the event wizards is that they open as a pop-up window in the middle of the screen, while this one fills the whole page. Do you want me to switch it to the same pop-up window style as the event wizards? It is a bigger change, so I want to be sure before I start.
- **reply** (Karl): Yes, I want to switch it to a pop-up.
