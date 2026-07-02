-- Waitlist ordering. A waitlist can be ordered three ways:
--   custom   — manual drag/up-down order (sort_order)
--   fifo     — first-in, first-served (by created_at)
--   priority — by a per-person priority (High/Normal/Low), then join time
alter table waitlists add column if not exists order_mode text not null default 'custom';
-- Per-entry priority for the 'priority' mode: 3 = High, 2 = Normal, 1 = Low.
alter table waitlist_entries add column if not exists priority int not null default 2;
