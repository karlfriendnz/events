-- ENTITLEMENT BENEFIT LEVELS. "Holding this membership gets you X" where X is
-- not just inclusion: included (free) | percent off | amount off. Anything a
-- membership doesn't list stays full price. Applies uniformly to every target
-- type (group/code/event, later bookings…).
alter table membership_entitlements add column if not exists benefit_type text not null default 'included';
alter table membership_entitlements add column if not exists benefit_value numeric;
