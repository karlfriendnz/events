-- Track when (and whether) an email went out for a notification.
alter table notifications
  add column if not exists email_sent_at timestamptz;

create index if not exists notifications_pending_email_idx
  on notifications(created_at)
  where email_sent_at is null;
