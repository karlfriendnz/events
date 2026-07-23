# One-renderer merge — editor canvas → `<FormRenderer edit>`

Goal: the form builder's canvas renders the **live `FormRenderer`** in an `edit` mode,
so editor == preview == live registration by construction. Delete the parallel
`EvtFieldCell` path once parity is proven.

Approach: **gated + incremental**. Build the edit mode alongside the existing
`EvtFieldCell` canvas (behind `evtUnifiedCanvas`, default OFF). Prove each phase in the
browser. Flip the default only when at full parity. Keep the app working at every commit.

## Phases

- [x] **A — click-to-edit + inert render.** `FormRendererField` gains `editable`
      (inert inputs + `edit` emit). `FormRenderer` gains `edit` + `@edit-field`; in edit
      mode each field is click-to-edit with a hover ring + a (visual) drag handle. Wire a
      gated `<FormRenderer edit>` in `FormDesigner` → `openEvtFieldEditor`. Verified.
- [x] **B — drag-reorder.** SortableJS on the edit-mode field lists; emit `@restructure`
      (subjectKey, DOM structure). `FormDesigner` rebuilds its field arrays. Verified.
- [x] **C — sections + drop-zones + add-from-library.** Section holders accept drops
      (`@drop-field` → `onDropIntoSection`); "drag fields here" empty state; library drag
      lands via `@drop-field` → `onDropFieldTo`. Verified.
- [x] **D — SSO/order-summary/comms parity** inside edit mode (shared `OrderSummary` +
      `CommsPreferences`; account "Create a login" toggle; per-instance totals). Verified.
- [x] **E-1 — inline heading/section/banner/description editing** (subject + section
      headings as inline RichTextEditors; banner rename + upload; description editable).
- [x] **E — flipped `evtUnifiedCanvas` default ON** (2026-07-22). Verified on the
      standalone `/forms/:id` AND the event-wizard Registration-form step. `?unifiedCanvas=0`
      is the escape hatch back to the legacy `EvtFieldCell` canvas.
- [ ] **E-final (deferred) — delete the `EvtFieldCell` canvas block + `EvtFieldCell.vue`**
      once the unified path is proven in real club use. Kept as the fallback until then.

## Notes
- `FormDesigner` handlers to reuse: `openEvtFieldEditor(id)`, `onDropFieldTo`,
  `onDropIntoSection`, `registerSubjectGrid`, `registerSectionDropzone`,
  `startEvtFieldDrag`/`startEvtBlockDrag`/`onEvtFieldDragEnd`, `moveEvtField`.
- account/comms stay interactive in edit mode (they `@click.stop`); other inputs inert.
- Verify in browser at `/forms/:id` or the event wizard Registration-form step.
