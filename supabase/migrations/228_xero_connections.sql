-- Xero integration foundation (Settings → Xero).
-- One connection per org: the club's own Xero organisation, connected via OAuth2.
-- Tokens live server-side only (server/utils/xero.ts refreshes + persists the
-- ROTATED refresh token on every refresh — Xero rotates it each time).
-- Mapping columns mirror PupManager's XeroConnection defaults; fee_accounts is
-- the legacy FM "named list of income accounts" ({ label, code, tracking? }[]).
create table if not exists xero_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references organisations(id) on delete cascade,
  tenant_id text not null,
  tenant_name text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  -- mapping defaults
  sales_account_code text,          -- fallback revenue account for lines with no own account
  bank_account_code text,           -- where payments land
  bank_account_name text,
  tax_type text,                    -- Xero TaxType applied to revenue lines
  fee_accounts jsonb,               -- curated named income-account list [{label, code, tracking?}]
  status text not null default 'online',   -- online | offline (refresh failed / access revoked)
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Blocking sync-error queue (legacy FM pattern: unresolved errors halt sync and
-- are surfaced until an admin resolves them). Written by the sync phase (later);
-- created now so the model is complete.
create table if not exists xero_sync_errors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  assoc_type text,                  -- 'person' | 'invoice' | 'payment' | ...
  assoc_id uuid,
  action text,                      -- what we were doing
  endpoint text,                    -- Xero endpoint involved
  message text,
  status text not null default 'open',  -- open | dup_contact | locked_period | resolved
  created_at timestamptz not null default now()
);
create index if not exists xero_sync_errors_open_idx
  on xero_sync_errors (org_id) where status <> 'resolved';
