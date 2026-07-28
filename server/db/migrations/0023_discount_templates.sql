-- A club's SAVED discount templates.
--
-- The discount dialog has always had a "Save as template" switch, and it did
-- nothing: the flag was set on the draft and never read by anything, so the picker
-- only ever offered the eight built-in presets from code. A club that builds
-- "Sibling — 25% off, 2+ registrations" for one event had to build it again for
-- the next one.
--
-- `preset` is the DiscountDraft minus its identity (no id, no name of the event it
-- came from): exactly what makeDiscountDraft produces, so applying a template is
-- the same operation as applying a built-in one.
create table if not exists discount_templates (
  id varchar(36) primary key,
  org_id varchar(36) not null,
  name text not null,
  preset json not null,
  created_at timestamp not null default current_timestamp,
  index idx_discount_templates_org (org_id)
);
