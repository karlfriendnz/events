# One-renderer merge — editor canvas → `<FormRenderer edit>`

Goal: the form builder's canvas renders the **live `FormRenderer`** in an `edit` mode,
so editor == preview == live registration by construction. Delete the parallel
`EvtFieldCell` path once parity is proven.

Approach: **gated + incremental**. Build the edit mode alongside the existing
`EvtFieldCell` canvas (behind `evtUnifiedCanvas`, default OFF). Prove each phase in the
browser. Flip the default only when at full parity. Keep the app working at every commit.

## Phases

- [ ] **A — click-to-edit + inert render.** `FormRendererField` gains `editable`
      (inert inputs + `edit` emit). `FormRenderer` gains `edit` + `@edit-field`; in edit
      mode each field is click-to-edit with a hover ring + a (visual) drag handle. Wire a
      gated `<FormRenderer edit>` in `FormDesigner` → `openEvtFieldEditor`. Verify: clicking
      a field opens its editor; live form unchanged (edit defaults off).
- [ ] **B — drag-reorder.** SortableJS on the edit-mode field lists; emit `@reorder`
      (subjectKey, fromParent, order). `FormDesigner` reorders its field arrays. Verify.
- [ ] **C — sections + drop-zones + add-from-library.** Section holders accept drops
      (`@drop-field` sets `parent_section`); "drag fields here" empty state; library drag
      lands via `@add-field`. Verify.
- [ ] **D — name row + add-field affordance + SSO/order-summary parity** inside edit mode.
- [ ] **E — flip `evtUnifiedCanvas` default ON**, full browser parity pass, then delete
      the `EvtFieldCell` canvas block + `EvtFieldCell.vue`.

## Notes
- `FormDesigner` handlers to reuse: `openEvtFieldEditor(id)`, `onDropFieldTo`,
  `onDropIntoSection`, `registerSubjectGrid`, `registerSectionDropzone`,
  `startEvtFieldDrag`/`startEvtBlockDrag`/`onEvtFieldDragEnd`, `moveEvtField`.
- account/comms stay interactive in edit mode (they `@click.stop`); other inputs inert.
- Verify in browser at `/forms/:id` or the event wizard Registration-form step.
