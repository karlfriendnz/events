-- Sessions should default to NOT required (opt-in, not opt-out)
-- Previously defaulted to true, causing all sessions to appear locked on forms
alter table sessions alter column is_required set default false;
update sessions set is_required = false where is_required = true;
