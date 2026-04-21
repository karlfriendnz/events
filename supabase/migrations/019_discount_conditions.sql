-- Richer discount condition support
alter table discounts
  add column if not exists form_text   text,
  add column if not exists valid_from  timestamptz,
  add column if not exists apply_to    text not null default 'per_person',
  add column if not exists conditions  jsonb not null default '[]';
