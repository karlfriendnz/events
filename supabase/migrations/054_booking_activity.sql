alter table bookings add column if not exists activity_id uuid references activities(id) on delete set null;
