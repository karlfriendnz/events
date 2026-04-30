create table if not exists bank_accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  details     text,
  is_default  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists bank_accounts_org_id_idx on bank_accounts(org_id);

-- Replace the single-string column with a foreign-key reference.
alter table organisations
  drop column if exists payment_bank_account;
alter table organisations
  add column if not exists default_bank_account_id uuid references bank_accounts(id) on delete set null;
