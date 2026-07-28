# Review tasks — 1 open across 1 page

Generated 2026-07-28T04:33:54.253Z from the in-app review widget.

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

## `/events/new-basic` — 1 open

### 1. Let's remove this continue button because it's confusing.

- **id**: `896f933b-1df3-428f-8929-ed1acbc1fd9c`
- **where**: Step 5 of 6 · Registration form › dialog "Create Event" › Continue › button "Continue"
- **file**: `components/FormDesigner.vue`
- **components**: FormDesigner › new-basic › RouteProvider › RouterView › NuxtPage › default
- **selector**: `div > div.shrink-0 > div > button.font-semibold`
- **by**: Karl · 0m ago
