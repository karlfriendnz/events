-- Add missing settings columns to sessions
alter table sessions
  add column if not exists has_waitlist boolean not null default false,
  add column if not exists is_public boolean not null default true,
  add column if not exists show_attendee_list boolean not null default false;
