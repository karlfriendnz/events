-- Pin a calendar to the main left menu + store its view settings on the row
-- (so a shared, pinned club calendar looks the same for every user/device —
-- the per-calendar prefs used to live only in each browser's localStorage).

alter table calendars add column if not exists pin_to_nav boolean not null default false;
alter table calendars add column if not exists icon  text;   -- PrimeIcon name for the nav item, e.g. 'pi-calendar'
alter table calendars add column if not exists color text;   -- accent colour for the nav item
alter table calendars add column if not exists settings jsonb; -- { colorBy, defaultView, weekStart, showWeekends, newButtonLabel, filters }

-- Fast lookup of an org's pinned calendars for the nav.
create index if not exists calendars_pinned_idx on calendars(org_id) where pin_to_nav;
